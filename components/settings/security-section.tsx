'use client'

import { useSyncExternalStore } from 'react'
import { Lock } from 'lucide-react'
import { postSessionMessage } from '@/lib/vault/broadcast'
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
} from '@/lib/vault/settings'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { SettingsRow, SettingsSection } from '@/components/settings/section'

export function SecuritySection() {
  const settings = useSyncExternalStore(subscribeSettings, readSettings, getServerSettings)

  return (
    <SettingsSection
      title="Security"
      description="How quickly the vault closes itself when you step away."
    >
      <div className="flex flex-col divide-y divide-line">
        <SettingsRow
          label="Lock automatically"
          description="After this long without any activity, and when the tab has been hidden for longer than this."
        >
          <Select
            aria-label="Lock automatically"
            value={String(settings.autoLockMinutes)}
            onChange={(event) =>
              writeSettings({ autoLockMinutes: Number.parseInt(event.target.value, 10) })
            }
            options={AUTO_LOCK_OPTIONS.map((minutes) => ({
              value: String(minutes),
              label: autoLockLabel(minutes),
            }))}
            className="w-52"
          />
        </SettingsRow>

        <SettingsRow
          label="Clear the clipboard"
          description="Best effort: only works while this page has focus."
        >
          <Select
            aria-label="Clear the clipboard"
            value={String(settings.clipboardSeconds)}
            onChange={(event) =>
              writeSettings({ clipboardSeconds: Number.parseInt(event.target.value, 10) })
            }
            options={CLIPBOARD_OPTIONS.map((seconds) => ({
              value: String(seconds),
              label: clipboardLabel(seconds),
            }))}
            className="w-52"
          />
        </SettingsRow>

        <div className="py-3">
          <Switch
            label="Ask for your master password before showing a secret"
            description="Guards against someone glancing at your screen. Copy buttons still work without it — lock the vault if you’re leaving the device."
            checked={settings.requireMasterToReveal}
            onChange={(requireMasterToReveal) => writeSettings({ requireMasterToReveal })}
          />
        </div>

        <div className="py-3">
          <Switch
            label="Privacy screen"
            description="Blurs passwords and other secrets whenever this window loses focus."
            checked={settings.privacyScreen}
            onChange={(privacyScreen) => writeSettings({ privacyScreen })}
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
