'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { safeNextPath } from '@/lib/security/safe-next'

/**
 * Finish an email link: confirm a sign-up, change of address, or a password
 * reset.
 *
 * This runs on the server from a form POST, deliberately — see page.tsx. The
 * token is checked with verifyOtp, which needs nothing from the browser that
 * asked for the email, so a link opened on a different device still works.
 *
 * redirect() throws on purpose. Nothing here may wrap it in try/catch.
 */

// Exactly Supabase's EmailOtpType, spelled out so a stray value can't reach
// verifyOtp. Narrowing through this guard means no cast is needed.
const LINK_TYPES = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'] as const
type LinkType = (typeof LINK_TYPES)[number]

function isLinkType(value: FormDataEntryValue | null): value is LinkType {
  return typeof value === 'string' && (LINK_TYPES as readonly string[]).includes(value)
}

export async function confirmEmailLink(formData: FormData): Promise<void> {
  const tokenHash = formData.get('token_hash')
  const type = formData.get('type')

  if (typeof tokenHash !== 'string' || !tokenHash || !isLinkType(type)) {
    redirect('/auth/error')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
  if (error) redirect('/auth/error')

  // A reset link always lands on the new-password form, whatever `next` says:
  // that page is the only place a recovery session is any use.
  if (type === 'recovery') redirect('/reset-password')

  const next = formData.get('next')
  redirect(safeNextPath(typeof next === 'string' ? next : null))
}
