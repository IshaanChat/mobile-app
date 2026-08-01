# Venturo — working notes for Claude

Read `CLOUDKIT.md` first, then `HANDOFF.md`. This file is only the things that
change how you should *work* here.

## The app runs on CloudKit. There is no server and no sign-in.

Rewritten 2026-07-31. If you are reading advice about Clerk, Render, Postgres,
Prisma or `APIClient.swift`, it predates this and every part of it is reversed.

| where | what |
|---|---|
| `ios/` | the app. SwiftUI, iOS 17, **the only thing that ships** |
| `server/content/*.json` | the content database, still the source of truth |
| `server/scripts/cloudkit-*.ts` | schema, push and verify for CloudKit |
| `server/scripts/preview-app.ts` | the HTML prototype — **the design source of truth** |
| `server/src/` | the old Express API. **Dead.** Kept only until Render is torn down |
| `mobile/`, `client/` | Expo and React. Superseded, and now unrevivable — CloudKit is Apple-only by choice |

## You are here — 1 August 2026

Build **1.0 (2)** is uploaded to App Store Connect under the name **Venturo:
Start Your Venture** (plain "Venturo" was taken). Production CloudKit holds all
1195 content records. The legal pages are live at
`https://mobile-app-bf6.pages.dev/privacy` and `/support`. Six 1320x2868
screenshots sit in `~/Desktop/venturo-screenshots/`.

`SUBMISSION.md` has every piece of copy App Store Connect asks for, including
the App Privacy answers derived from the code. Nothing is submitted yet.

**Open, in rough priority:**

1. `trends/rank.ts` was never ported. Feed order is raw heat, and the match
   banner claims 744 of 886 products are relevant — so the highlight signals
   nothing. Quality problem, not a rejection risk.
2. Nine milestone triggers are unwired (`add-contact`, `log-sale`,
   `start-business` and the rest). They sit behind having a business.
3. Contacts, payments and the shelf are written and compile but have never run
   against real CloudKit.
4. `open-grow` fires while level four is locked, so locked levels can gain
   progress out of order. Decide whether that is wrong.

## Working on this Mac

`xcode-select` points at the Command Line Tools and the account is not an
admin, so **every Xcode command needs `DEVELOPER_DIR`**:

```bash
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
xcodebuild -project ios/Venturo.xcodeproj -scheme Venturo -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' build
```

That covers build, install, launch and screenshot. It does **not** cover the
Claude Code simulator tool, which reads the global setting — so tap and swipe
injection is unavailable until an admin runs
`sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`.

`origin` here is `IshaanChat/mobile-app`, the working remote, and is free to
push. The Render deploy remote is not configured on this clone. Older docs say
the opposite; they were written on the Windows machine where the remotes were
inverted.

## Things that will waste an hour if you don't know them

- **CloudKit Web Services will not create record types.** The native SDK does,
  over a server-to-server key nothing does — `create` fails exactly as
  `forceReplace` does. Schema lives in `scripts/lib/cloudkit-schema.ts`;
  `npm run cloudkit:schema` emits a `.ckdb` to import in the Console.
- **A missing index is silent.** A type whose `___recordID` is not QUERYABLE
  stores fine and lists as empty. `npm run cloudkit:verify` is what catches it.
- **The private database needs an iCloud account in the simulator.** Without
  one the app runs in `.browsing` and every private read returns empty, which
  looks like working code doing nothing.
- **`preview-app.ts` keeps ~1,700 lines inside one template literal.** A
  backtick anywhere in there ends the string, and `tsc --noEmit` does not catch
  it because TypeScript does not parse inside template literals.
- **`tsx` does not hot-reload.** Restart after every prototype change.
- **`server/.env` is not in git**, and neither is `cloudkit-key.pem`.

## Voice

The app's own copy — subtitles, empty states, toasts, milestone titles,
onboarding, celebrations — is plain, short, second person, with dry humour that
undercuts rather than cheerleads. `server/content/tips.json` is the reference
sample. Product and community write-ups are research and stay factual.

Two content rules that override "make it look finished": **don't invent data**
(an empty field beats a number nobody can stand behind — which is why the
profile email is now blank rather than fabricated), and **no scraping**.

## Before saying something works

Run it. The Swift compiles on this Mac, the app installs and launches in the
simulator, and screenshots are cheap — so "it should work" is never the report
to give. `npm test` (184) and `npm run cloudkit:verify` are both fast.

Say plainly which paths you actually exercised. The no-account path and the
content reads are verified; most of the private database is compiled and
unproven.
