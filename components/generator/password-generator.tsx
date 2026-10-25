'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Dices, History, RefreshCw, WandSparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DEFAULT_PASSPHRASE_OPTIONS,
  DEFAULT_RANDOM_OPTIONS,
  MAX_LENGTH,
  MAX_WORDS,
  MIN_LENGTH,
  MIN_WORDS,
  type GeneratedPassword,
  type PassphraseOptions,
  type RandomPasswordOptions,
  type Separator,
  generatePassphrase,
  generatePassword,
} from '@/lib/password/generator'
import { estimateStrength } from '@/lib/password/strength'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { Select } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { CopyButton } from '@/components/vault/copy-button'
import { SecretText } from '@/components/vault/secret-text'
import { StrengthMeter } from '@/components/vault/strength-meter'

type Mode = 'random' | 'passphrase'

const MODES = [
  { value: 'random' as const, label: 'Random' },
  { value: 'passphrase' as const, label: 'Passphrase' },
]

const SEPARATORS: { value: Separator; label: string }[] = [
  { value: '-', label: 'Hyphen  -' },
  { value: '.', label: 'Dot  .' },
  { value: '_', label: 'Underscore  _' },
  { value: ' ', label: 'Space' },
]

type CharacterSetKey = 'uppercase' | 'lowercase' | 'digits' | 'symbols'

const CHARACTER_SETS: { key: CharacterSetKey; label: string }[] = [
  { key: 'uppercase', label: 'Uppercase  A–Z' },
  { key: 'lowercase', label: 'Lowercase  a–z' },
  { key: 'digits', label: 'Numbers  0–9' },
  { key: 'symbols', label: 'Symbols  !@#$' },
]

/** An explicit switch keeps the spread typed; a computed key would not. */
function withSet(
  options: RandomPasswordOptions,
  key: CharacterSetKey,
  value: boolean,
): RandomPasswordOptions {
  switch (key) {
    case 'uppercase':
      return { ...options, uppercase: value }
    case 'lowercase':
      return { ...options, lowercase: value }
    case 'digits':
      return { ...options, digits: value }
    case 'symbols':
      return { ...options, symbols: value }
  }
}

const HISTORY_LIMIT = 5

export interface PasswordGeneratorProps {
  /** When present, shows a "Use password" button. */
  onUse?: (password: string) => void
  className?: string
}

/**
 * Used on the public /generator page, at /vault/generator, and inline in the
 * item form. The last five results are kept in component state only — they are
 * gone the moment the vault locks, because the whole tree unmounts.
 */
