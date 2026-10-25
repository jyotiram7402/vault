'use client'

import { useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { inputClasses } from '@/components/ui/input'

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  invalid?: boolean
  /** Show the value in the monospace secret face while revealed. */
  mono?: boolean
  /** In React 19 `ref` is an ordinary prop, so it is declared here. */
  ref?: React.Ref<HTMLInputElement>
}

/**
 * A password field with a show/hide toggle.
 *
 * `autoComplete` defaults to "new-password" so browsers don't offer to save
 * vault items into their own password manager.
 */
export function PasswordInput({
  className,
  invalid,
  mono = true,
  autoComplete = 'new-password',
  ...props
}: PasswordInputProps) {
  const [revealed, setRevealed] = useState(false)
  const toggleId = useId()

  return (
    <div className="relative">
      <input
        type={revealed ? 'text' : 'password'}
        autoComplete={autoComplete}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        translate="no"
        aria-invalid={invalid || undefined}
        aria-describedby={toggleId}
        className={cn(
          inputClasses,
          'h-11 pr-12',
          revealed && mono && 'mono',
          invalid && 'border-danger',
          className,
        )}
        {...props}
      />
      <button
        type="button"
        id={toggleId}
        onClick={() => setRevealed((value) => !value)}
        aria-label={revealed ? 'Hide password' : 'Show password'}
        title={revealed ? 'Hide password' : 'Show password'}
        className="absolute top-0 right-0 inline-flex size-11 items-center justify-center rounded-field text-ink-muted transition-colors hover:text-ink"
      >
        {revealed ? (
          <EyeOff aria-hidden="true" className="size-5" />
        ) : (
          <Eye aria-hidden="true" className="size-5" />
        )}
      </button>
    </div>
  )
}
