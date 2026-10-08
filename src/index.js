import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db } from './db.js'
import { login, requireAuth } from './auth.js'
import { sendWelcomeEmail } from './lib/email.js'
import { createHash } from 'node:crypto'

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const app = express()
app.use(express.json())

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
// BUG: any authenticated user can read ANY user's full record by id (IDOR).
app.get('/api/users/:id', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!user) return res.status(404).json({ error: 'Not found' })
  res.json(user)
})

// ----- Snacks -----
app.get('/api/snacks', (req, res) => {
  res.json(db.prepare('SELECT * FROM snacks ORDER BY votes_count DESC').all())
})

// BUG: user input is concatenated straight into the SQL string (SQL injection).
app.get('/api/search', (req, res) => {
  const q = req.query.q ?? ''
  const sql = `SELECT * FROM snacks WHERE name LIKE '%${q}%'`
  try {
    res.json(db.prepare(sql).all())
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// ----- Votes -----
app.post('/api/votes', requireAuth, (req, res) => {
  const { snackId } = req.body ?? {}
  const snack = db.prepare('SELECT * FROM snacks WHERE id = ?').get(snackId)
  if (!snack) return res.status(404).json({ error: 'No such snack' })
  db.prepare('INSERT INTO votes (user_id, snack_id) VALUES (?, ?)').run(
    req.user.id,
    snackId,
  )
  db.prepare('UPDATE snacks SET votes_count = votes_count + 1 WHERE id = ?').run(snackId)
  res.status(201).json({ ok: true })
})

// ----- Reviews -----
app.get('/api/reviews', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM reviews WHERE snack_id = ? ORDER BY id DESC')
    .all(req.query.snackId)
  res.json(rows)
})

// BUG: the body is stored as-is and later rendered as raw HTML (stored XSS).
app.post('/api/reviews', requireAuth, (req, res) => {
  const { snackId, body, rating } = req.body ?? {}
  db.prepare(
    'INSERT INTO reviews (snack_id, user_id, body, rating, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(snackId, req.user.id, body, rating ?? 5, new Date().toISOString())
  res.status(201).json({ ok: true })
})

// ----- Admin -----
// BUG: a destructive endpoint with no authentication or authorization at all.
app.delete('/api/admin/snacks/:id', (req, res) => {
  db.prepare('DELETE FROM snacks WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
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
