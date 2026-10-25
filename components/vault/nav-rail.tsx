'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  Command,
  CreditCard,
  Dices,
  Gauge,
  KeyRound,
  List,
  Lock,
  Settings,
  Star,
  StickyNote,
  Tag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/brand/logo'
import { useVault } from '@/lib/vault/use-vault'
import {
  CATEGORY_IDS,
  CATEGORY_LABELS,
  type CategoryId,
} from '@/lib/vault/types'
import { usedCategories, usedTags } from '@/lib/vault/search'

/**
 * The desktop navigation rail: 232 px wide, collapsing to a 72 px icon rail on
 * tablets. Filters live here, in the URL, so the browser's back button behaves
 * the way people expect.
 */

const FILTERS = [
  { key: 'all', label: 'All items', icon: List },
  { key: 'favorites', label: 'Favourites', icon: Star },
  { key: 'type:login', label: 'Logins', icon: KeyRound },
  { key: 'type:card', label: 'Cards', icon: CreditCard },
  { key: 'type:note', label: 'Notes', icon: StickyNote },
] as const

const PAGES = [
  { href: '/vault/health', label: 'Health', icon: Gauge },
  { href: '/vault/generator', label: 'Generator', icon: Dices },
  { href: '/vault/settings', label: 'Settings', icon: Settings },
] as const

const itemClasses =
  'flex h-11 items-center gap-3 rounded-btn px-3 text-sm font-medium transition-colors'

export function NavRail({
  onLock,
  onOpenPalette,
}: {
  onLock: () => void
  onOpenPalette: () => void
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { items } = useVault()

  const activeFilter = searchParams.get('filter') ?? 'all'
  const onItemsPage = pathname === '/vault'

  const categories = usedCategories(items)
  const orderedCategories = CATEGORY_IDS.filter((id) => categories.includes(id))
  const tags = usedTags(items)

  return (
    <nav
      aria-label="Vault"
      className="safe-top sticky top-0 hidden h-dvh w-[72px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-surface px-2 py-3 md:flex lg:w-[232px] lg:px-3"
    >
      <Link href="/vault" className="mb-3 flex h-11 items-center rounded-btn px-1.5 lg:px-2">
        <Logo markOnly className="lg:hidden" />
        <span className="hidden lg:inline">
          <Logo />
        </span>
      </Link>

      <ul className="flex flex-col gap-0.5">
        {FILTERS.map((filter) => {
          const active = onItemsPage && activeFilter === filter.key
          return (
            <li key={filter.key}>
              <Link
                href={filter.key === 'all' ? '/vault' : `/vault?filter=${filter.key}`}
                title={filter.label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  itemClasses,
                  'justify-center lg:justify-start',
                  active ? 'bg-surface-2 text-ink' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
                )}
              >
                <filter.icon aria-hidden="true" className="size-5 shrink-0" />
                <span className="hidden lg:inline">{filter.label}</span>
                <span className="sr-only lg:hidden">{filter.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>

      {orderedCategories.length > 0 ? (
        <div className="mt-4 hidden lg:block">
          <h2 className="px-3 pb-1 text-xs font-semibold tracking-wide text-ink-muted">
            Categories
          </h2>
          <ul className="flex flex-col gap-0.5">
            {orderedCategories.map((id: CategoryId) => {
              const key = `category:${id}`
              const active = onItemsPage && activeFilter === key
              return (
                <li key={id}>
                  <Link
                    href={`/vault?filter=${key}`}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      itemClasses,
                      active ? 'bg-surface-2 text-ink' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
                    )}
                  >
                    <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-safe" />
                    {CATEGORY_LABELS[id]}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {tags.length > 0 ? (
        <div className="mt-4 hidden lg:block">
          <h2 className="px-3 pb-1 text-xs font-semibold tracking-wide text-ink-muted">Tags</h2>
          <ul className="flex flex-col gap-0.5">
            {tags.slice(0, 20).map((tag) => {
              const key = `tag:${tag}`
              const active = onItemsPage && activeFilter === key
              return (
                <li key={tag}>
                  <Link
                    href={`/vault?filter=${encodeURIComponent(key)}`}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      itemClasses,
                      'truncate',
                      active ? 'bg-surface-2 text-ink' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
                    )}
                  >
                    <Tag aria-hidden="true" className="size-4 shrink-0" />
                    <span className="truncate">{tag}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      <ul className="mt-auto flex flex-col gap-0.5 border-t border-line pt-3">
        {PAGES.map((page) => {
          const active = pathname === page.href
          return (
            <li key={page.href}>
              <Link
                href={page.href}
                title={page.label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  itemClasses,
                  'justify-center lg:justify-start',
                  active ? 'bg-surface-2 text-ink' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
                )}
              >
                <page.icon aria-hidden="true" className="size-5 shrink-0" />
                <span className="hidden lg:inline">{page.label}</span>
                <span className="sr-only lg:hidden">{page.label}</span>
              </Link>
            </li>
          )
        })}
        {/* Lives in the rail, not floating over the page: a fixed button in
            the corner covered the item form's Save button. */}
        <li>
          <button
            type="button"
            onClick={onOpenPalette}
            title="Search and actions"
            className={cn(
              itemClasses,
              'w-full justify-center text-ink-muted hover:bg-surface-2 hover:text-ink lg:justify-start',
            )}
          >
            <Command aria-hidden="true" className="size-5 shrink-0" />
            <span className="hidden lg:inline">Search</span>
            <span className="sr-only lg:hidden">Search and actions</span>
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={onLock}
            title="Lock vault"
            className={cn(
              itemClasses,
              'w-full justify-center text-ink-muted hover:bg-surface-2 hover:text-ink lg:justify-start',
            )}
          >
            <Lock aria-hidden="true" className="size-5 shrink-0" />
            <span className="hidden lg:inline">Lock</span>
            <span className="sr-only lg:hidden">Lock vault</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
