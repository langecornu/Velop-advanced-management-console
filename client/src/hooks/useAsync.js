// Runs a loader, tracks loading/error, ignores stale results and exposes reload().
import { useCallback, useEffect, useState } from 'react';

export function useAsync(loader, deps) {
  const [state, setState] = useState({ data: null, error: '', isLoading: true });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ ...previous, isLoading: true, error: '' }));
    loader(controller.signal)
      .then((data) => setState({ data, error: '', isLoading: false }))
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setState({ data: null, error: error.message, isLoading: false });
        }
      });
    return () => controller.abort();
  }, [...deps, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return { ...state, reload };
}
