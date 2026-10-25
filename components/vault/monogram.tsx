import { cn, stringHash } from '@/lib/utils'

/**
 * A site tile.
 *
 * Favicons are never fetched: asking a third party for them would tell that
 * party exactly which sites a person holds accounts on. A letter on a muted
 * enamel colour, chosen by hashing the host, is recognisable enough and leaks
 * nothing.
 */

const COLOURS = [
  '#3E5C50',
  '#5B4A3A',
  '#4A5568',
  '#6B4E5E',
  '#3F5E73',
  '#6A6A3E',
  '#5E3F3F',
  '#44606A',
] as const

const SIZES = {
  sm: 'size-8 text-sm',
  md: 'size-10 text-base',
  lg: 'size-12 text-lg',
} as const

export interface MonogramProps {
  /** Host where there is one, otherwise the item title. */
  seed: string
  label: string
  size?: keyof typeof SIZES
  className?: string
}

export function Monogram({ seed, label, size = 'md', className }: MonogramProps) {
  const letter = (label.trim()[0] ?? '?').toUpperCase()
  const background = COLOURS[stringHash(seed || label) % COLOURS.length]

  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: background, color: '#F5F7F2' }}
      className={cn(
        'plate inline-flex shrink-0 items-center justify-center rounded-tile select-none',
        SIZES[size],
        className,
      )}
    >
      {letter}
    </span>
  )
}
