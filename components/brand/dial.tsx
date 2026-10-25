'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * The combination dial.
 *
 * This is the one orchestrated moment in the interface: it turns while
 * Argon2id derives the key, then the bolts slide back when the vault opens.
 *
 * Only `transform` and `opacity` are animated, and the animation is on a
 * wrapping <div> rather than on SVG children, so the browser runs it on the
 * compositor. That matters: Argon2id blocks the main thread for a second or
 * more, and the dial has to keep turning through it.
 */

export type DialState = 'idle' | 'working' | 'success' | 'error'

const DEFAULT_STATUS: Record<DialState, string> = {
  idle: '',
  working: 'Opening your vault…',
  success: 'Unlocked',
  error: 'Wrong master password',
}

const CENTER = 100

/** 60 ticks, every fifth one longer — like a real combination dial. */
const TICKS = Array.from({ length: 60 }, (_, index) => {
  const angle = (index * Math.PI) / 30
  const sin = Math.sin(angle)
  const cos = Math.cos(angle)
  const major = index % 5 === 0
  const inner = major ? 70 : 78
  return {
    major,
    x1: CENTER + inner * sin,
    y1: CENTER - inner * cos,
    x2: CENTER + 86 * sin,
    y2: CENTER - 86 * cos,
  }
})

/** Numerals 0–50 every ten ticks, printed radially like a safe dial. */
const NUMERALS = Array.from({ length: 6 }, (_, index) => ({
  value: index * 10,
  angle: index * 60,
}))

const BOLTS = [0, 1, 2]

export interface DialProps {
  state: DialState
  /** Overrides the default aria-live text for this state. */
  statusText?: string
  className?: string
}

export function Dial({ state, statusText, className }: DialProps) {
  const [size, setSize] = useState(220)

  useEffect(() => {
    const query = window.matchMedia('(max-width: 379px)')
    const apply = () => setSize(query.matches ? 180 : 220)
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [])

  const status = statusText ?? DEFAULT_STATUS[state]

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <div
        className="dial-shell relative"
        data-state={state}
        style={{ width: size, height: size }}
      >
        {/* Static base ring: the painted steel door. */}
        <svg viewBox="0 0 200 200" aria-hidden="true" className="absolute inset-0 size-full">
          <circle cx={CENTER} cy={CENTER} r="98" fill="var(--surface-2)" />
          <circle
            cx={CENTER}
            cy={CENTER}
            r="94"
            fill="var(--surface)"
            stroke="var(--line)"
            strokeWidth="2"
          />
        </svg>

        {/* The rotor: everything that turns. */}
        <div className="dial-rotor absolute inset-0" data-state={state}>
          <div
            aria-hidden="true"
            className="absolute rounded-full"
            style={{
              inset: '27%',
              background:
                'conic-gradient(from 210deg, var(--surface-2), var(--surface), var(--surface-2), var(--surface), var(--surface-2))',
              boxShadow: 'inset 0 0 0 1px var(--line)',
            }}
          />
          <svg viewBox="0 0 200 200" aria-hidden="true" className="absolute inset-0 size-full">
            <g stroke="var(--ink-muted)" strokeLinecap="round">
              {TICKS.map((tick, index) => (
                <line
                  key={index}
                  x1={tick.x1.toFixed(2)}
                  y1={tick.y1.toFixed(2)}
                  x2={tick.x2.toFixed(2)}
                  y2={tick.y2.toFixed(2)}
                  strokeWidth={tick.major ? 2.2 : 1.1}
                  opacity={tick.major ? 0.95 : 0.5}
                />
              ))}
            </g>
            {NUMERALS.map((numeral) => (
              <text
                key={numeral.value}
                x={CENTER}
                y={CENTER - 58}
                textAnchor="middle"
                className="tabular"
                fontSize="12"
                fontWeight="600"
                fill="var(--ink)"
                transform={`rotate(${numeral.angle} ${CENTER} ${CENTER})`}
              >
                {numeral.value}
              </text>
            ))}
            {/* Keyhole at the centre of the knob. */}
            <path
              d="M100 86a8 8 0 0 1 4.4 14.7L107 114H93l2.6-13.3A8 8 0 0 1 100 86z"
              fill="var(--safe)"
            />
          </svg>
        </div>

        {/* Static brass index marker at twelve o'clock. */}
        <svg viewBox="0 0 200 200" aria-hidden="true" className="absolute inset-0 size-full">
          <path d="M100 2 L106 14 L94 14 Z" fill="var(--brass)" />
        </svg>

        {/* Three bolts on the right edge; they slide out when the vault opens. */}
        <div aria-hidden="true" className="absolute top-1/2 left-full -translate-y-1/2">
          {BOLTS.map((index) => (
            <div
              key={index}
              className="dial-bolt my-1.5 h-2.5 w-4 rounded-full bg-brass"
              data-state={state}
              style={{ '--bolt-delay': `${index * 60}ms` } as React.CSSProperties}
            />
          ))}
        </div>
      </div>

      <p aria-live="polite" className="min-h-6 text-center text-sm font-medium text-ink-muted">
        {status}
      </p>
    </div>
  )
}
