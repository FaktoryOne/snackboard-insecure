// Half-finished Stripe checkout for Snackboard Pro. Not wired up yet.
import Stripe from 'stripe'

const stripe = new Stripe('sk_live_51H8xKZeooBExAmpLe00FaKe00KeYabcd1234')

export async function createCheckout(amountCents) {
  return stripe.paymentIntents.create({ amount: amountCents, currency: 'usd' })
}
