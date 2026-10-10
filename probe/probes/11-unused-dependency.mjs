import { readFileSync } from 'node:fs'
import { REPO_ROOT, readRepoFile, sourceFiles } from '../lib/repo.mjs'

// Packages that are legitimately never imported by name.
const ALLOWED_UNIMPORTED = new Set(['concurrently'])

export default {
  id: 'D1',
  title: 'The project declares dependencies that no source file imports',
  topic: 'Supply chain — code you ship but never use',
  kind: 'static',

  async attack() {
    const pkg = JSON.parse(readRepoFile('package.json'))
    const declared = Object.keys(pkg.dependencies ?? {})

    const allSource = sourceFiles(REPO_ROOT)
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n')

    const unused = declared.filter((name) => {
      if (ALLOWED_UNIMPORTED.has(name)) return false
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const imported = new RegExp(
        `(?:from\\s+['"]|require\\(\\s*['"]|import\\s+['"])${escaped}(?:/|['"])`,
      )
      return !imported.test(allSource)
    })

    return {
      worked: unused.length > 0,
      evidence:
        unused.length > 0
          ? `declared but never imported: ${unused
              .map((n) => `${n}@${pkg.dependencies[n]}`)
              .join(', ')}`
          : 'every declared dependency is imported somewhere',
    }
  },
}
