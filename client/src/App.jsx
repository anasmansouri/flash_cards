import React, { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { request } from './api';

const languages = ['en', 'fr', 'de', 'it', 'es'];
const levels = ['A1', 'A2', 'B1', 'B2', 'C1'];

function Layout({ children }) {
  return (
    <div className="container">
      <nav>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/add">Add</Link>
        <Link to="/review">Review</Link>
        <Link to="/library">Library</Link>
        <Link to="/stats">Stats</Link>
        <Link to="/settings">Settings</Link>
      </nav>
      {children}
    </div>
  );
}

function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login');
  const nav = useNavigate();
  const submit = async () => {
    if (mode === 'forgot') {
      await request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
      alert('If this email exists, reset instructions were sent.');
      return;
    }
    const path = mode === 'signup' ? '/auth/signup' : '/auth/login';
    const data = await request(path, { method: 'POST', body: JSON.stringify({ email, password }) });
    localStorage.setItem('token', data.token);
    nav('/dashboard');
  };
  return (
    <div className="card">
      <h1>Flash Cards</h1>
      <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      {mode !== 'forgot' && <input placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />}
      <button onClick={submit}>{mode}</button>
      <div className="row">
        <button onClick={() => setMode('login')}>Login</button>
        <button onClick={() => setMode('signup')}>Sign up</button>
        <button onClick={() => setMode('forgot')}>Forgot password</button>
      </div>
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
      <div className="card">
        <h2>{onboarding ? 'Onboarding' : 'Settings'}</h2>
        <label>Known language</label>
        <select value={profile.knownLanguage} onChange={(e) => setProfile((p) => ({ ...p, knownLanguage: e.target.value }))}>
          {languages.map((l) => <option key={l}>{l}</option>)}
        </select>
        <label>Target language</label>
        <select value={profile.targetLanguage} onChange={(e) => setProfile((p) => ({ ...p, targetLanguage: e.target.value }))}>
          {languages.map((l) => <option key={l} disabled={l === profile.knownLanguage}>{l}</option>)}
        </select>
        <label>Level</label>
        <select value={profile.level} onChange={(e) => setProfile((p) => ({ ...p, level: e.target.value }))}>
          {levels.map((l) => <option key={l}>{l}</option>)}
        </select>
        <button disabled={!valid} onClick={save}>Save</button>
      </div>
    </Layout>
  );
}

function Dashboard() {
  const [stats, setStats] = useState({ dueToday: 0, totalCards: 0, known: 0, unknown: 0 });
  useEffect(() => { request('/stats').then(setStats); }, []);
  return <Layout><div className="card"><h2>Dashboard</h2><p>Due today: {stats.dueToday}</p><p>Total cards: {stats.totalCards}</p><p>Known today: {stats.known} / Unknown today: {stats.unknown}</p></div></Layout>;
}

function AddWord() {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const add = async () => {
    const card = await request('/cards', { method: 'POST', body: JSON.stringify({ text }) });
    setMsg(`Card ${card.cardId} is ${card.status}`);
  };
  return <Layout><div className="card"><h2>Add Word</h2><input maxLength={80} value={text} onChange={(e) => setText(e.target.value)} /><button onClick={add}>Submit</button><p>{msg}</p></div></Layout>;
}

function Review() {
  const [card, setCard] = useState({ cardId: null, text: null });
  const [reveal, setReveal] = useState(null);
  const next = async () => { setReveal(null); setCard(await request('/session/next')); };
  useEffect(() => { next(); }, []);
  const known = async () => { await request(`/cards/${card.cardId}/known`, { method: 'POST' }); next(); };
  const unknown = async () => { setReveal(await request(`/cards/${card.cardId}/unknown`, { method: 'POST' })); };
  return (
    <Layout>
      <div className="card">
        <h2>Review</h2>
        {!card.cardId ? <p>No due cards.</p> : <>
          <h3>{card.text}</h3>
          {!reveal && <div className="row"><button onClick={known}>Known</button><button onClick={unknown}>Unknown</button></div>}
          {reveal && <div><p>{reveal.meaningTarget}</p><p>{reveal.meaningKnown}</p><p>{reveal.sentenceTarget}</p><p>{reveal.sentenceKnown}</p><button onClick={next}>Next</button></div>}
        </>}
      </div>
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
  return <Layout><div className="card"><h2>Library</h2><div className="row"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search"/><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">all</option><option>ready</option><option>generating</option><option>failed</option></select><button onClick={load}>Filter</button></div>{cards.map((c) => <div key={c.cardId} className="item"><b>{c.text}</b> <span>{c.status}</span><button onClick={() => del(c.cardId)}>Delete</button>{c.status==='failed'&&<button onClick={() => retry(c.cardId)}>Retry</button>}</div>)}</div></Layout>;
}

function Stats() {
  const [stats, setStats] = useState({});
  useEffect(() => { request('/stats').then(setStats); }, []);
  return <Layout><div className="card"><h2>Stats</h2><pre>{JSON.stringify(stats, null, 2)}</pre></div></Layout>;
}

function Protected({ children }) {
  const [state, setState] = useState('loading');
  useEffect(() => {
    request('/profile').then(() => setState('ok')).catch(() => setState('missing'));
  }, []);
  if (!localStorage.getItem('token')) return <Navigate to="/auth" />;
  if (state === 'loading') return <div className="container">Loading...</div>;
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
