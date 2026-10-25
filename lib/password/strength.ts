import { foldText } from '@/lib/utils'
import { isCommonPassword, longestCommonSubstring } from '@/lib/password/common-passwords'

/**
 * A dependency-free strength estimator.
 *
 * Entropy is the honest starting point (length × log2 of the pool actually
 * used), then patterns that a cracker tries first are subtracted. It is
 * deliberately pessimistic: overstating strength is the dangerous error.
 */

export type StrengthScore = 0 | 1 | 2 | 3 | 4

export type StrengthLabel = 'Very weak' | 'Weak' | 'Fair' | 'Strong' | 'Excellent'

export interface StrengthResult {
  score: StrengthScore
  label: StrengthLabel
  entropyBits: number
  crackTime: string
  warnings: string[]
}

export interface StrengthContext {
  email?: string
  username?: string
  siteName?: string
  /** For generated passwords: the generator's exact entropy, used as-is. */
  knownEntropyBits?: number
}

const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?/~'

const KEYBOARD_RUNS = [
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
  '1234567890',
  'abcdefghijklmnopqrstuvwxyz',
  'qazwsxedc',
  '!@#$%^&*()',
]

function poolSize(password: string): number {
  let size = 0
  if (/[a-z]/.test(password)) size += 26
  if (/[A-Z]/.test(password)) size += 26
  if (/[0-9]/.test(password)) size += 10
  if (new RegExp(`[${SYMBOLS.replace(/[-\\\]^]/g, '\\$&')}]`).test(password)) size += SYMBOLS.length
  // Anything else (spaces, accents, emoji) widens the pool conservatively.
  if (/[^\x20-\x7e]/.test(password)) size += 40
  if (/ /.test(password)) size += 1
  return Math.max(size, 2)
}

function classCount(password: string): number {
  let count = 0
  if (/[a-z]/.test(password)) count += 1
  if (/[A-Z]/.test(password)) count += 1
  if (/[0-9]/.test(password)) count += 1
  if (/[^a-zA-Z0-9]/.test(password)) count += 1
  return count
}

/** Longest run of characters that appears in a keyboard row, forwards or back. */
function keyboardRunLength(password: string): number {
  const lower = password.toLowerCase()
  let longest = 0
  for (const run of KEYBOARD_RUNS) {
    const reversed = [...run].reverse().join('')
    for (const sequence of [run, reversed]) {
      for (let start = 0; start < lower.length; start += 1) {
        for (let end = lower.length; end > start + longest; end -= 1) {
          const slice = lower.slice(start, end)
          if (slice.length >= 3 && sequence.includes(slice)) {
            longest = Math.max(longest, slice.length)
            break
          }
        }
      }
    }
  }
  return longest
}

/** Characters repeated three or more times in a row, like "aaa" or "111". */
function repeatRunLength(password: string): number {
  let longest = 0
  let run = 1
  for (let i = 1; i < password.length; i += 1) {
    run = password[i] === password[i - 1] ? run + 1 : 1
    longest = Math.max(longest, run)
  }
  return longest
}

function hasYearOrDate(password: string): boolean {
  if (/(19|20)\d{2}/.test(password)) return true
  // 01/02/2003, 1-2-03, 010203
  if (/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/.test(password)) return true
  return false
}

function personalTokens(context: StrengthContext): string[] {
  const tokens: string[] = []
  if (context.email) {
    const name = context.email.split('@')[0] ?? ''
    for (const part of name.split(/[._+-]/)) {
      if (part.length >= 4) tokens.push(part)
    }
  }
  if (context.username) {
    for (const part of context.username.split(/[@._+-]/)) {
      if (part.length >= 4) tokens.push(part)
    }
  }
  if (context.siteName && context.siteName.length >= 4) tokens.push(context.siteName)
  return tokens.map(foldText)
}

const SECONDS_PER = {
  minute: 60,
  hour: 3600,
  day: 86400,
  month: 2_592_000,
  year: 31_557_600,
}

