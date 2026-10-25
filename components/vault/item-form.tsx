'use client'

import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, CreditCard, Dices, KeyRound, Plus, StickyNote, Trash2 } from 'lucide-react'
import { cardBrand, cn, groupCardNumber, luhnValid } from '@/lib/utils'
import { hostOf, normalizeWebsite } from '@/lib/security/url'
import { estimateStrength } from '@/lib/password/strength'
import { generateTotp, parseTotpInput } from '@/lib/totp'
import {
  CATEGORY_IDS,
  CATEGORY_LABELS,
  ITEM_TYPE_LABELS,
  LIMITS,
  type CardItem,
  type CategoryId,
  type CustomField,
  type ItemPayload,
  type ItemType,
  type LoginItem,
  type NoteItem,
  type VaultItem,
} from '@/lib/vault/types'
import { Button } from '@/components/ui/button'
import { Field, describedBy } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { StrengthMeter } from '@/components/vault/strength-meter'

// Behind a "Generate" toggle, so it stays out of the vault's first load.
const PasswordGenerator = lazy(() =>
  import('@/components/generator/password-generator').then((module) => ({
    default: module.PasswordGenerator,
  })),
)

/**
 * Add and edit.
 *
 * Every field here holds something private, so each input turns off spell
 * check, autocorrect, translation and the browser's own password manager —
 * otherwise Chrome offers to save vault items into Chrome.
 */

const TYPE_OPTIONS: { type: ItemType; icon: typeof KeyRound; description: string }[] = [
  { type: 'login', icon: KeyRound, description: 'A website or app sign-in' },
  { type: 'card', icon: CreditCard, description: 'A payment card' },
  { type: 'note', icon: StickyNote, description: 'Anything else worth encrypting' },
]

const CATEGORY_OPTIONS = [
  ...CATEGORY_IDS.map((id) => ({ value: id, label: CATEGORY_LABELS[id] })),
]

interface FormState {
  type: ItemType
  title: string
  url: string
  username: string
  password: string
  totp: string
  cardholder: string
  number: string
  expMonth: string
  expYear: string
  cvv: string
  pin: string
  notes: string
  category: string
  tags: string
  favorite: boolean
  fields: CustomField[]
}

function initialState(item: VaultItem | null, type: ItemType, title: string): FormState {
  const base: FormState = {
    type,
    title,
    url: '',
    username: '',
    password: '',
    totp: '',
    cardholder: '',
    number: '',
    expMonth: '',
    expYear: '',
    cvv: '',
    pin: '',
    notes: '',
    category: '',
    tags: '',
    favorite: false,
    fields: [],
  }
  if (!item) return base

  const payload = item.data
  const common: FormState = {
    ...base,
    type: payload.type,
    title: payload.title,
    notes: payload.notes ?? '',
    category: payload.category ?? '',
    tags: (payload.tags ?? []).join(', '),
    favorite: payload.favorite === true,
  }

  if (payload.type === 'login') {
    return {
      ...common,
      url: payload.url ?? '',
      username: payload.username ?? '',
      password: payload.password ?? '',
      totp: payload.totp ?? '',
      fields: payload.fields ? payload.fields.map((field) => ({ ...field })) : [],
    }
  }
  if (payload.type === 'card') {
    return {
      ...common,
      cardholder: payload.cardholder ?? '',
      number: payload.number ?? '',
      expMonth: payload.expMonth ?? '',
      expYear: payload.expYear ?? '',
      cvv: payload.cvv ?? '',
      pin: payload.pin ?? '',
    }
  }
  return common
}

function parseTags(value: string): string[] | undefined {
  const tags = Array.from(
    new Set(
      value
        .split(',')
        .map((tag) => tag.trim().slice(0, LIMITS.tagLength))
        .filter(Boolean),
    ),
  ).slice(0, LIMITS.tags)
  return tags.length > 0 ? tags : undefined
}

export interface ItemFormProps {
  /** null for a new item. */
  item: VaultItem | null
  /** 'choose' opens the type picker first; a type skips straight to the form. */
  defaultType?: ItemType | 'choose'
  defaultTitle?: string
  /** Opens with the password field focused and the generator ready. */
  focusPassword?: boolean
  saving: boolean
  error: string | null
  onSave: (payload: ItemPayload) => void
  onCancel: () => void
  onDirtyChange?: (dirty: boolean) => void
}

