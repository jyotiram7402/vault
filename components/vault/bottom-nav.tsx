'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Dices, Gauge, Settings, Vault } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/vault', label: 'Vault', icon: Vault },
  { href: '/vault/generator', label: 'Generator', icon: Dices },
  { href: '/vault/health', label: 'Health', icon: Gauge },
  { href: '/vault/settings', label: 'Settings', icon: Settings },
] as const

/** The mobile tab bar. Padded for the home indicator on notched phones. */
export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Vault sections"
      className="safe-bottom sticky bottom-0 z-30 border-t border-line bg-surface md:hidden"
    >
      <ul className="flex">
        {TABS.map((tab) => {
          const active = pathname === tab.href
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors',
                  active ? 'text-ink' : 'text-ink-muted',
                )}
              >
                <tab.icon aria-hidden="true" className="size-5" />
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
