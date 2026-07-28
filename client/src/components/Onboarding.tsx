import { useState, FormEvent } from 'react';
import { api, ApiError } from '../api/client';
import type { Business, BusinessType, Gender, SalesAvenue, UserProfile } from '../types';
import StarterToolkit from './StarterToolkit';

export const BUSINESS_TYPE_OPTIONS: { value: BusinessType; label: string }[] = [
  { value: 'PRODUCT_SALES', label: '📦 Products' },
  { value: 'SERVICE', label: '🛠️ Services' },
  { value: 'KNOWLEDGE', label: '🎓 Courses & coaching' },
  { value: 'OTHER', label: '✨ Something else' },
];

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'WOMAN', label: 'Woman' },
  { value: 'MAN', label: 'Man' },
  { value: 'NON_BINARY', label: 'Non-binary' },
  { value: 'OTHER', label: 'Other' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
];

export const AVENUE_OPTIONS: { value: SalesAvenue; label: string }[] = [
  { value: 'ETSY', label: '🧡 Etsy' },
  { value: 'SHOPIFY', label: '🛍️ Shopify' },
  { value: 'DEPOP', label: '👗 Depop' },
  { value: 'AMAZON', label: '📦 Amazon Handmade' },
  { value: 'EBAY', label: '🏷️ eBay' },
  { value: 'INSTAGRAM_SHOP', label: '📸 Instagram Shop' },
  { value: 'OWN_WEBSITE', label: '🌐 My own website' },
  { value: 'IN_PERSON', label: '🤝 In person' },
  { value: 'OTHER', label: '✨ Somewhere else' },
];

// Two-step wizard: who you are → what you're building.
// Only the essentials are required; everything else can wait for later
// (and filling it in later is its own mission).
export default function Onboarding({
  needsProfile,
  needsBusiness,
  onProfileCreated,
  onBusinessCreated,
}: {
  needsProfile: boolean;
  needsBusiness: boolean;
  onProfileCreated: (p: UserProfile) => void;
  onBusinessCreated: (b: Business) => void;
}) {
  const [step, setStep] = useState<'you' | 'business'>(needsProfile ? 'you' : 'business');

  // Step 1 — about you
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);

  // Step 2 — the business
  const [bizName, setBizName] = useState('');
  const [niche, setNiche] = useState('');
  const [description, setDescription] = useState('');
  const [avenues, setAvenues] = useState<SalesAvenue[]>([]);
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [showToolkit, setShowToolkit] = useState(false);

  const toggleAvenue = (a: SalesAvenue) =>
    setAvenues((list) => (list.includes(a) ? list.filter((x) => x !== a) : [...list, a]));

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalSteps = (needsProfile ? 1 : 0) + (needsBusiness ? 1 : 0);
  const stepNumber = step === 'you' ? 1 : needsProfile ? 2 : 1;

  const submitProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!gender) {
      setError('Pick the option that fits you best — "Prefer not to say" is always fine.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const profile = await api.createProfile({ name, email, age: Number(age), gender });
      onProfileCreated(profile);
      if (needsBusiness) setStep('business');
    } catch (err) {
      // A profile already exists (double-submit, second tab, another device):
      // adopt it and carry on rather than stranding the user on step 1.
      if (err instanceof ApiError && err.status === 409 && err.body?.profile) {
        onProfileCreated(err.body.profile);
        if (needsBusiness) setStep('business');
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const submitBusiness = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const business = await api.createBusiness({
        name: bizName,
        niche,
        description,
        salesAvenues: avenues.length ? avenues.join(',') : undefined,
        businessType: businessType ?? undefined,
      });
      onBusinessCreated(business);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: '60px auto', padding: 24 }}>
      <div className="brand-row">
        <span className="brand-mark">🔧</span> Venturo
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 style={{ marginBottom: 4, marginTop: 0 }}>
          {step === 'you' ? 'Your business deserves to be seen.' : 'Now the fun part.'}
        </h1>
        {totalSteps > 1 && (
          <span style={{ color: 'var(--text-dim)', fontSize: 13, whiteSpace: 'nowrap' }}>Step {stepNumber} of {totalSteps}</span>
        )}
      </div>

      {step === 'you' ? (
        <>
          <p style={{ color: 'var(--text-dim)', marginBottom: 28 }}>
            Big companies have sales teams. You have this. Set up takes under a minute — just the
            basics, and you can add the rest whenever you like.
          </p>
          <form onSubmit={submitProfile}>
            <div className="field">
              <label htmlFor="name">Your name</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="What should we call you?" />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
            </div>
            <div className="field" style={{ maxWidth: 120 }}>
              <label htmlFor="age">Age</label>
              <input id="age" type="number" min={13} max={120} value={age} onChange={(e) => setAge(e.target.value)} required />
            </div>
            <div className="field">
              <label>Gender</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {GENDER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`chip ${gender === opt.value ? 'selected' : ''}`}
                    onClick={() => setGender(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              Want to add a bio, location, or goals? You can do that anytime from My Business — it even earns you Wisdom. ✨
            </p>
            {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
            <button className="btn" type="submit" disabled={submitting} style={{ width: '100%', marginTop: 8 }}>
              {submitting ? 'Saving…' : needsBusiness ? 'Next: your business →' : 'Finish'}
            </button>
          </form>
        </>
      ) : (
        <>
          <p style={{ color: 'var(--text-dim)', marginBottom: 8 }}>
            What are you building? Don't overthink it — you can refine every word of this later.
          </p>
          <button
            type="button"
            onClick={() => setShowToolkit(true)}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 20, cursor: 'pointer' }}
          >
            🧰 Not sure what to sell yet? Open the Starter Toolkit →
          </button>
          <form onSubmit={submitBusiness}>
            <div className="field">
              <label>What kind of business?</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {BUSINESS_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`chip ${businessType === opt.value ? 'selected' : ''}`}
                    onClick={() => setBusinessType(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="bname">Business name</label>
              <input id="bname" value={bizName} onChange={(e) => setBizName(e.target.value)} required placeholder="e.g. Wildflower Ceramics" />
            </div>
            <div className="field">
              <label htmlFor="bniche">What do you sell?</label>
              <input id="bniche" value={niche} onChange={(e) => setNiche(e.target.value)} required placeholder="e.g. Handmade stoneware mugs" />
            </div>
            <div className="field">
              <label htmlFor="bdesc">Describe it in a sentence or two</label>
              <textarea id="bdesc" value={description} onChange={(e) => setDescription(e.target.value)} required rows={3} placeholder="What do you make, and who's it for?" />
            </div>
            <div className="field">
              <label>Where do you sell? (pick all that apply — or skip for now)</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {AVENUE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`chip ${avenues.includes(opt.value) ? 'selected' : ''}`}
                    onClick={() => toggleAvenue(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
            <button className="btn" type="submit" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? 'Creating…' : 'Start building 🚀'}
            </button>
          </form>
        </>
      )}

      {showToolkit && (
        <StarterToolkit
          onClose={() => setShowToolkit(false)}
          onPick={(type, nicheIdea) => {
            setBusinessType(type);
            if (nicheIdea && !niche) setNiche(nicheIdea);
            setShowToolkit(false);
          }}
        />
      )}
    </div>
  );
}
