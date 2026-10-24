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
tokens → Tokens (classic) → Generate new token. Set **Expiration** to 30 days —
not "no expiration", so that if anything goes wrong with the rest of this the
credential still dies by itself — and give it a name you will recognise on the
day, like `vibe-veilig-practice-rotate`.

On the course, this is **pre-work**: you make it and plant it a few days before
the day, not in the room. That is deliberate. It is the one prerequisite nobody
else can check for you — only you can find out whether your employer's GitHub
policy lets you create a token — and finding that out a week early is the
difference between a fixable problem and a wasted session. **If any of this is
blocked for you, say so before the day.**

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
> `git checkout -b security/secrets-cleanup` — and do not `git push` it. The
> token is powerless, so this is hygiene rather than an emergency, but the habit
> is the thing being taught. If you push it by accident, say so and make a new
> one: it costs a minute, the old one can do nothing, and GitHub may well have
> revoked it for you already.

### Planting it

**The file is `src/lib/github.js`. The line is line 6**, the one that reads:

```js
export const GITHUB_TOKEN = 'ghp_PLACEHOLDERnotArealTokenSwapMeIn0000'
```

Replace that placeholder string with your own token — keep the quotes, keep the
rest of the line — and commit it, as carelessly as the original developer would
have:

```bash
git checkout -b security/secrets-cleanup
# edit src/lib/github.js, line 6
git commit -am "wire up the repo import"
```

It is now in your working tree *and* in your history, which is what the manual
hunt and the history scan are for. `npm run probe -- --only S1,S2` will find it.

**Commit this branch locally and do not push it.** The token is powerless, so
this is hygiene rather than an emergency, but the habit is the thing being
taught.

### Verifying the app runs on it

The integration is checked on start-up, and on demand:

```bash
npm start
# [github] practice credential: accepted — GitHub accepts the token from
# src/lib/github.js, as your-username — and it carries no scopes
```

The start-up line always prints exactly one of four words, and the app starts
either way — it never refuses to boot because of this credential:

| Word | What it means |
| --- | --- |
| `not set` | Nothing is configured. Line 6 still holds the placeholder and `GITHUB_TOKEN` is unset. This is the normal state before you plant anything |
| `accepted` | GitHub answered `200`. The line also says **where** the value came from, which is what you watch change when you rotate |
| `refused` | GitHub answered `401`. Revoked, or never valid. **This is the line the rotation exercise is looking for** |
| `no answer` | The request never got a reply — no network, DNS, a proxy, a timeout. This says **nothing** about the token |

Those last two are kept apart on purpose. A request that never left your laptop
has not been refused by anybody, and reading one as the other is how a room
decides a live credential is dead.

The same check is available on demand:

```bash
curl -s http://127.0.0.1:3000/api/integrations/github | python3 -m json.tool
```

`200` with `"ok": true` means GitHub accepts the token. `503` means it does
not — but read `verdict` and `status` in the body before you conclude anything:
`"refused"` with `401` is GitHub refusing the token, and `"no answer"` with
`null` is your wifi.

The answer is cached for ten seconds and says so in `"cached"`. If you need a
fresh one, restart the app — which is what the rotation exercise has you do
anyway, and why **the start-up line, not this route, is the thing you read for
"verify"**. On the fixed version of this app the route needs an admin session;
here it needs nothing, which is itself one of the things wrong with it.

> [!NOTE]
> **Your `.env` is loaded into this process, and this app has a debug route that
> hands the environment to anyone who asks.** That route is one of the flaws you
> are here to find, so it is still there — but it **masks values whose variable
> name looks like a credential**, including your practice token and anything
> else your shell exports. That mask is the one place this app is deliberately
> careful, it is commented as such in `src/index.js`, and it is not part of the
> flaw. You are committing a powerless token on purpose; that was never meant to
> put the rest of your environment on the network.

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

**Issue, deploy, verify, revoke.** Any other order gives you an outage, or a
still-open leak, or both.

1. **Issue.** Create a second scopeless token on the same GitHub page.
2. **Deploy.** Put it in a git-ignored `.env`, **not** back into
   `src/lib/github.js` where the old one came from. That file is the leak you
   are closing; putting the replacement into it closes nothing.

   ```bash
   cp .env.example .env     # if you have not already
   # set GITHUB_TOKEN=ghp_your_new_token in .env
   ```

   A value in `.env` wins over the one on line 6, so the restart is what makes
   it live. That precedence is the whole mechanism — the old value can stay on
   line 6 for now, and the app will stop using it.
3. **Verify.** Restart and read the start-up line. It should say `accepted`
   **and name the environment variable** as the source:

   ```bash
   npm start
   # [github] practice credential: accepted — GitHub accepts the token from
   # the GITHUB_TOKEN environment variable, as your-username
   ```

   If it still names `src/lib/github.js`, your `.env` is not being read and you
   have not deployed anything yet. Fix that before step 4. **This step is the
   only thing standing between the right order and an outage.**
4. **Revoke.** *Only now* delete the first token at GitHub: profile menu →
   **Settings** → **Developer settings** → **Personal access tokens** →
   **Tokens (classic)**, and the button to the right of the token is **Delete**.
   Not "stop using it", not "remove it from the code" — delete it, so the
   provider itself refuses it.

> [!WARNING]
> **Do not revoke first**, even though revoking is the satisfying part. On this
> credential it is harmless, which is exactly why it is worth getting right
> here: a hand that practises the wrong order in a safe room practises it on
> Monday on something a customer is using.

### Reading the refusal

One command, run twice, two different numbers. This is the artifact of the
exercise: a status code you wrote down, not a belief about what happened.

```bash
read -rs OLD_TOKEN
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer $OLD_TOKEN" https://api.github.com/user
```

`read -rs` prints no prompt and echoes nothing — it looks like a hung terminal,
but it is waiting. Paste the token and press Enter. On Windows PowerShell:

```powershell
$OLD_TOKEN = Read-Host "token"
curl.exe -s -o NUL -w "%{http_code}`n" -H "Authorization: Bearer $OLD_TOKEN" https://api.github.com/user
```

Run it **before** you revoke anything, with the value that is in your config
right now. You want **200**. Then run the identical command after step 4, with
the same old value. You want **401**.

> [!IMPORTANT]
> **Get the 200 first, and it matters more than the 401.** GitHub answers `401
> Bad credentials` to a request carrying an *empty* credential in exactly the
> same words it uses for a revoked one — we checked, and an empty `OLD_TOKEN`
> really does return `401`. So a mistyped variable name, a fresh terminal tab,
> or a `read` you answered by pressing Enter all produce a confident `401` that
> proves nothing at all. The `200` is what proves the command was ever carrying
> your credential. Without it, the number on your card is not evidence.

Anything other than `200` or `401` — `000`, a timeout, a `403` — means you have
not learned that the token is dead, you have learned that you could not get a
straight answer out of GitHub. Fix that and run it again.

When you are done, drop the value from your shell:

```bash
unset OLD_TOKEN
```

Pasting a credential into a terminal is the one place it is reasonable to do;
leaving it in a shell variable for the rest of the day is not.

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
