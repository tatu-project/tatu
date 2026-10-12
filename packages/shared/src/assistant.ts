import { hasTextSecret } from './text-policy.js';
import { hasOnlyKeys } from './object-policy.js';
import type { BriefingDraft } from './index.js';

export class AssistantError extends Error {
  constructor(
    readonly code:
      | 'invalid_input'
      | 'not_found'
      | 'conflict'
      | 'expired'
      | 'unavailable'
      | 'invalid_output'
      | 'timeout'
      | 'unsupported',
  ) {
    super(code);
  }
}
export const safeAssistantText = (
  value: unknown,
  maxBytes = 16_384,
): value is string =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  new TextEncoder().encode(value).byteLength <= maxBytes &&
  ![...value].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code === 127 || (code < 32 && ![9, 10, 13].includes(code));
  }) &&
  !hasTextSecret(value);
export const validLocalId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9-]{36}$/u.test(value);
export function validTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 128) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
export function validBriefingDraft(value: unknown): value is BriefingDraft {
  if (
    !hasOnlyKeys(value, [
      'cadence',
      'time',
      'timezone',
      'quantity',
      'topic',
      'deliveryRequested',
    ])
  )
    return false;
  return (
    value.cadence === 'daily' &&
    value.deliveryRequested === true &&
    typeof value.time === 'string' &&
    /^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(value.time) &&
    validTimezone(value.timezone) &&
    Number.isInteger(value.quantity) &&
    Number(value.quantity) >= 1 &&
    Number(value.quantity) <= 10 &&
    safeAssistantText(value.topic, 512)
  );
}
export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  contextKey: string;
}
export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}
export interface Conversation extends ConversationSummary {
  revision: number;
  messages: AssistantMessage[];
}
export interface Memory {
  id: string;
  content: string;
  category: 'preference' | 'instruction';
  createdAt: string;
  updatedAt: string;
}
export interface Note {
  id: string;
  title: string;
  content: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
export interface AssistantStore {
  listConversations(): ConversationSummary[];
  conversation(id: string): Conversation | undefined;
  createConversation(title: string): Conversation;
  appendTurn(
    id: string,
    revision: number,
    user: string,
    reply: string,
    contextKey: string,
  ): void;
  deleteConversation(id: string): boolean;
  memories(): Memory[];
  createMemory(content: string, category: Memory['category']): Memory;
  updateMemory(
    id: string,
    content: string,
    category: Memory['category'],
  ): Memory | undefined;
  deleteMemory(id: string): boolean;
  notes(query?: string): Note[];
  note(id: string): Note | undefined;
  createNote(title: string, content: string): Note;
  updateNote(
    id: string,
    title: string,
    content: string,
    revision: number,
  ): Note | undefined;
  deleteNote(id: string): boolean;
  close(): void;
}
export interface AssistantModel {
  readonly name: string;
  reply(
    messages: readonly {
      role: 'system' | 'user' | 'assistant';
      content: string;
    }[],
    signal: AbortSignal,
  ): Promise<string>;
  status(signal: AbortSignal): Promise<{
    configured: boolean;
    available: boolean;
    model: string | null;
    reason: 'not_configured' | 'available' | 'model_missing' | 'unavailable';
  }>;
}
export interface BriefingProposal {
  id: string;
  kind: 'create_briefing';
  draft: BriefingDraft;
  expiresAt: string;
}
export type TaskPatch = Partial<
  Pick<BriefingDraft, 'time' | 'timezone' | 'quantity' | 'topic'>
> & { enabled?: boolean };
