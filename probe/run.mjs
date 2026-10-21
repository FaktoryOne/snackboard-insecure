#!/usr/bin/env node
//
// Attack-probe runner. Plain Node 20+, no dependencies, no test framework.
//
//   node probe/run.mjs                      every probe in probe/probes
//   node probe/run.mjs --dir yours          only the probes you wrote
//   node probe/run.mjs --dir probes,yours   both
//   node probe/run.mjs --list               list them without running them
//   node probe/run.mjs --only A1,S2
//   node probe/run.mjs --target http://127.0.0.1:8000
//   node probe/run.mjs --help
//
// Exit code 0 = every attack that ran was blocked, and at least one ran.
// Exit code 1 = at least one attack succeeded. This is what fails your build.
// Exit code 2 = nothing was judged, so the result means nothing. No probes
//               loaded, none of them ran, a probe threw, or the app is down.
//
// Only ever point this at an application you own or have written permission
// to test.

import { readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { CONFIG, flag, option } from './lib/config.mjs'
import { TARGET, loginAs, waitForTarget } from './lib/client.mjs'

const C = process.stdout.isTTY
  ? { red: '\x1b[31m', green: '\x1b[32m', grey: '\x1b[90m', bold: '\x1b[1m', off: '\x1b[0m' }
  : { red: '', green: '', grey: '', bold: '', off: '' }

const USAGE = `
Attack-probe runner — one command, one exit code, no test framework.

  node probe/run.mjs [options]

  --dir NAMES      probe directories under probe/, comma separated (default: probes)
  --only IDS       run just these probe ids, comma separated
  --target URL     base URL of the app under attack
  --list           list the probes without running them
  --verbose        show the evidence for blocked attacks too
  --help           this

Environment (all optional — defaults describe Snackboard):

  PROBE_TARGET           base URL                      http://127.0.0.1:3000
  PROBE_DIR              probe directory               probes
  PROBE_HEALTH           path used to ask "is it up"   /health
  PROBE_LOGIN            login path                    /api/login
  PROBE_SESSION_COOKIE   session cookie name           session
  PROBE_USERS            name=email:password,...  or   none
  PROBE_REPO             repo root for static probes   the parent of probe/

Exit 0 every attack that ran was blocked · 1 an attack succeeded · 2 nothing was judged.
`.trim()

async function loadProbes() {
  const probes = []

  for (const dir of CONFIG.probeDirs) {
    if (!existsSync(dir)) {
      throw new Error(
        `No probe directory at ${dir}.\n` +
          `--dir is relative to probe/, so --dir yours means probe/yours.`,
      )
    }

    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.mjs') && !f.startsWith('_'))
      .sort()

    for (const file of files) {
      const mod = await import(path.join(dir, file))
      const probe = mod.default
      if (!probe?.id || typeof probe.attack !== 'function') {
        throw new Error(`${file} does not export a probe with an id and an attack()`)
      }
      probes.push({ ...probe, file })
    }
  }

  return probes
}

/**
 * Log in as every identity the selected probes ask for.
 *
 * A probe declares `sessions: true` when its attack needs a logged-in
 * identity. Probes that do not — an anonymous injection payload, a static
 * read of the repository — cost no login, which is what lets this run against
 * an app with no login route at all.
 *
 * A login that fails is fatal on purpose. An authorization probe that runs
 * anonymously goes green against a vulnerable app, and a green run that
 * guards nothing is worse than no run.
 */
async function openSessions(probes) {
  const needs = probes.filter((p) => p.sessions && !p.skip)
  if (needs.length === 0) return {}

  // Running these anonymously would report "every attack was blocked" against
  // an app that is wide open. Refuse instead.
  if (CONFIG.users.length === 0) {
    throw new Error(
      `PROBE_USERS is none, but these probes ask for a logged-in identity: ` +
        `${needs.map((p) => p.id).join(', ')}.\n` +
        `Give the runner logins, or drop \`sessions: true\` and write an attack that needs\n` +
        `no identity. Running them anonymously would report every attack blocked against an\n` +
        `app that is wide open.`,
    )
  }

  const ctx = {}
  for (const user of CONFIG.users) {
    try {
      ctx[user.name] = await loginAs(user.email, user.password)
    } catch (err) {
      throw new Error(
        `${err.message}\n` +
          `These probes need a logged-in identity. Either give the runner real logins\n` +
          `  PROBE_USERS='alice=you@example.com:secret,bob=other@example.com:secret'\n` +
          `(and PROBE_LOGIN=/your/login/path if it is not ${CONFIG.loginPath}), or run only\n` +
          `probes that do not need one:  node probe/run.mjs --dir yours`,
      )
    }
  }
  return ctx
}

async function main() {
  if (flag('--help') || flag('-h')) {
    console.log(USAGE)
    return 0
  }
  if (CONFIG.usersError) throw CONFIG.usersError

  let probes = await loadProbes()

  const only = option('--only')
  if (only) {
    const wanted = new Set(only.split(',').map((s) => s.trim()))
    probes = probes.filter((p) => wanted.has(p.id))
  }

  if (flag('--list')) {
    for (const p of probes) {
      console.log(`${p.id.padEnd(4)} ${(p.kind ?? 'http').padEnd(7)} ${p.title}`)
    }
    return 0
  }

  // An empty suite that exits 0 reads as "every attack was blocked", which is
  // a lie. Say so and fail.
  if (probes.length === 0) {
    const first = CONFIG.probeDirs[0]
    const rel = path.relative(path.join(first, '..', '..'), first)
    console.error(
      `${C.red}No probes to run in ${CONFIG.probeDirs.length > 1 ? 'those directories' : `${rel}/`}.${C.off}\n` +
        `Copy ${rel}/_template.mjs to ${rel}/01-your-attack.mjs, write the attack,\n` +
        `and delete its \`skip\` line. Any .mjs that does not start with _ is picked up.`,
    )
    return 2
  }

  const needsApp = probes.some((p) => (p.kind ?? 'http') === 'http' && !p.skip)
  let ctx = {}

  if (needsApp) {
    console.log(`${C.grey}target: ${TARGET}${C.off}`)
    if (!(await waitForTarget())) {
      console.error(
        `${C.red}Nothing is answering at ${TARGET}.${C.off}\n` +
          `Start the app first:  npm start\n` +
          `Or point the runner at it:  node probe/run.mjs --target http://127.0.0.1:8000`,
      )
      return 2
    }
    ctx = await openSessions(probes)
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

  // Nothing reached a verdict, so there is nothing to be green about. Exiting 0
  // here would end the run on "Every attack was blocked" against an app that
  // nobody attacked. That is the same refusal as the empty-suite branch above:
  // no verdicts is no proof, whether because no probe loaded or because none of
  // them ran.
  if (blocked === 0 && vulnerable === 0 && skipped > 0) {
    console.error(
      `${C.red}Nothing was judged. ${skipped === 1 ? 'The one probe' : `All ${skipped} probes`} ` +
        `skipped, no attack ran, and this run proves nothing.${C.off}\n` +
        `The usual cause is the \`skip: true\` line in a probe copied from yours/_template.mjs —\n` +
        `delete it, write the attack, and run again. A probe can also skip itself when state it\n` +
        `needs is missing; the SKIP output above says why.`,
    )
    return 2
  }

  if (vulnerable > 0) {
    console.log(`${C.red}At least one attack worked. This build is not safe to ship.${C.off}`)
    return 1
  }

  // Some attacks were blocked and some never ran. Still exit 0 — every attack
  // that reached a verdict failed — but do not let the verdict line read as a
  // clean bill of health, because the skipped ones guarded nothing.
  if (skipped > 0) {
    console.log(
      `${C.green}Every attack that ran was blocked.${C.off} ` +
        `${skipped === 1 ? '1 probe' : `${skipped} probes`} skipped and proved nothing — ` +
        `read the SKIP output above before you call this green.`,
    )
    return 0
  }

  console.log(`${C.green}Every attack was blocked.${C.off}`)
  return 0
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`${C.red}${err.message}${C.off}`)
    if (flag('--verbose')) console.error(err.stack)
    process.exit(2)
  },
)
