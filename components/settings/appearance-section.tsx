'use client'

import { useEffect, useState } from 'react'
import { THEME_LABELS, applyTheme, readTheme, type Theme } from '@/lib/vault/theme'
import { Segmented } from '@/components/ui/segmented'
import { SettingsRow, SettingsSection } from '@/components/settings/section'

const OPTIONS: { value: Theme; label: string }[] = [
  { value: 'system', label: THEME_LABELS.system },
  { value: 'light', label: THEME_LABELS.light },
  { value: 'dark', label: THEME_LABELS.dark },
]

export function AppearanceSection() {
  const [theme, setTheme] = useState<Theme>('system')

  // The cookie can only be read in the browser.
  useEffect(() => {
    setTheme(readTheme())
  }, [])

  return (
    <SettingsSection title="Appearance">
      <SettingsRow label="Theme" description="System follows your device setting.">
        <Segmented
          label="Theme"
          value={theme}
          options={OPTIONS}
          onChange={(next) => {
            setTheme(next)
            applyTheme(next)
          }}
        />
      </SettingsRow>
    </SettingsSection>
  )
}
