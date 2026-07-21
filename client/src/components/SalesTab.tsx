import type { Contact } from '../types';
import ProductsTab from './ProductsTab';
import FinancesTab from './FinancesTab';
import SubTabs from './SubTabs';

export type SalesSubTab = 'products' | 'money';

const SALES_SUBTABS: { key: SalesSubTab; label: string }[] = [
  { key: 'products', label: '🏷️ Products' },
  { key: 'money', label: '💵 Money' },
];

// Controlled sub-tab so quick actions elsewhere can deep-link into a section.
export default function SalesTab({
  businessId,
  contacts,
  sub,
  onSubChange,
  onChanged,
}: {
  businessId: string;
  contacts: Contact[];
  sub: SalesSubTab;
  onSubChange: (sub: SalesSubTab) => void;
  onChanged: () => void;
}) {
  return (
    <div>
      <SubTabs tabs={SALES_SUBTABS} active={sub} onChange={onSubChange} />
      {sub === 'products' && <ProductsTab businessId={businessId} onChanged={onChanged} />}
      {sub === 'money' && <FinancesTab businessId={businessId} contacts={contacts} onRecorded={onChanged} />}
    </div>
  );
}
