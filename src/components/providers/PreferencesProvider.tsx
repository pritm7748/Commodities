'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface UserPreferences {
    defaultCommodity: string;
    refreshInterval: number;
    tickerBarSpeed: 'slow' | 'normal' | 'fast';
    showTickerBar: boolean;
    compactMode: boolean;
    chartType: 'candle' | 'line' | 'area';
    defaultTimeframe: '1D' | '1W' | '1M' | '3M' | '1Y';
}

export const DEFAULT_PREFS: UserPreferences = {
    defaultCommodity: 'GC=F',
    refreshInterval: 30,
    tickerBarSpeed: 'normal',
    showTickerBar: true,
    compactMode: false,
    chartType: 'candle',
    defaultTimeframe: '1M',
};

const LS_KEY = 'commodity_prefs';

interface PreferencesContextValue {
    prefs: UserPreferences;
    updatePref: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
    resetPrefs: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue>({
    prefs: DEFAULT_PREFS,
    updatePref: () => {},
    resetPrefs: () => {},
});

export function usePreferences() {
    return useContext(PreferencesContext);
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
    const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);
    const [loaded, setLoaded] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                setPrefs(prev => ({ ...prev, ...parsed }));
            }
        } catch { /* ignore */ }
        setLoaded(true);
    }, []);

    // Persist to localStorage on every change (after initial load)
    useEffect(() => {
        if (loaded) {
            try {
                localStorage.setItem(LS_KEY, JSON.stringify(prefs));
            } catch { /* ignore */ }
        }
    }, [prefs, loaded]);

    const updatePref = useCallback(<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
        setPrefs(prev => ({ ...prev, [key]: value }));
    }, []);

    const resetPrefs = useCallback(() => {
        setPrefs(DEFAULT_PREFS);
        try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
    }, []);

    return (
        <PreferencesContext.Provider value={{ prefs, updatePref, resetPrefs }}>
            {children}
        </PreferencesContext.Provider>
    );
}
