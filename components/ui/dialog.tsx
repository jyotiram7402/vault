'use client'

import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IconButton } from '@/components/ui/icon-button'

export type DialogSize = 'sm' | 'md' | 'lg'

const SIZES: Record<DialogSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  size?: DialogSize
  /** Hide the × button when the dialog must be answered. */
  dismissible?: boolean
  footer?: React.ReactNode
  children: React.ReactNode
}

/**
 * Native <dialog> with showModal(), which traps focus, closes on Esc and
 * returns focus to whatever opened it. Driven by an `open` prop from an
 * effect, and listening for the browser's own `close` event.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  size = 'md',
  dismissible = true,
  footer,
  children,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const handleClose = () => onClose()
    const handleCancel = (event: Event) => {
      if (!dismissible) {
        event.preventDefault()
        return
      }
      // Let the browser close it; `close` fires right after.
    }
    element.addEventListener('close', handleClose)
    element.addEventListener('cancel', handleCancel)
    return () => {
      element.removeEventListener('close', handleClose)
      element.removeEventListener('cancel', handleCancel)
    }
  }, [onClose, dismissible])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className="m-auto w-[calc(100vw-2rem)] bg-transparent"
      onClick={(event) => {
        // A click on the backdrop lands on the <dialog> element itself.
        if (dismissible && event.target === ref.current) onClose()
      }}
    >
      <div
        className={cn(
          'anim-pop mx-auto w-full rounded-panel border border-line bg-surface shadow-overlay',
          SIZES[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="plate-tight text-lg text-ink">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm text-ink-muted">
                {description}
              </p>
            ) : null}
          </div>
          {dismissible ? (
            <IconButton label="Close" onClick={onClose} className="-mt-2 -mr-2">
              <X aria-hidden="true" className="size-5" />
            </IconButton>
          ) : null}
        </div>

        <div className="max-h-[70dvh] overflow-y-auto px-5 py-4">{children}</div>

        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </dialog>
  )
}
