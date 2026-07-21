import { Router } from 'express';
import { prisma } from '../prisma';
import { emitEvent } from '../core/events';

export const paymentsRouter = Router();

// Payments list + light insights. Intentionally simple for now.
paymentsRouter.get('/', async (req, res) => {
  const { businessId } = req.query;
  if (!businessId || typeof businessId !== 'string') {
    return res.status(400).json({ error: 'businessId query param is required' });
  }

  const payments = await prisma.payment.findMany({
    where: { businessId },
    orderBy: { occurredAt: 'desc' },
    include: {
      contact: { select: { id: true, name: true } },
      product: { select: { id: true, name: true } },
    },
  });

  const total = payments.reduce((sum, p) => sum + p.amount, 0);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonth = payments
    .filter((p) => p.occurredAt >= monthStart)
    .reduce((sum, p) => sum + p.amount, 0);

  const byClient = new Map<string, { name: string; total: number }>();
  for (const p of payments) {
    if (!p.contact) continue;
    const entry = byClient.get(p.contact.id) ?? { name: p.contact.name, total: 0 };
    entry.total += p.amount;
    byClient.set(p.contact.id, entry);
  }
  const topClient = [...byClient.values()].sort((a, b) => b.total - a.total)[0] ?? null;

  res.json({
    payments,
    summary: {
      total,
      thisMonth,
      count: payments.length,
      average: payments.length ? total / payments.length : 0,
      topClient,
    },
  });
});

paymentsRouter.post('/', async (req, res) => {
  const { businessId, amount, note, contactId, occurredAt, productId, quantity } = req.body ?? {};
  if (!businessId) return res.status(400).json({ error: 'businessId is required' });
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }
  const qty = quantity ? Number(quantity) : 1;
  if (!Number.isInteger(qty) || qty < 1) {
    return res.status(400).json({ error: 'quantity must be a positive whole number' });
  }

  const payment = await prisma.payment.create({
    data: {
      businessId,
      amount: Math.round(parsed * 100) / 100,
      note: note?.trim() || null,
      contactId: contactId || null,
      productId: productId || null,
      quantity: qty,
      occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
    },
    include: {
      contact: { select: { id: true, name: true } },
      product: { select: { id: true, name: true } },
    },
  });

  // A sale of a stock-tracked product reduces inventory automatically.
  if (productId) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (product && product.stock !== null) {
      const newStock = Math.max(0, product.stock - qty);
      await prisma.product.update({ where: { id: productId }, data: { stock: newStock } });
      emitEvent('product.stock_changed', {
        businessId,
        payload: { productId, from: product.stock, to: newStock, reason: 'sale' },
      });
    }
  }

  emitEvent('payment.recorded', {
    businessId,
    payload: { amount: payment.amount, hasClient: Boolean(payment.contactId), hasProduct: Boolean(productId), quantity: qty },
  });
  res.status(201).json(payment);
});

paymentsRouter.delete('/:id', async (req, res) => {
  await prisma.payment.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
