import { post } from '../lib/client.mjs'

export default {
  id: 'V1',
  title: 'A review with an impossible rating, a snack that does not exist and a 100 kB body is stored',
  topic: 'Input validation — a write endpoint with no schema at the boundary',
  kind: 'http',

  async attack({ alice }) {
    const nonsense = {
      snackId: 999999, // no such snack
      rating: 9001, // the scale is 1–5
      body: 'A'.repeat(100_000), // no length limit
      isAdmin: true, // a field the endpoint never declared
    }
    const res = await post('/api/reviews', nonsense, { session: alice })

    const accepted = res.status >= 200 && res.status < 300
    return {
      worked: accepted,
      evidence: accepted
        ? `POST /api/reviews returned ${res.status} for rating=9001, snackId=999999, a 100 kB body and an undeclared isAdmin field`
        : `POST /api/reviews rejected the malformed payload with ${res.status}`,
    }
  },
}
