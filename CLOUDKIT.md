# Venturo on CloudKit

The plan for moving off Express/Postgres/Clerk and onto CloudKit. Decided
2026-07-31, after the app compiled and ran but before any beta.

Venturo is an iOS product with no plans for Android or web. That is what makes
this defensible: CloudKit's ceiling is Apple-only, and Apple-only is the
product. Everything below follows from that one decision.

---

## What this buys, and what it costs

Buys: Clerk disappears entirely — no production instance to migrate, no user
pool to lose, no 60-second token refresh, no keychain entitlement, no
dashboard entry that fails silently. Sign-up stops existing, which matters for
an audience that "feels out of their depth" and currently meets a wall on
screen one. Per-user storage is free forever, because private records count
against the user's iCloud quota. No cold start, no hosting bill, no deploys.

Costs, all accepted knowingly: iOS forever. Ranking logic moves into the
binary, so ranking changes need a release. Private data is invisible to us,
so `VALIDATION.md`'s three metrics need anonymised events in the public
database instead of a query. Queries have no joins and page at ~200.

## What does not change

- **`server/content/*.json` stays the source of truth.** Edited by hand,
  pushed to CloudKit. Content still ships without an App Store release.
- **AliExpress `sourcingUrl` and Pexels `imageUrl` are unaffected.** They are
  strings on a record; images load over HTTPS from their own hosts exactly as
  now. CloudKit stores the URL, never the image.
- **The prototype.** `preview-app.ts` reads the content JSON directly and
  never touched the database. It remains the design source of truth.

---

## Container

```
iCloud.com.ishaanchaturvedi.salesmechanic
```

Two environments, Development and Production, with **separate data and
separate schemas**. Production gets its schema only when Development's is
**promoted in the CloudKit Console**. Forgetting that promotion is the classic
way to ship an app that works everywhere except the App Store build.

**The schema has to exist before the first push, and Web Services will not
create it.** Saving a record of an unknown type from the *native SDK* creates
the type in Development. Doing the same over a server-to-server key returns
`NOT_FOUND could not find record_type` — for `create` as much as for
`forceReplace`. Both were tried; both fail.

So the schema lives in `server/scripts/lib/cloudkit-schema.ts`, and
`npm run cloudkit:schema` emits a `.ckdb` for **Console → Schema → Import
Schema**. Keeping it in the repo rather than clicking it into the Console is
what stops it drifting from what the push actually sends.

## Public database — curated content

Written only by the push script. Read by everyone.

**Set the security role so `_world` is read-only and `_creator` cannot
write.** The default lets any authenticated user create records in the public
database, which would let any user with a debugger add products to your feed.

`recordName` is the content's **slug**, not a generated id. That makes the
push idempotent: re-running it updates rows rather than duplicating them, and
a product keeps its identity across re-imports — which the existing `Tip`
model already relies on for "which tips have I seen".

| record type | count | from |
|---|---|---|
| `Niche` | 48 | `content/niches.json` |
| `Product` | 886 | `content/products/*.json` |
| `Community` | 166 | `content/communities/*.json` |
| `Tip` | 50 | `content/tips.json` |
| `JourneyLevel` | 5 | `content/missions.json` |
| `Milestone` | 34 | same |
| `Playbook` | 5 | same |
| `OnboardingScript` | 1 | `content/onboarding.json` |

`OnboardingScript` is deliberately **one record holding the whole JSON as a
string**. The script is a nested tree of forks and prompts that no flat record
type models well, the app already decodes it from JSON, and keeping it whole
preserves exactly today's workflow: edit the file, push, live.

`Product.evidence` flattens into fields on the record — CloudKit has no nested
records, and `DiscoverEvidence` is already flat and all-optional.

Fields needing **queryable** indexes declared in the Console: `Product.slug`,
`Product.nicheSlug`, `Product.tier`, `Product.hotness` (sortable too),
`Community.nicheSlug`, `Tip.tab`, `Tip.level`, `Milestone.levelOrder`.
A missing index is a runtime query error, not a compile error.

## Private database — user data

Per user, invisible to us, free at any scale. Cascade deletes come from
`CKRecord.Reference(action: .deleteSelf)` — deleting a Business takes its
channels, contacts, socials, payments and shelf products with it, which is
what the Prisma `onDelete: Cascade` did.

| record type | notes |
|---|---|
| `Profile` | name, email, age, gender + optional location/phone/bio/experience/goals |
| `Business` | name, niche, description, idealCustomer, audienceKeywords, salesAvenues, businessType, pageUrl |
| `Channel` | → Business |
| `Contact` | → Business, → Channel. Carries the two derived scores |
| `Interaction` | → Contact |
| `Payment` | → Business, → Contact |
| `ShelfProduct` | the user's own products. `stock: nil` means untracked |
| `SocialLink` | → Business |
| `SavedTrend` | `productSlug` + `savedAt` |
| `MilestoneCompletion` | `milestoneSlug` + `completedAt` |
| `MissionCompletion` | `missionId` + `businessRef` + `periodKey` |

`AppEvent` does **not** move here. It is already local-first by design — the
schema comment says the data never leaves the user's own database — so it
becomes anonymised writes to a public `Event` type, which is also the only way
`VALIDATION.md`'s metrics stay measurable.

## Identity

`CKContainer.accountStatus()` replaces sign-in outright. `userRecordID` is the
identity. There is no sign-up, no password, no OAuth.

This adds a **sixth app state**: no iCloud account. `AppState` currently has
five (loading, error, onboarding, explorer, active). A user signed out of
iCloud can do nothing, and the empty state has to say so plainly rather than
looking broken.

Account deletion still has to exist in-app — App Store Guideline 5.1.1(v)
requires it and `npm run verify:deletion` currently proves it. Deleting the
private zone is the equivalent, and it needs its own proof.

---

## Order of work

Content first. It is read-only, it is the whole Discover and Grow experience,
and getting it wrong breaks nothing that exists.

1. **Schema + push pipeline.** CloudKit Web Services, server-to-server key,
   ECDSA-signed requests, batches of 200. Replaces `npm run content:sync`.
2. **CloudKit capability** on the target, container registered.
3. **Read path in Swift.** Discover, Grow, Tips, Journey, Onboarding — public
   database only. Both clients coexist here; nothing is deleted yet.
4. **Private database.** Profile, Business, and the rest. Clerk comes out.
5. **Ranking and missions into Swift.** `trends/rank.ts`, `scoring.ts` and
   `missions/definitions.ts` period-key rollover. 173 unit tests cover the two
   algorithmic cores — port the cases, not just the code.
6. **Cut over and delete.** Clerk SDK, `SignInScreen`, `ClerkAuth.swift`, the
   Express app, Render.

## Two things that will bite

**The privacy and support pages are served by the Express app.** App Store
Connect requires both URLs. Decommissioning Render takes them down, so they
need a free static host and the URLs updated everywhere before submission.

**The 100MB public database floor.** Base quota is 10GB assets, 100MB database
storage, 2GB/month transfer, 40 req/s, and it scales with *active users* — so
during beta you are at the floor, not the ceiling. Product images are remote
URLs rather than CloudKit assets, which is what keeps this comfortable.
