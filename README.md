# Scheduler

A calendar and task planner built around two habits: logging a block of
time you've spent studying (or working, or anything else you track),
and checking off a task. It started as a personal replacement for a
Notion setup used to plan coursework, but there's nothing coursework-
specific about it — it works for any recurring mix of tasks and
scheduled time blocks.

A live copy is running at **getscheduler.vercel.app**, but the project
is meant to be forked and run as your own — with your own Supabase
project and your own data, not a shared account.

## What you'll need

Nothing is hosted for you. To run your own copy, you'll set up two free
accounts:

1. **A [Supabase](https://supabase.com) project** — this is where your
   data lives (tasks, blocks, tags) and where sign-in is handled. Free
   tier is plenty for personal use.
2. **A Google Cloud OAuth client** — this lets people sign in with
   Google. (Signing in with just an email link also works, without this,
   if you'd rather skip it.)

You'll also need [Node.js](https://nodejs.org) installed to run the
project itself.

## 1. Get the code running locally

```bash
git clone https://github.com/MestreHq5/Scheduler.git
cd Scheduler
npm install
cp .env.example .env.local
```

You'll fill in `.env.local` in the next step — don't run `npm run dev`
yet.

## 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com).
2. Open **Project Settings → API** in your new project, and copy two
   values into your `.env.local` file:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Open the **SQL Editor** in your Supabase project, and run each file
   in `supabase/migrations/` once, in order (`0001_...` first, then
   `0002_...`, and so on through the highest-numbered one). Each sets up
   a piece of the database — paste one in, run it, then move to the
   next.
4. Open **Authentication → Providers** and turn on:
   - **Email** — this gives you sign-in via a magic link, no password
     needed.
   - **Google** — see the next section for the piece you need first.
5. Open **Authentication → URL Configuration** and set your **Site
   URL**. Add `http://localhost:3000/auth/callback` as a **Redirect
   URL** for local development, and your real domain's `/auth/callback`
   once you deploy.

## 3. Set up Google sign-in

This is a one-time setup in Google's own developer console — the
Client ID/Secret it gives you go into **Supabase**, not into this
project's `.env.local`.

1. Go to the [Google Cloud Console credentials
   page](https://console.cloud.google.com/apis/credentials) and create
   a project if you don't already have one.
2. **Create Credentials → OAuth client ID → Web application.**
3. Back in Supabase, open **Authentication → Providers → Google** — it
   shows you the exact **Authorized redirect URI** to paste into the
   Google Cloud form (it looks like
   `https://<your-project-ref>.supabase.co/auth/v1/callback`).
4. Once Google gives you a Client ID and Client Secret, paste both into
   that same Supabase Google provider screen, and save.

That's it — Supabase handles the rest of the login flow.

## 4. Run it

```bash
npm run dev
```

Open `http://localhost:3000` — you should land on onboarding for a
brand-new account.

## Deploying your own copy

The project deploys cleanly to [Vercel](https://vercel.com):

1. Push your fork to GitHub.
2. In Vercel, create a new project from that repository — it detects
   Next.js automatically.
3. Add the same two required values from your `.env.local`
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) under
   the project's **Environment Variables** settings.
4. Once it's deployed, go back to Supabase's **Authentication → URL
   Configuration** and add your new Vercel URL's `/auth/callback` as a
   Redirect URL, so sign-in works there too.

Connecting the GitHub repository (rather than deploying by hand) means
every future push to your main branch deploys automatically.

## For anyone extending the code

The `CLAUDE.md` file in this repository is the project's working notes
— data model, non-obvious behavior, and decisions already tried and
rejected. Worth a read before making structural changes, whether you're
a person or an AI assistant.
