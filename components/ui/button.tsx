import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet'
export type ButtonSize = 'sm' | 'md' | 'lg'

// Lookup objects, never joined strings: Tailwind only sees complete names.
// Every variant has a pressed (`active:`) state as well as a hover one, so a
// tap gives feedback on a phone, where there is no hover.
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary border-transparent hover:brightness-110 active:brightness-95',
  secondary: 'bg-surface text-ink border-line-strong hover:bg-surface-2 active:bg-line',
  ghost: 'bg-transparent text-ink border-transparent hover:bg-surface-2 active:bg-line',
  danger: 'bg-danger text-on-danger border-transparent hover:brightness-110 active:brightness-95',
  quiet:
    'bg-transparent text-ink-muted border-transparent hover:text-ink hover:bg-surface-2 active:bg-line',
}

// The small size grows to a 44px touch target on touch screens.
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 pointer-coarse:h-11',
  md: 'h-11 px-4 text-base gap-2',
  lg: 'h-12 px-5 text-base gap-2',
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-btn border font-medium transition-[background-color,color,filter] duration-150',
        'disabled:cursor-not-allowed disabled:opacity-55',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? <LoaderCircle aria-hidden="true" className="size-4 anim-spin" /> : null}
      {children}
    </button>
  )
}
