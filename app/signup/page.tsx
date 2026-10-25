import type { Metadata } from 'next'
import Link from 'next/link'
import { isSupabaseConfigured } from '@/lib/env'
import { AuthCard } from '@/components/auth/auth-card'
import { SignupForm } from '@/components/auth/signup-form'
import { SetupNeeded } from '@/components/auth/setup-needed'

export const metadata: Metadata = {
  title: 'Create your vault',
  robots: { index: false, follow: false },
}

export default function SignupPage() {
  return (
    <AuthCard
      title="Create your vault"
      subtitle="Two steps: an account to sign in with, then a master password that only you hold."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-safe underline underline-offset-2">
            Sign in
          </Link>
        </>
      }
    >
      {isSupabaseConfigured ? <SignupForm /> : <SetupNeeded />}
    </AuthCard>
  )
}
