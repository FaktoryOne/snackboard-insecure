// Copy this file to write a probe of your own.
//
//   cp probe/yours/_template.mjs probe/yours/01-sql-injection-search.mjs
//   node probe/run.mjs --dir yours
//
// A probe describes ONE attack. `attack()` returns `{ worked, evidence }`:
//
//   worked: true   the attack succeeded — the app is vulnerable — run goes RED
//   worked: false  the attack was blocked — run stays GREEN
//
// Never assert "the app behaves correctly". Assert "the attack fails". That
// way the probe is red before your fix and green after it, which is the only
// proof that the probe actually guards the bug.
//
// Any .mjs in this directory that does not start with `_` is picked up
// automatically. Nothing to register.

import { get } from '../lib/client.mjs'

export default {
  id: 'Y1',
  title: 'What an attacker gets to do if this works',
  topic: 'the finding this pins down',
  kind: 'http', // 'http' needs the app running; 'static' reads the repository
  skip: true, // delete this line once you have written a real attack

  // Add `sessions: true` if the attack needs to be logged in, and tell the
  // runner who to log in as:
  //   PROBE_USERS='alice=you@example.com:secret,bob=other@example.com:secret'
  // Without it no login is attempted, which is what you want on an app whose
  // login route this suite does not know.

  async attack() {
    // Fire the payload at the sink you just fixed, and assert the safe answer.
    const payload = "' OR 1=1 --"
    const res = await get(`/api/search?q=${encodeURIComponent(payload)}`)
    const rows = Array.isArray(res.json) ? res.json : []

    return {
      worked: rows.length > 0,
      evidence: `GET /api/search returned ${res.status} with ${rows.length} rows`,
    }
  },
}
