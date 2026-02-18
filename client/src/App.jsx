import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { request } from './api';

const languages = ['en', 'fr', 'de', 'it', 'es'];
const levels = ['A1', 'A2', 'B1', 'B2', 'C1'];

function TitleBlock({ eyebrow, title, subtitle }) {
  return (
    <div className="title-block">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {subtitle && <p className="subtitle">{subtitle}</p>}
    </div>
  );
}

function Surface({ children, className = '' }) {
  return <section className={`surface ${className}`.trim()}>{children}</section>;
}

function Layout({ children }) {
  const location = useLocation();
  const navItems = useMemo(() => ([
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/add', label: 'Add' },
    { to: '/review', label: 'Review' },
    { to: '/library', label: 'Library' },
    { to: '/stats', label: 'Stats' },
    { to: '/settings', label: 'Settings' }
  ]), []);

  const logout = () => {
    localStorage.removeItem('token');
    window.location.href = '/auth';
  };

  return (
    <div className="page-shell">
      <header className="topbar">
        <div className="brand">🌍 Recall Cards</div>
        <nav className="pill-nav">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={location.pathname === item.to ? 'active' : ''}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <button className="btn ghost" onClick={logout}>Logout</button>
      </header>
      <main className="container">{children}</main>
    </div>
  );
}

function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login');
  const [message, setMessage] = useState('');
  const nav = useNavigate();

  const submit = async () => {
    try {
      if (mode === 'forgot') {
        await request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
        setMessage('If this email exists, reset instructions were sent.');
        return;
      }
      const path = mode === 'signup' ? '/auth/signup' : '/auth/login';
      const data = await request(path, { method: 'POST', body: JSON.stringify({ email, password }) });
      localStorage.setItem('token', data.token);
      nav('/dashboard');
    } catch (error) {
      setMessage(error?.error || 'Request failed');
    }
  };

  return (
    <div className="auth-wrap">
      <Surface className="auth-card">
        <TitleBlock
          eyebrow="Strict active recall"
          title="Learn words that stick"
          subtitle="No hints. No peeking. Just recall-first practice."
        />

        <label>Email</label>
        <input placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />

        {mode !== 'forgot' && (
          <>
            <label>Password</label>
            <input placeholder="••••••••" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </>
        )}

        <button className="btn primary" onClick={submit}>{mode === 'signup' ? 'Create account' : mode === 'login' ? 'Login' : 'Send reset link'}</button>

        <div className="mode-switch">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Login</button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Sign up</button>
          <button className={mode === 'forgot' ? 'active' : ''} onClick={() => setMode('forgot')}>Forgot</button>
        </div>

        {message && <p className="help">{message}</p>}
      </Surface>
    </div>
  );
}

