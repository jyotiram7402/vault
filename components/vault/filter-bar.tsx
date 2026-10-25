'use client'

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
 * The search box, plus the sideways-scrolling filter chips that replace the
 * navigation rail on phones.
 */

const BASE_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'favorites', label: 'Favourites' },
  { key: 'type:login', label: 'Logins' },
  { key: 'type:card', label: 'Cards' },
  { key: 'type:note', label: 'Notes' },
] as const

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
  const categories = usedCategories(items)
  const orderedCategories = CATEGORY_IDS.filter((id: CategoryId) => categories.includes(id))
  const tags = usedTags(items)

  const chips: { key: string; label: string }[] = [
    ...BASE_CHIPS.map((chip) => ({ key: chip.key, label: chip.label })),
    ...orderedCategories.map((id) => ({ key: `category:${id}`, label: CATEGORY_LABELS[id] })),
    ...tags.map((tag) => ({ key: `tag:${tag}`, label: `#${tag}` })),
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
            className="h-11 w-full rounded-field border border-line bg-bg pr-3 pl-9 text-ink placeholder:text-ink-muted"
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
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-btn border border-line bg-bg text-ink-muted transition-colors hover:text-ink"
            >
              <ArrowUpDown aria-hidden="true" className="size-4" />
            </button>
          )}
        />
      </div>

      {/* Chips: phones only; the rail carries these on larger screens. */}
      <ul className="flex gap-2 overflow-x-auto px-3 pb-2.5 md:hidden">
        {chips.map((chip) => {
          const active = activeFilter === chip.key
          return (
            <li key={chip.key} className="shrink-0">
              {/* A button, not a link: see chooseFilter in nav-rail. */}
              <button
                type="button"
                onClick={() => onFilterChange(chip.key)}
                aria-pressed={active}
                className={cn(
                  'inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-medium transition-colors',
                  active
                    ? 'border-transparent bg-primary text-on-primary'
                    : 'border-line bg-bg text-ink-muted hover:text-ink',
                )}
              >
                {chip.label}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
