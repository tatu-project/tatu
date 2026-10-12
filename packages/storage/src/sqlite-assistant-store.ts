import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import {
  AssistantError,
  safeAssistantText,
  redactTextSecrets,
  type AssistantStore,
  type Conversation,
  type ConversationSummary,
  type Memory,
  type Note,
  type AssistantMessage,
} from '@tatu/shared';

const requireText = (value: unknown, max: number) => {
  if (!safeAssistantText(value, max)) throw new AssistantError('invalid_input');
};
const memorySelect =
  'SELECT id,content,category,created_at as createdAt,updated_at as updatedAt FROM assistant_memories';
const noteSelect =
  'SELECT id,title,content,revision,created_at as createdAt,updated_at as updatedAt FROM assistant_notes';
const summarySelect =
  'SELECT id,title,created_at as createdAt,updated_at as updatedAt,revision FROM assistant_conversations';
const publicMemory = (row: Memory): Memory => ({
  id: row.id,
  content: redactTextSecrets(row.content),
  category: row.category,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});
const publicNote = (row: Note): Note => ({
  id: row.id,
  title: redactTextSecrets(row.title),
  content: redactTextSecrets(row.content),
  revision: row.revision,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/** Explicit local records only: transcripts never create memory automatically. */
export class SqliteAssistantStore implements AssistantStore {
  private readonly db: Database.Database;
  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('foreign_keys = ON');
    this.db
      .exec(`CREATE TABLE IF NOT EXISTS assistant_conversations (id TEXT PRIMARY KEY,title TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,revision INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS assistant_messages (id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,role TEXT NOT NULL,content TEXT NOT NULL,created_at TEXT NOT NULL,context_key TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS assistant_memories (id TEXT PRIMARY KEY,content TEXT NOT NULL,category TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS assistant_notes (id TEXT PRIMARY KEY,title TEXT NOT NULL,content TEXT NOT NULL,revision INTEGER NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);`);
  }
  listConversations(): ConversationSummary[] {
    return (
      this.db
        .prepare(`${summarySelect} ORDER BY updated_at DESC,id LIMIT 200`)
        .all() as ConversationSummary[]
    ).map((row) => ({
      id: row.id,
      title: redactTextSecrets(row.title),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }
  conversation(id: string): Conversation | undefined {
    const row = this.db.prepare(`${summarySelect} WHERE id=?`).get(id) as
      Omit<Conversation, 'messages'> | undefined;
    if (!row) return undefined;
    const messages = this.db
      .prepare(
        'SELECT id,role,content,created_at as createdAt,context_key as contextKey FROM assistant_messages WHERE conversation_id=? ORDER BY rowid',
      )
      .all(id) as AssistantMessage[];
    return {
      ...row,
      title: redactTextSecrets(row.title),
      messages: messages.map((message) => ({
        ...message,
        content: redactTextSecrets(message.content),
      })),
    };
  }
  createConversation(title: string): Conversation {
    if (
      (
        this.db
          .prepare('SELECT COUNT(*) as count FROM assistant_conversations')
          .get() as { count: number }
      ).count >= 200
    )
      throw new AssistantError('conflict');
    requireText(title, 512);
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    this.db
      .prepare('INSERT INTO assistant_conversations VALUES (?,?,?,?,0)')
      .run(id, title, now, now);
    return {
      id,
      title,
      createdAt: now,
      updatedAt: now,
      revision: 0,
      messages: [],
    };
  }
  appendTurn(
    id: string,
    revision: number,
    user: string,
    reply: string,
    contextKey: string,
  ): void {
    requireText(user, 16_384);
    requireText(reply, 16_384);
    if (!/^(?:[a-f0-9]{64})?$/u.test(contextKey))
      throw new AssistantError('invalid_input');
    this.db
      .transaction(() => {
        const count = this.db
          .prepare(
            'SELECT COUNT(*) as count FROM assistant_messages WHERE conversation_id=?',
          )
          .get(id) as { count: number };
        if (count.count >= 200) throw new AssistantError('conflict');
        const now = new Date().toISOString();
        const changed = this.db
          .prepare(
            'UPDATE assistant_conversations SET revision=revision+1,updated_at=? WHERE id=? AND revision=?',
          )
          .run(now, id, revision);
        if (!changed.changes)
          throw new AssistantError(
            this.conversation(id) ? 'conflict' : 'not_found',
          );
        const insert = this.db.prepare(
          'INSERT INTO assistant_messages VALUES (?,?,?,?,?,?)',
        );
        insert.run(crypto.randomUUID(), id, 'user', user, now, contextKey);
        insert.run(
          crypto.randomUUID(),
          id,
          'assistant',
          reply,
          now,
          contextKey,
        );
      })
      .immediate();
  }
  deleteConversation(id: string): boolean {
    return (
      this.db.prepare('DELETE FROM assistant_conversations WHERE id=?').run(id)
        .changes > 0
    );
  }
  memories(): Memory[] {
    return (
      this.db
        .prepare(`${memorySelect} ORDER BY created_at,id LIMIT 500`)
        .all() as Memory[]
    ).map(publicMemory);
  }
  createMemory(content: string, category: Memory['category']): Memory {
    if (
      (
        this.db
          .prepare('SELECT COUNT(*) as count FROM assistant_memories')
          .get() as { count: number }
      ).count >= 500
    )
      throw new AssistantError('conflict');
    requireText(content, 4096);
    if (!['preference', 'instruction'].includes(category))
      throw new AssistantError('invalid_input');
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    this.db
      .prepare('INSERT INTO assistant_memories VALUES (?,?,?,?,?)')
      .run(id, content, category, now, now);
    return { id, content, category, createdAt: now, updatedAt: now };
  }
  updateMemory(
    id: string,
    content: string,
    category: Memory['category'],
  ): Memory | undefined {
    requireText(content, 4096);
    if (!['preference', 'instruction'].includes(category))
      throw new AssistantError('invalid_input');
    if (
      !this.db
        .prepare(
          'UPDATE assistant_memories SET content=?,category=?,updated_at=? WHERE id=?',
        )
        .run(content, category, new Date().toISOString(), id).changes
    )
      return undefined;
    return publicMemory(
      this.db.prepare(`${memorySelect} WHERE id=?`).get(id) as Memory,
    );
  }
  deleteMemory(id: string): boolean {
    return (
      this.db.prepare('DELETE FROM assistant_memories WHERE id=?').run(id)
        .changes > 0
    );
  }
  notes(query = ''): Note[] {
    if (query !== '' && !safeAssistantText(query, 256))
      throw new AssistantError('invalid_input');
    return (
      this.db
        .prepare(
          `${noteSelect} WHERE instr(lower(title),lower(?))>0 OR instr(lower(content),lower(?))>0 ORDER BY updated_at DESC,id LIMIT 100`,
        )
        .all(query, query) as Note[]
    ).map(publicNote);
  }
  createNote(title: string, content: string): Note {
    if (
      (
        this.db
          .prepare('SELECT COUNT(*) as count FROM assistant_notes')
          .get() as { count: number }
      ).count >= 1000
    )
      throw new AssistantError('conflict');
    requireText(title, 512);
    requireText(content, 16_384);
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    this.db
      .prepare('INSERT INTO assistant_notes VALUES (?,?,?,1,?,?)')
      .run(id, title, content, now, now);
    return { id, title, content, revision: 1, createdAt: now, updatedAt: now };
  }
  updateNote(
    id: string,
    title: string,
    content: string,
    revision: number,
  ): Note | undefined {
    requireText(title, 512);
    requireText(content, 16_384);
    if (!Number.isInteger(revision) || revision < 1)
      throw new AssistantError('invalid_input');
    return this.db
      .transaction(() => {
        const row = this.db.prepare(`${noteSelect} WHERE id=?`).get(id) as
          Note | undefined;
        if (!row) return undefined;
        if (row.revision !== revision) throw new AssistantError('conflict');
        this.db
          .prepare(
            'UPDATE assistant_notes SET title=?,content=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?',
          )
          .run(title, content, new Date().toISOString(), id, revision);
        return publicNote(
          this.db.prepare(`${noteSelect} WHERE id=?`).get(id) as Note,
        );
      })
      .immediate();
  }
  note(id: string): Note | undefined {
    const row = this.db.prepare(`${noteSelect} WHERE id=?`).get(id) as
      Note | undefined;
    return row ? publicNote(row) : undefined;
  }
  deleteNote(id: string): boolean {
    return (
      this.db.prepare('DELETE FROM assistant_notes WHERE id=?').run(id)
        .changes > 0
    );
  }
  close(): void {
    this.db.close();
  }
}
