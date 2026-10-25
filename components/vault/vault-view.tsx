'use client'

import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { SessionExpiredError, deleteItemRow, fetchAllItemRows } from '@/lib/vault/api'
import { createItem, mergeRows, restoreItem, saveItem } from '@/lib/vault/items'
import {
  ALL_FILTER,
  filterItems,
  searchItems,
  sortItems,
  type Filter,
  type SortMode,
} from '@/lib/vault/search'
import {
  getVaultKey,
  markSynced,
  removeItem,
  replaceItems,
  upsertItem,
} from '@/lib/vault/store'
import { useVault, useVaultView } from '@/lib/vault/use-vault'
import { setFilter, setViewState, syncViewFromLocation } from '@/lib/vault/view-state'
import { CATEGORY_IDS, type CategoryId, type ItemPayload, type ItemType, type VaultItem } from '@/lib/vault/types'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Sheet } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterBar } from '@/components/vault/filter-bar'
import { ItemList } from '@/components/vault/item-list'
import { ItemDetail } from '@/components/vault/item-detail'
import { ItemForm } from '@/components/vault/item-form'

const ImportDialog = lazy(() =>
  import('@/components/settings/import-dialog').then((module) => ({
    default: module.ImportDialog,
  })),
)

const SYNC_AFTER_MS = 30_000
const SEARCH_DEBOUNCE_MS = 80

function parseFilter(value: string | null): Filter {
  if (!value || value === 'all') return ALL_FILTER
  if (value === 'favorites') return { kind: 'favorites' }
  const [kind, rest] = value.split(':', 2)
  if (!rest) return ALL_FILTER
  if (kind === 'type' && (rest === 'login' || rest === 'card' || rest === 'note')) {
    return { kind: 'type', value: rest }
  }
  if (kind === 'category' && (CATEGORY_IDS as readonly string[]).includes(rest)) {
    return { kind: 'category', value: rest as CategoryId }
  }
  if (kind === 'tag') return { kind: 'tag', value: rest }
  return ALL_FILTER
}

function isItemType(value: string | null): value is ItemType {
  return value === 'login' || value === 'card' || value === 'note'
}

/**
 * Which layout is on screen, decided in JavaScript rather than with a CSS
 * `lg:hidden` wrapper.
 *
 * This matters more than it looks. The small-screen layout puts the form in a
 * native <dialog> opened with showModal(), and a modal dialog makes the rest
 * of the document INERT — every click outside it is swallowed. Hiding that
 * dialog with CSS does not undo the inertness, so rendering both layouts at
 * once froze the whole desktop page. Only one layout may exist at a time.
 *
 * It also avoids mounting the form twice, which duplicated every input id.
 */
function useIsDesktop(): boolean {
  // Read on the very first render so there is no wrong frame. Safe: VaultView
  // only ever mounts client-side, because the gate renders its "checking"
  // panel during SSR and swaps to this afterwards — so there is nothing to
  // hydrate against and `window` is always present here.
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 1024px)').matches,
  )

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)')
    const apply = () => setIsDesktop(query.matches)
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [])

  return isDesktop
}

