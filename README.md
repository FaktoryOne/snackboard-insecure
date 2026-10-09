# 🍿 Snackboard

A tiny snack-voting app. Browse snacks, vote for your favourites, and leave
reviews. Built fast with an AI assistant.

> [!WARNING]
> **Snackboard is deliberately insecure.** It is the practice codebase for the
> Agentic School module _Security Foundations for Vibe Coders_. It contains
> real, exploitable vulnerabilities on purpose. **Never deploy it, and never
> put real data or real secrets in it.** Run it locally only.

## Stack

- **API** — Express + SQLite (Node's built-in `node:sqlite`), in-memory and
  re-seeded on every start. Lives in `src/`.
- **Web** — React + Vite. Lives in `client/`.

## Running it

**Node 22 or Node 24 is required.** Those are the two versions the course is
taught and tested on. On any other version — including Node 23 — `npm install`
stops at once with an `EBADENGINE` error naming the versions above.

Everything Snackboard needs comes from the npm registry. There is no native
build step and nothing is downloaded from anywhere else, so the install works
behind a proxy that only allows the registry.

```bash
npm install        # installs the API and the web client (npm workspaces)
npm run dev         # API on http://localhost:3000, web on http://localhost:5173
```

Then open **http://localhost:5173**.

Both halves must be up. If either the API or the web server fails to start —
most often because something else already holds port 3000 — `npm run dev` stops
both and shows you the error. Free the port, or move both ends together:

```bash
PORT=3001 npm run dev   # API on 3001, and the web client proxies to 3001
```

The API binds **loopback only** (`127.0.0.1`), so nobody else on your network can
reach it. This matters: the app has an unauthenticated delete endpoint. To expose
it on purpose — for example for the port-scanning lesson — set `HOST`:

```bash
HOST=0.0.0.0 npm run server   # reachable from your whole network. Only do this knowingly.
```

To run just the API (it serves the built client if you've run `npm run build`):

```bash
npm start           # http://localhost:3000
```

## Seeded accounts

| Email               | Password      | Role  |
| ------------------- | ------------- | ----- |
| `alice@example.com` | `password123` | user  |
| `bob@example.com`   | `password123` | user  |
| `admin@example.com` | `admin123`    | admin |

The data resets every time you restart the server.

## What the API exposes

| Method & path              | What it does                       |
| -------------------------- | ---------------------------------- |
| `POST /api/login`          | Log in, sets a `session` cookie    |
| `POST /api/register`       | Create an account                  |
| `GET /api/me`              | The current user                   |
| `GET /api/users/:id`       | A user's profile                   |
| `GET /api/snacks`          | All snacks, most-voted first       |
| `GET /api/search?q=`       | Search snacks by name              |
| `POST /api/votes`          | Vote for a snack                   |
| `GET /api/reviews?snackId=`| Reviews for a snack                |
| `POST /api/reviews`        | Post a review                      |
| `DELETE /api/admin/snacks/:id` | Delete a snack                 |

## Your job

Work through the module's tutorials, exercises, and challenges against this
repo: find the leaked secrets, fix the access-control holes, stop the injection
attacks, threat-model the app, and build your pre-deploy checklist. Good luck.
