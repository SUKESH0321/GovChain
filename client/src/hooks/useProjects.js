import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { createProject, getProjects, updateProject } from '../services/project.service';
import { getTenders } from '../services/tender.service';

// Loads projects. Contractors automatically receive only the projects linked
// to tenders assigned to them (matching the list pages' behaviour).
export default function useProjects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);

    const apply = (list) => {
      setProjects(list);
      setLoading(false);
    };

    if (user.role === 'contractor') {
      Promise.all([getProjects(), getTenders()])
        .then(([projectsData, tendersData]) => {
          const ids = new Set(
            tendersData.tenders
              .filter((tender) => tender.contractor_id === user.id)
              .map((tender) => tender.project_id)
          );
          apply(projectsData.projects.filter((project) => ids.has(project.id)));
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    } else {
      getProjects()
        .then((data) => apply(data.projects))
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [user.id, user.role]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addProject = useCallback(
    (payload) =>
      createProject(payload).then((data) => {
        refresh();
        return data;
      }),
    [refresh]
  );

  const editProject = useCallback(
    (id, payload) =>
      updateProject(id, payload).then((data) => {
        refresh();
        return data;
      }),
    [refresh]
  );

  return { projects, loading, error, refresh, addProject, editProject };
}