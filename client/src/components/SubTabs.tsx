// Secondary pill navigation for dividing a tab into focused sub-pages.

export default function SubTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: T; label: string }[];
  active: T;
  onChange: (key: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '16px 24px 0' }}>
      {tabs.map((t) => (
        <button
          key={t.key}
          className={`chip ${active === t.key ? 'selected' : ''}`}
          onClick={() => onChange(t.key)}
          style={{ fontSize: 13 }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
