import { useCallback, useEffect, useState } from 'react';

// Stage 2.4 · loads blockchain audit history from the backend.
//
// `loader` is one of the imported service functions (getProjectBlockchainHistory,
// getTenderBlockchainHistory, getMilestoneBlockchainHistory) — a stable module
// reference, so the effect does not re-run on every render. The history stays
// null while nothing has been loaded, which lets the UI keep the difference
// between "not loaded", "empty" and "failed" visible.
export default function useBlockchainHistory(loader, id, enabled = true) {
  const [history, setHistory] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!enabled || !id) {
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError(null);

    loader(id)
      .then((data) => {
        if (!active) {
          return;
        }
        setHistory(data.history);
        setMeta(data.meta || null);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        setHistory(null);
        setMeta(null);
        setError(err.message);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loader, id, enabled, reloadKey]);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  return { history, meta, loading, error, refresh };
}
