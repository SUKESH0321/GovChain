import { useCallback, useEffect, useState } from 'react';

import {
  authorizePayment as authorizePaymentApi,
  getPayments,
  releasePayment as releasePaymentApi,
  rejectPayment as rejectPaymentApi,
} from '../services/payment.service';

// GovChain — Stage 3.1 · loads payment records and drives the authorize/reject
// lifecycle. `mine` limits the list to the signed-in contractor's payments.
export default function usePayments() {
  const [payments, setPayments] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    getPayments()
      .then((data) => {
        setPayments(data.payments);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const authorize = useCallback(
    (id) =>
      authorizePaymentApi(id).then((data) => {
        refresh();
        return data;
      }),
    [refresh]
  );

  const reject = useCallback(
    (id, reason) =>
      rejectPaymentApi(id, reason).then((data) => {
        refresh();
        return data;
      }),
    [refresh]
  );

  // Stage 3.2 · simulated release of an authorized payment.
  const release = useCallback(
    (id) =>
      releasePaymentApi(id).then((data) => {
        refresh();
        return data;
      }),
    [refresh]
  );

  return { payments, loading, error, refresh, authorize, reject, release };
}
