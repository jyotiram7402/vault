import type { MetadataRoute } from 'next'
import { APP_DESCRIPTION, APP_NAME } from '@/lib/config'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} Password Vault`,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    start_url: '/vault',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#0F1513',
    theme_color: '#0F1513',
    categories: ['security', 'productivity'],
    icons: [
      { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Add login', short_name: 'Add login', url: '/vault?new=login' },
      { name: 'Password generator', short_name: 'Generator', url: '/vault/generator' },
    ],
  }
}
