// Fixture-driven: no network. The parsing and the usability filter are what
// decide whether a curator gets sent somewhere they can actually post, and
// both fail quietly — a restricted subreddit looks identical to an open one
// until someone tries to use it.

import { describe, expect, it } from 'vitest';
import { toSubreddit } from './reddit';

const raw = (over: Record<string, unknown> = {}) => ({
  data: {
    display_name: 'Pottery',
    title: 'Pottery',
    subscribers: 250000,
    accounts_active: 320,
    public_description: '  A community for potters.  ',
    over18: false,
    subreddit_type: 'public',
    created_utc: 1200000000,
    ...over,
  },
});

describe('toSubreddit', () => {
  it('reads the fields the Grow schema actually needs', () => {
    const s = toSubreddit(raw())!;
    expect(s.name).toBe('Pottery');
    expect(s.subscribers).toBe(250000);
    expect(s.url).toBe('https://www.reddit.com/r/Pottery/');
    // Trimmed: Reddit pads these with whitespace often enough to matter, and
    // it lands straight in a tagline.
    expect(s.publicDescription).toBe('A community for potters.');
  });

  it('reports zero rather than NaN for a missing count', () => {
    // A subreddit with no subscriber figure would otherwise produce NaN,
    // which compares false against every threshold and silently passes.
    expect(toSubreddit(raw({ subscribers: undefined }))!.subscribers).toBe(0);
  });

  it('carries the type through, because restricted subs are dead ends', () => {
    expect(toSubreddit(raw({ subreddit_type: 'restricted' }))!.type).toBe('restricted');
    expect(toSubreddit(raw({ subreddit_type: 'private' }))!.type).toBe('private');
  });

  it('returns nothing for a payload with no subreddit in it', () => {
    expect(toSubreddit({ data: {} })).toBeUndefined();
    expect(toSubreddit(null)).toBeUndefined();
  });

  it('accepts a bare object as well as a wrapped one', () => {
    // /subreddits/search wraps each result in { data }, /r/x/about does not.
    expect(toSubreddit({ display_name: 'Ceramics', subscribers: 10 })!.name).toBe('Ceramics');
  });
});
