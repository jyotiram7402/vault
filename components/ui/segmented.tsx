'use client'

import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

export interface SegmentedProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: readonly SegmentedOption<T>[]
  label: string
  className?: string
}

/**
 * A small tab strip with real radio-group behaviour: Tab lands on the chosen
 * option, and the arrow keys move the choice, as the `radio` role promises.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: SegmentedProps<T>) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0
    if (step === 0 || options.length === 0) return
    event.preventDefault()

    const current = options.findIndex((option) => option.value === value)
    const nextIndex = (current + step + options.length) % options.length
    const next = options[nextIndex]
    if (!next) return

    onChange(next.value)
    // Focus follows the choice, so the next arrow press carries on from it.
    const radios = event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')
    radios[nextIndex]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={cn(
        'inline-flex rounded-btn border border-line-strong bg-surface-2 p-1',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-h-9 rounded-[5px] px-3 text-sm font-medium transition-colors duration-150 pointer-coarse:min-h-11',
              selected ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
