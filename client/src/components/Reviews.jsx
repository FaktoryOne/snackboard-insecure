// Renders the reviews for a snack.
//
// Reviews support a little formatting (people like <b> and line breaks), so
// the body is rendered as HTML rather than plain text.
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
