import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  /** Inputs holding secrets turn off spellcheck, autocorrect and translation. */
  secret?: boolean
  /** In React 19 `ref` is an ordinary prop, so it is declared here. */
  ref?: React.Ref<HTMLInputElement>
}

export const inputClasses =
  'w-full rounded-field border bg-surface px-3 text-ink placeholder:text-ink-muted/80 ' +
  'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ' +
  'border-line hover:border-ink-muted/60'

export function Input({ className, invalid, secret, ...props }: InputProps) {
  const secretProps = secret
    ? ({
        spellCheck: false,
        autoCapitalize: 'off',
        autoCorrect: 'off',
        translate: 'no',
      } as const)
    : {}

  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(inputClasses, 'h-11', invalid && 'border-danger', className)}
      {...secretProps}
      {...props}
    />
  )
}
