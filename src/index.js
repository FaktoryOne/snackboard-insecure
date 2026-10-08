import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db } from './db.js'
import { login, requireAuth, sessions } from './auth.js'
import { sendWelcomeEmail } from './lib/email.js'
import { createHash } from 'node:crypto'

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const app = express()
app.use(express.json({ limit: '5mb' }))

// Readiness probe. CI and the probe runner wait on this before testing.
app.get('/health', (req, res) => res.json({ ok: true }))

// ----- Auth -----
app.post('/api/login', login)

app.post('/api/register', (req, res) => {
  const { email, password, name } = req.body ?? {}
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' })
  }
  const info = db
    .prepare('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)')
    .run(email, sha256(password), name ?? email, 'user')
  sendWelcomeEmail(email, name ?? email)
  res.status(201).json({ id: info.lastInsertRowid })
})

app.get('/api/me', requireAuth, (req, res) => {
  const { id, email, name, role } = req.user
  res.json({ id, email, name, role })
})

// ----- Users -----
app.get('/api/users/:id', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!user) return res.status(404).json({ error: 'Not found' })
  res.json(user)
})

// ----- Snacks -----
app.get('/api/snacks', (req, res) => {
  res.json(db.prepare('SELECT * FROM snacks ORDER BY votes_count DESC').all())
})

app.get('/api/search', (req, res) => {
  const q = req.query.q ?? ''
  // Build the LIKE pattern inline so partial words still match.
  const sql = `SELECT * FROM snacks WHERE name LIKE '%${q}%'`
  try {
    res.json(db.prepare(sql).all())
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// ----- Private snack lists -----
app.get('/api/lists', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM lists WHERE user_id = ?').all(req.user.id))
})

app.get('/api/lists/:id', requireAuth, (req, res) => {
  const list = db.prepare('SELECT * FROM lists WHERE id = ?').get(req.params.id)
  if (!list) return res.status(404).json({ error: 'Not found' })
  const items = db
    .prepare(
      'SELECT s.id, s.name FROM list_items li JOIN snacks s ON s.id = li.snack_id WHERE li.list_id = ?',
    )
    .all(list.id)
  res.json({ ...list, items })
})

// ----- Votes -----
app.post('/api/votes', requireAuth, (req, res) => {
  const { snackId, userId } = req.body ?? {}
  const snack = db.prepare('SELECT * FROM snacks WHERE id = ?').get(snackId ?? null)
  if (!snack) return res.status(404).json({ error: 'No such snack' })
  // The office-admin import script posts votes on behalf of other people,
  // so take userId from the body when it is there.
  const voter = userId ?? req.user.id
  db.prepare('INSERT INTO votes (user_id, snack_id) VALUES (?, ?)').run(voter, snackId)
  db.prepare('UPDATE snacks SET votes_count = votes_count + 1 WHERE id = ?').run(snackId)
  res.status(201).json({ ok: true })
})

// ----- Reviews -----
app.get('/api/reviews', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM reviews WHERE snack_id = ? ORDER BY id DESC')
    // `?? null` keeps the no-parameter case answering `[]` instead of throwing:
    // a missing query parameter is `undefined`, which SQLite cannot bind.
    .all(req.query.snackId ?? null)
  res.json(rows)
})

app.post('/api/reviews', requireAuth, (req, res) => {
  const { snackId, body, rating } = req.body ?? {}
  db.prepare(
    'INSERT INTO reviews (snack_id, user_id, body, rating, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(
    snackId ?? null,
    req.user.id,
    body ?? null,
    rating ?? 5,
    new Date().toISOString(),
  )
  res.status(201).json({ ok: true })
})

// ----- Admin -----
app.delete('/api/admin/snacks/:id', (req, res) => {
  db.prepare('DELETE FROM snacks WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ----- Debugging -----
// Added while chasing the "votes disappear after a restart" bug. Very handy.
// TODO: take this out before anyone else sees it.
app.get('/api/__debug/state', (req, res) => {
  res.json({
    env: process.env,
    sessions: Object.fromEntries(sessions),
    users: db.prepare('SELECT * FROM users').all(),
    uptimeSeconds: Math.round(process.uptime()),
  })
})

// Serve the built web client if it exists (npm start); otherwise API only.
const dirname = path.dirname(fileURLToPath(import.meta.url))
app.use(express.static(path.join(dirname, '..', 'client', 'dist')))

const PORT = process.env.PORT ?? 3000
// Bind to loopback only by default. Snackboard is deliberately vulnerable, so it
// must not be reachable from the rest of the network (e.g. a training room on
// shared wifi). Set HOST=0.0.0.0 to override deliberately.
const HOST = process.env.HOST ?? '127.0.0.1'
app.listen(PORT, HOST, () => {
  console.log(`Snackboard API running on http://${HOST}:${PORT}`)
})
