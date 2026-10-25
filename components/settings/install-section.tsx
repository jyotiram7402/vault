'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { APP_NAME } from '@/lib/config'
import { isStandalone } from '@/lib/utils'
import {
  hasInstallPrompt,
  isIosSafari,
  showInstallPrompt,
} from '@/components/vault/install-prompt'
import { Button } from '@/components/ui/button'
import { SettingsSection } from '@/components/settings/section'

/** Hidden once the app is already installed. */
export function InstallSection() {
  const [visible, setVisible] = useState(false)
  const [ios, setIos] = useState(false)
  const [canPrompt, setCanPrompt] = useState(false)

  useEffect(() => {
    if (isStandalone()) return
    setVisible(true)
    setIos(isIosSafari())
    setCanPrompt(hasInstallPrompt())
  }, [])

  if (!visible) return null

  return (
    <SettingsSection
      title="Install app"
      description={`${APP_NAME} runs full screen and opens straight at your vault.`}
    >
      {ios ? (
        <p className="text-sm text-ink-muted">
          In Safari, tap Share, then Add to Home Screen.
        </p>
      ) : canPrompt ? (
        <Button
          variant="primary"
          onClick={async () => {
            const accepted = await showInstallPrompt()
            if (accepted) setVisible(false)
          }}
        >
          <Download aria-hidden="true" className="size-4" />
          Install app
        </Button>
      ) : (
        <p className="text-sm text-ink-muted">
          Use your browser’s menu and choose “Install app” or “Add to Home Screen”.
        </p>
      )}
    </SettingsSection>
  )
}
