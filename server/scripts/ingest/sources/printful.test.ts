// Fixture-driven: no network. Two things here fail silently if wrong — a
// match floor that's too low prices a potter's mug as a sublimation blank,
// and a scope leak lets a supplier's catalog masquerade as demand. Both
// produce a plausible number rather than an error, so both are pinned.

import { describe, expect, it } from 'vitest';
import { bestMatch, cheapestPrice, scoreMatch, type CatalogEntry } from './printful';
import { combine } from '../score';

const catalog: CatalogEntry[] = [
  { id: 71, title: 'Unisex Staple T-Shirt', type: 'T-SHIRT', type_name: 'T-Shirt | Staple', variant_count: 590 },
  { id: 12, title: 'Unisex Tri-Blend T-Shirt', type: 'T-SHIRT', type_name: 'T-Shirt | Tri-Blend', variant_count: 60 },
  { id: 938, title: 'Luggage Tag', type: 'DECOR', type_name: 'Tag | Luggage', variant_count: 1 },
  { id: 1, title: 'Enhanced Matte Paper Poster', type: 'POSTER', type_name: 'Poster | Matte', variant_count: 30 },
  { id: 19, title: 'White Glossy Mug', type: 'DRINKWARE', type_name: 'Mug | Glossy', variant_count: 4 },
  { id: 2, title: 'Enhanced Matte Paper Framed Poster (in)', type: 'FRAMED-POSTER', type_name: 'Paper Poster (in) | Framed | Matte', variant_count: 100 },
  { id: 20, title: 'Unisex Crew Neck Sweatshirt', type: 'SWEATSHIRT', type_name: 'Sweatshirt | Crew Neck', variant_count: 200 },
  { id: 21, title: 'Embroidered Crew Neck Sweatshirt', type: 'EMBROIDERY', type_name: 'Sweatshirt | Embroidered', variant_count: 400 },
  { id: 99, title: 'Retired Ringer Tee', type: 'T-SHIRT', type_name: 'T-Shirt | Ringer', variant_count: 800, is_discontinued: true },
];

describe('scoreMatch', () => {
  it('reads the type when the useful word is not in the title', () => {
    // "Luggage Tag" is the title, but "Tag | Luggage" is where the phrasing a
    // curator would write actually lives. Matching title alone missed these.
    expect(scoreMatch('luggage tags', catalog[2])).toBe(1);
  });

  it('ignores the words every product row uses', () => {
    // "Custom" and "printed" appear in half the catalog's copy and carry no
    // signal — scoring them would make everything match everything.
    expect(scoreMatch('custom printed poster', catalog[3])).toBe(1);
  });

  it('treats a plural as the thing itself', () => {
    expect(scoreMatch('glossy mugs', catalog[4])).toBe(1);
  });
});

describe('bestMatch', () => {
  it('finds the blank a POD row is printed on', () => {
    expect(bestMatch('Hometown varsity tees', catalog)?.id).toBe(71);
  });

  it('breaks a tie toward the line with more variants', () => {
    // Both tees match "unisex t-shirt" equally; the staple line is the one a
    // beginner should be quoted, not a niche fabric.
    expect(bestMatch('unisex t-shirt', catalog)?.id).toBe(71);
  });

  it('never quotes a discontinued blank, and falls back to a live one', () => {
    // The ringer is the closest match by wording and cannot be ordered. A
    // live tee is the useful answer; the retired line must not be it.
    const hit = bestMatch('ringer tee', catalog);
    expect(hit?.id).not.toBe(99);
    expect(hit?.id).toBe(71);
  });

  it('scores past the design words the supplier cannot know', () => {
    // "Gym" and "slogan" describe the artwork, not the garment. An earlier
    // version counted them against the blank, which capped every genuine
    // match below the floor and matched nothing at all.
    expect(bestMatch('Gym-slogan crop tops', catalog)).toBeUndefined();
  });

  it('reads a bare "print" as the poster it is, at either number', () => {
    // Regression, found against the live catalog. "print" sat in the stop
    // list, so it was deleted before the synonym map could reach it — while
    // "prints" survived and became a poster. One row priced, the next blank,
    // for no reason visible in the data.
    expect(bestMatch('Vintage-botanical print sets', catalog)?.id).toBe(1);
    expect(bestMatch('Custom star-map prints', catalog)?.id).toBe(1);
  });

  it('reads a star-map print as the poster it is printed on', () => {
    expect(bestMatch('Custom star-map prints', catalog)?.id).toBe(1);
  });

  it('returns nothing when no word is one the supplier knows', () => {
    // The real protection against a wrong price: silence beats a least-bad
    // guess. Note this is NOT what keeps a potter's mug out — "hand-thrown
    // latte mugs" contains "mug" and Printful does sell a mug. Only
    // sourcingType can make that call, and run.ts makes it by asking this
    // adapter about PRINT_ON_DEMAND rows and nothing else.
    expect(bestMatch('Hand-dipped beeswax tapers', catalog)).toBeUndefined();
  });
});

describe('upgrade lines', () => {
  it('quotes the plain sheet, not the framed one', () => {
    // Regression, found live: the framed poster carries every size the plain
    // one does, so depth alone picked it — $20.35 against $5.39, making the
    // margin look four times worse than the business actually is.
    expect(bestMatch('Custom star-map prints', catalog)?.id).toBe(1);
  });

  it('still pays for the upgrade when the row asked for it', () => {
    // Embroidery is the product here, not an upsell, even though the plain
    // crew neck would otherwise be preferred.
    expect(bestMatch('Niche-humor embroidered sweatshirts', catalog)?.id).toBe(21);
  });

  it('does not pay for embroidery nobody asked for', () => {
    // The embroidered line has twice the variants, so depth would take it.
    expect(bestMatch('Hometown varsity sweatshirts', catalog)?.id).toBe(20);
  });
});

describe('cheapestPrice', () => {
  it('takes the lowest, because that is the cost a starter batch can hit', () => {
    // A 3001 runs $13.69 in 2XL and less in S; the mean overstates the entry
    // price a beginner is actually planning around.
    expect(cheapestPrice([{ id: 1, price: '13.69' }, { id: 2, price: '9.25' }, { id: 3, price: '15.69' }])).toBe(9.25);
  });

  it('skips variants that are not a price', () => {
    expect(cheapestPrice([{ id: 1, price: '0' }, { id: 2, price: 'n/a' }, { id: 3, price: '11.00' }])).toBe(11);
  });

  it('reports nothing rather than zero when no variant prices', () => {
    expect(cheapestPrice([])).toBeUndefined();
  });
});

describe('scope discipline', () => {
  const signal = {
    source: 'printful' as const,
    scope: 'supply' as const,
    price: 9.25,
    liveSourcingUrl: 'https://www.printful.com/custom/71',
    liveMerchant: 'Printful',
  };

  it('contributes a price and carries the live listing through', () => {
    const s = combine([signal]);
    expect(s.priceLow).toBe(9.25);
    expect(s.liveMerchant).toBe('Printful');
  });

  it('never claims anyone bought anything', () => {
    // Printful knows what a blank costs and nothing about whether the market
    // wants yours. A supplier catalog reporting demand is the exact failure
    // the scope gate exists to stop.
    const s = combine([signal]);
    expect(s.unitsSold).toBeUndefined();
    expect(s.listings).toBeUndefined();
  });

  it('leaves a product with only a supplier price cold', () => {
    // A cost is not a reason to be excited. Heat must stay at the floor until
    // something measures the market.
    expect(combine([signal]).heat).toBe(0);
  });
});
