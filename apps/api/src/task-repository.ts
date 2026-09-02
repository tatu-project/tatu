import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import type { BriefingDraft, BriefingTask } from '@tatu/shared';

export class TaskRepository {
  private readonly database: Database.Database;
  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.database = new Database(path);
    this.database.exec(
      'CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, cadence TEXT NOT NULL, time TEXT NOT NULL, quantity INTEGER NOT NULL, topic TEXT NOT NULL, delivery_requested INTEGER NOT NULL, timezone TEXT NOT NULL, enabled INTEGER NOT NULL, created_at TEXT NOT NULL)',
    );
  }
  create(draft: BriefingDraft): BriefingTask {
    const task: BriefingTask = {
      ...draft,
      id: crypto.randomUUID(),
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    this.database
      .prepare(
        'INSERT INTO tasks VALUES (@id,@cadence,@time,@quantity,@topic,@deliveryRequested,@timezone,@enabled,@createdAt)',
      )
      .run({ ...task, deliveryRequested: 1, enabled: 1 });
    return task;
  }
  list(): BriefingTask[] {
    type StoredTask = Omit<BriefingTask, 'deliveryRequested' | 'enabled'> & {
      deliveryRequested: number;
    };
    const rows = this.database
      .prepare(
        'SELECT id,cadence,time,quantity,topic,delivery_requested as deliveryRequested,timezone,enabled,created_at as createdAt FROM tasks ORDER BY created_at, id',
      )
      .all() as StoredTask[];
    return rows.map((row) => ({
      ...row,
      deliveryRequested: true,
      enabled: true,
    }));
  }
  close(): void {
    this.database.close();
  }
}
