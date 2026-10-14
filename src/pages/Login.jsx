import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try { await (mode === 'login' ? login : register)(username, password); }
    catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand big"><span className="logo">◢</span> Paper Terminal</div>
        <p className="muted">Trade live crypto markets with practice money. Your account starts at $0.</p>
        <div className="seg full">
          <button className={mode === 'login' ? 'on' : ''} onClick={() => { setMode('login'); setError(''); }}>Log in</button>
          <button className={mode === 'register' ? 'on' : ''} onClick={() => { setMode('register'); setError(''); }}>Create account</button>
        </div>
        <form onSubmit={submit}>
          <label className="field"><span>Username</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
          </label>
          <label className="field"><span>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </label>
          {error && <div className="msg bad">{error}</div>}
          <button className="btn primary wide" disabled={busy}>{mode === 'login' ? 'Log in' : 'Create account'}</button>
        </form>
      </div>
    </div>
  );
}
