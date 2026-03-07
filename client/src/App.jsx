import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { request } from './api';

const knownLanguages = ['en', 'fr', 'it', 'es'];
const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

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
  const [profile, setProfile] = useState({ knownLanguage: 'en', level: 'A1' });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    let active = true;
    request('/profile')
      .then((data) => {
        if (!active) return;
        setProfile({
          knownLanguage: data.knownLanguage,
          level: data.level
        });
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingProfile(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const save = async () => {
    await request('/profile', { method: 'PATCH', body: JSON.stringify(profile) });
    nav('/dashboard');
  };

  if (loadingProfile) {
    return (
      <Layout>
        <div className="loading">Loading…</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Surface>
        <TitleBlock
          eyebrow={onboarding ? 'Welcome' : 'Personalization'}
          title={onboarding ? 'Set your German learning profile' : 'Tune your German learning profile'}
          subtitle="Changes apply to newly generated cards."
        />

        <div className="grid-3">
          <div>
            <label>Your language</label>
            <select value={profile.knownLanguage} onChange={(e) => setProfile((p) => ({ ...p, knownLanguage: e.target.value }))}>
              {knownLanguages.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label>German level</label>
            <select value={profile.level} onChange={(e) => setProfile((p) => ({ ...p, level: e.target.value }))}>
              {levels.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>

        <p className="help">Learning language is fixed to German.</p>
        <button className="btn primary profile-save-btn" onClick={save}>Save profile</button>
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
  const [groups, setGroups] = useState(['Default']);
  const [groupMode, setGroupMode] = useState('default');
  const [selectedGroup, setSelectedGroup] = useState('Default');
  const [newGroupName, setNewGroupName] = useState('');
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');
  const [toast, setToast] = useState(null);
  const toastTimerRef = React.useRef(null);

  const filteredGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.toLowerCase().includes(q));
  }, [groups, groupSearch]);

  const showToast = (type, message) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, message, id: Date.now() });
    toastTimerRef.current = setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    request('/groups').then((data) => {
      if (Array.isArray(data.groups) && data.groups.length) {
        setGroups(data.groups);
        setSelectedGroup(data.groups[0]);
      }
    }).catch(() => {});

    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const add = async () => {
    const cleanText = text.trim();
    if (!cleanText) {
      showToast('error', 'Please type a word before generating.');
      return;
    }

    const payload = { text: cleanText, groupMode };
    if (groupMode === 'existing') payload.groupName = selectedGroup;
    if (groupMode === 'new') payload.groupName = newGroupName;

    try {
      const card = await request('/cards', { method: 'POST', body: JSON.stringify(payload) });
      const createdGroup = card.groupName || 'Default';

      setGroups((prev) => prev.includes(createdGroup) ? prev : [...prev, createdGroup]);
      setSelectedGroup(createdGroup);
      setGroupMode('existing');
      setText('');
      setNewGroupName('');
      showToast('success', `Added "${cleanText}" to ${createdGroup}.`);
    } catch (error) {
      if (error?.error === 'DUPLICATE_CARD') {
        const duplicateGroup = groupMode === 'existing' ? selectedGroup : groupMode === 'new' ? newGroupName : 'Default';
        showToast('duplicate', `"${cleanText}" already exists in ${duplicateGroup}.`);
        return;
      }
      showToast('error', `Could not add "${cleanText}". Please try again.`);
    }
  };

  const selectGroup = (group) => {
    setSelectedGroup(group);
    setGroupPickerOpen(false);
    setGroupSearch('');
  };

  return (
    <Layout>
      <Surface>
        <TitleBlock eyebrow="Creation" title="Capture vocabulary instantly" subtitle="Add one word or phrase, then generate content." />
        <input maxLength={80} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. aufgeben" />

        <div className="group-box group-box-creative">
          <label>Choose destination group</label>

          <div className="group-mode-cards">
            <button type="button" className={`group-mode-card ${groupMode === 'default' ? 'active' : ''}`} onClick={() => setGroupMode('default')}>
              <span className="group-mode-icon">✨</span>
              <div>
                <strong>Default</strong>
                <small>Fast and simple</small>
              </div>
            </button>

            <button type="button" className={`group-mode-card ${groupMode === 'existing' ? 'active' : ''}`} onClick={() => setGroupMode('existing')}>
              <span className="group-mode-icon">🗂️</span>
              <div>
                <strong>Existing</strong>
                <small>Pick from your groups</small>
              </div>
            </button>

            <button type="button" className={`group-mode-card ${groupMode === 'new' ? 'active' : ''}`} onClick={() => setGroupMode('new')}>
              <span className="group-mode-icon">🌱</span>
              <div>
                <strong>New group</strong>
                <small>Create while adding</small>
              </div>
            </button>
          </div>

          {groupMode === 'existing' && (
            <>
              <div className="group-chip-row">
                {groups.slice(0, 6).map((g) => (
                  <button key={g} type="button" className={`group-chip ${selectedGroup === g ? 'active' : ''}`} onClick={() => setSelectedGroup(g)}>
                    {g}
                  </button>
                ))}
                <button type="button" className="group-chip ghost" onClick={() => setGroupPickerOpen(true)}>Browse all</button>
              </div>
              <p className="group-hint">Selected group: <strong>{selectedGroup}</strong></p>
            </>
          )}

          {groupMode === 'new' && (
            <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Enter new group name" maxLength={50} />
          )}
        </div>

        <button className="btn primary generate-card-btn" onClick={add}>Generate card</button>
      </Surface>

      {groupPickerOpen && (
        <div className="group-picker-backdrop" onClick={() => setGroupPickerOpen(false)}>
          <div className="group-picker-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="group-picker-head">
              <h3>Choose group</h3>
              <button className="btn ghost" onClick={() => setGroupPickerOpen(false)}>Close</button>
            </div>
            <input
              value={groupSearch}
              onChange={(e) => setGroupSearch(e.target.value)}
              placeholder="Search groups"
              aria-label="Search groups"
            />
            <div className="group-picker-list">
              {filteredGroups.map((g) => (
                <button key={g} className={`group-picker-item ${selectedGroup === g ? 'active' : ''}`} onClick={() => selectGroup(g)}>
                  <span>{g}</span>
                  {selectedGroup === g && <strong>Selected</strong>}
                </button>
              ))}
              {!filteredGroups.length && <p className="group-hint">No matching groups.</p>}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div key={toast.id} className={`add-toast ${toast.type}`} role="status" aria-live="polite">
          <span className="toast-check" aria-hidden="true">{toast.type === 'success' ? '✓' : toast.type === 'duplicate' ? '!' : '⚠'}</span>
          <p>{toast.message}</p>
        </div>
      )}
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
      <Surface className={`review-card ${reveal ? 'review-overlay-open' : ''}`}>
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
              <div className="memory-overlay" role="dialog" aria-modal="true" aria-label={`Learning card for ${card.text}`}>
                <div className="memory-overlay__backdrop" />
                <article className="memory-card">
                  <header className="memory-card__header">
                    <p className="memory-chip">🧠 Deep focus card</p>
                    <h3>{card.text}</h3>
                    <p className="memory-subtitle">Group: {selectedGroup} · Remaining today: {summary.stillToRevise}</p>
                  </header>

                  <div className="memory-card__content">
                    <section className="memory-section meaning">
                      <p className="memory-label">Meaning</p>
                      <p>{reveal.meaningKnown}</p>
                    </section>
                    <section className="memory-section example">
                      <p className="memory-label">Example</p>
                      <p>{reveal.sentenceTarget}</p>
                    </section>
                    <section className="memory-section translation">
                      <p className="memory-label">Translation</p>
                      <p>{reveal.sentenceKnown}</p>
                    </section>
                  </div>

                  <div className="memory-card__footer">
                    <button className="btn primary memory-next-btn" onClick={() => next(selectedGroup)}>Next card</button>
                  </div>
                </article>
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
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [groups, setGroups] = useState(['All']);
  const [cards, setCards] = useState([]);

  const loadGroups = async () => {
    const data = await request('/groups');
    const list = ['All', ...(Array.isArray(data.groups) ? data.groups : [])];
    setGroups([...new Set(list)]);
  };

  const load = async (group = selectedGroup) => {
    const data = await request(`/cards?query=${encodeURIComponent(query)}&group=${encodeURIComponent(group)}&page=1&pageSize=20`);
    setCards(data.items);
  };

  useEffect(() => {
    loadGroups().catch(() => setGroups(['All']));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 220);
    return () => clearTimeout(timer);
  }, [query, selectedGroup]);

  const del = async (id) => {
    await request(`/cards/${id}`, { method: 'DELETE' });
    await load();
    await loadGroups();
  };

  const retry = async (id) => { await request(`/cards/${id}/retry`, { method: 'POST' }); load(); };

  const deleteAllInGroup = async () => {
    if (selectedGroup === 'All') return;
    if (!window.confirm(`Delete all words in group "${selectedGroup}"?`)) return;
    await request(`/groups/${encodeURIComponent(selectedGroup)}/cards`, { method: 'DELETE' });
    await load();
    await loadGroups();
  };

  const deleteGroup = async () => {
    if (selectedGroup === 'All' || selectedGroup === 'Default') return;
    if (!window.confirm(`Delete group "${selectedGroup}"? Words will be moved to Default group.`)) return;
    await request(`/groups/${encodeURIComponent(selectedGroup)}`, { method: 'DELETE' });
    setSelectedGroup('All');
    await load('All');
    await loadGroups();
  };

  return (
    <Layout>
      <Surface>
        <TitleBlock eyebrow="Collection" title="Word library" subtitle="Search, filter, and manage your card queue." />
        <div className="filter-row filter-row-library">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search text" />
          <select value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)}>
            {groups.map((g) => <option key={g}>{g}</option>)}
          </select>
        </div>

        {selectedGroup !== 'All' && (
          <div className="group-actions">
            <button className="btn danger" onClick={deleteAllInGroup}>Delete all words in group</button>
            {selectedGroup !== 'Default' && <button className="btn ghost" onClick={deleteGroup}>Delete group</button>}
          </div>
        )}

        <div className="list">
          {cards.map((c) => (
            <div key={c.cardId} className="list-item">
              <div>
                <strong>{c.text}</strong>
                <p className="item-meta">Group: {c.groupName || "Default"}</p>
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
