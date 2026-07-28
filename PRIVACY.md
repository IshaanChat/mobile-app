# Privacy Policy — DRAFT

> **This is a working draft, not legal advice.** It accurately describes what
> the software currently does, which is the hard part and the part only you
> can supply. Have a lawyer review it before publishing, especially if you
> take payment or accept users in the EU/UK or California.
>
> Placeholders in `[BRACKETS]` need filling in.
>
> Last reviewed against the code: initial draft.

---

## The short version

Venturo helps you keep track of the people you sell to. To do that it
stores what you type in, and — right now — it stores it **on your own machine**.
We don't have a server, so we can't see your data.

That changes if and when a hosted version launches, and this policy will be
updated before it does.

---

## What we collect

**About you**, when you create your profile:
- Required: name, email address, age, gender
- Optional, only if you choose to add them: location, phone number, bio, prior
  business experience, and your goals

**About your business:** name, what you sell, description, ideal customer
description, audience keywords, sales channels, your business page link, and
links to your social accounts.

**About your clients and prospects** — this is data *you* enter about *other
people*: their name, the link where you found them, notes you write, the
interactions you log, and any payments you attribute to them.

**About your products:** name, description, price, stock levels, SKU, listing
links.

**About your use of the app:** a local record of significant actions (a client
added, a sale recorded, a mission completed) so the app can show you your own
history and progress.

## An important note about your clients' data

When you add a client to Venturo, you are storing personal information
about someone else. Under laws like the GDPR that makes **you** responsible for
that data, and Venturo a tool you use to process it.

In practice: only record what you genuinely need for your business
relationship, and if one of your clients asks you to delete what you hold about
them, you can delete that contact and everything attached to them from within
the app.

## Where your data lives

Currently: in a database file on your own computer (`server/prisma/dev.db`).
It is never transmitted to us, because there is no "us" server to transmit it
to. If you back that file up, your backup is your responsibility.

## If you connect your own AI

Discover can use an AI model to recommend places to find customers. If you
configure one, your business name, description, niche, ideal customer,
keywords, and social links are sent to **the server you chose**, at the address
you entered. We don't run it, don't see it, and don't control what it does with
that data. If you use a third-party API rather than a model you host, their
privacy policy applies to that data.

If you configure no AI, no business information leaves your machine.

## What we don't do

- We don't sell your data.
- We don't use it for advertising.
- We don't scrape social media or marketplaces on your behalf. Discover
  suggests public communities to visit; it does not harvest people from them.
- We don't share your client list with anyone.

## Your choices

- **See everything we hold:** it's your database file. `[LINK TO EXPORT
  FEATURE ONCE BUILT]`
- **Delete a client:** removes them and all their interactions and links.
- **Delete a business:** removes it and everything inside it.
- **Delete everything:** delete the database file, or `[ACCOUNT DELETION
  ONCE HOSTED]`.

## Children

Venturo is not intended for anyone under 13, and the app will not
accept an age below 13.

## Changes

If this policy changes materially — above all, if a hosted version starts
storing your data on our servers — you'll be told in the app before it takes
effect.

## Contact

`[YOUR CONTACT EMAIL]`
`[YOUR BUSINESS ENTITY AND ADDRESS, IF ANY]`

---

## Notes for the hosted version (delete before publishing)

When the app moves to a server, this policy needs to gain:

- Who the data controller is (you, or a company you form)
- Legal basis for processing under GDPR (likely contract + legitimate
  interest), and a lawful basis for the *gender* field specifically, since
  ambiguous "special category"-adjacent fields attract scrutiny — consider
  whether it is genuinely needed, or should become optional
- Named sub-processors: the hosting provider, the database provider, the auth
  provider, the error tracker
- Data retention periods, and what happens to data after account deletion
- International transfer terms if the hosting region differs from users'
- Cookie/session disclosure once authentication exists
- A Data Processing Addendum offer, since your users are controllers of their
  own clients' data
- CCPA/CPRA "do not sell" language for California
