import { foldText } from '@/lib/utils'
import { hostOf, siteLabel } from '@/lib/security/url'
import type { CategoryId, ItemPayload, ItemType, VaultItem } from '@/lib/vault/types'

/**
 * Search, filter and sort, all in memory over the decrypted items.
 * Nothing searchable ever leaves the device, because nothing searchable is
 * stored on the server in the first place.
 */

/** The haystack built once per item when it is decrypted. */
export function buildSearchText(payload: ItemPayload): string {
  const parts: string[] = [payload.title]

  if (payload.tags) parts.push(...payload.tags)
  if (payload.category) parts.push(payload.category)

  if (payload.type === 'login') {
    if (payload.username) parts.push(payload.username)
    if (payload.url) {
      parts.push(hostOf(payload.url))
      parts.push(siteLabel(payload.url))
    }
    if (payload.fields) parts.push(...payload.fields.filter((f) => !f.hidden).map((f) => f.label))
  }

  if (payload.type === 'card') {
    if (payload.cardholder) parts.push(payload.cardholder)
    if (payload.number) parts.push(payload.number.replace(/\D/g, '').slice(-4))
  }

  // Passwords, notes, card numbers and 2FA secrets are deliberately absent:
  // a search index of secrets is still an index of secrets.
  return foldText(parts.filter(Boolean).join(' '))
}

/** Lower is better. null means "no match". */
function rankOf(item: VaultItem, needle: string): number | null {
  const title = foldText(item.data.title)
  if (title.startsWith(needle)) return 0
  if (title.includes(needle)) return 1

  if (item.data.type === 'login') {
    const host = foldText(hostOf(item.data.url))
    if (host.includes(needle)) return 2
    const username = foldText(item.data.username ?? '')
    if (username.includes(needle)) return 3
  }

  if (item.data.tags?.some((tag) => foldText(tag).includes(needle))) return 4
  if (item.data.type === 'card') {
    const last4 = (item.data.number ?? '').replace(/\D/g, '').slice(-4)
    if (last4 && last4.includes(needle)) return 2
  }

  return item.searchText.includes(needle) ? 5 : null
}

export function searchItems(items: readonly VaultItem[], query: string): VaultItem[] {
  const needle = foldText(query.trim())
  if (!needle) return [...items]

  const matched: { item: VaultItem; rank: number; index: number }[] = []
  items.forEach((item, index) => {
    const rank = rankOf(item, needle)
    if (rank !== null) matched.push({ item, rank, index })
  })

  matched.sort((a, b) => a.rank - b.rank || a.index - b.index)
  return matched.map((entry) => entry.item)
}

// ---------------------------------------------------------------- filters ---

export type Filter =
  | { kind: 'all' }
  | { kind: 'favorites' }
  | { kind: 'type'; value: ItemType }
  | { kind: 'category'; value: CategoryId }
  | { kind: 'tag'; value: string }

export const ALL_FILTER: Filter = { kind: 'all' }

export function filterKey(filter: Filter): string {
  return filter.kind === 'all' || filter.kind === 'favorites'
    ? filter.kind
    : `${filter.kind}:${filter.value}`
}

export function filterItems(items: readonly VaultItem[], filter: Filter): VaultItem[] {
  switch (filter.kind) {
    case 'all':
      return [...items]
    case 'favorites':
      return items.filter((item) => item.data.favorite === true)
    case 'type':
      return items.filter((item) => item.data.type === filter.value)
    case 'category':
      return items.filter((item) => item.data.category === filter.value)
    case 'tag':
      return items.filter((item) => item.data.tags?.includes(filter.value) === true)
  }
}

/** Categories that actually have items, in the fixed display order. */
export function usedCategories(items: readonly VaultItem[]): CategoryId[] {
  const present = new Set<CategoryId>()
  for (const item of items) {
    if (item.data.category) present.add(item.data.category)
  }
  return Array.from(present)
}

export function usedTags(items: readonly VaultItem[]): string[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    for (const tag of item.data.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return Array.from(counts.keys()).sort((a, b) => a.localeCompare(b))
}

// ------------------------------------------------------------------ sort ----

export type SortMode = 'updated' | 'name' | 'created'

export const SORT_LABELS: Record<SortMode, string> = {
  updated: 'Recently updated',
  name: 'Name A–Z',
  created: 'Recently added',
}

export function sortItems(items: readonly VaultItem[], mode: SortMode): VaultItem[] {
  const sorted = [...items]
  switch (mode) {
    case 'name':
      return sorted.sort((a, b) =>
        a.data.title.localeCompare(b.data.title, undefined, { sensitivity: 'base' }),
      )
    case 'created':
      return sorted.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    case 'updated':
    default:
      return sorted.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  }
}
