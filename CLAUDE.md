# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

The app now has a Node.js backend. To run locally:

```bash
npm install
npm start         # node server/index.js (listens on :3000)
# or
npm run dev       # auto-reload on file changes
```

Open `http://localhost:3000`. The backend:
- Serves the static frontend (index.html, js/, styles.css)
- Runs the schema migration on startup (server/migrate.js)
- Provides `/health` and future API endpoints under `/api`

For Docker (when deploying):
```bash
docker-compose up --build
```

Data (SQLite file) is mounted at `./data` so it persists across container restarts.

## Backend

**Tech**: Node.js + Express, SQLite (better-sqlite3), WebSockets (ws), bcryptjs auth.

**Directory**: `server/`
- `index.js` — Express app entry point
- `db.js` — SQLite connection singleton (WAL mode, foreign keys on)
- `schema.sql` — all table definitions
- `migrate.js` — runs schema on startup
- `routes/` — future API endpoints (phases 2+)

**Migration plan**: When moving to the Pi, copy `./data/schedule.db` over and restart. All schedule data comes with it.

## Frontend Architecture

**Stack**: Vanilla JS ES modules, no framework, no bundler, PWA (manifest.json).

**Module roles:**
- `js/state.js` — reactive global state with subscriber pattern; auto-saves to localStorage
- `js/data.js` — all business logic and algorithms (pure functions, no DOM)
- `js/app.js` — routing controller; mounts the correct view based on state
- `js/auth.js` — async PIN hashing via Web Crypto API
- `js/utils.js` — date math, time parsing, slot detection helpers
- `js/views/` — view modules; each exports a `mount(container)` function

**Data flow:**
```
User action → setState() in state.js → notifies subscribers → app.js:route() → view.mount()
```

Views are fully replaced on each route. No virtual DOM or diffing.

## State Shape

Two localStorage keys:
- `scheduler_state` — persisted data (groups, staff, assignments, overrides, settings)
- `scheduler_ui` — ephemeral UI state (role, currentDate, currentSession, flags)

`setState(partial)` merges shallowly into state and debounces saves (300ms). Use `setStateSilent(partial)` for UI-only changes that shouldn't trigger a full re-render (e.g., settings panel edits mid-flight).

## Key Domain Concepts

- **Group**: a scheduled class (has dayOfWeek and session AM/MD/PM)
- **Staff**: supervisor or `bt` (behavior technician) role; linked to groups via `staffGroupLinks`
- **MasterAssignment**: recurring room assignment for a group+slot combination
- **Override**: a date-specific exception that supersedes a masterAssignment
- **Activity**: optional label per cell, editable by BTs only (not admins)

## Auto-Assign Algorithm (`data.js:autoAssignRooms`)

Hard constraints:
- Each group gets at most 1 Gym slot total
- No 3+ consecutive slots in the same room

Soft constraint: prefer room diversity (penalize reuse, reward variety).

Returns an array of violation strings shown as toast notifications. Algorithm is re-run from scratch each call — it does not mutate existing assignments incrementally.

## Role-Based Access

| Role | Grid edit | Settings | Activity edit |
|------|-----------|----------|---------------|
| admin | ✓ | ✓ | ✗ |
| supervisor | read-only | ✗ | ✗ |
| bt | personal view only | ✗ | ✓ |

Admin access is PIN-gated (SHA-256 hash stored in state, never plaintext).

## Styling

CSS custom properties in `styles.css` define all design tokens (colors, radii, shadows, spacing). Room colors are assigned by index from a fixed 10-color palette. Theme (dark default / light) is toggled via `data-theme` on `<html>` and persisted in localStorage.
