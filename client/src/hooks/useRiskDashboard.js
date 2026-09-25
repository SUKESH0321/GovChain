import { useCallback, useEffect, useMemo, useState } from 'react';

import { getRiskSummary } from '../services/risk.service';

// GovChain — Stage 4.3 · loads the dashboard summary (GET /api/risk/summary) and
// merges the lightweight UI-level review state stored in localStorage.
//
// Review state is deliberately UI-level for this MVP: marking a project
// "Reviewed" only changes how the dashboard displays it, never the underlying
// project, milestone, payment or blockchain records.
const REVIEW_KEY = 'govchain_risk_reviewed';

function loadReviewed() {
  try {
    return JSON.parse(localStorage.getItem(REVIEW_KEY)) || {};
  } catch {
    return {};
  }
}

export default function useRiskDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewed, setReviewed] = useState(loadReviewed);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getRiskSummary()
      .then((response) => {
        if (!active) {
          return;
        }
        setData(response);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        setData(null);
        setError(err.message);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const toggleReviewed = useCallback((projectId) => {
    setReviewed((prev) => {
      const next = { ...prev };
      if (next[projectId]) {
        delete next[projectId];
      } else {
        next[projectId] = new Date().toISOString();
      }
      try {
        localStorage.setItem(REVIEW_KEY, JSON.stringify(next));
      } catch {
        // Review state is best-effort UI state — a full private-mode failure
        // must never break the dashboard.
      }
      return next;
    });
  }, []);

  const items = useMemo(
    () =>
      (data && data.projects ? data.projects : []).map((entry) => ({
        ...entry,
        reviewed: Boolean(reviewed[entry.projectId]),
      })),
    [data, reviewed]
  );

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  return {
    summary: data && data.summary ? data.summary : null,
    disclaimer: data && data.disclaimer ? data.disclaimer : null,
    items,
    loading,
    error,
    refresh,
    toggleReviewed,
  };
}
