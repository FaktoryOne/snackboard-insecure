import { get } from '../lib/client.mjs'

export default {
  id: 'A2',
  title: "Alice reads Bob's private snack list",
  topic: 'Authorization — IDOR on a second read route',
  kind: 'http',

  async attack({ alice }) {
    const res = await get('/api/lists/2', { session: alice })
    const leaked = res.status === 200 && res.json?.user_id === 2
    return {
      worked: leaked,
      evidence: leaked
        ? `GET /api/lists/2 as Alice returned 200: "${res.json.name}" — ${res.json.note}`
        : `GET /api/lists/2 as Alice returned ${res.status}`,
    }
  },
}
