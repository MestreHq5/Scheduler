# Aero Hub

Single-user study planning + scheduling app. See `spec.md` for the product
spec and `CLAUDE.md` for build notes/architecture.

Stack: Next.js 15 (App Router, TypeScript) + Supabase (Postgres, Auth,
Storage) + Tailwind v4. Deploy target: Vercel.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev
```

## Getting your Supabase keys

1. Create a project at [supabase.com](https://supabase.com) (free tier is
   fine for this app's scale).
2. In the dashboard: **Project Settings → API**.
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only, keep
     secret — needed later for the Edge Function that syncs .ics feeds)
3. In **SQL Editor**, run `supabase/migrations/0001_init.sql`, then
   `supabase/migrations/0002_ics_storage.sql`, in that order.
4. In **Authentication → Providers**, enable **Email** (magic link is used,
   not passwords — no reset-flow needed) and **Google**:
   - Google needs an OAuth client from
     [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
     → **Create Credentials → OAuth client ID → Web application**.
   - Authorized redirect URI: the callback URL Supabase shows you on the
     Google provider settings page (looks like
     `https://<project-ref>.supabase.co/auth/v1/callback`).
   - Paste the resulting Client ID/Secret into Supabase's Google provider
     config (not into this app's `.env` — Supabase holds these).
5. In **Authentication → URL Configuration**, set the Site URL and add a
   Redirect URL for `http://localhost:3000/auth/callback` (and your
   production URL once deployed).

## Google Calendar (optional, not required to run the app)

Only needed once the explicit Google Calendar import/export feature (as
opposed to Google *login*, which is already covered above) gets built —
it's stubbed in Settings today. This is a **separate** OAuth client from
the login one because it needs the Calendar API scope:

1. In the same Google Cloud project, **APIs & Services → Library** → enable
   the **Google Calendar API**.
2. **APIs & Services → Credentials** → create another OAuth client ID (Web
   application), with its own redirect URI pointing at this app (e.g.
   `http://localhost:3000/api/google-calendar/callback` once that route
   exists).
3. Put the Client ID/Secret in `.env.local` as `GOOGLE_CALENDAR_CLIENT_ID` /
   `GOOGLE_CALENDAR_CLIENT_SECRET`.

## Deploying

- **Frontend**: [Vercel](https://vercel.com) — connect the GitHub repo,
  it auto-detects Next.js. Add the same env vars from `.env.local` in
  Vercel's Project Settings → Environment Variables.
- **.ics periodic sync**: don't rely on Vercel Cron for this — the Hobby
  tier only runs cron jobs once a day, too infrequent for keeping class/exam
  dates fresh. Instead, once ready to automate it, deploy the sync logic
  (see `src/lib/actions/ics.ts` for the parse/upsert logic to port) as a
  **Supabase Edge Function** scheduled with **Supabase Cron** (`pg_cron`),
  which isn't tier-limited that way. Until then, the Settings page has a
  manual "Sync now" button per feed.
