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

export function authErrorMessage(error: { message?: string; code?: string } | null): FriendlyAuthError {
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
  if (code === 'weak_password' || text.includes('password should be at least')) {
    return { message: 'That password is too weak. Use at least 12 characters.' }
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
