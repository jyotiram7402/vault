import { cn } from '@/lib/utils'

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex min-w-6 items-center justify-center rounded-[5px] border border-line bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-ink-muted',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
