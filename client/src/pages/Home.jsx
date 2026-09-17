import { Link } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user, logout } = useAuth();

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-lg w-full bg-white rounded-lg shadow p-8 text-center">
        <h1 className="text-3xl font-bold mb-2">GovChain</h1>
        <p className="text-gray-600 mb-6">
          Transparent government project spending and procurement.
        </p>

        <nav className="mb-2 space-x-4">
          {user ? (
            <>
              <Link
                to="/dashboard"
                className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Dashboard
              </Link>
              <Link
                to="/projects"
                className="inline-block bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
              >
                Projects
              </Link>
              <Link
                to="/tenders"
                className="inline-block bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
              >
                Tenders
              </Link>
              <Link
                to="/health"
                className="inline-block bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
              >
                Backend Health
              </Link>
              <button
                type="button"
                onClick={logout}
                className="inline-block bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="inline-block bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
              >
                Register
              </Link>
              <Link
                to="/health"
                className="inline-block bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
              >
                Backend Health
              </Link>
            </>
          )}
        </nav>
      </div>
    </main>
  );
}