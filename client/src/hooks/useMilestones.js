import { useCallback, useEffect, useState } from 'react';

import {
  createMilestone,
  getProjectMilestones,
  rejectMilestone,
  submitMilestone,
  updateMilestoneStatus,
  verifyMilestone,
} from '../services/milestone.service';

// Loads and mutates milestones for a single project.
export default function useMilestones(projectId) {
  const [milestones, setMilestones] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    if (!projectId) {
      setMilestones([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    getProjectMilestones(projectId)
      .then((data) => {
        setMilestones(data.milestones);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    (payload) =>
      createMilestone(projectId, payload).then((data) => {
        refresh();
        return data;
      }),
    [projectId, refresh]
  );

  const updateStatus = useCallback(
    (id, status) =>
      updateMilestoneStatus(id, status).then((data) => {
        refresh();
        return data;
      }),
    [refresh]
  );

  // Stage 2.3 · milestone verification lifecycle. Each action updates the
  // milestone and records its blockchain event in one backend call.
  const submit = useCallback(
    (id) =>
      submitMilestone(id).then((data) => {
        refresh();
        return data;
      }),
    [refresh]
  );

  const verify = useCallback(
    (id) =>
      verifyMilestone(id).then((data) => {
        refresh();
        return data;
      }),
    [refresh]
  );

  const reject = useCallback(
    (id, reason) =>
      rejectMilestone(id, reason).then((data) => {
        refresh();
        return data;
      }),
    [refresh]
  );

  return { milestones, loading, error, refresh, create, updateStatus, submit, verify, reject };
}