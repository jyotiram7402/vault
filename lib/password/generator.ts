import { randomInt, randomInts, shuffle } from '@/lib/crypto/random'

/**
 * Password and passphrase generation.
 *
 * Every character comes from `crypto.getRandomValues` through rejection
 * sampling, so there is no modulo bias, and the final order is a Fisher–Yates
 * shuffle using the same randomness.
 */

export const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'
export const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
export const DIGITS = '0123456789'
export const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?/~'

/** Characters that are easy to confuse in print or on a screen. */
const LOOK_ALIKES = new Set(['I', 'l', '1', 'O', '0', 'o', '|'])

export const MIN_LENGTH = 8
export const MAX_LENGTH = 128
export const DEFAULT_LENGTH = 20

export const MIN_WORDS = 3
export const MAX_WORDS = 12
export const DEFAULT_WORDS = 6

export type Separator = '-' | '.' | '_' | ' '

export interface RandomPasswordOptions {
  length: number
  uppercase: boolean
  lowercase: boolean
  digits: boolean
  symbols: boolean
  avoidLookAlikes: boolean
}

export const DEFAULT_RANDOM_OPTIONS: RandomPasswordOptions = {
  length: DEFAULT_LENGTH,
  uppercase: true,
  lowercase: true,
  digits: true,
  symbols: true,
  avoidLookAlikes: false,
}

export interface GeneratedPassword {
  value: string
  entropyBits: number
}

function filterLookAlikes(set: string, avoid: boolean): string {
  if (!avoid) return set
  return [...set].filter((character) => !LOOK_ALIKES.has(character)).join('')
}

/** The character sets a given set of options actually uses. */
export function activeSets(options: RandomPasswordOptions): string[] {
  const sets: string[] = []
  if (options.lowercase) sets.push(filterLookAlikes(LOWERCASE, options.avoidLookAlikes))
  if (options.uppercase) sets.push(filterLookAlikes(UPPERCASE, options.avoidLookAlikes))
  if (options.digits) sets.push(filterLookAlikes(DIGITS, options.avoidLookAlikes))
  if (options.symbols) sets.push(filterLookAlikes(SYMBOLS, options.avoidLookAlikes))
  return sets.filter((set) => set.length > 0)
}

export function generatePassword(options: RandomPasswordOptions): GeneratedPassword {
  const sets = activeSets(options)
  if (sets.length === 0) {
    // The UI keeps at least one set on; this is the belt-and-braces case.
    throw new Error('Choose at least one kind of character.')
  }

  const pool = sets.join('')
  const length = Math.max(MIN_LENGTH, Math.min(MAX_LENGTH, Math.floor(options.length)))

  // One character from each chosen set, then fill the rest from the whole pool.
  const characters: string[] = sets
    .slice(0, length)
    .map((set) => set[randomInt(set.length)])

  const remaining = length - characters.length
  if (remaining > 0) {
    for (const index of randomInts(remaining, pool.length)) {
      characters.push(pool[index])
    }
  }

  return {
    value: shuffle(characters).join(''),
    entropyBits: Math.round(length * Math.log2(pool.length) * 10) / 10,
  }
}

export interface PassphraseOptions {
  words: number
  separator: Separator
  capitalize: boolean
  addDigit: boolean
}

export const DEFAULT_PASSPHRASE_OPTIONS: PassphraseOptions = {
  words: DEFAULT_WORDS,
  separator: '-',
  capitalize: false,
  addDigit: false,
}

function capitalizeWord(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

export async function generatePassphrase(
  options: PassphraseOptions,
): Promise<GeneratedPassword> {
  const { WORDS, BITS_PER_WORD } = await import('@/lib/password/wordlist')
  const count = Math.max(MIN_WORDS, Math.min(MAX_WORDS, Math.floor(options.words)))

  const words = randomInts(count, WORDS.length).map((index) => {
    const word = WORDS[index]
    return options.capitalize ? capitalizeWord(word) : word
  })

  let value = words.join(options.separator)
  let entropy = count * BITS_PER_WORD

  if (options.addDigit) {
    value += String(randomInt(10))
    entropy += Math.log2(10)
  }

  return { value, entropyBits: Math.round(entropy * 10) / 10 }
}

/**
 * The master-password suggestion offered during setup: six words joined by
 * hyphens, one of them capitalised and one digit appended.
 */
export async function suggestMasterPassphrase(): Promise<GeneratedPassword> {
  const { WORDS, BITS_PER_WORD } = await import('@/lib/password/wordlist')
  const words = randomInts(DEFAULT_WORDS, WORDS.length).map((index) => WORDS[index])
  const capitalIndex = randomInt(words.length)
  words[capitalIndex] = capitalizeWord(words[capitalIndex])

  const value = `${words.join('-')}${randomInt(10)}`
  const entropy = DEFAULT_WORDS * BITS_PER_WORD + Math.log2(DEFAULT_WORDS) + Math.log2(10)
  return { value, entropyBits: Math.round(entropy * 10) / 10 }
}
