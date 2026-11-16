import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import { LoadState } from './components/ui';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import RequestsPage from './pages/RequestsPage';
import NewRequestPage from './pages/NewRequestPage';
import RequestDetailPage from './pages/RequestDetailPage';
import EmployeesPage from './pages/EmployeesPage';
import ActivityPage from './pages/ActivityPage';
function Protected() {
  const auth = useAuth();
  if (auth.loading || auth.error) return <div className="standalone-state"><LoadState loading={auth.loading} error={auth.error} reload={auth.retry}/></div>;
  return auth.user ? <Layout/> : <Navigate to="/login" replace/>;
}
function PeopleGuard() { const { user } = useAuth(); return user.isAdmin ? <EmployeesPage/> : <Navigate to="/" replace/>; }
export default function App() {
  return <BrowserRouter><AuthProvider><Routes><Route path="/login" element={<LoginPage/>}/><Route element={<Protected/>}><Route index element={<DashboardPage/>}/><Route path="requests" element={<RequestsPage/>}/><Route path="approvals" element={<RequestsPage inbox/>}/><Route path="requests/new" element={<NewRequestPage/>}/><Route path="requests/:id" element={<RequestDetailPage/>}/><Route path="employees" element={<PeopleGuard/>}/><Route path="activity" element={<ActivityPage/>}/><Route path="*" element={<div className="empty"><h1>Page not found</h1><Link to="/">Return to overview</Link></div>}/></Route></Routes></AuthProvider></BrowserRouter>;
}
