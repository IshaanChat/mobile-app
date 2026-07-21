import type { ContactStatus } from './types';

// Friendly, journey-flavored presentation of the raw status enum.
export const STATUS_META: Record<
  ContactStatus,
  { emoji: string; title: string; subtitle: string; color: string }
> = {
  PROSPECT: {
    emoji: '🌱',
    title: 'New lead',
    subtitle: "Found them, haven't really talked yet",
    color: 'var(--prospect)',
  },
  ENGAGED: {
    emoji: '💬',
    title: 'In conversation',
    subtitle: "We're talking — there's something here",
    color: 'var(--engaged)',
  },
  CUSTOMER: {
    emoji: '⭐',
    title: 'Customer',
    subtitle: "They've bought from me",
    color: 'var(--customer)',
  },
};

export const STATUS_ORDER: ContactStatus[] = ['PROSPECT', 'ENGAGED', 'CUSTOMER'];

export function statusLabel(status: ContactStatus): string {
  const meta = STATUS_META[status];
  return `${meta.emoji} ${meta.title}`;
}
