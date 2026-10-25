import type { Metadata } from 'next'
import { isSupabaseConfigured } from '@/lib/env'
import { AuthCard } from '@/components/auth/auth-card'
import { ForgotForm } from '@/components/auth/forgot-form'
import { SetupNeeded } from '@/components/auth/setup-needed'

export const metadata: Metadata = {
  title: 'Reset your sign-in password',
  robots: { index: false, follow: false },
}

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your sign-in password"
      subtitle="We’ll email you a link. This does not change your master password, which nobody can reset."
    >
      {isSupabaseConfigured ? <ForgotForm /> : <SetupNeeded />}
    </AuthCard>
  )
}
