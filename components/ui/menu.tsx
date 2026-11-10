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

const ENABLED_ITEMS = '[role="menuitem"]:not(:disabled)'

/**
 * A small dropdown that behaves the way its `menu` role promises: focus moves
 * into it when it opens, the arrow keys, Home and End move between items, and
 * Esc, Tab, an outside click or a selection closes it. Closing from the
 * keyboard hands focus back to the button that opened it.
 */
export function Menu({ trigger, items, align = 'end', label }: MenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerId = useId()

  useEffect(() => {
    if (!open) return

    menuRef.current?.querySelector<HTMLElement>(ENABLED_ITEMS)?.focus()

    const handlePointer = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setOpen(false)
        document.getElementById(triggerId)?.focus()
      }
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey, true)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey, true)
    }
  }, [open, triggerId])

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      // Let focus move on naturally, but don't leave the menu hanging open.
      setOpen(false)
      return
    }

    const enabled = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(ENABLED_ITEMS))
    if (enabled.length === 0) return
    const current = enabled.findIndex((element) => element === document.activeElement)

    let next: number
    if (event.key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % enabled.length
    else if (event.key === 'ArrowUp') {
      next = current <= 0 ? enabled.length - 1 : current - 1
    } else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = enabled.length - 1
    else return

    event.preventDefault()
    enabled[next]?.focus()
  }

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
          ref={menuRef}
          role="menu"
          aria-label={label}
          aria-labelledby={triggerId}
          onKeyDown={handleMenuKeyDown}
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
                // Back to the trigger first: if the action opens a dialog, the
                // dialog then returns focus here when it closes.
                document.getElementById(triggerId)?.focus()
                item.onSelect()
              }}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-50',
                item.tone === 'danger'
                  ? 'text-danger hover:bg-surface-2 active:bg-line'
                  : 'text-ink hover:bg-surface-2 active:bg-line',
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
