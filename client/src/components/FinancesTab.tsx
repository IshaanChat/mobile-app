import { useEffect, useState, FormEvent } from 'react';
import { api } from '../api/client';
import type { Contact, PaymentsPayload, Product } from '../types';
import Modal from './Modal';

function money(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default function FinancesTab({
  businessId,
  contacts,
  onRecorded,
}: {
  businessId: string;
  contacts: Contact[];
  onRecorded: () => void;
}) {
  const [data, setData] = useState<PaymentsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRecord, setShowRecord] = useState(false);

  const load = () => {
    api.getPayments(businessId).then(setData).catch((e) => setError(e.message));
  };

  useEffect(load, [businessId]);

  const remove = async (id: string) => {
    await api.deletePayment(id);
    load();
  };

  return (
    <div style={{ padding: 24, maxWidth: 820 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Finances 💵</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginTop: 0 }}>
            Money in, at a glance. Record what you earn and watch the story build.
          </p>
        </div>
        <button className="btn" onClick={() => setShowRecord(true)}>+ Record payment</button>
      </div>

      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      {!data && !error && <p style={{ color: 'var(--text-dim)' }}>Loading…</p>}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, margin: '20px 0 28px' }}>
            <StatCard label="Total revenue" value={money(data.summary.total)} />
            <StatCard label="This month" value={money(data.summary.thisMonth)} accent />
            <StatCard label="Payments recorded" value={String(data.summary.count)} />
            <StatCard label="Average payment" value={money(data.summary.average)} />
            {data.summary.topClient && (
              <StatCard label="Top client" value={data.summary.topClient.name} sub={money(data.summary.topClient.total)} />
            )}
          </div>

          {data.payments.length === 0 ? (
            <div style={{ padding: '20px 24px', background: 'var(--panel)', border: '1px solid var(--panel-border)', borderRadius: 12 }}>
              <strong>No payments recorded yet.</strong>
              <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 0 }}>
                When money comes in — from any avenue — record it here. Even small numbers tell you what's working.
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-dim)', fontSize: 12, borderBottom: '1px solid var(--panel-border)' }}>
                  <th style={{ padding: '8px 12px 8px 0' }}>Date</th>
                  <th style={{ padding: '8px 12px' }}>Client</th>
                  <th style={{ padding: '8px 12px' }}>Note</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '8px 0 8px 12px' }} />
                </tr>
              </thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--panel-border)' }}>
                    <td style={{ padding: '10px 12px 10px 0', color: 'var(--text-dim)' }}>
                      {new Date(p.occurredAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '10px 12px' }}>{p.contact?.name ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-dim)' }}>
                      {p.product && (
                        <span style={{ color: 'var(--text)', fontWeight: 500 }}>
                          {p.product.name}{p.quantity > 1 ? ` ×${p.quantity}` : ''}
                        </span>
                      )}
                      {p.product && p.note ? ' · ' : ''}
                      {p.note ?? ''}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--customer)' }}>
                      {money(p.amount)}
                    </td>
                    <td style={{ padding: '10px 0 10px 12px', textAlign: 'right' }}>
                      <button
                        className="btn-secondary"
                        onClick={() => remove(p.id)}
                        style={{ padding: '2px 10px', fontSize: 12 }}
                        title="Delete this payment"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {showRecord && (
        <RecordPaymentModal
          businessId={businessId}
          contacts={contacts}
          onClose={() => setShowRecord(false)}
          onRecorded={() => {
            setShowRecord(false);
            load();
            onRecorded();
          }}
        />
      )}
    </div>
  );
}

function RecordPaymentModal({
  businessId,
  contacts,
  onClose,
  onRecorded,
}: {
  businessId: string;
  contacts: Contact[];
  onClose: () => void;
  onRecorded: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [contactId, setContactId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [products, setProducts] = useState<Product[]>([]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getProducts(businessId).then((d) => setProducts(d.products)).catch(() => {});
  }, [businessId]);

  // Picking a product with a price autofills the amount (still editable).
  const pickProduct = (id: string) => {
    setProductId(id);
    const product = products.find((p) => p.id === id);
    if (product?.price != null) {
      setAmount(String(Math.round(product.price * Number(quantity || 1) * 100) / 100));
    }
  };

  const changeQuantity = (q: string) => {
    setQuantity(q);
    const product = products.find((p) => p.id === productId);
    if (product?.price != null && q) {
      setAmount(String(Math.round(product.price * Number(q) * 100) / 100));
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.createPayment({
        businessId,
        amount: Number(amount),
        note: note || undefined,
        contactId: contactId || null,
        productId: productId || null,
        quantity: Number(quantity || 1),
      });
      onRecorded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Record a payment" onClose={onClose}>
      <form onSubmit={submit}>
        {products.length > 0 && (
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="pproduct">What did they buy? (optional)</label>
              <select id="pproduct" value={productId} onChange={(e) => pickProduct(e.target.value)}>
                <option value="">— Not tied to a product —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.price != null ? ` (${p.price.toLocaleString('en-US', { style: 'currency', currency: 'USD' })})` : ''}
                  </option>
                ))}
              </select>
            </div>
            {productId && (
              <div className="field" style={{ width: 80 }}>
                <label htmlFor="pqty">Qty</label>
                <input id="pqty" type="number" min="1" step="1" value={quantity} onChange={(e) => changeQuantity(e.target.value)} />
              </div>
            )}
          </div>
        )}
        {productId && (
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: -6 }}>
            Stock updates automatically when you record this sale.
          </p>
        )}
        <div className="field" style={{ maxWidth: 160 }}>
          <label htmlFor="amount">Amount (USD)</label>
          <input
            id="amount" type="number" min="0.01" step="0.01" value={amount}
            onChange={(e) => setAmount(e.target.value)} required autoFocus placeholder="0.00"
          />
        </div>
        <div className="field">
          <label htmlFor="pclient">From which client? (optional)</label>
          <select id="pclient" value={contactId} onChange={(e) => setContactId(e.target.value)}>
            <option value="">— Not tied to a client —</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="pnote">Note (optional)</label>
          <input id="pnote" value={note} onChange={(e) => setNote(e.target.value)} placeholder='e.g. "Custom order — 2 mugs"' />
        </div>
        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
        <button className="btn" type="submit" disabled={submitting} style={{ width: '100%' }}>
          {submitting ? 'Recording…' : 'Record it 💰'}
        </button>
      </form>
    </Modal>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)', borderRadius: 12, padding: '14px 16px', boxShadow: 'var(--shadow)' }}>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: accent ? 'var(--customer)' : 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
