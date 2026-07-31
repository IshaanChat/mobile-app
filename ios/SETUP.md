# Setup, once, on the Mac

Everything here is a step Xcode or a dashboard has to do — nothing in this list
can be done from a text editor.

## 1. Xcode project

See `ios/README.md`. Bundle id must be `com.ishaanchaturvedi.salesmechanic` —
it is already registered with Apple and carries the certificate.

## 2. Clerk SDK

**File → Add Package Dependencies…**

```
https://github.com/clerk/clerk-ios
```

Dependency rule **Up to Next Major** from `1.3.5`. Add the **`ClerkKit`**
product only — not `ClerkKitUI`. The prebuilt views are where the closed-issue
history concentrates, and this app has its own screens anyway.

Requires **Xcode 26 / Swift 6.2**. That is stricter than the iOS 17 deployment
target implies and is the one prerequisite that would change the auth plan.

## 3. Clerk dashboard — the step everyone forgets

Clerk dashboard → **Configure → Native applications** → add:

- **Bundle ID**: `com.ishaanchaturvedi.salesmechanic`
- **App ID Prefix**: your team id, `G7K94LKBQH`

Skipping this is the most common cause of Sign in with Apple hanging with no
error. It fails silently, which makes it expensive to diagnose.

## 4. Capabilities

Target → **Signing & Capabilities** → **+ Capability** → **Sign in with Apple**.

EAS already enabled this on the bundle id at Apple's end on 2026-07-29, but the
Xcode target needs its own entitlement.

## 5. Fonts

Target → **Info** → **Fonts provided by application**, seven entries, listed in
`ios/README.md`. Then run the **Fonts** preview in `Theme.swift` — every row
must show ✓. A wrong PostScript name falls back to the system font *silently*,
which reads as "the design is slightly off" rather than as an error.

## 6. App icon

Drag `Resources/AppIcon-1024.png` into the 1024 slot. It is already full-bleed
and opaque. Do not round the corners — iOS masks its own squircle.

---

## Before the App Store, not before the first build

**Production Clerk keys.** `ClerkConfig.publishableKey` is a development
instance. Clerk warns about this at launch and it must not ship — development
instances carry strict limits. A production instance is a different key *and a
different user pool*, so switch early enough to test it rather than on
submission day.
