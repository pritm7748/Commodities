'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import AppShell from '@/components/layout/AppShell';
import { useSupabaseData } from '@/hooks/useSupabaseData';

/* ── Commodity Universe ─────────────────────────────────────── */
const ALL_COMMODITIES = [
    { name: 'Gold', ticker: 'GC=F', icon: '🥇', sector: 'Precious' },
    { name: 'Silver', ticker: 'SI=F', icon: '🥈', sector: 'Precious' },
    { name: 'Platinum', ticker: 'PL=F', icon: '✨', sector: 'Precious' },
    { name: 'Copper', ticker: 'HG=F', icon: '🔩', sector: 'Base' },
    { name: 'Aluminium', ticker: 'ALI=F', icon: '🪶', sector: 'Base' },
    { name: 'Crude Oil', ticker: 'CL=F', icon: '🛢️', sector: 'Energy' },
    { name: 'Brent', ticker: 'BZ=F', icon: '🛢️', sector: 'Energy' },
    { name: 'Natural Gas', ticker: 'NG=F', icon: '🔥', sector: 'Energy' },
    { name: 'Wheat', ticker: 'ZW=F', icon: '🌾', sector: 'Agri' },
    { name: 'Corn', ticker: 'ZC=F', icon: '🌽', sector: 'Agri' },
    { name: 'Soybeans', ticker: 'ZS=F', icon: '🫘', sector: 'Agri' },
    { name: 'Cotton', ticker: 'CT=F', icon: '🧶', sector: 'Softs' },
    { name: 'Sugar', ticker: 'SB=F', icon: '🍬', sector: 'Softs' },
    { name: 'Coffee', ticker: 'KC=F', icon: '☕', sector: 'Softs' },
];

