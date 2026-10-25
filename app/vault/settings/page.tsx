import type { Metadata } from 'next'
import { SecuritySection } from '@/components/settings/security-section'
import { MasterPasswordSection } from '@/components/settings/master-password-section'
import { RecoverySection } from '@/components/settings/recovery-section'
import { QuickUnlockSection } from '@/components/settings/quick-unlock-section'
import { TwoFactorSection } from '@/components/settings/two-factor-section'
import { DataSection } from '@/components/settings/data-section'
import { AppearanceSection } from '@/components/settings/appearance-section'
import { AccountSection } from '@/components/settings/account-section'
import { InstallSection } from '@/components/settings/install-section'
import { DangerZone } from '@/components/settings/danger-zone'

export const metadata: Metadata = {
  title: 'Settings',
  robots: { index: false, follow: false },
}

export default function VaultSettingsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="plate text-2xl text-ink">Settings</h1>

      <div className="mt-6 flex flex-col gap-5">
        <SecuritySection />
        <MasterPasswordSection />
        <RecoverySection />
        <QuickUnlockSection />
        <TwoFactorSection />
        <DataSection />
        <AppearanceSection />
        <AccountSection />
        <InstallSection />
        <DangerZone />
      </div>
    </div>
  )
}
