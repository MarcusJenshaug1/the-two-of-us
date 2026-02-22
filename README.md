# The Two of Us - Couple's PWA

A complete mobile-first Progressive Web App (PWA) for couples to share daily questions, reactions, and keep track of their relationship progress. Built with Next.js App Router, Tailwind CSS, Radix UI, and Supabase.

## Features

- **PWA Ready**: Installable on iOS and Android via "Add to Home Screen".
- **Daily Questions**: A new question is generated every day at 06:00 (Oslo Time) for each active room.
- **OTP Authentication**: Secure sign-up/sign-in using 6-digit one-time passwords via Resend.
- **Offline Drafting**: Answers are saved temporarily in your local storage until submitted.
- **Privacy First**: Your partner's answer is hidden until both of you have answered the daily question.
- **Progress Tracking**: See your streaks, total questions answered, and milestones.

## Prerequisites

- Node.js 18+
- A Supabase Project.
- A Resend API key (for authentication emails).

## Getting Started Locally

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   RESEND_API_KEY=your_resend_api_key
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3001](http://localhost:3001)

## Supabase Configuration

### 1. SQL Migrations
Run the SQL script located in `supabase/migrations/20260222_complete_schema.sql` in your Supabase SQL Editor. This sets up the entire database schema, triggers, and RLS policies.

### 2. SMTP & OTP Setup
To enable the OTP flow via Resend:
1. Go to **Supabase Dashboard** -> **Settings** -> **Auth** -> **SMTP Settings**.
2. Enable "Custom SMTP" and use `smtp.resend.com` (Port 587) with your Resend API key as the password.
3. In **Auth** -> **Email Templates**, ensure "Confirm signup" uses the `{{ .Token }}` variable to send the 6-digit code.

### 3. Edge Function (Automation)
The Edge Function generates daily questions and runs on a cron schedule.

**Deploy the function:**
```bash
supabase functions deploy daily-questions
```

**Set up pg_cron (in SQL Editor) to run at 06:00 Oslo Time:**
*(Note: Supabase pg_cron runs in UTC, Oslo is UTC+1 or UTC+2 depending on DST).*
```sql
SELECT cron.schedule(
  'daily-questions-job',
  '0 5 * * *',
  $$
    SELECT net.http_post(
      url:='https://your-project-ref.functions.supabase.co/daily-questions',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
    )
  $$
);
```

## PWA Installation
- **iOS**: Open in Safari -> Share -> "Add to Home Screen".
- **Android**: Open in Chrome -> Menu -> "Install app".
