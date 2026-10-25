'use client'

import { useEffect, useId, useRef } from 'react'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IconButton } from '@/components/ui/icon-button'

export interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  /** Shown beside the title, e.g. Save / Edit buttons. */
  actions?: React.ReactNode
  /**
   * Stop Esc from closing the sheet outright and ask the parent instead, so
   * unsaved work can be confirmed before it is thrown away.
   */
  guardClose?: boolean
  children: React.ReactNode
}

/**
 * A full-screen sheet on mobile, sliding in from the right on tablet and up.
 * Built on native <dialog>, so Esc and focus trapping come for free.
 */
export function Sheet({ open, onClose, title, actions, guardClose = false, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

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
      if (!guardClose) return
      // Keep the sheet open and let the parent ask about unsaved changes.
      event.preventDefault()
      onClose()
    }

    element.addEventListener('close', handleClose)
    element.addEventListener('cancel', handleCancel)
    return () => {
      element.removeEventListener('close', handleClose)
      element.removeEventListener('cancel', handleCancel)
    }
  }, [onClose, guardClose])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="h-dvh max-h-dvh w-screen max-w-full bg-transparent sm:ml-auto sm:w-[min(32rem,100vw)]"
    >
      <div
        className={cn('anim-sheet flex h-dvh flex-col bg-surface sm:border-l sm:border-line')}
      >
        <div className="safe-top flex shrink-0 items-center gap-2 border-b border-line px-2 py-2">
          <IconButton label="Back" onClick={onClose}>
            <ArrowLeft aria-hidden="true" className="size-5" />
          </IconButton>
          <h2 id={titleId} className="plate-tight min-w-0 flex-1 truncate text-lg text-ink">
            {title}
          </h2>
          {actions ? <div className="flex shrink-0 items-center gap-2 pr-1">{actions}</div> : null}
        </div>
        <div className="safe-bottom min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </dialog>
  )
}
