'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  Ellipsis,
  ExternalLink,
  Eye,
  EyeOff,
  History,
  Pencil,
  Star,
  Trash2,
} from 'lucide-react'
import {
  MASK,
  cardBrand,
  cn,
  formatDate,
  formatRelative,
  groupCardNumber,
  maskCardNumber,
} from '@/lib/utils'
import { hostOf, safeExternalUrl } from '@/lib/security/url'
import { estimateStrength } from '@/lib/password/strength'
import { CATEGORY_LABELS, type VaultItem } from '@/lib/vault/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Menu } from '@/components/ui/menu'
import { CopyButton } from '@/components/vault/copy-button'
import { Monogram } from '@/components/vault/monogram'
import { SecretText } from '@/components/vault/secret-text'
import { TotpCode } from '@/components/vault/totp-code'

/** Revealed secrets hide themselves again after this long. */
const REVEAL_SECONDS = 20

function useReveal(): [boolean, (value: boolean) => void] {
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    if (!revealed) return
    const timer = setTimeout(() => setRevealed(false), REVEAL_SECONDS * 1000)
    return () => clearTimeout(timer)
  }, [revealed])

  return [revealed, setRevealed]
}

function Row({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1 border-b border-line px-4 py-3 sm:px-5', className)}>
      <span className="text-xs font-medium tracking-wide text-ink-muted">{label}</span>
      <div className="flex min-h-9 items-center gap-2">{children}</div>
    </div>
  )
}

/** A masked value with reveal and copy, used for passwords, CVVs and PINs. */
function SecretRow({
  label,
  value,
  copyLabel,
  trailing,
}: {
  label: string
  value: string
  copyLabel: string
  trailing?: React.ReactNode
}) {
  const [revealed, setRevealed] = useReveal()

  return (
    <Row label={label}>
      <span className="min-w-0 flex-1">
        {revealed ? (
          <SecretText value={value} />
        ) : (
          // A fixed-length mask: the real length is never shown.
          <span className="mono text-ink">{MASK}</span>
        )}
      </span>
      {trailing}
      <IconButton
        label={revealed ? `Hide ${copyLabel.toLowerCase()}` : `Show ${copyLabel.toLowerCase()}`}
        onClick={() => setRevealed(!revealed)}
        className="size-9"
      >
        {revealed ? (
          <EyeOff aria-hidden="true" className="size-4" />
        ) : (
          <Eye aria-hidden="true" className="size-4" />
        )}
      </IconButton>
      <CopyButton value={value} label={copyLabel} size="sm" />
    </Row>
  )
}

export interface ItemDetailProps {
  item: VaultItem
  onEdit: () => void
  onDelete: () => void
  onToggleFavorite: () => void
}

