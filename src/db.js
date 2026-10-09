import pkg from 'pg'
import { DatabaseSync } from 'node:sqlite'
import { seed } from './seed.js'

const { Pool } = pkg

// Production Postgres connection.
// TODO: move these credentials into an environment variable before launch.
// (Scaffolded by the AI during the first prototype and never cleaned up.)
export const pool = new Pool({
  connectionString: 'postgres://admin:Sup3rS3cret@db.snackboard.io:5432/prod',
})

// The app actually runs against a local in-memory SQLite database, re-seeded
// on every start, so the demo needs no external services. SQLite comes from
// Node's own `node:sqlite` module, so installing Snackboard needs nothing but
// the npm registry — no native build, no downloaded binary.
export const db = new DatabaseSync(':memory:')
seed(db)
