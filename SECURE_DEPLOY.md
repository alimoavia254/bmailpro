# Secure and Free Deployment (GitHub + Vercel)

This project can be deployed safely for free without leaking `.env` secrets.

## 1) Keep secrets out of Git

- Never commit `.env`, `.env.local`, `.env.production`, or any secret key file.
- Only keep placeholders in `.env.example`.
- Use Vercel Environment Variables for real keys.

## 2) If a key was ever exposed, rotate it

Immediately rotate these values in Supabase and your providers:

- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (safe-ish public, but rotate if exposed with others)
- `ENCRYPTION_KEY`
- `UNSUBSCRIBE_SECRET`
- `CRON_SECRET`

## 3) Safe GitHub upload flow

1. Initialize repo locally:
   - `git init`
2. Verify ignored files:
   - `git status --ignored`
   - Make sure `.env*` files are ignored.
3. Stage and commit:
   - `git add .`
   - `git commit -m "Initial secure deploy setup"`
4. Push to GitHub private repo.

## 4) Deploy on Vercel (free)

1. Import GitHub repo in Vercel.
2. Add Production env vars in Vercel Project Settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL`
   - `NEXT_PUBLIC_URL`
   - `ENCRYPTION_KEY`
   - `UNSUBSCRIBE_SECRET`
   - `CRON_SECRET`
3. Redeploy.

## 5) Supabase Auth redirect settings

In Supabase Auth URL settings:

- Site URL: `https://<your-domain>.vercel.app`
- Redirect URLs:
  - `https://<your-domain>.vercel.app/auth/callback`
  - `https://<your-domain>.vercel.app/auth/reset-password`
  - `https://<your-domain>.vercel.app/auth/login`

This is required for forgot/reset/email auth flows to work in production.

## 6) Pre-push secret safety check

Run before every push:

- `git status`
- `git diff --staged`
- `rg "SUPABASE_SERVICE_ROLE_KEY|ENCRYPTION_KEY|UNSUBSCRIBE_SECRET|CRON_SECRET" -- .`

If a real key appears in tracked files, remove it before push.
