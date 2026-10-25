import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { isSupabaseConfigured } from '@/lib/env'
import { AuthCard } from '@/components/auth/auth-card'
import { LoginForm } from '@/components/auth/login-form'
import { SetupNeeded } from '@/components/auth/setup-needed'

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
}

export default function LoginPage() {
  return (
    <AuthCard
      title="Sign in"
      subtitle="Your vault stays locked until you enter your master password on the next screen."
      footer={
        <>
          New here?{' '}
          <Link href="/signup" className="font-medium text-safe underline underline-offset-2">
            Create your vault
          </Link>
        </>
      }
    >
      {isSupabaseConfigured ? (
        // LoginForm reads ?next=, so it must sit inside Suspense.
        <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
          <LoginForm />
        </Suspense>
      ) : (
        <SetupNeeded />
      )}
    </AuthCard>
  )
}
