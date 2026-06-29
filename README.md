# ABA Scheduling App

A web app for scheduling ABA technicians, clients, and rooms across a clinic
day — built to replace the hand-maintained Excel spreadsheet a clinic was using
to staff every session.

**[Live demo →](https://lowthergv.github.io/scheduling-app/)** (opens with example data)

## The idea

The clinic ran on one spreadsheet: a grid of color-coded cells, maintained by
hand, that broke down the moment a technician called out. This keeps the same
mental model — **rooms and time slots forming a grid, one assignment per cell** —
but makes the moves cheap.

The key concept is **master schedule + daily overrides**:

- The **master schedule** is where each team usually sits, by day of the week.
- A **daily override** is a one-off change for a specific date (someone's out,
  someone covers).
- Any cell resolves by checking overrides first, then falling back to the
  master — so a call-out is a _single-cell change_, and the next day snaps back
  to normal automatically.

## Features

- **Grid scheduler** across three daily sessions (AM / midday / PM), each with
  its own time blocks.
- **Master vs. daily-override** assignment model.
- **Auto-assign** pass that distributes teams across rooms without collisions.
- **Two roles** — an admin view for editing the master schedule and settings,
  and a technician view that shows just that person's day.
- **Room color-coding**, drag-and-drop cell editing, and per-day groups.
- Installable as a PWA.

## Run it

It's a static front end — no build step.

```bash
# any static server works
python3 -m http.server 8000
# then open http://localhost:8000
```

A fresh visit boots into **fictional demo data** (see `js/seed.js`); a real
clinic clears it and enters their own. All demo names are made up and clients
are shown as initials only.

## Architecture

Today the app is **vanilla JavaScript over `localStorage`** — deliberately
shipped without a backend first, to validate the master/override model with real
schedulers before committing to a server.

```
js/
  state.js     app state + localStorage persistence (+ demo seed on first run)
  data.js      assignment resolution, auto-assign, room helpers
  views/       grid, edit-cell, technician view, settings, role select
  seed.js      fictional demo data for the static build
```

The planned backend (see [`ARCHITECTURE.md`](ARCHITECTURE.md)) keeps the front
end as-is and swaps only the storage layer: **Express + SQLite** on a Raspberry
Pi at the clinic, behind **Caddy** for automatic HTTPS, with **WebSockets** for
live multi-user sync and per-user logins.

---

_Demo data is entirely fictional. This tool is a scheduling aid, not a system of
record._
