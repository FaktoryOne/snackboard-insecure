import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db } from './db.js'
import { login, requireAuth, requireRole } from './auth.js'
import { sendWelcomeEmail } from './lib/email.js'
import { validate, escapeHtml } from './validate.js'
import { createHash } from 'node:crypto'

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const app = express()
app.use(express.json({ limit: '64kb' }))

// Readiness probe. CI and the probe runner wait on this before testing.
app.get('/health', (req, res) => res.json({ ok: true }))

// ---------------------------------------------------------------------------
// Deny by default.
//
// Everything under /api needs a session unless it is on this list. A new
// route written next month — by a person or by an agent — is protected
// because it exists, not because someone remembered to protect it.
// ---------------------------------------------------------------------------
const PUBLIC_ROUTES = new Set([
  'POST /api/login',
  'POST /api/register',
  'GET /api/snacks',
  'GET /api/search',
  'GET /api/reviews',
])

app.use('/api', (req, res, next) => {
  if (PUBLIC_ROUTES.has(`${req.method} ${req.baseUrl}${req.path}`.replace(/\/$/, ''))) {
    return next()
  }
  return requireAuth(req, res, next)
})

// ----- Auth -----
app.post('/api/login', login)

const RegisterInput = {
  email: { type: 'string', required: true, minLength: 3, maxLength: 254 },
  password: { type: 'string', required: true, minLength: 8, maxLength: 200 },
  name: { type: 'string', maxLength: 80, default: null },
}

app.post('/api/register', (req, res) => {
  const parsed = validate(RegisterInput, req.body ?? {})
  if (!parsed.ok) return res.status(400).json({ errors: parsed.errors })
  const { email, password, name } = parsed.value

  // The role is set by the server. It is never read from the request.
  const info = db
    .prepare('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)')
    .run(email, sha256(password), name ?? email, 'user')
  sendWelcomeEmail(email, name ?? email)
  res.status(201).json({ id: info.lastInsertRowid })
})

app.get('/api/me', (req, res) => {
  const { id, email, name, role } = req.user
  res.json({ id, email, name, role })
})

// ----- Users -----
// Identity comes from the session. The URL cannot ask for anybody else.
app.get('/api/users/me', (req, res) => {
  const user = db
    .prepare('SELECT id, email, name, role FROM users WHERE id = ?')
    .get(req.user.id)
  res.json(user)
})

app.get('/api/users/:id', (req, res) => {
  if (Number(req.params.id) !== req.user.id) {
    // 404, not 403: "exists but is not yours" is information an attacker uses.
    return res.status(404).json({ error: 'Not found' })
  }
  const user = db
    .prepare('SELECT id, email, name, role FROM users WHERE id = ?')
    .get(req.user.id)
  res.json(user)
})

// ----- Snacks -----
app.get('/api/snacks', (req, res) => {
  res.json(db.prepare('SELECT id, name, votes_count FROM snacks ORDER BY votes_count DESC').all())
})

app.get('/api/search', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 100) : ''
  // The value travels in a parameter slot, so it can never become SQL.
  const rows = db
    .prepare('SELECT id, name, votes_count FROM snacks WHERE name LIKE ?')
    .all(`%${q}%`)
  res.json(rows)
})

// ----- Private snack lists -----
app.get('/api/lists', (req, res) => {
  res.json(db.prepare('SELECT * FROM lists WHERE user_id = ?').all(req.user.id))
})

app.get('/api/lists/:id', (req, res) => {
  // Ownership is in the WHERE clause, not in an `if` after the fetch.
  const list = db
    .prepare('SELECT * FROM lists WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id)
  if (!list) return res.status(404).json({ error: 'Not found' })
  const items = db
    .prepare(
      'SELECT s.id, s.name FROM list_items li JOIN snacks s ON s.id = li.snack_id WHERE li.list_id = ?',
    )
    .all(list.id)
  res.json({ ...list, items })
})

// ----- Votes -----
const VoteInput = {
  snackId: { type: 'int', required: true, min: 1 },
}

app.post('/api/votes', (req, res) => {
  const parsed = validate(VoteInput, req.body ?? {})
  // An extra `userId` in the body is now an error, not an instruction.
  if (!parsed.ok) return res.status(400).json({ errors: parsed.errors })

  const snack = db.prepare('SELECT id FROM snacks WHERE id = ?').get(parsed.value.snackId)
  if (!snack) return res.status(404).json({ error: 'No such snack' })

  db.prepare('INSERT INTO votes (user_id, snack_id) VALUES (?, ?)').run(
    req.user.id,
    snack.id,
  )
  db.prepare('UPDATE snacks SET votes_count = votes_count + 1 WHERE id = ?').run(snack.id)
  res.status(201).json({ ok: true })
})

// ----- Reviews -----
app.get('/api/reviews', (req, res) => {
  const snackId = Number(req.query.snackId)
  if (!Number.isInteger(snackId)) return res.status(400).json({ error: 'snackId must be a whole number' })
  res.json(
    db
      .prepare(
        'SELECT id, snack_id, user_id, body, rating, created_at FROM reviews WHERE snack_id = ? ORDER BY id DESC',
      )
      .all(snackId),
  )
})

const ReviewInput = {
  snackId: { type: 'int', required: true, min: 1 },
  rating: { type: 'int', required: true, min: 1, max: 5 },
  body: { type: 'string', required: true, minLength: 1, maxLength: 2000, deny: /[<>]/ },
}

app.post('/api/reviews', (req, res) => {
  const parsed = validate(ReviewInput, req.body ?? {})
  if (!parsed.ok) return res.status(400).json({ errors: parsed.errors })
  const { snackId, rating, body } = parsed.value

  const snack = db.prepare('SELECT id FROM snacks WHERE id = ?').get(snackId)
  if (!snack) return res.status(404).json({ error: 'No such snack' })

  db.prepare(
    'INSERT INTO reviews (snack_id, user_id, body, rating, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(snackId, req.user.id, escapeHtml(body), rating, new Date().toISOString())
  res.status(201).json({ ok: true })
})

// ----- Admin -----
// Authenticated by the deny-by-default middleware, then checked for the role.
app.delete('/api/admin/snacks/:id', requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM snacks WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// The /api/__debug/state route was deleted. If you need that information
// again, read it from a log you control, behind the same authorization as
// everything else.

// Serve the built web client if it exists (npm start); otherwise API only.
const dirname = path.dirname(fileURLToPath(import.meta.url))
app.use(express.static(path.join(dirname, '..', 'client', 'dist')))

// One error handler, so a rejected request answers with a status code and a
// short message instead of printing a stack trace that tells an attacker your
// directory layout and your library versions.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status ?? err.statusCode ?? 500
  if (status >= 500) console.error('[error]', err.message)
  res.status(status).json({ error: status === 413 ? 'Payload too large' : 'Request rejected' })
})

const PORT = process.env.PORT ?? 3000
// Bind to loopback only by default. Snackboard is deliberately vulnerable, so it
// must not be reachable from the rest of the network (e.g. a training room on
// shared wifi). Set HOST=0.0.0.0 to override deliberately.
const HOST = process.env.HOST ?? '127.0.0.1'
app.listen(PORT, HOST, () => {
  console.log(`Snackboard API running on http://${HOST}:${PORT}`)
})
