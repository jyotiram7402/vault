# Vault

Vault is a free password manager that runs in any modern browser and installs like an app on phones and computers. Your logins are encrypted on your own device before anything is saved, so the server only ever holds scrambled data it cannot read.

> **Renaming it:** change `APP_NAME` in [lib/config.ts](lib/config.ts) and everything the user sees follows, including download file names. Do **not** touch `CRYPTO_PROTOCOL` in [lib/crypto/constants.ts](lib/crypto/constants.ts) — changing it makes every existing vault impossible to open.

The details of how that works are in [SECURITY.md](SECURITY.md).

---

## What you need

Three free accounts. None of them asks for a card.

- **GitHub** — holds the code.
- **Supabase** — the free database and sign-in service.
- **Vercel** — free hosting for personal projects.

You will not need to run a single command.

---

## Deploy

### A. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. **New project**. Pick the free plan.
3. Choose the region closest to the people who will use this.
4. Supabase generates a database password. **Save it somewhere safe** — you will rarely need it, but it cannot be shown again.
5. Wait until the project finishes setting up (a minute or two).

### B. Set up the database

1. In your project, open **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open `supabase/schema.sql` from this repository, copy **all** of it, and paste it in.
4. Click **Run**.

It should finish without errors. The script is safe to run again if you ever need to.

### C. Authentication settings

All of these are in your Supabase project.

**Authentication → Sign In / Providers → Email**

- Email provider: **enabled**
- **Confirm email**: on
- Minimum password length: **12**

**Authentication → Multi-Factor**

- **App authenticator (TOTP)**: enabled

**Authentication → URL Configuration**

- **Site URL**: your Vercel address, for example `https://tijori.vercel.app`. You will not know this until step E, so come back and fix it.
- **Redirect URLs**: add `https://YOUR-APP.vercel.app/**`

**Authentication → Emails → Templates** *(optional)*

Supabase only lets you edit email templates once you are sending through your own SMTP server. Until then it shows "Set up custom SMTP to edit templates" and uses its generic defaults.

**The app works either way.** Its sign-up and reset links go through `/auth/callback`, which handles the format Supabase's default templates produce. The custom templates at the bottom of this file are nicer wording — they say plainly that a password reset does *not* touch your master password — but they are not required.

If you have set up SMTP (below), paste the three templates from the bottom of this file.

**Authentication → Emails → SMTP**

Supabase's built-in email sender is meant for testing and is heavily rate-limited — a handful of messages per hour. For real users, connect a free SMTP provider so confirmation emails actually arrive, and so you can edit the templates.

Resend's free tier works well:

