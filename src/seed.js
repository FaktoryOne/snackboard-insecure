import { createHash } from 'node:crypto'

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

/**
 * Creates the schema and fills it with demo data. Runs on every startup
 * against the in-memory database, so the app is always in a known state.
 *
 * Seeded accounts (all passwords are obviously not production-grade):
 *   alice@example.com / password123   (user, id 1)
 *   bob@example.com   / password123   (user, id 2)
 *   admin@example.com / admin123      (admin, id 3)
 */
export function seed(db) {
  db.exec(`
    CREATE TABLE users (
      id            INTEGER PRIMARY KEY,
      email         TEXT UNIQUE,
      password_hash TEXT,
      name          TEXT,
      role          TEXT
    );
    CREATE TABLE snacks (
      id          INTEGER PRIMARY KEY,
      name        TEXT,
      votes_count INTEGER DEFAULT 0
    );
    CREATE TABLE votes (
      id       INTEGER PRIMARY KEY,
      user_id  INTEGER,
      snack_id INTEGER
    );
    CREATE TABLE reviews (
      id         INTEGER PRIMARY KEY,
      snack_id   INTEGER,
      user_id    INTEGER,
      body       TEXT,
      rating     INTEGER,
      created_at TEXT
    );
    CREATE TABLE lists (
      id      INTEGER PRIMARY KEY,
      user_id INTEGER,
      name    TEXT,
      note    TEXT
    );
    CREATE TABLE list_items (
      id       INTEGER PRIMARY KEY,
      list_id  INTEGER,
      snack_id INTEGER
    );
  `)

  const insertUser = db.prepare(
    'INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)',
  )
  insertUser.run(1, 'alice@example.com', sha256('password123'), 'Alice', 'user')
  insertUser.run(2, 'bob@example.com', sha256('password123'), 'Bob', 'user')
  insertUser.run(3, 'admin@example.com', sha256('admin123'), 'Admin', 'admin')

  const insertSnack = db.prepare(
    'INSERT INTO snacks (id, name, votes_count) VALUES (?, ?, ?)',
  )
  insertSnack.run(1, 'Pretzels', 4)
  insertSnack.run(2, 'Gummy bears', 7)
  insertSnack.run(3, 'Trail mix', 2)
  insertSnack.run(4, 'Dark chocolate', 9)

  const insertReview = db.prepare(
    'INSERT INTO reviews (snack_id, user_id, body, rating, created_at) VALUES (?, ?, ?, ?, ?)',
  )
  insertReview.run(
    2,
    1,
    'Best snack on the board. Would vote again.',
    5,
    new Date().toISOString(),
  )

  // Private snack lists. A list belongs to exactly one user and the UI only
  // ever shows you your own.
  const insertList = db.prepare(
    'INSERT INTO lists (id, user_id, name, note) VALUES (?, ?, ?, ?)',
  )
  insertList.run(1, 1, "Alice's desk drawer", 'Behind the monitor stand.')
  insertList.run(2, 2, "Bob's Friday stash", 'Do not tell Alice about the chocolate.')

  const insertListItem = db.prepare(
    'INSERT INTO list_items (list_id, snack_id) VALUES (?, ?)',
  )
  insertListItem.run(1, 1)
  insertListItem.run(1, 3)
  insertListItem.run(2, 4)
  insertListItem.run(2, 2)
}
