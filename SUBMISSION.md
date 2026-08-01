# App Store submission — the copy, ready to paste

Everything App Store Connect asks for that is not a screenshot. Written from
what the app actually does, because the privacy answers in particular have to
match the code rather than the intention.

Character limits are Apple's and are enforced; the counts below are real.

---

## Name and subtitle

**Name** (30) — already set

```
Venturo: Start Your Venture
```

**Subtitle** (30) — shown under the name in search and on the product page

```
Big companies have sales teams
```

That is the app's own opening line and exactly 30 characters. An alternative
if you want the promise rather than the joke: `From idea to your first sale`
(28).

## Promotional text (170)

Editable without a new build or review, so this is the line to change when
something is worth announcing.

```
Find something worth selling, see what it costs and what it sells for, and get walked from idea to first sale. No sign-up. Your data stays in your own iCloud.
```

## Keywords (100, comma-separated, no spaces after commas)

Do not repeat the app name or subtitle — Apple already indexes those, and
duplicates waste the budget. This is 100 characters exactly; dropping a term
before adding one is the only way to change it.

```
side hustle,small business,ecommerce,dropshipping,etsy seller,handmade,product research,crm,reseller
```

## Description (4000)

```
Venturo walks you from "I want to start a business" to your first sale.

Most people who sell things online had no idea how, either. You do not need a
product, a plan, or a clue where to start.

FIND SOMETHING WORTH SELLING
886 researched products with what each costs to source and what it typically
sells for. Real numbers from real listings, not guesses. Filter by whether you
want to make things or resell them, and bookmark anything worth coming back to.

ANSWER TWO QUESTIONS, GET A REAL ANSWER
Tell Venturo what you lose track of time doing, or what has been stopping you.
It comes back with an actual product matched to your words, what it costs, what
it sells for, and how many sales it takes to clear $500.

KNOW WHERE YOUR BUYERS ALREADY ARE
166 researched communities — what each one is about, what it rewards, what it
punishes, and how to show up without being the person selling at people.

ONE NEXT THING, ALWAYS
34 steps across five levels, from opening the feed to logging your first sale.
Each one tells you what to do and takes you where to do it. Nothing is a wall
of homework; there is only ever one next thing.

KEEP TRACK OF THE PEOPLE
Log the people who showed interest, not just the ones who bought. Venturo
scores each relationship on how recently, how often and how much — so the list
tells you who your business actually rests on.

NO ACCOUNT, NO SIGN-UP
There is no password and nothing to create. Browsing works with no account at
all. What you keep is written to your own iCloud, syncs to your other devices,
and cannot be read by us — not "we choose not to", we have no access.

Nothing here is business or financial advice. It is a tool for keeping track
and for finding somewhere to start.
```

## What's New (first release)

Leave blank, or:

```
First release.
```

---

## App Privacy — answer from the code, not from memory

The questionnaire is where a wrong answer becomes a policy violation later.
This app collects **less** than most, and less than its own older versions.

**Do you collect data from this app?** → **Yes**

Then, for each type, Apple asks: collected, linked to identity, used for
tracking, and purpose.

| data type | collected | linked to user | tracking | purpose |
|---|---|---|---|---|
| **Name** | Yes | Yes | **No** | App Functionality |
| **Email Address** | Yes | Yes | **No** | App Functionality |
| **Other User Contact Info** *(the contacts they add)* | Yes | Yes | **No** | App Functionality |
| **Other Data** *(age, bio, location if given)* | Yes | Yes | **No** | App Functionality |
| **Other Usage Data** *(business, sales, notes, progress)* | Yes | Yes | **No** | App Functionality |

Everything else — identifiers, purchases, location services, contacts from the
address book, browsing history, diagnostics, advertising data — is **not
collected**.

**Tracking is No for every single row.** There is no analytics SDK, no ad
network, no third-party framework of any kind in the binary, and nothing is
shared with anyone.

Email is optional and blank by default: there is no sign-in to take it from, so
it is only present if the user types it in You → About you. Say Yes anyway —
the questionnaire asks what the app *can* collect.

---

## App Review Information

**Sign-in required?** → **No.** This is unusual enough that it is worth saying
plainly in the notes, because a reviewer who assumes a wall will go looking for
one.

**Notes to reviewer:**

```
No account is needed to review this app. There is no sign-up, no password and
no login screen — open it and the Discover feed loads immediately.

The app uses CloudKit. Public content (products, communities, tips, the
journey) is readable with no iCloud account at all. Anything the user keeps —
profile, business, clients, sales, progress — is written to their own iCloud
private database, which is why there is no server and no credentials to give
you.

To see the full experience including onboarding, sign the test device into any
iCloud account and reopen the app.

Account deletion is in-app under You → Settings → Delete my account. It removes
the app's entire private CloudKit zone in one operation.

There are no in-app purchases, no subscriptions, no paywall and no advertising
in this build.
```

**Contact:** your name, phone, and `ishaanchtrvdi@gmail.com`.

---

## The rest of the version page

| field | value |
|---|---|
| Privacy Policy URL | `https://mobile-app-bf6.pages.dev/privacy` |
| Support URL | `https://mobile-app-bf6.pages.dev/support` |
| Marketing URL | leave blank |
| Category | Business *(secondary: Education is defensible)* |
| Age Rating | 13+, matching the gate onboarding enforces |
| Price | Free |
| Availability | all territories, unless you want to start narrow |
| Content Rights | **Yes** — it shows third-party content. See the note below |

### One honest wrinkle on Content Rights

The product images are supplier listing photographs (AliExpress) and free-licence
photographs (Pexels), loaded from their own hosts. Apple's question is about
whether your app *displays* third-party content, and it does.

Answering "Yes, it contains, shows, or accesses third-party content" is the
truthful answer. It does not block anything; it just means you are asserting
you have the right to show it, which you do — Pexels is free-licence with
photographer credit shown in-app, and supplier images arrive with the
dropshipping arrangement.

---

## Guidelines that do not apply

- **3.1.1 In-App Purchase** — there is no purchase of any kind in this build.
- **4.8 Sign in with Apple** — there is no third-party sign-in to require it
  alongside.
- **5.1.1(v) Account Deletion** — satisfied, in-app, one operation.
- **2.1 Performance** — no server means no cold start to be mistaken for a
  hang.

## The order to do it in

1. Upload build 2 and let it finish processing.
2. Fill the version page: screenshots, description, keywords, promotional text.
3. Answer App Privacy.
4. Write the review notes above.
5. Select build 2, then **Add for Review** → **Submit**.

First review is usually 24–48 hours. A rejection is normally one specific
fixable thing and a reply, not a verdict.
