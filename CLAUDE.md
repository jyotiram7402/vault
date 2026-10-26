# Vault — project memory

The app is named through `APP_NAME` in `lib/config.ts` (currently "Vault", originally "Tijori"). The crypto protocol string is deliberately NOT derived from it — see "Protocol constants" below.

This is a zero-knowledge password manager: a Next.js 16 App Router app where every vault item is encrypted in the browser with AES-256-GCM under a key wrapped by Argon2id + HKDF from a master password that never leaves the device. Supabase provides sign-in and a Postgres database that stores only ciphertext, protected by Row Level Security. It installs as a PWA, works offline enough to say so, and runs entirely on free tiers.

## Stack

Next.js 16 (App Router, Turbopack, `proxy.ts` — **not** middleware) · React 19.3 · TypeScript 5.9 strict · Tailwind CSS v4 via `@tailwindcss/postcss`, tokens in `app/globals.css` under `@theme inline`, no `tailwind.config.*` · `@supabase/supabase-js` v2 + `@supabase/ssr` · `hash-wasm` for Argon2id · `lucide-react` v1 · Vercel Hobby + Supabase Free.

## Hard rules

- **Never run terminal commands.** No `npm`, `npx`, `node`, `git`, `tsc`, `next`, `supabase`. The owner pushes to GitHub; Vercel runs the build. If unsure whether something compiles, re-read the code.
- No lockfiles, `node_modules/`, `.next/`, `next-env.d.ts`, `.env.local`, or binary files. Images are SVG text or generated with `next/og`.
- Only the dependencies in `package.json`. Nothing that needs a CLI step (no shadcn CLI, Prisma, Drizzle, Supabase type generation, Husky).
- Kebab-case file names everywhere — Vercel's filesystem is case-sensitive.
- Server Components by default; `'use client'` only where hooks, browser APIs or handlers are needed, and never in a file exporting `metadata`, `viewport` or a route handler.

## Security invariants

1. **No plaintext or key material leaves the device.** No server route ever handles vault data; the browser talks to Supabase directly.
2. **The vault key lives in one private module variable** in `lib/vault/store.ts` — never in React state, the snapshot, storage, cookies, URLs or logs.
3. **Session keys are unwrapped non-extractable.** Extractable copies exist only inside re-wrap flows (change master password, recovery, new Recovery Key, passkey enrolment), each of which re-asks for the master password, and are dropped immediately.
4. **Round-trip before saving any keyset.** Unwrap it again and encrypt/decrypt a probe. A broken keyset locks a user out forever.
5. **Rows sent to Supabase contain only** `id`, `ciphertext`, `iv`, `enc_version` (+ `user_id` on insert). `lib/crypto/items.ts` → `toInsertRow` / `toUpdateRow` are the only places that build them.
6. **RLS on every table**, owner-only policies plus a restrictive `mfa_required` policy. The `anon` role gets no table privileges.
7. **Strict nonce-based CSP** from `proxy.ts`; static headers from `next.config.ts`. No third-party scripts, no remote images, no favicon fetching.
8. Validate every user-supplied URL for `http:`/`https:` before linking (`lib/security/url.ts`), and sanitise every `next=` parameter (`lib/security/safe-next.ts`).
9. Keyset updates filter on `key_version` and bump it; a zero-row result means another device won, and the user is told to reload.

## Protocol constants — do not change

`lib/crypto/constants.ts` holds `CRYPTO_PROTOCOL = 'tijori-vault-v1'` and every HKDF `info` and AES-GCM AAD string built from it. **Changing any of them makes every existing vault impossible to open.** They stay fixed even if the app is renamed, which is why they are never built from `APP_NAME`.

## File map

```
proxy.ts                 session refresh + CSP nonce + route protection
supabase/schema.sql      tables, RLS, triggers, delete_my_account()
app/                     routes; vault pages live under app/vault/
components/ui/           button, input, dialog, sheet, toast, menu, …
components/brand/        logo, dial (the Argon2id animation)
components/landing/      header, footer, cipher demo, steps, features, FAQ
components/auth/         auth card, forms, MFA challenge, setup-needed
components/vault/        gate, setup wizard, unlock, recovery, shell, list,
                         detail, form, palette, privacy screen
components/health/       score ring, issue list, breach scan
components/settings/     one file per settings section + import/export dialogs
lib/config.ts            APP_NAME, APP_SLUG, STORAGE_PREFIX, tagline, REPO_URL
lib/env.ts               NEXT_PUBLIC_* reads, never throws
lib/crypto/              bytes, random, constants, kdf, keys, items,
                         recovery-key, backup, passkey
lib/vault/               types, store, use-vault, api, items, search, health,
                         csv, import, export, settings, theme, auto-lock,
                         broadcast, clipboard
lib/password/            generator, strength, common-passwords, wordlist, hibp
lib/supabase/            client, server, proxy, auth-errors
lib/brand/app-icon.tsx   next/og icon renderer shared by the PWA icon routes
lib/totp.ts              RFC 6238 codes
```

## Three name constants, three different jobs