/* ── Types ──────────────────────────────────────────────────── */
interface WatchlistItem { name: string; ticker: string; icon: string; sector: string; }
interface Watchlist { id: string; name: string; icon: string; items: WatchlistItem[]; createdAt: string; }
interface PriceData { price: number; prevClose: number; change: number; changePct: number; }
interface Trade {
    id: string; commodity: string; ticker: string; icon: string;
    direction: 'long' | 'short'; entryPrice: number; quantity: number;
    entryDate: string; exitPrice?: number; exitDate?: string; status: 'open' | 'closed';
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const DEFAULT_WATCHLIST: Watchlist = {
    id: uid(), name: 'My Watchlist', icon: '⭐',
    items: ALL_COMMODITIES.filter(c => ['Gold', 'Silver', 'Crude Oil', 'Copper', 'Natural Gas'].includes(c.name)),
    createdAt: new Date().toISOString(),
};

/* ── Price fetching ─────────────────────────────────────────── */
async function fetchPrice(ticker: string): Promise<PriceData | null> {
    try {
        const res = await fetch(`/api/prices/yahoo?symbols=${encodeURIComponent(ticker)}&range=5d&interval=1d`);
        const data = await res.json();
        const r = data.chart?.result?.[0];
        if (!r) return null;
        const closes = (r.indicators?.quote?.[0]?.close || []).filter((v: number | null) => v != null) as number[];
        if (closes.length < 2) return null;
        const price = closes[closes.length - 1];
        const prevClose = closes[closes.length - 2];
        return { price, prevClose, change: price - prevClose, changePct: ((price - prevClose) / prevClose) * 100 };
    } catch { return null; }
}

/* ── Inline Sparkline (Canvas) ──────────────────────────────── */
function Sparkline({ data, width = 80, height = 28, color = '#3b82f6' }: { data: number[]; width?: number; height?: number; color?: string }) {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const c = ref.current; if (!c || data.length < 2) return;
        const ctx = c.getContext('2d'); if (!ctx) return;
        const dpr = window.devicePixelRatio || 1;
        c.width = width * dpr; c.height = height * dpr;
        c.style.width = width + 'px'; c.style.height = height + 'px';
        ctx.scale(dpr, dpr);
        const min = Math.min(...data), max = Math.max(...data);
        const range = max - min || 1;
        ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 1.5;
        data.forEach((v, i) => {
            const x = (i / (data.length - 1)) * width;
            const y = height - ((v - min) / range) * (height - 4) - 2;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
    }, [data, width, height, color]);
    return <canvas ref={ref} style={{ display: 'block' }} />;
}

/* ══════════════════════════════════════════════════════════════ */
/*                    WATCHLIST PAGE                              */
/* ══════════════════════════════════════════════════════════════ */
export default function WatchlistPage() {
    const [tab, setTab] = useState<'watchlist' | 'portfolio'>('watchlist');

    // ── Supabase-backed data ──
    const wlStore = useSupabaseData<Watchlist>('user_watchlists', 'commodity_watchlists');
    const tradeStore = useSupabaseData<Trade>('user_trades', 'commodity_trades');

    // ── Watchlist state ──
    const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
    const [activeWLId, setActiveWLId] = useState<string>('');
    const [prices, setPrices] = useState<Record<string, PriceData>>({});
    const [sparkData, setSparkData] = useState<Record<string, number[]>>({});
    const [loadingPrices, setLoadingPrices] = useState(false);
    const [showAddComm, setShowAddComm] = useState(false);
    const [commSearch, setCommSearch] = useState('');
    const [showCreateWL, setShowCreateWL] = useState(false);
    const [newWLName, setNewWLName] = useState('');
    const [newWLIcon, setNewWLIcon] = useState('📋');
    const [renaming, setRenaming] = useState<string | null>(null);
    const [renameVal, setRenameVal] = useState('');

    // ── Portfolio state ──
    const [trades, setTrades] = useState<Trade[]>([]);
    const [showAddTrade, setShowAddTrade] = useState(false);
    const [tradeForm, setTradeForm] = useState({ commodity: '', ticker: '', icon: '', direction: 'long' as 'long' | 'short', entryPrice: '', quantity: '1', entryDate: new Date().toISOString().split('T')[0] });
    const [closingId, setClosingId] = useState<string | null>(null);
    const [closePrice, setClosePrice] = useState('');
    const [portfolioFilter, setPortfolioFilter] = useState<'all' | 'open' | 'closed'>('all');

    // ── Init from store ──
    useEffect(() => {
        if (wlStore.loading) return;
        const wl = wlStore.data.length > 0 ? wlStore.data : [DEFAULT_WATCHLIST];
        setWatchlists(wl);
        if (!activeWLId || !wl.find(w => w.id === activeWLId)) setActiveWLId(wl[0]?.id || '');
    }, [wlStore.data, wlStore.loading, activeWLId]);

    useEffect(() => {
        if (!tradeStore.loading) setTrades(tradeStore.data);
    }, [tradeStore.data, tradeStore.loading]);

    const activeWL = watchlists.find(w => w.id === activeWLId);

    // ── Fetch prices for active watchlist ──
    const fetchAllPrices = useCallback(async () => {
        if (!activeWL) return;
        setLoadingPrices(true);
        const tickers = activeWL.items.map(i => i.ticker);
        const results: Record<string, PriceData> = {};
        const sparks: Record<string, number[]> = {};
        await Promise.all(tickers.map(async (tk) => {
            try {
                const res = await fetch(`/api/prices/yahoo?symbols=${encodeURIComponent(tk)}&range=1mo&interval=1d`);
                const data = await res.json();
                const r = data.chart?.result?.[0];
                if (r) {
                    const closes = (r.indicators?.quote?.[0]?.close || []).filter((v: number | null) => v != null) as number[];
                    if (closes.length >= 2) {
                        const price = closes[closes.length - 1];
                        const prevClose = closes[closes.length - 2];
                        results[tk] = { price, prevClose, change: price - prevClose, changePct: ((price - prevClose) / prevClose) * 100 };
                        sparks[tk] = closes.slice(-20);
                    }
                }
            } catch { /* skip */ }
        }));
        setPrices(results); setSparkData(sparks); setLoadingPrices(false);
    }, [activeWL]);

    useEffect(() => { fetchAllPrices(); }, [fetchAllPrices]);

    // ── Also fetch prices for open portfolio trades ──
    useEffect(() => {
        const openTrades = trades.filter(t => t.status === 'open');
        if (openTrades.length === 0) return;
        openTrades.forEach(async (tr) => {
            if (prices[tr.ticker]) return;
            const pd = await fetchPrice(tr.ticker);
            if (pd) setPrices(prev => ({ ...prev, [tr.ticker]: pd }));
        });
    }, [trades, prices]);

    /* ── Watchlist CRUD ──────────────────────────────────────── */
    function persistWatchlists(updated: Watchlist[]) {
        setWatchlists(updated);
        wlStore.saveAll(updated);
    }

    function createWatchlist() {
        if (!newWLName.trim()) return;
        const wl: Watchlist = { id: uid(), name: newWLName.trim(), icon: newWLIcon, items: [], createdAt: new Date().toISOString() };
        persistWatchlists([...watchlists, wl]);
        setActiveWLId(wl.id); setShowCreateWL(false); setNewWLName(''); setNewWLIcon('📋');
    }

    function deleteWatchlist(id: string) {
        if (watchlists.length <= 1) return;
        const updated = watchlists.filter(w => w.id !== id);
        persistWatchlists(updated);
        if (activeWLId === id) setActiveWLId(updated[0]?.id || '');
    }

    function renameWatchlist(id: string) {
        if (!renameVal.trim()) return;
        persistWatchlists(watchlists.map(w => w.id === id ? { ...w, name: renameVal.trim() } : w));
        setRenaming(null);
    }

    function addCommodity(item: WatchlistItem) {
        if (!activeWL || activeWL.items.some(i => i.ticker === item.ticker)) return;
        persistWatchlists(watchlists.map(w => w.id === activeWLId ? { ...w, items: [...w.items, item] } : w));
    }

    function removeCommodity(ticker: string) {
        persistWatchlists(watchlists.map(w => w.id === activeWLId ? { ...w, items: w.items.filter(i => i.ticker !== ticker) } : w));
    }

    /* ── Portfolio CRUD ──────────────────────────────────────── */
    function persistTrades(updated: Trade[]) {
        setTrades(updated);
        tradeStore.saveAll(updated);
    }

    function addTrade() {
        if (!tradeForm.commodity || !tradeForm.entryPrice) return;
        const t: Trade = {
            id: uid(), commodity: tradeForm.commodity, ticker: tradeForm.ticker, icon: tradeForm.icon,
            direction: tradeForm.direction, entryPrice: parseFloat(tradeForm.entryPrice),
            quantity: parseFloat(tradeForm.quantity) || 1, entryDate: tradeForm.entryDate, status: 'open',
        };
        persistTrades([...trades, t]); setShowAddTrade(false);
        setTradeForm({ commodity: '', ticker: '', icon: '', direction: 'long', entryPrice: '', quantity: '1', entryDate: new Date().toISOString().split('T')[0] });
    }

    function closeTrade(id: string) {
        if (!closePrice) return;
        persistTrades(trades.map(t => t.id === id ? { ...t, exitPrice: parseFloat(closePrice), exitDate: new Date().toISOString().split('T')[0], status: 'closed' as const } : t));
        setClosingId(null); setClosePrice('');
    }

    function deleteTrade(id: string) {
        persistTrades(trades.filter(t => t.id !== id));
    }

    /* ── Portfolio Metrics ───────────────────────────────────── */
    const openTrades = trades.filter(t => t.status === 'open');
    const closedTrades = trades.filter(t => t.status === 'closed');
    const filteredTrades = portfolioFilter === 'all' ? trades : portfolioFilter === 'open' ? openTrades : closedTrades;

    function tradesPnL(trade: Trade): number {
        const currentPrice = trade.status === 'closed' ? (trade.exitPrice || trade.entryPrice) : (prices[trade.ticker]?.price || trade.entryPrice);
        const diff = trade.direction === 'long' ? currentPrice - trade.entryPrice : trade.entryPrice - currentPrice;
        return diff * trade.quantity;
    }

    const totalOpenPnL = openTrades.reduce((sum, t) => sum + tradesPnL(t), 0);
    const totalClosedPnL = closedTrades.reduce((sum, t) => sum + tradesPnL(t), 0);
    const winRate = closedTrades.length > 0 ? Math.round((closedTrades.filter(t => tradesPnL(t) > 0).length / closedTrades.length) * 100) : 0;

    const filteredComms = ALL_COMMODITIES.filter(c =>
        c.name.toLowerCase().includes(commSearch.toLowerCase()) ||
        c.ticker.toLowerCase().includes(commSearch.toLowerCase()) ||
        c.sector.toLowerCase().includes(commSearch.toLowerCase())
    );

    /* ── Styles ──────────────────────────────────────────────── */
    const s = {
        tabs: { display: 'flex', gap: 'var(--space-1)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', padding: '4px', marginBottom: 'var(--space-5)', width: 'fit-content' } as React.CSSProperties,
        tab: (active: boolean) => ({ padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 'var(--text-sm)', background: active ? 'var(--bg-primary)' : 'transparent', color: active ? 'var(--text-primary)' : 'var(--text-tertiary)', boxShadow: active ? '0 1px 3px rgba(0,0,0,0.15)' : 'none', transition: 'all 0.2s' }) as React.CSSProperties,
        card: { background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)', overflow: 'hidden' } as React.CSSProperties,
        cardHeader: { padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } as React.CSSProperties,
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

    /* ── RENDER ──────────────────────────────────────────────── */
    return (
        <AppShell title="Watchlist & Portfolio" subtitle="Track commodities and virtual trades">
            {/* Tab switcher */}
            <div style={s.tabs}>
                <button style={s.tab(tab === 'watchlist')} onClick={() => setTab('watchlist')}>⭐ Watchlists</button>
                <button style={s.tab(tab === 'portfolio')} onClick={() => setTab('portfolio')}>💼 Portfolio</button>
            </div>

            {/* ═══════════ WATCHLIST TAB ═══════════ */}
            {tab === 'watchlist' && (
                <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                    {/* Left: Watchlist picker */}
                    <div style={{ flex: '0 0 220px', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Your Watchlists</div>
                        {watchlists.map(wl => (
                            <div key={wl.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: wl.id === activeWLId ? 'var(--bg-tertiary)' : 'transparent', border: wl.id === activeWLId ? '1px solid var(--border-primary)' : '1px solid transparent', transition: 'all 0.15s' }} onClick={() => setActiveWLId(wl.id)}>
                                <span>{wl.icon}</span>
                                {renaming === wl.id ? (
                                    <input value={renameVal} onChange={e => setRenameVal(e.target.value)} onBlur={() => renameWatchlist(wl.id)} onKeyDown={e => e.key === 'Enter' && renameWatchlist(wl.id)} autoFocus style={{ ...s.input, padding: '2px 6px', width: '120px' }} />
                                ) : (
                                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{wl.name}</span>
                                )}
                                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{wl.items.length}</span>
                                {wl.id === activeWLId && (
                                    <div style={{ display: 'flex', gap: '2px' }}>
                                        <button onClick={e => { e.stopPropagation(); setRenaming(wl.id); setRenameVal(wl.name); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '2px' }} title="Rename">✏️</button>
                                        {watchlists.length > 1 && (<button onClick={e => { e.stopPropagation(); if (confirm('Delete this watchlist?')) deleteWatchlist(wl.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '2px' }} title="Delete">🗑️</button>)}
                                    </div>
                                )}
                            </div>
                        ))}
                        <button onClick={() => setShowCreateWL(true)} style={{ ...s.btn('secondary'), marginTop: 'var(--space-2)', width: '100%', textAlign: 'center' }}>+ New Watchlist</button>
                    </div>

                    {/* Right: Active watchlist content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {activeWL?.icon} {activeWL?.name || 'Select a watchlist'}
                            </h3>
                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                <button onClick={fetchAllPrices} style={s.btn('secondary')} disabled={loadingPrices}>
                                    {loadingPrices ? '⏳ Refreshing...' : '🔄 Refresh'}
                                </button>
                                <button onClick={() => { setShowAddComm(true); setCommSearch(''); }} style={s.btn('primary')}>+ Add Commodity</button>
                            </div>
                        </div>

                        {/* Commodity cards */}
                        <div style={s.card}>
                            {/* Table header */}
                            <div style={{ ...s.row, fontWeight: 700, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--bg-tertiary)' }}>
                                <span style={{ flex: '0 0 180px' }}>Commodity</span>
                                <span style={{ flex: '0 0 100px', textAlign: 'right' }}>Price</span>
                                <span style={{ flex: '0 0 100px', textAlign: 'right' }}>Change</span>
                                <span style={{ flex: '0 0 80px', textAlign: 'right' }}>% Change</span>
                                <span style={{ flex: '0 0 100px', textAlign: 'center' }}>20D Trend</span>
                                <span style={{ flex: '0 0 60px', textAlign: 'center' }}>Remove</span>
                            </div>
                            {activeWL?.items.length === 0 && (
                                <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                                    No commodities yet. Click <strong>+ Add Commodity</strong> to get started.
                                </div>
                            )}
                            {activeWL?.items.map(item => {
                                const p = prices[item.ticker];
                                const spark = sparkData[item.ticker] || [];
                                const color = p ? (p.changePct >= 0 ? '#22c55e' : '#ef4444') : 'var(--text-tertiary)';
                                return (
                                    <div key={item.ticker} style={{ ...s.row, cursor: 'default' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                        <span style={{ flex: '0 0 180px', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                            <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                                            <span>
                                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>{item.name}</div>
                                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{item.ticker}</div>
                                            </span>
                                        </span>
                                        <span style={{ flex: '0 0 100px', textAlign: 'right', fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                                            {p ? p.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                                        </span>
                                        <span style={{ flex: '0 0 100px', textAlign: 'right', fontWeight: 600, fontSize: 'var(--text-sm)', color, fontFamily: 'monospace' }}>
                                            {p ? `${p.change >= 0 ? '+' : ''}${p.change.toFixed(2)}` : '—'}
                                        </span>
                                        <span style={{ flex: '0 0 80px', textAlign: 'right', fontWeight: 600, fontSize: 'var(--text-sm)', color, fontFamily: 'monospace' }}>
                                            {p ? `${p.changePct >= 0 ? '+' : ''}${p.changePct.toFixed(2)}%` : '—'}
                                        </span>
                                        <span style={{ flex: '0 0 100px', display: 'flex', justifyContent: 'center' }}>
                                            {spark.length > 1 ? <Sparkline data={spark} color={color} /> : <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>—</span>}
                                        </span>
                                        <span style={{ flex: '0 0 60px', textAlign: 'center' }}>
                                            <button onClick={() => removeCommodity(item.ticker)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', opacity: 0.5, transition: 'opacity 0.15s' }} onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')} title="Remove">✕</button>
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════ PORTFOLIO TAB ═══════════ */}
            {tab === 'portfolio' && (
                <div>
                    {/* Summary cards */}
                    <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
                        <div style={s.statCard}>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>Open Positions</span>
                            <span style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>{openTrades.length}</span>
                        </div>
                        <div style={s.statCard}>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>Unrealized P&L</span>
                            <span style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: totalOpenPnL >= 0 ? '#22c55e' : '#ef4444' }}>
                                {totalOpenPnL >= 0 ? '+' : ''}{totalOpenPnL.toFixed(2)}
                            </span>
                        </div>
                        <div style={s.statCard}>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>Realized P&L</span>
                            <span style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: totalClosedPnL >= 0 ? '#22c55e' : '#ef4444' }}>
                                {totalClosedPnL >= 0 ? '+' : ''}{totalClosedPnL.toFixed(2)}
                            </span>
                        </div>
                        <div style={s.statCard}>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>Win Rate</span>
                            <span style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>{winRate}%</span>
                        </div>
                        <div style={s.statCard}>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>Total Trades</span>
                            <span style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>{trades.length}</span>
                        </div>
                    </div>

                    {/* Controls */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                        <div style={{ display: 'flex', gap: 'var(--space-1)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '3px' }}>
                            {(['all', 'open', 'closed'] as const).map(f => (
                                <button key={f} style={{ ...s.tab(portfolioFilter === f), fontSize: 'var(--text-xs)', padding: '4px 12px' }} onClick={() => setPortfolioFilter(f)}>
                                    {f === 'all' ? 'All' : f === 'open' ? `Open (${openTrades.length})` : `Closed (${closedTrades.length})`}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setShowAddTrade(true)} style={s.btn('primary')}>+ New Trade</button>
                    </div>

                    {/* Trades table */}
                    <div style={s.card}>
                        <div style={{ ...s.row, fontWeight: 700, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--bg-tertiary)' }}>
                            <span style={{ flex: '0 0 160px' }}>Commodity</span>
                            <span style={{ flex: '0 0 60px', textAlign: 'center' }}>Side</span>
                            <span style={{ flex: '0 0 60px', textAlign: 'right' }}>Qty</span>
                            <span style={{ flex: '0 0 90px', textAlign: 'right' }}>Entry</span>
                            <span style={{ flex: '0 0 90px', textAlign: 'right' }}>Current</span>
                            <span style={{ flex: '0 0 100px', textAlign: 'right' }}>P&L</span>
                            <span style={{ flex: '0 0 80px', textAlign: 'center' }}>Status</span>
                            <span style={{ flex: '0 0 100px', textAlign: 'center' }}>Actions</span>
                        </div>
                        {filteredTrades.length === 0 && (
                            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                                {trades.length === 0 ? 'No trades yet. Click + New Trade to log your first position.' : 'No trades match this filter.'}
                            </div>
                        )}
                        {filteredTrades.map(trade => {
                            const currentPrice = trade.status === 'closed' ? (trade.exitPrice || trade.entryPrice) : (prices[trade.ticker]?.price || 0);
                            const pnl = tradesPnL(trade);
                            const pnlPct = trade.entryPrice > 0 ? (pnl / (trade.entryPrice * trade.quantity)) * 100 : 0;
                            return (
                                <div key={trade.id} style={s.row}>
                                    <span style={{ flex: '0 0 160px', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                        <span style={{ fontSize: '1.1rem' }}>{trade.icon}</span>
                                        <span>
                                            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{trade.commodity}</div>
                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{trade.entryDate}</div>
                                        </span>
                                    </span>
                                    <span style={{ flex: '0 0 60px', textAlign: 'center' }}>
                                        <span style={s.badge(trade.direction === 'long' ? '#22c55e' : '#ef4444')}>
                                            {trade.direction === 'long' ? '▲ Long' : '▼ Short'}
                                        </span>
                                    </span>
                                    <span style={{ flex: '0 0 60px', textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{trade.quantity}</span>
                                    <span style={{ flex: '0 0 90px', textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{trade.entryPrice.toFixed(2)}</span>
                                    <span style={{ flex: '0 0 90px', textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                                        {trade.status === 'closed' ? (trade.exitPrice?.toFixed(2) || '—') : (currentPrice > 0 ? currentPrice.toFixed(2) : '⏳')}
                                    </span>
                                    <span style={{ flex: '0 0 100px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 'var(--text-sm)', color: pnl >= 0 ? '#22c55e' : '#ef4444' }}>
                                        {currentPrice > 0 ? `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%)` : '—'}
                                    </span>
                                    <span style={{ flex: '0 0 80px', textAlign: 'center' }}>
                                        <span style={s.badge(trade.status === 'open' ? '#3b82f6' : '#6b7280')}>
                                            {trade.status === 'open' ? '● Open' : '✓ Closed'}
                                        </span>
                                    </span>
                                    <span style={{ flex: '0 0 100px', textAlign: 'center', display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                        {trade.status === 'open' && (
                                            <button onClick={() => { setClosingId(trade.id); setClosePrice(prices[trade.ticker]?.price?.toFixed(2) || ''); }} style={s.btn('secondary')}>Close</button>
                                        )}
                                        <button onClick={() => { if (confirm('Delete this trade?')) deleteTrade(trade.id); }} style={{ ...s.btn('secondary'), color: '#ef4444' }}>🗑️</button>
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ═══════════ MODALS ═══════════ */}

            {/* Add Commodity Modal */}
            {showAddComm && (
                <div style={s.overlay} onClick={() => setShowAddComm(false)}>
                    <div style={s.modal} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: '0 0 var(--space-3)', color: 'var(--text-primary)' }}>Add Commodity</h3>
                        <input placeholder="Search by name, ticker, or sector..." value={commSearch} onChange={e => setCommSearch(e.target.value)} style={{ ...s.input, marginBottom: 'var(--space-3)' }} autoFocus />
                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                            {filteredComms.map(c => {
                                const alreadyAdded = activeWL?.items.some(i => i.ticker === c.ticker);
                                return (
                                    <div key={c.ticker} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', cursor: alreadyAdded ? 'default' : 'pointer', opacity: alreadyAdded ? 0.4 : 1 }} onClick={() => !alreadyAdded && addCommodity(c)} onMouseEnter={e => { if (!alreadyAdded) e.currentTarget.style.background = 'var(--bg-tertiary)'; }} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                        <span style={{ fontSize: '1.2rem' }}>{c.icon}</span>
                                        <span style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{c.name}</div>
                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{c.ticker} · {c.sector}</div>
                                        </span>
                                        {alreadyAdded && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Added</span>}
                                    </div>
                                );
                            })}
                        </div>
                        <button onClick={() => setShowAddComm(false)} style={{ ...s.btn('secondary'), marginTop: 'var(--space-3)', width: '100%' }}>Done</button>
                    </div>
                </div>
            )}

            {/* Create Watchlist Modal */}
            {showCreateWL && (
                <div style={s.overlay} onClick={() => setShowCreateWL(false)}>
                    <div style={s.modal} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: '0 0 var(--space-3)', color: 'var(--text-primary)' }}>New Watchlist</h3>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                            <select value={newWLIcon} onChange={e => setNewWLIcon(e.target.value)} style={{ ...s.input, width: '60px', textAlign: 'center' }}>
                                {['⭐', '📋', '🎯', '🔥', '💎', '🏆', '📈', '🚀'].map(ic => <option key={ic} value={ic}>{ic}</option>)}
                            </select>
                            <input placeholder="Watchlist name" value={newWLName} onChange={e => setNewWLName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createWatchlist()} style={s.input} autoFocus />
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            <button onClick={() => setShowCreateWL(false)} style={{ ...s.btn('secondary'), flex: 1 }}>Cancel</button>
                            <button onClick={createWatchlist} style={{ ...s.btn('primary'), flex: 1 }}>Create</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Trade Modal */}
            {showAddTrade && (
                <div style={s.overlay} onClick={() => setShowAddTrade(false)}>
                    <div style={s.modal} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: '0 0 var(--space-3)', color: 'var(--text-primary)' }}>New Trade</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>Commodity</label>
                                <select value={tradeForm.ticker} onChange={e => { const c = ALL_COMMODITIES.find(co => co.ticker === e.target.value); if (c) setTradeForm(f => ({ ...f, commodity: c.name, ticker: c.ticker, icon: c.icon })); }} style={s.input}>
                                    <option value="">Select commodity...</option>
                                    {ALL_COMMODITIES.map(c => <option key={c.ticker} value={c.ticker}>{c.icon} {c.name} ({c.ticker})</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>Direction</label>
                                    <div style={{ display: 'flex', gap: 'var(--space-1)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '3px' }}>
                                        <button style={{ ...s.tab(tradeForm.direction === 'long'), flex: 1, color: tradeForm.direction === 'long' ? '#22c55e' : 'var(--text-tertiary)' }} onClick={() => setTradeForm(f => ({ ...f, direction: 'long' }))}>▲ Long</button>
                                        <button style={{ ...s.tab(tradeForm.direction === 'short'), flex: 1, color: tradeForm.direction === 'short' ? '#ef4444' : 'var(--text-tertiary)' }} onClick={() => setTradeForm(f => ({ ...f, direction: 'short' }))}>▼ Short</button>
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>Entry Price</label>
                                    <input type="number" step="0.01" placeholder="0.00" value={tradeForm.entryPrice} onChange={e => setTradeForm(f => ({ ...f, entryPrice: e.target.value }))} style={s.input} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>Quantity</label>
                                    <input type="number" step="1" value={tradeForm.quantity} onChange={e => setTradeForm(f => ({ ...f, quantity: e.target.value }))} style={s.input} />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>Entry Date</label>
                                <input type="date" value={tradeForm.entryDate} onChange={e => setTradeForm(f => ({ ...f, entryDate: e.target.value }))} style={s.input} />
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                <button onClick={() => setShowAddTrade(false)} style={{ ...s.btn('secondary'), flex: 1 }}>Cancel</button>
                                <button onClick={addTrade} style={{ ...s.btn('primary'), flex: 1 }} disabled={!tradeForm.commodity || !tradeForm.entryPrice}>Add Trade</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Close Trade Modal */}
            {closingId && (
                <div style={s.overlay} onClick={() => setClosingId(null)}>
                    <div style={s.modal} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: '0 0 var(--space-3)', color: 'var(--text-primary)' }}>Close Trade</h3>
                        <div>
                            <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px' }}>Exit Price</label>
                            <input type="number" step="0.01" value={closePrice} onChange={e => setClosePrice(e.target.value)} style={s.input} autoFocus />
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                            <button onClick={() => setClosingId(null)} style={{ ...s.btn('secondary'), flex: 1 }}>Cancel</button>
                            <button onClick={() => closeTrade(closingId)} style={{ ...s.btn('primary'), flex: 1 }} disabled={!closePrice}>Confirm Close</button>
                        </div>
                    </div>
                </div>
            )}
        </AppShell>
    );
}
