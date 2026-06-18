export const toFivePointRating = (rating?: number | null) => {
  if (typeof rating !== "number" || !Number.isFinite(rating)) return 0;
  return Math.max(0, Math.min(5, rating / 2));
};

export const formatFivePointRating = (rating?: number | null) =>
  toFivePointRating(rating).toFixed(1);
