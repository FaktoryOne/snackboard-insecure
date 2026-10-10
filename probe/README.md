# The attack-probe suite

A probe is one attack, written down, that you can re-run forever.

You start with eleven probes that all go red against Snackboard as shipped.
From day 2 session 3 onwards you add your own — one for every finding you make,
on this app or on your own.

## Rules of engagement

Run these only against an application you own, or one you have **written**
permission to test. Snackboard runs on your machine; nothing in this directory
touches anything else. Do not point `PROBE_TARGET` at a host you do not own.

## Running

```bash
npm start                      # terminal 1: the app on :3000
npm run probe                  # terminal 2: every probe

npm run probe -- --list        # what the probes are, without running them
npm run probe -- --only A1,A2  # just these
npm run probe -- --verbose     # show evidence for the ones that passed too

npm run test:security          # start the app, probe, stop the app (for CI)
```

Exit codes: `0` every attack blocked · `1` an attack succeeded · `2` the suite
could not run (app unreachable, or a probe threw).

## Reading the output

```
VULN A1   Alice reads Bob's user record by guessing the id
     Authorization — IDOR on a read route
     GET /api/users/2 as Alice returned 200 with bob@example.com and a password hash
```

`VULN` means the attack worked. `ok` means it was blocked. The suite is
**green when every attack fails** — it asserts the absence of a vulnerability,
not the presence of a feature.

## Writing your own

Copy `probes/_template.mjs` to `probes/12-whatever.mjs`, delete the `skip` line
and write the attack. Any `.mjs` in `probes/` that does not start with `_` is
picked up automatically.

```js
export default {
  id: 'A5',
  title: 'What an attacker gets to do if this works',
  topic: 'Which lesson this belongs to',
  kind: 'http', // 'http' = needs the app running; 'static' = reads the repo
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
3. **One attack per probe.** When it goes red you want to know exactly what
   came back.

`ctx` gives you three logged-in sessions: `alice`, `bob` and `admin`. You need
at least two identities to prove that one user cannot reach another's data.

## Taking it to your own repository

`probe/` has no dependencies — it is plain Node 20+. Copy the whole directory
into your project, delete the probes that do not apply, keep `lib/`, and change
the seeded logins in `run.mjs` to two accounts in your own system. Then copy
`.github/workflows/security-probes.yml` and the `test:security` script from
`package.json`.
