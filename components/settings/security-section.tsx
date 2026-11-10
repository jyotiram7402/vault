'use client'

import { useSyncExternalStore } from 'react'
import { Lock } from 'lucide-react'
import { postSessionMessage } from '@/lib/vault/broadcast'
import { requireReprompt } from '@/lib/vault/reprompt'
import { lock } from '@/lib/vault/store'
import {
  AUTO_LOCK_OPTIONS,
  CLIPBOARD_OPTIONS,
  autoLockLabel,
  clipboardLabel,
  getServerSettings,
  readSettings,
  subscribeSettings,
  writeSettings,
  type VaultSettings,
} from '@/lib/vault/settings'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { SettingsRow, SettingsSection } from '@/components/settings/section'

/**
 * Loosening a protection asks for the master password, the same as revealing
 * a secret does. Otherwise anyone at an unlocked vault could simply switch the
 * prompt off first. Tightening a setting never asks.
 */
async function applySetting(patch: Partial<VaultSettings>, loosens: boolean): Promise<void> {
  if (loosens && !(await requireReprompt())) return
  writeSettings(patch)
}

/** "Never" is the loosest clipboard setting; otherwise longer is looser. */
function clipboardLoosens(next: number, current: number): boolean {
  if (current === 0) return false
  return next === 0 || next > current
}

export function SecuritySection() {
  const settings = useSyncExternalStore(subscribeSettings, readSettings, getServerSettings)

  return (
    <SettingsSection
      id="security"
      title="Security"
      description="How quickly the vault closes itself when you step away."
    >
      <div className="flex flex-col divide-y divide-line">
        <div className="py-3">
          <Switch
            label="Lock when I switch away"
            description="Locks the instant this tab is hidden — switching tabs, minimising, or switching apps on a phone. Strict: you’ll unlock again when you come back. Turn it off if it gets in your way and rely on the timer below."
            checked={settings.lockOnHide}
            onChange={(lockOnHide) => void applySetting({ lockOnHide }, !lockOnHide)}
          />
        </div>

        <SettingsRow
          label="Lock automatically"
          description="After this long without any activity, and when the tab has been hidden for longer than this."
>
          <Select
            aria-label="Lock automatically"
            value={String(settings.autoLockMinutes)}
            onChange={(event) => {
              const autoLockMinutes = Number.parseInt(event.target.value, 10)
              void applySetting({ autoLockMinutes }, autoLockMinutes > settings.autoLockMinutes)
            }}
            options={AUTO_LOCK_OPTIONS.map((minutes) => ({
              value: String(minutes),
              label: autoLockLabel(minutes),
            }))}
            className="w-52"
          />
        </SettingsRow>

        <SettingsRow
          label="Clear the clipboard"
          description="Best effort. If you’ve switched to another app or tab, it clears as soon as you come back to this page."
        >
          <Select
            aria-label="Clear the clipboard"
            value={String(settings.clipboardSeconds)}
            onChange={(event) => {
              const clipboardSeconds = Number.parseInt(event.target.value, 10)
              void applySetting(
                { clipboardSeconds },
                clipboardLoosens(clipboardSeconds, settings.clipboardSeconds),
              )
            }}
            options={CLIPBOARD_OPTIONS.map((seconds) => ({
              value: String(seconds),
              label: clipboardLabel(seconds),
            }))}
            className="w-52"
          />
        </SettingsRow>

        <div className="py-3">
          <Switch
            label="Ask for your master password before showing or copying a secret"
            description="Covers showing, copying and editing secrets, exporting, and switching off any protection on this page. You’re asked once, then not again for 5 minutes or until the vault locks."
            checked={settings.requireMasterToReveal}
            onChange={(requireMasterToReveal) =>
              void applySetting({ requireMasterToReveal }, !requireMasterToReveal)
            }
          />
        </div>

        <div className="py-3">
          <Switch
            label="Privacy screen"
            description="Blurs passwords and other secrets whenever this window loses focus."
            checked={settings.privacyScreen}
            onChange={(privacyScreen) => void applySetting({ privacyScreen }, !privacyScreen)}
          />
        </div>

        <SettingsRow label="Lock now" description="Closes the vault on every open tab.">
          <Button
            onClick={() => {
              lock('manual')
              postSessionMessage({ type: 'lock' })
            }}
          >
            <Lock aria-hidden="true" className="size-4" />
            Lock now
          </Button>
        </SettingsRow>
      </div>
    </SettingsSection>
  )
}
