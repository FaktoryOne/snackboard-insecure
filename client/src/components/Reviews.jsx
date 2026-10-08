// Renders the reviews for a snack.
//
// Review bodies are user-submitted, so they are rendered as text. React
// escapes everything it interpolates; the vulnerability only existed because
// the old code opted out of that with dangerouslySetInnerHTML. If we ever
// want real formatting back, we render markdown and sanitise the result with
// a vetted library — never with a regex of our own.
export function Reviews({ reviews }) {
  if (reviews.length === 0) {
    return <p className="muted">No reviews yet. Be the first!</p>
  }
  return (
    <ul className="reviews">
      {reviews.map((review) => (
        <li key={review.id} className="review">
          <span className="review__rating">{'★'.repeat(review.rating)}</span>
          <div className="review__body">{review.body}</div>
        </li>
      ))}
    </ul>
  )
}
