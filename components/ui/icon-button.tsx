import { cn } from '@/lib/utils'

export type IconButtonTone = 'default' | 'danger' | 'primary'
export type IconButtonSize = 'md' | 'sm'

const TONES: Record<IconButtonTone, string> = {
  default: 'text-ink-muted hover:text-ink hover:bg-surface-2 active:bg-line',
  danger: 'text-danger hover:bg-surface-2 active:bg-line',
  primary: 'text-safe hover:bg-surface-2 active:bg-line',
}

// `sm` is for dense rows on a desktop; on a touch screen it is 44px like the
// rest. A prop rather than a `size-9` passed through className: `cn()` does
// not merge, so two size classes would be settled by stylesheet order.
const SIZES: Record<IconButtonSize, string> = {
  md: 'size-11',
  sm: 'size-9 pointer-coarse:size-11',
}

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only controls have no visible text. */
  label: string
  tone?: IconButtonTone
  size?: IconButtonSize
  active?: boolean
}

/** A 44×44 touch target, which is the minimum on touch screens in this app. */
export function IconButton({
  label,
  tone = 'default',
  size = 'md',
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
        'inline-flex shrink-0 items-center justify-center rounded-btn transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50',
        SIZES[size],
        // One or the other: the active colours must not compete with the tone's.
        active ? 'bg-surface-2 text-ink' : TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
