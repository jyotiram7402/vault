import { cn } from '@/lib/utils'

export interface SettingsSectionProps {
  id?: string
  title: string
  description?: string
  tone?: 'default' | 'danger'
  children: React.ReactNode
  className?: string
}

/** The panel every settings group shares, so they all read the same way. */
export function SettingsSection({
  id,
  title,
  description,
  tone = 'default',
  children,
  className,
}: SettingsSectionProps) {
  return (
    <section
      id={id}
      className={cn(
        'rounded-panel border bg-surface',
        tone === 'danger' ? 'border-danger/40' : 'border-line',
        className,
      )}
    >
      <div className="border-b border-line px-5 py-4">
        <h2 className={cn('plate-tight text-base', tone === 'danger' ? 'text-danger' : 'text-ink')}>
          {title}
        </h2>
        {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

/** A labelled row inside a section. */
export function SettingsRow({
  label,
  description,
  children,
  className,
}: {
  label: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6',
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {description ? <p className="mt-0.5 text-sm text-ink-muted">{description}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
