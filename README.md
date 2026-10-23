# Survey Club — Next.js + Supabase

## Included
- Responsive Thai member UI
- Supabase Auth signup/login
- Profile display, published surveys, question/option display
- Score balance via `get_my_balance` RPC
- Withdrawal request form/history UI
- Admin UI appears only when `profiles.role = 'admin'`
- Vercel-ready Next.js project

## Important status
This is a runnable starter, not a complete production money-reward system. The SQL already run in your Supabase project does not yet provide all required INSERT/UPDATE policies or secure server-side score awarding and withdrawal approval. Therefore survey submissions may fail until policies/functions are added; payout approvals are deliberately not implemented in the browser. Do not promise or make real cash payouts from this starter.

## Configure
The Supabase URL and publishable key supplied by the owner are prefilled in `lib/supabase.ts`. These are public client-side values; never put a Supabase secret/service-role key in browser code.

## Run locally
1. Install Node.js 20+ on a computer.
2. Extract the zip.
3. Run `npm install`
4. Run `npm run dev`
5. Open `http://localhost:3000`

## Deploy to Vercel
1. Upload/extract this folder into a GitHub repository.
2. Import the repository in Vercel.
3. Build command: `npm run build`
4. The project has the public Supabase URL and publishable key prefilled; alternatively set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Supabase setup notes
- Enable Email provider under Authentication > Sign In / Providers.
- Supabase Auth needs a valid email. This starter supports optional email entry by generating a synthetic address if blank; that may not work with email confirmation enabled. For the reliable first test, enter a real email address and confirm it.
- The trigger on `auth.users` requires username, display_name and wallet_number metadata. The signup form sends these fields.
- To grant admin, sign up with your own account, find the matching `profiles.id`, then run the commented SQL example in `supabase/optional_security.sql` with that exact UUID. Never make admin role user-selectable.
- Review RLS policies before production. Do not expose `is_correct` to regular users: the current schema's options table includes that field, so a production deployment should split answer keys into a private table or use a server-side grading function before publishing.
