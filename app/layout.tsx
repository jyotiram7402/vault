import type { Metadata, Viewport } from 'next'
import { Archivo, JetBrains_Mono } from 'next/font/google'
import { cookies } from 'next/headers'
import './globals.css'
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE } from '@/lib/config'
import { siteUrl } from '@/lib/env'
import { RegisterSw } from '@/components/pwa/register-sw'
import { ToastProvider } from '@/components/ui/toast'

const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-archivo',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-secret',
  display: 'swap',
  preload: false,
})

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: {
    type: 'website',
    siteName: APP_NAME,
    title: `${APP_NAME} — ${APP_TAGLINE}`,
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${APP_NAME} — ${APP_TAGLINE}`,
    description: APP_DESCRIPTION,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#E8ECE4' },
    { media: '(prefers-color-scheme: dark)', color: '#0F1513' },
  ],
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Reading a cookie makes every page render per request, which is what the
  // nonce-based CSP needs anyway. No inline theme script is required.
  const cookieStore = await cookies()
  const stored = cookieStore.get('tijori-theme')?.value
  const theme = stored === 'dark' || stored === 'light' ? stored : undefined

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${archivo.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-bg text-ink antialiased">
        <ToastProvider>{children}</ToastProvider>
        <RegisterSw />
      </body>
    </html>
  )
}
