/**
 * `localStorage`, for the browsers that do not have it.
 *
 * Safari in private browsing throws on `setItem` rather than returning nothing, and a visitor
 * with site data blocked throws on the getter itself — so the *access* is the hazard, not just
 * the value. An unguarded read in a store's rehydrate step takes down the page it was meant to
 * restore, and it does so only for the visitors least able to report it.
 *
 * Every method swallows. A selection that cannot be saved is a small loss; a site that will
 * not load is not.
 */
export const safeStorage = {
  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* private mode, a quota, a blocked origin — none is worth an exception */
    }
  },
  removeItem(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* as above */
    }
  },
};
