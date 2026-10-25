import { cn } from '@/lib/utils'
import type { StrengthResult, StrengthScore } from '@/lib/password/strength'

/**
 * Five segments, the label and the first warning.
 * Colour is never the only signal: the label always spells it out.
 */

const SEGMENT_COLOURS: Record<StrengthScore, string> = {
  0: 'bg-danger',
  1: 'bg-danger',
  2: 'bg-warn',
  3: 'bg-ok',
  4: 'bg-ok',
}

const LABEL_COLOURS: Record<StrengthScore, string> = {
  0: 'text-danger',
  1: 'text-danger',
  2: 'text-warn',
  3: 'text-ok',
  4: 'text-ok',
}

export interface StrengthMeterProps {
  result: StrengthResult
  /** Show entropy and crack time under the meter. */
  detailed?: boolean
  className?: string
}

export function StrengthMeter({ result, detailed = false, className }: StrengthMeterProps) {
  const filled = result.score + 1

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center gap-2">
        <div className="flex h-1.5 flex-1 gap-1" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((index) => (
            <span
              key={index}
              className={cn(
                'flex-1 rounded-full transition-colors duration-200',
                index < filled ? SEGMENT_COLOURS[result.score] : 'bg-surface-2',
              )}
            />
          ))}
        </div>
        <span className={cn('shrink-0 text-sm font-semibold', LABEL_COLOURS[result.score])}>
          {result.label}
        </span>
      </div>

      {detailed ? (
        <p className="tabular text-sm text-ink-muted">
          {Math.round(result.entropyBits)} bits · cracked in {result.crackTime}
        </p>
      ) : null}

      {result.warnings.length > 0 ? (
        <p className="text-sm text-ink-muted">{result.warnings[0]}</p>
      ) : null}
    </div>
  )
}
