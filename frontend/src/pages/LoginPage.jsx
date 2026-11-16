import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCheck, Check, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { errorMessage } from '../api/client';
export default function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace/>;
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    try { await signIn({ email: form.get('email'), password: form.get('password') }); navigate('/'); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return <div className="login-page"><section className="login-story"><div className="brand"><span className="brand-symbol"><CheckCheck size={25}/></span><span>Maju Jaya<small>APPROVAL WORKSPACE</small></span></div><div className="login-story-copy"><span className="eyebrow">LESS BACK-AND-FORTH. MORE PROGRESS.</span><h1>Good work deserves<br/>a clear next step.</h1><p>From the factory floor to the head office, keep your team's requests moving.</p><div className="story-card"><span className="story-check"><Check size={24}/></span><div><strong>One place for every decision</strong><p>Submit. Review. Move forward.</p></div></div></div><span className="story-footer">PT Maju Jaya Manufaktur · Jakarta & Cikarang</span></section><section className="login-form-area"><form onSubmit={submit} className="login-form"><span className="eyebrow">YOUR WORKSPACE, CONNECTED</span><h2>Welcome back.</h2><p>Sign in to see what's next.</p>{error && <div className="error-banner" role="alert">{error}</div>}<label>Work email<input type="email" name="email" autoComplete="username" placeholder="you@ptmajujaya.co.id" required/></label><label>Password<input type="password" name="password" autoComplete="current-password" placeholder="Enter your password" required/></label><button className="button primary" disabled={busy}>{busy ? 'Signing in...' : 'Sign in to workspace'}<ArrowRight size={17}/></button><div className="login-help"><ShieldCheck size={17}/><span>For Maju Jaya employees. Contact HR for account access.</span></div></form></section></div>;
}