export function VaultView() {
  const router = useRouter()
  const { toast } = useToast()
  const { items, userId, lastSyncedAt } = useVault()
  const view = useVaultView()
  const isDesktop = useIsDesktop()

  const [rawQuery, setRawQuery] = useState('')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortMode>('updated')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formDirty, setFormDirty] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<VaultItem | null>(null)

  const filter = useMemo(() => parseFilter(view.filter), [view.filter])
  const selectedId = view.item
  const newType = view.create
  const editing = view.edit
  const focusPassword = view.focusPassword
  const importOpen = view.importOpen

  const selected = useMemo(
    () => (selectedId ? (items.find((item) => item.id === selectedId) ?? null) : null),
    [items, selectedId],
  )
  // `choose` opens the type picker; a concrete type goes straight to a form.
  const creating = newType !== null
  const formOpen = creating || (editing && selected !== null)

  // Adopt the address bar on mount, and whenever the user goes back or
  // forward. Everything in between is handled without touching the router.
  useEffect(() => {
    syncViewFromLocation()
    const handlePopState = () => syncViewFromLocation()
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // 80 ms is enough to stop every keystroke re-ranking a large vault.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(rawQuery), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [rawQuery])

  const visible = useMemo(
    () => sortItems(searchItems(filterItems(items, filter), query), query.trim() ? 'updated' : sort),
    [items, filter, query, sort],
  )

  // ------------------------------------------------------------------ sync --

  const sync = useCallback(async () => {
    if (!userId) return
    try {
      const supabase = createClient()
      const rows = await fetchAllItemRows(supabase, userId)
      const merged = await mergeRows(getVaultKey(), userId, rows, items)
      replaceItems(merged.items)
    } catch (cause) {
      if (cause instanceof SessionExpiredError) {
        router.replace('/login?next=/vault')
        return
      }
      // A failed background refresh is not worth interrupting anyone over.
      markSynced()
    }
  }, [items, router, userId])

  useEffect(() => {
    const maybeSync = () => {
      if (document.visibilityState !== 'visible') return
      if (lastSyncedAt !== null && Date.now() - lastSyncedAt < SYNC_AFTER_MS) return
      void sync()
    }
    window.addEventListener('focus', maybeSync)
    document.addEventListener('visibilitychange', maybeSync)
    return () => {
      window.removeEventListener('focus', maybeSync)
      document.removeEventListener('visibilitychange', maybeSync)
    }
  }, [lastSyncedAt, sync])

  // ---------------------------------------------------------------- actions -

  const requireOnline = useCallback((): boolean => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast({
        message: 'You’re offline. Changes can’t be saved until you reconnect.',
        tone: 'danger',
      })
      return false
    }
    return true
  }, [toast])

  const closeForm = useCallback(() => {
    setFormDirty(false)
    setFormError(null)
    setDiscardOpen(false)
    setViewState({ create: null, edit: false, focusPassword: false })
  }, [])

  const requestCloseForm = useCallback(() => {
    if (formDirty) setDiscardOpen(true)
    else closeForm()
  }, [closeForm, formDirty])

  const handleSave = useCallback(
    async (payload: ItemPayload) => {
      if (!userId || !requireOnline()) return
      setSaving(true)
      setFormError(null)
      try {
        const supabase = createClient()
        const key = getVaultKey()

        if (creating) {
          const created = await createItem(supabase, key, userId, payload)
          upsertItem(created)
          toast({
            message:
              payload.type === 'login'
                ? 'Login saved'
                : payload.type === 'card'
                  ? 'Card saved'
                  : 'Note saved',
            tone: 'success',
          })
          setFormDirty(false)
          setViewState(
            { create: null, edit: false, focusPassword: false, item: created.id },
            { replace: true },
          )
        } else if (selected) {
          const updated = await saveItem(
            supabase,
            key,
            userId,
            selected.id,
            payload,
            selected.createdAt,
          )
          upsertItem(updated)
          toast({
            message:
              payload.type === 'login'
                ? 'Login saved'
                : payload.type === 'card'
                  ? 'Card saved'
                  : 'Note saved',
            tone: 'success',
          })
          setFormDirty(false)
          setViewState({ edit: false, focusPassword: false })
        }
      } catch (cause) {
        if (cause instanceof SessionExpiredError) {
          router.replace('/login?next=/vault')
          return
        }
        setFormError(cause instanceof Error ? cause.message : 'Couldn’t save this item.')
      } finally {
        setSaving(false)
      }
    },
    [creating, requireOnline, router, selected, toast, userId],
  )

  const handleToggleFavorite = useCallback(
    async (item: VaultItem) => {
      if (!userId || !requireOnline()) return
      const next: ItemPayload = { ...item.data, favorite: !item.data.favorite }
      // Optimistic: flip it now, put it back if the save fails.
      upsertItem({ ...item, data: next })
      try {
        const supabase = createClient()
        const saved = await saveItem(
          supabase,
          getVaultKey(),
          userId,
          item.id,
          next,
          item.createdAt,
        )
        upsertItem(saved)
      } catch {
        upsertItem(item)
        toast({ message: 'Couldn’t update that item.', tone: 'danger' })
      }
    },
    [requireOnline, toast, userId],
  )

  const handleDelete = useCallback(
    async (item: VaultItem) => {
      if (!userId || !requireOnline()) return
      setDeleteTarget(null)
      removeItem(item.id)
      if (selectedId === item.id) {
        setViewState({ item: null, edit: false, focusPassword: false }, { replace: true })
      }

      try {
        const supabase = createClient()
        await deleteItemRow(supabase, userId, item.id)
        toast({
          message: `“${item.data.title}” deleted`,
          action: {
            label: 'Undo',
            onClick: () => {
              void (async () => {
                try {
                  await restoreItem(createClient(), userId, item)
                  upsertItem(item)
                } catch {
                  toast({ message: 'Couldn’t restore that item.', tone: 'danger' })
                }
              })()
            },
          },
          duration: 8000,
        })
      } catch (cause) {
        upsertItem(item)
        toast({
          message: cause instanceof Error ? cause.message : 'Couldn’t delete that item.',
          tone: 'danger',
        })
      }
    },
    [requireOnline, selectedId, toast, userId],
  )

  // --------------------------------------------------------------- rendering

  const formNode = formOpen ? (
    <ItemForm
      key={creating ? `new-${newType}` : `edit-${selected?.id}`}
      item={creating ? null : selected}
      defaultType={isItemType(newType) ? newType : 'choose'}
      defaultTitle={creating && query.trim() ? query.trim() : ''}
      focusPassword={focusPassword}
      saving={saving}
      error={formError}
      onSave={(payload) => void handleSave(payload)}
      onCancel={requestCloseForm}
      onDirtyChange={setFormDirty}
    />
  ) : null

  const detailNode = selected ? (
    <ItemDetail
      item={selected}
      onEdit={() => setViewState({ edit: true })}
      onDelete={() => setDeleteTarget(selected)}
      onToggleFavorite={() => void handleToggleFavorite(selected)}
    />
  ) : null

  return (
    <div className="flex min-h-full">
      {/* List pane */}
      <section
        aria-label="Items"
        className={cn(
          'flex min-w-0 flex-1 flex-col border-line lg:w-[380px] lg:max-w-[380px] lg:flex-none lg:border-r',
        )}
      >
        <FilterBar
          query={rawQuery}
          onQueryChange={setRawQuery}
          activeFilter={view.filter}
          onFilterChange={setFilter}
          sort={sort}
          onSortChange={setSort}
          items={items}
        />
        <div className="flex-1 overflow-y-auto">
          <ItemList
            items={visible}
            totalCount={items.length}
            query={query}
            selectedId={selectedId}
            onSelect={(item) => setViewState({ item: item.id })}
            onToggleFavorite={(item) => void handleToggleFavorite(item)}
            onClearSearch={() => {
              setRawQuery('')
              setQuery('')
            }}
            onAdd={(type) => setViewState({ create: type })}
            onImport={() => setViewState({ importOpen: true })}
            isFavoritesFilter={filter.kind === 'favorites'}
          />
        </div>
      </section>

      {/* Detail pane: desktop only. Phones and tablets get the sheet below,
          and the two are mutually exclusive — see useIsDesktop. The CSS guard
          stays as well, so a resize never shows this pane beside the list
          before the media-query listener catches up. */}
      {isDesktop ? (
        <section aria-label="Item details" className="hidden min-w-0 flex-1 lg:block">
          {formOpen ? (
            formNode
          ) : selected ? (
            detailNode
          ) : (
            <EmptyState
              title="Nothing selected"
              description="Choose an item on the left, or add a new one."
              actions={
                <Button variant="primary" onClick={() => setViewState({ create: 'login' })}>
                  <Plus aria-hidden="true" className="size-4" />
                  Add login
                </Button>
              }
            />
          )}
        </section>
      ) : null}

      {/* Floating add button on phones and tablets */}
      <button
        type="button"
        onClick={() => setViewState({ create: 'choose' })}
        aria-label="Add item"
        className="fixed right-4 bottom-20 z-30 inline-flex size-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-overlay transition-[filter] hover:brightness-110 lg:hidden"
      >
        <Plus aria-hidden="true" className="size-6" />
      </button>

      {/* Sheets for smaller screens. Never mounted on desktop: an open
          <dialog> would make the page inert even while hidden. */}
      {!isDesktop ? (
        <>
          <Sheet
            open={formOpen}
            onClose={requestCloseForm}
            guardClose
            title={creating ? 'New item' : 'Edit item'}
          >
            {formNode}
          </Sheet>

          <Sheet
            open={!formOpen && selected !== null}
            onClose={() => setViewState({ item: null })}
            title={selected?.data.title ?? 'Item'}
          >
            {detailNode}
          </Sheet>
        </>
      ) : null}

      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={`Delete “${deleteTarget?.data.title ?? ''}”?`}
        description="You can undo this for a few seconds."
        size="sm"
        footer={
          <>
            <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => deleteTarget && void handleDelete(deleteTarget)}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-ink-muted">
          This item will be removed from your vault on every device.
        </p>
      </Dialog>

      <Dialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="Discard your changes?"
        size="sm"
        footer={
          <>
            <Button onClick={() => setDiscardOpen(false)}>Keep editing</Button>
            <Button variant="danger" onClick={closeForm}>
              Discard
            </Button>
          </>
        }
      >
        <p className="text-ink-muted">Anything you have typed here will be lost.</p>
      </Dialog>

      {importOpen ? (
        <Suspense fallback={null}>
          <ImportDialog
            open
            onClose={() => setViewState({ importOpen: false }, { replace: true })}
          />
        </Suspense>
      ) : null}
    </div>
  )
}
