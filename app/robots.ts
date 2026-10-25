import type { MetadataRoute } from 'next'

// The vault and the auth flows are private; only the public pages are indexed.
// There is no sitemap: five public pages don't need one.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/vault', '/vault/', '/auth/', '/reset-password'],
    },
  }
}
