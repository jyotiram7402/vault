'use client'

import { useState } from 'react'
import { ArrowUpDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  CATEGORY_IDS,
  CATEGORY_LABELS,
  type CategoryId,
} from '@/lib/vault/types'
import { SORT_LABELS, usedCategories, usedTags, type SortMode } from '@/lib/vault/search'
import type { VaultItem } from '@/lib/vault/types'
import { Menu } from '@/components/ui/menu'

/**
 * The search box, plus the filter chips that replace the navigation rail on
 * phones.
 *
 * The chips wrap rather than scroll sideways, so no label is ever hidden off
 * the edge of the screen. To keep that from eating the top of the list, only
 * the five fixed filters show at first; categories and tags sit behind a
 * "+N more" button, except the one that is currently applied.
 */

const BASE_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'favorites', label: 'Favourites' },
  { key: 'type:login', label: 'Logins' },
  { key: 'type:card', label: 'Cards' },
  { key: 'type:note', label: 'Notes' },
] as const

const CHIP_CLASSES =
  'inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-medium transition-colors pointer-coarse:min-h-11'

export interface FilterBarProps {
  query: string
  onQueryChange: (value: string) => void
  activeFilter: string
  onFilterChange: (key: string) => void
  sort: SortMode
  onSortChange: (mode: SortMode) => void
  items: readonly VaultItem[]
}

export function FilterBar({
  query,
  onQueryChange,
  activeFilter,
  onFilterChange,
  sort,
  onSortChange,
  items,
}: FilterBarProps) {
  const [moreOpen, setMoreOpen] = useState(false)

  const categories = usedCategories(items)
  const orderedCategories = CATEGORY_IDS.filter((id: CategoryId) => categories.includes(id))
  const tags = usedTags(items)

  const extraChips: { key: string; label: string }[] = [
    ...orderedCategories.map((id) => ({ key: `category:${id}`, label: CATEGORY_LABELS[id] })),
    ...tags.map((tag) => ({ key: `tag:${tag}`, label: `#${tag}` })),
  ]
  // Collapsed, the applied filter still shows, so it is never out of sight.
  const visibleExtras = moreOpen
    ? extraChips
    : extraChips.filter((chip) => chip.key === activeFilter)
  const hiddenCount = extraChips.length - visibleExtras.length

  const chips: { key: string; label: string }[] = [
    ...BASE_CHIPS.map((chip) => ({ key: chip.key, label: chip.label })),
    ...visibleExtras,
  ]

  return (
    <div className="border-b border-line bg-surface">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
          />
          <input
            type="search"
            data-vault-search
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search vault"
            aria-label="Search vault"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            translate="no"
            className="h-11 w-full rounded-field border border-line-strong bg-bg pr-3 pl-9 text-ink placeholder:text-ink-muted"
          />
        </div>

        <Menu
          label="Sort items"
          items={(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => ({
            label: SORT_LABELS[mode],
            onSelect: () => onSortChange(mode),
          }))}
          trigger={(props) => (
            <button
              type="button"
              {...props}
              title={`Sort: ${SORT_LABELS[sort]}`}
              aria-label={`Sort: ${SORT_LABELS[sort]}`}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-btn border border-line-strong bg-bg text-ink-muted transition-colors hover:text-ink active:bg-line"
            >
              <ArrowUpDown aria-hidden="true" className="size-4" />
            </button>
          )}
        />
      </div>

      {/* Chips: phones only; the rail carries these on larger screens. */}
      <ul className="flex flex-wrap gap-2 px-3 pb-2.5 md:hidden">
        {chips.map((chip) => {
          const active = activeFilter === chip.key
          return (
            <li key={chip.key}>
              {/* A button, not a link: see chooseFilter in nav-rail. */}
              <button
                type="button"
                onClick={() => onFilterChange(chip.key)}
                aria-pressed={active}
                className={cn(
                  CHIP_CLASSES,
                  active
                    ? 'border-transparent bg-primary text-on-primary'
                    : 'border-line-strong bg-bg text-ink-muted hover:text-ink active:bg-line',
                )}
              >
                {chip.label}
              </button>
            </li>
          )
        })}

        {moreOpen || hiddenCount > 0 ? (
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen((value) => !value)}
              aria-expanded={moreOpen}
              className={cn(
                CHIP_CLASSES,
                'border-transparent text-safe underline underline-offset-2 hover:no-underline',
              )}
            >
              {moreOpen ? 'Fewer' : `+${hiddenCount} more`}
            </button>
          </li>
        ) : null}
      </ul>
    </div>
  )
}
