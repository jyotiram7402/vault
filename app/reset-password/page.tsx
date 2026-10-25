import type { Metadata } from 'next'
import { isSupabaseConfigured } from '@/lib/env'
import { AuthCard } from '@/components/auth/auth-card'
import { ResetForm } from '@/components/auth/reset-form'
import { SetupNeeded } from '@/components/auth/setup-needed'

export const metadata: Metadata = {
  title: 'Choose a new password',
  robots: { index: false, follow: false },
}

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Choose a new password">
      {isSupabaseConfigured ? <ResetForm /> : <SetupNeeded />}
    </AuthCard>
  )
}
