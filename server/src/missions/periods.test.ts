import { describe, it, expect } from 'vitest';
import { periodKeyFor, periodStartFor, levelForXp } from './definitions';

describe('periodKeyFor', () => {
  it('gives one-time missions a constant key', () => {
    expect(periodKeyFor('once', new Date('2026-03-14T12:00:00'))).toBe('once');
    expect(periodKeyFor('once', new Date('2027-11-02T12:00:00'))).toBe('once');
  });

  it('rolls the daily key over at midnight, not before', () => {
    const lateNight = periodKeyFor('daily', new Date('2026-03-14T23:59:00'));
    const justAfter = periodKeyFor('daily', new Date('2026-03-15T00:01:00'));
    expect(lateNight).toBe('2026-03-14');
    expect(justAfter).toBe('2026-03-15');
    expect(lateNight).not.toBe(justAfter);
  });

  it('keeps the same weekly key across a week and changes on Monday', () => {
    // 2026-03-16 is a Monday.
    const monday = periodKeyFor('weekly', new Date('2026-03-16T09:00:00'));
    const sunday = periodKeyFor('weekly', new Date('2026-03-22T22:00:00'));
    const nextMonday = periodKeyFor('weekly', new Date('2026-03-23T09:00:00'));
    expect(monday).toBe(sunday);
    expect(nextMonday).not.toBe(monday);
  });

  it('rolls the monthly key on the 1st', () => {
    expect(periodKeyFor('monthly', new Date('2026-03-31T23:00:00'))).toBe('2026-03');
    expect(periodKeyFor('monthly', new Date('2026-04-01T00:30:00'))).toBe('2026-04');
  });

  it('zero-pads months and days so keys sort chronologically', () => {
    expect(periodKeyFor('daily', new Date('2026-01-05T10:00:00'))).toBe('2026-01-05');
    expect(periodKeyFor('monthly', new Date('2026-09-01T10:00:00'))).toBe('2026-09');
  });

  it('handles the new-year boundary without collapsing weeks', () => {
    const dec = periodKeyFor('weekly', new Date('2026-12-30T10:00:00'));
    const jan = periodKeyFor('weekly', new Date('2027-01-06T10:00:00'));
    expect(dec).not.toBe(jan);
  });
});

describe('periodStartFor', () => {
  it('has no start date for one-time missions', () => {
    expect(periodStartFor('once')).toBeNull();
  });

  it('starts the day at midnight', () => {
    const start = periodStartFor('daily', new Date('2026-03-14T15:23:45'))!;
    expect(start.getHours()).toBe(0);
    expect(start.getDate()).toBe(14);
  });

  it('starts the week on Monday, including when today is Sunday', () => {
    // 2026-03-22 is a Sunday; its week should start Monday the 16th.
    const start = periodStartFor('weekly', new Date('2026-03-22T15:00:00'))!;
    expect(start.getDay()).toBe(1);
    expect(start.getDate()).toBe(16);
  });

  it('starts the month on the 1st', () => {
    const start = periodStartFor('monthly', new Date('2026-03-22T15:00:00'))!;
    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(2);
  });

  it('never returns a start in the future', () => {
    for (const cadence of ['daily', 'weekly', 'monthly'] as const) {
      expect(periodStartFor(cadence)!.getTime()).toBeLessThanOrEqual(Date.now());
    }
  });
});

describe('levelForXp', () => {
  it('starts a brand-new user at level 1', () => {
    const lvl = levelForXp(0);
    expect(lvl.level).toBe(1);
    expect(lvl.name).toBe('Dreamer I');
  });

  it('never exceeds 100 levels, even with absurd Wisdom', () => {
    const lvl = levelForXp(10_000_000);
    expect(lvl.level).toBeLessThanOrEqual(100);
    expect(lvl.nextThreshold).toBeNull();
  });

  it('increases monotonically with Wisdom', () => {
    let previous = 0;
    for (const xp of [0, 50, 150, 400, 1000, 5000, 20000]) {
      const { level } = levelForXp(xp);
      expect(level).toBeGreaterThanOrEqual(previous);
      previous = level;
    }
  });

  it('walks the tier ladder in order as levels climb', () => {
    const names = [0, 500, 2000, 5000, 10000, 20000].map((xp) => levelForXp(xp).name.split(' ')[0]);
    const ladder = ['Dreamer', 'Novice', 'Apprentice', 'Artisan', 'Adept', 'Expert', 'Master', 'Sage', 'Luminary', 'Guru'];
    // Each tier seen must appear no earlier in the ladder than the one before.
    let lastIndex = -1;
    for (const name of names) {
      const idx = ladder.indexOf(name);
      expect(idx).toBeGreaterThanOrEqual(lastIndex);
      lastIndex = idx;
    }
  });

  it('reports a next threshold that is always above current Wisdom', () => {
    for (const xp of [0, 75, 500, 3000]) {
      const { nextThreshold } = levelForXp(xp);
      if (nextThreshold !== null) expect(nextThreshold).toBeGreaterThan(xp);
    }
  });
});
