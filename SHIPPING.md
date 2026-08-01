# Shipping Venturo — to TestFlight, then App Review

Rewritten 2026-07-31, after the CloudKit migration. The version before this
planned around Clerk, a Render cold start and a demo account for the reviewer.
None of those exist any more, and most of what it warned about has stopped
being true.

---

## What the migration changed about shipping

Four of the five ranked risks in the old version are simply gone.

| old risk | now |
|---|---|
| 20–31s cold start read as a broken app | **gone.** No server. CloudKit answers immediately |
| No demo account → automatic rejection | **not needed.** There is no sign-in to give credentials for |
| Sign in with Apple hanging on a missing Clerk entry | **gone.** No Clerk, no OAuth |
| Privacy answers not matching the policy | **easier.** The app collects less than it did |

What remains: the **name**, and the two **legal URLs** below.

## What is already done

- The app compiles, runs, and reads its whole catalogue from CloudKit.
- Bundle id `com.ishaanchaturvedi.salesmechanic`, registered, with Sign in with
  Apple enabled at Apple's end.
- **Code signing works on this Mac** — `Apple Distribution: ISHAAN CHATURVEDI
  (G7K94LKBQH)`. Archiving is no longer blocked.
- `ITSAppUsesNonExemptEncryption=false` is in `Venturo-Info.plist`, so App Store
  Connect stops asking export-compliance questions on every upload.
- Account deletion is one call — the private zone is deleted whole, which is
  Guideline 5.1.1(v) satisfied in a way that can be proven rather than audited.
- Apple Developer Program membership is paid.

## What is not

- **The privacy and support pages are served by the dying Express app.** See
  below; this is the one hard blocker left.
- The private database has never run against a real iCloud account.
- `trends/rank.ts` is not ported, so feed ordering is provisional.
- No App Store Connect record.

---

## Phase 1 — Rehome the legal pages

**The blocker.** App Store Connect requires a Privacy Policy URL and a Support
URL. Both currently live at `sales-mechanic-api.onrender.com`, which is being
torn down. Move them before anything else, because the tear-down is otherwise
irreversible in the wrong order.

`server/content/legal/privacy.md` and `support.md` are the sources. Any free
static host works — GitHub Pages against this repo is the least new machinery.

**`support.md` still contains `REPLACE-BEFORE-SUBMITTING@example.com`** and is
publicly live with it right now. Use a dedicated address, not a personal one:
it stays on the listing for as long as the app does, and a separate inbox is
trivially handed off.

## Phase 2 — TestFlight

**Internal testing needs no App Review at all.** Up to 100 testers, on your team
in App Store Connect, testing minutes after a build finishes processing. No
screenshots, no description, no review notes. This is the fastest real feedback
available and it should not wait on Phase 3.

External testing — up to 10,000, anyone with an email — needs a Beta App
Review, which is lighter than full review and usually about a day. It wants a
beta description, a contact email and the privacy policy URL.

1. Create the App Store Connect record. Bundle `com.ishaanchaturvedi.salesmechanic`,
   category Business, age rating 13+ to match the gate onboarding enforces.
2. Xcode → **Product → Archive** (Any iOS Device, not a simulator).
3. **Distribute App → App Store Connect → Upload.**
4. Add internal testers. Install on your own phone.

Do step 4 even though it costs a day. **The simulator cannot test the private
database properly**, and CloudKit behaves differently with a real iCloud account
than with none — which is exactly the path every tester will take.

## Phase 3 — App Review

### The name

**Still unchecked in the only way that counts.** Public sources turned up
nothing blocking — the App Store listing that indexed as "Venturo" is now
called "Vonda", and `venturo.app` is a parked domain for sale. But App Store
Connect is the authority: try to reserve the name. It costs nothing and either
accepts or refuses immediately.

### App Privacy — answer it from the code

The app now collects **less** than the old privacy policy describes, which is
the safe direction but means the questionnaire and the policy should be
re-read together rather than copied from the old answers.

Collected, linked to identity:

- **User content** — business details, contacts, notes, sales
- **Other data** — age (collected only to check 13+), and optionally location,
  bio, and an email address **the user now has to type themselves**

There is no third-party analytics SDK, nothing is used for tracking, and
**private data is stored in the user's own iCloud** rather than on a server you
operate — which is worth stating plainly in the review notes.

### Guidelines that do not apply

No in-app purchase or paywall anywhere in this build, so **3.1.1 does not
apply**. Account deletion is in-app, which **5.1.1(v)** requires. There is no
third-party sign-in at all, so **4.8** has nothing to govern.

### Screenshots

From the simulator on the largest current iPhone. App Store Connect lists the
exact sizes and rejects the wrong ones, so read them there. Five or six:
Discover, a product card expanded, Grow, Business, the Journey sheet.

---

## Ranked risks, current

1. **The legal URLs die with Render.** Ordering problem, not a hard one — but
   it makes the app unsubmittable if done in the wrong order.
2. **The private database is unproven against a real account.** Everything
   users keep runs through it, and none of it has executed outside a compiler.
3. **The name.** Cheap to check, expensive late.
4. **Feed ordering is provisional** until `trends/rank.ts` is ported. Not a
   rejection risk; a quality one.
