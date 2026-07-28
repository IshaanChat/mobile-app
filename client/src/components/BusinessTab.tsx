import { useEffect, useState, FormEvent } from 'react';
import { api } from '../api/client';
import type { AppSettings, Business, ExperienceLevel, Gender, LlmTestResult, SalesAvenue, SocialPlatform, UserProfile } from '../types';
import { AVENUE_OPTIONS, BUSINESS_TYPE_OPTIONS } from './Onboarding';
import type { BusinessType } from '../types';
import SubTabs from './SubTabs';

type BizSubTab = 'business' | 'profile' | 'socials' | 'settings';

const BIZ_SUBTABS: { key: BizSubTab; label: string }[] = [
  { key: 'business', label: '🏪 Business' },
  { key: 'profile', label: '👤 About you' },
  { key: 'socials', label: '🌐 Socials' },
  { key: 'settings', label: '⚙️ Settings' },
];
import { getTheme, setTheme, getCoolingOffDays, setCoolingOffDays, Theme } from '../appSettings';
import Modal from './Modal';

export default function BusinessTab({
  business,
  businesses,
  profile,
  onProfileUpdated,
  onSocialsSaved,
  onSwitchBusiness,
  onBusinessCreated,
  onBusinessUpdated,
  onBusinessDeleted,
}: {
  business: Business;
  businesses: Business[];
  profile: UserProfile;
  onProfileUpdated: (p: UserProfile) => void;
  onSocialsSaved: () => void;
  onSwitchBusiness: (id: string) => void;
  onBusinessCreated: (b: Business) => void;
  onBusinessUpdated: (b: Business) => void;
  onBusinessDeleted: (id: string) => void;
}) {
  const [sub, setSub] = useState<BizSubTab>('business');

  return (
    <div>
      <SubTabs tabs={BIZ_SUBTABS} active={sub} onChange={setSub} />
      <div style={{ padding: 24, maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 28 }}>
        {sub === 'business' && (
          <>
            <ProfileSection business={business} onBusinessUpdated={onBusinessUpdated} />
            <BusinessesSection
              business={business}
              businesses={businesses}
              onSwitchBusiness={onSwitchBusiness}
              onBusinessCreated={onBusinessCreated}
              onBusinessDeleted={onBusinessDeleted}
            />
          </>
        )}
        {sub === 'profile' && <AboutYouSection profile={profile} onProfileUpdated={onProfileUpdated} />}
        {sub === 'socials' && <SocialsSection businessId={business.id} onSaved={onSocialsSaved} />}
        {sub === 'settings' && (
          <>
            <AppearanceSection />
            <RelationshipSection />
            <AiSection />
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- About you ---------- */

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'WOMAN', label: 'Woman' },
  { value: 'MAN', label: 'Man' },
  { value: 'NON_BINARY', label: 'Non-binary' },
  { value: 'OTHER', label: 'Other' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
];

const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string }[] = [
  { value: 'FIRST_TIME', label: '🌱 First business' },
  { value: 'SOME_EXPERIENCE', label: '🔨 Tried before' },
  { value: 'EXPERIENCED', label: '🏆 Experienced' },
];

function AboutYouSection({ profile, onProfileUpdated }: { profile: UserProfile; onProfileUpdated: (p: UserProfile) => void }) {
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [age, setAge] = useState(String(profile.age));
  const [gender, setGender] = useState<Gender>(profile.gender);
  const [location, setLocation] = useState(profile.location ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | ''>(profile.experienceLevel ?? '');
  const [goals, setGoals] = useState(profile.goals ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateProfile(profile.id, {
        name, email, age: Number(age), gender,
        location, phone, bio,
        ...(experienceLevel ? { experienceLevel } : {}),
        goals,
      });
      onProfileUpdated(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="About you" subtitle="The person behind the business. Filling this out completes a mission. ✨">
      <form onSubmit={save}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <div className="field">
            <label htmlFor="pname">Name</label>
            <input id="pname" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="pemail">Email</label>
            <input id="pemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field" style={{ maxWidth: 120 }}>
            <label htmlFor="page">Age</label>
            <input id="page" type="number" min={13} max={120} value={age} onChange={(e) => setAge(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="plocation">Location <Optional /></label>
            <input id="plocation" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Austin, TX" />
          </div>
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

        <div className="field">
          <label htmlFor="pphone">Phone <Optional /></label>
          <input id="pphone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pbio">Bio <Optional /></label>
          <textarea id="pbio" value={bio} onChange={(e) => setBio(e.target.value)} rows={2} placeholder="A sentence about you — people buy from people." />
        </div>
        <div className="field">
          <label>Business experience <Optional /></label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {EXPERIENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`chip ${experienceLevel === opt.value ? 'selected' : ''}`}
                onClick={() => setExperienceLevel(experienceLevel === opt.value ? '' : opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="pgoals">What do you want from this business? <Optional /></label>
          <textarea id="pgoals" value={goals} onChange={(e) => setGoals(e.target.value)} rows={2} placeholder="e.g. Replace my day-job income within two years" />
        </div>

        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
        <button className="btn" type="submit" disabled={saving}>
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save profile'}
        </button>
      </form>
    </Section>
  );
}

function Optional() {
  return <span style={{ opacity: 0.6, fontWeight: 400 }}>(optional)</span>;
}

/* ---------- Profile ---------- */

function ProfileSection({ business, onBusinessUpdated }: { business: Business; onBusinessUpdated: (b: Business) => void }) {
  const [name, setName] = useState(business.name);
  const [niche, setNiche] = useState(business.niche);
  const [description, setDescription] = useState(business.description);
  const [avenues, setAvenues] = useState<SalesAvenue[]>(
    (business.salesAvenues?.split(',').filter(Boolean) as SalesAvenue[]) ?? []
  );
  const [businessType, setBusinessType] = useState<BusinessType | null>(business.businessType);
  const [pageUrl, setPageUrl] = useState(business.pageUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    name !== business.name || niche !== business.niche || description !== business.description ||
    avenues.join(',') !== (business.salesAvenues ?? '') || businessType !== business.businessType ||
    pageUrl !== (business.pageUrl ?? '');

  const toggleAvenue = (a: SalesAvenue) =>
    setAvenues((list) => (list.includes(a) ? list.filter((x) => x !== a) : [...list, a]));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateBusiness(business.id, {
        name, niche, description,
        salesAvenues: avenues.join(','),
        pageUrl,
        ...(businessType ? { businessType } : {}),
      });
      onBusinessUpdated(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="Your business" subtitle="This is how the app talks about what you do.">
      <form onSubmit={save}>
        <div className="field">
          <label htmlFor="bname">Business name</label>
          <input id="bname" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="bniche">Product / niche</label>
          <input id="bniche" value={niche} onChange={(e) => setNiche(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="bdesc">Description</label>
          <textarea id="bdesc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required />
        </div>
        <div className="field">
          <label htmlFor="bpage">Your business page — where should people land? (shop, website, linktree…)</label>
          <input id="bpage" value={pageUrl} onChange={(e) => setPageUrl(e.target.value)} placeholder="etsy.com/shop/yourshop" />
        </div>
        <div className="field">
          <label>What kind of business? (tunes how the app scores your relationships)</label>
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
          <label>Sales avenues — where can people buy from you?</label>
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
        <button className="btn" type="submit" disabled={saving || !dirty}>
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
        </button>
      </form>
    </Section>
  );
}

/* ---------- Socials ---------- */

const SOCIAL_DEFS: { platform: SocialPlatform; label: string; emoji: string; placeholder: string }[] = [
  { platform: 'INSTAGRAM', label: 'Instagram', emoji: '📸', placeholder: 'instagram.com/yourshop' },
  { platform: 'TWITTER', label: 'X (Twitter)', emoji: '🐦', placeholder: 'x.com/yourshop' },
  { platform: 'TIKTOK', label: 'TikTok', emoji: '🎵', placeholder: 'tiktok.com/@yourshop' },
  { platform: 'YOUTUBE', label: 'YouTube', emoji: '▶️', placeholder: 'youtube.com/@yourshop' },
  { platform: 'REDDIT', label: 'Reddit', emoji: '👽', placeholder: 'reddit.com/u/yourname' },
  { platform: 'FACEBOOK', label: 'Facebook', emoji: '👥', placeholder: 'facebook.com/yourshop' },
  { platform: 'PINTEREST', label: 'Pinterest', emoji: '📌', placeholder: 'pinterest.com/yourshop' },
];

function SocialsSection({ businessId, onSaved }: { businessId: string; onSaved: () => void }) {
  const [urls, setUrls] = useState<Record<SocialPlatform, string>>({
    TWITTER: '', INSTAGRAM: '', TIKTOK: '', YOUTUBE: '', REDDIT: '', FACEBOOK: '', PINTEREST: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getSocials(businessId).then((links) => {
      setUrls((prev) => {
        const next = { ...prev };
        for (const link of links) next[link.platform] = link.url;
        return next;
      });
    }).catch(() => {});
  }, [businessId]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.saveSocials(
        businessId,
        (Object.keys(urls) as SocialPlatform[]).map((platform) => ({ platform, url: urls[platform] }))
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const connectedCount = Object.values(urls).filter(Boolean).length;

  return (
    <Section
      title="Your socials"
      subtitle="Where your business lives online. Discover uses these to meet customers where you already are — connecting 2 completes a mission. ✨"
    >
      <form onSubmit={save}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0 16px' }}>
          {SOCIAL_DEFS.map((def) => (
            <div className="field" key={def.platform}>
              <label htmlFor={`social-${def.platform}`}>{def.emoji} {def.label}</label>
              <input
                id={`social-${def.platform}`}
                value={urls[def.platform]}
                onChange={(e) => setUrls((u) => ({ ...u, [def.platform]: e.target.value }))}
                placeholder={def.placeholder}
              />
            </div>
          ))}
        </div>
        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save socials'}
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            {connectedCount} connected
          </span>
        </div>
      </form>
    </Section>
  );
}

/* ---------- Businesses list ---------- */

function BusinessesSection({
  business,
  businesses,
  onSwitchBusiness,
  onBusinessCreated,
  onBusinessDeleted,
}: {
  business: Business;
  businesses: Business[];
  onSwitchBusiness: (id: string) => void;
  onBusinessCreated: (b: Business) => void;
  onBusinessDeleted: (id: string) => void;
}) {
  const [showNew, setShowNew] = useState(false);
  const [deleting, setDeleting] = useState<Business | null>(null);
  const [confirmName, setConfirmName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const doDelete = async () => {
    if (!deleting) return;
    setError(null);
    try {
      await api.deleteBusiness(deleting.id);
      onBusinessDeleted(deleting.id);
      setDeleting(null);
      setConfirmName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  return (
    <Section
      title="All your ventures"
      subtitle="Run more than one thing? Each business keeps its own network, channels, and activity."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {businesses.map((b) => (
          <div
            key={b.id}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
              padding: '12px 14px', background: 'var(--input-bg)', border: '1px solid var(--panel-border)', borderRadius: 8,
            }}
          >
            <div>
              <strong style={{ fontSize: 14 }}>{b.name}</strong>
              {b.id === business.id && (
                <span className="channel-badge" style={{ marginLeft: 8 }}>active</span>
              )}
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{b.niche}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {b.id !== business.id && (
                <button className="btn-secondary" onClick={() => onSwitchBusiness(b.id)} style={{ fontSize: 13 }}>
                  Switch to
                </button>
              )}
              <button
                className="btn-secondary"
                onClick={() => { setDeleting(b); setConfirmName(''); }}
                style={{ fontSize: 13, color: 'var(--danger)' }}
                disabled={businesses.length === 1}
                title={businesses.length === 1 ? "You can't delete your only business" : undefined}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      <button className="btn" onClick={() => setShowNew(true)} style={{ marginTop: 12 }}>
        + Start another business
      </button>

      {showNew && (
        <NewBusinessModal
          onClose={() => setShowNew(false)}
          onCreated={(b) => {
            setShowNew(false);
            onBusinessCreated(b);
          }}
        />
      )}

      {deleting && (
        <Modal title={`Delete ${deleting.name}?`} onClose={() => setDeleting(null)}>
          <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>
            This permanently deletes <strong style={{ color: 'var(--text)' }}>{deleting.name}</strong> — every
            contact, channel, and interaction in it. There's no undo.
          </p>
          <div className="field">
            <label>Type the business name to confirm</label>
            <input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={deleting.name} />
          </div>
          {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
          <button
            className="btn btn-danger"
            style={{ width: '100%' }}
            disabled={confirmName !== deleting.name}
            onClick={doDelete}
          >
            Delete forever
          </button>
        </Modal>
      )}
    </Section>
  );
}

function NewBusinessModal({ onClose, onCreated }: { onClose: () => void; onCreated: (b: Business) => void }) {
  const [name, setName] = useState('');
  const [niche, setNiche] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const b = await api.createBusiness({ name, niche, description });
      onCreated(b);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Start another business" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="nname">Business name</label>
          <input id="nname" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="nniche">Product / niche</label>
          <input id="nniche" value={niche} onChange={(e) => setNiche(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="ndesc">Description</label>
          <textarea id="ndesc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required />
        </div>
        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
        <button className="btn" type="submit" disabled={submitting} style={{ width: '100%' }}>
          {submitting ? 'Creating…' : 'Create business'}
        </button>
      </form>
    </Modal>
  );
}

/* ---------- Appearance ---------- */

function AppearanceSection() {
  const [theme, setThemeState] = useState<Theme>(getTheme());

  const pick = (t: Theme) => {
    setTheme(t);
    setThemeState(t);
  };

  return (
    <Section title="Appearance" subtitle="How the app looks on this device.">
      <div style={{ display: 'flex', gap: 8 }}>
        <button className={`chip ${theme === 'dark' ? 'selected' : ''}`} onClick={() => pick('dark')}>🌙 Dark</button>
        <button className={`chip ${theme === 'light' ? 'selected' : ''}`} onClick={() => pick('light')}>☀️ Light</button>
      </div>
    </Section>
  );
}

/* ---------- Relationships ---------- */

function RelationshipSection() {
  const [days, setDays] = useState(getCoolingOffDays());

  const update = (n: number) => {
    setDays(n);
    setCoolingOffDays(n);
  };

  return (
    <Section
      title="Relationship reminders"
      subtitle='How long someone can go quiet before they show up in "Who needs you today".'
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <input
          type="range"
          min={1}
          max={30}
          value={days}
          onChange={(e) => update(Number(e.target.value))}
          style={{ flex: 1, maxWidth: 280 }}
        />
        <span style={{ fontSize: 14, whiteSpace: 'nowrap' }}>
          <strong>{days}</strong> day{days === 1 ? '' : 's'} of silence
        </span>
      </div>
    </Section>
  );
}

/* ---------- AI connection ---------- */

function AiSection() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<LlmTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getSettings().then((s) => {
      setSettings(s);
      setBaseUrl(s.llmBaseUrl ?? '');
      setModel(s.llmModel ?? '');
    }).catch(() => {});
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setTestResult(null);
    try {
      await api.updateSettings({
        llmBaseUrl: baseUrl.trim(),
        llmModel: model.trim(),
        // Only send the key if the user typed one; blank means "keep as is".
        ...(apiKey !== '' ? { llmApiKey: apiKey } : {}),
      });
      const s = await api.getSettings();
      setSettings(s);
      setApiKey('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await api.testLlm());
    } catch (err) {
      setTestResult({ ok: false, error: err instanceof Error ? err.message : 'Request failed' });
    } finally {
      setTesting(false);
    }
  };

  const connected = Boolean(settings?.llmBaseUrl && settings?.llmModel);

  return (
    <Section
      title="Your AI"
      subtitle="Point Venturo at a model you run yourself (Ollama, LM Studio, vLLM — anything OpenAI-compatible). It powers tailored Discover recommendations."
    >
      <div style={{ marginBottom: 12 }}>
        <span className="channel-badge">
          {connected ? `🧠 Connected · ${settings?.llmModel}` : '⚙️ Not connected — using the built-in engine'}
        </span>
      </div>
      <form onSubmit={save}>
        <div className="field">
          <label htmlFor="llmurl">Server URL</label>
          <input
            id="llmurl"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://localhost:11434/v1"
          />
        </div>
        <div className="field">
          <label htmlFor="llmmodel">Model name</label>
          <input id="llmmodel" value={model} onChange={(e) => setModel(e.target.value)} placeholder="qwen2.5:7b" />
        </div>
        <div className="field">
          <label htmlFor="llmkey">API key {settings?.llmApiKeySet ? '(one is saved — leave blank to keep it)' : '(only if your server needs one)'}</label>
          <input
            id="llmkey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={settings?.llmApiKeySet ? '••••••••' : ''}
            autoComplete="off"
          />
        </div>
        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
          </button>
          <button className="btn-secondary" type="button" onClick={test} disabled={testing}>
            {testing ? 'Testing…' : 'Test connection'}
          </button>
        </div>
      </form>
      {testResult && (
        <p style={{ fontSize: 13, marginTop: 10, color: testResult.ok ? 'var(--customer)' : 'var(--danger)' }}>
          {testResult.ok
            ? `✓ ${testResult.model} responded in ${testResult.latencyMs}ms — Discover will now use your AI.`
            : `✕ ${testResult.error}`}
        </p>
      )}
    </Section>
  );
}

/* ---------- shared ---------- */

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)', borderRadius: 10, padding: 20 }}>
      <h3 style={{ margin: 0 }}>{title}</h3>
      {subtitle && <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 4, marginBottom: 14 }}>{subtitle}</p>}
      {children}
    </section>
  );
}
