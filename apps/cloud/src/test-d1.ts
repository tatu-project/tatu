/** Real SQLite adapter for deterministic D1-contract tests; never imported by production. */
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import type { D1Database, D1PreparedStatement, D1Result } from './types.js';

class TestStatement implements D1PreparedStatement {
  constructor(
    readonly database: Database.Database,
    readonly sql: string,
    readonly values: unknown[] = [],
  ) {}
  bind(...values: unknown[]): D1PreparedStatement {
    return new TestStatement(this.database, this.sql, values);
  }
  async first<T>(): Promise<T | null> {
    return (
      (this.database.prepare(this.sql).get(...this.values) as T | undefined) ??
      null
    );
  }
  async all<T>(): Promise<D1Result<T>> {
    return {
      success: true,
      results: this.database.prepare(this.sql).all(...this.values) as T[],
      meta: { changes: 0 },
    };
  }
  async run<T>(): Promise<D1Result<T>> {
    const result = this.database.prepare(this.sql).run(...this.values);
    return { success: true, results: [], meta: { changes: result.changes } };
  }
  execute<T>(): D1Result<T> {
    const statement = this.database.prepare(this.sql);
    if (statement.reader) {
      const results = statement.all(...this.values) as T[];
      return { success: true, results, meta: { changes: 0 } };
    }
    const result = statement.run(...this.values);
    return { success: true, results: [], meta: { changes: result.changes } };
  }
}
export class TestD1 implements D1Database {
  readonly database: Database.Database;
  constructor(path = ':memory:', migrate = true) {
    this.database = new Database(path);
    this.database.pragma('foreign_keys = ON');
    this.database.pragma('busy_timeout = 5000');
    if (migrate) {
      this.database.exec(
        readFileSync(
          new URL('../migrations/0001_workspace.sql', import.meta.url),
          'utf8',
        ),
      );
      this.database.exec(
        readFileSync(
          new URL('../migrations/0002_providers.sql', import.meta.url),
          'utf8',
        ),
      );
      this.database.exec(
        readFileSync(
          new URL('../migrations/0003_colab.sql', import.meta.url),
          'utf8',
        ),
      );
    }
  }
  prepare(sql: string): D1PreparedStatement {
    return new TestStatement(this.database, sql);
  }
  async batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    return this.database
      .transaction(() =>
        statements.map((statement) => {
          if (!(statement instanceof TestStatement))
            throw new Error('invalid_test_statement');
          return statement.execute<T>();
        }),
      )
      .immediate();
  }
  close() {
    this.database.close();
  }
}
export const createTestD1 = (path = ':memory:', migrate = true) =>
  new TestD1(path, migrate);
