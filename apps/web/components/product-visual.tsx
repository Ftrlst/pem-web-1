export function ProductVisual({
  category,
  imageUrl,
}: {
  category: string;
  imageUrl?: string | null;
}) {
  const fallback = category.toLowerCase().includes('kue')
    ? '🍰'
    : category.toLowerCase().includes('peyek')
      ? '🥜'
      : '🍌';
  return (
    <div className="product-visual" aria-hidden="true">
      {imageUrl ? <img src={imageUrl} alt="" /> : <span>{fallback}</span>}
    </div>
  );
}
