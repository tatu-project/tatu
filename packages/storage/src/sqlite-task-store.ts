import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import type {
  BriefingDraft,
  BriefingTask,
  ExecutionEvent,
  ExecutionRecord,
  TatuStore,
} from '@tatu/shared';

/** SQLite is the local v0.1 adapter, not a production database decision. */
export class SqliteTaskStore implements TatuStore {
  private readonly database: Database.Database;
  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.database = new Database(path);
    this.database.pragma('journal_mode = WAL');
    this.database.pragma('busy_timeout = 5000');
    this.database.exec(
      'CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, cadence TEXT NOT NULL, time TEXT NOT NULL, quantity INTEGER NOT NULL, topic TEXT NOT NULL, delivery_requested INTEGER NOT NULL, timezone TEXT NOT NULL, enabled INTEGER NOT NULL, created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS executions (id TEXT PRIMARY KEY, task_id TEXT NOT NULL, occurrence_key TEXT NOT NULL UNIQUE, scheduled_for TEXT NOT NULL, status TEXT NOT NULL, attempt INTEGER NOT NULL, max_attempts INTEGER NOT NULL, available_at TEXT NOT NULL, lease_expires_at TEXT, claimed_by TEXT, result TEXT, failure TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS execution_events (id TEXT PRIMARY KEY, execution_id TEXT NOT NULL, type TEXT NOT NULL, at TEXT NOT NULL, detail TEXT)',
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
    return (
      this.database
        .prepare(
          'SELECT id,cadence,time,quantity,topic,delivery_requested as deliveryRequested,timezone,enabled,created_at as createdAt FROM tasks ORDER BY created_at,id',
        )
        .all() as Array<BriefingTask>
    ).map((row) => ({ ...row, deliveryRequested: true, enabled: true }));
  }
  listExecutions(): ExecutionRecord[] {
    return this.database
      .prepare(
        'SELECT id,task_id as taskId,occurrence_key as occurrenceKey,scheduled_for as scheduledFor,status,attempt,max_attempts as maxAttempts,available_at as availableAt,lease_expires_at as leaseExpiresAt,claimed_by as claimedBy,result,failure,created_at as createdAt,updated_at as updatedAt FROM executions ORDER BY created_at',
      )
      .all() as ExecutionRecord[];
  }
  events(executionId: string): ExecutionEvent[] {
    return this.database
      .prepare(
        'SELECT id,type,at,detail FROM execution_events WHERE execution_id=? ORDER BY rowid',
      )
      .all(executionId) as ExecutionEvent[];
  }
  close() {
    this.database.close();
  }
}
