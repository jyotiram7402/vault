'use client'

import { useEffect, useRef, useState } from 'react'
import { toBase64, toBytes, utf8Encode } from '@/lib/crypto/bytes'
import { randomBytes } from '@/lib/crypto/random'

/**
 * The live cipher demo.
 *
 * Real AES-256-GCM, performed in the visitor's own browser on every keystroke,
 * with a throwaway key made on mount and a fresh IV each time. Nothing typed
 * here is sent anywhere — there is no network call in this component at all.
 */

const SAMPLE = 'correct horse battery staple'

export function CipherDemo() {
  const [value, setValue] = useState(SAMPLE)
  const [ciphertext, setCiphertext] = useState('')
  const [iv, setIv] = useState('')
  const keyRef = useRef<CryptoKey | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const run = async () => {
      if (!keyRef.current) {
        keyRef.current = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
          'encrypt',
        ])
      }
      const key = keyRef.current
      if (!key || cancelled) return

      const nonce = randomBytes(12)
      const sealed = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: nonce },
        key,
        utf8Encode(value),
      )
      if (cancelled) return
      setCiphertext(toBase64(toBytes(sealed)))
      setIv(toBase64(nonce))
    }

    timer = setTimeout(() => void run(), 80)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [value])

  return (
    <div className="anim-rise rounded-panel border border-line bg-surface p-5">
      <label htmlFor="cipher-demo-input" className="text-sm font-medium text-ink">
        Type any password
      </label>
      <input
        id="cipher-demo-input"
        value={value}
        onChange={(event) => setValue(event.target.value.slice(0, 120))}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        translate="no"
        autoComplete="off"
        className="mono mt-2 h-11 w-full rounded-field border border-line bg-bg px-3 text-ink"
      />

      <div className="mt-5 rounded-field border border-line bg-bg p-4">
        <p className="plate-tight text-sm text-ink">What we store</p>
        <dl className="mt-3 space-y-3">
          <div>
            <dt className="text-xs font-medium tracking-wide text-ink-muted">ciphertext</dt>
            <dd className="mono mt-1 text-xs break-all text-safe">{ciphertext || '…'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-ink-muted">iv</dt>
            <dd className="mono mt-1 text-xs break-all text-ink-muted">{iv || '…'}</dd>
          </div>
        </dl>
      </div>

      <p className="mt-3 text-xs text-ink-muted">
        This demo runs in your browser. Nothing you type here is sent anywhere.
      </p>
    </div>
  )
}
