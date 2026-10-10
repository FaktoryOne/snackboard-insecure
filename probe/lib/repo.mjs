// Helpers for the probes that inspect the repository itself rather than the
// running app: leaked secrets, the lockfile, unused dependencies.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
)

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage'])
const SKIP_FILES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'])
const SOURCE_EXT = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.json'])

/** A stable, non-reversible fingerprint for a credential value. */
export function fingerprint(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

/** Every source file in the working tree, as absolute paths. */
export function sourceFiles(root = REPO_ROOT) {
  const out = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (SKIP_DIRS.has(entry) || SKIP_FILES.has(entry)) continue
      const full = path.join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (SOURCE_EXT.has(path.extname(full))) out.push(full)
    }
  }
  walk(root)
  return out
}

export function readRepoFile(relativePath) {
  const full = path.join(REPO_ROOT, relativePath)
  return existsSync(full) ? readFileSync(full, 'utf8') : null
}

export function repoFileExists(relativePath) {
  return existsSync(path.join(REPO_ROOT, relativePath))
}

/** Run a git command in the repo. Returns '' when git is unavailable. */
export function git(args) {
  try {
    return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' })
  } catch {
    return ''
  }
}

/**
 * Credential patterns. These match the *shape* of a credential, which is what
 * a scanner does. Extend this list with the shapes your own stack uses.
 */
export const SECRET_PATTERNS = [
  { name: 'Resend API key', re: /\bre_[A-Za-z0-9_]{16,}\b/ },
  { name: 'Stripe secret key', re: /\bsk_live_[A-Za-z0-9]{10,}\b/ },
  { name: 'Password in a connection URL', re: /\b[a-z+]+:\/\/[^\s:/@]+:[^\s:/@]+@/ },
  { name: 'AWS access key id', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Private key block', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
]
