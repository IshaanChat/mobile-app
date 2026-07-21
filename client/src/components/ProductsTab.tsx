import { useEffect, useState, FormEvent } from 'react';
import { api } from '../api/client';
import type { Product, ProductsPayload } from '../types';
import Modal from './Modal';

function money(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default function ProductsTab({
  businessId,
  onChanged,
}: {
  businessId: string;
  onChanged: () => void;
}) {
  const [data, setData] = useState<ProductsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | 'new' | null>(null);

  const load = () => {
    api.getProducts(businessId).then(setData).catch((e) => setError(e.message));
  };

  useEffect(load, [businessId]);

  const adjustStock = async (product: Product, delta: number) => {
    if (product.stock === null) return;
    const next = Math.max(0, product.stock + delta);
    await api.updateProduct(product.id, { stock: next });
    load();
    onChanged();
  };

  const remove = async (product: Product) => {
    await api.deleteProduct(product.id);
    load();
    onChanged();
  };

  return (
    <div style={{ padding: 24, maxWidth: 860 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Products & offerings 🏷️</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginTop: 0 }}>
            What you sell, what it costs, and what's on the shelf.
          </p>
        </div>
        <button className="btn" onClick={() => setEditing('new')}>+ Add product</button>
      </div>

      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      {!data && !error && <p style={{ color: 'var(--text-dim)' }}>Loading…</p>}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, margin: '20px 0 28px' }}>
            <StatCard label="In your catalog" value={String(data.summary.count)} />
            <StatCard label="Inventory value" value={money(data.summary.inventoryValue)} accent />
            <StatCard
              label="Low stock"
              value={String(data.summary.lowStock)}
              danger={data.summary.lowStock > 0}
              sub={`≤ ${data.summary.lowStockThreshold} left`}
            />
          </div>

          {data.products.length === 0 ? (
            <div style={{ padding: '20px 24px', background: 'var(--panel)', border: '1px solid var(--panel-border)', borderRadius: 12 }}>
              <strong>Nothing on the shelf yet.</strong>
              <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 0 }}>
                Add what you sell — a product, a service package, a course. Give people something to say yes to.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.products.map((p) => {
                const low = p.stock !== null && p.stock <= data.summary.lowStockThreshold;
                return (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                      background: 'var(--panel)', border: `1px solid ${low ? 'var(--danger)' : 'var(--panel-border)'}`,
                      borderRadius: 12, padding: '12px 16px', boxShadow: 'var(--shadow)',
                    }}
                  >
                    <div style={{ minWidth: 180, flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {p.name}
                        {p.sku && <span style={{ color: 'var(--text-dim)', fontWeight: 400, fontSize: 12 }}> · {p.sku}</span>}
                        {p.url && (
                          <a href={p.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: 12, marginLeft: 6 }}>
                            listing ↗
                          </a>
                        )}
                      </div>
                      {p.description && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{p.description}</div>}
                    </div>

                    <div style={{ fontWeight: 700, fontSize: 14, minWidth: 70, textAlign: 'right' }}>
                      {p.price !== null ? money(p.price) : <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>—</span>}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 130, justifyContent: 'flex-end' }}>
                      {p.stock === null ? (
                        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>stock not tracked</span>
                      ) : (
                        <>
                          <button className="btn-secondary" style={{ padding: '2px 10px' }} onClick={() => adjustStock(p, -1)}>−</button>
                          <span style={{ fontWeight: 700, minWidth: 28, textAlign: 'center', color: low ? 'var(--danger)' : 'var(--text)' }}>
                            {p.stock}
                          </span>
                          <button className="btn-secondary" style={{ padding: '2px 10px' }} onClick={() => adjustStock(p, 1)}>+</button>
                        </>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-secondary" style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => setEditing(p)}>
                        Edit
                      </button>
                      <button
                        className="btn-secondary"
                        style={{ fontSize: 12, padding: '4px 10px', color: 'var(--danger)' }}
                        onClick={() => remove(p)}
                        title="Remove from catalog"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {editing && (
        <ProductModal
          businessId={businessId}
          product={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function ProductModal({
  businessId,
  product,
  onClose,
  onSaved,
}: {
  businessId: string;
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(product?.price !== null && product !== null ? String(product.price) : '');
  const [trackStock, setTrackStock] = useState(product ? product.stock !== null : true);
  const [stock, setStock] = useState(product?.stock !== null && product !== null ? String(product.stock) : '0');
  const [sku, setSku] = useState(product?.sku ?? '');
  const [url, setUrl] = useState(product?.url ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const payload = {
      name,
      description: description || undefined,
      price: price === '' ? null : Number(price),
      stock: trackStock ? Number(stock || 0) : null,
      sku: sku || undefined,
      url: url || undefined,
    };
    try {
      if (product) await api.updateProduct(product.id, payload);
      else await api.createProduct({ businessId, ...payload });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  };

  return (
    <Modal title={product ? `Edit ${product.name}` : 'Add a product or offering'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="prodname">Name</label>
          <input id="prodname" value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder='e.g. "Speckled stoneware mug" or "1:1 coaching session"' />
        </div>
        <div className="field">
          <label htmlFor="proddesc">Description (optional)</label>
          <input id="proddesc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="prodprice">Price (USD, optional)</label>
            <input id="prodprice" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="prodsku">SKU (optional)</label>
            <input id="prodsku" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="MUG-001" />
          </div>
        </div>
        <div className="field">
          <label>Inventory</label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
            <button type="button" className={`chip ${trackStock ? 'selected' : ''}`} onClick={() => setTrackStock(true)}>
              📦 Track stock
            </button>
            <button type="button" className={`chip ${!trackStock ? 'selected' : ''}`} onClick={() => setTrackStock(false)}>
              ∞ Not tracked (service / digital / made-to-order)
            </button>
            {trackStock && (
              <input
                type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)}
                style={{ width: 90 }} aria-label="Units in stock"
              />
            )}
          </div>
        </div>
        <div className="field">
          <label htmlFor="produrl">Listing link (optional)</label>
          <input id="produrl" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="etsy.com/listing/… or your booking page" />
        </div>
        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
        <button className="btn" type="submit" disabled={submitting} style={{ width: '100%' }}>
          {submitting ? 'Saving…' : product ? 'Save changes' : 'Add to catalog'}
        </button>
      </form>
    </Modal>
  );
}

function StatCard({ label, value, sub, accent, danger }: { label: string; value: string; sub?: string; accent?: boolean; danger?: boolean }) {
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)', borderRadius: 12, padding: '14px 16px', boxShadow: 'var(--shadow)' }}>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: danger ? 'var(--danger)' : accent ? 'var(--customer)' : 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