function ProfileForm({ onboarding = false }) {
  const [profile, setProfile] = useState({ knownLanguage: 'en', targetLanguage: 'fr', level: 'A1' });
  const nav = useNavigate();
  const valid = profile.knownLanguage !== profile.targetLanguage;
  const save = async () => {
    await request('/profile', { method: 'PATCH', body: JSON.stringify(profile) });
    nav('/dashboard');
  };

  return (
    <Layout>
      <Surface>
        <TitleBlock
          eyebrow={onboarding ? 'Welcome' : 'Personalization'}
          title={onboarding ? 'Set your learning profile' : 'Update your settings'}
          subtitle="Your profile is used for new card generation."
        />

        <div className="grid-3">
          <div>
            <label>Known language</label>
            <select value={profile.knownLanguage} onChange={(e) => setProfile((p) => ({ ...p, knownLanguage: e.target.value }))}>
              {languages.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label>Target language</label>
            <select value={profile.targetLanguage} onChange={(e) => setProfile((p) => ({ ...p, targetLanguage: e.target.value }))}>
              {languages.map((l) => <option key={l} disabled={l === profile.knownLanguage}>{l}</option>)}
            </select>
          </div>
          <div>
            <label>Level</label>
            <select value={profile.level} onChange={(e) => setProfile((p) => ({ ...p, level: e.target.value }))}>
              {levels.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>

        {!valid && <p className="warn">Known and target language must be different.</p>}
        <button className="btn primary" disabled={!valid} onClick={save}>Save profile</button>
      </Surface>
    </Layout>
  );
}

function Dashboard() {
  const [stats, setStats] = useState({ dueToday: 0, totalCards: 0, known: 0, unknown: 0 });
  useEffect(() => { request('/stats').then(setStats); }, []);

  return (
    <Layout>
      <TitleBlock eyebrow="Home" title="Dashboard" subtitle="Your daily momentum at a glance." />
      <div className="metric-grid">
        <Surface className="metric"><p>Due today</p><h2>{stats.dueToday}</h2></Surface>
        <Surface className="metric"><p>Total cards</p><h2>{stats.totalCards}</h2></Surface>
        <Surface className="metric"><p>Known today</p><h2>{stats.known}</h2></Surface>
        <Surface className="metric"><p>Unknown today</p><h2>{stats.unknown}</h2></Surface>
      </div>
      <Surface className="cta-row">
        <Link className="btn primary" to="/add">Add word</Link>
        <Link className="btn" to="/review">Start session</Link>
      </Surface>
    </Layout>
  );
}

function AddWord() {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const add = async () => {
    const card = await request('/cards', { method: 'POST', body: JSON.stringify({ text }) });
    setMsg(`Card ${card.cardId} is ${card.status}`);
  };

  return (
    <Layout>
      <Surface>
        <TitleBlock eyebrow="Creation" title="Add a word or phrase" subtitle="Keep it short and specific (max 80 chars)." />
        <input maxLength={80} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. aufgeben" />
        <button className="btn primary" onClick={add}>Generate card</button>
        {msg && <p className="help">{msg}</p>}
      </Surface>
    </Layout>
  );
}

function Review() {
  const [card, setCard] = useState({ cardId: null, text: null });
  const [reveal, setReveal] = useState(null);
  const next = async () => { setReveal(null); setCard(await request('/session/next')); };

  useEffect(() => { next(); }, []);

  const known = async () => {
    await request(`/cards/${card.cardId}/known`, { method: 'POST' });
    next();
  };

  const unknown = async () => {
    setReveal(await request(`/cards/${card.cardId}/unknown`, { method: 'POST' }));
  };

  return (
    <Layout>
      <Surface className="review-card">
        <TitleBlock eyebrow="Session" title="Review" subtitle="Strict recall: reveal only after Unknown." />
        {!card.cardId ? (
          <p className="empty">No due cards. Great work 🎉</p>
        ) : (
          <>
            <div className="word-chip">{card.text}</div>
            {!reveal && (
              <div className="row">
                <button className="btn success" onClick={known}>Known</button>
                <button className="btn warning" onClick={unknown}>Unknown</button>
              </div>
            )}
            {reveal && (
              <div className="reveal-grid">
                <p><strong>Meaning (target):</strong> {reveal.meaningTarget}</p>
                <p><strong>Meaning (known):</strong> {reveal.meaningKnown}</p>
                <p><strong>Sentence (target):</strong> {reveal.sentenceTarget}</p>
                <p><strong>Sentence (known):</strong> {reveal.sentenceKnown}</p>
                <button className="btn primary" onClick={next}>Next card</button>
              </div>
            )}
          </>
        )}
      </Surface>
    </Layout>
  );
}

function Library() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [cards, setCards] = useState([]);
  const load = async () => {
    const data = await request(`/cards?query=${encodeURIComponent(query)}&status=${status}&page=1&pageSize=20`);
    setCards(data.items);
  };

  useEffect(() => { load(); }, []);

  const del = async (id) => { await request(`/cards/${id}`, { method: 'DELETE' }); load(); };
  const retry = async (id) => { await request(`/cards/${id}/retry`, { method: 'POST' }); load(); };

  return (
    <Layout>
      <Surface>
        <TitleBlock eyebrow="Collection" title="Library" subtitle="Search, filter, and manage your cards." />
        <div className="filter-row">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search text" />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option>ready</option>
            <option>generating</option>
            <option>failed</option>
          </select>
          <button className="btn" onClick={load}>Apply</button>
        </div>

        <div className="list">
          {cards.map((c) => (
            <div key={c.cardId} className="list-item">
              <div>
                <strong>{c.text}</strong>
                <p className={`badge ${c.status}`}>{c.status}</p>
              </div>
              <div className="row">
                <button className="btn ghost" onClick={() => del(c.cardId)}>Delete</button>
                {c.status === 'failed' && <button className="btn" onClick={() => retry(c.cardId)}>Retry</button>}
              </div>
            </div>
          ))}
        </div>
      </Surface>
    </Layout>
  );
}

function Stats() {
  const [stats, setStats] = useState({});
  useEffect(() => { request('/stats').then(setStats); }, []);
  return (
    <Layout>
      <Surface>
        <TitleBlock eyebrow="Progress" title="Stats" subtitle="Raw metrics from your current account." />
        <pre className="stats-box">{JSON.stringify(stats, null, 2)}</pre>
      </Surface>
    </Layout>
  );
}

function Protected({ children }) {
  const [state, setState] = useState('loading');
  useEffect(() => {
    request('/profile').then(() => setState('ok')).catch(() => setState('missing'));
  }, []);

  if (!localStorage.getItem('token')) return <Navigate to="/auth" />;
  if (state === 'loading') return <div className="loading">Loading…</div>;
  if (state === 'missing') return <Navigate to="/onboarding" />;
  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/onboarding" element={<ProfileForm onboarding />} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/add" element={<Protected><AddWord /></Protected>} />
      <Route path="/review" element={<Protected><Review /></Protected>} />
      <Route path="/library" element={<Protected><Library /></Protected>} />
      <Route path="/stats" element={<Protected><Stats /></Protected>} />
      <Route path="/settings" element={<Protected><ProfileForm /></Protected>} />
      <Route path="*" element={<Navigate to="/auth" />} />
    </Routes>
  );
}
