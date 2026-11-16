import { createContext, useContext, useEffect, useState } from 'react';
import * as auth from '../api/auth';
import { errorMessage } from '../api/client';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const signOut = () => { sessionStorage.removeItem('approvals-token'); setUser(null); setError(''); };
  async function restore() {
    setLoading(true); setError('');
    if (sessionStorage.getItem('approvals-token')) {
      try { setUser(await auth.getMe()); }
      catch (e) { if (e.response?.status === 401) signOut(); else setError(errorMessage(e)); }
    }
    setLoading(false);
  }
  useEffect(() => { restore(); window.addEventListener('session-expired', signOut); return () => window.removeEventListener('session-expired', signOut); }, []);
  async function signIn(credentials) { const result = await auth.login(credentials); sessionStorage.setItem('approvals-token', result.token); setUser(result.user); }
  return <AuthContext.Provider value={{ user, loading, error, retry: restore, signIn, signOut }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
