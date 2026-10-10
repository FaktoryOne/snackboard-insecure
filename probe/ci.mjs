#!/usr/bin/env node
//
// One command that CI can run: start the API, wait for it, run every probe,
// stop the API, and exit with the runner's exit code.
//
//   npm run test:security
//
// Use this in a pipeline. Use `npm run probe` while you are working, with the
// app already running in another terminal.

import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..')
const PORT = process.env.PORT ?? '3000'

// `--experimental-sqlite` is required on Node 22 and is a harmless no-op on
// Node 24, where `node:sqlite` is no longer flagged. Passing it unconditionally
// keeps this working on both versions the course supports.
const server = spawn(process.execPath, ['--experimental-sqlite', 'src/index.js'], {
  cwd: ROOT,
  env: { ...process.env, PORT },
  stdio: ['ignore', 'inherit', 'inherit'],
})

let exitCode = 2
try {
  exitCode = await new Promise((resolve, reject) => {
    server.once('error', reject)
    const probes = spawn(process.execPath, ['probe/run.mjs', ...process.argv.slice(2)], {
      cwd: ROOT,
      // 127.0.0.1, not `localhost`: the API binds loopback IPv4 only, and on a
      // machine where `localhost` resolves to ::1 first every probe would fail
      // to connect and the suite would look broken rather than green.
      env: { ...process.env, PROBE_TARGET: `http://127.0.0.1:${PORT}` },
      stdio: 'inherit',
    })
    probes.once('error', reject)
    probes.once('exit', (code) => resolve(code ?? 2))
  })
} finally {
  server.kill('SIGTERM')
}

process.exit(exitCode)
