'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import AppShell from '@/components/layout/AppShell';
import { useSupabaseData } from '@/hooks/useSupabaseData';

/* ── Commodity Universe ─────────────────────────────────────── */
const ALL_COMMODITIES = [
    { name: 'Gold', ticker: 'GC=F', icon: '🥇' },
    { name: 'Silver', ticker: 'SI=F', icon: '🥈' },
    { name: 'Platinum', ticker: 'PL=F', icon: '✨' },
    { name: 'Copper', ticker: 'HG=F', icon: '🔩' },
    { name: 'Aluminium', ticker: 'ALI=F', icon: '🪶' },
    { name: 'Crude Oil', ticker: 'CL=F', icon: '🛢️' },
    { name: 'Brent', ticker: 'BZ=F', icon: '🛢️' },
    { name: 'Natural Gas', ticker: 'NG=F', icon: '🔥' },
    { name: 'Wheat', ticker: 'ZW=F', icon: '🌾' },
    { name: 'Corn', ticker: 'ZC=F', icon: '🌽' },
    { name: 'Soybeans', ticker: 'ZS=F', icon: '🫘' },
    { name: 'Cotton', ticker: 'CT=F', icon: '🧶' },
    { name: 'Sugar', ticker: 'SB=F', icon: '🍬' },
    { name: 'Coffee', ticker: 'KC=F', icon: '☕' },
];

