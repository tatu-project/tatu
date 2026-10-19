/** Maximum UTF-8 bytes of JSON-encoded provider messages, shared by API/adapters. */
export const PROVIDER_CONTEXT_MAX_BYTES = 4096;
export interface D1Result<T = Record<string, unknown>> {
  success: boolean;
  results: T[];
  meta: { changes?: number };
}
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}
export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(
    statements: D1PreparedStatement[],
  ): Promise<D1Result<T>[]>;
}
export interface CloudEnv {
  DB?: D1Database;
  SITE_ORIGIN?: string;
  AUTH_MODE?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ACCESS_AUDIENCE?: string;
  SITE_PROJECT_ID?: string;
  SITES_OWNER_PRIVATE?: string;
  SYSTEM_RUN_TOKEN?: string;
  TATU_COLAB_SITES_SERVICE_TOKEN?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  TELEGRAM_OWNER_IDS?: string;
  [key: string]: unknown;
}
export interface CloudContext {
  waitUntil(promise: Promise<unknown>): void;
}
export interface VerifiedIdentity {
  issuer: string;
  subject: string;
}
export type Authenticate = (
  request: Request,
  env: CloudEnv,
) => Promise<VerifiedIdentity | null>;
export interface RemoteReply {
  reply: string;
  model: { provider: string; name: string };
}
export interface RemoteStatus {
  configured: boolean;
  available: boolean;
  model: string | null;
  reason: string;
}
/** Owner-selected model route; 'auto' keeps the fixed default precedence. */
export type ModelRoute = 'auto' | 'groq' | 'groq-sponsored' | 'workers-ai';
export const MODEL_ROUTES: readonly ModelRoute[] = [
  'auto',
  'groq',
  'groq-sponsored',
  'workers-ai',
];
export interface ModelRouteStatus {
  id: Exclude<ModelRoute, 'auto'>;
  model: string;
  /** Configured for this owner; external quota is still checked per call. */
  configured: boolean;
}
export interface RemoteServices {
  reply(
    ownerId: string,
    messages: readonly {
      role: 'system' | 'user' | 'assistant';
      content: string;
    }[],
    signal: AbortSignal,
    preferred?: ModelRoute,
  ): Promise<RemoteReply>;
  status(ownerId: string, preferred?: ModelRoute): Promise<RemoteStatus>;
  /** Routes in default precedence order; absent in fixtures without routing. */
  routes?(ownerId: string): Promise<ModelRouteStatus[]>;
  connections(ownerId: string): Promise<unknown>;
  connect(ownerId: string, input: unknown): Promise<unknown>;
  disconnect(ownerId: string, id: string): Promise<boolean>;
}
export interface CloudTask {
  id: string;
  cadence: 'daily';
  time: string;
  timezone: string;
  quantity: number;
  topic: string;
  enabled: boolean;
  deliveryRequested: true;
  createdAt: string;
  nextRunAt: string | null;
  scheduleRevision: number;
}
export interface CloudExecution {
  id: string;
  taskId: string;
  scheduledFor: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
  attempt: number;
  maxAttempts: number;
  availableAt: string;
  leaseExpiresAt: string | null;
  failure: string | null;
  createdAt: string;
  updatedAt: string;
}
