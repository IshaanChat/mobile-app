# Venturo — working notes for Claude

Read `HANDOFF.md` first. It is the map of the project and is kept current.
This file is only the things that change how you should *work* here.

## Which directory is authoritative

| directory | what it is |
|---|---|
| `server/` | the API, the content database, every script. Live on Render. |
| `ios/` | native SwiftUI. **The shipping client.** |
| `server/scripts/preview-app.ts` | the HTML prototype — **the design source of truth** |
| `mobile/` | Expo. Parked. Only the written spec for the API contract. |
| `client/` | the original web app. Superseded. |

When `ios/` and the prototype disagree, the prototype is right. `client/` is a
*feature* reference — which screens and endpoints exist — and never a design
reference; following it silently reproduces the old product's structure.

## Stale documents — do not follow

- **`SHIPPING.md` was rewritten on 2026-07-31.** If you are reading a version
  that recommends Railway, says "nothing here is built yet", or says to use
  React Native instead of Swift, it is the old one and every recommendation in
  it has since been reversed.
- **`README.md` and `ARCHITECTURE.md` describe `client/`**, the superseded web
  app, and are stale beyond the rename.
- `TODO.md` is a finished day's list kept for its two open items at the end.

## Things that will waste an hour if you don't know them

- **`preview-app.ts` keeps ~1,700 lines inside one template literal.** A
  backtick anywhere in there — including in a comment — ends the string.
  `tsc --noEmit` does not catch it because TypeScript does not parse inside
  template literals. Only starting the server does.
- **`tsx` does not hot-reload.** Restart after every prototype change.
- **`ios/` has never been compiled.** There is no `.xcodeproj` in the repo; it
  has to be generated once by Xcode. Nothing in `ios/` has ever been checked by
  a compiler, so treat "it looks right" accordingly.
- **Underscore-prefixed files in `server/content/` are staging, not content.**
  Loaders and importers skip them. 95 blank cards once rendered live because
  they did not.
- **`server/.env` is not in git.** A fresh clone cannot run the ingest scripts
  or reach the database until it is recreated.

## Git

Two remotes on one tree. `github-mobile` (`IshaanChat/mobile-app`) is the
working remote — push every checkpoint there freely. `origin`
(`IshaanChat/sales-mechanic`) **deploys to Render**: never push it without the
user explicitly saying so, in this conversation.

## Voice

The app's own copy — subtitles, empty states, toasts, milestone titles,
onboarding, celebrations — is written plain, short, second person, with dry
humour that undercuts rather than cheerleads. `server/content/tips.json` is the
reference sample. Product and community write-ups are research and stay
factual.

Two content rules that override "make it look finished": **don't invent data**
(an empty field beats a number nobody can stand behind), and **no scraping** —
official APIs and manual research only.

## Before saying something works

Run it. `npm test` (173) and `npm run smoke` (56, needs `npm run dev` in
another terminal) are both fast. Swift cannot be compiled anywhere except the
Mac, so say so rather than implying it was checked.
