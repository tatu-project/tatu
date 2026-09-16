import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import type {
  BriefingFallback,
  BriefingDeliveryReceipt,
  BriefingDraft,
  BriefingObservability,
  BriefingResult,
  BriefingTask,
  ExecutionEvent,
  ExecutionRecord,
  TatuStore,
} from '@tatu/shared';
import { hasSensitiveUrlQuery } from '@tatu/shared';

const isBriefingDeliveryReceipt = (
  value: unknown,
): value is BriefingDeliveryReceipt => {
  if (!value || typeof value !== 'object') return false;
  const receipt = value as Partial<BriefingDeliveryReceipt>;
  return (
    Object.keys(value).length === 4 &&
    receipt.channel === 'file-outbox' &&
    typeof receipt.idempotencyKey === 'string' &&
    receipt.idempotencyKey.length > 0 &&
    typeof receipt.artifactId === 'string' &&
    /^[a-f0-9]{64}\.md$/.test(receipt.artifactId) &&
    typeof receipt.contentSha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(receipt.contentSha256)
  );
};

const isBriefingFallback = (value: unknown): value is BriefingFallback => {
  if (!value || typeof value !== 'object') return false;
  const fallback = value as Partial<BriefingFallback>;
  return (
    Object.keys(value).length === 2 &&
    fallback.from === 'local-ollama' &&
    (fallback.reason === 'model_unavailable' ||
      fallback.reason === 'model_invalid_output' ||
      fallback.reason === 'model_timeout')
  );
};

const hasControlCharacter = (value: string) =>
  [...value].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 0x20 || code === 0x7f;
  });

const isBriefingObservability = (
  value: unknown,
  result: Pick<BriefingResult, 'route' | 'model' | 'fallback' | 'delivery'>,
): value is BriefingObservability => {
  if (!value || typeof value !== 'object') return false;
  const observability = value as Partial<BriefingObservability>;
  if (
    Object.keys(value).length !== 5 ||
    (observability.provider !== 'public-rss' &&
      observability.provider !== 'local-ollama') ||
    (observability.model !== null &&
      (typeof observability.model !== 'string' ||
        observability.model.length === 0 ||
        observability.model.length > 128 ||
        hasControlCharacter(observability.model))) ||
    !Array.isArray(observability.tools) ||
    observability.tools.length < 1 ||
    observability.tools.length > 3 ||
    new Set(observability.tools).size !== observability.tools.length ||
    observability.tools.some(
      (tool) =>
        tool !== 'public-rss' &&
        tool !== 'local-ollama' &&
        tool !== 'file-outbox',
    ) ||
    typeof observability.latencyMs !== 'number' ||
    !Number.isFinite(observability.latencyMs) ||
    !Number.isInteger(observability.latencyMs) ||
    observability.latencyMs < 0 ||
    observability.latencyMs > 86_400_000 ||
    !observability.estimatedCost ||
    typeof observability.estimatedCost !== 'object' ||
    Object.keys(observability.estimatedCost).length !== 1 ||
    (observability.estimatedCost as { status?: unknown }).status !== 'unknown'
  )
    return false;
  const tools = observability.tools;
  if (!tools.includes('public-rss')) return false;
  if (result.route === 'local-ollama') {
    if (
      observability.provider !== 'local-ollama' ||
      observability.model === null ||
      result.model?.id !== observability.model ||
      !tools.includes('local-ollama')
    )
      return false;
  } else if (
    observability.provider !== 'public-rss' ||
    observability.model !== null ||
    (result.fallback !== undefined && !tools.includes('local-ollama'))
  )
    return false;
  return result.delivery === undefined || tools.includes('file-outbox');
};

const isCitedStory = (
  value: unknown,
): value is BriefingResult['stories'][number] => {
  if (!value || typeof value !== 'object') return false;
  const story = value as BriefingResult['stories'][number];
  try {
    const url = new URL(story.url);
    return (
      typeof story.title === 'string' &&
      typeof story.source === 'string' &&
      typeof story.publishedAt === 'string' &&
      !Number.isNaN(Date.parse(story.publishedAt)) &&
      url.protocol === 'https:' &&
      url.username === '' &&
      url.password === '' &&
      !hasSensitiveUrlQuery(url)
    );
  } catch {
    return false;
  }
};
const isBriefingResult = (value: unknown): value is BriefingResult => {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<BriefingResult>;
  return (
    typeof result.topic === 'string' &&
    Array.isArray(result.stories) &&
    Array.isArray(result.facts) &&
    Array.isArray(result.inference) &&
    (result.route === undefined ||
      result.route === 'deterministic-rss' ||
      result.route === 'local-ollama') &&
    (result.model === undefined ||
      (typeof result.model === 'object' &&
        result.model !== null &&
        typeof result.model.id === 'string' &&
        result.model.route === 'local-ollama')) &&
    (result.fallback === undefined ||
      (result.route === 'deterministic-rss' &&
        isBriefingFallback(result.fallback))) &&
    (result.delivery === undefined ||
      isBriefingDeliveryReceipt(result.delivery)) &&
    (result.observability === undefined ||
      isBriefingObservability(result.observability, result)) &&
    result.stories.every(isCitedStory) &&
    result.facts.every(isCitedStory) &&
    result.inference.every((item) => typeof item === 'string')
  );
};

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
  briefing(executionId: string) {
    const row = this.database
      .prepare('SELECT result FROM executions WHERE id=?')
      .get(executionId) as { result: string | null } | undefined;
    if (!row?.result) return undefined;
    try {
      const result: unknown = JSON.parse(row.result);
      return isBriefingResult(result) ? result : undefined;
    } catch {
      return undefined;
    }
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
