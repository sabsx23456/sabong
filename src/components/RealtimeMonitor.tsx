
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { useToast } from '../components/ui/Toast';

export const RealtimeMonitor = () => {
    const { profile } = useAuthStore();
    const { showToast } = useToast();
    const prevBalance = useRef<number | null>(null);
    const location = useLocation();

    useEffect(() => {
        // Skip first render or if profile is null
        if (!profile) return;

        // Initialize ref if null
        if (prevBalance.current === null) {
            prevBalance.current = Number(profile.balance);
            return;
        }

        const currentBalance = Number(profile.balance);
        const previous = prevBalance.current;

        // Detect balance change
        if (currentBalance !== previous) {
            const diff = currentBalance - previous;

            if (diff > 0) {
                // Cash In / Win
                // Only show toast if NOT on dashboard (to avoid double notification with Match Winner)
                if (location.pathname !== '/') {
                    showToast(`Balance Received: +₱${diff.toLocaleString()}`, 'cash-in');
                } else {
                    // Slight chance this is a "win" on dashboard handled by other component, 
                    // OR a manual top-up while on dashboard. 
                    // Use 'cash-in' style which is distinct/nicer than generic success.
                    showToast(`Balance Received: +₱${diff.toLocaleString()}`, 'cash-in');
                }
            } else if (diff < 0) {
                // Cash Out / Bet Placed
                // If on dashboard, assume it's a bet -> Suppress
                if (location.pathname !== '/') {
                    showToast(`Balance Deducted: -₱${Math.abs(diff).toLocaleString()}`, 'cash-out');
                }
            }

            prevBalance.current = currentBalance;
        }
    }, [profile?.balance, showToast, location.pathname]);

    return null; // Headless component
};
