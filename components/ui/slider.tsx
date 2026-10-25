'use client'

import { useId } from 'react'
import { clamp, cn } from '@/lib/utils'

export interface SliderProps {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  label: string
  className?: string
}

/** A range input with a matching number box, so the value can also be typed. */
export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  className,
}: SliderProps) {
  const id = useId()

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        <input
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          step={step}
          aria-label={`${label}, exact value`}
          onChange={(event) => {
            const parsed = Number.parseInt(event.target.value, 10)
            if (Number.isFinite(parsed)) onChange(clamp(parsed, min, max))
          }}
          className="h-9 w-20 rounded-field border border-line bg-surface px-2 text-center tabular text-ink"
        />
      </div>
      <input
        type="range"
        id={id}
        value={value}
        min={min}
        max={max}
        step={step}
        aria-label={label}
        onChange={(event) => onChange(Number.parseInt(event.target.value, 10))}
      />
    </div>
  )
}
