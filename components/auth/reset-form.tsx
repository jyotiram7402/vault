'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { authErrorMessage } from '@/lib/supabase/auth-errors'
import { estimateStrength } from '@/lib/password/strength'
import { focusFirstInvalid } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { PasswordInput } from '@/components/ui/password-input'
import { StrengthMeter } from '@/components/vault/strength-meter'
import { useToast } from '@/components/ui/toast'
import { MfaChallenge } from '@/components/auth/mfa-challenge'

const MIN_PASSWORD_LENGTH = 12

/**
 * How the session on this page was created, as Supabase records it.
 *
 * Supabase's POST /verify records "otp" for a reset link and for a typed reset
 * code alike, and its own idea of a recovery session counts otp, magiclink and
 * recovery. Anything else — an ordinary password sign-in — must not be able to
 * change the password here without the current one; Settings does that.
 */
const EMAIL_METHODS = new Set(['otp', 'magiclink', 'recovery'])

/** How long after the email link or code this page still accepts a new password. */
const EMAIL_WINDOW_SECONDS = 15 * 60

type SessionState = 'checking' | 'ready' | 'needs-mfa' | 'not-from-email' | 'expired'

const PRIMARY_LINK =
  'inline-flex h-11 items-center justify-center rounded-btn bg-primary px-4 font-semibold text-on-primary transition-[filter] hover:brightness-110'
const SECONDARY_LINK =
  'inline-flex h-11 items-center justify-center rounded-btn border border-line-strong bg-surface px-4 font-semibold text-ink transition-colors hover:bg-surface-2'

export function ResetForm() {
  const router = useRouter()
  const { toast } = useToast()
  const [sessionState, setSessionState] = useState<SessionState>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const strength = useMemo(() => estimateStrength(password), [password])

  useEffect(() => {
    let active = true
    const supabase = createClient()

    // Deciding what to show only. The server enforces the same rule when
    // "Require current password when updating" is on in Supabase.
    const inspect = async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError || !sessionData.session) {
          if (active) setSessionState('expired')
          return
        }

        const { data: aal, error: aalError } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (aalError || !aal) throw aalError ?? new Error('No assurance level')

        const now = Date.now() / 1000
        const fromEmail = aal.currentAuthenticationMethods.some(
          (entry) => EMAIL_METHODS.has(entry.method) && now - entry.timestamp < EMAIL_WINDOW_SECONDS,
        )

        if (!active) return
        if (!fromEmail) setSessionState('not-from-email')
        // Supabase refuses a new password from an aal1 session once two-factor
        // is on, so the code comes first.
        else if (aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') setSessionState('needs-mfa')
        else setSessionState('ready')
      } catch {
        if (active) setSessionState('expired')
      }
    }

    void inspect()
    return () => {
      active = false
    }
  }, [])

  const handleSignOut = async () => {
    try {
      await createClient().auth.signOut({ scope: 'local' })
    } catch {
      // Already signed out, or offline.
    }
    router.replace('/login')
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const form = event.currentTarget
    setError(null)

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
      void focusFirstInvalid(form)
      return
    }
    if (password !== confirm) {
      setError('The two passwords don’t match.')
      void focusFirstInvalid(form)
      return
    }

    setBusy(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(authErrorMessage(updateError).message)
      setBusy(false)
      void focusFirstInvalid(form)
      return
    }

    toast({ message: 'Password updated', tone: 'success' })
    router.replace('/vault')
    router.refresh()
  }

  if (sessionState === 'checking') {
    return <p className="text-ink-muted">Checking your link…</p>
  }

  if (sessionState === 'expired') {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-ink">This link has expired. Request a new one.</p>
        <Link href="/forgot-password" className={PRIMARY_LINK}>
          Send a new link
        </Link>
      </div>
    )
  }

  if (sessionState === 'not-from-email') {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-ink">This page only works straight after you open a reset email.</p>
        <p className="text-sm text-ink-muted">
          If you know your current sign-in password, change it in Settings, under Account. If you
          don’t, send yourself a reset email.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/forgot-password" className={PRIMARY_LINK}>
            Send a reset email
          </Link>
          <Link href="/vault/settings" className={SECONDARY_LINK}>
            Open Settings
          </Link>
        </div>
      </div>
    )
  }

  if (sessionState === 'needs-mfa') {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-ink-muted">
          Two-factor sign-in is on for this account. Enter the code from your authenticator app,
          then choose your new password.
        </p>
        <MfaChallenge
          onVerified={() => setSessionState('ready')}
          onSignOut={() => void handleSignOut()}
        />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="rounded-field border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink-muted">
        This changes your sign-in password only. Your master password stays the same.
      </p>

      <div className="flex flex-col gap-2">
        <Field id="reset-password" label="New sign-in password">
          <PasswordInput
            id="reset-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            mono={false}
            minLength={MIN_PASSWORD_LENGTH}
            required
            autoFocus
          />
        </Field>
        {password ? <StrengthMeter result={strength} /> : null}
      </div>

      <Field id="reset-confirm" label="Confirm password" error={error}>
        <PasswordInput
          id="reset-confirm"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          autoComplete="new-password"
          mono={false}
          required
          invalid={Boolean(error)}
          aria-describedby={error ? 'reset-confirm-error' : undefined}
        />
      </Field>

      <Button type="submit" variant="primary" fullWidth loading={busy}>
        Update password
      </Button>
    </form>
  )
}
