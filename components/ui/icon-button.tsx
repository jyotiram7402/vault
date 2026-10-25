import { cn } from '@/lib/utils'

export type IconButtonTone = 'default' | 'danger' | 'primary'

const TONES: Record<IconButtonTone, string> = {
  default: 'text-ink-muted hover:text-ink hover:bg-surface-2',
  danger: 'text-danger hover:bg-surface-2',
  primary: 'text-safe hover:bg-surface-2',
}

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only controls have no visible text. */
  label: string
  tone?: IconButtonTone
  active?: boolean
}

/** A 44×44 touch target, which is the minimum everywhere in this app. */
export function IconButton({
  label,
  tone = 'default',
  active = false,
  className,
  children,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-btn transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50',
        TONES[tone],
        active && 'bg-surface-2 text-ink',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
