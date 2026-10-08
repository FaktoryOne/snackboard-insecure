import { post } from '../lib/client.mjs'

export default {
  id: 'A4',
  title: 'Alice sends a vote carrying Bob’s user id and the server accepts it',
  topic: 'Authorization — the write path takes identity from the request body',
  kind: 'http',

  async attack({ alice }) {
    // The UI never sends `userId` — the session already says who you are.
    // A server that accepts it is letting the client choose an identity.
    const res = await post('/api/votes', { snackId: 1, userId: 2 }, { session: alice })

    const accepted = res.status >= 200 && res.status < 300
    return {
      worked: accepted,
      evidence: accepted
        ? `POST /api/votes {"snackId":1,"userId":2} as Alice returned ${res.status} — the extra identity field was not rejected`
        : `POST /api/votes with a smuggled userId returned ${res.status}`,
    }
  },
}
