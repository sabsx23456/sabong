import { create } from 'zustand';
import { supabase } from './supabase';
import type { Profile } from '../types';
import type { Session } from '@supabase/supabase-js';

import type { RealtimeChannel } from '@supabase/supabase-js';

interface AuthState {
    session: Session | null;
    profile: Profile | null;
    loading: boolean;
    initialized: boolean;
    channel: RealtimeChannel | null;
    initialize: () => Promise<void>;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    session: null,
    profile: null,
    loading: true,
    initialized: false,
    channel: null,

    initialize: async () => {
        if (get().initialized) return;
        set({ initialized: true });

        try {
            // 1. Get initial session
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError) throw sessionError;

            if (!session) {
                set({ session: null, profile: null, loading: false });
            } else {
                // Initial profile fetch
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();

                set({ session, profile: profile as Profile, loading: false });
            }

            // 2. Listen for auth changes
            supabase.auth.onAuthStateChange(async (event, session) => {
                console.log("Auth state changed:", event);

                if (event === 'SIGNED_OUT' || !session) {
                    set({ session: null, profile: null, loading: false });
                    // Clean up existing subscription if any
                    const currentChannel = get().channel;
                    if (currentChannel) {
                        supabase.removeChannel(currentChannel);
                        set({ channel: null });
                    }
                    return;
                }

                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
                    // Update session reference
                    const currentProfile = get().profile;

                    // If we don't have a profile yet, or user changed, fetch it
                    if (!currentProfile || currentProfile.id !== session.user.id) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('*')
                            .eq('id', session.user.id)
                            .single();

                        set({ session, profile: profile as Profile, loading: false });

                        // Setup Realtime Subscription for Profile
                        const channel = supabase
                            .channel(`profile:${session.user.id}`)
                            .on('postgres_changes', {
                                event: 'UPDATE',
                                schema: 'public',
                                table: 'profiles',
                                filter: `id=eq.${session.user.id}`
                            }, (payload) => {
                                console.log("Profile updated via realtime:", payload);
                                set({ profile: payload.new as Profile });
                            })
                            .subscribe();

                        set({ channel });

                    } else {
                        // Just update session if profile is already loaded
                        set({ session, loading: false });
                    }
                }
            });

        } catch (error) {
            console.error("Auth initialization error:", error);
            set({ session: null, profile: null, loading: false });
        }
    },

    signOut: async () => {
        try {
            await supabase.auth.signOut();
            const currentChannel = get().channel;
            if (currentChannel) {
                supabase.removeChannel(currentChannel);
            }
        } finally {
            set({ session: null, profile: null, channel: null });
        }
    },

    refreshProfile: async () => {
        const session = get().session;
        if (!session) return;

        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (profile) {
                set({ profile: profile as Profile });
            }
        } catch (error) {
            console.error("Profile refresh error:", error);
        }
    }
}));
