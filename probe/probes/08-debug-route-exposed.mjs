import { get } from '../lib/client.mjs'

export default {
  id: 'E1',
  title: 'An undocumented debug route hands out the environment and every session token',
  topic: 'Exposure — a route nobody meant to ship',
  kind: 'http',

  async attack() {
    const res = await get('/api/__debug/state') // no session
    const exposed = res.status === 200 && res.json !== null

    const what = []
    if (res.json?.env) what.push('process environment')
    if (res.json?.sessions) what.push('live session tokens')
    if (res.json?.users) what.push('every user row')

    return {
      worked: exposed,
      evidence: exposed
        ? `GET /api/__debug/state returned 200 to an anonymous caller with ${what.join(', ')}`
        : `GET /api/__debug/state returned ${res.status}`,
    }
  },
}
