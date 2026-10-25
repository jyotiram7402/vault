# Tijori: build brief for Claude Code

You are building a complete, production-ready password manager web app in this (empty) folder. Read this whole brief before writing anything. Then follow **15. Build order**, keep a task list as you go, and finish with **16. Final self-review**.

---

## 0. Ground rules

1. **Do not run any terminal commands.** No `npm`, `npx`, `pnpm`, `yarn`, `node`, `git`, `tsc`, `next`, `eslint`, `supabase`, `curl` or shell scripts, not even "just to check". Use only your file tools (read, write, edit, search). The owner pushes this folder to GitHub; Vercel runs `npm install` and `next build`. If you're unsure whether something compiles, re-read the code instead of running it.
2. Do not create lockfiles (`package-lock.json` etc.), `node_modules/`, `.next/`, `next-env.d.ts`, `.env.local`, or any binary file (`.png`, `.ico`, `.jpg`, `.woff2`, `.wasm`). Images are SVG text or are generated in code with `next/og`.
3. Do not use anything that needs a CLI step: no shadcn CLI, Prisma, Drizzle, Supabase type generation or Husky. Write every component by hand.
4. Use only the dependencies listed in section 2.
5. Stay on free tiers: Vercel Hobby and Supabase Free. No analytics, trackers, third-party scripts, remote images, runtime font requests or paid APIs.
6. The security rules in section 3 override everything else. If a feature can't be built securely, leave it out and say so in `CLAUDE.md`.
7. If something is ambiguous, pick the simplest secure option, record it under "Decisions" in `CLAUDE.md`, and keep going. Don't stop to ask.
8. The first Vercel build must pass: strict TypeScript, exact import paths (Vercel's filesystem is case-sensitive, so use kebab-case file names everywhere), no half-finished experiments, no reachable `TODO`s, no buttons that do nothing.

---

## 1. The product

**Tijori** (Hindi for a safe or strongbox) is a free password manager that runs in any modern browser and installs like an app on phones and computers. Anyone can create an account. Each person's vault is encrypted on their own device before anything is saved.

The promise every line of code must keep: **the server only ever stores ciphertext.** Master passwords, encryption keys and decrypted data never leave the user's device.

What people use it for:
- Saving website logins (site, username or email, password, notes), payment cards and secure notes, then finding them in seconds.
- Unlocking everything with one master password, on any device.
- Generating strong passwords and fixing weak, reused or breached ones.
- Using it comfortably on a phone (installable PWA, bottom navigation, large touch targets) and on a desktop (three-pane layout, keyboard shortcuts).

Put the name and copy in `lib/config.ts` (`APP_NAME = 'Tijori'`, `APP_TAGLINE`, `APP_DESCRIPTION`, `REPO_URL = ''`) and use them everywhere, so the owner can rename the app in one place. Crypto strings must never be built from `APP_NAME` (see 3.3).

---

## 2. Stack and dependencies

| Layer | Choice |
|---|---|
| Framework | Next.js 16 App Router, TypeScript, Turbopack (the default). Must resolve to **16.4.1 or newer**: older 16.x releases have critical vulnerabilities that were patched on 14 October 2026. |
| UI runtime | React 19.3 (19.3.1 or newer) |
| Styling | Tailwind CSS v4 through `@tailwindcss/postcss`. Theme tokens live in CSS (`@theme inline`). No `tailwind.config.*` file. |
| Auth and data | Supabase Auth + Postgres with Row Level Security, via `@supabase/supabase-js` v2 and `@supabase/ssr` |
| Crypto | Web Crypto API (AES-256-GCM, HKDF-SHA-256, SHA-1/SHA-256, HMAC, CSPRNG) plus `hash-wasm` for Argon2id, loaded only when needed |
| Icons | `lucide-react` v1, verified names only (13.7) |
| Hosting | Vercel Hobby + Supabase Free |

Write `package.json` exactly like this (you may add a `description`):

```json
{
  "name": "tijori",
  "version": "1.0.0",
  "private": true,
  "engines": {
    "node": ">=22.0.0"
  },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@supabase/ssr": "^0.12.7",
    "@supabase/supabase-js": "^2.117.0",
    "hash-wasm": "^4.12.0",
    "lucide-react": "^1.56.0",
    "next": "^16.4.2",
    "react": "^19.3.1",
    "react-dom": "^19.3.1"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.3.3",
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "tailwindcss": "^4.3.3",
    "typescript": "^5.9.3"
  }
}
```

`tsconfig.json` (the official Next.js 16 template):

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts", "**/*.mts"],
  "exclude": ["node_modules"]
}
```

`postcss.config.mjs`:

```js
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
```

`next.config.ts`: a typed `NextConfig` with `reactStrictMode: true`, `poweredByHeader: false`, and an `async headers()` that returns the static security headers from section 9 for every path, plus `Cache-Control: no-cache, no-store, must-revalidate` for `/sw.js`. Nothing else: no experimental flags, no `images`, no webpack config. The CSP header is set in `proxy.ts`, not here.

`.gitignore`: the standard Next.js list (`/node_modules`, `/.next/`, `/out/`, `.vercel`, `*.tsbuildinfo`, `next-env.d.ts`, `.env*`) plus a line `!.env.example` so the example file is committed.

Environment variables (write them to `.env.example` with placeholder values and a one-line comment each):

| Name | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Project URL, like `https://abcd.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Publishable key (`sb_publishable_…`). Also accept `NEXT_PUBLIC_SUPABASE_ANON_KEY` as a fallback for projects that only have the legacy anon key. |
| `NEXT_PUBLIC_SITE_URL` | recommended | Public URL such as `https://tijori.vercel.app`, used for metadata and the Emergency Kit. In the browser, fall back to `window.location.origin`. |
| `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH` | optional | `true` shows "Continue with Google" |

No server secrets are needed. Never add a Supabase secret or service-role key. `lib/env.ts` reads each variable with a direct `process.env.NEXT_PUBLIC_…` reference (so Next inlines it), trims trailing slashes, and exports `isSupabaseConfigured`. Missing variables must never crash the build or a page: public pages still render, and auth and vault pages show a "Setup needed" panel naming the missing variables and pointing to the README. Never throw at module load.

---

## 3. Security design

### 3.1 Two secrets with different jobs

- **Account password** (Supabase Auth) signs the person in. Supabase stores and checks it, and it can be reset by email.
- **Master password** opens the vault. It is never sent anywhere, never stored, and nobody can reset it. If it's forgotten, only the **Recovery Key** created at setup can restore access.
- Optional extras: TOTP two-factor for sign-in (8.8) and passkey quick unlock for the vault (8.10).

Explain this once, plainly, during setup: "Your account password signs you in. Your master password unlocks your vault and never leaves this device. Nobody, including us, can reset it." Ask people not to reuse their account password as their master password.

### 3.2 Keys and algorithms (implement exactly)

All primitives come from `crypto.subtle`, except Argon2id from `hash-wasm`. Store binary values as standard base64 text.

| What | How |
|---|---|
| KDF salt | 16 random bytes per user |
| Master key material | `argon2id({ password: masterPassword.normalize('NFKC'), salt, memorySize: 65536, iterations: 3, parallelism: 1, hashLength: 32, outputType: 'binary' })` (memory is in KiB, so 64 MiB) |
| Master KEK | HKDF-SHA-256 over those 32 bytes, salt = 32 zero bytes, info = `${CRYPTO_PROTOCOL}:master-kek` → AES-GCM-256 `CryptoKey`, non-extractable, usages `['wrapKey', 'unwrapKey']` |
| Vault key | `crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])`, created once at setup |
| Wrapped vault key | `crypto.subtle.wrapKey('raw', vaultKey, masterKek, { name: 'AES-GCM', iv, additionalData })` with a fresh 12-byte IV and AAD `${CRYPTO_PROTOCOL}:vault-key:${userId}` |
| Recovery Key | 20 random bytes shown as 32 Crockford base32 characters in 8 groups of 4 (`7KQ2-M9XD-…`). Decoding is case-insensitive, ignores spaces and hyphens, and maps I/L to 1 and O to 0. |
| Recovery KEK | HKDF-SHA-256 over the 20 bytes, zero salt, info `${CRYPTO_PROTOCOL}:recovery-kek` |
| Recovery-wrapped vault key | Same as the wrapped vault key, with its own IV and AAD `${CRYPTO_PROTOCOL}:recovery-vault-key:${userId}` |
| Item ciphertext | `crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData }, vaultKey, paddedPayload)` with a fresh 12-byte IV and AAD `${CRYPTO_PROTOCOL}:item:${userId}:${itemId}:${encVersion}`. `itemId` comes from `crypto.randomUUID()` before encryption and is inserted as the row's `id`. |

Rules:
- On unlock, `unwrapKey` the vault key with `extractable: false` and usages `['encrypt', 'decrypt']`. That non-extractable key is the only key kept for the session.
- Unwrap as extractable only inside flows that must re-wrap (change master password, recover with the Recovery Key, create a new Recovery Key, enable quick unlock). Each asks for the master password or Recovery Key again. Drop the extractable reference as soon as the flow ends.
- **Round-trip before saving.** After producing any wrapped key, unwrap it again and encrypt and decrypt a test value with the result. Never save a keyset that hasn't passed; a broken keyset locks the user out forever.
- When reading stored KDF parameters, refuse anything below 19456 KiB memory or 2 iterations: show an error and don't derive.
- Keep KDF parameters in the database row so they can be raised later without breaking existing vaults. New keysets always use `KDF_DEFAULTS`.
- A wrong master password surfaces as an `OperationError` from `unwrapKey`. Turn it into a friendly message, never a stack trace.

### 3.3 Protocol constants

`lib/crypto/constants.ts` exports `CRYPTO_PROTOCOL = 'tijori-vault-v1'`, builder functions for every AAD and HKDF info string above, `KDF_DEFAULTS`, `KDF_MINIMUMS`, `ENC_VERSION = 1` and `PAD_BLOCK = 256`. Add a prominent comment: changing any of these strings makes every existing vault impossible to open. They stay the same even if the app is renamed.

### 3.4 Item payloads

- The payload is the item's JSON (types in 7.1), including `"v": 1`.
- Before encrypting, append spaces until the UTF-8 byte length is a multiple of 256 (`JSON.parse` ignores trailing whitespace). This hides the exact length of passwords and notes from the server.
- After encrypting an item for saving, decrypt it once and compare with the input before sending. It's cheap insurance against bugs that would corrupt data.
- Rows sent to Supabase contain only `id`, `ciphertext`, `iv` and `enc_version` (plus `user_id` on insert). Build them with one typed function that picks exactly those fields. Titles, URLs, usernames, tags, categories, favourites and the timestamps shown in the UI all live inside the ciphertext.

### 3.5 Memory and session hygiene

- The vault key and decrypted items live only in memory (6.4). Never put them, or anything derived from them, in localStorage, sessionStorage, IndexedDB, cookies, URLs, logs or error messages.
- A page reload means locked. Locking drops the key, every decrypted item, revealed values and open forms, then shows the unlock screen.
- Auto-lock after inactivity: default 5 minutes, options 1, 5, 15, 30 and 60. Also lock when the tab returns after being hidden longer than the timeout. A lock button is always visible, and Ctrl/⌘+Shift+L locks too.
- Locking or signing out in one tab does the same in every tab (BroadcastChannel `tijori-session`).
- After copying a secret, clear the clipboard after 30 seconds (setting: 15, 30, 60, 90 or off). This is best effort: only while the page has focus, and failures are ignored. The copy button shows the countdown as a shrinking ring.
- Revealed secrets hide again after 20 seconds.
- Privacy screen (setting, on by default): blur every element marked as secret when the window loses focus or the page is hidden.
- Inputs and outputs that hold secrets get `spellCheck={false}`, `autoCapitalize="off"`, `autoCorrect="off"` and `translate="no"`. Item form fields use `autoComplete="off"` (or `"new-password"` on password fields) so browsers don't offer to save vault items into their own password managers.

### 3.6 Server, network and content

- Row Level Security on every table (section 4). The `anon` role gets no table privileges.
- No server code ever handles vault data. There are no API routes for it; the browser talks to Supabase directly with the user's session, and RLS limits each user to their own rows.
- Strict, nonce-based CSP (section 9). No third-party scripts.
- No remote images. Websites are shown as generated monograms. Never fetch favicons: that would tell a third party which sites the user has accounts on.
- Breach checks call the Have I Been Pwned range API straight from the browser, only when the user presses "Check for breaches". Only the first 5 hex characters of each password's SHA-1 hash leave the device.
- Validate every URL from user data before using it in a link: allow only `http:` and `https:`. Open links with `target="_blank" rel="noopener noreferrer"`.
- Never use `dangerouslySetInnerHTML` with user data, and never log secrets.
- Sanitize every `next` redirect parameter: it must start with a single `/` and contain no `//`, `\` or scheme; otherwise use `/vault`.

### 3.7 Unlock throttling

After 3 wrong master passwords, make the user wait 2^(n−3) seconds before the next attempt (capped at 60 seconds) and show the countdown. Store the counter and next-allowed time in localStorage; they aren't secret.

### 3.8 Honest limits (put these in SECURITY.md)

- Malware or a keylogger on the device defeats any password manager.
- Whoever controls the hosting could ship modified JavaScript. Mitigations: open source, strict CSP, no third-party scripts, and self-hosting for people who want full control.
- AAD stops ciphertext from being swapped between items or users, but a malicious server could serve an older version of the same item.
- Supabase session cookies are readable by JavaScript (the browser client needs them); the strict CSP is the XSS defence.
- Losing both the master password and the Recovery Key means nobody can open the vault. That's the cost of zero-knowledge, and the UI must say so before setup finishes.

---

## 4. Database: `supabase/schema.sql`

Write this file with exactly this SQL (you may add comments). The owner pastes it into Supabase → SQL Editor and presses Run. It is safe to run more than once.

```sql
-- =============================================================
-- Tijori database schema (Supabase / Postgres)
-- Paste into Supabase → SQL Editor → New query → Run.
-- Safe to run again: uses IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS.
-- The server only ever stores ciphertext. Never add plaintext columns.
-- =============================================================

-- Helper schema for functions that must not be exposed through the Data API.
create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------- Tables ----------

-- One row per user: KDF parameters + two wrapped copies of the vault key.
create table if not exists public.vault_keys (
  user_id                 uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  kdf_algorithm           text    not null default 'argon2id' check (kdf_algorithm = 'argon2id'),
  kdf_salt                text    not null check (char_length(kdf_salt) between 22 and 64),
  kdf_memory_kib          integer not null check (kdf_memory_kib between 19456 and 1048576),
  kdf_iterations          integer not null check (kdf_iterations between 2 and 50),
  kdf_parallelism         integer not null check (kdf_parallelism between 1 and 16),
  wrapped_key             text    not null check (char_length(wrapped_key) between 40 and 200),
  wrapped_key_iv          text    not null check (char_length(wrapped_key_iv) = 16),
  recovery_wrapped_key    text    not null check (char_length(recovery_wrapped_key) between 40 and 200),
  recovery_wrapped_key_iv text    not null check (char_length(recovery_wrapped_key_iv) = 16),
  key_version             integer not null default 1 check (key_version >= 1),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- One row per encrypted item. Everything readable lives inside ciphertext.
create table if not exists public.vault_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ciphertext  text not null check (char_length(ciphertext) between 24 and 400000),
  iv          text not null check (char_length(iv) = 16),
  enc_version smallint not null default 1 check (enc_version >= 1),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists vault_items_user_updated_idx
  on public.vault_items (user_id, updated_at desc);

-- Optional passkey quick-unlock wrappers (one per enrolled device).
create table if not exists public.vault_passkeys (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  credential_id  text not null check (char_length(credential_id) between 16 and 1024),
  prf_salt       text not null check (char_length(prf_salt) between 40 and 64),
  wrapped_key    text not null check (char_length(wrapped_key) between 40 and 200),
  wrapped_key_iv text not null check (char_length(wrapped_key_iv) = 16),
  label          text not null default 'This device' check (char_length(label) between 1 and 60),
  created_at     timestamptz not null default now(),
  last_used_at   timestamptz,
  unique (user_id, credential_id)
);

-- ---------- Helper functions ----------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Keeps one account from filling the free database.
create or replace function private.enforce_vault_item_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.vault_items where user_id = new.user_id) >= 5000 then
    raise exception 'Vault item limit reached (5000 items)';
  end if;
  return new;
end;
$$;

-- True when the user has no verified MFA factor, or has one and this session is aal2.
create or replace function private.mfa_requirement_met()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from auth.mfa_factors f
      where f.user_id = auth.uid() and f.status = 'verified'
    )
    then coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    else true
  end;
$$;

revoke all on function private.mfa_requirement_met() from public;
grant execute on function private.mfa_requirement_met() to authenticated;

-- ---------- Triggers ----------

drop trigger if exists vault_keys_set_updated_at on public.vault_keys;
create trigger vault_keys_set_updated_at
  before update on public.vault_keys
  for each row execute function private.set_updated_at();

drop trigger if exists vault_items_set_updated_at on public.vault_items;
create trigger vault_items_set_updated_at
  before update on public.vault_items
  for each row execute function private.set_updated_at();

drop trigger if exists vault_items_enforce_limit on public.vault_items;
create trigger vault_items_enforce_limit
  before insert on public.vault_items
  for each row execute function private.enforce_vault_item_limit();

-- ---------- Privileges ----------

revoke all on table public.vault_keys, public.vault_items, public.vault_passkeys from anon, authenticated;
grant select, insert, update, delete on table public.vault_keys, public.vault_items, public.vault_passkeys to authenticated;

-- ---------- Row Level Security ----------
-- Owner-only access, plus a restrictive policy: users who enabled two-factor
-- sign-in must have an aal2 session before they can read or write anything.

do $$
declare
  t text;
begin
  foreach t in array array['vault_keys', 'vault_items', 'vault_passkeys'] loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists owner_select on public.%I', t);
    execute format('create policy owner_select on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);

    execute format('drop policy if exists owner_insert on public.%I', t);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);

    execute format('drop policy if exists owner_update on public.%I', t);
    execute format('create policy owner_update on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);

    execute format('drop policy if exists owner_delete on public.%I', t);
    execute format('create policy owner_delete on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);

    execute format('drop policy if exists mfa_required on public.%I', t);
    execute format('create policy mfa_required on public.%I as restrictive for all to authenticated using ((select private.mfa_requirement_met())) with check ((select private.mfa_requirement_met()))', t);
  end loop;
end
$$;

-- ---------- Account deletion (called from Settings) ----------

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;
  if not private.mfa_requirement_met() then
    raise exception 'Two-factor verification required';
  end if;
  -- Cascades to vault_keys, vault_items and vault_passkeys.
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
```

How the app uses it:
- `vault_keys`: one row per user. `vault_items`: one encrypted row per item. `vault_passkeys`: optional quick-unlock wrappers (8.10).
- Create a keyset with `insert` only, never `upsert` (an upsert could overwrite a working keyset).
- Every update to `vault_keys` filters on `.eq('key_version', current)`, sets `key_version: current + 1`, and uses `.select()` to confirm a row changed. If nothing changed, show "Your vault changed on another device. Reload and try again."
- Supabase returns at most 1000 rows per request: load items in pages with `.range(from, from + 999)`, ordered by `created_at` then `id`, until a page comes back short.
- Deletes need a filter: `.delete().eq('user_id', userId)` for "delete all".
- A row hidden by RLS comes back as empty data, not an error. Never conclude "this user has no vault" until the sign-in assurance level is confirmed (6.5).

---

## 5. Project structure

Server Components by default; add `'use client'` only where hooks, browser APIs or event handlers are needed. Kebab-case file names, PascalCase component exports.

```
.
├── CLAUDE.md                     project memory for future Claude Code sessions (14)
├── README.md                     deploy guide for a non-developer (14)
├── SECURITY.md                   threat model and crypto design (14)
├── LICENSE                       MIT
├── .gitignore  .env.example  package.json  tsconfig.json  next.config.ts  postcss.config.mjs
├── proxy.ts                      session refresh + CSP nonce + route protection (6.2)
├── supabase/schema.sql
├── public/
│   ├── sw.js                     service worker (8.11)
│   └── offline.html
├── app/
│   ├── layout.tsx                fonts, theme cookie → data-theme, SW registration
│   ├── globals.css               Tailwind v4 + design tokens (10)
│   ├── icon.svg                  favicon (hand-written SVG)
│   ├── apple-icon.tsx            180×180 PNG via next/og
│   ├── opengraph-image.tsx       1200×630 PNG via next/og
│   ├── pwa/icon-192.png/route.tsx
│   ├── pwa/icon-512.png/route.tsx
│   ├── pwa/maskable-512.png/route.tsx
│   ├── manifest.ts
│   ├── robots.ts                 allow /, disallow /vault and /auth
│   ├── not-found.tsx  error.tsx  global-error.tsx
│   ├── page.tsx                  landing (8.12)
│   ├── generator/page.tsx        public password generator
│   ├── security/page.tsx         plain-language "how your vault is sealed"
│   ├── privacy/page.tsx
│   ├── login/page.tsx  signup/page.tsx  forgot-password/page.tsx  reset-password/page.tsx
│   ├── auth/confirm/route.ts     email links (token_hash)
│   ├── auth/callback/route.ts    OAuth code exchange
│   ├── auth/error/page.tsx
│   └── vault/
│       ├── layout.tsx            VaultGate + AppShell (client boundary inside)
│       ├── page.tsx              items: list + detail
│       ├── health/page.tsx
│       ├── generator/page.tsx
│       └── settings/page.tsx
├── components/
│   ├── ui/          button, icon-button, input, password-input, textarea, select, switch, segmented,
│   │                slider, field, dialog, sheet, toast, menu, badge, skeleton, empty-state, kbd
│   ├── brand/       logo, dial
│   ├── landing/     site-header, site-footer, cipher-demo, seal-steps, feature-list, faq
│   ├── auth/        auth-card, login-form, signup-form, forgot-form, reset-form, mfa-challenge,
│   │                oauth-button, setup-needed
│   ├── vault/       vault-gate, setup-wizard, unlock-screen, recovery-flow, reset-vault-dialog,
│   │                app-shell, nav-rail, bottom-nav, filter-bar, item-list, item-row, item-detail,
│   │                item-form, monogram, secret-text, copy-button, totp-code, strength-meter,
│   │                command-palette, shortcuts-dialog, install-prompt, privacy-screen
│   ├── health/      health-score, issue-list, breach-scan
│   ├── generator/   password-generator
│   ├── settings/    security-section, master-password-section, recovery-section,
│   │                quick-unlock-section, two-factor-section, data-section, appearance-section,
│   │                account-section, danger-zone, import-dialog, export-dialog
│   └── pwa/         register-sw
└── lib/
    ├── config.ts  env.ts  utils.ts
    ├── supabase/   client.ts  server.ts  proxy.ts
    ├── security/   csp.ts  safe-next.ts  url.ts
    ├── crypto/     constants.ts  bytes.ts  random.ts  kdf.ts  keys.ts  items.ts
    │               recovery-key.ts  backup.ts  passkey.ts
    ├── vault/      types.ts  store.ts  use-vault.ts  api.ts  search.ts  health.ts  csv.ts
    │               import.ts  export.ts  settings.ts  auto-lock.ts  broadcast.ts  clipboard.ts
    ├── password/   generator.ts  strength.ts  common-passwords.ts  wordlist.ts  hibp.ts
    ├── brand/      app-icon.tsx  (shared next/og icon renderer)
    └── totp.ts
```

---

## 6. Auth, sessions and the vault gate

### 6.1 Supabase clients

- `lib/supabase/client.ts`: `createBrowserClient(SUPABASE_URL, SUPABASE_KEY)`. It's already a singleton; import it only from client components.
- `lib/supabase/server.ts`: `createServerClient(SUPABASE_URL, SUPABASE_KEY, { cookies: { getAll, setAll } })` using `const cookieStore = await cookies()`. Wrap the body of `setAll` in `try/catch`: Server Components can't set cookies, and the proxy refreshes sessions anyway. Use it in route handlers and Server Components.
- `lib/supabase/proxy.ts`: `updateSession()`, below.
- On the server, decide who the user is only with `supabase.auth.getClaims()`. Never trust `getSession()` in server code.

### 6.2 `proxy.ts`

Next.js 16 renamed Middleware to Proxy: the file is `proxy.ts` at the project root and it exports a function named `proxy`. Do not create `middleware.ts`, and do not export `runtime` from `proxy.ts` (Proxy always runs on Node.js; setting it is an error).

```ts
// proxy.ts
import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'
import { buildContentSecurityPolicy } from '@/lib/security/csp'

export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID())
  const csp = buildContentSecurityPolicy(nonce)
  const { response, userId } = await updateSession(request, {
    'x-nonce': nonce,
    'Content-Security-Policy': csp,
  })

  const { pathname, search } = request.nextUrl
  const isVault = pathname === '/vault' || pathname.startsWith('/vault/')

  if (isVault && !userId) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = `?next=${encodeURIComponent(pathname + search)}`
    return carrySession(response, NextResponse.redirect(url))
  }
  if (userId && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone()
    url.pathname = '/vault'
    url.search = ''
    return carrySession(response, NextResponse.redirect(url))
  }

  response.headers.set('Content-Security-Policy', csp)
  if (isVault) response.headers.set('Cache-Control', 'private, no-store')
  return response
}

// Copy refreshed auth cookies and cache headers onto a different response.
function carrySession(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie))
  for (const header of ['cache-control', 'expires', 'pragma']) {
    const value = from.headers.get(header)
    if (value) to.headers.set(header, value)
  }
  return to
}

export const config = {
  matcher: [
    {
      source:
        '/((?!_next/static|_next/image|pwa/|favicon.ico|icon.svg|apple-icon|opengraph-image|manifest.webmanifest|robots.txt|sw.js|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|js|css|map)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
```

```ts
// lib/supabase/proxy.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from '@/lib/env'

export async function updateSession(request: NextRequest, extraRequestHeaders: Record<string, string>) {
  // Rebuild from request.headers each time: request.cookies.set() updates the cookie header.
  const next = () => {
    const headers = new Headers(request.headers)
    for (const [key, value] of Object.entries(extraRequestHeaders)) headers.set(key, value)
    return NextResponse.next({ request: { headers } })
  }

  let response = next()
  if (!isSupabaseConfigured) return { response, userId: null as string | null }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, cacheHeaders) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = next()
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        if (cacheHeaders) {
          Object.entries(cacheHeaders).forEach(([key, value]) => response.headers.set(key, value))
        }
      },
    },
  })

  // Run nothing between createServerClient and getClaims.
  let userId: string | null = null
  try {
    const { data } = await supabase.auth.getClaims()
    userId = typeof data?.claims?.sub === 'string' ? data.claims.sub : null
  } catch {
    userId = null
  }
  return { response, userId }
}
```

Notes:
- Always return the response that `setAll` built last; an earlier one doesn't carry the refreshed cookies, and the user gets signed out.
- The proxy is defence in depth. The vault UI is also gated in the browser (6.5), and RLS protects the data itself.

### 6.3 Auth pages and routes

All auth pages share an `AuthCard` (small logo, title, form) centred on `--bg`. They are Server Component pages that render client forms. Any component that calls `useSearchParams()` must sit inside `<Suspense>`. If `isSupabaseConfigured` is false, render `SetupNeeded` instead of the form. Build redirect URLs in the browser from `window.location.origin`.

- **`/signup`**: email, account password (at least 12 characters, strength meter from 8.2, show/hide), confirm password. Helper text: "This is your sign-in password. You'll create a separate master password next." Button "Create account". Call `supabase.auth.signUp` with `options.emailRedirectTo` set to the origin plus `/vault`. If the response contains a session, go to `/vault`. Otherwise show "Check your inbox at {email}. Open the link to confirm your account, then sign in." with "Resend email" (`supabase.auth.resend({ type: 'signup', email })`) after a 60-second cooldown.
- **`/login`**: email, password, "Sign in"; links "Forgot password?" and "Create account". If `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === 'true'`, also show "Continue with Google": `signInWithOAuth({ provider: 'google' })` with `options.redirectTo` set to the origin plus `/auth/callback?next=/vault`. After `signInWithPassword`, call `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`. If `nextLevel === 'aal2'` and `currentLevel !== 'aal2'`, show `MfaChallenge` (8.8) in place of the form. Then `router.replace(safeNextPath(next))` and `router.refresh()`. Map errors: wrong credentials → "Email or password is wrong."; email not confirmed → "Confirm your email first." plus a resend button; rate limited → "Too many attempts. Wait a minute and try again."
- **`/forgot-password`**: email → `supabase.auth.resetPasswordForEmail(email)` (with `redirectTo` set to the origin plus `/reset-password`) → always show "If an account exists for that email, we've sent a link to reset your sign-in password." Never reveal whether an account exists.
- **`/reset-password`**: needs the session created by the email link. Without one, show "This link has expired. Request a new one." with a link. Otherwise new password + confirm → `supabase.auth.updateUser({ password })` → toast "Password updated" → `/vault`. Always show: "This changes your sign-in password only. Your master password stays the same."
- **`app/auth/confirm/route.ts`** (links in emails):

```ts
import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest } from 'next/server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { safeNextPath } from '@/lib/security/safe-next'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeNextPath(searchParams.get('next'))

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) redirect(next)
  }
  redirect('/auth/error')
}
```

- **`app/auth/callback/route.ts`** (OAuth): the same shape, but read `code` and call `supabase.auth.exchangeCodeForSession(code)`.
- **`/auth/error`**: "That link didn't work. It may have expired or already been used." with buttons "Sign in" and "Send a new link".
- **`lib/security/safe-next.ts`**:

```ts
export function safeNextPath(value: string | null | undefined, fallback = '/vault'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(value)) return fallback
  return value
}
```

### 6.4 In-memory vault store

`lib/vault/store.ts` is framework-free (no React import):

```ts
type VaultStatus = 'locked' | 'unlocked'

interface VaultSnapshot {
  status: VaultStatus
  userId: string | null
  email: string | null
  items: readonly VaultItem[] // decrypted, sorted by updatedAt, newest first
  keyset: KeysetRow | null
  lastSyncedAt: number | null
}
```

- The vault key lives in a private module variable (`let vaultKey: CryptoKey | null = null`), never in the snapshot or in React state.
- Exports: `unlockSession({ userId, email, key, keyset, items })`, `lock(reason: 'manual' | 'idle' | 'hidden' | 'remote' | 'signout')`, `getVaultKey()` (throws when locked), `replaceItems()`, `upsertItem()`, `removeItem()`, `subscribe()`, `getSnapshot()`, `getServerSnapshot()`.
- `getSnapshot()` returns the same object until something changes (otherwise `useSyncExternalStore` loops forever). `getServerSnapshot()` returns one constant locked snapshot.
- `lib/vault/use-vault.ts` (`'use client'`) wraps the store with `useSyncExternalStore`.
- `VaultItem` = `{ id, data: ItemPayload, createdAt, updatedAt, searchText, encrypted: { ciphertext, iv, encVersion } }`. Keeping the encrypted row lets Undo (7.5) re-insert it unchanged.

### 6.5 Vault gate

`app/vault/layout.tsx` (a Server Component) renders a client `VaultGate` that wraps `AppShell` and the page. The gate is a small state machine:

```text
checking
 ├─ env missing ─────────────► unconfigured   (SetupNeeded panel)
 ├─ no session ──────────────► router.replace('/login?next=/vault')
 ├─ AAL says aal2 needed ────► needs-mfa      (MfaChallenge, then back to checking)
 └─ fetch vault_keys with maybeSingle()
     ├─ error ───────────────► error          (retry panel; NEVER setup)
     ├─ no row ──────────────► needs-setup    (SetupWizard)
     └─ row ─────────────────► locked         (UnlockScreen)

locked ── unlock ──► unlocked (AppShell + page)
unlocked ── lock, idle, other tab, sign-out ──► locked
```

- If the store is already unlocked for the same user (client-side navigation between vault pages), go straight to `unlocked`.
- In the browser, `getSession()` is fine for deciding where to navigate; data access is still enforced by RLS.
- Network error copy: "Can't reach the vault server. Check your connection and try again. If you run this app, your free Supabase project may be paused: restore it from the Supabase dashboard."
- Only `unlocked` renders the navigation, list and pages. Every other state is a full-screen panel centred on the page.

### 6.6 First-time setup (`SetupWizard`)

These are three real steps, so a step indicator (1, 2, 3) is appropriate here.

1. **Create your master password.** A short explanation (3.1). Master password + confirm, with a live strength meter. Requirements: at least 12 characters, rated Strong or better, not equal to the email. "Suggest a passphrase" fills the field with 6 random words from the wordlist, joined by hyphens, with one word capitalised and one digit appended, and reveals it. Checkbox: "I understand nobody can reset my master password." Button "Continue": run Argon2id with the dial in its `working` state and keep the master KEK in component state.
2. **Save your Recovery Key.** Generate the vault key and the Recovery Key, produce both wraps, and round-trip both (3.2). Show the key large, in monospace groups of 4, with "Copy", "Download Emergency Kit" and "Print". To continue, the user types the key's last 4 characters ("Type the last 4 characters to confirm you saved it"). Button "Create vault" inserts the `vault_keys` row, then unlocks the store with a non-extractable copy of the vault key (unwrap your own wrapped key with `extractable: false`).
3. **Done.** The dial plays `success`, then "Your vault is ready" with buttons "Add your first login" and "Import from your browser".

If the tab closes before step 2 finishes, nothing was saved and setup simply starts again.

Emergency Kit (a `.txt` download, and a print-only section shown through `@media print` and `window.print()`). Use `APP_NAME` in upper case for the first line, the site URL from `NEXT_PUBLIC_SITE_URL` or `window.location.origin`, and `Intl.DateTimeFormat` for the date:

```text
TIJORI EMERGENCY KIT
Keep this somewhere safe and offline. With this kit and access to your
account, anyone can open your vault.

Website:       https://your-app.vercel.app
Account email: you@example.com
Recovery Key:  XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
Created:       25 October 2026

Master password (optional, write it by hand): ____________________________

Forgot your master password? Sign in, choose "Use recovery key" on the
unlock screen, enter the key above, and choose a new master password.
```

### 6.7 Unlock (`UnlockScreen`)

- The dial, the heading "Unlock your vault", "Signed in as {email}", a master password field (autofocus; show "Caps Lock is on" using `event.getModifierState('CapsLock')`) and the button "Unlock".
- On submit: set the dial to `working`; wait two `requestAnimationFrame`s; check the stored KDF parameters against `KDF_MINIMUMS`; derive the KEK; `unwrapKey` (non-extractable). On success: dial `success` (about 450 ms), then fetch all item rows (paged), decrypt in batches of 50, and call `unlockSession(...)`. On failure: dial `error`, the message "That master password didn't open the vault. Check Caps Lock and try again.", and throttling (3.7).
- Secondary actions: "Unlock with fingerprint or face" (shown first, only if quick unlock is set up on this device and supported, 8.10), "Use recovery key" (6.8) and "Sign out". Under a "Can't unlock at all?" disclosure: "Reset vault".
- Items that fail to decrypt or validate stay out of the list and are counted: show a dismissible notice like "1 item couldn't be read." and don't block the rest.

### 6.8 Recovery and reset

- **Use recovery key**: an input that accepts any spacing or case → decode (3.2) → derive the recovery KEK → `unwrapKey` as extractable. On failure: "That recovery key didn't work. Check for typos." On success: choose a new master password (setup rules), new salt, new KEK, wrap, round-trip, then update `vault_keys` (`wrapped_key`, `wrapped_key_iv`, all `kdf_*` columns and `key_version + 1`, filtered on the current `key_version`). Unlock, then suggest "Create a new Recovery Key" with a link to Settings.
- **Reset vault** (for someone who lost both): explain that every item will be deleted permanently and can't be recovered; require typing `RESET`; delete this user's `vault_items`, then `vault_passkeys`, then `vault_keys`; return to setup. The account itself stays.

### 6.9 Lock, sign out and other tabs

- `lock()` clears the store and posts `{ type: 'lock' }` on BroadcastChannel `tijori-session`; other tabs lock when they receive it.
- Sign out: `lock('signout')`, `supabase.auth.signOut()`, post `{ type: 'signout' }`, then `router.replace('/')`. Tabs that receive `signout` lock and go to `/login`.
- `supabase.auth.onAuthStateChange`: on `SIGNED_OUT`, lock and go to `/login`; if a session for a different user appears, lock.
- Auto-lock (`lib/vault/auto-lock.ts`): record the time of the last pointer, key, touch or scroll event; check every 15 seconds; when the page becomes visible again, lock if it was hidden for longer than the timeout.

---

## 7. The vault

### 7.1 Item types (`lib/vault/types.ts`)

```ts
export type ItemType = 'login' | 'card' | 'note'
export type CategoryId =
  | 'personal' | 'work' | 'finance' | 'social' | 'shopping'
  | 'email' | 'entertainment' | 'developer' | 'government' | 'other'

interface ItemBase {
  v: 1
  type: ItemType
  title: string        // 1–200 characters
  notes?: string       // up to 20 000 characters
  category?: CategoryId
  tags?: string[]      // up to 20 tags of up to 32 characters
  favorite?: boolean
  createdAt: string    // ISO 8601
  updatedAt: string
}

export interface LoginItem extends ItemBase {
  type: 'login'
  url?: string         // up to 2048, normalized to https://…
  username?: string    // up to 500
  password?: string    // up to 1000
  totp?: string        // base32 secret or otpauth:// URI
  passwordUpdatedAt?: string
  passwordHistory?: { value: string; changedAt: string }[]    // newest first, max 10
  fields?: { label: string; value: string; hidden: boolean }[] // up to 20
}

export interface CardItem extends ItemBase {
  type: 'card'
  cardholder?: string
  number?: string      // digits only
  expMonth?: string    // '01'–'12'
  expYear?: string     // 'YYYY'
  cvv?: string
  pin?: string
}

export interface NoteItem extends ItemBase {
  type: 'note'
}

export type ItemPayload = LoginItem | CardItem | NoteItem
```

Validate every decrypted payload with a hand-written type guard. Enforce the length limits in the form and again before encrypting.

### 7.2 List, search, filter and sort

- A search box at the top ("Search vault"; `/` focuses it on desktop). It matches title, website host, username, tags and a card's last 4 digits, ignoring case and accents (normalize to NFD and strip combining marks). Rank: title starts with the query, then title contains it, then host, username, tags. Highlight the matching part of the title. Debounce 80 ms.
- Filters: All items, Favourites, Logins, Cards, Notes, then the categories that have items, then tags. Desktop: in the navigation rail. Mobile: a sideways-scrolling chip row under the search box.
- Sort: Recently updated (default), Name A–Z, Recently added.
- Each row: monogram, title, a second line (username for logins, `•••• 4242` for cards, "Secure note" for notes), a favourite star, and a copy-password button for logins. Rows are separated by hairlines, not drawn as cards. Show the item count.
- On mobile, keep the scroll position when coming back from an item.
- Deep links: `?item=<id>` opens an item and `?new=login|card|note` opens the form (the PWA shortcuts use this). Using URL parameters gives the phone's back button the expected behaviour.

### 7.3 Item detail

- Header: monogram, title, the site's host as a link (validated, opens in a new tab), a favourite toggle, "Edit", and a menu with "Delete".
- Username in plain text with a copy button.
- Password: always masked at a fixed length (`••••••••••••`, never the real length). Reveal shows it in `SecretText` (monospace; digits in `--safe`, symbols in `--warn`). Copy button with the countdown ring, a strength badge, and "Changed 3 months ago" via `Intl.RelativeTimeFormat`.
- 2FA code: a live `TotpCode` (8.4).
- Notes: hidden behind "Show notes" for every item type, because notes often hold secrets.
- Cards: number masked except the last 4 digits, with copy; expiry; cardholder; CVV and PIN masked with reveal and copy.
- Custom fields: hidden ones are masked with reveal and copy.
- Password history (collapsed by default): previous passwords masked, with dates, reveal and copy.
- Footer: "Added {date}" and "Updated {date}".

### 7.4 Add and edit

- Desktop: the form replaces the detail pane. Mobile: a full-screen sheet.
- New items start with a type picker: Login, Card, Secure note.
- **Login**: Title (required; if it's empty when a website is entered, use the host without `www.`), Website, Username or email, Password (show/hide; "Generate" opens the generator inline; strength meter), 2FA setup key (optional, "Paste the setup key or otpauth link"; validate it by generating a code), Category, Tags, Favourite, Notes, Custom fields.
- Website handling: trim it; add `https://` if there's no scheme; accept only http and https; error "Enter a web address like example.com".
- **Card**: Title, Cardholder, Number (shown in groups while typing, stored as digits; a failed Luhn check shows a warning, not an error; a brand label from the prefix: Visa, Mastercard, American Express, RuPay or Discover), Expiry MM/YY, CVV, PIN, Notes.
- **Secure note**: Title and a multi-line Notes field.
- Changing a login's password pushes the old one onto `passwordHistory` (max 10) and sets `passwordUpdatedAt`.
- Ctrl/⌘+Enter saves; Esc cancels (ask before discarding unsaved changes).
- Button labels match the toasts: "Save login" → "Login saved", "Save card" → "Card saved", "Save note" → "Note saved".
- While saving, disable the button and show progress. On error, keep the form and show the message.

### 7.5 Delete and undo

Confirm in a dialog: "Delete "{title}"? You can undo this for a few seconds." After deleting, show a toast with "Undo" for 8 seconds. Undo re-inserts the same `id`, `ciphertext`, `iv` and `enc_version`, so nothing is re-encrypted.

### 7.6 Sync and errors

- Refetch rows when the window regains focus or becomes visible, if the last sync was more than 30 seconds ago, and offer "Refresh" in the menu. Merge by `id` and `updated_at`, decrypting only rows that changed.
- Optimistic updates, rolled back on error.
- Offline: a slim banner ("You're offline. Changes can't be saved until you reconnect.") and saving is disabled.
- If Supabase reports an expired or invalid session, lock and go to `/login?next=/vault`.
- Two devices editing the same item: the last save wins (documented in SECURITY.md).

### 7.7 Empty states

- Empty vault: "Your vault is empty. Add your first login, or import passwords from your browser." Buttons "Add login" and "Import from browser".
- No search results: "Nothing matches "{query}"." Buttons "Clear search" and "Add "{query}" as a login".
- No favourites: "No favourites yet. Star an item to keep it here."

---

## 8. More features

### 8.1 Password generator (`components/generator/password-generator.tsx`)

Used on the public `/generator` page, at `/vault/generator`, and inline in the item form (an `onUse(password)` prop adds a "Use password" button).
- **Random**: length slider 8–128 (default 20) with a number input; toggles for A–Z, a–z, 0–9 and symbols (`!@#$%^&*()-_=+[]{};:,.?/~`); "Avoid look-alikes" removes `I l 1 O 0 o |`; at least one set must stay on. Guarantee one character from each chosen set, choose characters by rejection sampling on `crypto.getRandomValues(new Uint32Array(n))` (no modulo bias), then shuffle with Fisher–Yates using the same randomness.
- **Passphrase**: 3–12 words (default 6), separator (`-`, `.`, `_` or space), capitalise words, add a digit. The wordlist lives in `lib/password/wordlist.ts`: at least 1,200 distinct, common, lowercase English words of 3–8 letters, nothing offensive. Deduplicate with a `Set` when the module loads and compute entropy from the deduplicated count. Load it with dynamic `import()`.
- Show the result large in `SecretText`, with entropy in bits, the strength label, "Regenerate" and "Copy". Keep the last 5 results in memory only, cleared on lock.

### 8.2 Strength estimator (`lib/password/strength.ts`, no dependencies)

- Base entropy = length × log2(the size of the character pool actually used).
- Penalties: an exact match in `common-passwords.ts` (about 200 of the most common passwords) means score 0; a common password making up most of it; keyboard runs (`qwerty`, `asdf`, `zxcv`, `1234`, `abcd`, forwards or backwards); repeated characters; years from 1900 to 2099 and dates; containing the email name, username or site name; a single character class under 12 characters.
- Score 0–4 after penalties: under 28 bits "Very weak", under 36 "Weak", under 60 "Fair", under 80 "Strong", otherwise "Excellent".
- Returns `{ score, label, entropyBits, crackTime, warnings }`. `crackTime` assumes 10^10 guesses per second and is phrased in words ("about 3 years", "centuries").
- For generated passwords, use the generator's exact entropy instead.
- `StrengthMeter` shows 5 segments plus the label and the first warning. Colour is never the only signal.

### 8.3 Vault health (`/vault/health`)

- Computed in memory from logins that have a password: weak (score 2 or less), reused (the same password on 2 or more items, shown in groups), old (unchanged for 365 days or more, using `passwordUpdatedAt` or else `createdAt`), and breached (only after a scan).
- Score = round(100 × logins with no issues ÷ logins with a password), shown as an SVG ring gauge with counts for each issue. Every issue opens the item in edit mode with the password field focused and the generator ready.
- "Check for breaches" (`lib/password/hibp.ts`): for each unique password, compute SHA-1 as uppercase hex and request `https://api.pwnedpasswords.com/range/{first 5 characters}` with the header `Add-Padding: true` (if that request throws, retry once without the header). Parse the `SUFFIX:COUNT` lines and ignore counts of 0 (padding). Run 4 requests at a time, cache by prefix in memory, show progress and a Cancel button. Results live in memory only.
- Under the button: "Only the first 5 characters of a scrambled fingerprint of each password are sent to Have I Been Pwned. Your passwords never leave this device."

### 8.4 2FA codes (`lib/totp.ts`)

- Accept a base32 secret (spaces allowed) or an `otpauth://totp/…` URI: `secret`; `algorithm` SHA1, SHA256 or SHA512 (default SHA1); `digits` 6 or 8 (default 6); `period` (default 30).
- RFC 6238 with Web Crypto HMAC: an 8-byte big-endian counter, dynamic truncation, zero padding.
- `TotpCode` shows the code as two groups (`123 456`) with a countdown ring and a copy button. Use one interval per component and pause while the page is hidden.
- Development-only self-test (`process.env.NODE_ENV === 'development'`): SHA-1, ASCII secret `12345678901234567890`, time 59 seconds, 8 digits must give `94287082`; `console.warn` if it doesn't.

### 8.5 Import (Settings → Data, and the empty vault)

A dialog with two tabs.

**From a browser or another app (CSV).** File picker or paste. A hand-written RFC 4180 parser handles quoted fields, escaped quotes, newlines inside quotes, CRLF and a UTF-8 byte-order mark. Map headers ignoring case:

| Field | Header names |
|---|---|
| title | name, title, account, website name |
| url | url, login_uri, website, web site, login url, origin |
| username | username, login_username, user name, user, email, login |
| password | password, login_password, pass |
| notes | note, notes, extra, comments |
| totp | totp, login_totp, otp, otpauth |
| category | folder, grouping, category (known names map to a `CategoryId`; others become a tag) |

This covers exports from Chrome, Edge, Firefox, Safari, Bitwarden, LastPass and 1Password. Skip rows with neither a username nor a password and say how many were skipped. Preview the total and the first 10 rows with passwords masked. Skip duplicates (same host, username and password as an existing item) by default, with a toggle. Encrypt each item (3.4) and insert in batches of 100 with a progress bar. Afterwards: "Done. Delete the CSV file from your device now; it contains your passwords in plain text." Include short disclosures explaining how to export from Chrome, Edge, Firefox and Safari.

**Tijori backup.** Pick the file, enter its backup password, decrypt (8.6), preview, then import with new ids, re-encrypted under this vault's key.

### 8.6 Export and backup (Settings → Data)

- **Encrypted backup** (recommended): a backup password (at least 12 characters, confirmed) → Argon2id with a fresh salt and `KDF_DEFAULTS` → AES-GCM over the JSON array of payloads with AAD `${CRYPTO_PROTOCOL}:backup`. File name `tijori-backup-YYYY-MM-DD.json`:

```json
{
  "format": "tijori-backup",
  "version": 1,
  "createdAt": "2026-10-25T10:00:00.000Z",
  "itemCount": 42,
  "kdf": { "algorithm": "argon2id", "salt": "…", "memoryKiB": 65536, "iterations": 3, "parallelism": 1 },
  "iv": "…",
  "ciphertext": "…"
}
```

- **Plain CSV** (for moving to another password manager): requires re-entering the master password and ticking "I understand this file is not encrypted". Use Bitwarden-compatible columns `folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp` for logins and notes. Cards are only included in encrypted backups; say so in the dialog.
- Downloads use a `Blob`, an object URL and a temporary `<a download>`; revoke the URL afterwards.

### 8.7 Settings (`/vault/settings`)

Sections in this order:

1. **Security**: auto-lock time, clipboard clearing, privacy screen, "Lock now".
2. **Master password**: change it (current, new, confirm; setup rules apply). Flow: derive the old KEK → unwrap as extractable → new salt → new KEK → wrap → round-trip → update with the `key_version` check. Quick unlock keeps working because the vault key doesn't change.
3. **Recovery Key**: "Create a new Recovery Key" (master password required) → new key, wrap, round-trip, update `recovery_wrapped_key` and its IV → show the new Emergency Kit. The old key stops working.
4. **Quick unlock** (8.10), only where supported.
5. **Two-factor sign-in** (8.8).
6. **Data**: import, encrypted backup, CSV export, and "See what the server stores", which shows up to 5 raw rows exactly as stored (id, iv, the first 64 characters of ciphertext, timestamps). It builds trust.
7. **Appearance**: System, Light, Dark.
8. **Account**: the email; "Change sign-in password" (verify the current one with `signInWithPassword`, then `updateUser({ password })`); "Sign out"; "Sign out everywhere" (`signOut({ scope: 'global' })`).
9. **Install app**, hidden when already installed (`display-mode: standalone`, or `navigator.standalone` on iOS).
10. **Danger zone**: "Delete all items" (type DELETE). "Delete account" (master password, then type DELETE): delete items, passkeys and keyset, call `supabase.rpc('delete_my_account')`, sign out, and show the landing page with a toast. If the RPC fails, say: "Your vault data is erased. Your sign-in couldn't be removed automatically; the app owner can remove it in Supabase."

Preferences live in localStorage under `tijori-settings` (`{ autoLockMinutes, clipboardSeconds, privacyScreen }`, validated when read). The theme lives in the `tijori-theme` cookie (section 9).

### 8.8 Two-factor sign-in (Supabase MFA)

- Status: Off, or On (authenticator app).
- Turn on: first unenroll any unverified TOTP factors; then `supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName })`, where `friendlyName` is "Authenticator" followed by the current ISO date and time (it must be unique). Show `data.totp.qr_code` (an SVG data URL, rendered with `<img>`) and `data.totp.secret` (monospace, with copy) for manual entry. Ask for the 6-digit code and call `mfa.challengeAndVerify({ factorId, code })`. Toast: "Two-factor sign-in is on".
- Turn off: needs an aal2 session; `mfa.unenroll({ factorId })`.
- `MfaChallenge`: a 6-digit input (`inputMode="numeric"`, `autoComplete="one-time-code"`, `pattern="[0-9]*"`) that submits automatically when complete. It uses the first verified TOTP factor from `mfa.listFactors()`. Error: "That code didn't work. Codes change every 30 seconds." Also a "Sign out" link.
- RLS refuses vault data to aal1 sessions of users who have 2FA on (section 4), so a stolen account password alone can't download even the ciphertext.

### 8.9 Command palette and shortcuts (desktop)

- Ctrl/⌘+K opens a palette in a native `<dialog>`: search items and actions (Add login, Add card, Add note, Generate password, Vault health, Settings, Lock vault, Switch theme). Arrow keys move and Enter runs. On an item, Enter opens it and Ctrl/⌘+Enter copies its password.
- Also: `/` focuses search, `N` adds a login (only when focus isn't in a text field), Ctrl/⌘+Shift+L locks, Esc closes sheets and dialogs, and `?` opens a "Keyboard shortcuts" dialog.

### 8.10 Quick unlock with a passkey (build this last)

Fingerprint or face unlock through the WebAuthn PRF extension. It never replaces the master password, and when unsupported it must not affect anything else.

- Show it only when `window.PublicKeyCredential` exists. Use `PublicKeyCredential.getClientCapabilities?.()` and its `'extension:prf'` entry when available; otherwise attempt enrolment and handle `prf.enabled !== true` with "This device doesn't support quick unlock."
- **Enable** (Settings → Quick unlock → "Set up on this device"): ask for the master password, unwrap the vault key as extractable, then create a credential with a fresh 32-byte `prfSalt`:

```ts
const credential = await navigator.credentials.create({
  publicKey: {
    rp: { name: APP_NAME, id: location.hostname },
    user: { id: randomBytes(16), name: email, displayName: email },
    challenge: randomBytes(32),
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },   // ES256
      { type: 'public-key', alg: -257 }, // RS256
    ],
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
    timeout: 60_000,
    extensions: { prf: { eval: { first: prfSalt } } },
  },
})
```

- Read `credential.getClientExtensionResults().prf`. If `results.first` is missing (many platforms only return it during sign-in), immediately call `navigator.credentials.get` with `allowCredentials: [{ type: 'public-key', id: rawId }]`, `userVerification: 'required'` and the same `prf.eval.first`.
- KEK = HKDF-SHA-256 over the 32-byte PRF output, info `${CRYPTO_PROTOCOL}:passkey-kek`. Wrap the vault key with AAD `${CRYPTO_PROTOCOL}:passkey-vault-key:${userId}:${credentialIdBase64url}`, round-trip, and insert into `vault_passkeys` with a label the user types ("My phone").
- **Unlock**: load this user's `vault_passkeys`, call `navigator.credentials.get` with all their credential ids in `allowCredentials`, `userVerification: 'required'`, and `extensions.prf.evalByCredential` mapping each base64url credential id to `{ first: salt }`. Match the returned `rawId` to its row, derive, unwrap as non-extractable, and update `last_used_at`.
- Settings lists enrolled devices (label, date added, last used) with "Remove".
- Comment in the code: the challenge isn't checked by a server, which is fine here because the security comes from the PRF output, which only the authenticator can produce after user verification.
- If `lib.dom` lacks the PRF types, declare small local interfaces and cast through `unknown`.

### 8.11 PWA

- `app/manifest.ts`: name `${APP_NAME} Password Vault`, short_name `APP_NAME`, a description, `start_url: '/vault'`, `scope: '/'`, `display: 'standalone'`, `background_color` and `theme_color` from the tokens, icons `/pwa/icon-192.png` (192×192), `/pwa/icon-512.png` (512×512) and `/pwa/maskable-512.png` (512×512, `purpose: 'maskable'`), shortcuts "Add login" → `/vault?new=login` and "Generator" → `/vault/generator`, categories `['security', 'productivity']`.
- Icons are generated in code. `lib/brand/app-icon.tsx` exports `renderAppIcon(size: number, opts?: { maskable?: boolean })`, which returns `new ImageResponse(...)` from `next/og`, drawing the dial-and-keyhole mark with plain shapes and no text, so no fonts are needed. Maskable icons keep the mark inside the central 80% on a full-bleed `--safe` background. Each route handler (`app/pwa/icon-192.png/route.tsx` and the other two) exports `export const dynamic = 'force-static'` and a `GET` that returns `renderAppIcon(...)`. Also `app/apple-icon.tsx` (180×180 with `size` and `contentType` exports) and `app/opengraph-image.tsx` (1200×630 with the name and tagline, plus an `alt` export). `app/icon.svg` is the hand-written favicon.
- `public/sw.js` (plain JavaScript, cache name with a version constant): on install, cache `/offline.html` and call `skipWaiting()`; on activate, delete old caches and call `clients.claim()`; on fetch, ignore non-GET requests and other origins (never touch Supabase or HIBP traffic), serve `/_next/static/` cache-first, and handle navigations network-only with `/offline.html` as the fallback. Never cache HTML pages or API responses.
- `public/offline.html`: self-contained (inline CSS, no scripts), in the app's colours: "You're offline. Your vault needs a connection. Reconnect and try again."
- `components/pwa/register-sw.tsx` (client, rendered in the root layout) registers `/sw.js` after the `load` event, in production only.
- Install prompt: capture `beforeinstallprompt` and offer "Install app" in Settings and in a dismissible banner after the first unlock. On iOS Safari, show "Tap Share, then Add to Home Screen". Remember a dismissal in localStorage.
- Root metadata: `appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: 'black-translucent' }`; `robots` set to noindex for `/vault`. A `viewport` export with `width: 'device-width'`, `initialScale: 1`, `viewportFit: 'cover'` and `themeColor` for light and dark.

### 8.12 Landing page (`/`)

- Header: the logo mark and name; links "How it works" (anchor), "Password generator" and "Sign in"; the primary button "Create your vault". Signed-in visitors see "Open vault" instead.
- Hero, left-aligned. Headline: "A safe for every password you own." Subhead: "Tijori encrypts your logins on your device before anything is saved. Our servers only hold scrambled data they can't read. Your master password is the only key." Buttons "Create your vault" and "Sign in".
- Beside the text (below it on mobile), the page's signature element: a live cipher demo. A field "Type any password" (prefilled with a sample) and a panel "What we store" showing real AES-GCM ciphertext and IV produced in the browser on every keystroke (demo key made with Web Crypto on mount, a fresh IV each time, debounced 80 ms; ciphertext in monospace, wrapping). Small print: "This demo runs in your browser. Nothing you type here is sent anywhere."
- "How your vault is sealed", a real sequence, so numbered: 1) You type your master password on your device. 2) Argon2id stretches it into a key; that's the dial you'll see turning. 3) AES-256-GCM locks every entry with a key only you can open. 4) We store the locked result. Nothing else.
- "What you get": a two-column list (not a card grid), each line with an icon: encrypted on your device; works on phone and computer and installs like an app; password generator; vault health with breach checks; 2FA codes; import from Chrome, Edge, Firefox, Safari and Bitwarden; auto-lock and clipboard clearing; free and open source.
- "Questions" using `<details>`: Can you see my passwords? What if I forget my master password? What if I lose my phone? Is it really free? Where is my data stored?
- Footer: Privacy, Security, Password generator, and the repository link as text (only when `REPO_URL` is set).
- A skip link to the main content. No scroll-triggered animations.

### 8.13 Other pages

- `/generator`: the public generator with a short explanation and a quiet link to sign up ("Keep your passwords in a vault").
- `/security`: a plain-language version of SECURITY.md: what's encrypted and with what, what the server sees, and what happens if you forget your master password.
- `/privacy`: what is stored (email, encrypted rows, timestamps), what isn't (anything readable), no tracking, and how to delete your account.
- `not-found.tsx`, `error.tsx` (a client component with "Try again") and `global-error.tsx`.

---

## 9. HTTP security headers and CSP

`lib/security/csp.ts`:

```ts
import { SUPABASE_URL } from '@/lib/env'

export function buildContentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development'
  let supabaseOrigin = ''
  try {
    if (SUPABASE_URL) supabaseOrigin = new URL(SUPABASE_URL).origin
  } catch {
    supabaseOrigin = ''
  }
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    ['connect-src', "'self'", supabaseOrigin, 'https://api.pwnedpasswords.com'].filter(Boolean).join(' '),
    "worker-src 'self'",
    "manifest-src 'self'",
    "media-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ]
  if (!isDev) directives.push('upgrade-insecure-requests')
  return directives.join('; ')
}
```

- `'wasm-unsafe-eval'` is required for Argon2id (WebAssembly).
- `'unsafe-inline'` for styles is acceptable because images, fonts and network requests are locked to known origins, which blocks CSS-based data exfiltration. Scripts stay nonce-only.
- `img-src data:` is needed for the 2FA QR code that Supabase returns.

Static headers, set in `next.config.ts` for `/:path*`:

| Header | Value |
|---|---|
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` |
| X-Content-Type-Options | `nosniff` |
| X-Frame-Options | `DENY` |
| Referrer-Policy | `no-referrer` |
| Permissions-Policy | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), hid=(), midi=(), magnetometer=(), gyroscope=(), accelerometer=(), browsing-topics=()` (don't block clipboard or publickey-credentials; the app needs them) |
| Cross-Origin-Opener-Policy | `same-origin` |
| Cross-Origin-Resource-Policy | `same-origin` |
| X-DNS-Prefetch-Control | `off` |
| X-Permitted-Cross-Domain-Policies | `none` |

- A nonce-based CSP requires every page to be rendered per request. The root layout reads `await cookies()` for the theme, which makes all pages dynamic. Don't add anything that forces pages to be static.
- Theme: the `tijori-theme` cookie (`light`, `dark` or `system`) is read in the root layout and written to `data-theme` on `<html>` (left off for `system`). The toggle writes the cookie (`path=/; max-age=31536000; samesite=lax`, plus `secure` on https) and updates the attribute directly. No inline theme script is needed.
- The proxy marks `/vault` responses `private, no-store`.

---

## 10. Visual design

Concept: **a modern steel tijori.** Painted-steel greens, enamel off-white and brass hardware. The interface is calm and disciplined; the one bold moment is the combination dial that turns while the key is derived and the bolts that slide back when the vault opens. Everything else stays quiet.

Avoid the tells of generic generated UI: cream with terracotta, acid green on black, identical rounded cards with soft grey shadows, gradient washes, ALL-CAPS eyebrow labels above headings, "A · B · C" meta strings, "→" appended to buttons, emoji in the interface, and headlines with one highlighted word.

### 10.1 Colour tokens

CSS variables on `:root`. Dark values apply under `[data-theme="dark"]`, and under `@media (prefers-color-scheme: dark)` when no `data-theme` is set. Set `color-scheme` to match. Map the variables to Tailwind with `@theme inline` (`--color-bg: var(--bg);` and so on), so components rarely need `dark:` classes.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#E8ECE4` | `#0F1513` | page background |
| `--surface` | `#F5F7F2` | `#161E1B` | panels, list, inputs |
| `--surface-2` | `#DCE2D8` | `#1F2925` | hover, selected row, chips |
| `--ink` | `#17201C` | `#E5EAE4` | primary text |
| `--ink-muted` | `#55625A` | `#97A49C` | secondary text |
| `--line` | `#C3CCC1` | `#2B3732` | hairlines, borders |
| `--safe` | `#2E4A3F` | `#79A893` | brand, links, primary button in light mode |
| `--brass` | `#A8771F` | `#D6A54E` | dial index, focus ring, primary button in dark mode; never body text on light |
| `--danger` | `#B13A2B` | `#E7705B` | destructive actions, breached |
| `--ok` | `#2C7656` | `#62C49A` | strong, verified |
| `--warn` | `#8A5E00` | `#E0B04A` | weak, old, symbols inside passwords |

- Primary button: light mode uses a `--safe` background with `#F5F7F2` text; dark mode uses a `--brass` background with `#0F1513` text.
- Focus: a 2 px `--brass` outline with a 2 px offset on every interactive element.
- These pairs meet WCAG AA contrast; keep it that way if you adjust anything.

### 10.2 Type

- **Archivo** (next/font/google, `axes: ['wdth']`, CSS variable `--font-archivo`) for everything. Headings use the expanded width (`font-stretch` between 112% and 125%, weight 600–700, tracking −0.01em), like the engraved maker's plates on old safes. Body copy stays at normal width, weight 400 or 500.
- **JetBrains Mono** (CSS variable `--font-mono-secret`, `preload: false`) only for secrets: passwords, Recovery Keys, 2FA codes and ciphertext. Never for labels.
- Scale in px: 12, 14, 16, 18, 21, 24, 30, 36, 48, 60. Body 16 px with line-height 1.55; UI labels 14 px; headings with line-height 1.1–1.2; line length under 70 characters; inputs at least 16 px on mobile (prevents iOS zoom). Use `font-variant-numeric: tabular-nums` for codes, timers and counts.

### 10.3 Shape and depth

Radius by role: 6 px for inputs and rows, 8 px for buttons, 14 px for panels, sheets and dialogs, 10 px for monograms, full pills only for tags. Resting surfaces have no shadows; rows are separated by 1 px `--line` hairlines. Only overlays (dialog, sheet, palette, toast) get one deep, soft shadow.

### 10.4 The dial (`components/brand/dial.tsx`)

- 220 px wide (180 px on screens under 380 px). Layers: a static base ring; a rotating `<div>` holding the dial face SVG (60 ticks with every 5th longer, numerals 0–50 every 10 ticks in Archivo with tabular figures, a brushed-metal knob made with a `conic-gradient`, and a keyhole in the centre); a static brass index marker at 12 o'clock; three short rounded bolts on the right edge.
- `state` prop: `idle`; `working` (keyframes that turn like dialling a combination: about 1¼ turns right, ¾ back, ½ right, looping every 2.4 s with ease-in-out); `success` (settles to 0°, then the bolts slide out with a 60 ms stagger over 450 ms); `error` (the whole dial shakes sideways for 300 ms).
- Animate only `transform` and `opacity`, and animate the wrapping `<div>` rather than SVG children, so the browser runs the animation on the compositor and it keeps turning while Argon2id blocks the main thread.
- With `prefers-reduced-motion`: no rotation or shake, status text only.
- An `aria-live="polite"` line below the dial: "Opening your vault…", "Unlocked", "Wrong master password".
- `components/brand/logo.tsx` is a static, simplified dial (ring, 12 ticks, keyhole). `app/icon.svg` uses the same mark.

### 10.5 Monograms

40 px tiles (10 px radius) showing the first letter of the site name or title in expanded Archivo 600, on one of 8 muted enamel colours chosen by hashing the host: `#3E5C50`, `#5B4A3A`, `#4A5568`, `#6B4E5E`, `#3F5E73`, `#6A6A3E`, `#5E3F3F`, `#44606A`, with `#F5F7F2` text. Never fetch favicons.

### 10.6 Layout

Desktop, 1024 px and wider:

```text
+------------+----------------------+---------------------------------+
| Tijori     | [ Search vault     ] | [G] Gmail             * Edit    |
|            |----------------------| mail.google.com                 |
| All items  | [G] Gmail            | Username  you@gmail.com   Copy  |
| Favourites |     you@gmail.com    | Password  ********  Show  Copy  |
| Logins     | [A] Amazon           | 2FA code  123 456  (o)    Copy  |
| Cards      |     you@mail.com     | Notes     Show notes            |
| Notes      | [V] Visa card        |                                 |
|------------|     **** 4242        | Added 2 Mar, updated 3 days ago |
| Health     |                      |                                 |
| Generator  |                      |                                 |
| Settings   |                      |                                 |
| Lock       |                      |                                 |
+------------+----------------------+---------------------------------+
  nav 232 px    list 380 px           detail fills the rest
```

Mobile, under 768 px (the chips scroll sideways, [ + ] adds an item, the last row is the bottom tab bar):

```text
+----------------------------------+
| Tijori                      Lock |
| [ Search vault                 ] |
| All  Favourites  Logins  Cards   |
|----------------------------------|
| [G] Gmail                   Copy |
|     you@gmail.com                |
|----------------------------------|
| [A] Amazon                  Copy |
|     you@mail.com                 |
|                            [ + ] |
|----------------------------------|
| Vault Generator Health Settings  |
+----------------------------------+
```

- Tablet, 768–1023 px: a 72 px icon rail, the list, and the detail as a sheet from the right.
- Mobile: detail and forms open as full-screen sheets with a back button (the browser's back button closes them too, through the URL parameters in 7.2); a bottom tab bar (Vault, Generator, Health, Settings) padded with `env(safe-area-inset-bottom)`; a floating Add button above it.
- Left-align everything except the setup, unlock and recovery screens, which centre on the dial.

### 10.7 Motion

Only motion that answers an action: sheets sliding in, the copy check and countdown ring, reveal, toasts appearing. The dial is the one orchestrated moment. The landing page has at most one subtle entrance (the demo panel). Respect `prefers-reduced-motion` everywhere.

### 10.8 Words

Plain English, sentence case, active verbs. A button says exactly what happens ("Save login", "Unlock", "Create vault"), and the toast repeats it ("Login saved"). Errors say what happened and how to fix it, without apologising. Empty screens invite the next action. Call things what people call them: "sign-in password", "master password", "Recovery Key", "2FA code".

---

## 11. Responsive and accessible

- Works from 320 px to 2560 px wide; check layouts at 360, 768, 1024 and 1440 px.
- Touch targets at least 44 × 44 px, with space between them.
- `viewport-fit=cover`, with safe-area insets for the top bar, bottom tabs and floating button.
- Every input has a visible label; errors are linked with `aria-describedby`; toasts and copy confirmations use `aria-live="polite"`.
- Dialogs use native `<dialog>` with `showModal()` (which traps focus), close on Esc, and return focus to whatever opened them.
- Everything works with the keyboard alone, focus is always visible, and the landing page has a skip link.
- Colour is never the only signal (the strength meter and health page also use text).
- `lang="en"`, semantic landmarks (`header`, `nav`, `main`) and headings in order.
- Both themes meet WCAG AA contrast.

---

## 12. Performance budget

- Lighthouse (mobile) targets: Performance 95 or higher, Accessibility 100, Best Practices 100, SEO 90 or higher on the landing page.
- First-load JavaScript (gzipped): `/` at most 120 KB; `/vault` at most 180 KB before lazy chunks.
- Load these with dynamic `import()` only when needed: hash-wasm, the wordlist, CSV import, backup export and import, HIBP, TOTP, the command palette and quick unlock.
- No raster images, only inline SVG. Fonts are self-hosted by next/font with `display: 'swap'`; only Archivo is preloaded.
- Keep the root layout light: providers that only the vault needs live under `app/vault/`.
- Decrypt in batches of 50 with `Promise.all`, memoise derived lists, and use `content-visibility: auto` on long lists instead of a virtualisation library.
- No libraries for state, forms, dates, animation or class merging: React, `Intl`, CSS transitions and a 5-line `cn()` helper are enough.

---

## 13. Pitfalls that break builds

### 13.1 Next.js 16

- Proxy, not Middleware: `proxy.ts` exports `proxy` and `config`. No `middleware.ts`, no `runtime` export.
- `cookies()` and `headers()` are async. Page and layout `params` and `searchParams` are Promises, and so are route handler `params`.
- Don't enable `cacheComponents`, PPR, `'use cache'` or any `experimental` option.
- `redirect()` from `next/navigation` throws on purpose; never call it inside `try/catch`.
- A client component that calls `useSearchParams()` must be wrapped in `<Suspense>` by its parent.
- `metadata` and `viewport` are separate exports; `themeColor` and `viewportFit` belong in `viewport`.
- Don't use `next/image`, `next/script` for third parties, or `import 'server-only'` (it isn't a dependency here).
- next/font: `Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-archivo', display: 'swap' })` (don't pass `weight` together with `axes`) and `JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono-secret', display: 'swap', preload: false })`. Put both `.variable` class names on `<html>`.
- Linting isn't part of `next build` in v16, so don't add ESLint config or packages.
- Server Components can't pass functions to Client Components; keep props serialisable.
- Never touch `window`, `document`, `localStorage`, `navigator` or `crypto.subtle` at module top level or while rendering on the server; use effects and event handlers.

### 13.2 React 19

- `useSyncExternalStore`: `getSnapshot` must return the same object until the data changes.
- Native `<dialog>`: call `showModal()` and `close()` from an effect driven by an `open` prop, and listen for the `close` and `cancel` events.
- `ref` is a normal prop in React 19; `forwardRef` isn't needed.

### 13.3 TypeScript 5.9 and Web Crypto

- `Uint8Array` is generic since TypeScript 5.7, and Web Crypto wants buffers backed by `ArrayBuffer`. Type every byte helper as returning `Uint8Array<ArrayBuffer>`, and copy library output with `new Uint8Array(bytes)` (hash-wasm returns a plain `Uint8Array`). `crypto.getRandomValues(new Uint8Array(n))` is already fine.
- Base64: don't spread big arrays into `String.fromCharCode(...)` (stack overflow); convert in chunks of `0x8000`.
- `strict` is on: no `any` except tightly scoped casts with a comment, and handle every `null` that Supabase can return.
- If `lib.dom` lacks WebAuthn PRF types, declare local ones and cast through `unknown`.

### 13.4 Supabase

- See 6.1 and section 4: `getClaims()` on the server, 1000-row pages, `maybeSingle()` for the keyset, filters on deletes, and the difference between an RLS-empty result and an error.
- MFA enrolment fails if an unverified factor with the same friendly name exists: unenroll unverified factors first and use a unique friendly name.
- Map common auth errors to plain messages (wrong credentials, email not confirmed, rate limited, weak password, already registered).

### 13.5 Tailwind CSS v4

- `app/globals.css` starts with `@import "tailwindcss";`, then the tokens, then `@theme inline { … }` mapping colours (`--color-*`) and fonts (`--font-sans: var(--font-archivo), ui-sans-serif, system-ui, sans-serif;` and `--font-mono: var(--font-mono-secret), ui-monospace, monospace;`).
- If a `dark:` variant is ever needed: `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));`.
- Tailwind only sees complete class names in the source. Never build class names by joining strings; use lookup objects or CSS variables.

### 13.6 hash-wasm

- `const { argon2id } = await import('hash-wasm')`.
- The CSP must include `'wasm-unsafe-eval'` or Argon2id won't load.
- Wait two animation frames before calling it so the dial starts turning first.

### 13.7 lucide-react v1: use only these verified names

`Lock, LockOpen, LockKeyhole, KeyRound, Key, Eye, EyeOff, Copy, Check, X, Plus, Search, Trash2, Pencil, Shield, ShieldCheck, ShieldAlert, Settings, LogOut, LogIn, Star, Globe, RefreshCw, RotateCw, Download, Upload, TriangleAlert, CircleAlert, CircleCheck, CircleX, Clock, Timer, Hourglass, History, CreditCard, StickyNote, WandSparkles, Sparkles, Dices, Menu, ChevronRight, ChevronLeft, ChevronDown, ArrowLeft, ArrowRight, ExternalLink, Fingerprint, ScanFace, Smartphone, Monitor, Sun, Moon, SunMoon, Tag, Filter, ArrowUpDown, Vault, QrCode, Info, CircleHelp, LayoutGrid, List, Undo2, Printer, FileDown, FileUp, Command, Keyboard, User, Mail, AtSign, Folder, FolderLock, Hash, Ellipsis, SlidersHorizontal, Gauge, Activity, Clipboard, ClipboardCheck, House, Link, LoaderCircle, Wallet, Landmark, Briefcase, ShoppingBag, Gamepad2, Code, Users, BadgeCheck`

Brand icons such as `Github` don't exist in v1; use text for the repository link.

### 13.8 Vercel

- No lockfile is committed, so Vercel resolves versions from `package.json` on every build. Keep the ranges exactly as given.
- `NEXT_PUBLIC_*` values are baked in at build time, so changing them needs a redeploy. The README must say so.

---

## 14. Documentation files

### README.md

Written for a non-developer who will never run a command. Sections:

1. What Tijori is (two sentences), with a link to SECURITY.md.
2. What you need: free GitHub, Supabase and Vercel accounts.
3. **Deploy**, step by step:
   - **A. Supabase project**: create a project on the free plan in the region closest to your users, save the database password somewhere safe, and wait until it's ready.
   - **B. Database**: SQL Editor → New query → paste all of `supabase/schema.sql` → Run. It should finish without errors.
   - **C. Authentication settings**:
     - Sign In / Providers → Email: enabled, "Confirm email" on, minimum password length 12.
     - Multi-Factor: App authenticator (TOTP) enabled.
     - URL Configuration: Site URL = your Vercel URL (update it after the first deploy). Redirect URLs: `https://YOUR-APP.vercel.app/**`.
     - Emails → Templates: paste the three templates below.
     - Emails → SMTP: Supabase's built-in sender is only meant for testing and is heavily rate-limited. For real users, connect a free SMTP provider (for example Resend's free tier). For a quick private test you can turn "Confirm email" off temporarily.
     - For private use: after creating your own account, turn off "Allow new users to sign up".
   - **D. Keys**: Project Settings → API Keys → copy the Project URL and the publishable key (or the legacy anon key).
   - **E. Vercel**: push the repository to GitHub → in Vercel, Add New → Project → import it (Next.js is detected automatically) → add the environment variables from `.env.example` → Deploy. Then put the real URL into Supabase (Site URL and Redirect URLs) and into `NEXT_PUBLIC_SITE_URL`, and **redeploy** (needed after any change to environment variables). Optional: in Settings → Functions, choose the region closest to your Supabase region.
4. First run: create an account → confirm your email → create your master password → save the Emergency Kit → install the app on your phone (Android: "Install app"; iPhone: Share → Add to Home Screen).
5. Optional Google sign-in: create an OAuth client in Google Cloud, add the callback URL shown in Supabase's Google provider settings, paste the client ID and secret into Supabase, set `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true`, and redeploy.
6. Troubleshooting table:
   - Build failed → copy the log from Vercel into Claude Code and ask it to fix the error without running commands.
   - "Setup needed" page → environment variables are missing; add them and redeploy.
   - Confirmation emails not arriving → set up SMTP, check rate limits and the spam folder.
   - "Can't reach the vault server" → free projects pause after about a week without activity; open the Supabase dashboard and restore the project.
   - Forgot the master password → use the Recovery Key on the unlock screen.
   - Lost both → "Reset vault" deletes everything so you can start again.
7. Free-tier notes: Supabase free projects pause after a week of inactivity and must be restored from the dashboard; the 500 MB database holds hundreds of thousands of items (each is about 1–2 KB); Vercel Hobby is for personal, non-commercial projects.
8. Local development (optional, for people who can run commands): `npm install`, create `.env.local`, `npm run dev`.
9. License.

Include these email templates verbatim, each in its own code block with a suggested subject.

Confirm signup (subject "Confirm your Tijori account"):

```html
<h2>Confirm your email</h2>
<p>Confirm this address to finish creating your Tijori account.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/vault">Confirm email</a></p>
<p>If you didn't sign up, you can ignore this email.</p>
```

Reset password (subject "Reset your Tijori sign-in password"):

```html
<h2>Reset your sign-in password</h2>
<p>This changes the password you use to sign in. It does not change your master password.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Choose a new password</a></p>
<p>If you didn't ask for this, you can ignore this email.</p>
```

Change email address (subject "Confirm your new email"):

```html
<h2>Confirm your new email</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/vault/settings">Confirm new email</a></p>
```

### SECURITY.md

The threat model; the crypto table from 3.2; exactly what the server stores and can see (email, timestamps, number of items, ciphertext sizes in 256-byte steps); what the app never does (send the master password, fetch favicons, load third-party scripts, track anyone); the honest limits from 3.8; last-write-wins sync; and how to report a vulnerability (a placeholder contact for the owner to fill in).

### CLAUDE.md

Project memory for future Claude Code sessions, under 150 lines: a one-paragraph summary; stack and versions; the rule "never run terminal commands; the owner builds on Vercel"; the security invariants (no plaintext or keys leave the device, no secrets in storage or logs, RLS on every table, strict CSP, round-trip before saving keysets); the protocol-constant warning (3.3); a file map; conventions (kebab-case files, Server Components by default, tokens instead of hard-coded colours); how to fix a Vercel build error (read the log, make the smallest fix, don't upgrade packages casually); and a "Decisions" log.

### LICENSE

MIT, copyright "Tijori contributors".

---

## 15. Build order

1. Root config: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `.gitignore`, `.env.example`, `LICENSE`.
2. `supabase/schema.sql`.
3. `lib/config.ts`, `lib/env.ts`, `lib/utils.ts`, `lib/security/*`.
4. `lib/supabase/*` and `proxy.ts`.
5. `lib/crypto/*` in this order: bytes, random, constants, kdf, keys, items, recovery-key, backup.
6. `app/globals.css`, fonts, `app/layout.tsx`, `components/ui/*`, the logo and the dial.
7. The landing page, `/generator`, `/security`, `/privacy`, and the error and 404 pages.
8. Auth pages and routes, `MfaChallenge`, `SetupNeeded`.
9. Vault: types, store, use-vault, api, gate, setup wizard, unlock, recovery and reset, app shell, navigation, list, detail, form, copy and clipboard, auto-lock, broadcast, privacy screen.
10. Generator, strength estimator, common passwords, wordlist.
11. Settings (all sections), import and export.
12. Health with the breach check, then TOTP.
13. PWA: manifest, icon routes, apple icon, Open Graph image, `sw.js`, `offline.html`, registration, install prompt.
14. Command palette and shortcuts, then quick unlock (last, isolated so it can't break anything else).
15. `README.md`, `SECURITY.md`, `CLAUDE.md`.
16. The final self-review (section 16), then fix everything it finds.

---

## 16. Final self-review

Go through every file and confirm:

- [ ] Every import path exists with exactly the same casing, and every imported name is exported.
- [ ] Only packages from section 2 are imported (`next/*` subpaths come with `next`).
- [ ] `'use client'` is on every file that uses hooks, event handlers or browser APIs, and never on a file that exports `metadata`, `viewport` or route handlers.
- [ ] No browser API runs during server rendering or at module top level.
- [ ] `proxy.ts` exports only `proxy` and `config`, and there is no `middleware.ts`.
- [ ] Every component that calls `useSearchParams()` is inside `<Suspense>`.
- [ ] No `any`, every possible `null` is handled, and every function that must return a value does.
- [ ] Web Crypto calls receive `Uint8Array<ArrayBuffer>` or `ArrayBuffer`.
- [ ] The CSP allows exactly what section 9 lists.
- [ ] Nothing secret reaches storage, URLs, logs or error text, and rows sent to Supabase contain only the allowed columns.
- [ ] Setup, changing the master password, recovery, creating a new Recovery Key and quick unlock all round-trip before saving.
- [ ] Locking clears the key, items and revealed values in every tab.
- [ ] The gate never shows setup when the real problem is MFA or the network.
- [ ] Every URL from user data is checked for http or https before it becomes a link.
- [ ] `supabase/schema.sql` matches section 4.
- [ ] Every screen works at 360 px and 1440 px, in light and dark, with only the keyboard.
- [ ] Wording is consistent (buttons and toasts match), in sentence case, with no emoji and no apologies.
- [ ] README, SECURITY.md and CLAUDE.md describe the code you actually wrote.

---

## 17. When you finish

Reply briefly with: the file tree; the owner's next steps in order (Supabase SQL → auth settings and email templates → push to GitHub → Vercel environment variables → deploy → update the Site URL and redeploy); and anything you left out, with the reason.