/* ── Types ──────────────────────────────────────────────────── */
interface Alert {
    id: string;
    commodity: string;
    ticker: string;
    icon: string;
    type: 'price_above' | 'price_below' | 'pct_up' | 'pct_down';
    value: number;
    note: string;
    status: 'armed' | 'triggered' | 'silenced';
    createdAt: string;
    triggeredAt?: string;
    triggeredPrice?: number;
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const TYPE_LABELS: Record<string, string> = {
    price_above: 'Price Above',
    price_below: 'Price Below',
    pct_up: '% Change Up',
    pct_down: '% Change Down',
};

const TYPE_ICONS: Record<string, string> = {
    price_above: '📈',
    price_below: '📉',
    pct_up: '🚀',
    pct_down: '⚠️',
};

/* ══════════════════════════════════════════════════════════════ */
/*                      ALERTS PAGE                               */
/* ══════════════════════════════════════════════════════════════ */
export default function AlertsPage() {
    const alertStore = useSupabaseData<Alert>('user_alerts', 'commodity_alerts');
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ ticker: '', type: 'price_above' as Alert['type'], value: '', note: '' });
    const [prices, setPrices] = useState<Record<string, number>>({});
    const [toasts, setToasts] = useState<{ id: string; msg: string; icon: string }[]>([]);
    const [filter, setFilter] = useState<'all' | 'armed' | 'triggered'>('all');
    const [checking, setChecking] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastCheckRef = useRef<string>('Never');
    const [lastCheck, setLastCheck] = useState('Never');

    // ── Init from store ──
    useEffect(() => {
        if (!alertStore.loading) setAlerts(alertStore.data);
    }, [alertStore.data, alertStore.loading]);

    function persistAlerts(updated: Alert[]) {
        setAlerts(updated);
        alertStore.saveAll(updated);
    }

    // Request notification permission
    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    // ── Toast management ──
    function showToast(msg: string, icon: string) {
        const id = uid();
        setToasts(prev => [...prev, { id, msg, icon }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
    }

    // ── Fetch price for a ticker ──
    const fetchCurrentPrice = useCallback(async (ticker: string): Promise<number | null> => {
        try {
            const res = await fetch(`/api/prices/yahoo?symbols=${encodeURIComponent(ticker)}&range=5d&interval=1d`);
            const data = await res.json();
            const closes = data.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.filter((v: number | null) => v != null) as number[] | undefined;
            if (!closes || closes.length === 0) return null;
            return closes[closes.length - 1];
        } catch { return null; }
    }, []);

    // ── Evaluate alerts ──
    const evaluateAlerts = useCallback(async () => {
        const armed = alerts.filter(a => a.status === 'armed');
        if (armed.length === 0) return;

        setChecking(true);
        const tickers = [...new Set(armed.map(a => a.ticker))];
        const newPrices: Record<string, number> = { ...prices };

        // Fetch all prices
        await Promise.all(tickers.map(async (tk) => {
            const p = await fetchCurrentPrice(tk);
            if (p !== null) newPrices[tk] = p;
        }));
        setPrices(newPrices);

        // Check conditions
        let updatedAlerts = [...alerts];
        let triggered = false;

        for (const alert of armed) {
            const price = newPrices[alert.ticker];
            if (price === undefined) continue;

            let shouldTrigger = false;
            if (alert.type === 'price_above' && price >= alert.value) shouldTrigger = true;
            if (alert.type === 'price_below' && price <= alert.value) shouldTrigger = true;
            // For pct alerts we need prevClose
            if (alert.type === 'pct_up' || alert.type === 'pct_down') {
                try {
                    const res = await fetch(`/api/prices/yahoo?symbols=${encodeURIComponent(alert.ticker)}&range=5d&interval=1d`);
                    const data = await res.json();
                    const closes = data.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.filter((v: number | null) => v != null) as number[];
                    if (closes && closes.length >= 2) {
                        const pct = ((closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2]) * 100;
                        if (alert.type === 'pct_up' && pct >= alert.value) shouldTrigger = true;
                        if (alert.type === 'pct_down' && pct <= -alert.value) shouldTrigger = true;
                    }
                } catch { /* skip */ }
            }

            if (shouldTrigger) {
                triggered = true;
                updatedAlerts = updatedAlerts.map(a =>
                    a.id === alert.id ? { ...a, status: 'triggered' as const, triggeredAt: new Date().toISOString(), triggeredPrice: price } : a
                );
                const msg = `${alert.icon} ${alert.commodity}: ${TYPE_LABELS[alert.type]} ${alert.value} — Current: ${price.toFixed(2)}`;
                showToast(msg, alert.icon);

                // Browser notification
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification(`🔔 Alert Triggered: ${alert.commodity}`, { body: msg, icon: '/favicon.ico' });
                }
            }
        }

        if (triggered) {
            persistAlerts(updatedAlerts);
        }

        lastCheckRef.current = new Date().toLocaleTimeString();
        setLastCheck(lastCheckRef.current);
        setChecking(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [alerts, prices, fetchCurrentPrice]);

    // ── Auto-check every 60s ──
    useEffect(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        const armed = alerts.filter(a => a.status === 'armed');
        if (armed.length > 0) {
            evaluateAlerts(); // initial check
            intervalRef.current = setInterval(evaluateAlerts, 60000);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [alerts.filter(a => a.status === 'armed').length]);

    /* ── CRUD ────────────────────────────────────────────────── */
    function createAlert() {
        const comm = ALL_COMMODITIES.find(c => c.ticker === form.ticker);
        if (!comm || !form.value) return;
        const alert: Alert = {
            id: uid(), commodity: comm.name, ticker: comm.ticker, icon: comm.icon,
            type: form.type, value: parseFloat(form.value), note: form.note,
            status: 'armed', createdAt: new Date().toISOString(),
        };
        persistAlerts([...alerts, alert]);
        setShowCreate(false); setForm({ ticker: '', type: 'price_above', value: '', note: '' });
    }

    function deleteAlert(id: string) {
        persistAlerts(alerts.filter(a => a.id !== id));
    }

    function silenceAlert(id: string) {
        persistAlerts(alerts.map(a => a.id === id ? { ...a, status: 'silenced' as const } : a));
    }

    function rearmAlert(id: string) {
        persistAlerts(alerts.map(a => a.id === id ? { ...a, status: 'armed' as const, triggeredAt: undefined, triggeredPrice: undefined } : a));
    }

    function clearTriggered() {
        persistAlerts(alerts.filter(a => a.status !== 'triggered'));
    }

    /* ── Filtered ────────────────────────────────────────────── */
    const armedAlerts = alerts.filter(a => a.status === 'armed');
    const triggeredAlerts = alerts.filter(a => a.status === 'triggered');
    const filtered = filter === 'all' ? alerts : filter === 'armed' ? armedAlerts : triggeredAlerts;

    /* ── Styles ──────────────────────────────────────────────── */
    const s = {
        tabs: { display: 'flex', gap: 'var(--space-1)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', padding: '4px', width: 'fit-content' } as React.CSSProperties,
        tab: (active: boolean) => ({ padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 'var(--text-sm)', background: active ? 'var(--bg-primary)' : 'transparent', color: active ? 'var(--text-primary)' : 'var(--text-tertiary)', boxShadow: active ? '0 1px 3px rgba(0,0,0,0.15)' : 'none', transition: 'all 0.2s' }) as React.CSSProperties,
        card: { background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)', overflow: 'hidden' } as React.CSSProperties,
        statCard: { display: 'flex', flexDirection: 'column', gap: '4px', padding: 'var(--space-3) var(--space-4)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)', minWidth: '140px' } as React.CSSProperties,
        btn: (variant: 'primary' | 'secondary' | 'danger' = 'primary') => ({
            padding: '6px 14px', borderRadius: 'var(--radius-md)', border: variant === 'primary' ? 'none' : '1px solid var(--border-primary)',
            cursor: 'pointer', fontWeight: 600, fontSize: 'var(--text-xs)', transition: 'all 0.15s',
            background: variant === 'primary' ? '#3b82f6' : variant === 'danger' ? '#ef4444' : 'var(--bg-tertiary)',
            color: variant === 'primary' || variant === 'danger' ? '#fff' : 'var(--text-secondary)',
        }) as React.CSSProperties,
        input: { padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 'var(--text-sm)', outline: 'none', width: '100%' } as React.CSSProperties,
        badge: (color: string) => ({ padding: '2px 8px', borderRadius: '999px', fontSize: 'var(--text-xs)', fontWeight: 600, background: `${color}22`, color }) as React.CSSProperties,
        overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' } as React.CSSProperties,
        modal: { background: 'var(--bg-primary)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-primary)', padding: 'var(--space-5)', width: '90%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' } as React.CSSProperties,
        row: { display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-primary)', transition: 'background 0.15s' } as React.CSSProperties,
    };

    const STATUS_COLORS: Record<string, string> = { armed: '#3b82f6', triggered: '#f59e0b', silenced: '#6b7280' };
    const STATUS_ICONS: Record<string, string> = { armed: '🎯', triggered: '🔔', silenced: '🔇' };

    return (
        <AppShell title="Alerts" subtitle="Custom Price & Technical Alerts">
            {/* Toast notifications */}
            <div style={{ position: 'fixed', top: 'var(--space-4)', right: 'var(--space-4)', zIndex: 200, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxWidth: '340px' }}>
                {toasts.map(t => (
                    <div key={t.id} style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--bg-primary)', border: '1px solid #f59e0b', borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 30px rgba(0,0,0,0.25)', animation: 'slideIn 0.3s ease-out', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                        <span style={{ fontSize: '1.3rem' }}>{t.icon}</span>
                        <span>{t.msg}</span>
                    </div>
                ))}
            </div>

            {/* Summary cards */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
                <div style={s.statCard}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>Armed Alerts</span>
                    <span style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: '#3b82f6' }}>{armedAlerts.length}</span>
                </div>
                <div style={s.statCard}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>Triggered</span>
                    <span style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: '#f59e0b' }}>{triggeredAlerts.length}</span>
                </div>
                <div style={s.statCard}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>Total Alerts</span>
                    <span style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>{alerts.length}</span>
                </div>
                <div style={s.statCard}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>Last Check</span>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {checking ? '⏳ Checking...' : lastCheck}
                    </span>
                </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                <div style={s.tabs}>
                    {(['all', 'armed', 'triggered'] as const).map(f => (
                        <button key={f} style={s.tab(filter === f)} onClick={() => setFilter(f)}>
                            {f === 'all' ? `All (${alerts.length})` : f === 'armed' ? `🎯 Armed (${armedAlerts.length})` : `🔔 Triggered (${triggeredAlerts.length})`}
                        </button>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button onClick={evaluateAlerts} style={s.btn('secondary')} disabled={checking}>
                        {checking ? '⏳ Checking...' : '🔄 Check Now'}
                    </button>
                    {triggeredAlerts.length > 0 && (
                        <button onClick={clearTriggered} style={s.btn('secondary')}>🧹 Clear Triggered</button>
                    )}
                    <button onClick={() => setShowCreate(true)} style={s.btn('primary')}>+ New Alert</button>
                </div>
            </div>

            {/* Alert list */}
            <div style={s.card}>
                <div style={{ ...s.row, fontWeight: 700, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--bg-tertiary)' }}>
                    <span style={{ flex: '0 0 160px' }}>Commodity</span>
                    <span style={{ flex: '0 0 120px' }}>Type</span>
                    <span style={{ flex: '0 0 90px', textAlign: 'right' }}>Target</span>
                    <span style={{ flex: '0 0 90px', textAlign: 'right' }}>Current</span>
                    <span style={{ flex: '0 0 80px', textAlign: 'center' }}>Status</span>
                    <span style={{ flex: 1, minWidth: '100px' }}>Note</span>
                    <span style={{ flex: '0 0 120px', textAlign: 'center' }}>Actions</span>
                </div>

                {filtered.length === 0 && (
                    <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        {alerts.length === 0 ? 'No alerts yet. Create your first alert to start monitoring.' : 'No alerts match this filter.'}
                    </div>
                )}

                {filtered.map(alert => (
                    <div key={alert.id} style={{ ...s.row, background: alert.status === 'triggered' ? 'rgba(245,158,11,0.05)' : 'transparent' }}>
                        <span style={{ flex: '0 0 160px', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <span style={{ fontSize: '1.2rem' }}>{alert.icon}</span>
                            <span>
                                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{alert.commodity}</div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{alert.ticker}</div>
                            </span>
                        </span>
                        <span style={{ flex: '0 0 120px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                            {TYPE_ICONS[alert.type]} {TYPE_LABELS[alert.type]}
                        </span>
                        <span style={{ flex: '0 0 90px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                            {alert.type.startsWith('pct') ? `${alert.value}%` : alert.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        <span style={{ flex: '0 0 90px', textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                            {alert.triggeredPrice ? alert.triggeredPrice.toFixed(2) : (prices[alert.ticker] ? prices[alert.ticker].toFixed(2) : '—')}
                        </span>
                        <span style={{ flex: '0 0 80px', textAlign: 'center' }}>
                            <span style={s.badge(STATUS_COLORS[alert.status])}>
                                {STATUS_ICONS[alert.status]} {alert.status.charAt(0).toUpperCase() + alert.status.slice(1)}
                            </span>
                        </span>
                        <span style={{ flex: 1, minWidth: '100px', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {alert.note || '—'}
                            {alert.triggeredAt && (
                                <div style={{ color: '#f59e0b', marginTop: '2px' }}>Triggered {new Date(alert.triggeredAt).toLocaleString()}</div>
                            )}
                        </span>
                        <span style={{ flex: '0 0 120px', textAlign: 'center', display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            {alert.status === 'armed' && <button onClick={() => silenceAlert(alert.id)} style={s.btn('secondary')} title="Silence">🔇</button>}
                            {(alert.status === 'triggered' || alert.status === 'silenced') && <button onClick={() => rearmAlert(alert.id)} style={s.btn('secondary')} title="Re-arm">🎯</button>}
                            <button onClick={() => { if (confirm('Delete this alert?')) deleteAlert(alert.id); }} style={{ ...s.btn('secondary'), color: '#ef4444' }}>🗑️</button>
                        </span>
                    </div>
                ))}
            </div>

            {/* Create Alert Modal */}
            {showCreate && (
                <div style={s.overlay} onClick={() => setShowCreate(false)}>
                    <div style={s.modal} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: '0 0 var(--space-3)', color: 'var(--text-primary)' }}>Create Alert</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>Commodity</label>
                                <select value={form.ticker} onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))} style={s.input}>
                                    <option value="">Select commodity...</option>
                                    {ALL_COMMODITIES.map(c => <option key={c.ticker} value={c.ticker}>{c.icon} {c.name} ({c.ticker})</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>Alert Type</label>
                                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as Alert['type'] }))} style={s.input}>
                                    <option value="price_above">📈 Price Above</option>
                                    <option value="price_below">📉 Price Below</option>
                                    <option value="pct_up">🚀 % Change Up (daily)</option>
                                    <option value="pct_down">⚠️ % Change Down (daily)</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                                    {form.type.startsWith('pct') ? 'Threshold (%)' : 'Price Level'}
                                </label>
                                <input type="number" step="0.01" placeholder={form.type.startsWith('pct') ? 'e.g. 2.5' : 'e.g. 2200.00'} value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} style={s.input} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>Note (optional)</label>
                                <input placeholder="Reminder or context..." value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} style={s.input} />
                            </div>
                            {form.ticker && prices[form.ticker] !== undefined && (
                                <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                                    Current price: <strong>${prices[form.ticker].toFixed(2)}</strong>
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                <button onClick={() => setShowCreate(false)} style={{ ...s.btn('secondary'), flex: 1 }}>Cancel</button>
                                <button onClick={createAlert} style={{ ...s.btn('primary'), flex: 1 }} disabled={!form.ticker || !form.value}>Create Alert</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes slideIn {
                    from { opacity: 0; transform: translateX(100px); }
                    to { opacity: 1; transform: translateX(0); }
                }
            `}</style>
        </AppShell>
    );
}
