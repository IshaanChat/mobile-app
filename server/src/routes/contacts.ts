import { Router } from 'express';
import { ah } from '../core/http';
import { prisma } from '../prisma';
import { computeScores } from '../scoring';
import { detectChannel, normalizeUrl } from '../channelDetect';
import { emitEvent } from '../core/events';
import { assertOwnsBusiness } from '../core/auth';

export const contactsRouter = Router();

const VALID_STATUSES = ['PROSPECT', 'ENGAGED', 'CUSTOMER'];
const VALID_INTERACTION_TYPES = ['MESSAGE', 'MEETING', 'PURCHASE', 'REVIEW', 'OTHER'];
// "No link" fallbacks the client can send instead of a URL.
const NO_LINK_KINDS: Record<string, { type: string; label: string }> = {
  REFERRAL: { type: 'REFERRAL', label: 'Referral' },
  IN_PERSON: { type: 'OTHER', label: 'In person' },
  OTHER: { type: 'OTHER', label: 'Other' },
};

contactsRouter.get('/', ah(async (req, res) => {
  const { channelId } = req.query;
  const businessId = await assertOwnsBusiness(req.userId, req.query.businessId);
  const contacts = await prisma.contact.findMany({
    where: {
      businessId,
      ...(typeof channelId === 'string' ? { channelId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(contacts);
}));

contactsRouter.get('/:id', ah(async (req, res) => {
  const contact = await prisma.contact.findFirst({
    where: { id: req.params.id, business: { userId: req.userId } },
    include: {
      interactions: { orderBy: { occurredAt: 'desc' } },
      channel: true,
    },
  });
  if (!contact) return res.status(404).json({ error: 'Contact not found' });
  res.json(contact);
}));

// Preview endpoint so the client can show a live "detected channel" badge
// while the user types/pastes a URL.
contactsRouter.get('/detect-channel/preview', ah(async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'url query param required' });
  const detected = detectChannel(url);
  if (!detected) return res.json(null);
  res.json(detected);
}));

// Create a contact. Channel resolution, in priority order:
//   1. sourceUrl  -> detect platform from domain, find-or-create that channel
//   2. noLinkKind -> REFERRAL / IN_PERSON / OTHER fallback channel
//   3. channelId  -> explicit existing channel (legacy path)
// If firstNote is provided, it is logged as the contact's first interaction
// so the relationship starts with a heartbeat instead of a zero score.
contactsRouter.post('/', ah(async (req, res) => {
  const { name, status, sourceUrl, noLinkKind, channelId, firstNote } = req.body ?? {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  const businessId = await assertOwnsBusiness(req.userId, req.body?.businessId);
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join(', ')}` });
  }

  let resolvedChannelId: string | null = null;
  let normalizedSourceUrl: string | null = null;

  if (sourceUrl) {
    normalizedSourceUrl = normalizeUrl(sourceUrl);
    if (!normalizedSourceUrl) {
      return res.status(400).json({ error: "That link doesn't look like a valid URL" });
    }
    const detected = detectChannel(sourceUrl)!;
    const existing = await prisma.channel.findFirst({
      where: { businessId, type: detected.type, label: detected.label },
    });
    const channel =
      existing ??
      (await prisma.channel.create({
        data: { businessId, type: detected.type, label: detected.label, url: normalizedSourceUrl },
      }));
    resolvedChannelId = channel.id;
  } else if (noLinkKind) {
    const kind = NO_LINK_KINDS[noLinkKind];
    if (!kind) {
      return res.status(400).json({ error: `noLinkKind must be one of ${Object.keys(NO_LINK_KINDS).join(', ')}` });
    }
    const existing = await prisma.channel.findFirst({
      where: { businessId, type: kind.type, label: kind.label },
    });
    const channel = existing ?? (await prisma.channel.create({ data: { businessId, type: kind.type, label: kind.label } }));
    resolvedChannelId = channel.id;
  } else if (channelId) {
    resolvedChannelId = channelId;
  } else {
    return res.status(400).json({ error: 'Provide a sourceUrl, a noLinkKind, or a channelId' });
  }

  const contact = await prisma.contact.create({
    data: {
      businessId,
      channelId: resolvedChannelId!,
      name,
      sourceUrl: normalizedSourceUrl,
      status: status || 'PROSPECT',
    },
  });

  if (firstNote && typeof firstNote === 'string' && firstNote.trim()) {
    await prisma.interaction.create({
      data: { contactId: contact.id, type: 'MESSAGE', note: firstNote.trim(), weight: 1 },
    });
    const biz = await prisma.business.findUnique({ where: { id: businessId }, select: { businessType: true } });
    const { relationshipStrength, engagementScore } = computeScores(
      [{ occurredAt: new Date(), weight: 1 }],
      biz?.businessType
    );
    await prisma.contact.update({
      where: { id: contact.id },
      data: { relationshipStrength, engagementScore },
    });
  }

  emitEvent('contact.created', {
    businessId,
    payload: { contactId: contact.id, status: contact.status, viaUrl: Boolean(normalizedSourceUrl) },
  });

  const full = await prisma.contact.findUnique({
    where: { id: contact.id },
    include: { interactions: true, channel: true },
  });
  res.status(201).json(full);
}));

contactsRouter.patch('/:id', ah(async (req, res) => {
  const { name, notes, status } = req.body ?? {};
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join(', ')}` });
  }
  const owned = await prisma.contact.findFirst({
    where: { id: req.params.id, business: { userId: req.userId } },
    select: { status: true },
  });
  if (!owned) return res.status(404).json({ error: 'Contact not found' });
  const before = status ? owned : null;
  const contact = await prisma.contact.update({
    where: { id: req.params.id },
    data: { name, notes, status },
  });
  if (status && before && before.status !== status) {
    emitEvent('contact.status_changed', {
      businessId: contact.businessId,
      payload: { contactId: contact.id, from: before.status, to: status },
    });
  }
  res.json(contact);
}));

