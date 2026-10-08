// Copy this file to add a probe of your own.
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
// Rename the file to something like `12-my-attack.mjs` and it is picked up
// automatically. Nothing else to register.

import { get } from '../lib/client.mjs'

export default {
  id: 'T0',
  title: 'Template — rename me',
  topic: 'your finding',
  kind: 'http', // 'http' needs the app running; 'static' reads the repo
  skip: true, // delete this line once you have written a real attack

  async attack({ alice, bob, admin }) {
    const res = await get('/api/me', { session: alice })
    return {
      worked: false,
      evidence: `GET /api/me returned ${res.status}`,
    }
  },
}
