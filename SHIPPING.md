# Shipping Venturo

The app currently runs on `localhost` with SQLite and no authentication. That
is fine for a prototype and impossible to ship. This document records the
decisions and the concrete steps.

Nothing here is built yet — it is the plan, written down so the decisions
don't get re-litigated every session.

---

## Why this has to happen before almost anything else

Three things people will ask for are all blocked on the same work:

| Wanted | Blocked on |
|---|---|
| iOS app | a hosted API — a phone cannot reach `localhost:4000` |
| Etsy / Stripe integrations | a public HTTPS URL for OAuth callbacks and webhooks |
| Letting a second person try it | authentication and per-user data isolation |

So: **host it, add auth, then everything else becomes possible.**

---

## 1. Hosting

**Recommendation: Railway** for the server + Postgres, at ~$5/month Hobby.

Reasoning:

- Railway's one-click Postgres alongside the app is the least-friction path,
  and everything is metered per second on top of a small plan fee.
- **Render** has the only real free tier left, but the free plan spins down
  after 15 minutes of inactivity with a ~1 minute cold start, and its free
  Postgres *hard-expires 30 days after creation and is then deleted*. That is
  actively dangerous for a database holding a user's business data. Render's
  paid tier is fine (~$7 web + $7 Postgres) if you prefer fixed pricing and
  want PITR backups.
- **Fly.io** is pure pay-as-you-go with no base fee, cheapest at very small
  scale, but more infrastructure to reason about than you want right now.

Verify current pricing before committing — these change often.

Client hosting: **Vercel or Netlify**, free tier is genuinely fine for a Vite
static build. Point it at the API with an env var.

## 2. SQLite → Postgres

Prisma makes this mostly a provider swap, and the codebase is already
compatible because of an early constraint: **SQLite has no enums, so every
enum-like field is already a validated string**. There is no enum migration to
do.

Steps:

1. `datasource db { provider = "postgresql" }` in `schema.prisma`.
2. Delete `prisma/migrations/` and re-run `prisma migrate dev --name init`
   against a local Postgres. The existing migration history is SQLite-specific
   SQL and cannot be replayed on Postgres. This is safe — no production data
   exists yet. **Do this once, before there are real users, and never again.**
3. Set `DATABASE_URL` to the Railway connection string in production.
4. Run `npx prisma migrate deploy` on deploy (add it to the start command).
5. Run `npm run smoke` against the deployed URL:
   `SMOKE_BASE_URL=https://your-app.up.railway.app/api npm run smoke`

Things to check after the move, because SQLite was lenient about them:

- `Float` for money becomes `double precision`. Consider `Decimal` for
  `Payment.amount` and `Product.price` before real money is involved.
- Case-sensitivity in text filters differs; the Discover keyword matching
  lowercases everything already, so it should be unaffected.
- Concurrent writes actually work now, which makes the `MissionCompletion`
  unique constraint more important, not less. It is already correct.

## 3. Authentication

**Recommendation: Clerk**, unless you object to a third party holding user
identities.

Reasoning: it is the fastest path from zero to working auth with a decent free
tier, handles email verification, password reset, and social login — all of
which are weeks of work to build properly and are a security liability if
built badly. Auth.js is the self-hosted alternative if you want to own it.

**The bigger job is not the login box — it is multi-tenancy.** Right now every
query trusts a `businessId` from the client. The moment there are two users,
every route needs to verify the requesting user owns that business, or user A
can read user B's client book by guessing an ID.

Concretely:

- Add a `User` model; `Business.userId` and `UserProfile.userId`.
- Add middleware that resolves the session to a user id.
- Every route that takes `businessId` must check ownership. The smoke test
  should grow a case that asserts a second user gets a 403.
- `AppSetting` (which holds the LLM config) is currently global; it becomes
  per-user.

This is the single largest piece of remaining work and should not be
underestimated — plan for days, not hours.

## 4. Before real users touch it

- [ ] Privacy policy published (see `PRIVACY.md` — it is a draft, have a
      human review it before publishing)
- [ ] Rate limiting on the API (`express-rate-limit`)
- [ ] `helmet` for security headers
- [ ] CORS locked to the known client origin instead of the current `cors()`
      which allows everything
- [ ] Database backups configured and *restored once* to prove they work
- [ ] An error tracker (Sentry free tier) — you cannot fix what you cannot see
- [ ] Delete-my-account and export-my-data paths, which are both a GDPR
      requirement and a trust feature worth advertising

## 5. Only then: iOS

Use **React Native with Expo**, not Swift. The API layer and all the types
carry over, and much of the logic in `client/src` is portable. A Swift rewrite
means maintaining two clients for a solo developer.

Expo also gives over-the-air updates, which matter when iterating quickly with
early testers.

---

## Suggested order

1. Postgres migration locally, smoke test green
2. Deploy server to Railway, smoke test green against the deployed URL
3. Deploy client to Vercel pointing at it
4. Auth + multi-tenancy (the big one)
5. Rate limiting, helmet, CORS, Sentry, backups
6. Privacy policy, account deletion, data export
7. Etsy Commercial Access application (free, review takes an unknown amount
   of time — apply as soon as the privacy policy is live)
8. CSV import — the highest-value manual-entry killer, and it needs none of
   the above
9. iOS via Expo

Sources consulted for hosting: [Render vs Railway vs Fly.io pricing 2026 (HOSTIM)](https://hostim.dev/blog/render-vs-railway-vs-fly-pricing/),
[Render vs Railway vs Fly.io 2026 (ExpressTech)](https://expresstech.io/render-vs-railway-vs-fly-io-2026-pricing-showdown/),
[Railway vs Render vs Fly.io for solo developers (DevToolPicks)](https://devtoolpicks.com/blog/railway-vs-render-vs-fly-io-solo-developers-2026)
