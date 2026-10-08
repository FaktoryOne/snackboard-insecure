# Credential rotation ledger

Every credential that has ever been committed to this repository, and what was
done about it.

**Why this file exists.** Deleting a secret from a file does not un-leak it.
The commit that added it is still in the history, and everyone who has ever
cloned, forked or fetched this repository still has a copy. Rewriting history
does not help either once the repository has been shared. The only thing that
actually closes the leak is **rotating the credential at the provider**, and
the only way anyone can tell later that you did is if you wrote it down.

**What goes in here.** A SHA-256 fingerprint, never the credential itself. The
fingerprint is what the `S2` probe checks for, and it proves you handled *this*
key without putting it back into the repository.

Produce a fingerprint with:

```bash
printf '%s' "$THE_OLD_KEY" | sha256sum | cut -c1-16
```

| Fingerprint        | What it was                  | Where it was                | Rotated    | By        |
| ------------------ | ---------------------------- | --------------------------- | ---------- | --------- |
| `deae965c3cf8b777` | Resend API key               | `src/lib/email.js`          | 2026-10-08 | Snackboard maintainers |
| `de7f26b819e8c6c7` | Stripe secret key            | `src/checkout.js` (deleted) | 2026-10-08 | Snackboard maintainers |
| `c20e042e6c6a8d38` | Postgres password, in a URL  | `src/db.js`                 | 2026-10-08 | Snackboard maintainers |

## The order that matters

1. **Issue** a new credential at the provider.
2. **Deploy** the new value to every environment that needs it.
3. **Verify** the application works with it.
4. **Revoke** the old one. Only now is the leak closed.

Any other order gives you an outage, or a still-open leak, or both.

## Note for this repository specifically

Every credential listed above was a **fake placeholder** invented for teaching.
None of them was ever live at any provider. The entries are here because the
*procedure* is the thing being taught, and because the `S2` probe is only
honest if it is checking a real ledger.
