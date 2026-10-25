'use client'

import { useMemo, useState } from 'react'
import { Download, Printer, WandSparkles } from 'lucide-react'
import { APP_NAME } from '@/lib/config'
import { siteUrl } from '@/lib/env'
import { cn, nextTwoFrames, sleep } from '@/lib/utils'
import { KDF_DEFAULTS, recoveryVaultKeyAad, vaultKeyAad } from '@/lib/crypto/constants'
import { toBase64 } from '@/lib/crypto/bytes'
import {
  deriveMasterKek,
  deriveRecoveryKek,
  generateVaultKey,
  newKdfSalt,
  unwrapVaultKey,
  verifyWrappedKey,
  wrapVaultKey,
  type WrappedKey,
} from '@/lib/crypto/keys'
import { generateRecoveryKey, recoveryKeyTail } from '@/lib/crypto/recovery-key'
import { suggestMasterPassphrase } from '@/lib/password/generator'
import {
  estimateStrength,
  masterPasswordCaution,
  masterPasswordProblem,
} from '@/lib/password/strength'
import { createClient } from '@/lib/supabase/client'
import { insertKeyset } from '@/lib/vault/api'
import { unlockSession } from '@/lib/vault/store'
import { buildEmergencyKit, downloadEmergencyKit } from '@/lib/vault/export'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { useToast } from '@/components/ui/toast'
import { Dial, type DialState } from '@/components/brand/dial'
import { SecretText } from '@/components/vault/secret-text'
import { StrengthMeter } from '@/components/vault/strength-meter'
import { CopyButton } from '@/components/vault/copy-button'

/**
 * First-time setup.
 *
 * Nothing is written to the server until step 2's "Create vault". If the tab
 * closes before then, nothing was saved and setup simply starts again.
 *
 * Both wrapped copies of the vault key are round-tripped before the row is
 * inserted: a keyset that can't be unwrapped would lock the user out forever.
 */

type Step = 1 | 2 | 3

interface PreparedKeys {
  salt: Uint8Array<ArrayBuffer>
  masterKek: CryptoKey
  recoveryKek: CryptoKey
  /** Extractable only until the row is inserted; dropped immediately after. */
  vaultKey: CryptoKey
  recoveryKeyText: string
  wrapped: WrappedKey
  recoveryWrapped: WrappedKey
}

export interface SetupWizardProps {
  userId: string
  email: string | null
  /** Hands control back to the gate once the vault is open. */
  onReady: (destination?: 'new-login' | 'import') => void
}

