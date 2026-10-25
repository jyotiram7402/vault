import { cn } from '@/lib/utils'

export type BadgeTone = 'neutral' | 'ok' | 'warn' | 'danger' | 'brass' | 'safe'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-ink-muted border-line',
  ok: 'bg-surface-2 text-ok border-ok/40',
  warn: 'bg-surface-2 text-warn border-warn/40',
  danger: 'bg-surface-2 text-danger border-danger/40',
  brass: 'bg-surface-2 text-brass border-brass/40',
  safe: 'bg-surface-2 text-safe border-safe/40',
}

export interface BadgeProps {
  tone?: BadgeTone
  className?: string
  children: React.ReactNode
}

export function Badge({ tone = 'neutral', className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-field border px-2 py-0.5 text-xs font-medium',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
