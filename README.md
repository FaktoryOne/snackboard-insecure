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
>
> The rotation exercise asks you to put **one real credential of your own** into
> `src/lib/github.js` on purpose. Read [The practice
> credential](#the-practice-credential) before you do — it must be a GitHub
> token with **no scopes**, and the branch you commit it to is never pushed.

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

## The practice credential

The secrets lesson ends with **rotation**, and its check is a number, not a
feeling: *make a request with the old credential and confirm it is rejected.*
Neither credential Snackboard ships can give you that number.

- The Postgres URL in `src/db.js` is pointed at a database that **does not
  exist**. The app runs on in-memory SQLite. There is nothing to rotate and
  nothing to ask.
- The Resend key in `src/lib/email.js` is a fake placeholder, and a real one
  would belong to **us**, not to you. You cannot revoke someone else's key, and
  you should not try.

So you bring your own. One token, on your own GitHub account, that you create
and destroy yourself.

### What it is, and what it can do

Create a **classic personal access token** on your own GitHub account with
**no scopes ticked at all** — Settings → Developer settings → Personal access
tokens → Tokens (classic) → Generate new token. Give it a 7-day expiry and a
name you will recognise, like `snackboard-practice`.

**What that token can do: read the public information about your account that
anyone can already read without logging in. That is the whole list.** A token
with no scopes cannot read a private repository, push a commit, open an issue,
read your private email addresses, or do anything at all inside an
organisation. That is why it is safe to deliberately commit — and it is the
only kind of credential this exercise is safe with.

> [!WARNING]
> **Do not use the token you use for `git push`.** That one has write access to
> your repositories. Create a second, scopeless one for this, and check the
> scope boxes are all empty before you click Generate.
>
> **Never push the branch you plant it on.** Work on a local branch —
> `git checkout -b security/rotation-practice` — and do not `git push` it. The
> token is powerless, so this is hygiene rather than an emergency, but the habit
> is the thing being taught.

### Planting it

Replace the placeholder in `src/lib/github.js` with your token and commit it, as
carelessly as the original developer would have:

```bash
git checkout -b security/rotation-practice
# edit src/lib/github.js
git commit -am "wire up the repo import"
```

It is now in your working tree *and* in your history, which is what the manual
hunt and the history scan are for. `npm run probe -- --only S1,S2` will find it.

### Verifying the app runs on it

The integration is checked on start-up, and on demand:

```bash
npm start
# [github] GitHub accepts the token, as your-username — and it carries no scopes

curl -s http://127.0.0.1:3000/api/integrations/github | python3 -m json.tool
```

`200` with `"ok": true` means GitHub accepts the token. `503` means it does
not — but read `status` in the body before you conclude anything: `401` is
GitHub refusing the token, and `null` is "we never got an answer", which is your
wifi and says nothing about the credential. Confusing those two is how people
decide a key is dead when it is not.

To prove to yourself that the token really is powerless, ask GitHub what it is
allowed to do. An empty answer is the answer you want:

```bash
read -rsp 'token: ' T; echo; curl -s -D - -o /dev/null -H "Authorization: Bearer $T" https://api.github.com/user | grep -i '^x-oauth-scopes:'; unset T
```

`x-oauth-scopes:` with nothing after it means the token has no scopes: that is
the whole of what it is permitted to do, written by GitHub rather than by us.
**No output at all** means GitHub did not recognise the token — it sends that
header only to a caller it has authenticated.

### Rotating it, in the order that matters

**Issue, deploy, verify, revoke.** Create a second scopeless token, put it in
`src/lib/github.js`, restart, confirm the start-up line names your account
again — and only then delete the first token at GitHub.

### Reading the refusal

One request, once. This is the artifact of the exercise: a status code you
wrote down, not a belief about what happened.

```bash
read -rsp 'old token: ' T; echo; curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $T" https://api.github.com/user; unset T
```

`200` while the old token is live. `401` once you have revoked it. **Write the
number down.** If you get anything else — `000`, or a timeout — you have not
learned that the token is dead, you have learned that you could not reach
GitHub. Fix that first and run it again.

It prompts for the token rather than taking it on the command line so that the
value does not end up in your shell history, and `unset` drops it afterwards.
Pasting a credential into a terminal is the one place it is reasonable to do;
leaving it in `~/.bash_history` is not.

> [!NOTE]
> **Run that line by hand, once, and leave it there.** It does not belong in
> your probe suite or in any script that runs on every build: a check that fires
> a revoked credential at a provider on every push is noise, and a dead token
> sitting in a repository is a thing somebody has to explain later. The probe
> that *is* worth keeping is `S2` — it checks that you wrote the rotation down.

### Writing it down

`S2` goes green when every credential your history has ever contained has a
SHA-256 fingerprint recorded in `SECURITY-ROTATIONS.md`. Create that file and
add your old token to it:

```bash
printf '%s' 'ghp_the_token_you_just_revoked' | sha256sum | cut -c1-16
npm run probe -- --only S2
```

The fingerprint, never the token. The point of the ledger is that it proves you
handled the key without putting it back into the repository.

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
| `GET /api/integrations/github` | Is the GitHub token still live? |
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
