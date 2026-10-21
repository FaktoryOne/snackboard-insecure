// The "import the team snack list from our GitHub repo" integration.
//
// Only the connection check is actually wired up — the import itself is still
// on the board. Handy anyway: it tells us whether the token still works.
// TODO: move this to an environment variable before we launch.
export const GITHUB_TOKEN = 'ghp_PLACEHOLDERnotArealTokenSwapMeIn0000'

// Overridable so the check can be pointed at a stub when there is no network.
const GITHUB_API = process.env.GITHUB_API ?? 'https://api.github.com'

// Short, because this runs on the way up and on a page load. A training room's
// wifi is not a reason for the app to hang.
const TIMEOUT_MS = Number(process.env.GITHUB_TIMEOUT_MS ?? 4000)

/**
 * Ask GitHub whether `token` is still a credential it accepts.
 *
 * `GET /user` is the cheapest question you can ask: GitHub answers it for any
 * token it recognises, whatever that token is allowed to do — the response
 * carries `X-Accepted-GitHub-Permissions: allows_permissionless_access=true`.
 * So a token with no scopes at all still gets a 200, and a token that has been
 * revoked gets a 401. That is exactly the difference we want to see.
 *
 * Three outcomes, and the third is not the second:
 *   - `{ ok: true,  status: 200 }`   GitHub accepts the token
 *   - `{ ok: false, status: 401 }`   GitHub refuses it — revoked, or never valid
 *   - `{ ok: false, status: null }`  we never got an answer — no network, DNS,
 *                                    proxy, timeout. This says nothing about
 *                                    the token.
 */
export async function checkGitHubConnection(token = GITHUB_TOKEN) {
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
      status: res.status,
      login: null,
      scopes,
      detail: `GitHub refused the token (HTTP ${res.status})`,
    }
  }

  const body = await res.json().catch(() => ({}))
  return {
    ok: true,
    status: res.status,
    login: body.login ?? null,
    scopes,
    detail:
      `GitHub accepts the token, as ${body.login ?? 'an unnamed account'}` +
      (scopes === '' ? ' — and it carries no scopes' : ''),
  }
}
