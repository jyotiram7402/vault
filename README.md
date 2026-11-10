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
- **Email OTP Length**: **10**. Every reset email carries a one-time code that also works on its own; six digits can be guessed by someone with enough internet addresses before it expires, ten cannot.
- **Email OTP Expiration**: **900** (fifteen minutes).
- **Require current password when updating**: on. Changing the sign-in password then needs the current one, except straight after a reset email, so a signed-in browser alone can't take over the account. Supabase still counts a session opened from a reset email as a reset session, so forgotten-password resets keep working.
- Password Requirements: your choice. The app's strength meter judges guessability, not character types, so if you require letters, digits or symbols here, a password the meter calls excellent can still be refused. When that happens the app repeats Supabase's actual rule under the field.

**Authentication → Multi-Factor**

- **App authenticator (TOTP)**: enabled

**Authentication → URL Configuration**

- **Site URL**: your Vercel address, for example `https://tijori.vercel.app`. You will not know this until step E, so come back and fix it.
- **Redirect URLs**: add `https://YOUR-APP.vercel.app/**`

**Authentication → Emails → Templates** *(optional)*

Supabase only lets you edit email templates once you are sending through your own SMTP server. Until then it shows "Set up custom SMTP to edit templates" and uses its generic defaults.

**The app works either way.** Its sign-up and reset links go through `/auth/callback`, which handles the format Supabase's default templates produce. The custom templates at the bottom of this file are nicer wording — they say plainly that a password reset does *not* touch your master password — and the reset one adds a one-time code that the Forgot password page accepts when a mailbox's security scanner has already spent the link. Without the custom templates the app still works, but that code never arrives.

If you have set up SMTP (below), paste the four templates from the bottom of this file.

**Authentication → Emails → SMTP**

Supabase's built-in email sender is for development only: about two emails an hour, and it cannot be raised. For sign-up and password-reset emails to arrive reliably — and to be able to edit the templates — connect your own sender. A Gmail account made just for this is free and takes about fifteen minutes.

**Gmail, once:**

1. Create a new Gmail account only for app emails, for example `yourname.apps@gmail.com`. Its name appears under the app name in every email, so keep it short and neutral. Don't use your personal or work inbox.
2. **Google Account → Security** → turn on **2-Step Verification**. App passwords require it.
3. Go to `myaccount.google.com/apppasswords` and create one named for this project, e.g. "Vault Supabase". Copy the 16-letter password — Google shows it once. Make a separate app password per project, so you can revoke one without breaking the others.

> Keep that app password out of code, `.env` files, chats and documents. Type it straight into Supabase.

**Supabase, per project — Authentication → Emails → SMTP → Enable custom SMTP:**

| Field | Value |
|---|---|
| Sender email | your app Gmail address |
| Sender name | `Vault` |
| Host | `smtp.gmail.com` |
| Port | `587` (if that fails, `465`) |
| Username | the same Gmail address, in full |
| Password | this project's 16-letter app password, no spaces |

Save. Then:

- **Authentication → Rate Limits** → set emails per hour to 30–100. (Locked until custom SMTP is on.)
- **Authentication → Emails → Templates** is now editable: paste the templates from the bottom of this file. Every link in them opens a page in the app with a **Continue** button, so they work on any device, not only the browser that asked for the email, and a mail scanner that opens links can't use them up. The reset email also carries a one-time code to type into the app, for mailboxes whose scanner presses buttons as well.
- Turn **Confirm email** back on if you switched it off for a quick start.

Gmail sends roughly 500 emails a day across every project using that account — plenty for a personal vault. If this ever grows or gets its own domain, switch to a service such as Resend: same screen, only host, port, username and password change.

For a quick private test you can skip all of this: turn **Confirm email** off, create your account, then turn it back on. The app's reset links still work; they just arrive slowly and sometimes not at all.

**For private use:** as soon as your own account exists, go back to **Authentication → Sign In / Providers** and turn off **Allow new users to sign up**. While sign-ups are open, anyone can create an account on your deployment, use up your hourly email allowance so your own reset emails stop arriving, and fill your free database.

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
| **The reset email's button ends on "That link didn't work"** | Something used the link before you did: usually a company mailbox's security scanner, or a newer reset email replaced it. Send one new email, then type the code from it on the Reset page instead of pressing the button. Only the newest email counts. |
| **"Can't reach the vault server"** | Free Supabase projects pause after about a week without activity. Open the Supabase dashboard and restore the project. |
| **I forgot my master password** | On the unlock screen, choose **Use recovery key**, enter the key from your Emergency Kit, and set a new master password. |
| **I lost both the master password and the Recovery Key** | The data cannot be recovered by anyone. On the unlock screen, open *Can't unlock at all?* → **Reset vault** to delete everything and start again. It asks for your sign-in password first. Your account survives. |
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
<p>If the button doesn't work, type this code on the page where you asked for the reset: <strong>{{ .Token }}</strong></p>
<p>If you didn't ask for this, you can ignore this email.</p>
```

**Change email address** — subject: `Confirm your new email`

```html
<h2>Confirm your new email</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/vault/settings">Confirm new email</a></p>
```

**Magic link** — subject: `Your sign-in link`. The app never sends these itself, but the Supabase dashboard's "Send magic link" button does, and without this template that link would land in the wrong place.

```html
<h2>Your sign-in link</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink&next=/vault">Sign in to Vault</a></p>
```

---

## License

MIT. See [LICENSE](LICENSE).
