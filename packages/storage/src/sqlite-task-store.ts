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
import {
  AssistantError,
  validBriefingDraft,
  hasOnlyKeys,
  hasSensitiveUrlQuery,
  hasTextSecret,
  safeAssistantText,
  type BriefingProposal,
  type TaskPatch,
} from '@tatu/shared';

const isBriefingDeliveryReceipt = (
  value: unknown,
): value is BriefingDeliveryReceipt => {
  if (!value || typeof value !== 'object') return false;
  const receipt = value as Partial<BriefingDeliveryReceipt>;
  return (
    Object.keys(value).length >= 4 &&
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
    (observability.provider !== 'public-rss' &&
      observability.provider !== 'local-ollama') ||
    (observability.model !== null &&
      (typeof observability.model !== 'string' ||
        observability.model.length === 0 ||
        observability.model.length > 128 ||
        hasControlCharacter(observability.model) ||
        hasTextSecret(observability.model))) ||
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
  const story = value as unknown as BriefingResult['stories'][number];
  try {
    const url = new URL(story.url);
    return (
      typeof story.title === 'string' &&
      !hasTextSecret(story.title) &&
      typeof story.source === 'string' &&
      !hasTextSecret(story.source) &&
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
    !hasTextSecret(result.topic) &&
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
        !hasTextSecret(result.model.id) &&
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
    result.inference.every(
      (item) => typeof item === 'string' && !hasTextSecret(item),
    )
  );
};

/**
 * SQLite stores JSON for the local adapter, so project only the provider-
 * independent contract when reading it back. Unknown provider fields are
 * intentionally discarded instead of becoming part of the public result.
 */
const sanitizeBriefingResult = (result: BriefingResult): BriefingResult => {
  const sanitized: BriefingResult = {
    topic: result.topic,
    stories: result.stories.map(({ title, url, publishedAt, source }) => ({
      title,
      url,
      publishedAt,
      source,
    })),
    facts: result.facts.map(({ title, url, publishedAt, source }) => ({
      title,
      url,
      publishedAt,
      source,
    })),
    inference: [...result.inference],
  };
  if (result.route !== undefined) sanitized.route = result.route;
  if (result.model !== undefined)
    sanitized.model = { id: result.model.id, route: result.model.route };
  if (result.fallback !== undefined)
    sanitized.fallback = {
      from: result.fallback.from,
      reason: result.fallback.reason,
    };
  if (result.delivery !== undefined)
    sanitized.delivery = {
      channel: result.delivery.channel,
      idempotencyKey: result.delivery.idempotencyKey,
      artifactId: result.delivery.artifactId,
      contentSha256: result.delivery.contentSha256,
    };
  if (result.observability !== undefined)
    sanitized.observability = {
      provider: result.observability.provider,
      model: result.observability.model,
      tools: [...result.observability.tools],
      latencyMs: result.observability.latencyMs,
      estimatedCost: { status: result.observability.estimatedCost.status },
    };
  return sanitized;
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
    this.database.exec(
      'CREATE TABLE IF NOT EXISTS task_proposals (id TEXT PRIMARY KEY,draft TEXT NOT NULL,expires_at TEXT NOT NULL,task_id TEXT)',
    );
    if (
      !(
        this.database.prepare('PRAGMA table_info(task_proposals)').all() as {
          name: string;
        }[]
      ).some((column) => column.name === 'request_key')
    )
      this.database.exec(
        'ALTER TABLE task_proposals ADD COLUMN request_key TEXT',
      );
    this.database.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS task_proposal_request_key ON task_proposals(request_key)',
    );
    this.database.exec(
      'CREATE TABLE IF NOT EXISTS task_schedule_state (task_id TEXT PRIMARY KEY,active_since TEXT NOT NULL)',
    );
  }
  create(draft: BriefingDraft): BriefingTask {
    if (!validBriefingDraft(draft)) throw new AssistantError('invalid_input');
    if (hasTextSecret(draft.topic)) throw new Error('unsafe_text');
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
    this.database
      .prepare('INSERT INTO task_schedule_state VALUES (?,?)')
      .run(task.id, task.createdAt);
    return task;
  }
  list(): BriefingTask[] {
    return (
      this.database
        .prepare(
          'SELECT id,cadence,time,quantity,topic,delivery_requested as deliveryRequested,timezone,enabled,created_at as createdAt FROM tasks ORDER BY created_at,id',
        )
        .all() as Array<BriefingTask>
    ).map((row) => ({
      ...row,
      deliveryRequested: true,
      enabled: Boolean(row.enabled),
    }));
  }
  update(id: string, patch: TaskPatch): BriefingTask | undefined {
    if (
      !hasOnlyKeys(patch, [
        'time',
        'timezone',
        'quantity',
        'topic',
        'enabled',
      ]) ||
      !Object.keys(patch).length ||
      ('enabled' in patch && typeof patch.enabled !== 'boolean')
    )
      throw new AssistantError('invalid_input');
    return this.database
      .transaction(() => {
        const task = this.list().find((item) => item.id === id);
        if (!task) return undefined;
        const changed = { ...task, ...patch };
        if (
          !validBriefingDraft({
            cadence: changed.cadence,
            time: changed.time,
            quantity: changed.quantity,
            topic: changed.topic,
            deliveryRequested: changed.deliveryRequested,
            timezone: changed.timezone,
          })
        )
          throw new AssistantError('invalid_input');
        this.database
          .prepare(
            'UPDATE tasks SET time=?,timezone=?,quantity=?,topic=?,enabled=? WHERE id=?',
          )
          .run(
            changed.time,
            changed.timezone,
            changed.quantity,
            changed.topic,
            changed.enabled ? 1 : 0,
            id,
          );
        const edited = ['time', 'timezone', 'quantity', 'topic'].some(
          (key) =>
            key in patch &&
            patch[key as keyof TaskPatch] !== task[key as keyof BriefingTask],
        );
        const stamp = new Date().toISOString();
        if (edited || (!task.enabled && changed.enabled))
          this.database
            .prepare('INSERT OR REPLACE INTO task_schedule_state VALUES (?,?)')
            .run(id, stamp);
        if (!changed.enabled || edited) {
          const pending = this.database
            .prepare(
              "SELECT id FROM executions WHERE task_id=? AND status='pending'",
            )
            .all(id) as { id: string }[];
          for (const execution of pending) {
            const reason = !changed.enabled ? 'task_paused' : 'task_changed';
            this.database
              .prepare(
                "UPDATE executions SET status='skipped',failure=?,updated_at=? WHERE id=? AND status='pending'",
              )
              .run(reason, stamp, execution.id);
            this.database
              .prepare('INSERT INTO execution_events VALUES (?,?,?,?,?)')
              .run(
                crypto.randomUUID(),
                execution.id,
                `skipped_${reason}`,
                stamp,
                reason,
              );
          }
        }
        return changed;
      })
      .immediate();
  }
  propose(
    draft: BriefingDraft,
    now = new Date(),
    requestKey?: string,
  ): BriefingProposal {
    if (!validBriefingDraft(draft)) throw new AssistantError('invalid_input');
    if (
      requestKey !== undefined &&
      (!safeAssistantText(requestKey, 128) ||
        !/^[A-Za-z0-9:_-]+$/u.test(requestKey))
    )
      throw new AssistantError('invalid_input');
    return this.database
      .transaction(() => {
        if (requestKey) {
          const existing = this.database
            .prepare(
              'SELECT id,draft,expires_at as expiresAt,task_id as taskId FROM task_proposals WHERE request_key=?',
            )
            .get(requestKey) as
            | {
                id: string;
                draft: string;
                expiresAt: string;
                taskId: string | null;
              }
            | undefined;
          if (existing) {
            if (existing.draft !== JSON.stringify(draft))
              throw new AssistantError('conflict');
            if (
              !existing.taskId &&
              Date.parse(existing.expiresAt) <= now.getTime()
            )
              throw new AssistantError('expired');
            return {
              id: existing.id,
              kind: 'create_briefing' as const,
              draft: { ...draft },
              expiresAt: existing.expiresAt,
            };
          }
        }
        const proposal = {
          id: crypto.randomUUID(),
          kind: 'create_briefing' as const,
          draft: { ...draft },
          expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
        };
        this.database
          .prepare(
            'INSERT INTO task_proposals (id,draft,expires_at,task_id,request_key) VALUES (?,?,?,NULL,?)',
          )
          .run(
            proposal.id,
            JSON.stringify(draft),
            proposal.expiresAt,
            requestKey ?? null,
          );
        return proposal;
      })
      .immediate();
  }
  proposals(now = new Date()): BriefingProposal[] {
    this.database
      .prepare(
        'DELETE FROM task_proposals WHERE task_id IS NULL AND expires_at<=?',
      )
      .run(now.toISOString());
    const rows = this.database
      .prepare(
        'SELECT id,draft,expires_at as expiresAt FROM task_proposals WHERE task_id IS NULL AND expires_at>? ORDER BY rowid DESC LIMIT 100',
      )
      .all(now.toISOString()) as {
      id: string;
      draft: string;
      expiresAt: string;
    }[];
    return rows.flatMap((row) => {
      try {
        const draft: unknown = JSON.parse(row.draft);
        return validBriefingDraft(draft)
          ? [
              {
                id: row.id,
                kind: 'create_briefing' as const,
                draft,
                expiresAt: row.expiresAt,
              },
            ]
          : [];
      } catch {
        return [];
      }
    });
  }
  confirmProposal(id: string, now = new Date()): BriefingTask | undefined {
    return this.database
      .transaction(() => {
        const row = this.database
          .prepare(
            'SELECT draft,expires_at as expiresAt,task_id as taskId FROM task_proposals WHERE id=?',
          )
          .get(id) as
          | { draft: string; expiresAt: string; taskId: string | null }
          | undefined;
        if (!row) return undefined;
        if (row.taskId)
          return this.list().find((item) => item.id === row.taskId);
        if (Date.parse(row.expiresAt) <= now.getTime())
          throw new AssistantError('expired');
        let draft: unknown;
        try {
          draft = JSON.parse(row.draft);
        } catch {
          throw new AssistantError('invalid_input');
        }
        if (!validBriefingDraft(draft))
          throw new AssistantError('invalid_input');
        const task = this.create(draft);
        this.database
          .prepare(
            'UPDATE task_proposals SET task_id=? WHERE id=? AND task_id IS NULL',
          )
          .run(task.id, id);
        return task;
      })
      .immediate();
  }
  enqueueManualExecution(
    taskId: string,
    occurrenceKey: string,
    scheduledFor: string,
  ): ExecutionRecord | undefined {
    const now = new Date().toISOString();
    return this.database
      .transaction(() => {
        const task = this.database
          .prepare('SELECT id,enabled FROM tasks WHERE id=?')
          .get(taskId) as { id: string; enabled: number } | undefined;
        if (!task) return undefined;
        if (!task.enabled) throw new AssistantError('conflict');
        const insert = this.database
          .prepare(
            "INSERT OR IGNORE INTO executions VALUES (?,?,?,?, 'pending',0,3,?,NULL,NULL,NULL,NULL,?,?)",
          )
          .run(
            crypto.randomUUID(),
            taskId,
            occurrenceKey,
            scheduledFor,
            now,
            now,
            now,
          );
        if (insert.changes) {
          const row = this.database
            .prepare('SELECT id FROM executions WHERE occurrence_key=?')
            .get(occurrenceKey) as { id: string };
          this.database
            .prepare('INSERT INTO execution_events VALUES (?,?,?,?,?)')
            .run(crypto.randomUUID(), row.id, 'queued', now, null);
        }
        return this.database
          .prepare(
            'SELECT id,task_id as taskId,occurrence_key as occurrenceKey,scheduled_for as scheduledFor,status,attempt,max_attempts as maxAttempts,available_at as availableAt,lease_expires_at as leaseExpiresAt,claimed_by as claimedBy,result,failure,created_at as createdAt,updated_at as updatedAt FROM executions WHERE occurrence_key=? AND task_id=?',
          )
          .get(occurrenceKey, taskId) as ExecutionRecord | undefined;
      })
      .immediate();
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
      return isBriefingResult(result)
        ? sanitizeBriefingResult(result)
        : undefined;
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
