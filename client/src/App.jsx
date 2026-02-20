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

function OrbBackground() {
  return (
    <>
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
    </>
  );
}

function Layout({ children }) {
  const location = useLocation();
  const navItems = useMemo(() => ([
    { to: '/dashboard', label: 'Dashboard', emoji: '📊' },
    { to: '/add', label: 'Add', emoji: '➕' },
    { to: '/review', label: 'Review', emoji: '🧠' },
    { to: '/library', label: 'Library', emoji: '📚' },
    { to: '/stats', label: 'Stats', emoji: '📈' },
    { to: '/settings', label: 'Settings', emoji: '⚙️' }
  ]), []);

  const logout = () => {
    localStorage.removeItem('token');
    window.location.href = '/auth';
  };

  return (
    <div className="page-shell">
      <OrbBackground />
      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand-logo">🌍</div>
          <div>
            <p className="brand-kicker">Language Trainer</p>
            <div className="brand">Recall Cards</div>
          </div>
        </div>
        <nav className="pill-nav">
          {navItems.map((item) => (
            <Link key={item.to} to={item.to} className={location.pathname === item.to ? 'active' : ''}>
              <span>{item.emoji}</span>
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
      <OrbBackground />
      <Surface className="auth-card">
        <TitleBlock
          eyebrow="Strict active recall"
          title="Learn words that actually stick"
          subtitle="Inspired by modern language apps: bold visuals, focused interactions, zero hints."
        />

        <label>Email</label>
        <input placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />

        {mode !== 'forgot' && (
          <>
            <label>Password</label>
            <input placeholder="••••••••" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </>
        )}

        <div className="mode-switch" role="tablist" aria-label="Authentication mode">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>I have an account</button>
          <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Create account</button>
          <button type="button" className={mode === 'forgot' ? 'active' : ''} onClick={() => setMode('forgot')}>Reset password</button>
        </div>

        <p className="auth-caption">
          {mode === 'signup' && 'New here? Create your account and start learning.'}
          {mode === 'login' && 'Welcome back — continue your recall streak.'}
          {mode === 'forgot' && 'We will send reset instructions if your email exists.'}
        </p>

        <button className="btn primary" onClick={submit}>
          Continue
        </button>

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
          title={onboarding ? 'Set your learning profile' : 'Tune your experience'}
          subtitle="Profile settings apply to newly generated cards."
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
            <label>CEFR level</label>
            <select value={profile.level} onChange={(e) => setProfile((p) => ({ ...p, level: e.target.value }))}>
              {levels.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>

        {!valid && <p className="warn">Known and target language must be different.</p>}
        <button className="btn primary profile-save-btn" disabled={!valid} onClick={save}>Save profile</button>
      </Surface>
    </Layout>
  );
}

function Dashboard() {
  const [stats, setStats] = useState({ dueToday: 0, totalCards: 0, known: 0, unknown: 0 });
  useEffect(() => { request('/stats').then(setStats); }, []);

  return (
    <Layout>
      <TitleBlock eyebrow="Home" title="Your learning cockpit" subtitle="Daily focus, quick actions, and review momentum." />
      <div className="metric-grid">
        <Surface className="metric metric-blue"><p>Due today</p><h2>{stats.dueToday}</h2><small>Ready to review</small></Surface>
        <Surface className="metric metric-purple"><p>Total cards</p><h2>{stats.totalCards}</h2><small>In your library</small></Surface>
        <Surface className="metric metric-green"><p>Known today</p><h2>{stats.known}</h2><small>Successful recalls</small></Surface>
        <Surface className="metric metric-orange"><p>Unknown today</p><h2>{stats.unknown}</h2><small>Need another pass</small></Surface>
      </div>
      <Surface className="cta-row">
        <Link className="btn primary" to="/add">Add new word</Link>
        <Link className="btn" to="/review">Start recall session</Link>
      </Surface>
    </Layout>
  );
}

function AddWord() {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const [groups, setGroups] = useState(['Default']);
  const [groupMode, setGroupMode] = useState('default');
  const [selectedGroup, setSelectedGroup] = useState('Default');
  const [newGroupName, setNewGroupName] = useState('');

  useEffect(() => {
    request('/groups').then((data) => {
      if (Array.isArray(data.groups) && data.groups.length) {
        setGroups(data.groups);
        setSelectedGroup(data.groups[0]);
      }
    }).catch(() => {});
  }, []);

  const add = async () => {
    const payload = { text, groupMode };
    if (groupMode === 'existing') payload.groupName = selectedGroup;
    if (groupMode === 'new') payload.groupName = newGroupName;

    const card = await request('/cards', { method: 'POST', body: JSON.stringify(payload) });
    const createdGroup = card.groupName || 'Default';

    setGroups((prev) => prev.includes(createdGroup) ? prev : [...prev, createdGroup]);
    setSelectedGroup(createdGroup);
    setGroupMode('existing');
    setText('');
    setNewGroupName('');
    setMsg(`Card is created in ${createdGroup} group.`);
  };

  return (
    <Layout>
      <Surface>
        <TitleBlock eyebrow="Creation" title="Capture vocabulary instantly" subtitle="Add one word or phrase, then generate content." />
        <input maxLength={80} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. aufgeben" />

        <div className="group-box">
          <label>Group</label>
          <div className="row left">
            <label><input type="radio" name="groupMode" checked={groupMode === 'default'} onChange={() => setGroupMode('default')} /> Default group</label>
            <label><input type="radio" name="groupMode" checked={groupMode === 'existing'} onChange={() => setGroupMode('existing')} /> Existing group</label>
            <label><input type="radio" name="groupMode" checked={groupMode === 'new'} onChange={() => setGroupMode('new')} /> New group</label>
          </div>

          {groupMode === 'existing' && (
            <select value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)}>
              {groups.map((g) => <option key={g}>{g}</option>)}
            </select>
          )}

          {groupMode === 'new' && (
            <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Enter new group name" maxLength={50} />
          )}
        </div>

        <button className="btn primary generate-card-btn" onClick={add}>Generate card</button>
        {msg && <p className="help">{msg}</p>}
      </Surface>
    </Layout>
  );
}

function Review() {
  const [card, setCard] = useState({ cardId: null, text: null });
  const [reveal, setReveal] = useState(null);
  const [groups, setGroups] = useState([{ groupName: 'All', totalWords: 0, stillToRevise: 0 }]);
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [summary, setSummary] = useState({ totalWords: 0, reviewedToday: 0, stillToRevise: 0, estimatedMinutes: 0 });

  const next = async (group = selectedGroup) => {
    setReveal(null);
    setCard(await request(`/session/next?group=${encodeURIComponent(group)}`));
  };

  const loadSummary = async (group = selectedGroup) => {
    const data = await request(`/review/summary?group=${encodeURIComponent(group)}`);
    setSummary({
      totalWords: data.totalWords || 0,
      reviewedToday: data.reviewedToday || 0,
      stillToRevise: data.stillToRevise || 0,
      estimatedMinutes: data.estimatedMinutes || 0
    });
    if (Array.isArray(data.groups)) {
      setGroups(data.groups);
    }
  };

  useEffect(() => {
    next(selectedGroup);
    loadSummary(selectedGroup).catch(() => {
      setSummary({ totalWords: 0, reviewedToday: 0, stillToRevise: 0, estimatedMinutes: 0 });
      setGroups([{ groupName: 'All', totalWords: 0, stillToRevise: 0 }]);
    });
  }, [selectedGroup]);

  const known = async () => {
    await request(`/cards/${card.cardId}/known`, { method: 'POST' });
    await next(selectedGroup);
    await loadSummary(selectedGroup);
  };

  const unknown = async () => {
    setReveal(await request(`/cards/${card.cardId}/unknown`, { method: 'POST' }));
    await loadSummary(selectedGroup);
  };

  return (
    <Layout>
      <Surface className="review-card">
        <TitleBlock eyebrow="Session" title="Recall challenge" />
        <div className="review-filter">
          <label>Review group</label>
          <select value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)}>
            {groups.map((g) => (
              <option key={g.groupName} value={g.groupName}>
                {g.groupName} ({g.totalWords})
              </option>
            ))}
          </select>
        </div>

        <div className="review-summary">
          <div className="review-summary-item">
            <p>Total words</p>
            <strong>{summary.totalWords}</strong>
          </div>
          <div className="review-summary-item">
            <p>Revised today</p>
            <strong>{summary.reviewedToday}</strong>
          </div>
          <div className="review-summary-item">
            <p>Still to revise</p>
            <strong>{summary.stillToRevise}</strong>
          </div>
          <div className="review-summary-item">
            <p>Est. time</p>
            <strong>{summary.estimatedMinutes} min</strong>
          </div>
        </div>

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
                <button className="btn primary" onClick={() => next(selectedGroup)}>Next card</button>
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
        <TitleBlock eyebrow="Collection" title="Word library" subtitle="Search, filter, and manage your card queue." />
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
        <p className="status-help">
          <strong>Status guide:</strong> <span className="badge ready">ready</span> content is generated and reviewable when due,
          {' '}<span className="badge generating">generating</span> content is still being prepared,
          {' '}<span className="badge failed">failed</span> generation failed (use Retry).
        </p>

        <div className="list">
          {cards.map((c) => (
            <div key={c.cardId} className="list-item">
              <div>
                <strong>{c.text}</strong>
                <p className="item-meta">Group: {c.groupName || "Default"}</p>
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
  const [stats, setStats] = useState({ totalCards: 0, reviewsToday: 0, known: 0, unknown: 0, dueToday: 0 });
  useEffect(() => { request('/stats').then(setStats); }, []);

  const totalReviewed = (stats.known || 0) + (stats.unknown || 0);
  const knownRate = totalReviewed ? Math.round(((stats.known || 0) / totalReviewed) * 100) : 0;

  return (
    <Layout>
      <Surface>
        <TitleBlock eyebrow="Progress" title="Insight board" subtitle="Live metrics from your current account." />

        <div className="stats-grid">
          <div className="stats-tile">
            <p>Total cards</p>
            <h3>{stats.totalCards || 0}</h3>
            <small>Words in your library</small>
          </div>
          <div className="stats-tile">
            <p>Due today</p>
            <h3>{stats.dueToday || 0}</h3>
            <small>Cards waiting for review</small>
          </div>
          <div className="stats-tile">
            <p>Reviews today</p>
            <h3>{stats.reviewsToday || 0}</h3>
            <small>Completed attempts</small>
          </div>
          <div className="stats-tile">
            <p>Known rate</p>
            <h3>{knownRate}%</h3>
            <small>{stats.known || 0} known / {stats.unknown || 0} unknown</small>
          </div>
        </div>
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
