/**
 * Small helpers. No libraries for class merging, dates or state: React, Intl
 * and a five-line `cn()` are enough (performance budget, section 12).
 */

type ClassValue = string | false | null | undefined

/** Join class names, dropping anything falsy. */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ')
}

/** Wait for two animation frames so CSS animations start before heavy work. */
export function nextTwoFrames(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Lowercase, accent-free text for searching and comparing. */
export function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const shortDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export function formatDate(iso: string | number | Date | null | undefined): string {
  if (iso === null || iso === undefined) return '—'
  const date = iso instanceof Date ? iso : new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return dateFormatter.format(date)
}

export function formatShortDate(iso: string | number | Date | null | undefined): string {
  if (iso === null || iso === undefined) return '—'
  const date = iso instanceof Date ? iso : new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return shortDateFormatter.format(date)
}

const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

const RELATIVE_UNITS: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: 'week', ms: 7 * 24 * 60 * 60 * 1000 },
  { unit: 'day', ms: 24 * 60 * 60 * 1000 },
  { unit: 'hour', ms: 60 * 60 * 1000 },
  { unit: 'minute', ms: 60 * 1000 },
]

/** "3 months ago", "yesterday", "just now". */
export function formatRelative(iso: string | number | Date | null | undefined): string {
  if (iso === null || iso === undefined) return '—'
  const date = iso instanceof Date ? iso : new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const diff = date.getTime() - Date.now()
  const abs = Math.abs(diff)
  for (const { unit, ms } of RELATIVE_UNITS) {
    if (abs >= ms) {
      return relativeFormatter.format(Math.round(diff / ms), unit)
    }
  }
  return 'just now'
}

/** Whole days between an ISO date and now; null when unparseable. */
export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000))
}

/** Split text into runs so a match can be highlighted without innerHTML. */
export function splitHighlight(
  text: string,
  query: string,
): { text: string; match: boolean }[] {
  const folded = foldText(text)
  const needle = foldText(query.trim())
  if (!needle) return [{ text, match: false }]
  const index = folded.indexOf(needle)
  if (index < 0) return [{ text, match: false }]
  const parts: { text: string; match: boolean }[] = []
  if (index > 0) parts.push({ text: text.slice(0, index), match: false })
  parts.push({ text: text.slice(index, index + needle.length), match: true })
  if (index + needle.length < text.length) {
    parts.push({ text: text.slice(index + needle.length), match: false })
  }
  return parts
}

/** A fixed-length mask, so the real length of a secret never leaks. */
export const MASK = '••••••••••••'

/** Mask a card number, keeping the last four digits. */
export function maskCardNumber(digits: string): string {
  const clean = digits.replace(/\D/g, '')
  if (clean.length <= 4) return clean ? `•••• ${clean}` : '••••'
  return `•••• ${clean.slice(-4)}`
}

/** Group a card number in fours while typing. */
export function groupCardNumber(digits: string): string {
  const clean = digits.replace(/\D/g, '').slice(0, 19)
  if (clean.startsWith('34') || clean.startsWith('37')) {
    // American Express: 4-6-5
    return [clean.slice(0, 4), clean.slice(4, 10), clean.slice(10, 15)]
      .filter(Boolean)
      .join(' ')
  }
  return clean.replace(/(.{4})/g, '$1 ').trim()
}

export type CardBrand =
  | 'Visa'
  | 'Mastercard'
  | 'American Express'
  | 'RuPay'
  | 'Discover'
  | null

export function cardBrand(digits: string): CardBrand {
  const n = digits.replace(/\D/g, '')
  if (!n) return null
  if (/^4/.test(n)) return 'Visa'
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(n)) return 'Mastercard'
  if (/^3[47]/.test(n)) return 'American Express'
  if (/^(60|65|81|82|508)/.test(n)) return 'RuPay'
  if (/^(6011|64[4-9]|65)/.test(n)) return 'Discover'
  return null
}

/** Luhn checksum. A failure is shown as a warning, never an error. */
export function luhnValid(digits: string): boolean {
  const n = digits.replace(/\D/g, '')
  if (n.length < 12) return false
  let sum = 0
  let double = false
  for (let i = n.length - 1; i >= 0; i -= 1) {
    let value = n.charCodeAt(i) - 48
    if (value < 0 || value > 9) return false
    if (double) {
      value *= 2
      if (value > 9) value -= 9
    }
    sum += value
    double = !double
  }
  return sum % 10 === 0
}

/** Stable non-cryptographic hash, used only to pick a monogram colour. */
export function stringHash(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** Download a text file without touching the network. */
export function downloadTextFile(
  filename: string,
  text: string,
  mimeType = 'text/plain;charset=utf-8',
): void {
  const blob = new Blob([text], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Today as YYYY-MM-DD in the local timezone, for file names. */
export function isoDateStamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** True when the user asked for less motion. Safe to call only in effects. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** True when the app is running as an installed PWA. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true
}
