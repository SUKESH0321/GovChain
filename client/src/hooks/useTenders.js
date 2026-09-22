import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { getTenders } from '../services/tender.service';

// Loads tenders. Contractors automatically receive only their assigned tenders.
export default function useTenders() {
  const { user } = useAuth();
  const [tenders, setTenders] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    getTenders()
      .then((data) => {
        setTenders(
          user.role === 'contractor'
            ? data.tenders.filter((tender) => tender.contractor_id === user.id)
            : data.tenders
        );
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [user.id, user.role]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tenders, loading, error, refresh };
}