import { APP_NAME } from '@/lib/config'
import { cn } from '@/lib/utils'

/** The twelve tick marks of the simplified mark, pre-computed. */
const TICKS = Array.from({ length: 12 }, (_, index) => {
  const angle = (index * Math.PI) / 6
  const sin = Math.sin(angle)
  const cos = Math.cos(angle)
  return {
    x1: 32 + 16.5 * sin,
    y1: 32 - 16.5 * cos,
    x2: 32 + 20 * sin,
    y2: 32 - 20 * cos,
  }
})

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn('size-8 shrink-0', className)}
    >
      <circle cx="32" cy="32" r="21.5" fill="none" stroke="currentColor" strokeWidth="2.4" opacity="0.5" />
      <circle cx="32" cy="32" r="14" fill="currentColor" opacity="0.1" />
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        {TICKS.map((tick, index) => (
          <line
            key={index}
            x1={tick.x1.toFixed(2)}
            y1={tick.y1.toFixed(2)}
            x2={tick.x2.toFixed(2)}
            y2={tick.y2.toFixed(2)}
          />
        ))}
      </g>
      <path
        d="M32 24.6a4.4 4.4 0 0 1 2.42 8.07L36 40.4h-8l1.58-7.73A4.4 4.4 0 0 1 32 24.6z"
        fill="currentColor"
      />
    </svg>
  )
}

export interface LogoProps {
  className?: string
  markClassName?: string
  /** Hide the wordmark and keep only the dial. */
  markOnly?: boolean
}

export function Logo({ className, markClassName, markOnly = false }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-safe', className)}>
      <LogoMark className={markClassName} />
      {markOnly ? (
        <span className="sr-only">{APP_NAME}</span>
      ) : (
        <span className="plate text-xl text-ink">{APP_NAME}</span>
      )}
    </span>
  )
}