export function SetupWizard({ userId, email, onReady }: SetupWizardProps) {
  const { toast } = useToast()
  const [step, setStep] = useState<Step>(1)
  const [dial, setDial] = useState<DialState>('idle')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [revealSuggestion, setRevealSuggestion] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [prepared, setPrepared] = useState<PreparedKeys | null>(null)
  const [tail, setTail] = useState('')

  const strength = useMemo(
    () => estimateStrength(password, { email: email ?? undefined }),
    [password, email],
  )
  const caution = useMemo(() => masterPasswordCaution(password, email), [password, email])

  const site = siteUrl()
  const kitText = prepared
    ? buildEmergencyKit({
        appName: APP_NAME,
        siteUrl: site,
        email: email ?? 'your account',
        recoveryKey: prepared.recoveryKeyText,
      })
    : ''

  // ---------------------------------------------------------------- step 1 --

  const handleSuggest = async () => {
    const suggestion = await suggestMasterPassphrase()
    setPassword(suggestion.value)
    setConfirm(suggestion.value)
    setRevealSuggestion(true)
    setError(null)
  }

  const handleCreateKeys = async (event: React.FormEvent) => {
    event.preventDefault()
    const problem = masterPasswordProblem(password, confirm, email)
    if (problem) {
      setError(problem)
      return
    }
    if (!acknowledged) {
      setError('Please confirm you understand that nobody can reset your master password.')
      return
    }

    setError(null)
    setBusy(true)
    setDial('working')
    // Let the dial start turning before Argon2id blocks the main thread.
    await nextTwoFrames()

    try {
      const salt = newKdfSalt()
      const masterKek = await deriveMasterKek(password, salt, KDF_DEFAULTS)
      const vaultKey = await generateVaultKey()
      const recoveryKey = generateRecoveryKey()
      const recoveryKek = await deriveRecoveryKek(recoveryKey.bytes)

      const wrapped = await wrapAndVerify(vaultKey, masterKek, vaultKeyAad(userId))
      const recoveryWrapped = await wrapAndVerify(
        vaultKey,
        recoveryKek,
        recoveryVaultKeyAad(userId),
      )

      setPrepared({
        salt,
        masterKek,
        recoveryKek,
        vaultKey,
        recoveryKeyText: recoveryKey.text,
        wrapped,
        recoveryWrapped,
      })
      setDial('idle')
      setStep(2)
    } catch (cause) {
      setDial('error')
      setError(
        cause instanceof Error
          ? cause.message
          : 'Couldn’t prepare your keys. Reload the page and try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  // ---------------------------------------------------------------- step 2 --

  const handleCreateVault = async () => {
    if (!prepared) return
    if (recoveryKeyTail(tail) !== recoveryKeyTail(prepared.recoveryKeyText)) {
      setError('Those four characters don’t match. Check the key above.')
      return
    }

    setError(null)
    setBusy(true)
    try {
      const supabase = createClient()
      const keyset = await insertKeyset(supabase, userId, {
        kdf_salt: toBase64(prepared.salt),
        kdf_memory_kib: KDF_DEFAULTS.memoryKiB,
        kdf_iterations: KDF_DEFAULTS.iterations,
        kdf_parallelism: KDF_DEFAULTS.parallelism,
        wrapped_key: prepared.wrapped.wrapped,
        wrapped_key_iv: prepared.wrapped.iv,
        recovery_wrapped_key: prepared.recoveryWrapped.wrapped,
        recovery_wrapped_key_iv: prepared.recoveryWrapped.iv,
      })

      // Unwrap our own wrapper to get the non-extractable copy for the session.
      const sessionKey = await unwrapVaultKey(
        prepared.wrapped.wrapped,
        prepared.wrapped.iv,
        prepared.masterKek,
        vaultKeyAad(userId),
        false,
      )

      unlockSession({ userId, email, key: sessionKey, keyset, items: [] })

      // Drop every extractable reference as soon as the flow ends.
      setPrepared(null)
      setPassword('')
      setConfirm('')

      setDial('success')
      await sleep(450)
      setStep(3)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Couldn’t create your vault. Nothing was saved.',
      )
    } finally {
      setBusy(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownload = () => {
    if (!prepared) return
    downloadEmergencyKit({
      appName: APP_NAME,
      siteUrl: site,
      email: email ?? 'your account',
      recoveryKey: prepared.recoveryKeyText,
    })
    toast({ message: 'Emergency Kit downloaded', tone: 'success' })
  }

  // ----------------------------------------------------------------- views --

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-10">
      <ol className="no-print mb-8 flex items-center gap-2" aria-label="Setup progress">
        {([1, 2, 3] as const).map((value) => (
          <li key={value} className="flex items-center gap-2">
            <span
              aria-current={step === value ? 'step' : undefined}
              className={cn(
                'tabular inline-flex size-7 items-center justify-center rounded-full border text-sm font-semibold',
                step === value
                  ? 'border-transparent bg-primary text-on-primary'
                  : step > value
                    ? 'border-ok/50 bg-surface-2 text-ok'
                    : 'border-line bg-surface text-ink-muted',
              )}
            >
              {value}
            </span>
            {value < 3 ? <span aria-hidden="true" className="h-px w-6 bg-line" /> : null}
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <form onSubmit={handleCreateKeys} className="no-print w-full">
          <Dial state={dial} statusText={dial === 'working' ? 'Making your key…' : ''} />

          <h1 className="plate mt-6 text-center text-2xl text-ink">Create your master password</h1>
          <p className="mt-3 text-ink-muted">
            Your account password signs you in. Your master password unlocks your vault and never
            leaves this device. Nobody, including us, can reset it.
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            Please don’t reuse your account password here.
          </p>

          <div className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Field id="setup-master" label="Master password">
                {revealSuggestion ? (
                  <Input
                    id="setup-master"
                    type="text"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value)
                      setRevealSuggestion(false)
                    }}
                    autoComplete="new-password"
                    secret
                    className="mono"
                    autoFocus
                  />
                ) : (
                  <PasswordInput
                    id="setup-master"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    autoFocus
                  />
                )}
              </Field>
              {password ? (
                <>
                  <StrengthMeter result={strength} detailed />
                  {caution ? <p className="text-sm text-warn">{caution}</p> : null}
                </>
              ) : null}
              <button
                type="button"
                onClick={handleSuggest}
                className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-safe underline underline-offset-2"
              >
                <WandSparkles aria-hidden="true" className="size-4" />
                Suggest a passphrase
              </button>
            </div>

            <Field id="setup-confirm" label="Confirm master password" error={error}>
              <PasswordInput
                id="setup-confirm"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="new-password"
                invalid={Boolean(error)}
                aria-describedby={error ? 'setup-confirm-error' : undefined}
              />
            </Field>

            <label className="flex items-start gap-3 rounded-field border border-line bg-surface p-3">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
                className="mt-1 size-4 shrink-0 accent-[var(--primary)]"
              />
              <span className="text-sm text-ink">
                I understand nobody can reset my master password.
              </span>
            </label>

            <Button type="submit" variant="primary" fullWidth loading={busy} size="lg">
              Continue
            </Button>
          </div>
        </form>
      ) : null}

      {step === 2 && prepared ? (
        <div className="w-full">
          <div className="no-print">
            <h1 className="plate text-2xl text-ink">Save your Recovery Key</h1>
            <p className="mt-3 text-ink-muted">
              This is the only way back in if you forget your master password. Write it down, print
              it, or keep it in a safe place offline. We don’t have a copy.
            </p>

            <div className="mt-6 rounded-panel border border-brass/50 bg-surface p-5">
              <SecretText value={prepared.recoveryKeyText} size="lg" className="tracking-wide" />
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <CopyButton value={prepared.recoveryKeyText} label="Recovery Key" />
                <Button onClick={handleDownload} size="sm">
                  <Download aria-hidden="true" className="size-4" />
                  Download Emergency Kit
                </Button>
                <Button onClick={handlePrint} size="sm">
                  <Printer aria-hidden="true" className="size-4" />
                  Print
                </Button>
              </div>
            </div>

            <div className="mt-6">
              <Field
                id="setup-tail"
                label="Type the last 4 characters to confirm you saved it"
                error={error}
              >
                <Input
                  id="setup-tail"
                  value={tail}
                  onChange={(event) => setTail(event.target.value.toUpperCase().slice(0, 4))}
                  maxLength={4}
                  secret
                  autoComplete="off"
                  className="mono w-28 text-center text-lg tracking-[0.3em]"
                  invalid={Boolean(error)}
                  aria-describedby={error ? 'setup-tail-error' : undefined}
                />
              </Field>
            </div>

            <Button
              variant="primary"
              fullWidth
              size="lg"
              className="mt-5"
              loading={busy}
              disabled={tail.length < 4}
              onClick={handleCreateVault}
            >
              Create vault
            </Button>
          </div>

          {/* Printed by window.print(); hidden on screen. */}
          <div className="print-only print-root">{kitText}</div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="no-print flex w-full flex-col items-center">
          <Dial state="success" statusText="Vault created" />
          <h1 className="plate mt-6 text-center text-2xl text-ink">Your vault is ready</h1>
          <p className="mt-3 text-center text-ink-muted">
            Add something to it, or bring across the passwords your browser has been keeping.
          </p>
          <div className="mt-7 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Button variant="primary" size="lg" onClick={() => onReady('new-login')}>
              Add your first login
            </Button>
            <Button size="lg" onClick={() => onReady('import')}>
              Import from your browser
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Wrap, then prove the wrapper opens again before anyone depends on it. */
async function wrapAndVerify(
  vaultKey: CryptoKey,
  kek: CryptoKey,
  aad: string,
): Promise<WrappedKey> {
  const wrapped = await wrapVaultKey(vaultKey, kek, aad)
  await verifyWrappedKey(wrapped, kek, aad)
  return wrapped
}
