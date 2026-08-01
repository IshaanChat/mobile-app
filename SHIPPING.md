# Shipping Venturo — Mac mini to App Review

The path from a Mac that has never seen this project to an app sitting in
Apple's review queue. Written to be worked through in order.

*(This document replaced an earlier one that planned the hosting and auth work.
All of that is done. If you find a copy recommending Railway, or saying to
build the client in React Native rather than Swift, it is the old version —
both decisions were reversed.)*

---

## What is already done

Don't redo any of this.

- Server is live on Render at `https://sales-mechanic-api.onrender.com`, with
  Postgres on Neon and four migrations applied.
- Clerk auth is wired end to end — email, Apple and Google.
- Account export and deletion work in-app and are proven by
  `npm run verify:deletion`.
- Privacy policy is **live and public** at
  `https://sales-mechanic-api.onrender.com/privacy`. Verified 2026-07-31.
- Support page is live at `/support` — **after the redeploy in Phase 3.**
- Bundle id `com.ishaanchaturvedi.salesmechanic` is registered with Apple,
  carries the distribution certificate created 2026-07-29, and has Sign in with
  Apple enabled at Apple's end.
- Apple Developer Program membership is paid.
- ~7,000 lines of SwiftUI in `ios/`, feature-complete against the prototype.

## What is not

- **The iOS app has never been compiled.** No `.xcodeproj` in git yet.
- No App Store Connect app record.
- Clerk is on a **development** instance.
- No screenshots, description, or demo account for the reviewer.

## You are here — 31 July 2026

Work moved from the Windows machine to a Mac mini partway through Phase 1.

**Done on the Mac:** Xcode **26.6** installed and licensed, repo cloned to
`~/sales-mechanic`.

**Note the Mac is not an admin account.** `sudo xcode-select -s` is not
available, so the developer directory is set per-shell instead — this line is
in `~/.zshrc` and is why `xcodebuild` works:

```bash
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
```

A one-off admin password from the machine's owner covered the Xcode license.
Building and code signing need no further admin.

**Next, in order:** create the Xcode project (Phase 1), set Swift Language
Version to **5** before the first build (Phase 2), then compile ~7,200 lines of
Swift that no compiler has ever seen.

**Carried over and still open:** the support page at `/support` is live and
still reads `REPLACE-BEFORE-SUBMITTING@example.com`. A dedicated address was
being created rather than reusing a personal one. Phase 3 step 2.

---

## Phase 0 — The Mac mini

Start the Xcode download first. It is many gigabytes and everything else here
is faster than it.

1. **Xcode 26 or newer**, from the App Store. Not optional and not negotiable:
   Clerk's Swift SDK is built with swift-tools-version 6.2 and will not resolve
   on an older toolchain. Check with `xcodebuild -version`.
