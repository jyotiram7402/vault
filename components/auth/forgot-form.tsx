'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export function ForgotForm() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)

    const supabase = createClient()
    // The result is deliberately ignored: telling someone whether an account
    // exists is an account-enumeration leak.
    await supabase.auth
      .resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      .catch(() => undefined)

    setSent(true)
    setBusy(false)
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-ink">
          If an account exists for that email, we’ve sent a link to reset your sign-in password.
        </p>
        <p className="text-sm text-ink-muted">
          The link changes your sign-in password only. Your master password stays the same.
        </p>
        <Link
          href="/login"
          className="text-center text-sm font-medium text-safe underline underline-offset-2"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
        Send reset link
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
