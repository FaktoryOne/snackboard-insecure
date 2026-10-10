import path from 'node:path'
import { readFileSync } from 'node:fs'
import { REPO_ROOT, SECRET_PATTERNS, sourceFiles } from '../lib/repo.mjs'

export default {
  id: 'S1',
  title: 'A credential is sitting in the working tree',
  topic: 'Secrets — hardcoded credentials in source',
  kind: 'static',

  async attack() {
    const hits = []
    for (const file of sourceFiles()) {
      const text = readFileSync(file, 'utf8')
      for (const { name, re } of SECRET_PATTERNS) {
        const m = text.match(re)
        if (m) hits.push(`${name} in ${path.relative(REPO_ROOT, file)}`)
      }
    }

    return {
      worked: hits.length > 0,
      evidence:
        hits.length > 0
          ? `${hits.length} credential-shaped string(s) found: ${hits.join('; ')}`
          : 'no credential-shaped strings in the working tree',
    }
  },
}
