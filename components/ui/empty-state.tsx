import { cn } from '@/lib/utils'

export interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, actions, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-start gap-3 px-6 py-12', className)}>
      {icon ? <span aria-hidden="true" className="text-ink-muted">{icon}</span> : null}
      <h2 className="plate-tight text-lg text-ink">{title}</h2>
      {description ? <p className="prose-measure text-ink-muted">{description}</p> : null}
      {actions ? <div className="mt-1 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}
