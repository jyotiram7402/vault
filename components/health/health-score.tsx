import { cn } from '@/lib/utils'
import { healthLabel, type HealthReport } from '@/lib/vault/health'

const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function ringColour(score: number): string {
  if (score >= 90) return 'var(--ok)'
  if (score >= 70) return 'var(--safe)'
  if (score >= 45) return 'var(--warn)'
  return 'var(--danger)'
}

export interface HealthScoreProps {
  report: HealthReport
  scanned: boolean
}

export function HealthScore({ report, scanned }: HealthScoreProps) {
  const counts = [
    { label: 'Weak', value: report.weak.length, tone: 'text-danger' },
    { label: 'Reused', value: report.reused.length, tone: 'text-warn' },
    { label: 'Old', value: report.old.length, tone: 'text-warn' },
    {
      label: 'Breached',
      value: scanned ? report.breached.length : null,
      tone: 'text-danger',
    },
  ]

  return (
    <div className="flex flex-col items-start gap-6 rounded-panel border border-line bg-surface p-5 sm:flex-row sm:items-center sm:gap-8">
      <div className="relative shrink-0">
        <svg viewBox="0 0 120 120" aria-hidden="true" className="size-32">
          <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            stroke={ringColour(report.score)}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - report.score / 100)}
            transform="rotate(-90 60 60)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="plate tabular text-3xl text-ink">{report.score}</span>
          <span className="text-xs text-ink-muted">out of 100</span>
        </div>
      </div>

      <div className="min-w-0">
        <h2 className="plate text-xl text-ink">{healthLabel(report.score)}</h2>
        <p className="mt-1 text-ink-muted">
          {report.totalLogins === 0
            ? 'Add a login with a password and this page will start checking it.'
            : `${report.totalLogins - report.affected.size} of ${report.totalLogins} logins have no issues.`}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-4">
          {counts.map((count) => (
            <div key={count.label}>
              <dt className="text-xs text-ink-muted">{count.label}</dt>
              <dd
                className={cn(
                  'tabular text-lg font-semibold',
                  count.value === null ? 'text-ink-muted' : count.value > 0 ? count.tone : 'text-ink',
                )}
              >
                {count.value === null ? '—' : count.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
