CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  role          TEXT NOT NULL CHECK (role IN ('admin','supervisor','bt')),
  password_hash TEXT NOT NULL,
  must_reset    INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL,
  disabled_at   INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS rooms (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  kind       TEXT NOT NULL DEFAULT 'classroom' CHECK (kind IN ('gym','classroom')),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS slots (
  id         TEXT PRIMARY KEY,
  session    TEXT NOT NULL CHECK (session IN ('AM','MD','PM')),
  label      TEXT NOT NULL,
  start_min  INTEGER NOT NULL,
  end_min    INTEGER NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS groups (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  session     TEXT NOT NULL CHECK (session IN ('AM','MD','PM')),
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS staff_group_links (
  user_id  TEXT NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES groups(id)  ON DELETE CASCADE,
  PRIMARY KEY (user_id, group_id)
);

CREATE TABLE IF NOT EXISTS master_assignments (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  slot_id  TEXT NOT NULL REFERENCES slots(id)  ON DELETE CASCADE,
  room_id  TEXT NOT NULL REFERENCES rooms(id)  ON DELETE RESTRICT,
  PRIMARY KEY (group_id, slot_id)
);

CREATE TABLE IF NOT EXISTS overrides (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  slot_id  TEXT NOT NULL REFERENCES slots(id)  ON DELETE CASCADE,
  date     TEXT NOT NULL,
  room_id  TEXT REFERENCES rooms(id) ON DELETE RESTRICT,
  PRIMARY KEY (group_id, slot_id, date)
);

CREATE TABLE IF NOT EXISTS activities (
  group_id   TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  slot_id    TEXT NOT NULL REFERENCES slots(id)  ON DELETE CASCADE,
  date       TEXT NOT NULL,
  label      TEXT NOT NULL,
  updated_by TEXT NOT NULL REFERENCES users(id),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, slot_id, date)
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT REFERENCES users(id),
  action     TEXT NOT NULL,
  payload    TEXT,
  created_at INTEGER NOT NULL
);
