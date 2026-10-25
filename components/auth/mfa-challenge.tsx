'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

/**
 * The second step of signing in for accounts with two-factor on.
 *
 * Submits as soon as six digits are present, because retyping a code that has
 * already rotated is the most common failure here.
 */
export function MfaChallenge({
  onVerified,
  onSignOut,
}: {
  onVerified: () => void
  onSignOut: () => void
}) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submittedFor = useRef<string | null>(null)

  const verify = useCallback(
    async (value: string) => {
      setBusy(true)
      setError(null)
      try {
        const supabase = createClient()
        const { data: factors, error: listError } = await supabase.auth.mfa.listFactors()
        if (listError) throw listError

        const factor = factors?.totp?.find((item) => item.status === 'verified') ?? factors?.totp?.[0]
        if (!factor) {
          setError('No authenticator app is set up on this account.')
          return
        }

        const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
          factorId: factor.id,
          code: value,
        })
        if (verifyError) {
          setError('That code didn’t work. Codes change every 30 seconds.')
          setCode('')
          submittedFor.current = null
          return
        }
        onVerified()
      } catch {
        setError('That code didn’t work. Codes change every 30 seconds.')
        setCode('')
        submittedFor.current = null
      } finally {
        setBusy(false)
      }
    },
    [onVerified],
  )

  useEffect(() => {
    if (code.length === 6 && submittedFor.current !== code && !busy) {
      submittedFor.current = code
      void verify(code)
    }
  }, [code, busy, verify])

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (code.length === 6) void verify(code)
      }}
      className="flex flex-col gap-4"
    >
      <Field
        id="mfa-code"
        label="Six-digit code"
        hint="Open your authenticator app and enter the current code."
        error={error}
      >
        <Input
          id="mfa-code"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          autoFocus
          secret
          invalid={Boolean(error)}
          aria-describedby={error ? 'mfa-code-error' : 'mfa-code-hint'}
          className="mono text-center text-xl tracking-[0.4em]"
        />
      </Field>

      <Button type="submit" variant="primary" fullWidth loading={busy} disabled={code.length !== 6}>
        Verify
      </Button>

      <button
        type="button"
        onClick={onSignOut}
        className="text-sm text-ink-muted underline underline-offset-2 transition-colors hover:text-ink"
      >
        Sign out
      </button>
    </form>
  )
}
