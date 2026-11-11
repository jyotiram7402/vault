'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'

export interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  disabled?: boolean
  className?: string
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className,
}: SwitchProps) {
  const id = useId()

  return (
    <div
      className={cn(
        // The minimum height keeps one row's tap area off the next row's.
        'flex items-start justify-between gap-4 py-1 pointer-coarse:min-h-11',
        className,
      )}
    >
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-ink">
          {label}
        </label>
        {description ? (
          <p id={`${id}-description`} className="mt-0.5 text-sm text-ink-muted">
            {description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-description` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-150',
          // 28px tall suits a mouse. On a touch screen an invisible box above
          // and below brings the tap area to 44px without moving the row.
          'pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-2.5',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'border-transparent bg-primary' : 'border-line-strong bg-surface-2',
        )}
      >
        {/* The knob contrasts with the track in both states, so its position
            shows on or off, not the track's colour alone. Off, it used to be
            surface on surface-2 and all but disappeared. */}
        <span
          aria-hidden="true"
          className={cn(
            'inline-block size-5 rounded-full shadow-sm transition-transform duration-150',
            checked ? 'translate-x-6 bg-surface' : 'translate-x-1 bg-ink-muted',
          )}
        />
      </button>
    </div>
  )
}
