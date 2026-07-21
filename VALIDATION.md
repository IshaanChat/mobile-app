# Validation Kit

Everything built so far is a hypothesis. This is the plan for finding out
whether it's true, before spending months on hosting, auth and iOS.

Target: **10–20 conversations, 5+ people actually using it, within 3 weeks.**

---

## 1. The interview script

Rules, borrowed from *The Mom Test*: ask about their **past behaviour**, not
their opinion of your idea. People are polite about ideas and honest about
what they actually did. **Do not demo until the end** — once they've seen it,
every answer is contaminated by politeness.

Talk less than they do. Silence is a tool.

**Warm-up**
1. "Tell me about your shop — what do you make, and how long have you been at
   it?"

**The five questions that matter**
2. "Walk me through the last time you got a new customer. What actually
   happened, step by step?"
   *(Listening for: where customers come from, whether it felt lucky or
   deliberate.)*

3. "How do you keep track of people who might buy from you?"
   → then: **"Can you show me?"**
   *(A spreadsheet, DMs, notes app, or nothing at all. What they actually
   open is worth more than what they describe.)*

4. "When did you last follow up with someone who didn't buy the first time?
   How did that go?"
   *(This is the app's core claim. If nobody follows up and nobody feels bad
   about it, the premise is weak.)*

5. "What's the hardest part of getting customers, honestly?"
   *(Let them talk. Don't lead toward your feature list.)*

6. "Have you tried any tools for this? What happened to them?"
   *(Why tools get abandoned is the single most useful answer you'll get —
   it's your retention risk, described in advance.)*

**Money signal**
7. "What's the last thing you paid for to help your business — and what did it
   cost?"
   *(Establishes real willingness to pay, without asking the useless question
   "would you pay for this?")*

**Only now: show the app.** 90 seconds, then stop talking and watch.

**Close with a commitment, not a compliment.** "That's interesting" is worth
nothing. Ask for something that costs them time, reputation or money:
- "Can I set you up with it and check in next week?" (time)
- "Who else do you know who'd have opinions on this?" (reputation)
- "If this saved you an hour a week, would $7/month be fair?" (money)

Write down which of the three they gave you. That's your real result.

---

## 2. Where to find them

Ordered by yield, not convenience. The app's own Discover tab suggests most of
these — use your own product.

**Highest yield — in person**
1. Local craft fairs, farmers' markets, maker markets. Sellers are standing at
   a table, bored between customers, and love talking about their business.
   Ten conversations in an afternoon, and nobody ignores you.
2. Local maker spaces / pottery studios / co-working days.

**Medium — communities where you participate first**
3. r/EtsySellers, r/smallbusiness, r/somethingimade — *contribute for a week
   before asking anything*. A "tell me about your process" post outperforms a
   "check out my app" post by a wide margin.
4. Etsy Community Forums.
5. Facebook groups for handmade sellers (search "handmade sellers", "Etsy
   sellers", plus your city).
6. Maker Discord servers.

**Lower yield but scalable**
7. Instagram #smallbusinesscheck / #craftbusiness — comment genuinely on posts
   for a week, then DM the people who reply.
8. TikTok creators posting studio vlogs — comment, don't cold-DM.
9. Your own network: everyone knows somebody with an Etsy shop. Ask.
10. Build in public on X/TikTok — slowest to start, compounds the most.

**A warning:** cold DMs to strangers convert badly and can get accounts
flagged. The in-person and participate-first routes are slower per contact and
dramatically better per hour.

---

## 3. The demo (60–90 seconds)

Record it once, use it everywhere. Script:

1. **The problem, in their words** (10s) — "You've got customers in your DMs,
   your inbox, and a notebook. Nobody follows up because it's exhausting."
2. **Home** (15s) — "This is your business at a glance: who's gone quiet,
   what's selling, what to do next."
3. **Add a client from a link** (20s) — paste an Instagram URL, watch the
   channel get detected. "It knows where they came from."
4. **Log an interaction** (15s) — show the relationship score rise and the
   mission complete. "It keeps score so you don't have to."
5. **Discover** (20s) — "And when you need new people, it tells you where
   they already are."
6. **Stop.** Don't show settings, don't explain the architecture.

Use the demo database (`~/sales-mechanic-backups/`), not an empty one — the
app is unconvincing with no data in it.

---

## 4. The three metrics

These decide whether to keep going. Everything else is vanity.

| Metric | Target | Why |
|---|---|---|
| **Day-7 return** | >40% | Do they come back at all? |
| **Weekly active logging** | >50% log ≥1 interaction/week | Is it a habit or a novelty? |
| **Reached "First sale"** | >25% | Does it produce the outcome it promises? |

### Measuring them now (single-user, local)

The `AppEvent` table already records everything needed. Against
`server/prisma/dev.db`:

```sql
-- Distinct days with any activity (a crude retention curve)
SELECT date(createdAt) AS day, COUNT(*) AS events
FROM AppEvent GROUP BY day ORDER BY day;

-- Interactions logged per week
SELECT strftime('%Y-W%W', createdAt) AS week, COUNT(*) AS interactions
FROM AppEvent WHERE type = 'interaction.logged'
GROUP BY week ORDER BY week;

-- Did they reach the first sale?
SELECT createdAt, payload FROM AppEvent
WHERE type = 'mission.completed' AND payload LIKE '%first_sale%';

-- Which features get touched at all (find the dead weight)
SELECT type, COUNT(*) FROM AppEvent GROUP BY type ORDER BY 2 DESC;
```

That last query is the one to run after a tester has had the app a week: **any
event type with a count of zero is a feature nobody used.** Consider cutting
it rather than polishing it.

### Measuring them once hosted

Same queries, grouped by user id. Add `userId` to `AppEvent` during the auth
work — it costs nothing then and is painful to backfill later.

### The honest failure condition

If, after 5 testers have had it for two weeks:
- fewer than half opened it a second week, **and**
- almost nobody logged interactions unprompted,

then the gamification isn't carrying retention, and the answer is
**integrations** (CSV import, Etsy/Stripe sync) rather than more missions —
because the real problem will be that manual entry is a tax nobody wants to
pay. Decide that from the data, not from a feeling.

---

## 5. Three-week plan

**Week 1** — fortify (see TODO.md), record the demo, join three communities
and *participate*, line up one craft fair to attend.

**Week 2** — 10 interviews. Do not change the product mid-week; you'll lose
the ability to compare answers. Take notes in the same format every time.

**Week 3** — set up 5 people with the app. Check in day 3 and day 10. Then run
the queries above and decide: build integrations, keep iterating on the
coach, or stop.

Whatever the answer, that's a real result — which is more than most
idea-stage projects ever get.
