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

/**
 * The mobile tab bar. Padded for the home indicator on notched phones.
 *
 * The current tab is marked three ways, not by colour alone: a bar along its
 * top edge, heavier text, and `aria-current` for screen readers.
 */
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
                  'relative flex min-h-14 flex-col items-center justify-center gap-0.5 py-2 text-xs transition-colors',
                  active ? 'font-semibold text-ink' : 'font-medium text-ink-muted',
                )}
              >
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full bg-primary"
                  />
                ) : null}
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
