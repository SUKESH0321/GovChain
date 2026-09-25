import { useCallback, useEffect, useState } from 'react';

import { getProjectRiskAnalysis } from '../services/risk.service';

// Stage 4.1 · loads the AI risk analysis of one project.
//
// `enabled` keeps the calculation lazy (it is only requested while its tab is
// open), exactly like the blockchain-history hook next to it. The analysis
// stays null while nothing has been loaded, so the panel can keep the
// difference between "not loaded", "no signals" and "failed" visible.
export default function useProjectRisk(projectId, enabled = true) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!enabled || !projectId) {
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError(null);

    getProjectRiskAnalysis(projectId)
      .then((data) => {
        if (!active) {
          return;
        }
        setAnalysis(data.riskAnalysis);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        setAnalysis(null);
        setError(err.message);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [projectId, enabled, reloadKey]);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  return { analysis, loading, error, refresh };
}
