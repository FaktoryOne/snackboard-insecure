import { env } from '../env.js'

// The "import the team snack list from our GitHub repo" integration.
//
// The token comes from the environment. The one that used to be on this line
// is burned — see SECURITY-ROTATIONS.md.
const GITHUB_API = env.githubApi
const TIMEOUT_MS = env.githubTimeoutMs

/**
 * Ask GitHub whether `token` is still a credential it accepts.
 *
 * `GET /user` is the cheapest question you can ask: GitHub answers it for any
 * token it recognises, whatever that token is allowed to do — the response
 * carries `X-Accepted-GitHub-Permissions: allows_permissionless_access=true`.
 * So a token with no scopes at all still gets a 200, and a token that has been
 * revoked gets a 401. That is exactly the difference we want to see.
 *
 * Four outcomes, and no two of them mean the same thing:
 *   - `not set`    no token configured at all
 *   - `accepted`   GitHub accepts the token (200)
 *   - `refused`    GitHub refuses it (401) — revoked, or never valid
 *   - `no answer`  we never got a reply — no network, DNS, proxy, timeout.
 *                  This says nothing about the token.
 *
 * `verdict` is that word, and it is the one the start-up line prints. The
 * fourth outcome is the one people collapse into the third, and collapsing it
 * is how a room decides a live credential is dead: a request that failed to
 * leave the laptop has not been refused by anybody.
 */
export async function checkGitHubConnection(token = env.githubToken) {
  if (!token) {
    return {
      ok: false,
      configured: false,
      verdict: 'not set',
      status: null,
      login: null,
      scopes: null,
      detail: 'GITHUB_TOKEN is not set — the repo import is disabled',
    }
  }

  let res
  try {
    res = await fetch(`${GITHUB_API}/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'snackboard',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (err) {
    return {
      ok: false,
      configured: true,
      verdict: 'no answer',
      status: null,
      login: null,
      scopes: null,
      detail: `no answer from ${GITHUB_API} (${err.message}) — this tells you nothing about the token`,
    }
  }

  // Empty string = a token with no scopes. Absent = not an OAuth-scoped token
  // (a fine-grained token, or an installation token) — so we cannot say.
  const scopeHeader = res.headers.get('x-oauth-scopes')
  const scopes = scopeHeader === null ? null : scopeHeader.trim()

  if (!res.ok) {
    return {
      ok: false,
      configured: true,
      verdict: 'refused',
      status: res.status,
      login: null,
      scopes,
      detail: `GitHub refused the token (HTTP ${res.status})`,
    }
  }

  const body = await res.json().catch(() => ({}))
  return {
    ok: true,
    configured: true,
    verdict: 'accepted',
    status: res.status,
    login: body.login ?? null,
    scopes,
    detail:
      `GitHub accepts the token, as ${body.login ?? 'an unnamed account'}` +
      (scopes === '' ? ' — and it carries no scopes' : ''),
  }
}
