import { BrowserRouter, Route, Routes } from 'react-router-dom';

import AppLayout from './components/AppLayout';
import { CommandPaletteProvider } from './context/CommandPaletteContext';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Health from './pages/Health';
import Home from './pages/Home';
import Login from './pages/Login';
import MilestonesList from './pages/MilestonesList';
import PaymentsDashboard from './pages/PaymentsDashboard';
import ProjectDetails from './pages/ProjectDetails';
import ProjectEdit from './pages/ProjectEdit';
import ProjectNew from './pages/ProjectNew';
import ProjectsList from './pages/ProjectsList';
import Register from './pages/Register';
import RiskDashboard from './pages/RiskDashboard';
import TenderDetails from './pages/TenderDetails';
import TenderList from './pages/TenderList';
import TenderNew from './pages/TenderNew';

export default function App() {
  return (
    <BrowserRouter>
      <CommandPaletteProvider>
        <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/health" element={<Health />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Authenticated pages share the role-aware top navigation layout. */}
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/projects" element={<ProjectsList />} />
          <Route
            path="/projects/new"
            element={
              <ProtectedRoute roles={['government_officer']}>
                <ProjectNew />
              </ProtectedRoute>
            }
          />
          <Route path="/projects/:id" element={<ProjectDetails />} />
          <Route
            path="/projects/:id/edit"
            element={
              <ProtectedRoute roles={['government_officer']}>
                <ProjectEdit />
              </ProtectedRoute>
            }
          />
          <Route path="/tenders" element={<TenderList />} />
          <Route
            path="/tenders/new"
            element={
              <ProtectedRoute roles={['government_officer']}>
                <TenderNew />
              </ProtectedRoute>
            }
          />
          <Route path="/tenders/:id" element={<TenderDetails />} />
          <Route path="/milestones" element={<MilestonesList />} />
          {/* Stage 3.3 · unified payment dashboard (role-aware: officer manages,
              contractor sees own payments, auditor read-only). */}
          <Route path="/payments" element={<PaymentsDashboard />} />
          {/* Stage 4.3 · AI Risk Dashboard & Alerts */}
          <Route path="/risk" element={<RiskDashboard />} />
        </Route>
        </Routes>
      </CommandPaletteProvider>
    </BrowserRouter>
  );
}