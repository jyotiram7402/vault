'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { APP_NAME, STORAGE_PREFIX } from '@/lib/config'
import { isStandalone } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/**
 * "Install app".
 *
 * Chrome-family browsers fire `beforeinstallprompt`, which we capture and
 * replay when the user asks. iOS Safari has no such event, so it gets written
 * instructions instead.
 */

const DISMISS_KEY = `${STORAGE_PREFIX}-install-dismissed`

// Not in lib.dom yet.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null

/** Shared with Settings, which offers the same action. */
export function hasInstallPrompt(): boolean {
  return deferredPrompt !== null
}

export async function showInstallPrompt(): Promise<boolean> {
  const event = deferredPrompt
  if (!event) return false
  await event.prompt()
  const choice = await event.userChoice
  deferredPrompt = null
  return choice.outcome === 'accepted'
}

export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
}

export function InstallPrompt() {
  const [visible, setVisible] = useState(false)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    if (isStandalone()) return

    let dismissed = false
    try {
      dismissed = window.localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      dismissed = false
    }
    if (dismissed) return

    if (isIosSafari()) {
      setIos(true)
      setVisible(true)
      return
    }

    const handler = (event: Event) => {
      event.preventDefault()
      // The cast is to the event type the browser actually fires.
      deferredPrompt = event as BeforeInstallPromptEvent
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    const installed = () => setVisible(false)
    window.addEventListener('appinstalled', installed)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installed)
    }
  }, [])

  const dismiss = () => {
    setVisible(false)
    try {
      window.localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Nothing to do; it will ask again next time.
    }
  }

  if (!visible) return null

  return (
    <div className="border-t border-line bg-surface-2 px-4 py-3">
      <div className="flex items-start gap-3">
        <Download aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-safe" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">Install {APP_NAME} on this device</p>
          {ios ? (
            <p className="mt-0.5 text-sm text-ink-muted">
              Tap Share, then Add to Home Screen.
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-ink-muted">
              It opens full screen and starts straight at your items.
            </p>
          )}
          {!ios ? (
            <Button
              size="sm"
              variant="primary"
              className="mt-2"
              onClick={async () => {
                const accepted = await showInstallPrompt()
                if (accepted) setVisible(false)
              }}
            >
              Install app
            </Button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-field p-1 text-ink-muted hover:text-ink"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  )
}