/** Plain words, assuming 10^10 guesses per second. */
export function describeCrackTime(entropyBits: number): string {
  const guesses = Math.pow(2, Math.max(entropyBits - 1, 0))
  const seconds = guesses / 1e10

  if (seconds < 1) return 'instantly'
  if (seconds < SECONDS_PER.minute) return `about ${Math.max(1, Math.round(seconds))} seconds`
  if (seconds < SECONDS_PER.hour) return `about ${Math.round(seconds / SECONDS_PER.minute)} minutes`
  if (seconds < SECONDS_PER.day) return `about ${Math.round(seconds / SECONDS_PER.hour)} hours`
  if (seconds < SECONDS_PER.month) return `about ${Math.round(seconds / SECONDS_PER.day)} days`
  if (seconds < SECONDS_PER.year) return `about ${Math.round(seconds / SECONDS_PER.month)} months`
  const years = seconds / SECONDS_PER.year
  if (years < 1000) return `about ${Math.round(years)} years`
  if (years < 1e6) return 'centuries'
  return 'longer than recorded history'
}

function labelFor(bits: number): { score: StrengthScore; label: StrengthLabel } {
  if (bits < 28) return { score: 0, label: 'Very weak' }
  if (bits < 36) return { score: 1, label: 'Weak' }
  if (bits < 60) return { score: 2, label: 'Fair' }
  if (bits < 80) return { score: 3, label: 'Strong' }
  return { score: 4, label: 'Excellent' }
}

/** The master password must clear this bar everywhere it is set or changed. */
export const MASTER_PASSWORD_MIN_LENGTH = 12

/**
 * One rule set shared by setup, recovery and "change master password", so the
 * requirements can never drift apart between screens.
 * Returns a message to show, or null when the password is acceptable.
 */
export function masterPasswordProblem(
  password: string,
  confirm: string,
  email: string | null,
): string | null {
  if (password.length < MASTER_PASSWORD_MIN_LENGTH) {
    return `Use at least ${MASTER_PASSWORD_MIN_LENGTH} characters.`
  }
  if (email && password.trim().toLowerCase() === email.trim().toLowerCase()) {
    return 'Your master password can’t be your email address.'
  }
  if (estimateStrength(password, { email: email ?? undefined }).score < 3) {
    return 'This needs to be rated Strong or better. Add length, or try the suggested passphrase.'
  }
  if (password !== confirm) {
    return 'The two passwords don’t match.'
  }
  return null
}

export function estimateStrength(password: string, context: StrengthContext = {}): StrengthResult {
  if (!password) {
    return {
      score: 0,
      label: 'Very weak',
      entropyBits: 0,
      crackTime: 'instantly',
      warnings: [],
    }
  }

  // Generated passwords carry their exact entropy; no guessing needed.
  if (typeof context.knownEntropyBits === 'number') {
    const bits = context.knownEntropyBits
    const { score, label } = labelFor(bits)
    return { score, label, entropyBits: bits, crackTime: describeCrackTime(bits), warnings: [] }
  }

  const warnings: string[] = []

  if (isCommonPassword(password)) {
    return {
      score: 0,
      label: 'Very weak',
      entropyBits: 0,
      crackTime: 'instantly',
      warnings: ['This is one of the most common passwords in the world.'],
    }
  }

  let bits = password.length * Math.log2(poolSize(password))

  const common = longestCommonSubstring(password)
  if (common) {
    const share = common.length / password.length
    // A common password that makes up most of it leaves almost nothing to guess.
    bits -= common.length * Math.log2(poolSize(password)) * Math.min(share + 0.35, 1)
    warnings.push(`It contains “${common}”, a very common password.`)
  }

  const run = keyboardRunLength(password)
  if (run >= 3) {
    bits -= (run - 1) * 3.2
    warnings.push('Letters or numbers in keyboard order are easy to guess.')
  }

  const repeat = repeatRunLength(password)
  if (repeat >= 3) {
    bits -= (repeat - 1) * 2.6
    warnings.push('Repeated characters add almost nothing.')
  }

  if (hasYearOrDate(password)) {
    bits -= 7
    warnings.push('Years and dates are the first thing an attacker tries.')
  }

  for (const token of personalTokens(context)) {
    if (foldText(password).includes(token)) {
      bits -= token.length * 2.4
      warnings.push('It contains your email, username or the site name.')
      break
    }
  }

  if (classCount(password) === 1 && password.length < 12) {
    bits -= 6
    warnings.push('Short and only one kind of character. Add length first.')
  }

  bits = Math.max(0, bits)
  const { score, label } = labelFor(bits)

  return {
    score,
    label,
    entropyBits: Math.round(bits * 10) / 10,
    crackTime: describeCrackTime(bits),
    warnings,
  }
}