export function ItemDetail({ item, onEdit, onDelete, onToggleFavorite }: ItemDetailProps) {
  const payload = item.data
  const host = payload.type === 'login' ? hostOf(payload.url) : ''
  const link = payload.type === 'login' ? safeExternalUrl(payload.url) : null
  const favorite = payload.favorite === true

  const [showNotes, setShowNotes] = useState(false)

  const strength = useMemo(() => {
    if (payload.type !== 'login' || !payload.password) return null
    return estimateStrength(payload.password, {
      username: payload.username,
      siteName: host,
    })
  }, [payload, host])

  return (
    <article className="flex min-h-full flex-col">
      <header className="flex items-start gap-3 border-b border-line px-4 py-4 sm:px-5">
        <Monogram seed={host || payload.title} label={payload.title} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="plate-tight truncate text-xl text-ink">{payload.title}</h1>
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-flex items-center gap-1 text-sm text-safe underline underline-offset-2"
            >
              {host}
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
          ) : payload.type === 'card' ? (
            <p className="mt-0.5 text-sm text-ink-muted">
              {cardBrand(payload.number ?? '') ?? 'Payment card'}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-ink-muted">Secure note</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            label={favorite ? 'Remove from favourites' : 'Add to favourites'}
            onClick={onToggleFavorite}
            active={favorite}
          >
            <Star aria-hidden="true" className={cn('size-5', favorite && 'fill-brass text-brass')} />
          </IconButton>
          <Button onClick={onEdit} size="sm">
            <Pencil aria-hidden="true" className="size-4" />
            Edit
          </Button>
          <Menu
            label="More actions"
            items={[
              {
                label: 'Delete',
                tone: 'danger',
                icon: <Trash2 aria-hidden="true" className="size-4" />,
                onSelect: onDelete,
              },
            ]}
            trigger={(props) => (
              <button
                type="button"
                {...props}
                aria-label="More actions"
                className="inline-flex size-9 items-center justify-center rounded-btn text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <Ellipsis aria-hidden="true" className="size-5" />
              </button>
            )}
          />
        </div>
      </header>

      <div className="flex-1">
        {payload.type === 'login' ? (
          <>
            {payload.username ? (
              <Row label="Username">
                <span className="secret min-w-0 flex-1 truncate text-ink">{payload.username}</span>
                <CopyButton value={payload.username} label="Username" plain size="sm" />
              </Row>
            ) : null}

            {payload.password ? (
              <>
                <SecretRow
                  label="Password"
                  value={payload.password}
                  copyLabel="Password"
                  trailing={
                    strength ? (
                      <Badge
                        tone={
                          strength.score >= 3 ? 'ok' : strength.score === 2 ? 'warn' : 'danger'
                        }
                      >
                        {strength.label}
                      </Badge>
                    ) : null
                  }
                />
                {payload.passwordUpdatedAt ? (
                  <p className="px-4 py-2 text-xs text-ink-muted sm:px-5">
                    Changed {formatRelative(payload.passwordUpdatedAt)}
                  </p>
                ) : null}
              </>
            ) : null}

            {payload.totp ? (
              <Row label="2FA code">
                <TotpCode secret={payload.totp} className="flex-1" />
              </Row>
            ) : null}

            {payload.fields?.map((field, index) => (
              <div key={`${field.label}-${index}`}>
                {field.hidden ? (
                  <SecretRow label={field.label} value={field.value} copyLabel={field.label} />
                ) : (
                  <Row label={field.label}>
                    <span className="secret min-w-0 flex-1 break-words text-ink">{field.value}</span>
                    <CopyButton value={field.value} label={field.label} size="sm" />
                  </Row>
                )}
              </div>
            ))}
          </>
        ) : null}

        {payload.type === 'card' ? (
          <>
            {payload.cardholder ? (
              <Row label="Cardholder">
                <span className="secret min-w-0 flex-1 truncate text-ink">
                  {payload.cardholder}
                </span>
                <CopyButton value={payload.cardholder} label="Cardholder" plain size="sm" />
              </Row>
            ) : null}

            {payload.number ? (
              <CardNumberRow number={payload.number} />
            ) : null}

            {payload.expMonth && payload.expYear ? (
              <Row label="Expires">
                <span className="tabular secret flex-1 text-ink">
                  {payload.expMonth}/{payload.expYear.slice(-2)}
                </span>
              </Row>
            ) : null}

            {payload.cvv ? (
              <SecretRow label="Security code" value={payload.cvv} copyLabel="Security code" />
            ) : null}

            {payload.pin ? <SecretRow label="PIN" value={payload.pin} copyLabel="PIN" /> : null}
          </>
        ) : null}

        {/* Notes are hidden for every item type: they often hold secrets too. */}
        {payload.notes ? (
          <div className="border-b border-line px-4 py-3 sm:px-5">
            <button
              type="button"
              onClick={() => setShowNotes((value) => !value)}
              aria-expanded={showNotes}
              className="flex w-full items-center justify-between gap-3 text-left text-sm font-medium text-ink"
            >
              {showNotes ? 'Hide notes' : 'Show notes'}
              <ChevronDown
                aria-hidden="true"
                className={cn('size-4 text-ink-muted transition-transform', showNotes && 'rotate-180')}
              />
            </button>
            {showNotes ? (
              <div className="mt-3 flex items-start gap-2">
                <p className="secret min-w-0 flex-1 whitespace-pre-wrap text-ink">{payload.notes}</p>
                <CopyButton value={payload.notes} label="Notes" size="sm" />
              </div>
            ) : null}
          </div>
        ) : null}

        {payload.category || payload.tags?.length ? (
          <Row label="Filed under">
            <div className="flex flex-wrap items-center gap-2">
              {payload.category ? <Badge tone="safe">{CATEGORY_LABELS[payload.category]}</Badge> : null}
              {payload.tags?.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-xs text-ink-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          </Row>
        ) : null}

        {payload.type === 'login' && payload.passwordHistory?.length ? (
          <PasswordHistory entries={payload.passwordHistory} />
        ) : null}
      </div>

      <footer className="px-4 py-4 text-xs text-ink-muted sm:px-5">
        Added {formatDate(item.createdAt)} · Updated {formatDate(item.updatedAt)}
      </footer>
    </article>
  )
}

function CardNumberRow({ number }: { number: string }) {
  const [revealed, setRevealed] = useReveal()
  const digits = number.replace(/\D/g, '')

  return (
    <Row label="Card number">
      <span className="mono secret tabular min-w-0 flex-1 text-ink">
        {revealed ? groupCardNumber(digits) : maskCardNumber(digits)}
      </span>
      <IconButton
        label={revealed ? 'Hide card number' : 'Show card number'}
        onClick={() => setRevealed(!revealed)}
        className="size-9"
      >
        {revealed ? (
          <EyeOff aria-hidden="true" className="size-4" />
        ) : (
          <Eye aria-hidden="true" className="size-4" />
        )}
      </IconButton>
      <CopyButton value={digits} label="Card number" size="sm" />
    </Row>
  )
}

function PasswordHistory({
  entries,
}: {
  entries: { value: string; changedAt: string }[]
}) {
  return (
    <details className="border-b border-line">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-ink sm:px-5">
        <History aria-hidden="true" className="size-4 text-ink-muted" />
        Previous passwords ({entries.length})
      </summary>
      <ul className="hairline-y border-t border-line">
        {entries.map((entry, index) => (
          <li key={`${entry.changedAt}-${index}`} className="px-4 py-2.5 sm:px-5">
            <HistoryEntry value={entry.value} changedAt={entry.changedAt} />
          </li>
        ))}
      </ul>
    </details>
  )
}

function HistoryEntry({ value, changedAt }: { value: string; changedAt: string }) {
  const [revealed, setRevealed] = useReveal()

  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1">
        {revealed ? <SecretText value={value} size="sm" /> : <span className="mono text-sm text-ink">{MASK}</span>}
        <span className="block text-xs text-ink-muted">Replaced {formatRelative(changedAt)}</span>
      </span>
      <IconButton
        label={revealed ? 'Hide previous password' : 'Show previous password'}
        onClick={() => setRevealed(!revealed)}
        className="size-9"
      >
        {revealed ? (
          <EyeOff aria-hidden="true" className="size-4" />
        ) : (
          <Eye aria-hidden="true" className="size-4" />
        )}
      </IconButton>
      <CopyButton value={value} label="Previous password" size="sm" />
    </div>
  )
}
