'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { authErrorMessage } from '@/lib/supabase/auth-errors'
import { postSessionMessage } from '@/lib/vault/broadcast'
import { lock } from '@/lib/vault/store'
import { useVault } from '@/lib/vault/use-vault'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { PasswordInput } from '@/components/ui/password-input'
import { useToast } from '@/components/ui/toast'
import { SettingsRow, SettingsSection } from '@/components/settings/section'

const MIN_PASSWORD_LENGTH = 12

export function AccountSection() {
  const router = useRouter()
  const { toast } = useToast()
  const { email } = useVault()

  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signOut = async (everywhere: boolean) => {
    lock('signout')
    postSessionMessage({ type: 'signout' })
    try {
      const supabase = createClient()
      await supabase.auth.signOut(everywhere ? { scope: 'global' } : undefined)
    } catch {
      // Already gone, or offline. The local lock is what protects the data.
    }
    router.replace('/')
  }

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (next.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (next !== confirm) {
      setError('The two passwords don’t match.')
      return
    }
    if (!email) {
      setError('This account has no email address to verify against.')
      return
    }

    setBusy(true)
    try {
      const supabase = createClient()
      // Prove they know the current password before changing it.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      })
      if (signInError) {
        setError('That current password is wrong.')
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: next })
      if (updateError) {
        setError(authErrorMessage(updateError).message)
        return
      }

      setCurrent('')
      setNext('')
      setConfirm('')
      setOpen(false)
      toast({ message: 'Sign-in password changed', tone: 'success' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsSection title="Account" description="Your sign-in, separate from your vault.">
      <div className="flex flex-col divide-y divide-line">
        <SettingsRow label="Email">
          <span className="secret text-sm text-ink-muted">{email ?? '—'}</span>
        </SettingsRow>

        <div className="py-3">
          {!open ? (
            <SettingsRow
              label="Sign-in password"
              description="This is not your master password; changing it leaves your vault untouched."
            >
              <Button onClick={() => setOpen(true)}>Change sign-in password</Button>
            </SettingsRow>
          ) : (
            <form onSubmit={changePassword} className="flex flex-col gap-4">
              <Field id="acct-current" label="Current sign-in password">
                <PasswordInput
                  id="acct-current"
                  value={current}
                  onChange={(event) => setCurrent(event.target.value)}
                  autoComplete="current-password"
                  mono={false}
                  required
                  autoFocus
                />
              </Field>
              <Field id="acct-next" label="New sign-in password">
                <PasswordInput
                  id="acct-next"
                  value={next}
                  onChange={(event) => setNext(event.target.value)}
                  autoComplete="new-password"
                  mono={false}
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                />
              </Field>
              <Field id="acct-confirm" label="Confirm new password" error={error}>
                <PasswordInput
                  id="acct-confirm"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  autoComplete="new-password"
                  mono={false}
                  required
                  invalid={Boolean(error)}
                  aria-describedby={error ? 'acct-confirm-error' : undefined}
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="primary" loading={busy}>
                  Change sign-in password
                </Button>
                <Button
                  onClick={() => {
                    setOpen(false)
                    setError(null)
                  }}
                  disabled={busy}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>

        <SettingsRow label="Sign out" description="Locks the vault on this device.">
          <Button onClick={() => void signOut(false)}>
            <LogOut aria-hidden="true" className="size-4" />
            Sign out
          </Button>
        </SettingsRow>

        <SettingsRow
          label="Sign out everywhere"
          description="Ends every session on every device, including ones you’ve lost."
        >
          <Button onClick={() => void signOut(true)}>Sign out everywhere</Button>
        </SettingsRow>
      </div>
    </SettingsSection>
  )
}
