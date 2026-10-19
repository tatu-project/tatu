import {
  AssistantError,
  hasOnlyKeys,
  hasSensitiveUrlQuery,
  redactTextSecrets,
  safeAssistantText,
  validBriefingDraft,
  validLocalId,
  type BriefingDraft,
  type TaskPatch,
  type Memory,
  type Note,
} from '@tatu/shared';
import type {
  CloudTask,
  CloudExecution,
  D1Database,
  D1PreparedStatement,
  ModelRoute,
  VerifiedIdentity,
} from './types.js';
import { MODEL_ROUTES } from './types.js';
import { nextRunAt } from './scheduler.js';
import { supportsCloudTopic } from './feed.js';
export class CloudUnsupportedTopicError extends AssistantError {
  constructor() {
    super('invalid_input');
  }
}

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  contextKey: string;
}
export interface StoredConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  messages: StoredMessage[];
}
export interface StoredProposal {
  id: string;
  kind: 'create_briefing';
  draft: BriefingDraft;
  expiresAt: string;
}
const size = (text: string) => new TextEncoder().encode(text).byteLength;
const requiredText = (value: unknown, max: number) => {
  if (!safeAssistantText(value, max)) throw new AssistantError('invalid_input');
};
const changed = (result: { meta: { changes?: number } }) =>
  Number(result.meta.changes ?? 0) > 0;
const taskColumns =
  'id,cadence,time,timezone,quantity,topic,enabled,delivery_requested as deliveryRequested,created_at as createdAt,next_run_at as nextRunAt,schedule_revision as scheduleRevision';
const noteColumns =
  'id,title,content,revision,created_at as createdAt,updated_at as updatedAt';
const memoryColumns =
  'id,content,category,created_at as createdAt,updated_at as updatedAt';
const conversationColumns =
  'id,title,revision,created_at as createdAt,updated_at as updatedAt';
const executionColumns =
  'id,task_id as taskId,scheduled_for as scheduledFor,status,attempt,max_attempts as maxAttempts,available_at as availableAt,lease_until as leaseExpiresAt,failure,created_at as createdAt,updated_at as updatedAt';
const executionView = (row: CloudExecution): CloudExecution => ({
  ...row,
  failure:
    row.failure === null
      ? null
      : [
            'research_failure',
            'model_failure',
            'delivery_failure',
            'task_paused',
            'task_changed',
            'quota_exhausted',
            'provider_unavailable',
          ].includes(row.failure)
        ? row.failure
        : 'execution_failed',
});
const taskView = (row: CloudTask): CloudTask => ({
  id: row.id,
  cadence: 'daily',
  time: row.time,
  timezone: row.timezone,
  quantity: row.quantity,
  topic: redactTextSecrets(row.topic),
  enabled: Boolean(row.enabled),
  deliveryRequested: true,
  createdAt: row.createdAt,
  nextRunAt: row.nextRunAt,
  scheduleRevision: row.scheduleRevision,
});
const noteView = (row: Note): Note => ({
  id: row.id,
  title: redactTextSecrets(row.title),
  content: redactTextSecrets(row.content),
  revision: row.revision,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});
const memoryView = (row: Memory): Memory => ({
  id: row.id,
  content: redactTextSecrets(row.content),
  category: row.category,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});
export async function ownerForIdentity(
  db: D1Database,
  identity: VerifiedIdentity,
): Promise<string> {
  if (
    typeof identity.issuer !== 'string' ||
    typeof identity.subject !== 'string' ||
    !identity.issuer ||
    !identity.subject ||
    size(identity.issuer) > 512 ||
    size(identity.subject) > 512
  )
    throw new AssistantError('unavailable');
  await db
    .prepare(
      'INSERT OR IGNORE INTO owners (id,issuer,subject,created_at) VALUES (?,?,?,?)',
    )
    .bind(
      crypto.randomUUID(),
      identity.issuer,
      identity.subject,
      new Date().toISOString(),
    )
    .run();
  const row = await db
    .prepare('SELECT id FROM owners WHERE issuer=? AND subject=?')
    .bind(identity.issuer, identity.subject)
    .first<{ id: string }>();
  if (!row || !validLocalId(row.id)) throw new AssistantError('unavailable');
  return row.id;
}
export const RETAINED_TERMINAL_EXECUTIONS = 500;
export async function pruneOwnerExecutionHistory(
  db: D1Database,
  ownerId: string,
): Promise<void> {
  if (!validLocalId(ownerId)) throw new AssistantError('unavailable');
  await db
    .prepare(
      "DELETE FROM executions WHERE owner_id=? AND status IN ('succeeded','failed','skipped') AND id IN (SELECT id FROM executions WHERE owner_id=? AND status IN ('succeeded','failed','skipped') ORDER BY created_at DESC,id DESC LIMIT -1 OFFSET 500)",
    )
    .bind(ownerId, ownerId)
    .run();
}

