# 🍿 Snackboard — a deliberately vulnerable practice app

> [!CAUTION]
> **Read this before you run anything.**
>
> Snackboard is **deliberately insecure**. It is a training target, not a
> starting point for your own project. **Run it on your own machine only. Never
> deploy it to a URL anyone else can reach.**
>
> Specifically, as shipped, this app:
>
> - serves an unauthenticated debug route that returns your whole process
>   environment, every live session token and every user row;
> - lets any logged-in user read any other user's record and private lists;
> - lets anyone with no account at all delete data through the admin API;
> - builds SQL by pasting your input into the query string, so the search box
>   can be made to return the users table;
> - stores whatever you post as a review and serves it back as live HTML, so a
>   review can run script in another visitor's browser;
> - contains credential-shaped strings in its source and in its Git history.
>
> **Sandbox it.** Run it on a machine you control, on `localhost`, with no real
> data in it. Do not put a real API key, a real password, or a real customer's
> details anywhere near it. Do not run it on a shared or corporate host, and do
> not point any scanner at anything other than your own copy.
>
> Every credential-shaped string in this repository is a **fake placeholder**.
> None of them is live, and none of them has ever been live.

A tiny snack-voting app: browse snacks, vote for your favourites, leave
reviews. It was built fast with an AI assistant, it works, and it is riddled
with the flaws that come with building fast. That is the point — you are going
to find them and fix them.

## Running it

**Node 22 or Node 24 is required.** Those are the two versions the course is
taught and tested on. On any other version — including Node 23 — `npm install`
stops at once with an `EBADENGINE` error naming the versions above.

Everything Snackboard needs comes from the npm registry. There is no native
build step and nothing is downloaded from anywhere else, so the install works
behind a proxy that only allows the registry.

```bash
npm install
npm run dev     # API on http://localhost:3000, web on http://localhost:5173
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

To run just the API (it serves the built client if you have run `npm run build`):

```bash
npm start       # http://localhost:3000
```

The database is in-memory SQLite and is re-seeded on every start, so you can
break it as thoroughly as you like and get a clean slate by restarting.

## Seeded accounts

| Email               | Password      | Role  |
| ------------------- | ------------- | ----- |
| `alice@example.com` | `password123` | user  |
| `bob@example.com`   | `password123` | user  |
| `admin@example.com` | `admin123`    | admin |

You need **two** identities to prove that one user cannot reach another's data.
Alice and Bob are there for exactly that.

## The attack-probe suite

```bash
npm start              # terminal 1
npm run probe          # terminal 2 — every attack, one command
npm run test:security  # starts the app, probes it, shuts it down (for CI)
```

It exits non-zero when an attack succeeds, so it fails a build. As shipped,
every probe goes red. Your job over the next two days is to turn them green,
and to add your own. See [`probe/README.md`](probe/README.md).

## What the API exposes

| Method & path                  | What it does                    |
| ------------------------------ | ------------------------------- |
| `GET /health`                  | Readiness check                 |
| `POST /api/login`              | Log in, sets a `session` cookie |
| `POST /api/register`           | Create an account               |
| `GET /api/me`                  | The current user                |
| `GET /api/users/:id`           | A user's profile                |
| `GET /api/snacks`              | All snacks, most-voted first    |
| `GET /api/search?q=`           | Search snacks by name           |
| `GET /api/lists`               | Your private snack lists        |
| `GET /api/lists/:id`           | One private snack list          |
| `POST /api/votes`              | Vote for a snack                |
| `GET /api/reviews?snackId=`    | Reviews for a snack             |
| `POST /api/reviews`            | Post a review                   |
| `DELETE /api/admin/snacks/:id` | Delete a snack                  |

This table is the one the original developer wrote. Part of the exercise is
finding out whether it is complete.

## Stack

- **API** — Express + SQLite (Node's built-in `node:sqlite`), in-memory,
  re-seeded on every start. Lives in `src/`. No native build step, so the
  install needs nothing but the npm registry.
- **Web** — React + Vite. Lives in `client/`.
- **Probes** — plain Node, no dependencies. Lives in `probe/`.

## Your job

Work through the course against this repo: find the leaked credentials, close
the access-control holes, stop the injection, put a schema at every write
boundary, audit what you installed, and turn every finding into a probe that
fails the build if it ever comes back.
