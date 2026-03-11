'use client';
import React, { useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/components/providers/AuthProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import { usePreferences, DEFAULT_PREFS, type UserPreferences } from '@/components/providers/PreferencesProvider';

const COMMODITIES = [
    { name: 'Gold', ticker: 'GC=F' },
    { name: 'Silver', ticker: 'SI=F' },
    { name: 'Crude Oil', ticker: 'CL=F' },
    { name: 'Natural Gas', ticker: 'NG=F' },
    { name: 'Copper', ticker: 'HG=F' },
    { name: 'Wheat', ticker: 'ZW=F' },
    { name: 'Corn', ticker: 'ZC=F' },
    { name: 'Coffee', ticker: 'KC=F' },
];

export default function SettingsPage() {
    const { user, signOut } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { prefs, updatePref, resetPrefs } = usePreferences();
    const [clearing, setClearing] = useState(false);

    function clearAllData() {
        if (!confirm('This will permanently delete all your watchlists, alerts, trades, reports, and preferences. Are you sure?')) return;
        setClearing(true);
        try {
            localStorage.removeItem('commodity_watchlists');
            localStorage.removeItem('commodity_trades');
            localStorage.removeItem('commodity_alerts');
            localStorage.removeItem('commodity_reports');
            resetPrefs();
            setClearing(false);
            alert('All local data cleared. Refresh the page to see changes.');
        } catch {
            setClearing(false);
        }
    }

    /* ── Styles ────────────────────────────────────── */
    const s = {
        section: {
            background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-primary)', marginBottom: 'var(--space-4)',
            overflow: 'hidden',
        } as React.CSSProperties,
        sectionHead: {
            padding: 'var(--space-4)', borderBottom: '1px solid var(--border-primary)',
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
        } as React.CSSProperties,
        sectionIcon: {
            width: '36px', height: '36px', borderRadius: 'var(--radius-md)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', flexShrink: 0,
        } as React.CSSProperties,
        row: {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: 'var(--space-3) var(--space-4)',
            borderBottom: '1px solid var(--border-primary)',
        } as React.CSSProperties,
        rowLabel: {
            display: 'flex', flexDirection: 'column', gap: '2px',
        } as React.CSSProperties,
        label: { fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' } as React.CSSProperties,
        desc: { fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' } as React.CSSProperties,
        select: {
            padding: '6px 12px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)', fontSize: 'var(--text-sm)', outline: 'none',
            cursor: 'pointer',
        } as React.CSSProperties,
        toggle: (on: boolean) => ({
            width: '44px', height: '24px', borderRadius: '12px', border: 'none',
            background: on ? '#3b82f6' : 'var(--bg-tertiary)',
            position: 'relative' as const, cursor: 'pointer', transition: 'background 0.2s',
            padding: 0, flexShrink: 0,
        }),
        toggleDot: (on: boolean) => ({
            position: 'absolute' as const, top: '2px',
            left: on ? '22px' : '2px',
            width: '20px', height: '20px', borderRadius: '50%',
            background: '#fff', transition: 'left 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }),
        btn: (variant: 'primary' | 'danger') => ({
            padding: '10px 20px', borderRadius: 'var(--radius-md)',
            fontWeight: 600, fontSize: 'var(--text-sm)', cursor: 'pointer',
            transition: 'all 0.2s',
            background: variant === 'primary' ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : '#ef4444',
            color: '#fff',
            border: 'none',
        } as React.CSSProperties),
        badge: {
            padding: '3px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
            background: 'rgba(59,130,246,0.15)', color: '#3b82f6',
        } as React.CSSProperties,
    };

    return (
        <AppShell title="Settings" subtitle="Customize Your Experience">
            {/* ── Account ─────────────────────────── */}
            <div style={s.section}>
                <div style={s.sectionHead}>
                    <div style={{ ...s.sectionIcon, background: 'rgba(59,130,246,0.12)' }}>👤</div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>Account</div>
                        <div style={s.desc}>Your login and profile details</div>
                    </div>
                </div>

                <div style={s.row}>
                    <div style={s.rowLabel}>
                        <span style={s.label}>Email</span>
                        <span style={s.desc}>Your registered email address</span>
                    </div>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                        {user?.email || 'Not logged in'}
                    </span>
                </div>

                <div style={s.row}>
                    <div style={s.rowLabel}>
                        <span style={s.label}>Status</span>
                        <span style={s.desc}>Your account sync status</span>
                    </div>
                    <span style={s.badge}>
                        {user ? '✓ Synced to Cloud' : '⚡ Local Only'}
                    </span>
                </div>

                {user && (
                    <div style={{ ...s.row, borderBottom: 'none' }}>
                        <div style={s.rowLabel}>
                            <span style={s.label}>Sign Out</span>
                            <span style={s.desc}>Log out of your account</span>
                        </div>
                        <button onClick={signOut} style={s.btn('danger')}>Log Out</button>
                    </div>
                )}
            </div>

            {/* ── Appearance ──────────────────────── */}
            <div style={s.section}>
                <div style={s.sectionHead}>
                    <div style={{ ...s.sectionIcon, background: 'rgba(139,92,246,0.12)' }}>🎨</div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>Appearance</div>
                        <div style={s.desc}>Theme and display preferences</div>
                    </div>
                </div>

                <div style={s.row}>
                    <div style={s.rowLabel}>
                        <span style={s.label}>Theme</span>
                        <span style={s.desc}>Switch between dark and light mode</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                            {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
                        </span>
                        <button style={s.toggle(theme === 'dark')} onClick={toggleTheme}>
                            <div style={s.toggleDot(theme === 'dark')} />
                        </button>
                    </div>
                </div>

                <div style={s.row}>
                    <div style={s.rowLabel}>
                        <span style={s.label}>Compact Mode</span>
                        <span style={s.desc}>Reduce padding for denser information display</span>
                    </div>
                    <button style={s.toggle(prefs.compactMode)} onClick={() => updatePref('compactMode', !prefs.compactMode)}>
                        <div style={s.toggleDot(prefs.compactMode)} />
                    </button>
                </div>

                <div style={{ ...s.row, borderBottom: 'none' }}>
                    <div style={s.rowLabel}>
                        <span style={s.label}>Ticker Bar</span>
                        <span style={s.desc}>Show scrolling price ticker at top</span>
                    </div>
                    <button style={s.toggle(prefs.showTickerBar)} onClick={() => updatePref('showTickerBar', !prefs.showTickerBar)}>
                        <div style={s.toggleDot(prefs.showTickerBar)} />
                    </button>
                </div>
            </div>

            {/* ── Trading Defaults ────────────────── */}
            <div style={s.section}>
                <div style={s.sectionHead}>
                    <div style={{ ...s.sectionIcon, background: 'rgba(245,158,11,0.12)' }}>📊</div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>Trading Defaults</div>
                        <div style={s.desc}>Default commodity, chart type, and timeframes</div>
                    </div>
                </div>

                <div style={s.row}>
                    <div style={s.rowLabel}>
                        <span style={s.label}>Default Commodity</span>
                        <span style={s.desc}>Which commodity to show first on charts</span>
                    </div>
                    <select
                        style={s.select}
                        value={prefs.defaultCommodity}
                        onChange={e => updatePref('defaultCommodity', e.target.value)}
                    >
                        {COMMODITIES.map(c => (
                            <option key={c.ticker} value={c.ticker}>{c.name} ({c.ticker})</option>
                        ))}
                    </select>
                </div>

                <div style={s.row}>
                    <div style={s.rowLabel}>
                        <span style={s.label}>Chart Type</span>
                        <span style={s.desc}>Default chart visualization</span>
                    </div>
                    <select
                        style={s.select}
                        value={prefs.chartType}
                        onChange={e => updatePref('chartType', e.target.value as UserPreferences['chartType'])}
                    >
                        <option value="candle">🕯️ Candlestick</option>
                        <option value="line">📈 Line</option>
                        <option value="area">📊 Area</option>
                    </select>
                </div>

                <div style={s.row}>
                    <div style={s.rowLabel}>
                        <span style={s.label}>Default Timeframe</span>
                        <span style={s.desc}>Time range shown by default</span>
                    </div>
                    <select
                        style={s.select}
                        value={prefs.defaultTimeframe}
                        onChange={e => updatePref('defaultTimeframe', e.target.value as UserPreferences['defaultTimeframe'])}
                    >
                        <option value="1D">1 Day</option>
                        <option value="1W">1 Week</option>
                        <option value="1M">1 Month</option>
                        <option value="3M">3 Months</option>
                        <option value="1Y">1 Year</option>
                    </select>
                </div>

                <div style={{ ...s.row, borderBottom: 'none' }}>
                    <div style={s.rowLabel}>
                        <span style={s.label}>Auto-Refresh Interval</span>
                        <span style={s.desc}>How often to fetch fresh price data</span>
                    </div>
                    <select
                        style={s.select}
                        value={prefs.refreshInterval}
                        onChange={e => updatePref('refreshInterval', parseInt(e.target.value))}
                    >
                        <option value={10}>10 seconds</option>
                        <option value={30}>30 seconds</option>
                        <option value={60}>1 minute</option>
                        <option value={300}>5 minutes</option>
                    </select>
                </div>
            </div>

            {/* ── Data Management ─────────────────── */}
            <div style={s.section}>
                <div style={s.sectionHead}>
                    <div style={{ ...s.sectionIcon, background: 'rgba(239,68,68,0.12)' }}>🗂️</div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>Data Management</div>
                        <div style={s.desc}>Manage your saved data and storage</div>
                    </div>
                </div>

                <div style={s.row}>
                    <div style={s.rowLabel}>
                        <span style={s.label}>Storage</span>
                        <span style={s.desc}>{user ? 'Data synced to Supabase cloud' : 'Data stored in browser localStorage'}</span>
                    </div>
                    <span style={s.badge}>{user ? '☁️ Cloud' : '💾 Local'}</span>
                </div>

                <div style={{ ...s.row, borderBottom: 'none' }}>
                    <div style={s.rowLabel}>
                        <span style={{ ...s.label, color: '#ef4444' }}>Clear All Data</span>
                        <span style={s.desc}>Delete all watchlists, alerts, trades, and reports from local storage</span>
                    </div>
                    <button
                        onClick={clearAllData}
                        disabled={clearing}
                        style={s.btn('danger')}
                    >
                        {clearing ? 'Clearing...' : '🗑️ Clear Data'}
                    </button>
                </div>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 'var(--space-2)' }}>
                All settings are saved automatically.
            </div>
        </AppShell>
    );
}
