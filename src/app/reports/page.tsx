'use client';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell';
import { useSupabaseData } from '@/hooks/useSupabaseData';

/* ── Commodity Universe ─────────────────────────────────────── */
const ALL_COMMODITIES = [
    { name: 'Gold', ticker: 'GC=F', icon: '🥇', sector: 'Precious' },
    { name: 'Silver', ticker: 'SI=F', icon: '🥈', sector: 'Precious' },
    { name: 'Platinum', ticker: 'PL=F', icon: '✨', sector: 'Precious' },
    { name: 'Copper', ticker: 'HG=F', icon: '🔩', sector: 'Base Metals' },
    { name: 'Aluminium', ticker: 'ALI=F', icon: '🪶', sector: 'Base Metals' },
    { name: 'Crude Oil', ticker: 'CL=F', icon: '🛢️', sector: 'Energy' },
    { name: 'Brent', ticker: 'BZ=F', icon: '🛢️', sector: 'Energy' },
    { name: 'Natural Gas', ticker: 'NG=F', icon: '🔥', sector: 'Energy' },
    { name: 'Wheat', ticker: 'ZW=F', icon: '🌾', sector: 'Agriculture' },
    { name: 'Corn', ticker: 'ZC=F', icon: '🌽', sector: 'Agriculture' },
    { name: 'Soybeans', ticker: 'ZS=F', icon: '🫘', sector: 'Agriculture' },
    { name: 'Cotton', ticker: 'CT=F', icon: '🧶', sector: 'Softs' },
    { name: 'Sugar', ticker: 'SB=F', icon: '🍬', sector: 'Softs' },
    { name: 'Coffee', ticker: 'KC=F', icon: '☕', sector: 'Softs' },
];

const SECTORS = [...new Set(ALL_COMMODITIES.map(c => c.sector))];

/* ── Types ──────────────────────────────────────────────────── */
interface CommodityData {
    name: string; icon: string; ticker: string; sector: string;
    price: number; prevClose: number; change: number; changePct: number;
    high5d: number; low5d: number;
    closes: number[]; // last 20 days
    rsi?: number;
    trend?: string;
}

