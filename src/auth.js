import { createHash, randomBytes } from 'node:crypto'
import { db } from './db.js'

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

// In-memory session store: token -> userId. Cleared on every restart.
const sessions = new Map()

export function login(req, res) {
  const { email, password } = req.body ?? {}
  // `?? null` because a missing field is `undefined`, which SQLite cannot bind.
  // A null email simply matches no row, so a body with no email is still a 401.
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email ?? null)
  if (!user || user.password_hash !== sha256(password ?? '')) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }
  const token = randomBytes(16).toString('hex')
  sessions.set(token, user.id)
  // HttpOnly keeps the token out of reach of any script on the page.
  res.setHeader('Set-Cookie', `session=${token}; Path=/; HttpOnly; SameSite=Lax`)
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role })
}

export function currentUser(req) {
  const cookie = req.headers.cookie ?? ''
  const match = cookie.match(/(?:^|;\s*)session=([a-f0-9]+)/)
  if (!match) return null
  const userId = sessions.get(match[1])
  if (userId === undefined) return null
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
}

export function requireAuth(req, res, next) {
  const user = currentUser(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })
  req.user = user
  next()
}

/**
 * Roles are read from the database on every request. A role claim that the
 * client can edit — in localStorage, or in an unverified token — is a
 * suggestion, not a control.
 */
export function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) return res.status(404).end()
    next()
  }
}
