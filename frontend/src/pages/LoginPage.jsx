import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { CheckCheck, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { errorMessage } from '../api/client';
export default function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  if (user) return <Navigate to="/" replace/>;
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    try { await signIn({ email: form.get('email'), password: form.get('password') }); navigate('/'); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return <main className="signin-page">
    <section className="signin-card" aria-labelledby="signin-title">
      <header className="signin-heading">
        <div className="signin-brand"><span className="signin-mark"><CheckCheck size={24} aria-hidden="true"/></span><span>Maju Jaya</span></div>
        <h1 id="signin-title">Welcome back</h1>
        <p>Please enter your details to sign in.</p>
      </header>
      <form className="signin-form" onSubmit={submit} aria-busy={busy}>
        {error && <div className="error-banner" role="alert">{error}</div>}
        <div className="signin-field">
          <label htmlFor="signin-email">Work email</label>
          <input id="signin-email" type="email" name="email" autoComplete="username" placeholder="you@ptmajujaya.co.id" required/>
        </div>
        <div className="signin-field">
          <label htmlFor="signin-password">Password</label>
          <div className="signin-password">
            <input id="signin-password" type={showPassword ? 'text' : 'password'} name="password" autoComplete="current-password" placeholder="Enter your password" required/>
            <button type="button" className="signin-password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} aria-controls="signin-password" onClick={() => setShowPassword(value => !value)}>
              {showPassword ? <EyeOff size={20} aria-hidden="true"/> : <Eye size={20} aria-hidden="true"/>}
            </button>
          </div>
        </div>
        <button type="submit" className="button primary signin-submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
        <p className="signin-help"><ShieldCheck size={17} aria-hidden="true"/><span>Need account access? Contact HR.</span></p>
      </form>
      <p className="signin-company">PT Maju Jaya Manufaktur</p>
    </section>
  </main>;
}
