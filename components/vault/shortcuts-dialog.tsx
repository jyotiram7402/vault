'use client'

import { useEffect, useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'

const SHORTCUTS = [
  { keys: ['mod', 'K'], description: 'Open the command palette' },
  { keys: ['/'], description: 'Focus the search box' },
  { keys: ['N'], description: 'Add a login' },
  { keys: ['mod', 'Shift', 'L'], description: 'Lock the vault' },
  { keys: ['mod', 'Enter'], description: 'Save the open form' },
  { keys: ['Esc'], description: 'Close a sheet or dialog' },
  { keys: ['?'], description: 'Show this list' },
] as const

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [modifier, setModifier] = useState('Ctrl')

  useEffect(() => {
    // navigator is only safe to read in an effect.
    setModifier(/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl')
  }, [])

  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts" size="sm">
      <ul className="flex flex-col gap-3">
        {SHORTCUTS.map((shortcut) => (
          <li key={shortcut.description} className="flex items-center justify-between gap-4">
            <span className="text-sm text-ink">{shortcut.description}</span>
            <span className="flex shrink-0 items-center gap-1">
              {shortcut.keys.map((key) => (
                <Kbd key={key}>{key === 'mod' ? modifier : key}</Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}
