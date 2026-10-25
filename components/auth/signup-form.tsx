'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CircleCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { authErrorMessage } from '@/lib/supabase/auth-errors'
import { GOOGLE_AUTH_ENABLED } from '@/lib/env'
import { estimateStrength } from '@/lib/password/strength'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { StrengthMeter } from '@/components/vault/strength-meter'
import { OAuthButton } from '@/components/auth/oauth-button'

const MIN_PASSWORD_LENGTH = 12
const RESEND_COOLDOWN_SECONDS = 60

export function SignupForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  const strength = useMemo(() => estimateStrength(password, { email }), [password, email])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirm) {
      setError('The two passwords don’t match.')
      return
    }

    setBusy(true)
    const supabase = createClient()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Point at the callback route rather than straight at /vault.
        // Supabase's DEFAULT email template builds its link from this value,
        // and that link carries a `code` that has to be exchanged for a
        // session. /auth/callback does the exchange and then forwards to
        // /vault; /vault itself is proxy-protected, so the code would be
        // stripped by the redirect to /login before anything could use it.
        // Our own template uses token_hash and ignores this value entirely,
        // so setting it costs nothing and makes both templates work.
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/vault`,
      },
    })

    if (signUpError) {
      setError(authErrorMessage(signUpError).message)
      setBusy(false)
      return
    }

    if (data.session) {
      router.replace('/vault')
      router.refresh()
      return
    }

    setSentTo(email)
    setCooldown(RESEND_COOLDOWN_SECONDS)
    setBusy(false)
  }

  const handleResend = async () => {
    if (!sentTo || cooldown > 0) return
    const supabase = createClient()
    await supabase.auth.resend({ type: 'signup', email: sentTo })
    setCooldown(RESEND_COOLDOWN_SECONDS)
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-panel border border-ok/40 bg-surface-2 p-4">
          <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ok" />
          <p className="text-sm text-ink">
            Check your inbox at <strong>{sentTo}</strong>. Open the link to confirm your account,
            then sign in.
          </p>
        </div>

        <Button onClick={handleResend} disabled={cooldown > 0} fullWidth>
          {cooldown > 0 ? `Resend email in ${cooldown}s` : 'Resend email'}
        </Button>

        <Link
          href="/login"
          className="text-center text-sm font-medium text-safe underline underline-offset-2"
        >
          Go to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field id="signup-email" label="Email">
          <Input
            id="signup-email"
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

        <div className="flex flex-col gap-2">
          <Field
            id="signup-password"
            label="Account password"
            hint="This is your sign-in password. You’ll create a separate master password next."
          >
            <PasswordInput
              id="signup-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              mono={false}
              minLength={MIN_PASSWORD_LENGTH}
              required
              aria-describedby="signup-password-hint"
            />
          </Field>
          {password ? <StrengthMeter result={strength} /> : null}
        </div>

        <Field id="signup-confirm" label="Confirm password" error={error}>
          <PasswordInput
            id="signup-confirm"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
            mono={false}
            required
            invalid={Boolean(error)}
            aria-describedby={error ? 'signup-confirm-error' : undefined}
          />
        </Field>

        <Button type="submit" variant="primary" fullWidth loading={busy}>
          Create account
        </Button>
      </form>

      {GOOGLE_AUTH_ENABLED ? (
        <>
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-xs text-ink-muted">or</span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <OAuthButton next="/vault" />
        </>
      ) : null}
    </div>
  )
}
