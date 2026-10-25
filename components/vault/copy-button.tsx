'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { copyPlain, copySecret } from '@/lib/vault/clipboard'
import { useToast } from '@/components/ui/toast'

/**
 * Copy, with a shrinking ring that counts down to the clipboard being cleared.
 * The ring is the only place the countdown is shown, which keeps the row calm.
 */

const RADIUS = 9
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export interface CopyButtonProps {
  value: string
  /** What was copied, for the confirmation: "Password copied". */
  label: string
  /** Plain values (usernames, addresses) skip the clipboard wipe. */
  plain?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function CopyButton({ value, label, plain = false, size = 'md', className }: CopyButtonProps) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [remaining, setRemaining] = useState(0)
  const [total, setTotal] = useState(0)
  const timers = useRef<ReturnType<typeof setInterval>[]>([])

  useEffect(() => {
    const active = timers.current
    return () => {
      active.forEach(clearInterval)
      active.length = 0
    }
  }, [])

  const handleCopy = async () => {
    try {
      if (plain) {
        await copyPlain(value)
        setCopied(true)
        setTotal(0)
        setRemaining(0)
        window.setTimeout(() => setCopied(false), 1600)
        return
      }

      const seconds = await copySecret(value)
      setCopied(true)
      setTotal(seconds)
      setRemaining(seconds)

      if (seconds > 0) {
        const startedAt = Date.now()
        const interval = setInterval(() => {
          const left = seconds - (Date.now() - startedAt) / 1000
          if (left <= 0) {
            clearInterval(interval)
            setRemaining(0)
            setCopied(false)
          } else {
            setRemaining(left)
          }
        }, 120)
        timers.current.push(interval)
      } else {
        window.setTimeout(() => setCopied(false), 1600)
      }
    } catch {
      toast({
        message: 'This browser wouldn’t let the page copy. Select the text and copy it yourself.',
        tone: 'danger',
      })
    }
  }

  const progress = total > 0 && remaining > 0 ? remaining / total : 0
  const announcement =
    copied && total > 0
      ? `${label} copied. Clipboard clears in ${Math.ceil(remaining)} seconds.`
      : copied
        ? `${label} copied.`
        : ''

  return (
    <>
      <button
        type="button"
        onClick={handleCopy}
        title={`Copy ${label.toLowerCase()}`}
        aria-label={`Copy ${label.toLowerCase()}`}
        className={cn(
          'relative inline-flex shrink-0 items-center justify-center rounded-btn text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink',
          size === 'sm' ? 'size-9' : 'size-11',
          className,
        )}
      >
        {copied ? (
          <Check aria-hidden="true" className="size-4 text-ok" />
        ) : (
          <Copy aria-hidden="true" className="size-4" />
        )}
        {progress > 0 ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="pointer-events-none absolute inset-0 size-full -rotate-90"
          >
            <circle
              cx="12"
              cy="12"
              r={RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              opacity="0.18"
            />
            <circle
              cx="12"
              cy="12"
              r={RADIUS}
              fill="none"
              stroke="var(--ok)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            />
          </svg>
        ) : null}
      </button>
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </>
  )
}
