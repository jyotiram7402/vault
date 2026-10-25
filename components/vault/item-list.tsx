'use client'

import { KeyRound, Plus, Star, Upload } from 'lucide-react'
import type { VaultItem } from '@/lib/vault/types'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ItemRow } from '@/components/vault/item-row'

export interface ItemListProps {
  items: readonly VaultItem[]
  /** Everything in the vault, used to tell "empty vault" from "no matches". */
  totalCount: number
  query: string
  selectedId: string | null
  onSelect: (item: VaultItem) => void
  onToggleFavorite: (item: VaultItem) => void
  onClearSearch: () => void
  onAdd: (type: 'login' | 'card' | 'note', title?: string) => void
  onImport: () => void
  isFavoritesFilter: boolean
}

export function ItemList({
  items,
  totalCount,
  query,
  selectedId,
  onSelect,
  onToggleFavorite,
  onClearSearch,
  onAdd,
  onImport,
  isFavoritesFilter,
}: ItemListProps) {
  if (totalCount === 0) {
    return (
      <EmptyState
        icon={<KeyRound className="size-6" />}
        title="Your vault is empty"
        description="Add your first login, or import passwords from your browser."
        actions={
          <>
            <Button variant="primary" onClick={() => onAdd('login')}>
              <Plus aria-hidden="true" className="size-4" />
              Add login
            </Button>
            <Button onClick={onImport}>
              <Upload aria-hidden="true" className="size-4" />
              Import from browser
            </Button>
          </>
        }
      />
    )
  }

  if (items.length === 0 && query.trim()) {
    return (
      <EmptyState
        title={`Nothing matches “${query.trim()}”.`}
        actions={
          <>
            <Button onClick={onClearSearch}>Clear search</Button>
            <Button variant="primary" onClick={() => onAdd('login', query.trim())}>
              Add “{query.trim()}” as a login
            </Button>
          </>
        }
      />
    )
  }

  if (items.length === 0 && isFavoritesFilter) {
    return (
      <EmptyState
        icon={<Star className="size-6" />}
        title="No favourites yet"
        description="Star an item to keep it here."
      />
    )
  }

  if (items.length === 0) {
    return <EmptyState title="Nothing here yet" description="No items match this filter." />
  }

  return (
    <>
      <p className="tabular px-4 py-2 text-xs text-ink-muted" aria-live="polite">
        {items.length} {items.length === 1 ? 'item' : 'items'}
        {query.trim() ? ` matching “${query.trim()}”` : ''}
      </p>
      <ul className="hairline-y border-t border-line">
        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            query={query}
            selected={item.id === selectedId}
            onSelect={onSelect}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </ul>
    </>
  )
}
