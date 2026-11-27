'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import { isSupabaseConfigured } from '@/lib/env'
import { createClient } from '@/lib/supabase/client'
import { preloadKdf } from '@/lib/crypto/kdf'
import { fetchKeyset } from '@/lib/vault/api'
import { startAutoLock } from '@/lib/vault/auto-lock'
import { postSessionMessage, subscribeSession } from '@/lib/vault/broadcast'
import { readSettings } from '@/lib/vault/settings'
import { getSnapshot, lock, subscribe } from '@/lib/vault/store'
import type { KeysetRow } from '@/lib/vault/types'
import { Button } from '@/components/ui/button'
import { SetupNeeded } from '@/components/auth/setup-needed'
import { MfaChallenge } from '@/components/auth/mfa-challenge'
import { AppShell } from '@/components/vault/app-shell'
import { SetupWizard } from '@/components/vault/setup-wizard'
import { UnlockScreen } from '@/components/vault/unlock-screen'
import { PrivacyScreen } from '@/components/vault/privacy-screen'

/**
 * The vault gate.
 *
 *   checking
 *    ├─ env missing ─────────────► unconfigured   (SetupNeeded panel)
 *    ├─ no session ──────────────► /login?next=/vault
 *    ├─ AAL says aal2 needed ────► needs-mfa      (MfaChallenge, then re-check)
 *    └─ fetch vault_keys
 *        ├─ error ───────────────► error          (retry panel; NEVER setup)
 *        ├─ no row ──────────────► needs-setup    (SetupWizard)
 *        └─ row ─────────────────► locked         (UnlockScreen)
 *
 * The distinction that matters: a failed request and an empty result look
 * similar through Row Level Security, and showing setup to someone who already
 * has a vault would invite them to destroy it. Only a confirmed empty result
 * after a confirmed assurance level leads to setup.
 */

type GateState =
  | 'checking'
  | 'unconfigured'
  | 'needs-mfa'
  | 'needs-setup'
  | 'locked'
  | 'unlocked'
  | 'error'