/** Every public method scopes by this immutable server-derived owner. */
export class WorkspaceStore {
  constructor(
    private readonly db: D1Database,
    readonly ownerId: string,
  ) {
    if (!validLocalId(ownerId)) throw new AssistantError('unavailable');
  }
  private sql(sql: string, ...values: unknown[]): D1PreparedStatement {
    return this.db.prepare(sql).bind(...values);
  }
  async pruneExecutionHistory(): Promise<void> {
    await pruneOwnerExecutionHistory(this.db, this.ownerId);
  }
  async consumeApiBudget(
    mutation: boolean,
    now = Date.now(),
  ): Promise<boolean> {
    const minute = Math.floor(now / 60_000),
      cap = mutation ? 60 : 240,
      lane = mutation ? 'mutation' : 'read';
    const result = await this.sql(
      'INSERT INTO api_usage (owner_id,lane,window_minute,requests) VALUES (?,?,?,1) ON CONFLICT(owner_id,lane) DO UPDATE SET window_minute=excluded.window_minute,requests=CASE WHEN api_usage.window_minute=excluded.window_minute THEN api_usage.requests+1 ELSE 1 END WHERE api_usage.window_minute<>excluded.window_minute OR api_usage.requests<?',
      this.ownerId,
      lane,
      minute,
      cap,
    ).run();
    return changed(result);
  }
  async listConversations() {
    const rows = await this.sql(
      `SELECT ${conversationColumns} FROM conversations WHERE owner_id=? ORDER BY updated_at DESC,id LIMIT 200`,
      this.ownerId,
    ).all<StoredConversation>();
    return rows.results.map((row) => ({
      id: row.id,
      title: redactTextSecrets(row.title),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }
  async conversation(id: string): Promise<StoredConversation | undefined> {
    const row = await this.sql(
      `SELECT ${conversationColumns} FROM conversations WHERE owner_id=? AND id=?`,
      this.ownerId,
      id,
    ).first<Omit<StoredConversation, 'messages'>>();
    if (!row) return undefined;
    const messages = await this.sql(
      "SELECT id,role,content,context_key as contextKey,created_at as createdAt FROM messages WHERE owner_id=? AND conversation_id=? ORDER BY turn_revision,CASE role WHEN 'user' THEN 0 ELSE 1 END LIMIT 200",
      this.ownerId,
      id,
    ).all<StoredMessage>();
    return {
      ...row,
      title: redactTextSecrets(row.title),
      messages: messages.results
        .filter((message) => ['user', 'assistant'].includes(message.role))
        .map((message) => ({
          ...message,
          content: redactTextSecrets(message.content),
        })),
    };
  }
  async createConversation(title: string): Promise<StoredConversation> {
    requiredText(title, 512);
    const id = crypto.randomUUID(),
      now = new Date().toISOString();
    const result = await this.sql(
      'INSERT INTO conversations (owner_id,id,title,revision,created_at,updated_at) SELECT ?,?,?,0,?,? WHERE (SELECT COUNT(*) FROM conversations WHERE owner_id=?)<200',
      this.ownerId,
      id,
      title,
      now,
      now,
      this.ownerId,
    ).run();
    if (!changed(result)) throw new AssistantError('conflict');
    return {
      id,
      title,
      revision: 0,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
  }
  async claimTurn(id: string, revision: number): Promise<string> {
    const token = crypto.randomUUID(),
      now = new Date().toISOString();
    const result = await this.sql(
      'UPDATE conversations SET turn_token=?,turn_expires_at=? WHERE owner_id=? AND id=? AND revision=? AND (turn_token IS NULL OR turn_expires_at<=?) AND (SELECT COUNT(*) FROM messages WHERE owner_id=? AND conversation_id=?)<200',
      token,
      new Date(Date.now() + 180_000).toISOString(),
      this.ownerId,
      id,
      revision,
      now,
      this.ownerId,
      id,
    ).run();
    if (!changed(result))
      throw new AssistantError(
        (await this.conversation(id)) ? 'conflict' : 'not_found',
      );
    return token;
  }
  async releaseTurn(id: string, token: string) {
    await this.sql(
      'UPDATE conversations SET turn_token=NULL,turn_expires_at=NULL WHERE owner_id=? AND id=? AND turn_token=?',
      this.ownerId,
      id,
      token,
    ).run();
  }
  async appendTurn(
    id: string,
    revision: number,
    token: string,
    user: string,
    reply: string,
    contextKey: string,
  ) {
    requiredText(user, 16_384);
    requiredText(reply, 16_384);
    if (!/^(?:[a-f0-9]{64})?$/u.test(contextKey))
      throw new AssistantError('invalid_input');
    const now = new Date().toISOString();
    const results = await this.db.batch([
      this.sql(
        'UPDATE conversations SET revision=revision+1,updated_at=? WHERE owner_id=? AND id=? AND revision=? AND turn_token=?',
        now,
        this.ownerId,
        id,
        revision,
        token,
      ),
      ...(['user', 'assistant'] as const).map((role) =>
        this.sql(
          'INSERT INTO messages (owner_id,id,conversation_id,role,content,context_key,turn_revision,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM conversations WHERE owner_id=? AND id=? AND revision=? AND turn_token=?)',
          this.ownerId,
          crypto.randomUUID(),
          id,
          role,
          role === 'user' ? user : reply,
          contextKey,
          revision + 1,
          now,
          this.ownerId,
          id,
          revision + 1,
          token,
        ),
      ),
      this.sql(
        'UPDATE conversations SET turn_token=NULL,turn_expires_at=NULL WHERE owner_id=? AND id=? AND turn_token=?',
        this.ownerId,
        id,
        token,
      ),
    ]);
    if (!changed(results[0]))
      throw new AssistantError(
        (await this.conversation(id)) ? 'conflict' : 'not_found',
      );
  }
  async deleteConversation(id: string) {
    return changed(
      await this.sql(
        'DELETE FROM conversations WHERE owner_id=? AND id=?',
        this.ownerId,
        id,
      ).run(),
    );
  }
  async modelRoute(): Promise<ModelRoute> {
    let row: { model_route: string } | null;
    try {
      row = await this.sql(
        'SELECT model_route FROM owner_preferences WHERE owner_id=?',
        this.ownerId,
      ).first<{ model_route: string }>();
    } catch (error) {
      // Code deployed before migration 0004 keeps the default route working.
      if (error instanceof Error && /no such table/iu.test(error.message))
        return 'auto';
      throw error;
    }
    return MODEL_ROUTES.includes(row?.model_route as ModelRoute)
      ? (row!.model_route as ModelRoute)
      : 'auto';
  }
  async setModelRoute(route: ModelRoute) {
    if (!MODEL_ROUTES.includes(route))
      throw new AssistantError('invalid_input');
    await this.sql(
      'INSERT INTO owner_preferences (owner_id,model_route,updated_at) VALUES (?,?,?) ON CONFLICT(owner_id) DO UPDATE SET model_route=excluded.model_route,updated_at=excluded.updated_at',
      this.ownerId,
      route,
      new Date().toISOString(),
    ).run();
  }
  /** The mapped id may be stale after a web deletion; callers re-read it. */
  async telegramConversation(): Promise<string | null> {
    const row = await this.sql(
      'SELECT conversation_id FROM telegram_chats WHERE owner_id=?',
      this.ownerId,
    ).first<{ conversation_id: string | null }>();
    return row?.conversation_id && validLocalId(row.conversation_id)
      ? row.conversation_id
      : null;
  }
  async setTelegramConversation(id: string | null) {
    if (id !== null && !validLocalId(id))
      throw new AssistantError('invalid_input');
    await this.sql(
      'INSERT INTO telegram_chats (owner_id,conversation_id,updated_at) VALUES (?,?,?) ON CONFLICT(owner_id) DO UPDATE SET conversation_id=excluded.conversation_id,updated_at=excluded.updated_at',
      this.ownerId,
      id,
      new Date().toISOString(),
    ).run();
  }
  /** Maps a new conversation only if no other turn mapped one first; returns the winner. */
  async adoptTelegramConversation(
    id: string,
    expected: string | null,
  ): Promise<string | null> {
    if (!validLocalId(id) || (expected !== null && !validLocalId(expected)))
      throw new AssistantError('invalid_input');
    await this.sql(
      'INSERT INTO telegram_chats (owner_id,conversation_id,updated_at) VALUES (?,?,?) ON CONFLICT(owner_id) DO UPDATE SET conversation_id=excluded.conversation_id,updated_at=excluded.updated_at WHERE telegram_chats.conversation_id IS NULL OR telegram_chats.conversation_id=?',
      this.ownerId,
      id,
      new Date().toISOString(),
      expected,
    ).run();
    return this.telegramConversation();
  }
  /** Frees one slot under the per-owner cap, never touching the kept id. */
  async deleteOldestConversation(keep: string | null): Promise<boolean> {
    return changed(
      await this.sql(
        'DELETE FROM conversations WHERE owner_id=? AND id=(SELECT id FROM conversations WHERE owner_id=? AND id<>? ORDER BY updated_at,id LIMIT 1)',
        this.ownerId,
        this.ownerId,
        keep ?? '',
      ).run(),
    );
  }
  async memories() {
    return (
      await this.sql(
        `SELECT ${memoryColumns} FROM memories WHERE owner_id=? ORDER BY created_at,id LIMIT 500`,
        this.ownerId,
      ).all<Memory>()
    ).results.map(memoryView);
  }
  async createMemory(content: string, category: Memory['category']) {
    requiredText(content, 4096);
    if (!['preference', 'instruction'].includes(category))
      throw new AssistantError('invalid_input');
    const id = crypto.randomUUID(),
      now = new Date().toISOString();
    const result = await this.sql(
      'INSERT INTO memories (owner_id,id,content,category,created_at,updated_at) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM memories WHERE owner_id=?)<500',
      this.ownerId,
      id,
      content,
      category,
      now,
      now,
      this.ownerId,
    ).run();
    if (!changed(result)) throw new AssistantError('conflict');
    return { id, content, category, createdAt: now, updatedAt: now };
  }
  async updateMemory(
    id: string,
    content: string,
    category: Memory['category'],
  ) {
    requiredText(content, 4096);
    if (!['preference', 'instruction'].includes(category))
      throw new AssistantError('invalid_input');
    if (
      !changed(
        await this.sql(
          'UPDATE memories SET content=?,category=?,updated_at=? WHERE owner_id=? AND id=?',
          content,
          category,
          new Date().toISOString(),
          this.ownerId,
          id,
        ).run(),
      )
    )
      return undefined;
    const row = await this.sql(
      `SELECT ${memoryColumns} FROM memories WHERE owner_id=? AND id=?`,
      this.ownerId,
      id,
    ).first<Memory>();
    return row ? memoryView(row) : undefined;
  }
  async deleteMemory(id: string) {
    return changed(
      await this.sql(
        'DELETE FROM memories WHERE owner_id=? AND id=?',
        this.ownerId,
        id,
      ).run(),
    );
  }
  async notes(query = '') {
    if (query !== '' && !safeAssistantText(query, 256))
      throw new AssistantError('invalid_input');
    return (
      await this.sql(
        `SELECT ${noteColumns} FROM notes WHERE owner_id=? AND (instr(lower(title),lower(?))>0 OR instr(lower(content),lower(?))>0) ORDER BY updated_at DESC,id LIMIT 100`,
        this.ownerId,
        query,
        query,
      ).all<Note>()
    ).results.map(noteView);
  }
  async note(id: string) {
    const row = await this.sql(
      `SELECT ${noteColumns} FROM notes WHERE owner_id=? AND id=?`,
      this.ownerId,
      id,
    ).first<Note>();
    return row ? noteView(row) : undefined;
  }
  async createNote(title: string, content: string) {
    requiredText(title, 512);
    requiredText(content, 16_384);
    const id = crypto.randomUUID(),
      now = new Date().toISOString();
    const result = await this.sql(
      'INSERT INTO notes (owner_id,id,title,content,revision,created_at,updated_at) SELECT ?,?,?,?,1,?,? WHERE (SELECT COUNT(*) FROM notes WHERE owner_id=?)<1000',
      this.ownerId,
      id,
      title,
      content,
      now,
      now,
      this.ownerId,
    ).run();
    if (!changed(result)) throw new AssistantError('conflict');
    return { id, title, content, revision: 1, createdAt: now, updatedAt: now };
  }
  async updateNote(
    id: string,
    title: string,
    content: string,
    revision: number,
  ) {
    requiredText(title, 512);
    requiredText(content, 16_384);
    if (!Number.isInteger(revision) || revision < 1)
      throw new AssistantError('invalid_input');
    const result = await this.sql(
      'UPDATE notes SET title=?,content=?,revision=revision+1,updated_at=? WHERE owner_id=? AND id=? AND revision=?',
      title,
      content,
      new Date().toISOString(),
      this.ownerId,
      id,
      revision,
    ).run();
    if (!changed(result)) {
      if (await this.note(id)) throw new AssistantError('conflict');
      return undefined;
    }
    return this.note(id);
  }
  async deleteNote(id: string) {
    return changed(
      await this.sql(
        'DELETE FROM notes WHERE owner_id=? AND id=?',
        this.ownerId,
        id,
      ).run(),
    );
  }
  async listTasks() {
    return (
      await this.sql(
        `SELECT ${taskColumns} FROM tasks WHERE owner_id=? ORDER BY created_at,id LIMIT 200`,
        this.ownerId,
      ).all<CloudTask>()
    ).results.map(taskView);
  }
  async task(id: string) {
    const row = await this.sql(
      `SELECT ${taskColumns} FROM tasks WHERE owner_id=? AND id=?`,
      this.ownerId,
      id,
    ).first<CloudTask>();
    return row ? taskView(row) : undefined;
  }
  async proposals(): Promise<StoredProposal[]> {
    const now = new Date().toISOString();
    await this.sql(
      'DELETE FROM proposals WHERE owner_id=? AND confirmed_task_id IS NULL AND expires_at<=?',
      this.ownerId,
      now,
    ).run();
    const rows = await this.sql(
      'SELECT id,draft_json as draftJson,expires_at as expiresAt FROM proposals WHERE owner_id=? AND confirmed_task_id IS NULL AND expires_at>? ORDER BY created_at DESC,id LIMIT 100',
      this.ownerId,
      now,
    ).all<{ id: string; draftJson: string; expiresAt: string }>();
    return rows.results.flatMap((row) => {
      try {
        const draft: unknown = JSON.parse(row.draftJson);
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
  async propose(
    draft: BriefingDraft,
    requestKey?: string,
    now = new Date(),
  ): Promise<StoredProposal> {
    if (
      !validBriefingDraft(draft) ||
      (requestKey !== undefined &&
        (!safeAssistantText(requestKey, 128) ||
          !/^[A-Za-z0-9:_-]+$/u.test(requestKey)))
    )
      throw new AssistantError('invalid_input');
    if (!supportsCloudTopic(draft.topic))
      throw new CloudUnsupportedTopicError();
    const draftJson = JSON.stringify({
      cadence: 'daily',
      time: draft.time,
      timezone: draft.timezone,
      quantity: draft.quantity,
      topic: draft.topic,
      deliveryRequested: true,
    });
    if (requestKey) {
      const previous = await this.sql(
        'SELECT id,draft_json as draftJson,expires_at as expiresAt,confirmed_task_id as taskId FROM proposals WHERE owner_id=? AND request_key=?',
        this.ownerId,
        requestKey,
      ).first<{
        id: string;
        draftJson: string;
        expiresAt: string;
        taskId: string | null;
      }>();
      if (previous) {
        if (previous.draftJson !== draftJson)
          throw new AssistantError('conflict');
        if (!previous.taskId && Date.parse(previous.expiresAt) <= now.getTime())
          throw new AssistantError('expired');
        return {
          id: previous.id,
          kind: 'create_briefing',
          draft,
          expiresAt: previous.expiresAt,
        };
      }
    }
    const id = crypto.randomUUID(),
      expiresAt = new Date(now.getTime() + 900_000).toISOString();
    const result = await this.sql(
      'INSERT OR IGNORE INTO proposals (owner_id,id,draft_json,expires_at,request_key,created_at) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM proposals WHERE owner_id=? AND confirmed_task_id IS NULL AND expires_at>?)<100',
      this.ownerId,
      id,
      draftJson,
      expiresAt,
      requestKey ?? null,
      now.toISOString(),
      this.ownerId,
      now.toISOString(),
    ).run();
    if (!changed(result)) {
      if (requestKey) {
        const row = await this.sql(
          'SELECT id,draft_json as draftJson,expires_at as expiresAt FROM proposals WHERE owner_id=? AND request_key=?',
          this.ownerId,
          requestKey,
        ).first<{ id: string; draftJson: string; expiresAt: string }>();
        if (row && row.draftJson === draftJson)
          return {
            id: row.id,
            kind: 'create_briefing',
            draft,
            expiresAt: row.expiresAt,
          };
      }
      throw new AssistantError('conflict');
    }
    return { id, kind: 'create_briefing', draft, expiresAt };
  }
  async confirmProposal(
    id: string,
    now = new Date(),
  ): Promise<CloudTask | undefined> {
    const row = await this.sql(
      'SELECT draft_json as draftJson,expires_at as expiresAt,confirmed_task_id as taskId FROM proposals WHERE owner_id=? AND id=?',
      this.ownerId,
      id,
    ).first<{ draftJson: string; expiresAt: string; taskId: string | null }>();
    if (!row) return undefined;
    if (row.taskId) return this.task(row.taskId);
    if (Date.parse(row.expiresAt) <= now.getTime())
      throw new AssistantError('expired');
    let draft: unknown;
    try {
      draft = JSON.parse(row.draftJson);
    } catch {
      throw new AssistantError('invalid_input');
    }
    if (!validBriefingDraft(draft)) throw new AssistantError('invalid_input');
    if (!supportsCloudTopic(draft.topic))
      throw new CloudUnsupportedTopicError();
    const next = nextRunAt(draft.time, draft.timezone, now),
      stamp = now.toISOString();
    await this.db.batch([
      this.sql(
        "INSERT OR IGNORE INTO tasks (owner_id,id,cadence,time,timezone,quantity,topic,enabled,delivery_requested,schedule_revision,next_run_at,created_at,updated_at) SELECT ?,?,'daily',?,?,?,?,1,1,1,?,?,? FROM proposals WHERE owner_id=? AND id=? AND confirmed_task_id IS NULL AND expires_at>? AND (SELECT COUNT(*) FROM tasks WHERE owner_id=?)<200",
        this.ownerId,
        id,
        draft.time,
        draft.timezone,
        draft.quantity,
        draft.topic,
        next,
        stamp,
        stamp,
        this.ownerId,
        id,
        stamp,
        this.ownerId,
      ),
      this.sql(
        'UPDATE proposals SET confirmed_task_id=? WHERE owner_id=? AND id=? AND confirmed_task_id IS NULL AND expires_at>? AND EXISTS (SELECT 1 FROM tasks WHERE owner_id=? AND id=?)',
        id,
        this.ownerId,
        id,
        stamp,
        this.ownerId,
        id,
      ),
    ]);
    const task = await this.task(id);
    if (!task) throw new AssistantError('conflict');
    return task;
  }
  async updateTask(
    id: string,
    patch: TaskPatch,
  ): Promise<CloudTask | undefined> {
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
    const task = await this.task(id);
    if (!task) return undefined;
    const next = { ...task, ...patch };
    const draft = {
      cadence: 'daily' as const,
      time: next.time,
      timezone: next.timezone,
      topic: next.topic,
      quantity: next.quantity,
      deliveryRequested: true as const,
    };
    if (!validBriefingDraft(draft)) throw new AssistantError('invalid_input');
    if (!supportsCloudTopic(draft.topic))
      throw new CloudUnsupportedTopicError();
    const token = crypto.randomUUID(),
      now = new Date().toISOString(),
      revision = task.scheduleRevision + 1,
      reason = next.enabled ? 'task_changed' : 'task_paused';
    const results = await this.db.batch([
      this.sql(
        'UPDATE tasks SET time=?,timezone=?,quantity=?,topic=?,enabled=?,schedule_revision=?,next_run_at=?,mutation_token=?,updated_at=? WHERE owner_id=? AND id=? AND schedule_revision=?',
        next.time,
        next.timezone,
        next.quantity,
        next.topic,
        next.enabled ? 1 : 0,
        revision,
        next.enabled
          ? nextRunAt(next.time, next.timezone, new Date(now))
          : null,
        token,
        now,
        this.ownerId,
        id,
        task.scheduleRevision,
      ),
      this.sql(
        "INSERT INTO execution_events (owner_id,id,execution_id,type,at,detail) SELECT owner_id,lower(hex(randomblob(16))),id,?,?,? FROM executions WHERE owner_id=? AND task_id=? AND status='pending' AND EXISTS (SELECT 1 FROM tasks WHERE owner_id=? AND id=? AND mutation_token=?)",
        `skipped_${reason}`,
        now,
        reason,
        this.ownerId,
        id,
        this.ownerId,
        id,
        token,
      ),
      this.sql(
        "UPDATE executions SET status='skipped',failure=?,updated_at=? WHERE owner_id=? AND task_id=? AND status='pending' AND EXISTS (SELECT 1 FROM tasks WHERE owner_id=? AND id=? AND mutation_token=?)",
        reason,
        now,
        this.ownerId,
        id,
        this.ownerId,
        id,
        token,
      ),
    ]);
    if (!changed(results[0])) throw new AssistantError('conflict');
    return this.task(id);
  }
  async queueManual(
    id: string,
    key: string,
  ): Promise<CloudExecution | undefined> {
    if (!safeAssistantText(key, 128) || !/^[A-Za-z0-9:_-]+$/u.test(key))
      throw new AssistantError('invalid_input');
    const task = await this.task(id);
    if (!task) return undefined;
    if (!task.enabled) throw new AssistantError('conflict');
    const hash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)),
      ),
      (byte) => byte.toString(16).padStart(2, '0'),
    ).join('');
    const occurrence = `manual:${id}:${hash}`,
      executionId = crypto.randomUUID(),
      now = new Date().toISOString();
    const snapshot = JSON.stringify({
      topic: task.topic,
      quantity: task.quantity,
      time: task.time,
      timezone: task.timezone,
    });
    await this.db.batch([
      this.sql(
        "INSERT OR IGNORE INTO executions (owner_id,id,task_id,occurrence_key,scheduled_for,status,attempt,max_attempts,available_at,schedule_revision,snapshot_json,created_at,updated_at) SELECT ?,?,?,?,?,'pending',0,3,?,?,?,?,? FROM tasks WHERE owner_id=? AND id=? AND enabled=1 AND schedule_revision=?",
        this.ownerId,
        executionId,
        id,
        occurrence,
        now,
        now,
        task.scheduleRevision,
        snapshot,
        now,
        now,
        this.ownerId,
        id,
        task.scheduleRevision,
      ),
      this.sql(
        "INSERT INTO execution_events (owner_id,id,execution_id,type,at,detail) SELECT owner_id,?,id,'queued',?,NULL FROM executions WHERE owner_id=? AND id=?",
        crypto.randomUUID(),
        now,
        this.ownerId,
        executionId,
      ),
    ]);
    const row = await this.sql(
      'SELECT id FROM executions WHERE owner_id=? AND task_id=? AND occurrence_key=?',
      this.ownerId,
      id,
      occurrence,
    ).first<{ id: string }>();
    if (!row) throw new AssistantError('conflict');
    await this.pruneExecutionHistory();
    return this.execution(row.id);
  }
  async listExecutions() {
    const rows = await this.sql(
      `SELECT ${executionColumns} FROM executions WHERE owner_id=? ORDER BY created_at DESC,id LIMIT 200`,
      this.ownerId,
    ).all<CloudExecution>();
    return rows.results.map(executionView);
  }
  async execution(id: string): Promise<CloudExecution | undefined> {
    const row = await this.sql(
      `SELECT ${executionColumns} FROM executions WHERE owner_id=? AND id=?`,
      this.ownerId,
      id,
    ).first<CloudExecution>();
    return row ? executionView(row) : undefined;
  }
  async events(id: string) {
    if (!(await this.execution(id))) return undefined;
    const result = await this.sql(
      'SELECT type,at FROM execution_events WHERE owner_id=? AND execution_id=? ORDER BY at,rowid LIMIT 100',
      this.ownerId,
      id,
    ).all<{ type: string; at: string }>();
    return result.results.map((row) => ({
      type: redactTextSecrets(row.type),
      at: row.at,
      detail: null,
    }));
  }
  async briefing(id: string): Promise<Record<string, unknown> | undefined> {
    const row = await this.sql(
      "SELECT result_json as result FROM executions WHERE owner_id=? AND id=? AND status='succeeded'",
      this.ownerId,
      id,
    ).first<{ result: string | null }>();
    if (!row?.result || size(row.result) > 131_072) return undefined;
    try {
      const result: unknown = JSON.parse(row.result);
      if (!result || typeof result !== 'object') return undefined;
      const data = result as Record<string, unknown>;
      const stories = (input: unknown) => {
        if (!Array.isArray(input) || input.length > 10)
          throw new Error('invalid');
        return input.map((story) => {
          if (
            !hasOnlyKeys(story, ['title', 'url', 'publishedAt', 'source']) ||
            !safeAssistantText(story.title, 2048) ||
            !safeAssistantText(story.source, 512) ||
            !safeAssistantText(story.url, 4096) ||
            typeof story.publishedAt !== 'string' ||
            !Number.isFinite(Date.parse(story.publishedAt))
          )
            throw new Error('invalid');
          const url = new URL(story.url);
          if (
            url.protocol !== 'https:' ||
            url.username ||
            url.password ||
            hasSensitiveUrlQuery(url)
          )
            throw new Error('invalid');
          return {
            title: story.title,
            url: story.url,
            publishedAt: story.publishedAt,
            source: story.source,
          };
        });
      };
      if (
        !safeAssistantText(data.topic, 512) ||
        !Array.isArray(data.inference) ||
        data.inference.length > 10 ||
        data.inference.some((item) => !safeAssistantText(item, 4096))
      )
        return undefined;
      const output: Record<string, unknown> = {
        topic: data.topic,
        stories: stories(data.stories),
        facts: stories(data.facts),
        inference: data.inference,
      };
      if (
        ['deterministic-rss', 'workers-ai', 'groq'].includes(String(data.route))
      )
        output.route = data.route;
      if (
        data.delivery &&
        typeof data.delivery === 'object' &&
        (data.delivery as { channel?: unknown }).channel === 'in-app'
      )
        output.delivery = { channel: 'in-app' };
      if (data.observability && typeof data.observability === 'object') {
        const observation = data.observability as Record<string, unknown>;
        if (
          ['public-rss', 'workers-ai', 'groq'].includes(
            String(observation.provider),
          ) &&
          (observation.model === null ||
            safeAssistantText(observation.model, 128)) &&
          Array.isArray(observation.tools) &&
          observation.tools.length <= 4 &&
          observation.tools.every((tool) =>
            ['public-rss', 'in-app', 'workers-ai', 'groq'].includes(
              String(tool),
            ),
          ) &&
          Number.isInteger(observation.latencyMs) &&
          Number(observation.latencyMs) >= 0 &&
          Number(observation.latencyMs) <= 86_400_000
        )
          output.observability = {
            provider: observation.provider,
            model: observation.model,
            tools: observation.tools,
            latencyMs: observation.latencyMs,
            estimatedCost: { status: 'unknown' },
          };
      }
      return output;
    } catch {
      return undefined;
    }
  }
}
