import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  /** Inputs holding secrets turn off spellcheck, autocorrect and translation. */
  secret?: boolean
  /** In React 19 `ref` is an ordinary prop, so it is declared here. */
  ref?: React.Ref<HTMLInputElement>
}

/** Shared by Input, PasswordInput, Textarea and Select. Carries no border colour. */
export const inputClasses =
  'w-full rounded-field border bg-surface px-3 text-ink placeholder:text-ink-muted ' +
  'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60'

/**
 * The outline colour of a form control: exactly one of the two.
 *
 * `border-line-strong` reaches 3:1 against the surfaces, which the outline of
 * a control needs; plain `border-line` is for dividers. The choice is made
 * here rather than by adding `border-danger` on top, because `cn()` does not
 * merge: two border colours on one element are settled by their order in the
 * stylesheet, and the error state would lose.
 */
export function inputBorder(invalid?: boolean): string {
  return invalid ? 'border-danger' : 'border-line-strong hover:border-ink-muted'
}

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
      className={cn(inputClasses, 'h-11', inputBorder(invalid), className)}
      {...secretProps}
      {...props}
    />
  )
}
