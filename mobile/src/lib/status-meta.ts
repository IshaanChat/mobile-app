// Friendly, journey-flavored presentation of the raw contact status enum.
// Ported from the web client so both surfaces describe the relationship
// journey identically; `color` is a theme key rather than a CSS variable.
//
// There's deliberately no emoji here. Status is carried by the
// prospect/engaged/customer colours, which are the same three the CRM uses
// everywhere else — a 🌱 next to a name would say the same thing twice, in
// a typeface we don't control.
import type { ContactStatus } from '@/types';

export const STATUS_META: Record<
  ContactStatus,
  { title: string; subtitle: string; color: 'prospect' | 'engaged' | 'customer' }
> = {
  PROSPECT: {
    title: 'New lead',
    subtitle: "Found them, haven't really talked yet",
    color: 'prospect',
  },
  ENGAGED: {
    title: 'In conversation',
    subtitle: "We're talking — there's something here",
    color: 'engaged',
  },
  CUSTOMER: {
    title: 'Customer',
    subtitle: "They've bought from me",
    color: 'customer',
  },
};

export const STATUS_ORDER: ContactStatus[] = ['PROSPECT', 'ENGAGED', 'CUSTOMER'];

export function statusLabel(status: ContactStatus): string {
  return STATUS_META[status].title;
}

export function money(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Burning the midnight oil';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}