1. Sign up at [resend.com](https://resend.com) and create an **API key**.
2. Without your own domain, Resend only lets you send to the address you signed up with, from `onboarding@resend.dev`. That is enough for a private, single-user vault. To email anyone else, verify a domain you own under Resend → Domains.
3. In Supabase → **Authentication → Emails → SMTP**, enable custom SMTP:

   | Field | Value |
   |---|---|
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | your Resend API key (`re_…`) |
   | Sender email | `onboarding@resend.dev`, or an address on your verified domain |
   | Sender name | `Vault` |

4. Save. The Templates screen becomes editable, and **Authentication → Rate Limits** lets you raise the email limit.

For a quick private test you can skip SMTP entirely: turn **Confirm email** off, create your account, then turn it back on.

**For private use:** once you have created your own account, go back to **Sign In / Providers → Email** and turn off **Allow new users to sign up**. Nobody else can then create an account on your deployment.

### D. Copy your keys

**Project Settings → API Keys**

Copy two values:

- the **Project URL** (`https://something.supabase.co`)
- the **publishable key** (starts with `sb_publishable_`). If your project only shows a legacy **anon** key, copy that instead.

### E. Deploy on Vercel

1. Push this folder to a GitHub repository.
2. Go to [vercel.com](https://vercel.com) → **Add New** → **Project** → import that repository. Vercel detects Next.js on its own; leave the build settings alone.
3. Open **Environment Variables** and add the names from `.env.example`:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | your publishable key |
   | `NEXT_PUBLIC_SITE_URL` | your Vercel address (fill in after the first deploy) |
   | `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH` | `false`, unless you set up Google sign-in |

   If your project only has the legacy anon key, use `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead of the publishable key.

4. **Deploy**.
5. Once it is live, copy the real address and:
   - put it into Supabase under **URL Configuration** (Site URL and Redirect URLs),
   - put it into `NEXT_PUBLIC_SITE_URL` in Vercel,
   - and **redeploy**. These values are built into the app, so a redeploy is always needed after changing them.

Optional: in Vercel **Settings → Functions**, choose the region closest to your Supabase region. It makes sign-in noticeably faster.

---

## First run

1. Open your site and choose **Create your vault**.
2. Enter your email and an account password (at least 12 characters). This is the password you sign in with.
3. Confirm your email from the message that arrives.
4. Sign in. The app now asks you to create a **master password**. This is a different password, it never leaves your device, and nobody — including you — can reset it.
5. Save the **Recovery Key** it shows you. Download the Emergency Kit, print it, or write it down. This is the only way back in if you forget your master password.
6. Install it on your phone:
   - **Android / Chrome**: the "Install app" prompt, or the browser menu → *Install app*.
   - **iPhone / Safari**: the Share button → *Add to Home Screen*.

---

## Optional: Google sign-in

1. In Google Cloud Console, create an **OAuth 2.0 Client ID** of type *Web application*.
2. In Supabase, open **Authentication → Sign In / Providers → Google**. It shows you a callback URL — copy it into the Google client's **Authorised redirect URIs**.
3. Paste Google's **Client ID** and **Client secret** into Supabase and enable the provider.
4. In Vercel, set `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true` and **redeploy**.

---

## Troubleshooting

| What you see | What to do |
|---|---|
| **The Vercel build failed** | Open the build log in Vercel, copy the error, and paste it into Claude Code asking for the smallest fix. Do not let it upgrade packages to "solve" a type error. |
| **"Setup needed" page** | The environment variables are missing or misspelled. Check them in Vercel and redeploy — the app reads them at build time. |
| **Confirmation emails never arrive** | Supabase's built-in sender is rate-limited. Set up SMTP (step C), check your spam folder, and wait a few minutes between attempts. |
| **"Can't reach the vault server"** | Free Supabase projects pause after about a week without activity. Open the Supabase dashboard and restore the project. |
| **I forgot my master password** | On the unlock screen, choose **Use recovery key**, enter the key from your Emergency Kit, and set a new master password. |
| **I lost both the master password and the Recovery Key** | The data cannot be recovered by anyone. On the unlock screen, open *Can't unlock at all?* → **Reset vault** to delete everything and start again. Your account survives. |
| **Sign-in works but the vault is empty on a second device** | Check that both devices are signed into the same account, and that two-factor was completed if you turned it on. |

---

## Free-tier notes

- **Supabase free projects pause** after roughly a week with no activity. Restoring one is a single button in the dashboard, but it does mean the app will be unreachable until you do.
- The free **500 MB database** holds hundreds of thousands of items. Each encrypted item is about 1–2 KB.
- **Vercel Hobby** is for personal, non-commercial use. If you want to run this for an organisation, you need a paid plan.
- There is a built-in limit of **5000 items per account**, enforced by the database, so one account cannot fill the project.

---

## Local development (optional)

Only for people comfortable with a terminal.

```bash
npm install
```

Create a file called `.env.local` with the same variables as `.env.example`, then:

```bash
npm run dev
```

The app runs at `http://localhost:3000`. `npm run typecheck` checks the types without building.

---

## Email templates

Paste each of these into **Authentication → Emails → Templates** in Supabase.

**Confirm signup** — subject: `Confirm your Vault account`

```html
<h2>Confirm your email</h2>
<p>Confirm this address to finish creating your Vault account.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/vault">Confirm email</a></p>
<p>If you didn't sign up, you can ignore this email.</p>
```

**Reset password** — subject: `Reset your Vault sign-in password`

```html
<h2>Reset your sign-in password</h2>
<p>This changes the password you use to sign in. It does not change your master password.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Choose a new password</a></p>
<p>If you didn't ask for this, you can ignore this email.</p>
```

**Change email address** — subject: `Confirm your new email`

```html
<h2>Confirm your new email</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/vault/settings">Confirm new email</a></p>
```

---

## License

MIT. See [LICENSE](LICENSE).
