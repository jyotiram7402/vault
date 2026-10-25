'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { formatRelative } from '@/lib/utils'
import { hostOf } from '@/lib/security/url'
import type { HealthReport } from '@/lib/vault/health'
import type { VaultItem } from '@/lib/vault/types'
import { Badge } from '@/components/ui/badge'
import { Monogram } from '@/components/vault/monogram'

/**
 * Every issue links straight to the item in edit mode with the password field
 * focused and the generator ready, so fixing one is two clicks.
 */
function editHref(item: VaultItem): string {
  return `/vault?item=${encodeURIComponent(item.id)}&edit=1&focus=password`
}

function IssueRow({ item, note }: { item: VaultItem; note?: React.ReactNode }) {
  const host = item.data.type === 'login' ? hostOf(item.data.url) : ''
  return (
    <li>
      <Link
        href={editHref(item)}
        className="flex min-h-16 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2"
      >
        <Monogram seed={host || item.data.title} label={item.data.title} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{item.data.title}</span>
          <span className="secret block truncate text-sm text-ink-muted">
            {item.data.type === 'login' ? item.data.username || host : ''}
          </span>
        </span>
        {note ? <span className="shrink-0">{note}</span> : null}
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
      </Link>
    </li>
  )
}

function Section({
  title,
  description,
  count,
  children,
}: {
  title: string
  description: string
  count: number
  children: React.ReactNode
}) {
  if (count === 0) return null
  return (
    <section className="overflow-hidden rounded-panel border border-line bg-surface">
      <div className="border-b border-line px-4 py-3">
        <h3 className="plate-tight text-base text-ink">
          {title} <span className="tabular text-ink-muted">({count})</span>
        </h3>
        <p className="mt-0.5 text-sm text-ink-muted">{description}</p>
      </div>
      <ul className="hairline-y">{children}</ul>
    </section>
  )
}

export function IssueList({ report, scanned }: { report: HealthReport; scanned: boolean }) {
  const nothingWrong =
    report.weak.length === 0 &&
    report.reused.length === 0 &&
    report.old.length === 0 &&
    report.breached.length === 0

  if (nothingWrong && report.totalLogins > 0) {
    return (
      <section className="rounded-panel border border-ok/40 bg-surface p-5">
        <h3 className="plate-tight text-base text-ink">Nothing needs attention</h3>
        <p className="mt-1 text-ink-muted">
          No weak, reused or ageing passwords
          {scanned ? ', and none of them appear in the breach database' : ''}.
        </p>
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <Section
        title="Breached"
        description="These passwords appear in known data breaches. Change them first."
        count={report.breached.length}
      >
        {report.breached.map((entry) => (
          <IssueRow
            key={entry.item.id}
            item={entry.item}
            note={
              <Badge tone="danger">
                seen {entry.count.toLocaleString('en-GB')} times
              </Badge>
            }
          />
        ))}
      </Section>

      <Section
        title="Weak"
        description="Short or predictable enough to guess. Replace them with generated ones."
        count={report.weak.length}
      >
        {report.weak.map((item) => (
          <IssueRow key={item.id} item={item} />
        ))}
      </Section>

      <Section
        title="Reused"
        description="One stolen password opens every account that shares it."
        count={report.reused.length}
      >
        {report.reused.map((group, index) => (
          <li key={index} className="px-4 py-3">
            <p className="text-sm font-medium text-ink">
              Shared by {group.count} items
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {group.items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={editHref(item)}
                    className="inline-flex min-h-9 items-center gap-2 text-sm text-safe underline underline-offset-2"
                  >
                    {item.data.title}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </Section>

      <Section
        title="Old"
        description="Unchanged for a year or more."
        count={report.old.length}
      >
        {report.old.map((item) => (
          <IssueRow
            key={item.id}
            item={item}
            note={
              <span className="text-xs text-ink-muted">
                {formatRelative(
                  item.data.type === 'login'
                    ? (item.data.passwordUpdatedAt ?? item.createdAt)
                    : item.createdAt,
                )}
              </span>
            }
          />
        ))}
      </Section>
    </div>
  )
}
