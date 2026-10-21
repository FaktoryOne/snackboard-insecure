# The attack-probe suite

A probe is one attack, written down, that you can re-run forever.

You start with eleven probes that all go red against Snackboard as shipped.
From there you add your own — one for every finding you make, on this app or
on your own.

**No test framework, no dependencies, no install.** Plain Node 20 or newer, and
`node` is the only thing you need. That is deliberate: the point of the session
is the attack you write, not twenty minutes of `npm install` on a laptop you do
not control.

## Rules of engagement

Run these only against an application you own, or one you have **written**
permission to test. Snackboard runs on your machine; nothing in this directory
touches anything else. Do not point `PROBE_TARGET` at a host you do not own.

## Point it at your own app

Two lines. Copy the directory in, and tell the runner where your app is:

```bash
cp -r probe /path/to/your-app/probe
cd /path/to/your-app && PROBE_TARGET=http://127.0.0.1:8000 node probe/run.mjs --dir yours
```

`--dir yours` runs `probe/yours/`, which is where you write your probes.
`probe/probes/` is Snackboard's eleven and will not mean anything against your
app, so leave it alone or delete it.

Your app does **not** need a health endpoint, a login route, or any particular
language — the suite speaks HTTP and nothing else. It was rehearsed against a
Python app with none of the three.

Nothing else needs changing unless a probe of yours needs to be logged in. When
one does, add `sessions: true` to it and tell the runner who to log in as:

```bash
PROBE_USERS='alice=you@example.com:secret,bob=other@example.com:secret' \
  PROBE_LOGIN=/auth/login node probe/run.mjs --dir yours
```

`node probe/run.mjs --help` lists every knob. All of them are optional, and
every default describes Snackboard.

## Running

```bash
npm start                      # terminal 1: the app on :3000
npm run probe                  # terminal 2: Snackboard's eleven
npm run probe:yours            # just the probes you wrote
npm run probe:all              # both — this is the one S6 consolidates onto

npm run probe -- --list        # what the probes are, without running them
npm run probe -- --only A1,A2  # just these
npm run probe -- --verbose     # show evidence for the ones that passed too

npm run test:security          # start the app, probe, stop the app (for CI)
```

Exit codes: `0` every attack blocked · `1` an attack succeeded · `2` the suite
could not run (app unreachable, no probes, a probe threw, a login it needed
failed). A `2` never means "you are fine" — it means the run proved nothing.

## Reading the output

```
VULN A1   Alice reads Bob's user record by guessing the id
     Authorization — IDOR on a read route
     GET /api/users/2 as Alice returned 200 with bob@example.com and a password hash
```

`VULN` means the attack worked. `ok` means it was blocked. `SKIP` means the
probe could not reach a conclusion, which is **not** the same as blocked. The
suite is **green when every attack fails** — it asserts the absence of a
vulnerability, not the presence of a feature.

## Writing your own

Copy `yours/_template.mjs` to `yours/01-whatever.mjs`, delete the `skip` line
and write the attack. Any `.mjs` in the directory that does not start with `_`
is picked up automatically.

```js
export default {
  id: 'Y1',
  title: 'What an attacker gets to do if this works',
  topic: 'Which lesson this belongs to',
  kind: 'http', // 'http' = needs the app running; 'static' = reads the repo
  sessions: true, // only if the attack needs to be logged in
  async attack({ alice, bob, admin }) {
    const res = await get('/api/thing/2', { session: alice })
    return { worked: res.status === 200, evidence: `returned ${res.status}` }
  },
}
```

Three rules that make a probe worth keeping:

1. **Assert that the attack fails**, never that the feature works. A probe that
   goes green before you have fixed anything is guarding nothing.
2. **Run it red first.** If you cannot see it fail, you do not know it works.
   Put the old code back on a scratch branch, run the probe, watch it go red,
   then restore the fix. Restart your app after you change the code — a probe
   run against a server still holding the old process tells you nothing.
3. **One attack per probe.** When it goes red you want to know exactly what
   came back.

`ctx` gives you the logged-in identities you configured — `alice`, `bob` and
`admin` on Snackboard. You need at least two to prove that one user cannot
reach another's data.

## Wiring it into CI

Copy `.github/workflows/security-probes.yml` and the `test:security` script
from `package.json`. The workflow runs Snackboard's eleven; point it at your
own probes with `PROBE_DIR=yours`, or at both with `PROBE_DIR=probes,yours`.
