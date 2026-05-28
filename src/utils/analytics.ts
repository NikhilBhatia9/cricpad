// CricPad Analytics — thin wrapper around GA4 gtag
// Only fires if VITE_GA_ID is configured (set as a GitHub Actions secret).

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

function gtag(...args: unknown[]) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag(...args)
  }
}

/** Call on every route change to track SPA page views. */
export function trackPageView(path: string) {
  gtag('event', 'page_view', { page_path: path })
}

/** Track a custom in-app event (e.g. match started, scorecard shared). */
export function trackEvent(name: string, params?: Record<string, unknown>) {
  gtag('event', name, params)
}
