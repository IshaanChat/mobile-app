# Sales Mechanic — Fortify & Ship: Tomorrow's To-Do

No new features. Everything here either hardens what exists or moves the app
toward shipping. Ordered by priority — the morning block is non-negotiable,
the afternoon is decisions, the evening is outward-facing prep.

---

## Morning — Fortify (protect what you've built)

- [x] **1. Put the project under version control.** The codebase currently has
      NO git history — one bad `rm` loses everything.
      - `git init` in `~/sales-mechanic`
      - Add a root `.gitignore` (node_modules, dist, `server/prisma/dev.db*`, `.env`)
      - **Check `client/` has a `.gitignore` too** (it was hand-rolled — it doesn't)
      - Initial commit, then push to a **private GitHub repo**
- [x] **2. Back up `server/prisma/dev.db`** somewhere off-machine (it's your
      demo data — you'll want it for screenshots/videos).
- [x] **3. Fresh-eyes first-run test.** Move `dev.db` aside, run migrations on
      a clean database, and go through the *entire* new-user journey exactly as
      a tester would: onboarding → toolkit → first client → first product →
      first sale → missions firing. Fix only what's broken or confusing —
      resist polishing. This first-run path is what every validation tester
      will experience.
- [x] **4. Crash-proof the server.** Only the business routes got try/catch
      guards; every other `update`/`delete` on a missing record still 500s
      ungracefully. Add a small async-handler wrapper (or Express error
      middleware) so no route can take the process down or hang a request.
- [x] **5. Smoke-test script.** One `npm run smoke` script (curl or vitest)
      that hits every endpoint's happy path against a scratch DB. Cheap
      insurance for every future change. If time allows: unit tests for the
      two algorithmic cores — `scoring.ts` profiles and `missions/definitions.ts`
      period-key logic (daily/weekly/monthly rollover edge cases).
- [x] **6. Write `README.md`**: what it is, stack, how to run (both servers,
      migration gotcha: stop server before `prisma migrate` on Windows), where
      the LLM config lives. Future-you and any collaborator will need it.

## Afternoon — Ship decisions (decide, don't build)

- [x] **7. Hosting architecture decision.** The localhost Express + SQLite
      model can't ship. Recommended target: Railway or Render (server) +
      Postgres (Prisma makes the SQLite→Postgres swap mostly a provider change
      + fresh migrations; the string-enum convention already matches Postgres).
      Decide, create the account, note the migration steps. Webhooks (Etsy,
      Stripe) and iOS both depend on this.
- [x] **8. Auth decision.** First multi-user requirement. Compare: Clerk
      (fastest, generous free tier), Auth.js, or hand-rolled sessions.
      Decide and write down the choice + why. Do not implement today.
- [x] **9. Data & privacy inventory.** You collect email, age, gender. Draft a
      plain-language privacy policy (a generator is fine for a draft). You need
      this for: testers' trust, Etsy Commercial Access application, Meta review
      someday, and the App Store eventually.

## Evening — Outward-facing prep (start the clocks that tick slowly)

- [ ] **10. Name & domain check.** Search trademark databases and domain
      availability for "Sales Mechanic" *before* any marketing. If taken,
      better to know now.
- [ ] **11. Register an Etsy developer Personal App** (free). Commercial
      Access review takes unknown time — start it as early as the privacy
      policy exists. This is ship-prep, not feature work.
- [x] **12. Validation kit.** Write the 5-question tester script (Mom-Test
      style: past behavior, not opinions), list 10 concrete places to recruit
      handmade-seller testers (the app's own Discover tab literally suggests
      them), and record a 60–90 second screen demo of the first-run journey.
- [x] **13. Define the three metrics that decide everything**, and how you'll
      measure them with the built-in analytics events: day-7 return, % of
      users logging ≥1 interaction/week, % reaching "First sale" mission.

---

### Explicitly NOT tomorrow
- CSV import / webhook endpoint (first post-fortification build)
- Stripe / Etsy OAuth integration (needs hosted backend)
- iOS / Expo (needs hosted backend + auth)
- Instagram anything (needs traction to justify Meta review)
- Any new tabs, missions, or UI features
