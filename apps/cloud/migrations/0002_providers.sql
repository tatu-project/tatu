CREATE TABLE provider_connections (
 owner_id TEXT NOT NULL, provider TEXT NOT NULL CHECK(provider='groq'), envelope_json TEXT NOT NULL,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(owner_id,provider),
 FOREIGN KEY(owner_id) REFERENCES owners(id) ON DELETE CASCADE
);
CREATE TABLE provider_quota (
 scope TEXT NOT NULL, provider TEXT NOT NULL, minute INTEGER NOT NULL, day INTEGER NOT NULL,
 minute_requests INTEGER NOT NULL, day_requests INTEGER NOT NULL,
 minute_units INTEGER NOT NULL, day_units INTEGER NOT NULL,
 active INTEGER NOT NULL DEFAULT 0, lease_epoch INTEGER NOT NULL,
 blocked_until INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(scope,provider)
);
