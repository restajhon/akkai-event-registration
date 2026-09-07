# Repository Instructions

- This is a single npm-managed Next.js `16.2.12` App Router app. Application routes live under `src/app`; Supabase clients live in `src/lib/supabase/`; `@/*` resolves to `src/*`.
- The app is still the create-next-app starter. The only implemented API route is `GET /api/health/supabase`; routes in `docs/PRD.md` are planned, not shipped.

## Commands

```bash
npm ci
npm run dev
npm run lint
npm test
npx tsc --noEmit
npm run build
npm run start
```

- Use npm and `package-lock.json`; the README's yarn/pnpm/bun alternatives are template text.
- Vitest is configured for unit and authorization contract tests. For code changes, run `npm run lint`, `npm test`, `npx tsc --noEmit`, then the production build.

## Environment And Supabase

- Copy `.env.example` to `.env.local`. The current Supabase clients require `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; `.env*` is ignored except `.env.example`.
- Never expose server secrets such as `SUPABASE_SECRET_KEY` or `RESEND_API_KEY` in browser code. `src/lib/supabase/server.ts` is for Server Components, Server Actions, and Route Handlers; `client.ts` is browser-only.
- Local Supabase configuration is in `supabase/config.toml`, with migrations in `supabase/migrations/`. The initial migration now contains the AKKAI 2026 database schema. `supabase/seed.sql` is intentionally empty of data; development dummy data is planned for a separate task.
- `/api/health/supabase` only checks Supabase Auth connectivity and configuration; it does not verify database tables or migrations.

## Next.js

- Before changing Next.js APIs or conventions, read the relevant versioned guide under `node_modules/next/dist/docs/` and follow its deprecation guidance.
