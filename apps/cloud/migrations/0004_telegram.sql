CREATE TABLE telegram_updates (update_id INTEGER PRIMARY KEY,received_at TEXT NOT NULL);
CREATE INDEX telegram_updates_received ON telegram_updates(received_at);
CREATE TABLE telegram_chats (owner_id TEXT PRIMARY KEY,conversation_id TEXT,updated_at TEXT NOT NULL,FOREIGN KEY(owner_id) REFERENCES owners(id) ON DELETE CASCADE);
CREATE TABLE owner_preferences (owner_id TEXT PRIMARY KEY,model_route TEXT NOT NULL CHECK(model_route IN ('auto','groq','groq-sponsored','workers-ai')),updated_at TEXT NOT NULL,FOREIGN KEY(owner_id) REFERENCES owners(id) ON DELETE CASCADE);
