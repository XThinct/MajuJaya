import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../api/client';
export function useLoad(loader, dependencies = []) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(v => v + 1), []);
  useEffect(() => {
    let active = true;
    setState({ data: null, loading: true, error: '' });
    loader().then(data => { if (active) setState({ data, loading: false, error: '' }); }).catch(e => { if (active) setState({ data: null, loading: false, error: errorMessage(e) }); });
    return () => { active = false; };
  }, [...dependencies, version]);
  return { ...state, reload };
}
