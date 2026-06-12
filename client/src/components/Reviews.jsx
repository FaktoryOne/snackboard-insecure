// Renders the reviews for a snack.
//
// BUG: review.body is user-submitted and rendered as raw HTML via
// dangerouslySetInnerHTML, so a malicious review runs script in every
// viewer's browser (stored XSS).
export function Reviews({ reviews }) {
  if (reviews.length === 0) {
    return <p className="muted">No reviews yet. Be the first!</p>
  }
  return (
    <ul className="reviews">
      {reviews.map((review) => (
        <li key={review.id} className="review">
          <span className="review__rating">{'★'.repeat(review.rating)}</span>
          <div
            className="review__body"
            dangerouslySetInnerHTML={{ __html: review.body }}
          />
        </li>
      ))}
    </ul>
  )
}
