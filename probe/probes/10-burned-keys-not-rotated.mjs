import { SECRET_PATTERNS, fingerprint, git, readRepoFile } from '../lib/repo.mjs'

const LEDGER = 'SECURITY-ROTATIONS.md'

export default {
  id: 'S2',
  title: 'A credential that was once committed has never been recorded as rotated',
  topic: 'Secrets — deleting a key does not unleak it',
  kind: 'static',

  async attack() {
    const history = git(['log', '-p', '--all', '--no-color'])
    if (!history) {
      return { skipped: true, evidence: 'git history unavailable here' }
    }

    // Collect every distinct credential-shaped string that has ever been
    // committed, including ones deleted long ago.
    const found = new Map() // fingerprint -> pattern name
    for (const { name, re } of SECRET_PATTERNS) {
      for (const value of history.match(new RegExp(re.source, 'g')) ?? []) {
        found.set(fingerprint(value), name)
      }
    }
    if (found.size === 0) {
      return { worked: false, evidence: 'no credential-shaped strings anywhere in history' }
    }

    // You cannot un-leak a key that is already in somebody's clone. What you
    // can do is rotate it and write down that you did. The ledger records a
    // SHA-256 fingerprint, never the key itself.
    const ledger = readRepoFile(LEDGER) ?? ''
    const unrecorded = [...found].filter(([fp]) => !ledger.includes(fp))

    return {
      worked: unrecorded.length > 0,
      evidence:
        unrecorded.length > 0
          ? `${unrecorded.length} of ${found.size} committed credential(s) have no rotation entry in ${LEDGER}: ${[
              ...new Set(unrecorded.map(([, name]) => name)),
            ].join(', ')}`
          : `all ${found.size} committed credential(s) are recorded as rotated in ${LEDGER}`,
    }
  },
}