export function ItemForm({
  item,
  defaultType = 'login',
  defaultTitle = '',
  focusPassword = false,
  saving,
  error,
  onSave,
  onCancel,
  onDirtyChange,
}: ItemFormProps) {
  const isNew = item === null
  const startType: ItemType = defaultType === 'choose' ? 'login' : defaultType
  const [typeChosen, setTypeChosen] = useState(!isNew || defaultType !== 'choose')
  const [state, setState] = useState<FormState>(() =>
    initialState(item, startType, defaultTitle),
  )
  const [showGenerator, setShowGenerator] = useState(focusPassword)
  const [totpError, setTotpError] = useState<string | null>(null)
  const [titleError, setTitleError] = useState<string | null>(null)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  /**
   * Quick entry is the common case: a name and a password. Everything else
   * folds away — but opens automatically when an existing item already uses
   * it, so nothing is ever hidden from the person editing it.
   */
  const [showMore, setShowMore] = useState(() => {
    if (isNew) return false
    const initial = initialState(item, startType, defaultTitle)
    return Boolean(
      initial.url ||
        initial.username ||
        initial.totp ||
        initial.tags ||
        initial.favorite ||
        initial.fields.length > 0,
    )
  })

  const initialRef = useRef(JSON.stringify(initialState(item, startType, defaultTitle)))
  const passwordRef = useRef<HTMLInputElement>(null)

  const dirty = JSON.stringify(state) !== initialRef.current
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    if (focusPassword) passwordRef.current?.focus()
  }, [focusPassword])

  const update = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((current) => {
      const next: FormState = { ...current }
      next[key] = value
      return next
    })
  }, [])

  const strength = useMemo(
    () =>
      estimateStrength(state.password, {
        username: state.username,
        siteName: hostOf(state.url),
      }),
    [state.password, state.username, state.url],
  )

  const brand = cardBrand(state.number)
  const luhnWarning =
    state.number.replace(/\D/g, '').length >= 12 && !luhnValid(state.number)
      ? 'That number doesn’t pass the usual checksum. Save it anyway if it’s correct.'
      : null

  const build = async (): Promise<ItemPayload | null> => {
    setTitleError(null)
    setUrlError(null)
    setTotpError(null)
    setPasswordError(null)

    const now = new Date().toISOString()
    const tags = parseTags(state.tags)
    // Validate against the real list before narrowing the string.
    const category = (CATEGORY_IDS as readonly string[]).includes(state.category)
      ? (state.category as CategoryId)
      : undefined

    let url: string | undefined
    if (state.type === 'login' && state.url.trim()) {
      const normalized = normalizeWebsite(state.url)
      if (!normalized) {
        setUrlError('Enter a web address like example.com')
        // The field lives under "More options"; open it so the error is seen.
        setShowMore(true)
        return null
      }
      url = normalized.slice(0, LIMITS.url)
    }

    const title =
      state.title.trim() || (state.type === 'login' ? hostOf(url) : '') || ''
    if (!title) {
      setTitleError('Give this item a name.')
      return null
    }

    const common = {
      v: 1 as const,
      title: title.slice(0, LIMITS.title),
      notes: state.notes.trim() ? state.notes.slice(0, LIMITS.notes) : undefined,
      category,
      tags,
      favorite: state.favorite || undefined,
      createdAt: item?.data.createdAt ?? now,
      updatedAt: now,
    }

    if (state.type === 'note') {
      const note: NoteItem = { ...common, type: 'note' }
      return note
    }

    if (state.type === 'card') {
      const card: CardItem = {
        ...common,
        type: 'card',
        cardholder: state.cardholder.trim().slice(0, LIMITS.cardholder) || undefined,
        number: state.number.replace(/\D/g, '').slice(0, LIMITS.cardNumber) || undefined,
        expMonth: state.expMonth || undefined,
        expYear: state.expYear || undefined,
        cvv: state.cvv.trim().slice(0, LIMITS.cvv) || undefined,
        pin: state.pin.trim().slice(0, LIMITS.pin) || undefined,
      }
      return card
    }

    // A login is a credential; without one it is really a note.
    if (!state.password) {
      setPasswordError('Add a password, or save this as a secure note instead.')
      return null
    }

    // Validate a 2FA key by actually generating a code with it.
    let totp: string | undefined
    if (state.totp.trim()) {
      try {
        const config = parseTotpInput(state.totp)
        await generateTotp(config)
        totp = state.totp.trim().slice(0, LIMITS.totp)
      } catch (cause) {
        setTotpError(
          cause instanceof Error ? cause.message : 'That doesn’t look like a valid setup key.',
        )
        // As above: don't hide the reason the save failed.
        setShowMore(true)
        return null
      }
    }

    const previous: LoginItem | null =
      item !== null && item.data.type === 'login' ? item.data : null
    const passwordChanged =
      Boolean(state.password) && previous !== null && previous.password !== state.password

    // Keep the old password so it can be recognised as reused or breached later.
    const history = passwordChanged && previous?.password
      ? [
          { value: previous.password, changedAt: previous.passwordUpdatedAt ?? item?.createdAt ?? now },
          ...(previous.passwordHistory ?? []),
        ].slice(0, LIMITS.passwordHistory)
      : previous?.passwordHistory

    const login: LoginItem = {
      ...common,
      type: 'login',
      url,
      username: state.username.trim().slice(0, LIMITS.username) || undefined,
      password: state.password.slice(0, LIMITS.password) || undefined,
      totp,
      passwordUpdatedAt:
        passwordChanged || (!previous && state.password)
          ? now
          : previous?.passwordUpdatedAt,
      passwordHistory: history && history.length > 0 ? history : undefined,
      fields: state.fields.length > 0
        ? state.fields
            .filter((field) => field.label.trim() || field.value.trim())
            .slice(0, LIMITS.fields)
            .map((field) => ({
              label: field.label.trim().slice(0, LIMITS.fieldLabel) || 'Field',
              value: field.value.slice(0, LIMITS.fieldValue),
              hidden: field.hidden,
            }))
        : undefined,
    }
    return login
  }

  const submit = async () => {
    const payload = await build()
    if (payload) onSave(payload)
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    void submit()
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      void submit()
    }
  }

  // ------------------------------------------------------------ type picker -

  if (isNew && !typeChosen) {
    return (
      <div className="p-4 sm:p-6">
        <h2 className="plate text-xl text-ink">What are you adding?</h2>
        <ul className="mt-5 flex flex-col gap-2">
          {TYPE_OPTIONS.map((option) => (
            <li key={option.type}>
              <button
                type="button"
                onClick={() => {
                  setState((current) => ({ ...current, type: option.type }))
                  initialRef.current = JSON.stringify({ ...state, type: option.type })
                  setTypeChosen(true)
                }}
                className="flex w-full items-center gap-3 rounded-panel border border-line bg-surface p-4 text-left transition-colors hover:bg-surface-2"
              >
                <option.icon aria-hidden="true" className="size-5 shrink-0 text-safe" />
                <span className="min-w-0">
                  <span className="block font-medium text-ink">
                    {ITEM_TYPE_LABELS[option.type]}
                  </span>
                  <span className="block text-sm text-ink-muted">{option.description}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <Button className="mt-5" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    )
  }

  const saveLabel =
    state.type === 'login' ? 'Save login' : state.type === 'card' ? 'Save card' : 'Save note'

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="flex flex-col">
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <Field id="form-title" label="Title" required error={titleError}>
          <Input
            id="form-title"
            value={state.title}
            onChange={(event) => update('title', event.target.value)}
            maxLength={LIMITS.title}
            autoComplete="off"
            secret
            autoFocus={!focusPassword}
            invalid={Boolean(titleError)}
            aria-describedby={describedBy('form-title', undefined, titleError)}
          />
        </Field>

        {state.type === 'login' ? (
          <>
            <div className="flex flex-col gap-2">
              <Field id="form-password" label="Password" required error={passwordError}>
                <PasswordInput
                  id="form-password"
                  ref={passwordRef}
                  value={state.password}
                  onChange={(event) => update('password', event.target.value)}
                  maxLength={LIMITS.password}
                  autoComplete="new-password"
                  invalid={Boolean(passwordError)}
                  aria-describedby={passwordError ? 'form-password-error' : undefined}
                />
              </Field>
              {state.password ? <StrengthMeter result={strength} /> : null}
              <button
                type="button"
                onClick={() => setShowGenerator((value) => !value)}
                aria-expanded={showGenerator}
                className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-safe underline underline-offset-2"
              >
                <Dices aria-hidden="true" className="size-4" />
                {showGenerator ? 'Hide generator' : 'Generate'}
              </button>
              {showGenerator ? (
                <div className="rounded-panel border border-line bg-bg p-4">
                  <Suspense
                    fallback={<p className="text-sm text-ink-muted">Loading generator…</p>}
                  >
                    <PasswordGenerator
                      onUse={(value) => {
                        update('password', value)
                        setShowGenerator(false)
                      }}
                    />
                  </Suspense>
                </div>
              ) : null}
            </div>

          </>
        ) : null}

        {state.type === 'card' ? (
          <>
            <Field id="form-cardholder" label="Cardholder" optional>
              <Input
                id="form-cardholder"
                value={state.cardholder}
                onChange={(event) => update('cardholder', event.target.value)}
                maxLength={LIMITS.cardholder}
                autoComplete="off"
                secret
              />
            </Field>

            <Field
              id="form-number"
              label="Card number"
              optional
              hint={
                luhnWarning ??
                (brand ? `Looks like a ${brand} card.` : 'Stored as digits only.')
              }
            >
              <Input
                id="form-number"
                value={groupCardNumber(state.number)}
                onChange={(event) => update('number', event.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                autoComplete="off"
                secret
                className="mono tabular"
                aria-describedby="form-number-hint"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field id="form-exp-month" label="Expiry month" optional>
                <Input
                  id="form-exp-month"
                  value={state.expMonth}
                  onChange={(event) =>
                    update('expMonth', event.target.value.replace(/\D/g, '').slice(0, 2))
                  }
                  placeholder="MM"
                  inputMode="numeric"
                  maxLength={2}
                  autoComplete="off"
                  secret
                  className="mono tabular"
                />
              </Field>
              <Field id="form-exp-year" label="Expiry year" optional>
                <Input
                  id="form-exp-year"
                  value={state.expYear}
                  onChange={(event) =>
                    update('expYear', event.target.value.replace(/\D/g, '').slice(0, 4))
                  }
                  placeholder="YYYY"
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="off"
                  secret
                  className="mono tabular"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field id="form-cvv" label="Security code" optional>
                <PasswordInput
                  id="form-cvv"
                  value={state.cvv}
                  onChange={(event) => update('cvv', event.target.value.replace(/\D/g, ''))}
                  maxLength={LIMITS.cvv}
                  inputMode="numeric"
                  autoComplete="off"
                />
              </Field>
              <Field id="form-pin" label="PIN" optional>
                <PasswordInput
                  id="form-pin"
                  value={state.pin}
                  onChange={(event) => update('pin', event.target.value.replace(/\D/g, ''))}
                  maxLength={LIMITS.pin}
                  inputMode="numeric"
                  autoComplete="off"
                />
              </Field>
            </div>
          </>
        ) : null}

        {state.type !== 'note' ? (
          <>
            <Field id="form-category" label="Category" optional>
              <Select
                id="form-category"
                value={state.category}
                onChange={(event) => update('category', event.target.value)}
                options={CATEGORY_OPTIONS}
                placeholder="No category"
              />
            </Field>

          </>
        ) : null}

        <Field id="form-notes" label="Notes" optional={state.type !== 'note'}>
          <Textarea
            id="form-notes"
            value={state.notes}
            onChange={(event) => update('notes', event.target.value)}
            maxLength={LIMITS.notes}
            rows={state.type === 'note' ? 10 : 4}
            autoComplete="off"
            secret
          />
        </Field>

        {/* Everything below is optional and folded away by default, so the
            common case — a name and a password — stays a short form. */}
        <details
          open={showMore}
          onToggle={(event) => setShowMore(event.currentTarget.open)}
          className="rounded-panel border border-line"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-ink">
            More options
            <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
          </summary>

          <div className="flex flex-col gap-4 border-t border-line p-4">
            {state.type === 'login' ? (
              <>
                <Field id="form-url" label="Website" optional error={urlError}>
                  <Input
                    id="form-url"
                    value={state.url}
                    onChange={(event) => update('url', event.target.value)}
                    placeholder="example.com"
                    inputMode="url"
                    maxLength={LIMITS.url}
                    autoComplete="off"
                    secret
                    invalid={Boolean(urlError)}
                    aria-describedby={describedBy('form-url', undefined, urlError)}
                  />
                </Field>

                <Field id="form-username" label="Username or email" optional>
                  <Input
                    id="form-username"
                    value={state.username}
                    onChange={(event) => update('username', event.target.value)}
                    maxLength={LIMITS.username}
                    autoComplete="off"
                    secret
                  />
                </Field>

                <Field
                  id="form-totp"
                  label="2FA setup key"
                  optional
                  hint="Paste the setup key or otpauth link from the site."
                  error={totpError}
                >
                  <Input
                    id="form-totp"
                    value={state.totp}
                    onChange={(event) => update('totp', event.target.value)}
                    maxLength={LIMITS.totp}
                    autoComplete="off"
                    secret
                    className="mono"
                    invalid={Boolean(totpError)}
                    aria-describedby={describedBy(
                      'form-totp',
                      'Paste the setup key or otpauth link from the site.',
                      totpError,
                    )}
                  />
                </Field>
              </>
            ) : null}

            {state.type !== 'note' ? (
              <Field id="form-tags" label="Tags" optional hint="Separate tags with commas.">
                <Input
                  id="form-tags"
                  value={state.tags}
                  onChange={(event) => update('tags', event.target.value)}
                  autoComplete="off"
                  secret
                  aria-describedby="form-tags-hint"
                />
              </Field>
            ) : null}

            <Switch
              label="Favourite"
              description="Keeps this item in the Favourites filter."
              checked={state.favorite}
              onChange={(favorite) => update('favorite', favorite)}
            />

            {state.type === 'login' ? (
          <fieldset className="rounded-panel border border-line p-4">
            <legend className="px-1 text-sm font-medium text-ink">Custom fields</legend>
            <ul className="flex flex-col gap-3">
              {state.fields.map((field, index) => (
                <li key={index} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <label className="flex-1 text-sm">
                    <span className="mb-1 block text-ink-muted">Label</span>
                    <Input
                      value={field.label}
                      onChange={(event) =>
                        update(
                          'fields',
                          state.fields.map((entry, position) =>
                            position === index ? { ...entry, label: event.target.value } : entry,
                          ),
                        )
                      }
                      maxLength={LIMITS.fieldLabel}
                      autoComplete="off"
                      secret
                    />
                  </label>
                  <label className="flex-1 text-sm">
                    <span className="mb-1 block text-ink-muted">Value</span>
                    <Input
                      value={field.value}
                      onChange={(event) =>
                        update(
                          'fields',
                          state.fields.map((entry, position) =>
                            position === index ? { ...entry, value: event.target.value } : entry,
                          ),
                        )
                      }
                      maxLength={LIMITS.fieldValue}
                      type={field.hidden ? 'password' : 'text'}
                      autoComplete="off"
                      secret
                    />
                  </label>
                  <div className="flex items-center gap-1">
                    <label className="flex items-center gap-1.5 text-sm text-ink-muted">
                      <input
                        type="checkbox"
                        checked={field.hidden}
                        onChange={(event) =>
                          update(
                            'fields',
                            state.fields.map((entry, position) =>
                              position === index
                                ? { ...entry, hidden: event.target.checked }
                                : entry,
                            ),
                          )
                        }
                        className="size-4 accent-[var(--primary)]"
                      />
                      Hide
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        update(
                          'fields',
                          state.fields.filter((_, position) => position !== index),
                        )
                      }
                      aria-label={`Remove field ${index + 1}`}
                      className="inline-flex size-11 items-center justify-center rounded-btn text-ink-muted hover:text-danger"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {state.fields.length < LIMITS.fields ? (
              <Button
                size="sm"
                className="mt-3"
                onClick={() =>
                  update('fields', [...state.fields, { label: '', value: '', hidden: false }])
                }
              >
                <Plus aria-hidden="true" className="size-4" />
                Add field
              </Button>
            ) : null}
          </fieldset>
            ) : null}
          </div>
        </details>

        {error ? (
          <p role="alert" className="rounded-field border border-danger/50 bg-surface-2 px-3 py-2.5 text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
      </div>

      <div
        className={cn(
          'safe-bottom sticky bottom-0 flex items-center justify-end gap-2 border-t border-line bg-surface px-4 py-3 sm:px-5',
        )}
      >
        <Button onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          {saveLabel}
        </Button>
      </div>
    </form>
  )
}
