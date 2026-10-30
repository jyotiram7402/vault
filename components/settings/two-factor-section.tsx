'use client'

import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { CopyButton } from '@/components/vault/copy-button'
import { SettingsSection } from '@/components/settings/section'

/**
 * Two-factor sign-in, through Supabase MFA.
 *
 * This also protects the ciphertext: the restrictive Row Level Security policy
 * refuses vault data to an aal1 session of an account that has 2FA on, so a
 * stolen account password alone can't even download the encrypted rows.
 */

interface Enrolment {
  factorId: string
  qrCode: string
  secret: string
}

export function TwoFactorSection() {
  const { toast } = useToast()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data, error: listError } = await supabase.auth.mfa.listFactors()
      if (listError) throw listError
      const verified = data?.totp?.find((factor) => factor.status === 'verified') ?? null
      setEnabled(Boolean(verified))
      setFactorId(verified?.id ?? null)
    } catch {
      setEnabled(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const startEnrolment = async () => {
    setBusy(true)
    setError(null)
    try {
      const supabase = createClient()

      // Enrolment fails if an unverified factor with the same name exists, so
      // clear those out first and use a name that can't collide.
      const { data: existing } = await supabase.auth.mfa.listFactors()
      for (const factor of existing?.totp ?? []) {
        if (factor.status !== 'verified') {
          await supabase.auth.mfa.unenroll({ factorId: factor.id })
        }
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Authenticator ${new Date().toISOString()}`,
      })
      if (enrollError) throw enrollError
      if (!data) throw new Error('Couldn’t start two-factor setup.')

      setEnrolment({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Couldn’t start two-factor setup.')
    } finally {
      setBusy(false)
    }
  }

  const verify = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!enrolment) return

    setBusy(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrolment.factorId,
        code,
      })
      if (verifyError) throw verifyError

      setEnrolment(null)
      setCode('')
      await load()
      toast({ message: 'Two-factor sign-in is on', tone: 'success' })
    } catch {
      setError('That code didn’t work. Codes change every 30 seconds.')
    } finally {
      setBusy(false)
    }
  }

  const turnOff = async () => {
    if (!factorId) return
    setBusy(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId })
      if (unenrollError) throw unenrollError
      await load()
      toast({ message: 'Two-factor sign-in is off' })
    } catch {
      setError(
        'Couldn’t turn two-factor off. Sign out and back in with your code, then try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  if (enabled === null) return null

  return (
    <SettingsSection
      id="two-factor"
      title="Two-factor sign-in"
      description="A code from an authenticator app, on top of your account password."
    >
      {enrolment ? (
        <form onSubmit={verify} className="flex flex-col gap-4">
          <p className="text-sm text-ink">
            Scan this with your authenticator app, then enter the code it shows.
          </p>
          {/* A data: URL from Supabase, which is why img-src allows data:. */}
          <img
            src={enrolment.qrCode}
            alt="QR code for setting up your authenticator app"
            width={200}
            height={200}
            className="rounded-field border border-line bg-white p-2"
          />
          <div className="flex items-center gap-2">
            <code className="mono secret min-w-0 flex-1 rounded-field border border-line bg-bg px-3 py-2 text-sm break-all text-ink">
              {enrolment.secret}
            </code>
            <CopyButton value={enrolment.secret} label="Setup key" size="sm" />
          </div>

          <Field id="mfa-enroll-code" label="Six-digit code" error={error}>
            <Input
              id="mfa-enroll-code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              secret
              autoFocus
              className="mono w-40 text-center text-lg tracking-[0.3em]"
              invalid={Boolean(error)}
              aria-describedby={error ? 'mfa-enroll-code-error' : undefined}
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" loading={busy} disabled={code.length !== 6}>
              Turn on two-factor
            </Button>
            <Button
              onClick={() => {
                setEnrolment(null)
                setCode('')
                setError(null)
              }}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : enabled ? (
        <div className="flex flex-col gap-3">
          <Badge tone="ok" className="self-start">
            <ShieldCheck aria-hidden="true" className="size-3.5" />
            On — authenticator app
          </Badge>
          <p className="text-sm text-ink-muted">
            While this is on, the server refuses to hand over even your encrypted data until you
            have entered a code.
          </p>
          {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
          <Button className="self-start" onClick={() => void turnOff()} loading={busy}>
            Turn off two-factor
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Badge className="self-start">Off</Badge>
          {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
          <Button className="self-start" onClick={() => void startEnrolment()} loading={busy}>
            Turn on two-factor
          </Button>
        </div>
      )}
    </SettingsSection>
  )
}
