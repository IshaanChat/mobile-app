// Internal event bus — the decoupling seam between feature modules.
//
// Feature routes PUBLISH events describing what happened; modules that care
// (analytics today; notifications, digests, webhooks tomorrow) SUBSCRIBE.
// Features never import each other directly — only this bus and core/.

import { EventEmitter } from 'events';

export type AppEventType =
  | 'profile.created'
  | 'profile.updated'
  | 'business.created'
  | 'business.updated'
  | 'business.deleted'
  | 'contact.created'
  | 'contact.status_changed'
  | 'interaction.logged'
  | 'payment.recorded'
  | 'mission.completed'
  // The five-level journey. Deliberately distinct from `mission.completed`,
  // which belongs to the older cadence-based board — the two count different
  // things, and merging them would make either number meaningless.
  | 'milestone.completed'
  | 'discover.generated'
  | 'socials.saved'
  | 'product.created'
  | 'product.updated'
  | 'product.deleted'
  | 'product.stock_changed'
  | 'trend.saved'
  | 'trend.unsaved'
  | 'trend.dismissed'
  | 'growth.generated'
  | 'growth.post_viewed';

export interface AppEventPayload {
  type: AppEventType;
  businessId?: string;
  payload?: Record<string, unknown>;
}

const bus = new EventEmitter();
const CHANNEL = 'app-event';

export function emitEvent(type: AppEventType, data: Omit<AppEventPayload, 'type'> = {}) {
  bus.emit(CHANNEL, { type, ...data } satisfies AppEventPayload);
}

export function onEvent(handler: (event: AppEventPayload) => void) {
  bus.on(CHANNEL, handler);
}
