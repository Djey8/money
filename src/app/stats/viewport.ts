/**
 * The height the Stats charts can use: the window, less the bar the table puts above every page while another player's books (or
 * a seller's offer) are shown. The charts measure the window, so without this their lower axis and labels slip under the bottom menu
 * (JFK, 2026-10-18). 0 when there is no bar.
 */
export function viewportHeight(): number {
  const bar = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--table-banner-height'),
  );
  return window.innerHeight - (Number.isFinite(bar) ? bar : 0);
}

/** Fired on the window when the bar appears, goes or changes its height, so open charts are drawn again to the room that is left. */
export const BANNER_HEIGHT_EVENT = 'mm-banner-height';
