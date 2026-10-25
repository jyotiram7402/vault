import { cn } from '@/lib/utils'

/**
 * A revealed secret, in the monospace face.
 *
 * Digits are tinted with --safe and symbols with --warn so a long random
 * password can be read off the screen or copied by hand without miscounting.
 * Carries the `secret` class, which the privacy screen blurs when the window
 * loses focus.
 */

type RunKind = 'digit' | 'symbol' | 'letter'

function kindOf(character: string): RunKind {
  if (character >= '0' && character <= '9') return 'digit'
  if (/[a-zA-Z]/.test(character)) return 'letter'
  return 'symbol'
}

const RUN_CLASSES: Record<RunKind, string> = {
  digit: 'text-safe',
  symbol: 'text-warn',
  letter: '',
}

function toRuns(value: string): { text: string; kind: RunKind }[] {
  const runs: { text: string; kind: RunKind }[] = []
  for (const character of value) {
    const kind = kindOf(character)
    const last = runs[runs.length - 1]
    if (last && last.kind === kind) last.text += character
    else runs.push({ text: character, kind })
  }
  return runs
}

export interface SecretTextProps {
  value: string
  className?: string
  /** Larger face for the generator result and the Recovery Key. */
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl sm:text-2xl',
} as const

export function SecretText({ value, className, size = 'md' }: SecretTextProps) {
  return (
    <span className={cn('mono secret break-all', SIZES[size], className)}>
      {toRuns(value).map((run, index) => (
        <span key={index} className={RUN_CLASSES[run.kind]}>
          {run.text}
        </span>
      ))}
    </span>
  )
}
