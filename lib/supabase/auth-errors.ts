/**
 * Supabase auth errors, turned into something a person can act on.
 *
 * Never show a raw error: it can leak whether an account exists, and it reads
 * like a stack trace. Everything unrecognised gets one calm fallback.
 */

export interface FriendlyAuthError {
  message: string
  /** Offer a "Resend email" button beside the message. */
  canResend?: boolean
}

export function authErrorMessage(
  error: { message?: string; code?: string; reasons?: unknown } | null,
): FriendlyAuthError {
  if (!error) return { message: 'Something went wrong. Try again.' }

  const code = (error.code ?? '').toLowerCase()
  const text = (error.message ?? '').toLowerCase()

  if (code === 'invalid_credentials' || text.includes('invalid login credentials')) {
    return { message: 'Email or password is wrong.' }
  }
  if (code === 'email_not_confirmed' || text.includes('email not confirmed')) {
    return { message: 'Confirm your email first.', canResend: true }
  }
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || text.includes('rate limit')) {
    return { message: 'Too many attempts. Wait a minute and try again.' }
  }
  if (code === 'otp_expired' || text.includes('expired or is invalid') || text.includes('invalid or has expired')) {
    return {
      message: 'That code has expired or was already used. Only the newest email counts. Send a new one.',
    }
  }
  if (code === 'weak_password' || text.includes('password should') || text.includes('known to be weak')) {
    return { message: weakPasswordMessage(error.message ?? '', error.reasons) }
  }
  if (code === 'same_password' || text.includes('should be different from the old')) {
    return { message: 'That is already your password. Choose a different one.' }
  }
  if (code === 'reauthentication_needed' || text.includes('requires reauthentication')) {
    return { message: 'For safety, sign in again before changing this password.' }
  }
  if (code === 'user_already_exists' || text.includes('already registered')) {
    return { message: 'An account already exists for that email. Sign in instead.' }
  }
  if (code === 'validation_failed' || text.includes('unable to validate email')) {
    return { message: 'That doesn’t look like a valid email address.' }
  }
  if (code === 'signup_disabled' || text.includes('signups not allowed')) {
    return { message: 'New accounts are turned off on this installation.' }
  }
  if (text.includes('failed to fetch') || text.includes('networkerror')) {
    return {
      message:
        'Can’t reach the server. Check your connection and try again. If you run this app, your free Supabase project may be paused.',
    }
  }
  return { message: 'Something went wrong. Try again.' }
}

// The forms also enforce this before asking the server. Only used when the
// server's message carries no number of its own, which GoTrue's always does.
const ACCOUNT_PASSWORD_MIN_LENGTH = 12

/**
 * Supabase rejects a sign-in password for three reasons, and lists all of them
 * in one message: too short for the project's minimum, missing a character
 * type the project requires, or found in a data breach. Say which, in the
 * project's actual terms, instead of guessing "too weak".
 */
function weakPasswordMessage(message: string, reasons: unknown): string {
  const text = message.toLowerCase()
  const why = Array.isArray(reasons) ? reasons.filter((r): r is string => typeof r === 'string') : []

  if (why.includes('pwned') || text.includes('known to be weak')) {
    return 'That password has appeared in a data breach. Choose a different one.'
  }

  const lengthMatch = /at least (\d+) characters/i.exec(message)
  const tooShort = why.includes('length') || Boolean(lengthMatch)
  const minimum = lengthMatch ? lengthMatch[1] : String(ACCOUNT_PASSWORD_MIN_LENGTH)

  const missingTypes = why.includes('characters') || text.includes('at least one character of each')
  const types = missingTypes ? requiredCharacterTypes(message) : []
  const list = types.length > 0 ? joinList(types) : 'a mix of letters, numbers and symbols'

  if (tooShort && missingTypes) return `Use at least ${minimum} characters, including ${list}.`
  if (missingTypes) return `Your sign-in password must include ${list}.`
  return `Use at least ${minimum} characters.`
}

// GoTrue names the required sets verbatim, e.g. "...of each: abcdefghijklmnopqrstuvwxyz,
// ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789, !@#$%^&*()_+-=[]{};'\:"|<>?,./`~." The
// symbol set contains a comma, so look for the sets rather than splitting the text.
function requiredCharacterTypes(message: string): string[] {
  const types: string[] = []
  if (message.includes('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')) {
    types.push('a letter')
  } else {
    if (message.includes('abcdefghijklmnopqrstuvwxyz')) types.push('a lowercase letter')
    if (message.includes('ABCDEFGHIJKLMNOPQRSTUVWXYZ')) types.push('an uppercase letter')
  }
  if (message.includes('0123456789')) types.push('a number')
  if (message.includes('!@#$%^&*')) types.push('a symbol')
  return types
}

function joinList(items: string[]): string {
  if (items.length < 2) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}