export function PasswordGenerator({ onUse, className }: PasswordGeneratorProps) {
  const [mode, setMode] = useState<Mode>('random')
  const [randomOptions, setRandomOptions] = useState<RandomPasswordOptions>(DEFAULT_RANDOM_OPTIONS)
  const [passphraseOptions, setPassphraseOptions] = useState<PassphraseOptions>(
    DEFAULT_PASSPHRASE_OPTIONS,
  )
  const [result, setResult] = useState<GeneratedPassword | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const record = useCallback((next: GeneratedPassword) => {
    setResult(next)
    setHistory((current) => [next.value, ...current.filter((v) => v !== next.value)].slice(0, HISTORY_LIMIT))
  }, [])

  const regenerate = useCallback(async () => {
    setError(null)
    try {
      if (mode === 'random') {
        record(generatePassword(randomOptions))
      } else {
        record(await generatePassphrase(passphraseOptions))
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Couldn’t generate a password.')
    }
  }, [mode, randomOptions, passphraseOptions, record])

  // Regenerate whenever the options change, and once on mount.
  useEffect(() => {
    void regenerate()
  }, [regenerate])

  const strength = useMemo(
    () =>
      estimateStrength(result?.value ?? '', {
        knownEntropyBits: result?.entropyBits,
      }),
    [result],
  )

  const enabledSetCount = CHARACTER_SETS.filter((set) => randomOptions[set.key]).length

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <Segmented value={mode} onChange={setMode} options={MODES} label="Password type" />

      {/* The result */}
      <div className="rounded-panel border border-line bg-surface p-4">
        <div className="flex min-h-14 items-start gap-2">
          <div className="min-w-0 flex-1 py-1">
            {result ? (
              <SecretText value={result.value} size="lg" />
            ) : (
              <span className="text-ink-muted">Generating…</span>
            )}
          </div>
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => void regenerate()}
              aria-label="Regenerate"
              title="Regenerate"
              className="inline-flex size-11 items-center justify-center rounded-btn text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <RefreshCw aria-hidden="true" className="size-4" />
            </button>
            {result ? <CopyButton value={result.value} label="Password" /> : null}
          </div>
        </div>

        {error ? <p className="mt-2 text-sm font-medium text-danger">{error}</p> : null}

        {result ? <StrengthMeter result={strength} detailed className="mt-3" /> : null}

        {onUse && result ? (
          <Button variant="primary" className="mt-4" onClick={() => onUse(result.value)}>
            <WandSparkles aria-hidden="true" className="size-4" />
            Use password
          </Button>
        ) : null}
      </div>

      {/* Options */}
      {mode === 'random' ? (
        <div className="flex flex-col gap-4">
          <Slider
            label="Length"
            min={MIN_LENGTH}
            max={MAX_LENGTH}
            value={randomOptions.length}
            onChange={(length) => setRandomOptions((current) => ({ ...current, length }))}
          />
          <div className="flex flex-col divide-y divide-line">
            {CHARACTER_SETS.map((set) => {
              const checked = randomOptions[set.key]
              const isLastOn = checked && enabledSetCount === 1
              return (
                <Switch
                  key={set.key}
                  label={set.label}
                  checked={checked}
                  disabled={isLastOn}
                  description={isLastOn ? 'At least one kind of character is needed.' : undefined}
                  onChange={(value) => setRandomOptions((current) => withSet(current, set.key, value))}
                  className="py-2.5"
                />
              )
            })}
            <Switch
              label="Avoid look-alikes"
              description="Leaves out I l 1 O 0 o |"
              checked={randomOptions.avoidLookAlikes}
              onChange={(avoidLookAlikes) =>
                setRandomOptions((current) => ({ ...current, avoidLookAlikes }))
              }
              className="py-2.5"
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Slider
            label="Words"
            min={MIN_WORDS}
            max={MAX_WORDS}
            value={passphraseOptions.words}
            onChange={(words) => setPassphraseOptions((current) => ({ ...current, words }))}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="generator-separator" className="text-sm font-medium text-ink">
              Separator
            </label>
            <Select
              id="generator-separator"
              options={SEPARATORS}
              value={passphraseOptions.separator}
              onChange={(event) =>
                setPassphraseOptions((current) => ({
                  ...current,
                  separator: event.target.value as Separator,
                }))
              }
            />
          </div>
          <div className="flex flex-col divide-y divide-line">
            <Switch
              label="Capitalise words"
              checked={passphraseOptions.capitalize}
              onChange={(capitalize) =>
                setPassphraseOptions((current) => ({ ...current, capitalize }))
              }
              className="py-2.5"
            />
            <Switch
              label="Add a digit"
              checked={passphraseOptions.addDigit}
              onChange={(addDigit) => setPassphraseOptions((current) => ({ ...current, addDigit }))}
              className="py-2.5"
            />
          </div>
        </div>
      )}

      {/* Recent results, memory only */}
      {history.length > 1 ? (
        <details className="rounded-panel border border-line bg-surface">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium text-ink">
            <History aria-hidden="true" className="size-4 text-ink-muted" />
            Recent in this session
          </summary>
          <ul className="hairline-y border-t border-line">
            {history.slice(1).map((value) => (
              <li key={value} className="flex items-center gap-2 px-4 py-2">
                <SecretText value={value} size="sm" className="min-w-0 flex-1" />
                <CopyButton value={value} label="Password" size="sm" />
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-4 py-2 text-sm text-ink-muted">
            <Dices aria-hidden="true" className="mr-1.5 inline size-3.5" />
            Kept in memory only. They disappear when you close this page.
          </p>
        </details>
      ) : null}
    </div>
  )
}
