// A tiny allowlist validator.
//
// In a real project reach for Zod or Valibot. The point of doing it by hand
// here is that there is no magic in it: you declare the fields you accept,
// everything else is rejected, and the handler below only ever sees data that
// already passed.

export function validate(schema, input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['body must be a JSON object'] }
  }

  const errors = []
  const value = {}

  for (const [field, rule] of Object.entries(schema)) {
    const raw = input[field]

    if (raw === undefined || raw === null) {
      if (rule.required) errors.push(`${field} is required`)
      else if ('default' in rule) value[field] = rule.default
      continue
    }

    if (rule.type === 'int') {
      if (!Number.isInteger(raw)) {
        errors.push(`${field} must be a whole number`)
        continue
      }
      if (rule.min !== undefined && raw < rule.min) errors.push(`${field} must be at least ${rule.min}`)
      else if (rule.max !== undefined && raw > rule.max) errors.push(`${field} must be at most ${rule.max}`)
      else value[field] = raw
      continue
    }

    if (rule.type === 'string') {
      if (typeof raw !== 'string') {
        errors.push(`${field} must be a string`)
        continue
      }
      const trimmed = raw.trim()
      if (rule.minLength !== undefined && trimmed.length < rule.minLength) {
        errors.push(`${field} must be at least ${rule.minLength} characters`)
      } else if (rule.maxLength !== undefined && trimmed.length > rule.maxLength) {
        errors.push(`${field} must be at most ${rule.maxLength} characters`)
      } else if (rule.deny && rule.deny.test(trimmed)) {
        errors.push(`${field} may not contain markup`)
      } else {
        value[field] = trimmed
      }
      continue
    }

    errors.push(`${field} has an unsupported rule`)
  }

  // Reject anything we did not declare. This is what stops an attacker
  // smuggling `userId`, `role` or `isAdmin` through a write endpoint.
  const unexpected = Object.keys(input).filter((k) => !(k in schema))
  if (unexpected.length > 0) {
    errors.push(`unexpected field(s): ${unexpected.join(', ')}`)
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value }
}

/** Escapes the five characters that turn text into markup. */
export function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
