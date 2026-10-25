'use client'

import { Star } from 'lucide-react'
import { cn, maskCardNumber, splitHighlight } from '@/lib/utils'
import { hostOf } from '@/lib/security/url'
import type { VaultItem } from '@/lib/vault/types'
import { Monogram } from '@/components/vault/monogram'
import { CopyButton } from '@/components/vault/copy-button'

function secondLine(item: VaultItem): string {
  if (item.data.type === 'login') {
    return item.data.username || hostOf(item.data.url) || 'No username'
  }
  if (item.data.type === 'card') {
    return maskCardNumber(item.data.number ?? '')
  }
  return 'Secure note'
}

export interface ItemRowProps {
  item: VaultItem
  query: string
  selected: boolean
  onSelect: (item: VaultItem) => void
  onToggleFavorite: (item: VaultItem) => void
}

export function ItemRow({ item, query, selected, onSelect, onToggleFavorite }: ItemRowProps) {
  const host = item.data.type === 'login' ? hostOf(item.data.url) : ''
  const password = item.data.type === 'login' ? item.data.password : undefined
  const favorite = item.data.favorite === true

  return (
    <li className={cn('list-cv flex items-center gap-1 pr-2', selected && 'bg-surface-2')}>
      <button
        type="button"
        onClick={() => onSelect(item)}
        aria-current={selected ? 'true' : undefined}
        className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 text-left"
      >
        <Monogram seed={host || item.data.title} label={item.data.title} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">
            {splitHighlight(item.data.title, query).map((run, index) =>
              run.match ? (
                <mark key={index} className="bg-transparent font-semibold text-safe">
                  {run.text}
                </mark>
              ) : (
                <span key={index}>{run.text}</span>
              ),
            )}
          </span>
          <span className="secret block truncate text-sm text-ink-muted">{secondLine(item)}</span>
        </span>
      </button>

      <button
        type="button"
        onClick={() => onToggleFavorite(item)}
        aria-pressed={favorite}
        aria-label={favorite ? `Remove ${item.data.title} from favourites` : `Add ${item.data.title} to favourites`}
        title={favorite ? 'Remove from favourites' : 'Add to favourites'}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-btn text-ink-muted transition-colors hover:bg-surface hover:text-ink"
      >
        <Star
          aria-hidden="true"
          className={cn('size-4', favorite && 'fill-brass text-brass')}
        />
      </button>

      {password ? <CopyButton value={password} label="Password" size="sm" /> : null}
    </li>
  )
}
