'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { authErrorMessage } from '@/lib/supabase/auth-errors'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

// Supabase's email codes are six digits by default; the project setting
// allows up to ten.
const CODE_PATTERN = /^\d{6,10}$/

export function ForgotForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)

    const supabase = createClient()
    // The result is deliberately ignored: telling someone whether an account
    // exists is an account-enumeration leak.
    await supabase.auth
      .resetPasswordForEmail(email, {
        // Supabase's default template sends a `code` that the callback route
        // exchanges. The templates in README.md replace that with a link to
        // /auth/confirm plus a typed code; both work on any device.
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      })
      .catch(() => undefined)

    setSent(true)
    setBusy(false)
  }

  // The emailed link is single-use, and some mailboxes' security scanners
  // press the button on the Continue page before the person can. A code is
  // not a link, so nothing can spend it first.
  const handleCode = async (event: React.FormEvent) => {
    event.preventDefault()
    setCodeError(null)

    const token = code.replace(/\s/g, '')
    if (!CODE_PATTERN.test(token)) {
      setCodeError('Enter the 6-digit code from the email.')
      return
    }

    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'recovery' })
    if (error) {
      setCodeError(authErrorMessage(error).message)
      setBusy(false)
      return
    }

    // The browser now holds a session; the reset page checks for it.
    router.replace('/reset-password')
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="text-ink">
            If an account exists for that email, we’ve sent it a message with a button and a
            6-digit code. Press the button, or type the code here.
          </p>
          <p className="text-sm text-ink-muted">
            Only the newest email counts. This changes your sign-in password only; your master
            password stays the same.
          </p>
        </div>

        <form onSubmit={handleCode} className="flex flex-col gap-4">
          <Field id="forgot-code" label="Code from the email" error={codeError}>
            <Input
              id="forgot-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={12}
              secret
              required
              autoFocus
              invalid={Boolean(codeError)}
              aria-describedby={codeError ? 'forgot-code-error' : undefined}
            />
          </Field>

          <Button type="submit" variant="primary" fullWidth loading={busy}>
            Continue
          </Button>
        </form>

        <Link
          href="/login"
          className="text-center text-sm text-ink-muted underline underline-offset-2 transition-colors hover:text-ink"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSend} className="flex flex-col gap-4">
      <Field id="forgot-email" label="Email">
        <Input
          id="forgot-email"
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

      <Button type="submit" variant="primary" fullWidth loading={busy}>
        Send reset email
      </Button>

      <Link
        href="/login"
        className="text-center text-sm text-ink-muted underline underline-offset-2 transition-colors hover:text-ink"
      >
        Back to sign in
      </Link>
    </form>
  )
}
