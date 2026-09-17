import { useAuth } from '../context/AuthContext';

import AuditorDashboard from './AuditorDashboard';
import ContractorDashboard from './ContractorDashboard';
import OfficerDashboard from './OfficerDashboard';

// Renders the dashboard matching the authenticated user's role.
export default function Dashboard() {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="text-center text-gray-500 mt-8">Loading…</p>;
  }

  if (user.role === 'government_officer') {
    return <OfficerDashboard />;
  }
  if (user.role === 'contractor') {
    return <ContractorDashboard />;
  }
  if (user.role === 'auditor') {
    return <AuditorDashboard />;
  }

  return <p className="text-center text-gray-500 mt-8">Unknown role.</p>;
}