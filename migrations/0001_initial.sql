CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  draft TEXT NOT NULL,
  published TEXT,
  revision INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE media (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, bytes INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'ready')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE leads (
  id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE, fingerprint TEXT NOT NULL,
  name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', request TEXT NOT NULL DEFAULT '',
  reference_links TEXT NOT NULL, service_name TEXT NOT NULL, config_version INTEGER NOT NULL,
  estimate INTEGER NOT NULL, manual_review INTEGER NOT NULL, snapshot TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'rejected', 'accepted', 'production', 'waiting', 'approved', 'paid')),
  attention INTEGER NOT NULL DEFAULT 1, notes TEXT NOT NULL DEFAULT '', final_price INTEGER,
  paid_at TEXT, is_job INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX leads_status_created ON leads(status, created_at DESC, id);
CREATE INDEX leads_attention_created ON leads(attention, created_at DESC, id);
CREATE INDEX leads_created ON leads(created_at DESC, id);
CREATE TABLE history (
  id TEXT PRIMARY KEY, lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  actor TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX history_lead ON history(lead_id, created_at);
CREATE TABLE outbox (
  id TEXT PRIMARY KEY, lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('new_lead', 'new_job')),
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'sending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0, next_attempt TEXT NOT NULL,
  last_error TEXT, created_at TEXT NOT NULL,
  UNIQUE (lead_id, kind)
);
CREATE INDEX outbox_pending ON outbox(state, next_attempt);
CREATE TABLE rate_buckets (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
