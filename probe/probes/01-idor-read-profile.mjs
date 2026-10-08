import { get } from '../lib/client.mjs'

export default {
  id: 'A1',
  title: "Alice reads Bob's user record by guessing the id",
  topic: 'Authorization — IDOR on a read route',
  kind: 'http',

  async attack({ alice }) {
    const res = await get('/api/users/2', { session: alice })
    const leaked = res.status === 200 && res.json?.email === 'bob@example.com'
    return {
      worked: leaked,
      evidence: leaked
        ? `GET /api/users/2 as Alice returned 200 with ${res.json.email}` +
          (res.json.password_hash ? ' and a password hash' : '')
        : `GET /api/users/2 as Alice returned ${res.status}`,
    }
  },
}
