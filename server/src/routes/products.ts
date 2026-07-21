import { Router } from 'express';
import { ah } from '../core/http';
import { prisma } from '../prisma';
import { assertOwnsBusiness } from '../core/auth';
import { normalizeUrl } from '../channelDetect';
import { emitEvent } from '../core/events';

export const productsRouter = Router();

const LOW_STOCK_THRESHOLD = 3;

productsRouter.get('/', ah(async (req, res) => {
  const businessId = await assertOwnsBusiness(req.userId, req.query.businessId);

  const products = await prisma.product.findMany({
    where: { businessId },
    orderBy: { createdAt: 'asc' },
  });

  const tracked = products.filter((p) => p.stock !== null);
  const inventoryValue = tracked.reduce((sum, p) => sum + (p.price ?? 0) * (p.stock ?? 0), 0);
  const lowStock = tracked.filter((p) => (p.stock ?? 0) <= LOW_STOCK_THRESHOLD).length;

  res.json({
    products,
    summary: {
      count: products.length,
      inventoryValue,
      lowStock,
      lowStockThreshold: LOW_STOCK_THRESHOLD,
    },
  });
}));

function parseProductBody(body: any): { data?: any; error?: string } {
  const { name, description, price, stock, sku, url } = body ?? {};
  if (name !== undefined && (!name || typeof name !== 'string')) return { error: 'name must be a non-empty string' };

  let parsedPrice: number | null | undefined = undefined;
  if (price !== undefined) {
    if (price === null || price === '') parsedPrice = null;
    else {
      const n = Number(price);
      if (!Number.isFinite(n) || n < 0) return { error: 'price must be a non-negative number' };
      parsedPrice = Math.round(n * 100) / 100;
    }
  }

  let parsedStock: number | null | undefined = undefined;
  if (stock !== undefined) {
    if (stock === null || stock === '') parsedStock = null;
    else {
      const n = Number(stock);
      if (!Number.isInteger(n) || n < 0) return { error: 'stock must be a non-negative whole number' };
      parsedStock = n;
    }
  }

  let parsedUrl: string | null | undefined = undefined;
  if (url !== undefined) {
    if (!url) parsedUrl = null;
    else {
      parsedUrl = normalizeUrl(url);
      if (!parsedUrl) return { error: "url doesn't look like a valid link" };
    }
  }

  return {
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(description !== undefined ? { description: description?.trim() || null } : {}),
      ...(parsedPrice !== undefined ? { price: parsedPrice } : {}),
      ...(parsedStock !== undefined ? { stock: parsedStock } : {}),
      ...(sku !== undefined ? { sku: sku?.trim() || null } : {}),
      ...(parsedUrl !== undefined ? { url: parsedUrl } : {}),
    },
  };
}

productsRouter.post('/', ah(async (req, res) => {
  const { name } = req.body ?? {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  const businessId = await assertOwnsBusiness(req.userId, req.body?.businessId);

  const parsed = parseProductBody(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const product = await prisma.product.create({ data: { businessId, ...parsed.data } });
  emitEvent('product.created', { businessId, payload: { productId: product.id, tracked: product.stock !== null } });
  res.status(201).json(product);
}));

productsRouter.patch('/:id', ah(async (req, res) => {
  const parsed = parseProductBody(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  try {
    const before = await prisma.product.findFirst({
      where: { id: req.params.id, business: { userId: req.userId } },
      select: { stock: true, businessId: true },
    });
    if (!before) return res.status(404).json({ error: 'Product not found' });
    const product = await prisma.product.update({ where: { id: req.params.id }, data: parsed.data });
    emitEvent('product.updated', { businessId: product.businessId, payload: { productId: product.id } });
    if (before && before.stock !== product.stock) {
      emitEvent('product.stock_changed', {
        businessId: product.businessId,
        payload: { productId: product.id, from: before.stock, to: product.stock },
      });
    }
    res.json(product);
  } catch {
    res.status(404).json({ error: 'Product not found' });
  }
}));

productsRouter.delete('/:id', ah(async (req, res) => {
  try {
    const owned = await prisma.product.findFirst({
      where: { id: req.params.id, business: { userId: req.userId } },
      select: { id: true },
    });
    if (!owned) return res.status(404).json({ error: 'Product not found' });
    const product = await prisma.product.delete({ where: { id: req.params.id } });
    emitEvent('product.deleted', { businessId: product.businessId, payload: { productId: product.id } });
  } catch {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.status(204).end();
}));
