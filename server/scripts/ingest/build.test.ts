import { describe as group, expect, it } from 'vitest';
import { buildProduct, cleanTitle, describe, resaleBand, slugify } from './build';
import { combine } from './score';
import type { Signal } from './types';

group('cleanTitle', () => {
  it('cuts supplier keyword soup down to the actual product', () => {
    expect(cleanTitle('2024 New Hot Sale Ceramic Coffee Mug, 350ml, Free Shipping | Gift'))
      .toBe('Ceramic Coffee Mug');
    expect(cleanTitle('Wholesale Dropshipping Self-Watering Planter Pot (Set of 3)'))
      .toBe('Self-Watering Planter Pot');
  });

  it('never exceeds a card-safe length', () => {
    expect(cleanTitle('A'.repeat(200)).length).toBeLessThanOrEqual(70);
  });
});

group('slugify', () => {
  it('produces a stable url-safe id', () => {
    expect(slugify('Ceramic Coffee Mug')).toBe('ceramic-coffee-mug');
    expect(slugify('  Self-Watering  Planter!! ')).toBe('self-watering-planter');
  });
});

group('describe', () => {
  it('writes from the numbers, and flags a crowded market honestly', () => {
    const crowded = describe(combine([
      { source: 'aliexpress', scope: 'product', unitsSold: 5000, price: 4 },
      { source: 'etsy', scope: 'category', listings: 3000 },
    ]));
    expect(crowded).toContain('5,000 sold');
    expect(crowded).toContain('crowded');

    const open = describe(combine([
      { source: 'aliexpress', scope: 'product', unitsSold: 5000, price: 4 },
      { source: 'etsy', scope: 'category', listings: 30 },
    ]));
    expect(open).toContain('barely anyone selling it yet');
  });

  it('says something sane when nothing reported numbers', () => {
    expect(describe(combine([]))).toBe('Surfaced by the trend feed.');
  });
});

group('resaleBand', () => {
  it('brackets a retail range off the unit cost', () => {
    expect(resaleBand(4)).toBe('$12–20');
    expect(resaleBand(0)).toBe('');
    expect(resaleBand(undefined)).toBe('');
  });
});

group('buildProduct', () => {
  const hit: Signal = {
    source: 'aliexpress',
    scope: 'product',
    productTitle: '2024 Hot Sale Self-Watering Globe Planter, Free Shipping',
    unitsSold: 2400,
    price: 4.2,
    url: 'https://s.click.aliexpress.com/x',
    imageUrl: 'https://ae01.alicdn.com/x.jpg',
  };
  const signals = combine([hit, { source: 'etsy', scope: 'category', listings: 90 }]);
  const p = buildProduct(hit, 'plants-planters', signals);

  it('matches the schema the hand-written products use', () => {
    for (const key of ['slug','nicheSlug','title','blurb','sourcingType','sourceName',
                       'sourcingUrl','sourceCost','typicalResale','hotness','imageQuery']) {
      expect(p, `missing ${key}`).toHaveProperty(key);
      expect(String((p as any)[key]).length, `empty ${key}`).toBeGreaterThan(0);
    }
  });

  it('carries the sourcing link and cost through', () => {
    expect(p.sourcingUrl).toBe(hit.url);
    expect(p.sourceCost).toBe('$4.20');
    expect(p.typicalResale).toBe('$13–21');
  });

  it('takes its hotness from the score, not a guess', () => {
    expect(p.hotness).toBe(signals.heat);
    expect(p.hotness).toBeGreaterThan(0);
    expect(p.hotness).toBeLessThanOrEqual(100);
  });

  it('attaches the evidence it was built from', () => {
    expect(p.signals.unitsSold).toBe(2400);
    expect(p.signals.sources).toContain('aliexpress');
  });

  it('leaves image credit blank rather than claiming one', () => {
    const noImage = buildProduct({ ...hit, imageUrl: undefined }, 'plants-planters', signals);
    expect(noImage.imageUrl).toBe('');
    expect(noImage.imageCredit).toBe('');
  });
});
