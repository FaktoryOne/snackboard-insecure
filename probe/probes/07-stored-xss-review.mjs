import { get, post } from '../lib/client.mjs'

export default {
  id: 'V2',
  title: 'A review containing a script payload is stored and served back as live HTML',
  topic: 'Input validation — stored cross-site scripting',
  kind: 'http',

  async attack({ alice }) {
    // A payload that is inert as text and dangerous as HTML. Nothing here
    // contacts any third party; it is a marker string.
    const payload = '<img src=x onerror="window.__probe_xss=1">'

    const posted = await post(
      '/api/reviews',
      { snackId: 2, rating: 5, body: payload },
      { session: alice },
    )
    if (posted.status >= 400) {
      return {
        worked: false,
        evidence: `POST /api/reviews rejected the HTML payload with ${posted.status}`,
      }
    }

    const read = await get('/api/reviews?snackId=2')
    const rows = Array.isArray(read.json) ? read.json : []
    const stored = rows.find((r) => typeof r.body === 'string' && r.body.includes('onerror'))

    // The client renders review bodies with dangerouslySetInnerHTML, so a body
    // that still contains a live tag when it comes back out of the API will
    // execute in every viewer's browser.
    const live = Boolean(stored) && /<\s*img|<\s*script|onerror\s*=/i.test(stored.body)

    return {
      worked: live,
      evidence: live
        ? `the review came back from the API as raw HTML: ${stored.body.slice(0, 60)}…`
        : stored
          ? `the review came back neutralised: ${stored.body.slice(0, 60)}…`
          : 'the payload was not stored',
    }
  },
}
