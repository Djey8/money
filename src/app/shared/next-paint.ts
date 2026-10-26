/**
 * Resolves once the browser has had the chance to draw what was just changed - for work that blocks the page for a while (the
 * transactions of a subscription are worked out in one go): a spinner switched on just before it would otherwise never be seen.
 */
export function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => setTimeout(resolve, 0));
    } else {
      setTimeout(resolve, 0);
    }
  });
}
