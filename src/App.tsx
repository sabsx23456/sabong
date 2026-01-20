import { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './lib/store';
import { ToastProvider } from './components/ui/Toast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Loader2 } from 'lucide-react';
import { RealtimeMonitor } from './components/RealtimeMonitor';

// Lazy Load Pages
const Login = lazy(() => import('./pages/Login').then(module => ({ default: module.Login })));
const Register = lazy(() => import('./pages/Register').then(module => ({ default: module.Register })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const AdminUserManagement = lazy(() => import('./pages/dashboard/AdminUserManagement').then(module => ({ default: module.AdminUserManagement })));
const AdminLogsPage = lazy(() => import('./pages/dashboard/AdminLogsPage').then(module => ({ default: module.AdminLogsPage })));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage').then(module => ({ default: module.SettingsPage })));
const TransactionsPage = lazy(() => import('./pages/transactions/TransactionsPage').then(module => ({ default: module.TransactionsPage })));
const BettingAdminPage = lazy(() => import('./pages/betting/BettingAdminPage').then(module => ({ default: module.BettingAdminPage })));
const WalletPage = lazy(() => import('./pages/wallet/WalletPage').then(module => ({ default: module.WalletPage })));
const PendingApproval = lazy(() => import('./pages/PendingApproval').then(module => ({ default: module.PendingApproval })));
const BetHistoryPage = lazy(() => import('./pages/history/BetHistoryPage').then(module => ({ default: module.BetHistoryPage })));
const ChatSupportPage = lazy(() => import('./pages/support/ChatSupportPage').then(module => ({ default: module.ChatSupportPage })));

// Loading Component
const PageLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-casino-dark-900 text-casino-gold-400">
    <Loader2 className="w-12 h-12 animate-spin mb-4" />
    <span className="text-sm font-bold uppercase tracking-[0.2em]">Loading Resource...</span>
  </div>
);

function App() {
  const initialize = useAuthStore((state) => state.initialize);
  const session = useAuthStore((state) => state.session);

  useEffect(() => {
    initialize().catch(err => {
      console.error("Failed to initialize auth store:", err);
    });
  }, [initialize]);

  return (
    <ToastProvider>
      <BrowserRouter>
        <RealtimeMonitor />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={!session ? <Login /> : <Navigate to="/" replace />} />
            <Route path="/register" element={!session ? <Register /> : <Navigate to="/" replace />} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/users" element={<AdminUserManagement />} />
                <Route path="/admin-logs" element={<AdminLogsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/transactions" element={<TransactionsPage />} />
                <Route path="/history" element={<BetHistoryPage />} />
                <Route path="/wallet" element={<WalletPage />} />
                <Route path="/betting" element={<BettingAdminPage />} />
                <Route path="/pending" element={<PendingApproval />} />
                <Route path="/support" element={<ChatSupportPage />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