contactsRouter.delete('/:id', ah(async (req, res) => {
  const owned = await prisma.contact.findFirst({
    where: { id: req.params.id, business: { userId: req.userId } },
    select: { id: true },
  });
  if (!owned) return res.status(404).json({ error: 'Contact not found' });
  await prisma.contact.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

// Log a new interaction and recompute the contact's relationship/engagement scores.
contactsRouter.post('/:id/interactions', ah(async (req, res) => {
  const { type, note, weight, occurredAt } = req.body ?? {};
  if (!type || !VALID_INTERACTION_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of ${VALID_INTERACTION_TYPES.join(', ')}` });
  }
  const parsedWeight = weight ? Number(weight) : 1;
  if (!Number.isFinite(parsedWeight) || parsedWeight < 1 || parsedWeight > 5) {
    return res.status(400).json({ error: 'weight must be a number between 1 and 5' });
  }

  const contactId = req.params.id;
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, business: { userId: req.userId } },
    include: { business: { select: { businessType: true } } },
  });
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  await prisma.interaction.create({
    data: {
      contactId,
      type,
      note: note || null,
      weight: parsedWeight,
      occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
    },
  });

  const allInteractions = await prisma.interaction.findMany({ where: { contactId } });
  const { relationshipStrength, engagementScore } = computeScores(
    allInteractions.map((i) => ({ occurredAt: i.occurredAt, weight: i.weight })),
    contact.business.businessType
  );

  emitEvent('interaction.logged', {
    businessId: contact.businessId,
    payload: { contactId, interactionType: type, weight: parsedWeight },
  });

  const updatedContact = await prisma.contact.update({
    where: { id: contactId },
    data: { relationshipStrength, engagementScore },
    include: { interactions: { orderBy: { occurredAt: 'desc' } }, channel: true },
  });

  res.status(201).json(updatedContact);
}));
