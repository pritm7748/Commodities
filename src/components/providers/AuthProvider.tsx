'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: string | null }>;
    signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null, session: null, loading: true,
    signIn: async () => ({ error: 'Not initialized' }),
    signUp: async () => ({ error: 'Not initialized', needsConfirmation: false }),
    signOut: async () => { },
});

export function useAuth() { return useContext(AuthContext); }

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const supabase = createClient();
        if (!supabase) { setLoading(false); return; }

        // Get initial session
        supabase.auth.getSession().then(({ data: { session: s } }: { data: { session: Session | null } }) => {
            setSession(s);
            setUser(s?.user ?? null);
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, s: Session | null) => {
            setSession(s);
            setUser(s?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signIn = async (email: string, password: string) => {
        const supabase = createClient();
        if (!supabase) return { error: 'Supabase not configured' };
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error?.message || null };
    };

    const signUp = async (email: string, password: string) => {
        const supabase = createClient();
        if (!supabase) return { error: 'Supabase not configured', needsConfirmation: false };
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) return { error: error.message, needsConfirmation: false };
        // If user is created but not confirmed, identities will be empty or session null
        const needsConfirmation = !data.session;
        return { error: null, needsConfirmation };
    };

    const signOut = async () => {
        const supabase = createClient();
        if (!supabase) return;
        await supabase.auth.signOut();
        setUser(null); setSession(null);
    };

    return (
        <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}
