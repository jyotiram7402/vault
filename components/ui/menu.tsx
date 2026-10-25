'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface MenuItem {
  label: string
  onSelect: () => void
  icon?: React.ReactNode
  tone?: 'default' | 'danger'
  disabled?: boolean
}

export interface MenuProps {
  /** The trigger. Receives the props it must spread onto a button. */
  trigger: (props: {
    'aria-expanded': boolean
    'aria-haspopup': 'menu'
    id: string
    onClick: () => void
  }) => React.ReactNode
  items: readonly MenuItem[]
  align?: 'start' | 'end'
  label: string
}

/** A small dropdown. Closes on Esc, on outside click and after a selection. */
export function Menu({ trigger, items, align = 'end', label }: MenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerId = useId()

  useEffect(() => {
    if (!open) return
    const handlePointer = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey, true)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey, true)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      {trigger({
        'aria-expanded': open,
        'aria-haspopup': 'menu',
        id: triggerId,
        onClick: () => setOpen((value) => !value),
      })}
      {open ? (
        <div
          role="menu"
          aria-label={label}
          aria-labelledby={triggerId}
          className={cn(
            'anim-pop absolute z-50 mt-1 min-w-52 overflow-hidden rounded-panel border border-line bg-surface py-1 shadow-overlay',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-50',
                item.tone === 'danger'
                  ? 'text-danger hover:bg-surface-2'
                  : 'text-ink hover:bg-surface-2',
              )}
            >
              {item.icon ? <span aria-hidden="true" className="shrink-0">{item.icon}</span> : null}
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
