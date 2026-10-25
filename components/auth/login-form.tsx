'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { authErrorMessage } from '@/lib/supabase/auth-errors'
import { safeNextPath } from '@/lib/security/safe-next'
import { GOOGLE_AUTH_ENABLED } from '@/lib/env'
import { Button } from '@/components/ui/button'
import { Field, describedBy } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { MfaChallenge } from '@/components/auth/mfa-challenge'
import { OAuthButton } from '@/components/auth/oauth-button'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = safeNextPath(searchParams.get('next'))

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [canResend, setCanResend] = useState(false)
  const [resendState, setResendState] = useState<'idle' | 'sent'>('idle')
  const [needsMfa, setNeedsMfa] = useState(false)

  const finish = () => {
    router.replace(next)
    router.refresh()
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setCanResend(false)

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      const friendly = authErrorMessage(signInError)
      setError(friendly.message)
      setCanResend(Boolean(friendly.canResend))
      setBusy(false)
      return
    }

    // A second factor may still be required before the session counts as aal2.
    try {
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (data?.nextLevel === 'aal2' && data.currentLevel !== 'aal2') {
        setNeedsMfa(true)
        setBusy(false)
        return
      }
    } catch {
      // If the check itself fails, carry on: the vault gate checks again, and
      // Row Level Security refuses data to an aal1 session anyway.
    }

    finish()
  }

  const handleResend = async () => {
    const supabase = createClient()
    await supabase.auth.resend({ type: 'signup', email })
    setResendState('sent')
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setNeedsMfa(false)
    setPassword('')
    router.refresh()
  }

  if (needsMfa) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-ink-muted">
          Two-factor sign-in is on for this account. Enter the code from your authenticator app.
        </p>
        <MfaChallenge onVerified={finish} onSignOut={handleSignOut} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field id="login-email" label="Email">
          <Input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            required
            autoFocus
          />
        </Field>

        <Field
          id="login-password"
          label="Password"
          error={error}
          hint="This is your sign-in password, not your master password."
        >
          <PasswordInput
            id="login-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            mono={false}
            required
            invalid={Boolean(error)}
            aria-describedby={describedBy(
              'login-password',
              'This is your sign-in password, not your master password.',
              error,
            )}
          />
        </Field>

        {canResend ? (
          <div className="text-sm">
            {resendState === 'sent' ? (
              <p className="text-ink-muted">Confirmation email sent. Check your inbox.</p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                className="font-medium text-safe underline underline-offset-2"
              >
                Resend confirmation email
              </button>
            )}
          </div>
        ) : null}

        <Button type="submit" variant="primary" fullWidth loading={busy}>
          Sign in
        </Button>
      </form>

      {GOOGLE_AUTH_ENABLED ? (
        <>
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-xs text-ink-muted">or</span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <OAuthButton next={next} />
        </>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link
          href="/forgot-password"
          className="text-ink-muted underline underline-offset-2 transition-colors hover:text-ink"
        >
          Forgot password?
        </Link>
        <Link
          href="/signup"
          className="font-medium text-safe underline underline-offset-2"
        >
          Create account
        </Link>
      </div>
    </div>
  )
}
