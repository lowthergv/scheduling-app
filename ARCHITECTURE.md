# Pacific Clinics Scheduler — Backend Architecture Plan

Status: **Phase 1 complete** · Target: multi-user shared schedule, self-hosted on a Raspberry Pi at the clinic, accessible from the public internet, with real-time sync.

---

## Implementation Status

**✓ Phase 1 complete:**
- Express.js app scaffolding, static frontend serving
- SQLite setup with WAL mode, foreign keys enabled
- Full schema (11 tables) with idempotent migrations
- Health check endpoint (`GET /health`)
- Docker + docker-compose for portable deployment
- npm scripts: `npm start`, `npm run dev`
- Tested on macOS (Apple Silicon); ready for Pi 4/5

**Next**: Phase 2 (Auth layer) — login, sessions, rate limiting.

---

## 1. Decisions locked in

| Area | Choice |
|------|--------|
| Backend language | Node.js + Express |
| Database | SQLite (via `better-sqlite3`) |
| Realtime | WebSockets (`ws` library) |
| Auth | Per-user passwords (bcrypt) + signed session cookies |
| Hosting | Raspberry Pi at the clinic, public internet access |
| HTTPS / reverse proxy | Caddy (auto Let's Encrypt) |
| Frontend | Keep vanilla JS — swap the localStorage layer only |
| Migration | None — start fresh |

---

## 2. High-level shape

```
                   Internet
                      │
                      ▼
       ┌──────────────────────────┐
       │ Domain (Cloudflare DNS,  │
       │ DuckDNS, etc.)           │
       └──────────────────────────┘
                      │  HTTPS :443
                      ▼
       ┌──────────────────────────┐
       │  Clinic router           │
       │  (port-forward 443 → Pi) │
       └──────────────────────────┘
                      │
                      ▼
       ┌──────────────────────────┐
       │  Raspberry Pi            │
       │  ┌────────────────────┐  │
       │  │ Caddy :443         │  │   auto HTTPS
       │  └─────────┬──────────┘  │
       │            ▼              │
       │  ┌────────────────────┐  │
       │  │ Node.js / Express  │  │   API + WS
       │  │ :3000              │  │
       │  └─────────┬──────────┘  │
       │            ▼              │
       │  ┌────────────────────┐  │
       │  │ schedule.db        │  │   SQLite file
       │  └────────────────────┘  │
       └──────────────────────────┘
```

The frontend is served as static files by Caddy. It opens a WebSocket back to the Pi for live updates and POSTs mutations to `/api/...`.

---

## 3. Database schema

SQLite. WAL mode enabled for safe concurrent reads during writes. All `id`s are short UUIDs (text).

```sql
-- people who can log in
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  role          TEXT NOT NULL CHECK (role IN ('admin','supervisor','bt')),
  password_hash TEXT NOT NULL,           -- bcrypt
  must_reset    INTEGER NOT NULL DEFAULT 1,  -- force change on first login
  created_at    INTEGER NOT NULL,
  disabled_at   INTEGER
);

-- session cookies
CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,           -- random 32 bytes hex
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  user_agent TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- rooms (Gym, Room 1, etc.)
CREATE TABLE rooms (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  kind       TEXT NOT NULL DEFAULT 'classroom',  -- 'gym' | 'classroom'
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- session time slots (AM/MD/PM each have multiple)
CREATE TABLE slots (
  id         TEXT PRIMARY KEY,
  session    TEXT NOT NULL CHECK (session IN ('AM','MD','PM')),
  label      TEXT NOT NULL,              -- e.g. "9:00–9:30"
  start_min  INTEGER NOT NULL,           -- minutes since midnight
  end_min    INTEGER NOT NULL,
  sort_order INTEGER NOT NULL
);

-- groups (recurring classes)
CREATE TABLE groups (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  day_of_week INTEGER NOT NULL,          -- 1=Mon..5=Fri
  session     TEXT NOT NULL CHECK (session IN ('AM','MD','PM')),
  created_at  INTEGER NOT NULL
);

-- which staff are linked to which groups
CREATE TABLE staff_group_links (
  user_id  TEXT NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, group_id)
);

-- weekly recurring room assignment
CREATE TABLE master_assignments (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  slot_id  TEXT NOT NULL REFERENCES slots(id)  ON DELETE CASCADE,
  room_id  TEXT NOT NULL REFERENCES rooms(id)  ON DELETE RESTRICT,
  PRIMARY KEY (group_id, slot_id)
);

-- date-specific overrides
CREATE TABLE overrides (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  slot_id  TEXT NOT NULL REFERENCES slots(id)  ON DELETE CASCADE,
  date     TEXT NOT NULL,                -- YYYY-MM-DD
  room_id  TEXT REFERENCES rooms(id) ON DELETE RESTRICT,  -- NULL = unassigned
  PRIMARY KEY (group_id, slot_id, date)
);

-- BT-editable activity labels per cell
CREATE TABLE activities (
  group_id   TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  slot_id    TEXT NOT NULL REFERENCES slots(id)  ON DELETE CASCADE,
  date       TEXT NOT NULL,
  label      TEXT NOT NULL,
  updated_by TEXT NOT NULL REFERENCES users(id),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, slot_id, date)
);

-- misc key/value settings (overlap rules, etc.)
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL                    -- JSON
);

-- audit log (who changed what, helpful for clinics)
CREATE TABLE audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT REFERENCES users(id),
  action     TEXT NOT NULL,              -- 'assign','override','login', etc.
  payload    TEXT,                       -- JSON
  created_at INTEGER NOT NULL
);
```

Notes:
- `users` replaces the current `staff` array — the same row is both the login identity and the schedulable person.
- `must_reset = 1` for any password set by an admin; cleared after the user changes it.
- `audit_log` is cheap and gives you a "who scheduled this" trail clinics tend to want.

---

## 4. API surface

All routes prefixed `/api`. JSON bodies. Cookies carry session.

### Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` | `{name, password}` → sets cookie. Rate-limited. |
| POST | `/auth/logout` | Clears cookie + deletes session row |
| POST | `/auth/change-password` | `{current, new}`. Required if `must_reset=1`. |
| GET  | `/me` | Returns current user (or 401) |

### Bootstrap (one big snapshot)
| Method | Path | Notes |
|---|---|---|
| GET | `/state` | Returns full state object (rooms, slots, groups, users, links, master, overrides for ±2 weeks, activities for ±2 weeks, settings). Used on app load. |

The frontend keeps a structured copy of this in memory — same shape `state.js` already uses, just hydrated from the server instead of localStorage.

### Mutations (admin-only unless noted)
Each mutation returns the canonical resulting object and triggers a WebSocket broadcast.

| Method | Path | Who |
|---|---|---|
| POST/PATCH/DELETE | `/users` | admin |
| POST/PATCH/DELETE | `/rooms` | admin |
| POST/PATCH/DELETE | `/slots` | admin |
| POST/PATCH/DELETE | `/groups` | admin |
| PUT/DELETE | `/master/:groupId/:slotId` | admin |
| PUT/DELETE | `/overrides/:groupId/:slotId/:date` | admin |
| PUT/DELETE | `/activities/:groupId/:slotId/:date` | **bt only** (per memory: activity scope is BT, not admin) |
| POST | `/auto-assign` | admin — runs the existing algorithm server-side |

### WebSocket
Single endpoint `/api/ws`. After upgrade, server validates the session cookie and joins the connection to a single broadcast room. Server pushes events:

```json
{ "type": "override.set", "data": { "groupId": "...", "slotId": "...", "date": "...", "roomId": "..." } }
{ "type": "user.created", "data": { ... } }
{ "type": "snapshot.invalidated" }   // tells clients to refetch /state
```

Clients apply incoming events to their in-memory state and re-render. Last-write-wins; no merge conflicts because mutations are atomic at the cell level.

---

## 5. Auth & security

- **Passwords**: bcrypt cost 12. Stored only as hash.
- **First login**: admin sets a temp password when creating a user; user is forced to change it on first login (`must_reset` flag).
- **Sessions**: random 32-byte token in an `HttpOnly; Secure; SameSite=Lax` cookie. 30-day expiry, sliding. Server stores token row in `sessions` so logout actually invalidates.
- **Rate limiting**: `/auth/login` capped at 5 attempts/min/IP via `express-rate-limit`. Failed logins logged.
- **CSRF**: `SameSite=Lax` cookies + Origin header check on mutations. No third-party forms can hit our API.
- **Input validation**: `zod` schemas on every endpoint. Reject anything else.
- **SQL**: parameterized queries only (better-sqlite3 makes this the easy path).
- **HTTPS**: enforced by Caddy. HTTP redirects to HTTPS.
- **Backups**: `cron` runs `sqlite3 schedule.db ".backup /backups/schedule-$(date +\%F).db"` nightly. Keep 30 days locally + sync to off-Pi storage (a USB drive, cloud, or another machine).

---

## 6. Frontend changes

The existing `js/state.js` already centralizes persistence — that's the only file that fundamentally needs to change. New shape:

```js
// js/api.js (new)
export async function apiFetch(path, opts) { /* fetch with credentials */ }
export function openSocket(onEvent) { /* WS with auto-reconnect */ }

// js/state.js (modified)
//   on load:    fetch /state, hydrate, open WS
//   on mutate:  call /api/... endpoint; do NOT write to localStorage
//   on WS msg:  apply event, notify subscribers
```

A small login screen is added (renders before `roleSelect`). After login:
- admins go to the existing grid
- supervisors go to the read-only grid
- BTs go to their personal view

Everything downstream (views, auto-assign UI, etc.) keeps working unchanged because the in-memory state shape is preserved.

---

## 7. Deployment plan

### MacBook prototype (current)

For same-WiFi access during staff testing:
```bash
npm install
npm start  # listens on 0.0.0.0:3000, accessible via MacBook's LAN IP
```

Staff connect via `http://<your-mac-ip>:3000`. The SQLite file lives in `./data/schedule.db`. To back up before testing, copy `data/` to another location.

### One-time setup on the Pi (eventual)
1. Install: `nodejs` (LTS), `sqlite3`, `caddy`.
2. Clone repo to `/opt/scheduler`, `npm ci --production`.
3. Create `/opt/scheduler/data/` for the SQLite file. `chmod 700`.
4. Generate `SESSION_SECRET` and store in `/etc/scheduler.env` (`chmod 600`).
5. Write `systemd` unit `/etc/systemd/system/scheduler.service`:
   - `EnvironmentFile=/etc/scheduler.env`
   - `WorkingDirectory=/opt/scheduler`
   - `ExecStart=/usr/bin/node server.js`
   - `Restart=always`, `User=scheduler`
6. `Caddyfile`:
   ```
   schedule.example.com {
     encode gzip
     reverse_proxy /api/* localhost:3000
     reverse_proxy /api/ws localhost:3000
     root * /opt/scheduler/public
     file_server
   }
   ```
7. Pi router: forward TCP 80 + 443 to the Pi's LAN IP. Reserve that IP via DHCP.
8. DNS: point a subdomain at the clinic's public IP. Use DuckDNS / Cloudflare DDNS if the IP isn't static.
9. First-run script: creates the initial admin user from env vars (`ADMIN_NAME`, `ADMIN_PASSWORD`), then exits. Admin logs in and creates the rest.

### Day-to-day
- Push code to git, `git pull && systemctl restart scheduler` on the Pi (later: GitHub Actions → SSH).
- Watch logs with `journalctl -u scheduler -f`.

---

## 8. Security caveats specific to public exposure

Putting a Pi on the public internet means more discipline than a LAN-only deploy:

- **Keep the Pi patched** — `unattended-upgrades` for OS, monthly Node updates.
- **No SSH password auth** — keys only, change SSH port, fail2ban.
- **No other ports open** — only 80/443. Block everything else at the router.
- **Monitor `audit_log`** for unusual login patterns. Add an alert if a user gets >10 failed logins in an hour.
- **Off-Pi backups are non-negotiable** — if the Pi dies (SD cards do), all schedule history dies with it.

If any of this feels heavier than the value warrants, Tailscale + LAN-only is a real fallback worth reconsidering.

---

## 9. Build phases

A suggested order of work (each phase is shippable on its own):

1. **✓ Backend skeleton** — Express app, SQLite init, schema migration script, health check route. No auth yet. Run locally.
   - *Completed*. All tables defined and migrated on startup. Server serves frontend at localhost:3000. Tested.
2. **Auth layer** — `users`, `sessions` tables; login / logout / me / change-password endpoints; session cookie middleware; rate limit.
3. **Read API** — `GET /state` returning the full snapshot from DB. Seed script populates a sample dataset.
4. **Frontend bootstrap swap** — replace localStorage hydration in `state.js` with `fetch('/api/state')`. Add login screen. Confirm the existing UI works against the live backend (no mutations yet).
5. **Mutation API** — implement each endpoint, one resource at a time (rooms, slots, groups, users, master, overrides, activities). Wire the corresponding UI actions to call them.
6. **WebSocket sync** — broadcast on every mutation; client applies events. Test with two browsers.
7. **Auto-assign endpoint** — port the algorithm from `data.js` to the server.
8. **Admin UI** — user management (create user, set role, reset password) inside the settings panel.
9. **Pi deployment** — Caddy, systemd, DNS, port forward, backups.
10. **Polish** — audit log viewer for admins, optimistic UI for snappier mutations, offline indicator.

---

## 10. Questions still open

These don't block the design but want a real answer before phase 5:

1. **Admin lockout recovery**: if the only admin forgets their password, what's the recovery story? (Suggested: a CLI command on the Pi that resets a user's password — tied to filesystem access.)
2. **Concurrent edits on the same cell**: last-write-wins is simple but two admins can clobber each other silently. Worth surfacing a toast like "X overwrote your change just now"? Cheap to add later.
3. **Time zone**: the Pi's local TZ should match the clinic. Date strings (`YYYY-MM-DD`) are stored as-is — make sure the server and clients agree on what "today" means.
4. **PWA / offline**: do you want BT users to be able to view today's schedule on their phone with no signal? Doable with a service worker cache, but not free.

---

## 11. About the "data resets" complaint

This plan replaces localStorage with the backend, which makes the question moot — but worth flagging anyway: the current localStorage persistence in [state.js](js/state.js) **does** save across browser restarts on the same device. If you've been seeing resets, it's almost certainly because you're testing across different browsers or devices, or DevTools "Empty cache and hard reload" is wiping site data. Once the backend is in, this is a non-issue.
