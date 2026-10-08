#!/usr/bin/env node
//
// Snackboard attack-probe runner.
//
//   npm run probe              run every probe against http://localhost:3000
//   npm run probe -- --list    list the probes without running them
//   npm run probe -- --only A1,S2
//   PROBE_TARGET=http://localhost:4000 npm run probe
//
// Exit code 0 = every attack was blocked.
// Exit code 1 = at least one attack succeeded. This is what fails your build.
//
// Only ever point this at an application you own or have written permission
// to test.

import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TARGET, loginAs, waitForTarget } from './lib/client.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PROBE_DIR = path.join(HERE, 'probes')

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(name)
const value = (name) => {
  const i = argv.indexOf(name)
  return i === -1 ? null : argv[i + 1]
}

const C = process.stdout.isTTY
  ? { red: '\x1b[31m', green: '\x1b[32m', grey: '\x1b[90m', bold: '\x1b[1m', off: '\x1b[0m' }
  : { red: '', green: '', grey: '', bold: '', off: '' }

async function loadProbes() {
  const files = readdirSync(PROBE_DIR)
    .filter((f) => f.endsWith('.mjs') && !f.startsWith('_'))
    .sort()

  const probes = []
  for (const file of files) {
    const mod = await import(path.join(PROBE_DIR, file))
    const probe = mod.default
    if (!probe?.id || typeof probe.attack !== 'function') {
      throw new Error(`${file} does not export a probe with an id and an attack()`)
    }
    probes.push({ ...probe, file })
  }
  return probes
}

async function main() {
  let probes = await loadProbes()

  const only = value('--only')
  if (only) {
    const wanted = new Set(only.split(',').map((s) => s.trim()))
    probes = probes.filter((p) => wanted.has(p.id))
  }

  if (flag('--list')) {
    for (const p of probes) {
      console.log(`${p.id.padEnd(4)} ${p.kind.padEnd(7)} ${p.title}`)
    }
    return 0
  }

  const needsApp = probes.some((p) => p.kind === 'http' && !p.skip)
  const ctx = {}

  if (needsApp) {
    console.log(`${C.grey}target: ${TARGET}${C.off}`)
    if (!(await waitForTarget())) {
      console.error(
        `${C.red}Could not reach ${TARGET}/health.${C.off}\n` +
          `Start the app first:  npm start\n` +
          `Or point the runner elsewhere:  PROBE_TARGET=http://localhost:4000 npm run probe`,
      )
      return 2
    }
    // Two identities. You need two to prove one cannot reach the other's data.
    ctx.alice = await loginAs('alice@example.com', 'password123')
    ctx.bob = await loginAs('bob@example.com', 'password123')
    ctx.admin = await loginAs('admin@example.com', 'admin123')
  }

  console.log()
  let vulnerable = 0
  let blocked = 0
  let skipped = 0
  let errored = 0

  for (const probe of probes) {
    if (probe.skip) {
      skipped++
      console.log(`${C.grey}SKIP${C.off} ${probe.id.padEnd(4)} ${probe.title}`)
      continue
    }

    let result
    try {
      result = await probe.attack(ctx)
    } catch (err) {
      errored++
      console.log(`${C.red}ERR ${C.off} ${probe.id.padEnd(4)} ${probe.title}`)
      console.log(`     ${C.grey}${err.message}${C.off}`)
      continue
    }

    if (result?.skipped) {
      skipped++
      console.log(`${C.grey}SKIP${C.off} ${probe.id.padEnd(4)} ${probe.title}`)
      console.log(`     ${C.grey}${result.evidence ?? ''}${C.off}`)
      continue
    }

    if (result?.worked) {
      vulnerable++
      console.log(`${C.red}VULN${C.off} ${probe.id.padEnd(4)} ${probe.title}`)
      console.log(`     ${C.grey}${probe.topic}${C.off}`)
      console.log(`     ${result.evidence}`)
    } else {
      blocked++
      console.log(`${C.green}ok  ${C.off} ${probe.id.padEnd(4)} ${probe.title}`)
      if (flag('--verbose')) console.log(`     ${C.grey}${result?.evidence ?? ''}${C.off}`)
    }
  }

  console.log()
  console.log(
    `${C.bold}${blocked} blocked, ${vulnerable} succeeded, ${skipped} skipped, ${errored} errored${C.off}`,
  )

  if (errored > 0) {
    console.log(`${C.red}A probe threw. Fix the probe before trusting the result.${C.off}`)
    return 2
  }
  if (vulnerable > 0) {
    console.log(`${C.red}At least one attack worked. This build is not safe to ship.${C.off}`)
    return 1
  }
  console.log(`${C.green}Every attack was blocked.${C.off}`)
  return 0
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err)
    process.exit(2)
  },
)
