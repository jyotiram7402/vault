'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { authErrorMessage } from '@/lib/supabase/auth-errors'
import { estimateStrength } from '@/lib/password/strength'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { PasswordInput } from '@/components/ui/password-input'
import { StrengthMeter } from '@/components/vault/strength-meter'
import { useToast } from '@/components/ui/toast'

const MIN_PASSWORD_LENGTH = 12

type SessionState = 'checking' | 'ready' | 'expired'

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

    // The email link creates a session before this page loads. In the browser
    // getSession() is fine for deciding what to render; data access is still
    // protected by Row Level Security.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return
        setSessionState(data.session ? 'ready' : 'expired')
      })
      .catch(() => {
        if (active) setSessionState('expired')
      })

    return () => {
      active = false
    }
  }, [])

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
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(authErrorMessage(updateError).message)
      setBusy(false)
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
        <Link
          href="/forgot-password"
          className="inline-flex h-11 items-center justify-center rounded-btn bg-primary px-4 font-semibold text-on-primary transition-[filter] hover:brightness-110"
        >
          Send a new link
        </Link>
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
