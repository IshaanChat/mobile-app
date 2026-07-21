import { useState } from 'react';
import type { Channel, Contact } from '../types';
import ContactsTab from './ContactsTab';
import ActivityTab from './ActivityTab';
import SubTabs from './SubTabs';

type ClientsSubTab = 'book' | 'activity';

const CLIENT_SUBTABS: { key: ClientsSubTab; label: string }[] = [
  { key: 'book', label: '📖 Client book' },
  { key: 'activity', label: '⚡ Activity' },
];

export default function ClientsTab({
  businessId,
  channels,
  contacts,
  refreshKey,
  onSelectContact,
  onAddContact,
}: {
  businessId: string;
  channels: Channel[];
  contacts: Contact[];
  refreshKey: number;
  onSelectContact: (id: string) => void;
  onAddContact: () => void;
}) {
  const [sub, setSub] = useState<ClientsSubTab>('book');

  return (
    <div>
      <SubTabs tabs={CLIENT_SUBTABS} active={sub} onChange={setSub} />
      {sub === 'book' && (
        <ContactsTab
          channels={channels}
          contacts={contacts}
          onSelectContact={onSelectContact}
          onAddContact={onAddContact}
        />
      )}
      {sub === 'activity' && <ActivityTab businessId={businessId} refreshKey={refreshKey} />}
    </div>
  );
}
