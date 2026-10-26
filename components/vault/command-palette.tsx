'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CreditCard,
  Dices,
  Gauge,
  KeyRound,
  Keyboard,
  Lock,
  LogOut,
  Settings,
  StickyNote,
  SunMoon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { hostOf } from '@/lib/security/url'
import { searchItems } from '@/lib/vault/search'
import { useVault } from '@/lib/vault/use-vault'
import { copySecret } from '@/lib/vault/clipboard'
import { requireReprompt } from '@/lib/vault/reprompt'
import { applyTheme, nextTheme, readTheme } from '@/lib/vault/theme'
import { useToast } from '@/components/ui/toast'
import { Monogram } from '@/components/vault/monogram'

/**
 * Ctrl/⌘+K. Searches items and actions; arrow keys move, Enter runs.
 * On an item, Enter opens it and Ctrl/⌘+Enter copies its password.
 */

interface Action {
  id: string
  label: string
  icon: React.ReactNode
  run: () => void
}

const MAX_ITEMS = 8

export function CommandPalette({
  open,
  onClose,
  onLock,
  onSignOut,
  onShowShortcuts,
}: {
  open: boolean
  onClose: () => void
  onLock: () => void
  onSignOut: () => void
  onShowShortcuts: () => void
}) {
  const router = useRouter()
  const { toast } = useToast()
  const { items } = useVault()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)

  useEffect(() => {
    const element = dialogRef.current
    if (!element) return
    if (open && !element.open) {
      element.showModal()
      inputRef.current?.focus()
    }
    if (!open && element.open) element.close()
  }, [open])

  useEffect(() => {
    const element = dialogRef.current
    if (!element) return
    const handleClose = () => onClose()
    element.addEventListener('close', handleClose)
    return () => element.removeEventListener('close', handleClose)
  }, [onClose])

  const actions = useMemo<Action[]>(
    () => [
      {
        id: 'new-login',
        label: 'Add login',
        icon: <KeyRound aria-hidden="true" className="size-4" />,
        run: () => router.push('/vault?new=login'),
      },
      {
        id: 'new-card',
        label: 'Add card',
        icon: <CreditCard aria-hidden="true" className="size-4" />,
        run: () => router.push('/vault?new=card'),
      },
      {
        id: 'new-note',
        label: 'Add secure note',
        icon: <StickyNote aria-hidden="true" className="size-4" />,
        run: () => router.push('/vault?new=note'),
      },
      {
        id: 'generator',
        label: 'Generate password',
        icon: <Dices aria-hidden="true" className="size-4" />,
        run: () => router.push('/vault/generator'),
      },
      {
        id: 'health',
        label: 'Vault health',
        icon: <Gauge aria-hidden="true" className="size-4" />,
        run: () => router.push('/vault/health'),
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: <Settings aria-hidden="true" className="size-4" />,
        run: () => router.push('/vault/settings'),
      },
      {
        id: 'theme',
        label: 'Switch theme',
        icon: <SunMoon aria-hidden="true" className="size-4" />,
        run: () => applyTheme(nextTheme(readTheme())),
      },
      {
        id: 'shortcuts',
        label: 'Keyboard shortcuts',
        icon: <Keyboard aria-hidden="true" className="size-4" />,
        run: onShowShortcuts,
      },
      {
        id: 'lock',
        label: 'Lock vault',
        icon: <Lock aria-hidden="true" className="size-4" />,
        run: onLock,
      },
      {
        id: 'signout',
        label: 'Sign out',
        icon: <LogOut aria-hidden="true" className="size-4" />,
        run: onSignOut,
      },
    ],
    [onLock, onShowShortcuts, onSignOut, router],
  )

  const matchedItems = useMemo(
    () => (query.trim() ? searchItems(items, query).slice(0, MAX_ITEMS) : []),
    [items, query],
  )

  const matchedActions = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return actions
    return actions.filter((action) => action.label.toLowerCase().includes(needle))
  }, [actions, query])

  const total = matchedItems.length + matchedActions.length

  useEffect(() => {
    setCursor(0)
  }, [query])

  const runAt = async (index: number, copyPassword: boolean) => {
    if (index < matchedItems.length) {
      const item = matchedItems[index]
      if (copyPassword && item.data.type === 'login' && item.data.password) {
        // Close first: the palette is itself a modal dialog, and stacking the
        // master password prompt on top of it reads badly.
        onClose()
        if (!(await requireReprompt())) return
        try {
          await copySecret(item.data.password)
          toast({ message: 'Password copied', tone: 'success' })
        } catch {
          toast({ message: 'This browser wouldn’t let the page copy.', tone: 'danger' })
        }
        return
      }
      router.push(`/vault?item=${encodeURIComponent(item.id)}`)
      onClose()
      return
    }

    const action = matchedActions[index - matchedItems.length]
    if (!action) return
    onClose()
    action.run()
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setCursor((value) => (total === 0 ? 0 : (value + 1) % total))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setCursor((value) => (total === 0 ? 0 : (value - 1 + total) % total))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      void runAt(cursor, event.metaKey || event.ctrlKey)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label="Command palette"
      className="mx-auto mt-[12vh] w-[calc(100vw-2rem)] max-w-xl bg-transparent"
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
    >
      <div className="anim-pop overflow-hidden rounded-panel border border-line bg-surface shadow-overlay">
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search items and actions"
          aria-label="Search items and actions"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          translate="no"
          className="h-14 w-full border-b border-line bg-transparent px-4 text-base text-ink outline-none placeholder:text-ink-muted"
        />

        <ul role="listbox" aria-label="Results" className="max-h-[50dvh] overflow-y-auto py-1">
          {matchedItems.map((item, index) => {
            const host = item.data.type === 'login' ? hostOf(item.data.url) : ''
            const second =
              item.data.type === 'login'
                ? (item.data.username ?? host)
                : item.data.type === 'card'
                  ? 'Card'
                  : 'Secure note'
            return (
              <li key={item.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={cursor === index}
                  onMouseEnter={() => setCursor(index)}
                  onClick={(event) => void runAt(index, event.metaKey || event.ctrlKey)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2.5 text-left',
                    cursor === index ? 'bg-surface-2' : '',
                  )}
                >
                  <Monogram seed={host || item.data.title} label={item.data.title} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {item.data.title}
                    </span>
                    <span className="block truncate text-xs text-ink-muted">{second}</span>
                  </span>
                </button>
              </li>
            )
          })}

          {matchedActions.map((action, index) => {
            const position = matchedItems.length + index
            return (
              <li key={action.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={cursor === position}
                  onMouseEnter={() => setCursor(position)}
                  onClick={() => void runAt(position, false)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-ink',
                    cursor === position ? 'bg-surface-2' : '',
                  )}
                >
                  <span aria-hidden="true" className="text-ink-muted">
                    {action.icon}
                  </span>
                  {action.label}
                </button>
              </li>
            )
          })}

          {total === 0 ? (
            <li className="px-4 py-6 text-sm text-ink-muted">Nothing matches “{query}”.</li>
          ) : null}
        </ul>
      </div>
    </dialog>
  )
}