- **`APP_NAME`** (`lib/config.ts`) — everything a person reads. `APP_SLUG` is its lower-case form, used only for download file names.
- **`STORAGE_PREFIX`** (`lib/config.ts`, currently `vault`) — the namespace for localStorage keys, the theme cookie and the BroadcastChannel. A literal, **not** derived from `APP_NAME`: browser storage is a persistence contract, and coupling it to a display name would make a rename silently reset everyone's preferences. The service worker's cache name in `public/sw.js` is the one copy that must be kept in step by hand, because a static JS file cannot import it.
- **`CRYPTO_PROTOCOL`** (`lib/crypto/constants.ts`, `tijori-vault-v1`) — never change it, and never derive it from either of the above. See below.

## Conventions

- Design tokens only — `bg-surface`, `text-ink-muted`, `border-line`, `bg-primary` — never hard-coded colours. Tailwind only sees complete class names, so use lookup objects, never joined strings.
- Button labels and their toasts must match: "Save login" → "Login saved".
- Plain English, sentence case, no emoji, no apologies. Errors say what happened and how to fix it.
- Dialogs are native `<dialog>` with `showModal()`, driven by an `open` prop from an effect, listening for `close` and `cancel`.
- `getSnapshot()` in the store must return the same object until something changes, or `useSyncExternalStore` loops.
- Byte helpers return `Uint8Array<ArrayBuffer>`; base64 converts in 0x8000 chunks.
- Only the lucide-react v1 icon names verified in the build brief. There are no brand icons in v1.

## Fixing a Vercel build error

1. Read the actual error in the Vercel log; find the file and line.
2. Make the **smallest** change that fixes it. Do not upgrade or add packages to make a type error go away — the version ranges in `package.json` are deliberate (Next.js must resolve to ≥ 16.4.1 for the October 2026 security patches).
3. Check the import path's exact casing, that the symbol is exported, and that `'use client'` is where it needs to be.
4. Re-read the surrounding code rather than running anything.

## Decisions

- **Revealing *and copying* a stored secret asks for the master password again** (setting `requireMasterToReveal`, on by default). `lib/vault/reprompt.ts` holds both the grace period and a pending-request store; `RepromptHost` renders the one dialog, in `AppShell`. Callers use `requireReprompt(): Promise<boolean>` — `CopyButton` takes a `guarded` prop, and `useReveal` in `item-detail.tsx` awaits it. It is a module store rather than a React context because the item row and the command palette are outside the detail pane's tree. Guarded: passwords, password history, card numbers, CVV, PIN, hidden custom fields, notes. Not guarded: usernames, a freshly generated password, the Recovery Key during setup, and the live TOTP code (ephemeral, and useless without the password). Note the clipboard caveat documented on `requireReprompt`.

- **The master password policy is deliberately permissive** — six characters or more, and not the user's own email, enforced in `masterPasswordProblem` (`lib/password/strength.ts`). No minimum strength, no character-class rule: digits only or letters only are both accepted. The owner asked for this explicitly after being told the cost. `masterPasswordCaution()` surfaces the risk beside the strength meter instead of blocking. **Do not reinstate the strength gate as a "fix".** The 12-character minimum on the *account* (sign-in) password is unrelated, still in force, and also enforced by Supabase.

- **Supabase client is untyped** (no generated database types, since that needs a CLI). Query results are cast to row interfaces in exactly one place, `lib/vault/api.ts`, through two small helpers with comments. Nothing else in the app casts.
- **Extra modules beyond the brief's file list**, each small and single-purpose: `lib/supabase/auth-errors.ts` (friendly auth messages), `lib/vault/items.ts` (bridges crypto and the API so neither imports the other), `lib/vault/theme.ts` (theme cookie), `components/vault/vault-view.tsx` (the items page orchestrator, kept out of `app/` so the page stays a Server Component with a Suspense boundary), `components/settings/section.tsx` (the shared settings panel) and `components/settings/install-section.tsx`.
- **View state is a module store, not router state.** `lib/vault/view-state.ts` owns which filter, item and form are showing; the URL (`/vault?filter=type:login`, `?item=`, `?new=`, `?edit=1`, `?focus=password`, `?import=1`) is kept in step with the native History API, and `popstate` syncs it back.

  **Do not "simplify" this back to `router.push` / `<Link>`.** In the App Router, navigating to the same route with different search params is a *server* navigation: it re-runs `proxy.ts`, which calls Supabase to verify the session, then re-renders the page and refetches its payload. That made every filter click and every item click cost a network round-trip, to narrow a list already decrypted in memory — it was the app's single biggest source of sluggishness. Filters are `<button aria-pressed>` rather than links for the same reason. Real route changes (Health, Generator, Settings) still use `<Link>`, which is correct.
- **`VaultItem` carries `rowUpdatedAt`** (the server timestamp) in addition to the payload's own `createdAt`/`updatedAt`, so sync can tell which rows changed without decrypting them.
- **The gate never auto-unlocks from the store.** Transitions to `unlocked` are explicit callbacks from the unlock screen, recovery flow and setup wizard; the store subscription only ever drives it back to `locked`. This is what lets the setup wizard show its final step after the vault is already open.
- **Backup files derive their AES key straight from Argon2id output** (imported as AES-GCM) rather than through HKDF, matching the brief's description; the AAD `tijori-vault-v1:backup` provides the domain separation.
- **The dial's "working" animation runs on a wrapping `<div>`**, not on SVG children, so the compositor keeps it turning while Argon2id blocks the main thread.
- **Nothing is omitted from the brief.** Quick unlock degrades silently where the WebAuthn PRF extension is unavailable, which is the only feature that can be absent at runtime.
