# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

No build step required — this is a static vanilla JS app. Serve from the project root:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Open `http://localhost:8080` (or whatever port). ES modules require an HTTP server; opening `index.html` directly as `file://` will fail.

## Architecture

**Stack**: Vanilla JS ES modules, no framework, no bundler, localStorage persistence, PWA (manifest.json).

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
- `pacific_clinics_state` — persisted data (groups, staff, assignments, overrides, settings)
- `pacific_clinics_ui` — ephemeral UI state (role, currentDate, currentSession, flags)

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
