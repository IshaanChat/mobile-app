# Privacy Policy

The policy now lives at **`server/content/legal/privacy.md`** and is served
publicly at **`/privacy`** by the API.

It moved for a deployment reason, not a tidiness one: `render.yaml` sets
`rootDir: server`, so anything above that directory is outside what the service
is built from. A policy at the repo root reads fine locally and 404s in
production — which, for the URL App Store Connect requires, is the worst place
to discover it.

Edit the Markdown there and redeploy; `src/routes/legal.ts` renders it at
startup.

## What changed on 2026-07-30

The previous draft was rewritten because it had become false. It said *"it
stores it on your own machine. We don't have a server, so we can't see your
data"* — written when that was true, and left in place after the app moved to
Render, Neon and Clerk. It also carried five unfilled `[BRACKET]` placeholders
and a section headed "delete before publishing".

The current version names all three sub-processors and where they hold data,
describes the export and deletion paths that now exist, and gives a real
contact address.
