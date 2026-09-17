import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getHealth } from '../services/api';

export default function Health() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-lg w-full bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-bold mb-4">Backend Health</h1>

        {error ? (
          <p className="text-red-600">Could not reach the backend: {error}</p>
        ) : health ? (
          <pre className="bg-gray-100 rounded p-3 text-sm overflow-x-auto">
            {JSON.stringify(health, null, 2)}
          </pre>
        ) : (
          <p className="text-gray-500">Loading…</p>
        )}

        <Link
          to="/"
          className="inline-block text-blue-600 hover:underline mt-4"
        >
          ← Back to Home
        </Link>
      </div>
    </main>
  );
}