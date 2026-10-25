import { TriangleAlert } from 'lucide-react'
import { APP_NAME } from '@/lib/config'
import { missingEnvNames } from '@/lib/env'

/**
 * Shown instead of a form when the Supabase environment variables are missing.
 * Public pages keep working; only the parts that need a database stop.
 */
export function SetupNeeded() {
  const missing = missingEnvNames()

  return (
    <div className="rounded-panel border border-warn/40 bg-surface p-5">
      <div className="flex items-start gap-3">
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warn" />
        <div className="min-w-0">
          <h2 className="plate-tight text-base text-ink">Setup needed</h2>
          <p className="mt-1 text-sm text-ink-muted">
            {APP_NAME} can’t reach a database yet because these environment variables are missing:
          </p>
          <ul className="mono mt-3 space-y-1 text-sm text-ink">
            {missing.length > 0 ? (
              missing.map((name) => <li key={name}>{name}</li>)
            ) : (
              <li>NEXT_PUBLIC_SUPABASE_URL</li>
            )}
          </ul>
          <p className="mt-3 text-sm text-ink-muted">
            Add them in your hosting project’s environment settings and redeploy — these values are
            built into the app, so a redeploy is required. The README walks through it step by step.
          </p>
        </div>
      </div>
    </div>
  )
}