interface SavedReport {
    id: string; type: string; title: string; generatedAt: string;
    commodityCount: number;
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/* ── RSI calculation ────────────────────────────────────────── */
function calcRSI(closes: number[], period = 14): number {
    if (closes.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) gains += diff; else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

function detectTrend(closes: number[]): string {
    if (closes.length < 10) return 'Neutral';
    const recent = closes.slice(-5);
    const older = closes.slice(-10, -5);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    const pctDiff = ((recentAvg - olderAvg) / olderAvg) * 100;
    if (pctDiff > 1.5) return '▲ Uptrend';
    if (pctDiff < -1.5) return '▼ Downtrend';
    return '→ Sideways';
}

/* ══════════════════════════════════════════════════════════════ */
/*                     REPORTS PAGE                               */
/* ══════════════════════════════════════════════════════════════ */
export default function ReportsPage() {
    const [tab, setTab] = useState<'premarket' | 'weekly' | 'custom' | 'history'>('premarket');
    const [data, setData] = useState<CommodityData[]>([]);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [generated, setGenerated] = useState(false);
    const [selectedTickers, setSelectedTickers] = useState<Set<string>>(new Set(ALL_COMMODITIES.map(c => c.ticker)));
    const reportStore = useSupabaseData<SavedReport>('user_reports', 'commodity_reports');
    const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
    const reportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!reportStore.loading) setSavedReports(reportStore.data);
    }, [reportStore.data, reportStore.loading]);

    /* ── Fetch all data ─────────────────────────────────────── */
    const generateReport = useCallback(async (tickers?: Set<string>) => {
        setLoading(true); setGenerated(false); setProgress(0);
        const targets = ALL_COMMODITIES.filter(c => !tickers || tickers.has(c.ticker));
        const results: CommodityData[] = [];

        for (let i = 0; i < targets.length; i++) {
            const c = targets[i];
            setProgress(Math.round(((i + 1) / targets.length) * 100));
            try {
                const res = await fetch(`/api/prices/yahoo?symbols=${encodeURIComponent(c.ticker)}&range=1mo&interval=1d`);
                const json = await res.json();
                const r = json.chart?.result?.[0];
                if (r) {
                    const closes = (r.indicators?.quote?.[0]?.close || []).filter((v: number | null) => v != null) as number[];
                    const highs = (r.indicators?.quote?.[0]?.high || []).filter((v: number | null) => v != null) as number[];
                    const lows = (r.indicators?.quote?.[0]?.low || []).filter((v: number | null) => v != null) as number[];
                    if (closes.length >= 2) {
                        const price = closes[closes.length - 1];
                        const prevClose = closes[closes.length - 2];
                        const last5Highs = highs.slice(-5);
                        const last5Lows = lows.slice(-5);
                        results.push({
                            name: c.name, icon: c.icon, ticker: c.ticker, sector: c.sector,
                            price, prevClose, change: price - prevClose,
                            changePct: ((price - prevClose) / prevClose) * 100,
                            high5d: last5Highs.length > 0 ? Math.max(...last5Highs) : price,
                            low5d: last5Lows.length > 0 ? Math.min(...last5Lows) : price,
                            closes: closes.slice(-20),
                            rsi: calcRSI(closes),
                            trend: detectTrend(closes),
                        });
                    }
                }
            } catch { /* skip */ }
        }

        setData(results); setGenerated(true); setLoading(false);

        // Save to history
        const report: SavedReport = {
            id: uid(), type: tab, title: tab === 'premarket' ? 'Pre-Market Brief' : tab === 'weekly' ? 'Weekly Compass' : 'Custom Report',
            generatedAt: new Date().toISOString(), commodityCount: results.length,
        };
        const updated = [report, ...savedReports].slice(0, 20);
        setSavedReports(updated); reportStore.saveAll(updated);
    }, [tab, savedReports]);

    /* ── Derived data ───────────────────────────────────────── */
    const sortedByChange = [...data].sort((a, b) => b.changePct - a.changePct);
    const topMovers = sortedByChange.slice(0, 3);
    const bottomMovers = sortedByChange.slice(-3).reverse();
    const sectorData = SECTORS.map(sector => {
        const items = data.filter(d => d.sector === sector);
        const avgChange = items.length > 0 ? items.reduce((s, i) => s + i.changePct, 0) / items.length : 0;
        return { sector, items, avgChange };
    });

    function toggleTicker(ticker: string) {
        setSelectedTickers(prev => {
            const next = new Set(prev);
            if (next.has(ticker)) next.delete(ticker); else next.add(ticker);
            return next;
        });
    }

    /* ── Styles ──────────────────────────────────────────────── */
    const s = {
        tabs: { display: 'flex', gap: 'var(--space-1)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', padding: '4px', marginBottom: 'var(--space-4)', width: 'fit-content' } as React.CSSProperties,
        tab: (active: boolean) => ({ padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 'var(--text-sm)', background: active ? 'var(--bg-primary)' : 'transparent', color: active ? 'var(--text-primary)' : 'var(--text-tertiary)', boxShadow: active ? '0 1px 3px rgba(0,0,0,0.15)' : 'none', transition: 'all 0.2s' }) as React.CSSProperties,
        card: { background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)', padding: 'var(--space-4)', marginBottom: 'var(--space-3)' } as React.CSSProperties,
        btn: (variant: 'primary' | 'secondary' = 'primary') => ({
            padding: '8px 16px', borderRadius: 'var(--radius-md)', border: variant === 'primary' ? 'none' : '1px solid var(--border-primary)',
            cursor: 'pointer', fontWeight: 600, fontSize: 'var(--text-sm)', transition: 'all 0.15s',
            background: variant === 'primary' ? '#3b82f6' : 'var(--bg-tertiary)',
            color: variant === 'primary' ? '#fff' : 'var(--text-secondary)',
        }) as React.CSSProperties,
        badge: (color: string) => ({ padding: '2px 8px', borderRadius: '999px', fontSize: 'var(--text-xs)', fontWeight: 600, background: `${color}22`, color, display: 'inline-block' }) as React.CSSProperties,
        h2: { margin: '0 0 var(--space-3)', fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' } as React.CSSProperties,
        h3: { margin: '0 0 var(--space-2)', fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' } as React.CSSProperties,
        label: { fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600 } as React.CSSProperties,
        gridRow: { display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border-primary)' } as React.CSSProperties,
    };

    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    /* ── RENDER ──────────────────────────────────────────────── */
    return (
        <AppShell title="Reports" subtitle="Automated Market Reports">
            {/* Tab switcher */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                <div style={s.tabs}>
                    <button style={s.tab(tab === 'premarket')} onClick={() => { setTab('premarket'); setGenerated(false); }}>☀️ Pre-Market</button>
                    <button style={s.tab(tab === 'weekly')} onClick={() => { setTab('weekly'); setGenerated(false); }}>📅 Weekly</button>
                    <button style={s.tab(tab === 'custom')} onClick={() => { setTab('custom'); setGenerated(false); }}>🔧 Custom</button>
                    <button style={s.tab(tab === 'history')} onClick={() => setTab('history')}>📚 History</button>
                </div>
                {tab !== 'history' && (
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        {generated && <button onClick={() => window.print()} style={s.btn('secondary')}>🖨️ Print / PDF</button>}
                        <button
                            onClick={() => generateReport(tab === 'custom' ? selectedTickers : undefined)}
                            style={s.btn('primary')}
                            disabled={loading}
                        >
                            {loading ? `⏳ Generating... ${progress}%` : `📊 Generate ${tab === 'premarket' ? 'Brief' : tab === 'weekly' ? 'Compass' : 'Report'}`}
                        </button>
                    </div>
                )}
            </div>

            {/* Custom: commodity selector */}
            {tab === 'custom' && !generated && (
                <div style={s.card}>
                    <h3 style={s.h3}>Select Commodities</h3>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
                        <button onClick={() => setSelectedTickers(new Set(ALL_COMMODITIES.map(c => c.ticker)))} style={{ ...s.btn('secondary'), fontSize: 'var(--text-xs)', padding: '4px 10px' }}>Select All</button>
                        <button onClick={() => setSelectedTickers(new Set())} style={{ ...s.btn('secondary'), fontSize: 'var(--text-xs)', padding: '4px 10px' }}>Clear All</button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                        {ALL_COMMODITIES.map(c => (
                            <button key={c.ticker} onClick={() => toggleTicker(c.ticker)} style={{
                                padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)',
                                border: selectedTickers.has(c.ticker) ? '2px solid #3b82f6' : '1px solid var(--border-primary)',
                                background: selectedTickers.has(c.ticker) ? 'rgba(59,130,246,0.1)' : 'var(--bg-tertiary)',
                                cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 600,
                                color: selectedTickers.has(c.ticker) ? '#3b82f6' : 'var(--text-secondary)', transition: 'all 0.15s',
                            }}>
                                {c.icon} {c.name}
                            </button>
                        ))}
                    </div>
                    <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{selectedTickers.size} commodities selected</div>
                </div>
            )}

            {/* History tab */}
            {tab === 'history' && (
                <div style={s.card}>
                    <h3 style={s.h3}>Report History</h3>
                    {savedReports.length === 0 ? (
                        <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-tertiary)' }}>No reports generated yet.</div>
                    ) : (
                        savedReports.map(r => (
                            <div key={r.id} style={{ ...s.gridRow, justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                    <span style={{ fontSize: '1.2rem' }}>{r.type === 'premarket' ? '☀️' : r.type === 'weekly' ? '📅' : '🔧'}</span>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{r.title}</div>
                                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{new Date(r.generatedAt).toLocaleString()}</div>
                                    </div>
                                </div>
                                <span style={s.badge('#3b82f6')}>{r.commodityCount} commodities</span>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Loading progress */}
            {loading && (
                <div style={{ marginBottom: 'var(--space-4)' }}>
                    <div style={{ height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', transition: 'width 0.3s', borderRadius: '2px' }} />
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: '4px', textAlign: 'center' }}>
                        Fetching market data... {progress}%
                    </div>
                </div>
            )}

            {/* ═══════════ GENERATED REPORT CONTENT ═══════════ */}
            {generated && data.length > 0 && (
                <div ref={reportRef} className="print-report">
                    {/* Report header */}
                    <div style={{ ...s.card, background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(139,92,246,0.1))', borderColor: '#3b82f640' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                            <div>
                                <h2 style={{ ...s.h2, margin: 0, fontSize: 'var(--text-xl)' }}>
                                    {tab === 'premarket' ? '☀️ Pre-Market Brief' : tab === 'weekly' ? '📅 Weekly Commodity Compass' : '🔧 Custom Report'}
                                </h2>
                                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginTop: '4px' }}>{dateStr}</div>
                            </div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                                {data.length} commodities · Generated {new Date().toLocaleTimeString()}
                            </div>
                        </div>
                    </div>

                    {/* Top / Bottom Movers */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                        <div style={s.card}>
                            <h3 style={s.h3}>🚀 Top Movers</h3>
                            {topMovers.map(c => (
                                <div key={c.ticker} style={{ ...s.gridRow }}>
                                    <span style={{ fontSize: '1.1rem' }}>{c.icon}</span>
                                    <span style={{ flex: 1, fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{c.name}</span>
                                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#22c55e', fontSize: 'var(--text-sm)' }}>+{c.changePct.toFixed(2)}%</span>
                                </div>
                            ))}
                        </div>
                        <div style={s.card}>
                            <h3 style={s.h3}>📉 Bottom Movers</h3>
                            {bottomMovers.map(c => (
                                <div key={c.ticker} style={{ ...s.gridRow }}>
                                    <span style={{ fontSize: '1.1rem' }}>{c.icon}</span>
                                    <span style={{ flex: 1, fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{c.name}</span>
                                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#ef4444', fontSize: 'var(--text-sm)' }}>{c.changePct.toFixed(2)}%</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Sector Summary */}
                    <div style={s.card}>
                        <h3 style={s.h3}>📊 Sector Performance</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
                            {sectorData.map(sd => (
                                <div key={sd.sector} style={{ padding: 'var(--space-3)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>{sd.sector}</div>
                                    <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: sd.avgChange >= 0 ? '#22c55e' : '#ef4444', fontFamily: 'monospace' }}>
                                        {sd.avgChange >= 0 ? '+' : ''}{sd.avgChange.toFixed(2)}%
                                    </div>
                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: '2px' }}>{sd.items.length} commodities</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Full Commodity Table */}
                    <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-primary)' }}>
                            <h3 style={{ ...s.h3, margin: 0 }}>📋 Full Market Overview</h3>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-tertiary)' }}>
                                        {['Commodity', 'Price', 'Change', '% Chg', '5D High', '5D Low', 'RSI (14)', 'Trend', 'Signal'].map(h => (
                                            <th key={h} style={{ padding: 'var(--space-2) var(--space-3)', textAlign: h === 'Commodity' ? 'left' : 'right', fontWeight: 700, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedByChange.map(c => {
                                        const rsi = c.rsi || 50;
                                        const signal = rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : rsi > 55 ? 'Bullish' : rsi < 45 ? 'Bearish' : 'Neutral';
                                        const signalColor = rsi > 70 ? '#ef4444' : rsi < 30 ? '#22c55e' : rsi > 55 ? '#22c55e' : rsi < 45 ? '#ef4444' : '#6b7280';
                                        const changeColor = c.changePct >= 0 ? '#22c55e' : '#ef4444';
                                        return (
                                            <tr key={c.ticker} style={{ borderBottom: '1px solid var(--border-primary)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                                <td style={{ padding: 'var(--space-2) var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                    <span>{c.icon}</span>
                                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</span>
                                                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{c.sector}</span>
                                                </td>
                                                <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>{c.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: changeColor }}>{c.change >= 0 ? '+' : ''}{c.change.toFixed(2)}</td>
                                                <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: changeColor }}>{c.changePct >= 0 ? '+' : ''}{c.changePct.toFixed(2)}%</td>
                                                <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{c.high5d.toFixed(2)}</td>
                                                <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{c.low5d.toFixed(2)}</td>
                                                <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                                                        <div style={{ width: '40px', height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
                                                            <div style={{ height: '100%', width: `${rsi}%`, background: signalColor, borderRadius: '2px' }} />
                                                        </div>
                                                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: signalColor, minWidth: '28px' }}>{rsi.toFixed(0)}</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{c.trend}</td>
                                                <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right' }}>
                                                    <span style={{ ...s.badge(signalColor), fontSize: '10px' }}>{signal}</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Key Levels */}
                    <div style={s.card}>
                        <h3 style={s.h3}>🎯 Key Technical Levels</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
                            {data.slice(0, 8).map(c => {
                                const rsi = c.rsi || 50;
                                const signalColor = rsi > 70 ? '#ef4444' : rsi < 30 ? '#22c55e' : '#6b7280';
                                return (
                                    <div key={c.ticker} style={{ padding: 'var(--space-3)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                            <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{c.icon} {c.name}</span>
                                            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 'var(--text-sm)', color: c.changePct >= 0 ? '#22c55e' : '#ef4444' }}>
                                                {c.price.toFixed(2)}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                                            <span>S: {c.low5d.toFixed(2)}</span>
                                            <span style={{ color: signalColor, fontWeight: 600 }}>RSI: {rsi.toFixed(0)}</span>
                                            <span>R: {c.high5d.toFixed(2)}</span>
                                        </div>
                                        {/* Price range bar */}
                                        <div style={{ marginTop: '6px', position: 'relative', height: '6px', background: 'var(--border-primary)', borderRadius: '3px' }}>
                                            {c.high5d > c.low5d && (
                                                <div style={{
                                                    position: 'absolute', top: '-1px',
                                                    left: `${Math.max(0, Math.min(100, ((c.price - c.low5d) / (c.high5d - c.low5d)) * 100))}%`,
                                                    width: '8px', height: '8px', borderRadius: '50%',
                                                    background: c.changePct >= 0 ? '#22c55e' : '#ef4444',
                                                    transform: 'translateX(-50%)',
                                                }} />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Report footer */}
                    <div style={{ textAlign: 'center', padding: 'var(--space-4)', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>
                        Generated by Commodity HQ · {dateStr} · Data from Yahoo Finance
                    </div>
                </div>
            )}

            {/* Print styles */}
            <style>{`
                @media print {
                    .sidebar, .header-bar, .ticker-bar, .main-content > div:first-child { display: none !important; }
                    .main-content { padding: 0 !important; }
                    .print-report { padding: 20px; }
                    * { color-adjust: exact !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
            `}</style>
        </AppShell>
    );
}
