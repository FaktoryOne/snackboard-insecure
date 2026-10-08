import { DatabaseSync } from 'node:sqlite'
import { seed } from './seed.js'

// The half-built Postgres pool is gone, and so is the connection string that
// carried its password. Nothing imported it. The password is burned — see
// SECURITY-ROTATIONS.md. When this app really does need Postgres, the
// connection string will come from the environment and be checked at startup
// by env.js, like every other secret.

// The app runs against a local in-memory SQLite database, re-seeded on every
// start, so the demo needs no external services. SQLite comes from Node's own
// `node:sqlite` module, so installing Snackboard needs nothing but the npm
// registry — no native build, no downloaded binary.
export const db = new DatabaseSync(':memory:')
seed(db)
