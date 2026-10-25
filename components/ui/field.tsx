import { cn } from '@/lib/utils'

export interface FieldProps {
  id: string
  label: string
  /** Shown under the control; linked with aria-describedby by the caller. */
  hint?: string
  error?: string | null
  required?: boolean
  optional?: boolean
  className?: string
  children: React.ReactNode
}

/**
 * Every input in the app has a visible label and, when something is wrong, an
 * error linked through `aria-describedby={`${id}-error`}`.
 */
export function Field({
  id,
  label,
  hint,
  error,
  required = false,
  optional = false,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
        {optional ? <span className="font-normal text-ink-muted"> (optional)</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** The describedby value for a field, or undefined when there is nothing to describe. */
export function describedBy(id: string, hint?: string, error?: string | null): string | undefined {
  if (error) return `${id}-error`
  if (hint) return `${id}-hint`
  return undefined
}
