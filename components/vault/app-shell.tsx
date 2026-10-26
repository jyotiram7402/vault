'use client'

import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Lock, X } from 'lucide-react'
import { APP_NAME } from '@/lib/config'
import { cn } from '@/lib/utils'
import { postSessionMessage } from '@/lib/vault/broadcast'
import { lock } from '@/lib/vault/store'
import { Logo } from '@/components/brand/logo'
import { IconButton } from '@/components/ui/icon-button'
import { NavRail } from '@/components/vault/nav-rail'
import { BottomNav } from '@/components/vault/bottom-nav'
import { InstallPrompt } from '@/components/vault/install-prompt'
import { RepromptHost } from '@/components/vault/reprompt-dialog'

// Desktop-only extras: loaded the first time they are opened.
const CommandPalette = lazy(() =>
  import('@/components/vault/command-palette').then((module) => ({
    default: module.CommandPalette,
  })),
)
const ShortcutsDialog = lazy(() =>
  import('@/components/vault/shortcuts-dialog').then((module) => ({
    default: module.ShortcutsDialog,
  })),
)

export interface AppShellNotice {
  message: string
  onDismiss: () => void
}

export interface AppShellProps {
  onSignOut: () => void
  notice: AppShellNotice | null
  children: React.ReactNode
}

/** True when the keystroke happened inside somewhere the user is typing. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export function AppShell({ onSignOut, notice, children }: AppShellProps) {
  const router = useRouter()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [offline, setOffline] = useState(false)

  const handleLock = useCallback(() => {
    lock('manual')
    postSessionMessage({ type: 'lock' })
  }, [])

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey

      if (modifier && event.shiftKey && event.key.toLowerCase() === 'l') {
        event.preventDefault()
        handleLock()
        return
      }
      if (modifier && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen(true)
        return
      }
      if (modifier) return
      if (isTypingTarget(event.target)) return

      if (event.key === '/') {
        const search = document.querySelector<HTMLInputElement>('[data-vault-search]')
        if (search) {
          event.preventDefault()
          search.focus()
          search.select()
        }
        return
      }
      if (event.key === '?') {
        event.preventDefault()
        setShortcutsOpen(true)
        return
      }
      if (event.key.toLowerCase() === 'n') {
        event.preventDefault()
        router.push('/vault?new=login')
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleLock, router])

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Suspense fallback={<div className="hidden w-[72px] shrink-0 md:block lg:w-[232px]" />}>
        <NavRail onLock={handleLock} onOpenPalette={() => setPaletteOpen(true)} />
      </Suspense>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="safe-top sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-surface px-3 py-2 md:hidden">
          <Link href="/vault" className="rounded-btn" aria-label={`${APP_NAME} home`}>
            <Logo />
          </Link>
          <div className="ml-auto flex items-center">
            <IconButton label="Lock vault" onClick={handleLock}>
              <Lock aria-hidden="true" className="size-5" />
            </IconButton>
          </div>
        </header>

        {offline ? (
          <p
            role="status"
            className="border-b border-warn/40 bg-surface-2 px-4 py-2 text-sm text-warn"
          >
            You’re offline. Changes can’t be saved until you reconnect.
          </p>
        ) : null}

        {notice ? (
          <div className="flex items-start gap-3 border-b border-line bg-surface-2 px-4 py-2.5">
            <p role="status" className="min-w-0 flex-1 text-sm text-ink">
              {notice.message} They stay in your vault, but this device can’t read them.
            </p>
            <button
              type="button"
              onClick={notice.onDismiss}
              aria-label="Dismiss"
              className="shrink-0 rounded-field p-1 text-ink-muted hover:text-ink"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        ) : null}

        <main className={cn('min-w-0 flex-1')}>{children}</main>

        <InstallPrompt />
        <BottomNav />
      </div>

      {/* One instance for the whole vault: rows, the detail pane and the
          command palette all raise their requests through the same store. */}
      <RepromptHost />

      {paletteOpen ? (
        <Suspense fallback={null}>
          <CommandPalette
            open={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            onLock={handleLock}
            onSignOut={onSignOut}
            onShowShortcuts={() => {
              setPaletteOpen(false)
              setShortcutsOpen(true)
            }}
          />
        </Suspense>
      ) : null}

      {shortcutsOpen ? (
        <Suspense fallback={null}>
          <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
        </Suspense>
      ) : null}
    </div>
  )
}
