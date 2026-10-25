import type { ItemType } from '@/lib/vault/types'

/**
 * What is on screen in the vault: which filter, which item, which form.
 *
 * WHY THIS EXISTS, rather than just reading the URL through the router:
 *
 * In the App Router, `router.push('/vault?filter=x')` is a SERVER navigation
 * even though the route hasn't changed. It re-runs `proxy.ts`, which calls
 * Supabase to verify the session, then re-renders the page and refetches its
 * payload — before the UI updates at all. Doing that to filter a list that is
 * already decrypted in memory made every click cost a network round-trip.
 *
 * So this module is the source of truth, and the address bar is kept in step
 * with the native History API, which Next.js does not intercept. Deep links,
 * `?item=` sharing and the back button all still work; they just no longer
 * involve the server.
 */

export type CreateTarget = ItemType | 'choose'

export interface VaultViewState {
  /** `all`, `favorites`, `type:login`, `category:work`, `tag:finance`. */
  filter: string
  item: string | null
  create: CreateTarget | null
  edit: boolean
  focusPassword: boolean
  importOpen: boolean
}

export const EMPTY_VIEW: VaultViewState = {
  filter: 'all',
  item: null,
  create: null,
  edit: false,
  focusPassword: false,
  importOpen: false,
}

function isCreateTarget(value: string | null): value is CreateTarget {
  return value === 'login' || value === 'card' || value === 'note' || value === 'choose'
}

export function parseViewSearch(search: string): VaultViewState {
  const params = new URLSearchParams(search)
  const create = params.get('new')
  return {
    filter: params.get('filter') || 'all',
    item: params.get('item'),
    create: isCreateTarget(create) ? create : null,
    edit: params.get('edit') === '1',
    focusPassword: params.get('focus') === 'password',
    importOpen: params.get('import') === '1',
  }
}

/** Only non-default values reach the address bar, so `/vault` stays clean. */
export function toViewSearch(state: VaultViewState): string {
  const params = new URLSearchParams()
  if (state.filter && state.filter !== 'all') params.set('filter', state.filter)
  if (state.item) params.set('item', state.item)
  if (state.create) params.set('new', state.create)
  if (state.edit) params.set('edit', '1')
  if (state.focusPassword) params.set('focus', 'password')
  if (state.importOpen) params.set('import', '1')
  return params.toString()
}

export function viewHref(state: Partial<VaultViewState>): string {
  const search = toViewSearch({ ...EMPTY_VIEW, ...state })
  return search ? `/vault?${search}` : '/vault'
}

// ---------------------------------------------------------------- store ----

let state: VaultViewState = EMPTY_VIEW
const listeners = new Set<() => void>()

/** Same object until something changes, as useSyncExternalStore requires. */
export function getViewState(): VaultViewState {
  return state
}

export function getServerViewState(): VaultViewState {
  return EMPTY_VIEW
}

export function subscribeViewState(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function commit(next: VaultViewState): void {
  state = next
  listeners.forEach((listener) => listener())
}

/** Adopt whatever the address bar says: on mount, and on back/forward. */
export function syncViewFromLocation(): void {
  if (typeof window === 'undefined') return
  const next = parseViewSearch(window.location.search)
  if (toViewSearch(next) === toViewSearch(state)) return
  commit(next)
}

/**
 * Change what is on screen. Updates the address bar without telling the
 * router, so nothing is refetched.
 */
export function setViewState(
  patch: Partial<VaultViewState>,
  options: { replace?: boolean } = {},
): void {
  const next: VaultViewState = { ...state, ...patch }
  const search = toViewSearch(next)
  if (search === toViewSearch(state)) return

  if (typeof window !== 'undefined') {
    const url = search ? `/vault?${search}` : '/vault'
    if (options.replace) window.history.replaceState(null, '', url)
    else window.history.pushState(null, '', url)
  }
  commit(next)
}

/** Picking a filter closes whatever was open beside the list. */
export function setFilter(filter: string): void {
  setViewState({ filter, item: null, create: null, edit: false, focusPassword: false })
}
