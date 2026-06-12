import { useEffect, useState } from 'react'
import { api } from './api.js'
import { Reviews } from './components/Reviews.jsx'

export function App() {
  const [user, setUser] = useState(null)
  const [snacks, setSnacks] = useState([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [reviews, setReviews] = useState([])
  const [error, setError] = useState(null)

  const loadSnacks = () => api('/api/snacks').then(setSnacks).catch(() => {})

  useEffect(() => {
    loadSnacks()
    api('/api/me')
      .then(setUser)
      .catch(() => setUser(null))
  }, [])

  const search = async (e) => {
    e.preventDefault()
    try {
      setSnacks(await api(`/api/search?q=${encodeURIComponent(query)}`))
    } catch (err) {
      setError(err.message)
    }
  }

  const vote = async (snackId) => {
    try {
      await api('/api/votes', { method: 'POST', body: JSON.stringify({ snackId }) })
      loadSnacks()
    } catch (err) {
      setError(err.message)
    }
  }

  const openSnack = async (snack) => {
    setSelected(snack)
    setReviews(await api(`/api/reviews?snackId=${snack.id}`))
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>🍿 Snackboard</h1>
        <LoginWidget user={user} onChange={setUser} />
      </header>

      {error && <p className="error" onClick={() => setError(null)}>{error}</p>}

      <form className="search" onSubmit={search}>
        <input
          placeholder="Search snacks…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit">Search</button>
        <button type="button" onClick={loadSnacks}>
          Reset
        </button>
      </form>

      <main className="layout">
        <ul className="snacks">
          {snacks.map((snack) => (
            <li key={snack.id} className="snack">
              <button className="snack__name" onClick={() => openSnack(snack)}>
                {snack.name}
              </button>
              <span className="snack__votes">{snack.votes_count ?? 0} votes</span>
              <button className="snack__vote" onClick={() => vote(snack.id)} disabled={!user}>
                ▲ Vote
              </button>
            </li>
          ))}
        </ul>

        {selected && (
          <section className="detail">
            <h2>{selected.name}</h2>
            <Reviews reviews={reviews} />
            {user ? (
              <ReviewForm
                snackId={selected.id}
                onPosted={() => openSnack(selected)}
                onError={setError}
              />
            ) : (
              <p className="muted">Log in to leave a review.</p>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

function LoginWidget({ user, onChange }) {
  const [email, setEmail] = useState('alice@example.com')
  const [password, setPassword] = useState('password123')

  if (user) {
    return (
      <span className="who">
        {user.name} ({user.role})
      </span>
    )
  }

  const submit = async (e) => {
    e.preventDefault()
    try {
      onChange(
        await api('/api/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        }),
      )
    } catch {
      onChange(null)
      alert('Login failed')
    }
  }

  return (
    <form className="login" onSubmit={submit}>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="submit">Log in</button>
    </form>
  )
}

function ReviewForm({ snackId, onPosted, onError }) {
  const [body, setBody] = useState('')
  const [rating, setRating] = useState(5)

  const submit = async (e) => {
    e.preventDefault()
    try {
      await api('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({ snackId, body, rating: Number(rating) }),
      })
      setBody('')
      onPosted()
    } catch (err) {
      onError(err.message)
    }
  }

  return (
    <form className="review-form" onSubmit={submit}>
      <textarea
        placeholder="Write a review…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="review-form__row">
        <select value={rating} onChange={(e) => setRating(e.target.value)}>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} ★
            </option>
          ))}
        </select>
        <button type="submit">Post review</button>
      </div>
    </form>
  )
}
