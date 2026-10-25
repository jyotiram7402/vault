'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker, in production only and after the page has
 * loaded, so it never competes with the first paint.
 */
export function RegisterSw() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // A failed registration only costs the offline page.
      })
    }

    if (document.readyState === 'complete') {
      register()
      return
    }
    window.addEventListener('load', register)
    return () => window.removeEventListener('load', register)
  }, [])

  return null
}
