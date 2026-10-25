import { cn } from '@/lib/utils'
import { inputClasses } from '@/components/ui/input'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
  secret?: boolean
}

export function Textarea({ className, invalid, secret, rows = 4, ...props }: TextareaProps) {
  const secretProps = secret
    ? ({
        spellCheck: false,
        autoCapitalize: 'off',
        autoCorrect: 'off',
        translate: 'no',
      } as const)
    : {}

  return (
    <textarea
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(inputClasses, 'resize-y py-2.5 leading-relaxed', invalid && 'border-danger', className)}
      {...secretProps}
      {...props}
    />
  )
}
