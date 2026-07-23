/** Threshold below which a cents deviation is considered near-pure (inclusive). */
export const CENTS_NEAR_PURE_THRESHOLD = 2;

/** Threshold below which a cents deviation is considered moderate (inclusive). */
export const CENTS_LARGE_THRESHOLD = 8;

/**
 * Returns the CSS class to apply to a cents deviation value based on magnitude.
 *
 * - `|cents| ≤ 2¢`  → `'cents-near-pure'`  (teal — harmonically pure or near-pure)
 * - `|cents| ≤ 8¢`  → `'cents-moderate'`   (neutral — modest tempering)
 * - `|cents| > 8¢`  → `'cents-large'`       (coral — significant deviation)
 *
 * Always use this alongside the base `cents` class so font size and layout
 * are inherited and only color is overridden.
 */
export function centsDeviationClass(cents: number): string {
  const abs = Math.abs(cents);
  if (abs <= CENTS_NEAR_PURE_THRESHOLD) return 'cents-near-pure';
  if (abs <= CENTS_LARGE_THRESHOLD) return 'cents-moderate';
  return 'cents-large';
}
