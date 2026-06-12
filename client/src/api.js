// Tiny fetch wrapper. Same-origin requests carry the session cookie
// automatically, so we don't manage tokens by hand here.
export async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    throw new Error((data && data.error) || res.statusText)
  }
  return data
}
