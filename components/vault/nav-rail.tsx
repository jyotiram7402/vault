'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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
import { useVault, useVaultView } from '@/lib/vault/use-vault'
import { setFilter, viewHref } from '@/lib/vault/view-state'
import {
  CATEGORY_IDS,
  CATEGORY_LABELS,
  type CategoryId,
} from '@/lib/vault/types'
import { usedCategories, usedTags } from '@/lib/vault/search'

/**
 * The desktop navigation rail: 232 px wide, narrowing to an 88 px rail on
 * tablets. Filters live here, in the URL, so the browser's back button behaves
 * the way people expect.
 *
 * On the narrow rail every item keeps its label, stacked under the icon: an
 * icon on its own asks people to guess, and a tooltip never shows on touch.
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

// Icon over label on the tablet rail, icon beside label from `lg` up.
const itemClasses =
  'flex h-14 flex-col items-center justify-center gap-0.5 rounded-btn px-0.5 text-xs font-medium transition-colors ' +
  'lg:h-11 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-sm'

const ACTIVE = 'bg-surface-2 text-ink'
const IDLE = 'text-ink-muted hover:bg-surface-2 hover:text-ink active:bg-line'

export function NavRail({
  onLock,
  onOpenPalette,
}: {
  onLock: () => void
  onOpenPalette: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { items } = useVault()
  const view = useVaultView()

  const activeFilter = view.filter
  const onItemsPage = pathname === '/vault'

  /**
   * Filters are buttons, not links, on purpose. A <Link> to `/vault?filter=…`
   * is a server navigation even though the route is unchanged — it re-runs the
   * proxy, re-checks the session with Supabase and refetches the page, all to
   * narrow a list that is already in memory. From another vault page we do
   * still have to navigate for real.
   */
  const chooseFilter = (key: string) => {
    if (onItemsPage) setFilter(key)
    else router.push(viewHref({ filter: key }))
  }

  const categories = usedCategories(items)
  const orderedCategories = CATEGORY_IDS.filter((id) => categories.includes(id))
  const tags = usedTags(items)

  return (
    <nav
      aria-label="Vault"
      className="sticky top-0 hidden h-dvh w-22 shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-surface px-1.5 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] md:flex lg:w-[232px] lg:px-3"
    >
      <Link
        href="/vault"
        className="mb-3 flex h-11 items-center justify-center rounded-btn px-1.5 lg:justify-start lg:px-2"
      >
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
              <button
                type="button"
                onClick={() => chooseFilter(filter.key)}
                aria-pressed={active}
                className={cn(itemClasses, 'w-full', active ? ACTIVE : IDLE)}
              >
                <filter.icon aria-hidden="true" className="size-5 shrink-0" />
                <span className="max-w-full truncate">{filter.label}</span>
              </button>
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
                  <button
                    type="button"
                    onClick={() => chooseFilter(key)}
                    aria-pressed={active}
                    className={cn(itemClasses, 'w-full', active ? ACTIVE : IDLE)}
                  >
                    <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-safe" />
                    {CATEGORY_LABELS[id]}
                  </button>
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
                  <button
                    type="button"
                    onClick={() => chooseFilter(key)}
                    aria-pressed={active}
                    className={cn(itemClasses, 'w-full', active ? ACTIVE : IDLE)}
                  >
                    <Tag aria-hidden="true" className="size-4 shrink-0" />
                    <span className="min-w-0 truncate">{tag}</span>
                  </button>
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
                aria-current={active ? 'page' : undefined}
                className={cn(itemClasses, active ? ACTIVE : IDLE)}
              >
                <page.icon aria-hidden="true" className="size-5 shrink-0" />
                <span className="max-w-full truncate">{page.label}</span>
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
            className={cn(itemClasses, 'w-full', IDLE)}
          >
            <Command aria-hidden="true" className="size-5 shrink-0" />
            <span className="max-w-full truncate">Search</span>
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={onLock}
            title="Lock vault"
            className={cn(itemClasses, 'w-full', IDLE)}
          >
            <Lock aria-hidden="true" className="size-5 shrink-0" />
            <span className="max-w-full truncate">Lock</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
