import { get, post } from '../lib/client.mjs'

export default {
  id: 'A4',
  title: 'Alice sends a vote carrying Bob’s user id and the server accepts it',
  topic: 'Authorization — the write path takes identity from the request body',
  kind: 'http',
  sessions: true, // the attack needs a logged-in identity

  async attack({ alice }) {
    // Vote on a snack that is actually there. A3 deletes one every run, so a
    // hardcoded id eventually 404s — and a 404 would read as "the attack was
    // blocked", which is a green that guards nothing.
    const snacks = await get('/api/snacks')
    const snack = snacks.json?.[0]
    if (!snack) {
      return {
        skipped: true,
        evidence: 'no snacks left to vote on — restart the app and run again',
      }
    }

    // The UI never sends `userId` — the session already says who you are.
    // A server that accepts it is letting the client choose an identity.
    const res = await post(
      '/api/votes',
      { snackId: snack.id, userId: 2 },
      { session: alice },
    )

    const accepted = res.status >= 200 && res.status < 300
    return {
      worked: accepted,
      evidence: accepted
        ? `POST /api/votes {"snackId":${snack.id},"userId":2} as Alice returned ${res.status} — the extra identity field was not rejected`
        : `POST /api/votes with a smuggled userId returned ${res.status}`,
    }
  },
}
