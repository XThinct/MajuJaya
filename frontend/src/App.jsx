import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import { LoadState } from './components/ui';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import RequestsPage from './pages/RequestsPage';
import NewRequestPage from './pages/NewRequestPage';
import RequestDetailPage from './pages/RequestDetailPage';
import ActivityPage from './pages/ActivityPage';
function Protected() {
  const auth = useAuth();
  if (auth.loading || auth.error) return <div className="standalone-state"><LoadState loading={auth.loading} error={auth.error} reload={auth.retry}/></div>;
  return auth.user ? <Layout/> : <Navigate to="/login" replace/>;
}
function ApprovalsGuard() { const { user } = useAuth(); return user.canApproveRequests ? <RequestsPage inbox/> : <Navigate to="/" replace/>; }
function PersonalRequestsGuard({ children }) { const { user } = useAuth(); return user.role === 'Plant Director' ? <Navigate to="/activity" replace/> : children; }
export default function App() {
  return <BrowserRouter><AuthProvider><Routes><Route path="/login" element={<LoginPage/>}/><Route element={<Protected/>}><Route index element={<DashboardPage/>}/><Route path="requests" element={<PersonalRequestsGuard><RequestsPage/></PersonalRequestsGuard>}/><Route path="approvals" element={<ApprovalsGuard/>}/><Route path="requests/new" element={<PersonalRequestsGuard><NewRequestPage/></PersonalRequestsGuard>}/><Route path="requests/:id" element={<RequestDetailPage/>}/><Route path="activity" element={<ActivityPage/>}/><Route path="*" element={<div className="empty"><h1>Page not found</h1><Link to="/">Return to overview</Link></div>}/></Route></Routes></AuthProvider></BrowserRouter>;
}