export function VaultGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const [state, setState] = useState<GateState>('checking')
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [keyset, setKeyset] = useState<KeysetRow | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [unreadableCount, setUnreadableCount] = useState(0)
  const [noticeDismissed, setNoticeDismissed] = useState(false)

  const userIdRef = useRef<string | null>(null)
  userIdRef.current = userId
  const stateRef = useRef<GateState>(state)
  stateRef.current = state

  const check = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setState('unconfigured')
      return
    }

    // Already open for this user — navigating between vault pages must not
    // flash the checking panel or re-fetch anything.
    const open = getSnapshot()
    if (open.status === 'unlocked' && open.userId) {
      setUserId(open.userId)
      setEmail(open.email)
      setKeyset(open.keyset)
      setState('unlocked')
      return
    }

    setState('checking')
    const supabase = createClient()

    try {
      // In the browser getSession() is fine for deciding where to navigate;
      // data access is still enforced by Row Level Security.
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError

      const session = sessionData.session
      if (!session) {
        router.replace(`/login?next=${encodeURIComponent(pathname || '/vault')}`)
        return
      }

      setUserId(session.user.id)
      setEmail(session.user.email ?? null)

      // Whether this ends at setup or at unlock, Argon2id is needed next.
      // Start fetching its WebAssembly now, so the download overlaps the
      // keyset request below instead of delaying the first key derivation.
      preloadKdf()

      const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aalError) throw aalError
      if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
        setState('needs-mfa')
        return
      }

      const row = await fetchKeyset(supabase, session.user.id)
      if (!row) {
        setState('needs-setup')
        return
      }

      setKeyset(row)
      setState('locked')
    } catch (cause) {
      const raw = cause instanceof Error ? cause.message : ''
      // A dropped connection is by far the most common cause, and the advice
      // for it is specific, so say that rather than echoing a library message.
      const networkish = raw === '' || /failed to fetch|networkerror|load failed/i.test(raw)
      setErrorMessage(
        networkish
          ? 'Can’t reach the vault server. Check your connection and try again. If you run this app, your free Supabase project may be paused: restore it from the Supabase dashboard.'
          : raw,
      )
      setState('error')
    }
  }, [pathname, router])

  useEffect(() => {
    void check()
  }, [check])

  // Another device may have changed the master password or the Recovery Key
  // while this tab was open. Asked after every lock, so the unlock screen
  // checks against the row the server holds, not the one this tab loaded.
  const refreshKeyset = useCallback(async () => {
    const id = userIdRef.current
    if (!id) return
    try {
      const row = await fetchKeyset(createClient(), id)
      if (row && userIdRef.current === id) setKeyset(row)
    } catch {
      // Offline, or signed out meanwhile: the copy from the last unlock is
      // the best there is, and a wrong one only fails the unlock.
    }
  }, [])

  // Any lock from anywhere (idle, another tab, the lock button) lands here.
  //
  // While the vault is open, the store's keyset is mirrored into this
  // component: Settings writes a rotated master password or Recovery Key to
  // the store, and this copy is what the unlock screen is handed after the
  // next lock. Without the mirror the OLD password kept opening the vault in
  // this tab, and the new one was refused, until the page was reloaded. The
  // mirror never drives the gate to `unlocked`; that stays an explicit
  // callback from the unlock screen, the recovery flow and the setup wizard.
  useEffect(
    () =>
      subscribe(() => {
        const snapshot = getSnapshot()
        if (snapshot.status === 'unlocked') {
          if (snapshot.keyset) setKeyset(snapshot.keyset)
          return
        }
        setState((current) => (current === 'unlocked' ? 'locked' : current))
        if (stateRef.current === 'unlocked') void refreshKeyset()
      }),
    [refreshKeyset],
  )

  useEffect(
    () =>
      subscribeSession((message) => {
        if (message.type === 'lock') {
          lock('remote')
        } else {
          lock('signout')
          router.replace('/login')
        }
      }),
    [router],
  )

  useEffect(() => {
    if (!isSupabaseConfigured) return
    const supabase = createClient()
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        lock('signout')
        router.replace('/login')
        return
      }
      const current = userIdRef.current
      if (session && current && session.user.id !== current) {
        lock('remote')
        void check()
      }
    })
    return () => data.subscription.unsubscribe()
  }, [check, router])

  // Auto-lock only matters while the vault is actually open.
  useEffect(() => {
    if (state !== 'unlocked') return
    return startAutoLock({
      getTimeoutMs: () => readSettings().autoLockMinutes * 60_000,
      getLockOnHide: () => readSettings().lockOnHide,
      onLock: (reason) => {
        lock(reason)
        postSessionMessage({ type: 'lock' })
      },
    })
  }, [state])

  const handleSignOut = useCallback(async () => {
    lock('signout')
    postSessionMessage({ type: 'signout' })
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch {
      // Already signed out, or offline. Locking locally is what matters.
    }
    router.replace('/')
  }, [router])

  const handleUnlocked = useCallback((failed: number) => {
    setUnreadableCount(failed)
    setNoticeDismissed(false)
    setKeyset(getSnapshot().keyset)
    setState('unlocked')
  }, [])

  const handleSetupReady = useCallback(
    (destination?: 'new-login' | 'import') => {
      setKeyset(getSnapshot().keyset)
      setState('unlocked')
      if (destination === 'new-login') router.replace('/vault?new=login')
      else if (destination === 'import') router.replace('/vault?import=1')
      else router.replace('/vault')
    },
    [router],
  )

  // ------------------------------------------------------------- rendering --

  if (state === 'unconfigured') {
    return (
      <Panel>
        <SetupNeeded />
      </Panel>
    )
  }

  if (state === 'checking') {
    return (
      <Panel>
        <div className="flex items-center justify-center gap-3 py-10 text-ink-muted">
          <LoaderCircle aria-hidden="true" className="size-5 anim-spin" />
          <p aria-live="polite">Checking your vault…</p>
        </div>
      </Panel>
    )
  }

  if (state === 'error') {
    return (
      <Panel>
        <div className="rounded-panel border border-line bg-surface p-6">
          <div className="flex items-start gap-3">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-danger" />
            <div className="min-w-0">
              <h1 className="plate-tight text-lg text-ink">Can’t open your vault</h1>
              <p className="mt-2 text-ink-muted">{errorMessage}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => void check()}>
              Try again
            </Button>
            <Button onClick={() => void handleSignOut()}>Sign out</Button>
          </div>
        </div>
      </Panel>
    )
  }

  if (state === 'needs-mfa') {
    return (
      <Panel>
        <div className="rounded-panel border border-line bg-surface p-6">
          <h1 className="plate text-xl text-ink">Verify it’s you</h1>
          <p className="mt-2 text-ink-muted">
            Two-factor sign-in is on for this account. Enter the code from your authenticator app.
          </p>
          <div className="mt-6">
            <MfaChallenge onVerified={() => void check()} onSignOut={() => void handleSignOut()} />
          </div>
        </div>
      </Panel>
    )
  }

  if (state === 'needs-setup' && userId) {
    return (
      <>
        <PrivacyScreen />
        <SetupWizard userId={userId} email={email} onReady={handleSetupReady} />
      </>
    )
  }

  if (state === 'locked' && userId && keyset) {
    return (
      <>
        <PrivacyScreen />
        <UnlockScreen
          userId={userId}
          email={email}
          keyset={keyset}
          onUnlocked={handleUnlocked}
          onVaultReset={() => {
            setKeyset(null)
            setState('needs-setup')
          }}
          onSignOut={() => void handleSignOut()}
        />
      </>
    )
  }

  if (state === 'unlocked') {
    return (
      <>
        <PrivacyScreen />
        <AppShell
          onSignOut={() => void handleSignOut()}
          notice={
            unreadableCount > 0 && !noticeDismissed
              ? {
                  message:
                    unreadableCount === 1
                      ? '1 item couldn’t be read.'
                      : `${unreadableCount} items couldn’t be read.`,
                  onDismiss: () => setNoticeDismissed(true),
                }
              : null
          }
        >
          {children}
        </AppShell>
      </>
    )
  }

  // Waiting on a redirect, or on state that hasn't arrived yet.
  return (
    <Panel>
      <div className="flex items-center justify-center gap-3 py-10 text-ink-muted">
        <LoaderCircle aria-hidden="true" className="size-5 anim-spin" />
        <p aria-live="polite">One moment…</p>
      </div>
    </Panel>
  )
}

/** Every non-unlocked state is a full-screen panel centred on the page. */
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md">{children}</div>
    </main>
  )
}
