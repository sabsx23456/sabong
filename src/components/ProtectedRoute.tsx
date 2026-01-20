import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../lib/store';

export const ProtectedRoute = () => {
    const { session, profile, loading } = useAuthStore();

    if (loading) {
        return (
            <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
            </div>
        );
    }

    if (!session) return <Navigate to="/login" replace />;

    // If account is pending, only allow access to the pending page
    if (profile?.status === 'pending' && window.location.pathname !== '/pending') {
        return <Navigate to="/pending" replace />;
    }

    // If account is active, don't allow access to the pending page
    if (profile?.status === 'active' && window.location.pathname === '/pending') {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
};
