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

// The value on line 6 is a fake. It is shaped like a real classic token so the
// secret scanners have something true to find, but no such token has ever
// existed. The rotation exercise asks you to replace it with one of your own.
//
// Recognised by its marker word rather than by a second copy of the string: a
// second copy would be a decoy that the hand-hunt finds and that `S1` keeps
// flagging after you have replaced the real one. A GitHub token is 36
// characters of base62, so this can never match a token somebody actually has.
const PLACEHOLDER_MARKER = /PLACEHOLDER|SwapMeIn/i

/** A trimmed environment variable, treating blank as absent. */
function fromEnvironment(name) {
  const raw = process.env[name]
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * Where the practice credential is coming from right now.
 *
 * The environment wins over the source file, and that order is the whole of
 * what "deploy the replacement" means on this app. When you rotate, the new
 * value goes into a git-ignored `.env` — never back into the file the old one
 * came out of — and this function starts returning it after a restart.
 *
 * An exported-but-empty `GITHUB_TOKEN` counts as absent. The real environment
 * always wins over a `.env` file, so a stray `export GITHUB_TOKEN=` in a shell
 * profile would otherwise be read as a credential, and sending
 * `Authorization: Bearer ` earns the same `401 Bad credentials` that a revoked
 * token does. Reading that 401 as "my credential was refused" when the truth is
 * "I never sent one" is the single commonest way this exercise fools somebody.
 */
export function practiceCredential() {
  const fromEnv = fromEnvironment('GITHUB_TOKEN')
  if (fromEnv) {
    return { token: fromEnv, source: 'the GITHUB_TOKEN environment variable' }
  }
  if (GITHUB_TOKEN && !PLACEHOLDER_MARKER.test(GITHUB_TOKEN)) {
    return { token: GITHUB_TOKEN, source: 'src/lib/github.js' }
  }
  return { token: null, source: null }
}

/**
 * Ask GitHub whether the practice credential is one it still accepts.
 *
 * `GET /user` is the cheapest question you can ask: GitHub answers it for any
 * token it recognises, whatever that token is allowed to do — the response
 * carries `X-Accepted-GitHub-Permissions: allows_permissionless_access=true`.
 * So a token with no scopes at all still gets a 200, and a token that has been
 * revoked gets a 401. That is exactly the difference we want to see.
 *
 * Four outcomes, and no two of them mean the same thing. `verdict` is the word
 * the start-up line prints:
 *   - `not set`    nothing configured — the placeholder is still in place
 *   - `accepted`   GitHub accepts it (200)
 *   - `refused`    GitHub refuses it (401) — revoked, or never valid
 *   - `no answer`  we never got a reply — no network, DNS, proxy, timeout
 *
 * The fourth is the one people collapse into the third, and collapsing it is
 * how a room decides a live credential is dead. A request that never left the
 * laptop has not been refused by anybody.
 */
export async function checkGitHubConnection(token = undefined) {
  const resolved = token === undefined ? practiceCredential() : { token, source: 'the caller' }

  if (!resolved.token) {
    return {
      ok: false,
      configured: false,
      verdict: 'not set',
      source: null,
      status: null,
      login: null,
      scopes: null,
      detail:
        'no practice credential configured — src/lib/github.js still holds the placeholder, ' +
        'and GITHUB_TOKEN is not set. The repo import is disabled.',
    }
  }

  let res
  try {
    res = await fetch(`${GITHUB_API}/user`, {
      headers: {
        Authorization: `Bearer ${resolved.token}`,
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
      source: resolved.source,
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
      source: resolved.source,
      status: res.status,
      login: null,
      scopes,
      detail: `GitHub refused the token from ${resolved.source} (HTTP ${res.status})`,
    }
  }

  const body = await res.json().catch(() => ({}))
  return {
    ok: true,
    configured: true,
    verdict: 'accepted',
    source: resolved.source,
    status: res.status,
    login: body.login ?? null,
    scopes,
    detail:
      `GitHub accepts the token from ${resolved.source}, as ` +
      `${body.login ?? 'an unnamed account'}` +
      (scopes === '' ? ' — and it carries no scopes' : ''),
  }
}
