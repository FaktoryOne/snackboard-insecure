// Tiny HTTP helper for probes. No dependencies — Node has fetch built in.

// 127.0.0.1 rather than `localhost`. The API binds loopback IPv4 only, and on a
// machine where `localhost` resolves to ::1 first, every probe would fail to
// connect — which looks like a broken suite rather than an unreachable app.
// Override with PROBE_TARGET when the app is somewhere else.
export const TARGET = (process.env.PROBE_TARGET ?? 'http://127.0.0.1:3000').replace(
  /\/$/,
  '',
)

/**
 * Send a request to the target and return everything a probe needs to judge
 * the result: status, headers, parsed body (when it is JSON) and raw text.
 *
 * `session` is a session token string, or null for an anonymous request.
 */
export async function request(method, path, { session = null, body = null } = {}) {
  const headers = {}
  if (body !== null) headers['Content-Type'] = 'application/json'
  if (session) headers.Cookie = `session=${session}`

  const res = await fetch(`${TARGET}${path}`, {
    method,
    headers,
    body: body === null ? undefined : JSON.stringify(body),
    redirect: 'manual',
  })

  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    // Not JSON. `text` is still available to the probe.
  }
  return { status: res.status, headers: res.headers, text, json }
}

export const get = (path, opts) => request('GET', path, opts)
export const post = (path, body, opts) => request('POST', path, { ...opts, body })
export const del = (path, opts) => request('DELETE', path, opts)

/**
 * Log in and return the session token. Throws if the credentials are wrong,
 * so a broken probe run fails loudly instead of silently testing nothing.
 */
export async function loginAs(email, password) {
  const res = await fetch(`${TARGET}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    throw new Error(`login failed for ${email}: HTTP ${res.status}`)
  }
  const cookie = res.headers.get('set-cookie') ?? ''
  const match = cookie.match(/session=([a-f0-9]+)/)
  if (!match) throw new Error(`login for ${email} returned no session cookie`)
  return match[1]
}

/** Wait until the target answers /health, or give up. */
export async function waitForTarget({ timeoutMs = 20000, intervalMs = 250 } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${TARGET}/health`)
      if (res.ok) return true
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return false
}
