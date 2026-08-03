/**
 * Smooth background sync helpers — debounce + no loading flicker.
 */

/** Coalesce rapid triggers into one call after `ms` idle. */
export function debounce<T extends (...args: never[]) => unknown>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = undefined;
      fn(...args);
    }, ms);
  };
}

/**
 * At most one run per `ms`. Leading call runs after first wait if trailing-only.
 * Trailing: if called during window, run once after window ends.
 */
export function throttleTrailing<T extends (...args: never[]) => unknown>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let last = 0;
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = ms - (now - last);
    if (remaining <= 0) {
      if (t) {
        clearTimeout(t);
        t = undefined;
      }
      last = now;
      fn(...args);
    } else if (!t) {
      t = setTimeout(() => {
        t = undefined;
        last = Date.now();
        fn(...args);
      }, remaining);
    }
  };
}