2. **Command line tools**: `xcode-select --install`.
3. **Node 22** — `brew install node@22`, or nvm if you prefer.
4. **Claude Code**:
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```
   Then `claude` in the repo directory. The desktop app works too; the CLI is
   what the repo's `CLAUDE.md` is written for.
5. **Clone the working remote**, not `origin`:
   ```bash
   git clone https://github.com/IshaanChat/mobile-app.git sales-mechanic
   ```
6. **Check the toolchain works** before touching Xcode:
   ```bash
   cd server && npm ci && npm test
   ```
   184 tests, well under a second. If they pass, Node and the repo are fine and
   anything that breaks later is Xcode's.

7. **`server/.env` is probably not needed.** It is not in git, and it is easy to
   assume everything is blocked on it. It is not:

   | task | needs `.env`? |
   |---|---|
   | Build and run the iOS app | **No** — it talks to the deployed Render API |
   | `npm run app:preview` (the prototype) | **No** — reads `content/*.json` off disk |
   | `npm test` | **No** |
   | `npm run dev` (the API locally) | Yes — `DATABASE_URL` |
   | `catalog:import`, `growth:*`, `sourcing`, `ingest` | Yes |

   So finishing and shipping the app needs no secrets at all. If you do want
   the API running locally, `cp .env.example .env` — it documents every key and
   where to get it — and fill in `DATABASE_URL` from Neon, the **direct**
   non-pooled string. With `CLERK_SECRET_KEY` left unset the API signs every
   request in as one development account, which makes local work simpler rather
   than harder.

## Phase 1 — Create the Xcode project

`ios/SETUP.md` is the authority and is written step by step. It covers the
project itself, the Clerk package, the Clerk dashboard's *Native applications*
entry, the Sign in with Apple capability, the seven fonts and the app icon.

Two of those steps fail **silently** rather than with an error, which is why
they are called out there and repeated here:

- **The Clerk dashboard native-app entry.** Without it, Sign in with Apple
  hangs forever with no message. Bundle id plus the App ID Prefix `G7K94LKBQH`.
- **The font registration.** A wrong or missing `UIAppFonts` entry falls back
  to the system font, which reads as "the design looks slightly off" rather
  than as a failure. `Theme.swift` has a **Fonts** preview whose rows must all
  show ✓. Check it once and you never wonder again.

## Phase 2 — The first build

Nothing in `ios/` has been through a compiler. Expect real errors. They will be
ordinary ones — this is a first build, not a broken codebase.

**Set the Swift Language Version to 5, not 6, for now.** Swift 6 turns strict
concurrency checking into errors, and an `@Observable` app state called from
`async` view tasks will produce dozens of actor-isolation complaints that have
nothing to do with whether the app works. Ship on 5; migrate later if ever.

Work through it with Claude on the Mac — it has the whole repo and `CLAUDE.md`
loads the context automatically. Build, paste the errors, fix, repeat. The
useful instruction is *"fix the compile errors without changing behaviour"*,
because the temptation at this stage is to redesign things that are merely
unfamiliar.

Then, in the simulator, walk the whole path once: sign up → onboarding →
Discover → save something → Business → Saved → commit to a product → Journey →
complete a milestone. That covers every screen and every one of the five app
states.

## Phase 3 — Before it can be reviewed

Four things. The first two are hard blockers.

### 1. A production Clerk instance

The key in `ClerkAuth.swift` is `pk_test_…`, a development instance. Clerk warns
about it at launch and development instances carry strict limits. Production is
**a different key and a different user pool** — every test account you made
disappears — so switch early enough to test with it rather than on submission
day. The server's `CLERK_SECRET_KEY` on Render has to move at the same time, or
the app and the API will disagree about who is signed in.

### 2. Put a real address on the support page

App Store Connect requires a **Support URL**. The page is deployed and live at
`https://sales-mechanic-api.onrender.com/support`, but
`server/content/legal/support.md` **still contains a placeholder**:

```
REPLACE-BEFORE-SUBMITTING@example.com
```

A dedicated address rather than a personal one — it is public on the listing
for as long as the app is, and a separate inbox is trivially handed off.
Replace the line, push `origin`, then verify:

```bash
curl -s https://sales-mechanic-api.onrender.com/support | grep -c REPLACE
```

Zero is what you want.

### 3. The cold start — the biggest review risk

Measured from cold on 2026-07-31: **20 seconds to first response.** The free
Render tier sleeps after inactivity. A reviewer opens the app, sees a spinner
for twenty seconds, and files it under Guideline 2.1 as broken.

The app does the right thing already — it shows *"Warming up — the server naps
when nobody is using it"* — but a reviewer is not obliged to read it, and the
first impression of a twenty-second wait is a broken app rather than a polite
one.

**Recommendation: upgrade the Render service to the paid tier (~$7/month)
before submitting.** It is the cheapest possible insurance against a rejection
that costs a week of round-trip. Downgrade again after approval if you want.

### 4. Set the encryption declaration

Add to the target's `Info.plist`:

```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

The app uses HTTPS and nothing else, which is exempt. Without the key, App
Store Connect asks the export-compliance question on **every single upload**.

## Phase 4 — App Store Connect

Create the app record. The answers that are already decided:

| field | value |
|---|---|
| Bundle ID | `com.ishaanchaturvedi.salesmechanic` |
| Privacy Policy URL | `https://sales-mechanic-api.onrender.com/privacy` |
| Support URL | `https://sales-mechanic-api.onrender.com/support` |
| Name | Venturo — **see the trademark note below** |
| Category | Business |
| Age rating | 13+, matching the age gate the app already enforces |

**The name has never been checked.** `TODO.md` item 10 — a trademark and domain
search for "Venturo" — is still open, and App Store Connect will simply refuse
a name another developer holds. Do this before writing any marketing copy, not
after.

### App Privacy — answer it from the code, not from memory

The privacy policy is accurate; make the questionnaire match it. Collected and
**linked to identity**:

- **Contact info** — name, email address; phone number if the user supplies one
- **User content** — business details, contacts, notes, sales
- **Identifiers** — the account id
- **Other data** — age (collected only to check 13+), and optionally gender,
  location, bio

Nothing is used for tracking or advertising, and there are no third-party
analytics SDKs in the app.

### The demo account — do not skip this

The app is entirely behind sign-in, so **Apple must be given working
credentials** in App Review Information or it is rejected on sight. Create one
on the *production* Clerk instance, run it through onboarding so it lands on a
populated Discover feed rather than an empty state, and paste the email and
password into the review notes.

Worth adding to the notes as well: that first launch may take ~20 seconds while
the server wakes, and that Discover content is served from the API.

### Screenshots

Capture from the simulator on the largest current iPhone; App Store Connect
lists the exact sizes it wants and will reject the wrong ones, so read them
there rather than trusting any list written down here. Five or six covering
Discover, a product card expanded, Grow, Business and the Journey sheet.

## Phase 5 — Upload and submit

1. Xcode → **Product → Archive** (Any iOS Device, not a simulator).
2. **Distribute App → App Store Connect → Upload.**
3. Wait for processing, then put the build on **TestFlight** and install it on
   your own phone. Do this even though it costs a day — the simulator does not
   catch Sign in with Apple problems, and Sign in with Apple is the one thing
   here that fails silently.
4. Attach the build to the app record, fill in description, keywords and
   promotional text, and **Submit for Review**.

First review is typically a day or two. A rejection is not a verdict — it is
usually one specific fixable thing, and the reply is a normal part of it.

---

## Ranked risks

1. **Cold start read as a broken app.** Twenty seconds, measured. $7 fixes it.
2. **No demo account.** An automatic rejection, and an avoidable one.
3. **Name collision on "Venturo".** Unchecked. Cheap to check, expensive late.
4. **Sign in with Apple hanging** because of the missing Clerk dashboard entry.
   Silent, and it will look like an app bug.
5. **Privacy answers not matching the policy.** Both exist; make them agree.

Not risks, despite being common ones: there is **no in-app purchase or paywall
anywhere in this build** — Growth's upgrade screen was never ported — so
Guideline 3.1.1 does not apply. Account deletion is in-app, which 5.1.1(v)
requires. Sign in with Apple is offered alongside Google, which 4.8 requires.
