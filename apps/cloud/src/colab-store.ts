import { AssistantError, safeAssistantText, validLocalId } from '@tatu/shared';
import {
  credential,
  hash,
  COLAB_MODEL,
  COLAB_REVISION,
  COLAB_INPUT_TOKENS,
  COLAB_OUTPUT_TOKENS,
} from './colab-crypto.js';
import type { D1Database } from './types.js';

type Session = {
  owner_id: string;
  id: string;
  state: string;
  mode: 'manual' | 'active';
  expires_at: string;
  pair_expires_at: string;
  last_seen_at: string | null;
};
type Job = {
  id: string;
  conversation_id: string;
  session_id: string;
  revision: number;
  turn_token: string;
  context_key: string;
  status: string;
  payload_json: string | null;
  user_text: string | null;
  reply: string | null;
  expires_at: string;
  lease_until: string | null;
  lease_hash: string | null;
};
const changed = (result: { meta: { changes?: number } }) =>
  Number(result.meta.changes ?? 0) > 0;
const validCredential = (value: unknown): value is string =>
  typeof value === 'string' && /^colab_[a-f0-9]{64}$/u.test(value);
const unauthorized = () => new AssistantError('not_found');
class ColabQuotaError extends Error {
  readonly code = 'quota_exhausted';
  readonly status = 429;
  constructor(readonly retryAfter: number) {
    super('quota_exhausted');
  }
}
export class ColabStore {
  constructor(
    readonly db: D1Database,
    readonly ownerId: string,
    readonly clock: () => number = Date.now,
  ) {}
  private sql(sql: string, ...values: unknown[]) {
    return this.db.prepare(sql).bind(...values);
  }
  private now() {
    return new Date(this.clock()).toISOString();
  }
  private async session() {
    return this.sql(
      'SELECT owner_id,id,state,mode,expires_at,pair_expires_at,last_seen_at FROM colab_sessions WHERE owner_id=?',
      this.ownerId,
    ).first<Session>();
  }
  async prune() {
    const now = this.now();
    await this.db.batch([
      this.sql(
        "UPDATE colab_jobs SET status='expired',payload_json=NULL,user_text=NULL,reply=NULL,updated_at=? WHERE owner_id=? AND status IN ('queued','running') AND (expires_at<=? OR (status='running' AND lease_until<=?) OR NOT EXISTS(SELECT 1 FROM colab_sessions s WHERE s.owner_id=colab_jobs.owner_id AND s.id=colab_jobs.session_id AND s.state='paired' AND s.expires_at>?))",
        now,
        this.ownerId,
        now,
        now,
        now,
      ),
      this.sql(
        "UPDATE conversations SET turn_token=NULL,turn_expires_at=NULL WHERE owner_id=? AND EXISTS(SELECT 1 FROM colab_jobs j WHERE j.owner_id=conversations.owner_id AND j.conversation_id=conversations.id AND j.turn_token=conversations.turn_token AND j.status IN ('expired','cancelled','failed'))",
        this.ownerId,
      ),
      this.sql(
        'UPDATE colab_jobs SET payload_json=NULL,user_text=NULL,reply=NULL WHERE owner_id=? AND expires_at<=?',
        this.ownerId,
        now,
      ),
      this.sql(
        "DELETE FROM colab_jobs WHERE owner_id=? AND status NOT IN ('queued','running') AND id IN (SELECT id FROM colab_jobs WHERE owner_id=? AND status NOT IN ('queued','running') ORDER BY created_at DESC,id DESC LIMIT -1 OFFSET 100)",
        this.ownerId,
        this.ownerId,
      ),
      this.sql(
        'UPDATE colab_sessions SET pair_hash=NULL,session_hash=NULL WHERE owner_id=? AND expires_at<=?',
        this.ownerId,
        now,
      ),
    ]);
  }
  async status(configured: boolean) {
    if (!configured)
      return {
        configured: false,
        connected: false,
        mode: null,
        expiresAt: null,
        reason: 'unconfigured',
        model: COLAB_MODEL,
      };
    await this.prune();
    const session = await this.session();
    const reason = !session
      ? 'disconnected'
      : session.state === 'revoked'
        ? 'revoked'
        : session.expires_at <= this.now() ||
            (session.state === 'pending' &&
              session.pair_expires_at <= this.now())
          ? 'expired'
          : session.state === 'pending'
            ? 'pending_pair'
            : 'paired';
    return {
      configured: true,
      connected: reason === 'paired',
      mode: session?.mode ?? null,
      expiresAt: session?.expires_at ?? null,
      reason,
      model: COLAB_MODEL,
      revision: COLAB_REVISION,
      lastSeenAt: session?.last_seen_at ?? null,
      available: false,
    };
  }
  async reservePair(mode: 'manual' | 'active', pairToken: string) {
    await this.prune();
    const hour = Math.floor(this.clock() / 3_600_000);
    const usage = await this.sql(
      "INSERT INTO colab_usage(owner_id,lane,window_hour,count) VALUES (?,'connect',?,1) ON CONFLICT(owner_id,lane) DO UPDATE SET window_hour=excluded.window_hour,count=CASE WHEN colab_usage.window_hour=excluded.window_hour THEN colab_usage.count+1 ELSE 1 END WHERE colab_usage.window_hour<>excluded.window_hour OR colab_usage.count<5",
      this.ownerId,
      hour,
    ).run();
    if (!changed(usage)) throw new ColabQuotaError(3600);
    await this.revoke();
    const id = crypto.randomUUID(),
      now = this.now(),
      pairExpiresAt = new Date(this.clock() + 120_000).toISOString(),
      expiresAt = new Date(this.clock() + 1_200_000).toISOString();
    await this.sql(
      "INSERT INTO colab_sessions(owner_id,id,pair_hash,pair_expires_at,state,mode,expires_at,created_at) VALUES (?,?,?,?,'pending',?,?,?) ON CONFLICT(owner_id) DO UPDATE SET id=excluded.id,pair_hash=excluded.pair_hash,pair_expires_at=excluded.pair_expires_at,session_hash=NULL,state='pending',mode=excluded.mode,expires_at=excluded.expires_at,last_seen_at=NULL,poll_window=0,poll_count=0,created_at=excluded.created_at",
      this.ownerId,
      id,
      await hash(pairToken),
      pairExpiresAt,
      mode,
      expiresAt,
      now,
    ).run();
    return { pairExpiresAt, expiresAt, mode };
  }
  async revoke() {
    await this.db.batch([
      this.sql(
        "UPDATE colab_sessions SET state='revoked',pair_hash=NULL,session_hash=NULL WHERE owner_id=?",
        this.ownerId,
      ),
      this.sql(
        "UPDATE colab_jobs SET status='cancelled',payload_json=NULL,user_text=NULL,reply=NULL,updated_at=? WHERE owner_id=? AND status IN ('queued','running')",
        this.now(),
        this.ownerId,
      ),
      this.sql(
        "UPDATE conversations SET turn_token=NULL,turn_expires_at=NULL WHERE owner_id=? AND EXISTS(SELECT 1 FROM colab_jobs j WHERE j.owner_id=conversations.owner_id AND j.conversation_id=conversations.id AND j.turn_token=conversations.turn_token AND j.status='cancelled')",
        this.ownerId,
      ),
    ]);
  }
  static async pair(
    db: D1Database,
    pairToken: unknown,
    clock: () => number = Date.now,
  ) {
    if (!validCredential(pairToken)) throw unauthorized();
    const now = new Date(clock()).toISOString(),
      pairHash = await hash(pairToken),
      sessionToken = credential();
    const result = await db
      .prepare(
        "UPDATE colab_sessions SET state='paired',pair_hash=NULL,session_hash=?,last_seen_at=? WHERE pair_hash=? AND state='pending' AND pair_expires_at>? AND expires_at>?",
      )
      .bind(await hash(sessionToken), now, pairHash, now, now)
      .run();
    if (!changed(result)) throw unauthorized();
    const session = await db
      .prepare(
        'SELECT owner_id,id,state,mode,expires_at,pair_expires_at,last_seen_at FROM colab_sessions WHERE session_hash=?',
      )
      .bind(await hash(sessionToken))
      .first<Session>();
    if (!session) throw unauthorized();
    return {
      sessionToken,
      expiresAt: session.expires_at,
      mode: session.mode,
      model: COLAB_MODEL,
      revision: COLAB_REVISION,
      maxInputTokens: COLAB_INPUT_TOKENS,
      maxOutputTokens: COLAB_OUTPUT_TOKENS,
    };
  }
  static async authenticate(
    db: D1Database,
    bearer: string | null,
    clock: () => number = Date.now,
  ) {
    const token = bearer?.startsWith('Bearer ') ? bearer.slice(7) : null;
    if (!validCredential(token)) throw unauthorized();
    const row = await db
      .prepare(
        "SELECT owner_id,id,state,mode,expires_at,pair_expires_at,last_seen_at FROM colab_sessions WHERE session_hash=? AND state='paired' AND expires_at>?",
      )
      .bind(await hash(token), new Date(clock()).toISOString())
      .first<Session>();
    if (!row || !validLocalId(row.owner_id)) throw unauthorized();
    return { store: new ColabStore(db, row.owner_id, clock), session: row };
  }
  async ready() {
    await this.prune();
    const session = await this.session();
    if (
      !session ||
      session.state !== 'paired' ||
      session.expires_at <= this.now()
    )
      throw new AssistantError('unavailable');
    const active = await this.sql(
      "SELECT id FROM colab_jobs WHERE owner_id=? AND session_id=? AND status IN ('queued','running')",
      this.ownerId,
      session.id,
    ).first();
    if (active) throw new AssistantError('conflict');
    const usage = await this.sql(
      "SELECT count FROM colab_usage WHERE owner_id=? AND lane='job' AND window_hour=?",
      this.ownerId,
      Math.floor(this.clock() / 3_600_000),
    ).first<{ count: number }>();
    if (usage && usage.count >= 20) throw new ColabQuotaError(3600);
    return session;
  }
  async enqueue(
    sessionId: string,
    conversation: { id: string; revision: number },
    turnToken: string,
    message: string,
    contextKey: string,
    messages: readonly { role: string; content: string }[],
  ) {
    const id = crypto.randomUUID(),
      now = this.now(),
      expiresAt = new Date(this.clock() + 120_000).toISOString(),
      hour = Math.floor(this.clock() / 3_600_000);
    const results = await this.db.batch([
      this.sql(
        "INSERT INTO colab_jobs(owner_id,id,session_id,conversation_id,revision,turn_token,context_key,status,payload_json,user_text,expires_at,created_at,updated_at) SELECT ?,?,?,?,?,?,?,'queued',?,?,?,?,? WHERE EXISTS(SELECT 1 FROM colab_sessions WHERE owner_id=? AND id=? AND state='paired' AND expires_at>?) AND EXISTS(SELECT 1 FROM conversations WHERE owner_id=? AND id=? AND revision=? AND turn_token=?) AND NOT EXISTS(SELECT 1 FROM colab_jobs WHERE owner_id=? AND session_id=? AND status IN ('queued','running')) AND COALESCE((SELECT count FROM colab_usage WHERE owner_id=? AND lane='job' AND window_hour=?),0)<20",
        this.ownerId,
        id,
        sessionId,
        conversation.id,
        conversation.revision,
        turnToken,
        contextKey,
        JSON.stringify(messages),
        message,
        expiresAt,
        now,
        now,
        this.ownerId,
        sessionId,
        now,
        this.ownerId,
        conversation.id,
        conversation.revision,
        turnToken,
        this.ownerId,
        sessionId,
        this.ownerId,
        hour,
      ),
      this.sql(
        "INSERT INTO colab_usage(owner_id,lane,window_hour,count) SELECT ?,'job',?,1 WHERE EXISTS(SELECT 1 FROM colab_jobs WHERE owner_id=? AND id=?) ON CONFLICT(owner_id,lane) DO UPDATE SET window_hour=excluded.window_hour,count=CASE WHEN colab_usage.window_hour=excluded.window_hour THEN colab_usage.count+1 ELSE 1 END",
        this.ownerId,
        hour,
        this.ownerId,
        id,
      ),
    ]);
    if (!changed(results[0])) throw new AssistantError('conflict');
    return {
      jobId: id,
      conversationId: conversation.id,
      status: 'queued',
      expiresAt,
    };
  }
  async job(id: string) {
    if (!validLocalId(id)) throw unauthorized();
    await this.prune();
    const row = await this.sql(
      'SELECT id,conversation_id,status,expires_at,reply FROM colab_jobs WHERE owner_id=? AND id=?',
      this.ownerId,
      id,
    ).first<Job>();
    if (!row) throw unauthorized();
    return {
      jobId: row.id,
      conversationId: row.conversation_id,
      status: row.status,
      expiresAt: row.expires_at,
      ...(row.status === 'completed' &&
      safeAssistantText(row.reply, 4096) &&
      !/\bcolab_[a-f0-9]{64}\b/u.test(row.reply)
        ? { reply: row.reply, model: { provider: 'colab', name: COLAB_MODEL } }
        : {}),
    };
  }
  async cancel(id: string) {
    await this.job(id);
    await this.db.batch([
      this.sql(
        "UPDATE colab_jobs SET status='cancelled',payload_json=NULL,user_text=NULL,reply=NULL,updated_at=? WHERE owner_id=? AND id=? AND status IN ('queued','running')",
        this.now(),
        this.ownerId,
        id,
      ),
      this.sql(
        "UPDATE conversations SET turn_token=NULL,turn_expires_at=NULL WHERE owner_id=? AND EXISTS(SELECT 1 FROM colab_jobs j WHERE j.owner_id=conversations.owner_id AND j.id=? AND j.conversation_id=conversations.id AND j.turn_token=conversations.turn_token AND j.status='cancelled')",
        this.ownerId,
        id,
      ),
    ]);
    return this.job(id);
  }
  async claim(sessionId: string) {
    await this.prune();
    const now = this.now(),
      minute = Math.floor(this.clock() / 60_000);
    const budget = await this.sql(
      "UPDATE colab_sessions SET last_seen_at=?,poll_window=?,poll_count=CASE WHEN poll_window=? THEN poll_count+1 ELSE 1 END WHERE owner_id=? AND id=? AND state='paired' AND expires_at>? AND (poll_window<>? OR poll_count<25)",
      now,
      minute,
      minute,
      this.ownerId,
      sessionId,
      now,
      minute,
    ).run();
    if (!changed(budget)) throw new ColabQuotaError(60);
    const leaseToken = credential(),
      leaseHash = await hash(leaseToken),
      leaseUntil = new Date(this.clock() + 90_000).toISOString();
    const result = await this.sql(
      "UPDATE colab_jobs SET status='running',lease_hash=?,lease_until=?,updated_at=? WHERE owner_id=? AND session_id=? AND status='queued' AND expires_at>? AND EXISTS(SELECT 1 FROM conversations c WHERE c.owner_id=colab_jobs.owner_id AND c.id=colab_jobs.conversation_id AND c.revision=colab_jobs.revision AND c.turn_token=colab_jobs.turn_token) AND EXISTS(SELECT 1 FROM colab_sessions s WHERE s.owner_id=colab_jobs.owner_id AND s.id=? AND s.state='paired' AND s.expires_at>?)",
      leaseHash,
      leaseUntil,
      now,
      this.ownerId,
      sessionId,
      now,
      sessionId,
      now,
    ).run();
    if (!changed(result)) return { job: null };
    const row = await this.sql(
      'SELECT id,payload_json,expires_at FROM colab_jobs WHERE owner_id=? AND session_id=? AND lease_hash=?',
      this.ownerId,
      sessionId,
      leaseHash,
    ).first<Job>();
    if (!row?.payload_json) throw new AssistantError('conflict');
    return {
      job: {
        id: row.id,
        leaseToken,
        expiresAt: leaseUntil < row.expires_at ? leaseUntil : row.expires_at,
        messages: JSON.parse(row.payload_json) as unknown,
        maxInputTokens: COLAB_INPUT_TOKENS,
        maxOutputTokens: COLAB_OUTPUT_TOKENS,
      },
    };
  }
  async fail(sessionId: string, jobId: string, leaseToken: string) {
    if (!validLocalId(jobId) || !validCredential(leaseToken))
      throw new AssistantError('invalid_input');
    const now = this.now();
    const result = await this.sql(
      "UPDATE colab_jobs SET status='failed',payload_json=NULL,user_text=NULL,reply=NULL,updated_at=? WHERE owner_id=? AND id=? AND session_id=? AND status='running' AND lease_hash=? AND lease_until>? AND expires_at>? AND EXISTS(SELECT 1 FROM colab_sessions s WHERE s.owner_id=colab_jobs.owner_id AND s.id=? AND s.state='paired' AND s.expires_at>?)",
      now,
      this.ownerId,
      jobId,
      sessionId,
      await hash(leaseToken),
      now,
      now,
      sessionId,
      now,
    ).run();
    if (!changed(result)) throw new AssistantError('conflict');
    await this.prune();
    return { completed: false, status: 'failed' };
  }
  async complete(
    sessionId: string,
    input: {
      jobId: string;
      leaseToken: string;
      reply: string;
      inputTokens: number;
      outputTokens: number;
    },
  ) {
    if (
      !validLocalId(input.jobId) ||
      !validCredential(input.leaseToken) ||
      !safeAssistantText(input.reply, 4096) ||
      !Number.isInteger(input.inputTokens) ||
      input.inputTokens < 1 ||
      input.inputTokens > COLAB_INPUT_TOKENS ||
      !Number.isInteger(input.outputTokens) ||
      input.outputTokens < 1 ||
      input.outputTokens > COLAB_OUTPUT_TOKENS
    )
      throw new AssistantError('invalid_input');
    await this.prune();
    const row = await this.sql(
      'SELECT * FROM colab_jobs WHERE owner_id=? AND id=? AND session_id=?',
      this.ownerId,
      input.jobId,
      sessionId,
    ).first<Job>();
    if (!row?.user_text || row.status !== 'running')
      throw new AssistantError('conflict');
    const now = this.now(),
      leaseHash = await hash(input.leaseToken);
    const guard =
      "EXISTS(SELECT 1 FROM colab_jobs j WHERE j.owner_id=conversations.owner_id AND j.id=? AND j.conversation_id=conversations.id AND j.status='completed' AND j.lease_hash=?)";
    const results = await this.db.batch([
      this.sql(
        "UPDATE colab_jobs SET status='completed',reply=?,updated_at=? WHERE owner_id=? AND id=? AND session_id=? AND status='running' AND lease_hash=? AND lease_until>? AND expires_at>? AND EXISTS(SELECT 1 FROM colab_sessions s WHERE s.owner_id=colab_jobs.owner_id AND s.id=? AND s.state='paired' AND s.expires_at>?) AND EXISTS(SELECT 1 FROM conversations c WHERE c.owner_id=colab_jobs.owner_id AND c.id=colab_jobs.conversation_id AND c.revision=colab_jobs.revision AND c.turn_token=colab_jobs.turn_token)",
        input.reply,
        now,
        this.ownerId,
        input.jobId,
        sessionId,
        leaseHash,
        now,
        now,
        sessionId,
        now,
      ),
      this.sql(
        `UPDATE conversations SET revision=revision+1,updated_at=? WHERE owner_id=? AND id=? AND revision=? AND turn_token=? AND ${guard}`,
        now,
        this.ownerId,
        row.conversation_id,
        row.revision,
        row.turn_token,
        input.jobId,
        leaseHash,
      ),
      ...(['user', 'assistant'] as const).map((role) =>
        this.sql(
          `INSERT INTO messages(owner_id,id,conversation_id,role,content,context_key,turn_revision,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM conversations WHERE owner_id=? AND id=? AND revision=? AND turn_token=? AND ${guard})`,
          this.ownerId,
          crypto.randomUUID(),
          row.conversation_id,
          role,
          role === 'user' ? row.user_text : input.reply,
          row.context_key,
          row.revision + 1,
          now,
          this.ownerId,
          row.conversation_id,
          row.revision + 1,
          row.turn_token,
          input.jobId,
          leaseHash,
        ),
      ),
      this.sql(
        `UPDATE conversations SET turn_token=NULL,turn_expires_at=NULL WHERE owner_id=? AND id=? AND turn_token=? AND ${guard}`,
        this.ownerId,
        row.conversation_id,
        row.turn_token,
        input.jobId,
        leaseHash,
      ),
      this.sql(
        "UPDATE colab_jobs SET payload_json=NULL,user_text=NULL WHERE owner_id=? AND id=? AND status='completed' AND lease_hash=?",
        this.ownerId,
        input.jobId,
        leaseHash,
      ),
    ]);
    if (!changed(results[0]) || !changed(results[1]))
      throw new AssistantError('conflict');
    return { completed: true };
  }
}
