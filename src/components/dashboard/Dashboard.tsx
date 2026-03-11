'use client';

import { useEffect, useState, useMemo } from 'react';
import AppShell from '@/components/layout/AppShell';
import { ALL_COMMODITIES, SECTOR_META, CommoditySpec } from '@/lib/data/commodities';
import { PriceData, fetchAllPrices } from '@/lib/services/priceService';
import { formatPrice, formatChange, formatLargeNumber } from '@/lib/utils/conversions';
import PremiumCalculator from '@/components/dashboard/PremiumCalculator';
import Sparkline from '@/components/charts/Sparkline';
import TradingHoursIndicator from '@/components/dashboard/TradingHoursIndicator';
import '@/app/dashboard.css';

type ViewMode = 'cards' | 'table' | 'heatmap';
type FilterMode = 'all' | 'global' | 'mcx';

const SECTOR_TABS: { id: string; label: string; icon: string }[] = [
    { id: 'all', label: 'All', icon: '🌐' },
    { id: 'precious', label: 'Precious', icon: '🥇' },
    { id: 'base', label: 'Base Metals', icon: '🔩' },
    { id: 'energy', label: 'Energy', icon: '🛢️' },
    { id: 'agri', label: 'Agriculture', icon: '🌾' },
    { id: 'softs', label: 'Softs', icon: '☕' },
    { id: 'indices', label: 'Indices', icon: '📊' },
];

export default function Dashboard() {
    const [prices, setPrices] = useState<Map<string, PriceData>>(new Map());
    const [loading, setLoading] = useState(true);
    const [activeSector, setActiveSector] = useState('all');
    const [viewMode, setViewMode] = useState<ViewMode>('cards');
    const [filterMode, setFilterMode] = useState<FilterMode>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshInterval, setRefreshInterval] = useState(30);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

    const loadPrices = async () => {
        try {
            const response = await fetchAllPrices();
            const priceMap = new Map<string, PriceData>();
            response.data.forEach((p) => priceMap.set(p.commodityId, p));
            setPrices(priceMap);
            setLastUpdate(new Date());
        } catch (err) {
            console.error('Failed to load prices:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPrices();
        const interval = setInterval(loadPrices, refreshInterval * 1000);
        return () => clearInterval(interval);
    }, [refreshInterval]);

    const filteredCommodities = useMemo(() => {
        let list = ALL_COMMODITIES;

        if (activeSector !== 'all') {
            list = list.filter((c) => c.sector === activeSector);
        }

        if (filterMode === 'global') {
            list = list.filter((c) => c.exchange !== 'MCX');
        } else if (filterMode === 'mcx') {
            list = list.filter((c) => c.exchange === 'MCX');
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(
                (c) =>
                    c.name.toLowerCase().includes(q) ||
                    c.symbol.toLowerCase().includes(q) ||
                    c.exchange.toLowerCase().includes(q)
            );
        }

        return list;
    }, [activeSector, filterMode, searchQuery]);

    const stats = useMemo(() => {
        const allPrices = Array.from(prices.values());
        const gainers = allPrices.filter((p) => p.changePercent > 0).length;
        const losers = allPrices.filter((p) => p.changePercent < 0).length;
        const topGainer = allPrices.reduce(
            (max, p) => (p.changePercent > (max?.changePercent || -999) ? p : max),
            allPrices[0]
        );
        const topLoser = allPrices.reduce(
            (min, p) => (p.changePercent < (min?.changePercent || 999) ? p : min),
            allPrices[0]
        );

        return { gainers, losers, topGainer, topLoser, total: allPrices.length };
    }, [prices]);

    return (
        <AppShell title="Dashboard" subtitle="Global & MCX Commodity Markets">
            {/* Stats Bar */}
            <div className="stats-bar">
                <div className="stat-item">
                    <span className="stat-label">Total Instruments</span>
                    <span className="stat-value">{stats.total}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Gainers</span>
                    <span className="stat-value text-gain">{stats.gainers}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Losers</span>
                    <span className="stat-value text-loss">{stats.losers}</span>
                </div>
                {stats.topGainer && (
                    <div className="stat-item">
                        <span className="stat-label">Top Gainer</span>
                        <span className="stat-value text-gain">
                            {ALL_COMMODITIES.find((c) => c.id === stats.topGainer.commodityId)?.name}{' '}
                            {formatChange(stats.topGainer.changePercent)}
                        </span>
                    </div>
                )}
                {stats.topLoser && (
                    <div className="stat-item">
                        <span className="stat-label">Top Loser</span>
                        <span className="stat-value text-loss">
                            {ALL_COMMODITIES.find((c) => c.id === stats.topLoser.commodityId)?.name}{' '}
                            {formatChange(stats.topLoser.changePercent)}
                        </span>
                    </div>
                )}
                {lastUpdate && (
                    <div className="stat-item" style={{ marginLeft: 'auto' }}>
                        <span className="stat-label">Last Update</span>
                        <span className="stat-value text-faint" style={{ fontSize: 'var(--text-xs)' }}>
                            {lastUpdate.toLocaleTimeString()}
                        </span>
                    </div>
                )}
            </div>

            {/* Trading Hours */}
            <TradingHoursIndicator />

            {/* Controls */}
            <div className="dashboard-controls">
                <div className="flex items-center gap-3">
                    <div className="tabs" style={{ borderBottom: 'none' }}>
                        {SECTOR_TABS.map((tab) => (
                            <button
                                key={tab.id}
                                className={`tab ${activeSector === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveSector(tab.id)}
                            >
                                <span>{tab.icon}</span> {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="filter-toggle">
                        <button
                            className={`filter-btn ${filterMode === 'all' ? 'active' : ''}`}
                            onClick={() => setFilterMode('all')}
                        >
                            All
                        </button>
                        <button
                            className={`filter-btn ${filterMode === 'global' ? 'active' : ''}`}
                            onClick={() => setFilterMode('global')}
                        >
                            Global
                        </button>
                        <button
                            className={`filter-btn ${filterMode === 'mcx' ? 'active' : ''}`}
                            onClick={() => setFilterMode('mcx')}
                        >
                            MCX
                        </button>
                    </div>

                    <div className="filter-toggle">
                        <button
                            className={`filter-btn ${viewMode === 'cards' ? 'active' : ''}`}
                            onClick={() => setViewMode('cards')}
                            title="Card View"
                        >
                            ▦
                        </button>
                        <button
                            className={`filter-btn ${viewMode === 'table' ? 'active' : ''}`}
                            onClick={() => setViewMode('table')}
                            title="Table View"
                        >
                            ≡
                        </button>
                        <button
                            className={`filter-btn ${viewMode === 'heatmap' ? 'active' : ''}`}
                            onClick={() => setViewMode('heatmap')}
                            title="Heatmap View"
                        >
                            ▤
                        </button>
                    </div>

                    <select
                        className="select"
                        value={refreshInterval}
                        onChange={(e) => setRefreshInterval(Number(e.target.value))}
                    >
                        <option value={5}>5s</option>
                        <option value={15}>15s</option>
                        <option value={30}>30s</option>
                        <option value={60}>1m</option>
                    </select>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="grid-auto">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="commodity-card" style={{ minHeight: 160 }}>
                            <div className="skeleton" style={{ height: 16, width: '60%', marginBottom: 12 }} />
                            <div className="skeleton" style={{ height: 28, width: '80%', marginBottom: 8 }} />
                            <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 16 }} />
                            <div
                                style={{
                                    borderTop: '1px solid var(--border-primary)',
                                    paddingTop: 12,
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: 8,
                                }}
                            >
                                <div className="skeleton" style={{ height: 12, width: '70%' }} />
                                <div className="skeleton" style={{ height: 12, width: '70%' }} />
                            </div>
                        </div>
                    ))}
                </div>
            ) : viewMode === 'cards' ? (
                <div className="grid-auto animate-fade-in">
                    {filteredCommodities.map((commodity) => {
                        const price = prices.get(commodity.id);
                        return <CommodityCard key={commodity.id} commodity={commodity} price={price} />;
                    })}
                </div>
            ) : viewMode === 'table' ? (
                <CommodityTable commodities={filteredCommodities} prices={prices} />
            ) : (
                <CommodityHeatmap commodities={filteredCommodities} prices={prices} />
            )}

            {/* Premium/Discount Calculator */}
            {!loading && prices.size > 0 && (
                <div style={{ marginTop: 'var(--space-6)' }}>
                    <PremiumCalculator prices={prices} />
                </div>
            )}
        </AppShell>
    );
}

function CommodityCard({ commodity, price }: { commodity: CommoditySpec; price?: PriceData }) {
    if (!price) return null;

    const isPositive = price.changePercent >= 0;
    const sectorMeta = SECTOR_META[commodity.sector];

    return (
        <div
            className="commodity-card"
            style={{ '--sector-color': sectorMeta.color } as React.CSSProperties}
        >
            <div className="commodity-card-header">
                <div>
                    <div className="commodity-card-name">{commodity.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                        {commodity.symbol}
                    </div>
                </div>
                <span className="commodity-card-exchange">{commodity.exchange}</span>
            </div>

            <div
                style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 'var(--space-3)',
                    marginBottom: 'var(--space-1)',
                }}
            >
                <span className="commodity-card-price">
                    {formatPrice(price.price, commodity.currency, commodity.currency === 'INR' ? 2 : undefined)}
                </span>
                <span className={`commodity-card-change ${isPositive ? 'positive' : 'negative'}`}>
                    {isPositive ? '▲' : '▼'} {formatChange(price.changePercent)}
                </span>
            </div>

            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-2)' }}>
                {commodity.unit}
            </div>

            <div className="commodity-card-meta">
                <div className="commodity-card-meta-item">
                    <span className="commodity-card-meta-label">Volume</span>
                    <span className="commodity-card-meta-value">{formatLargeNumber(price.volume)}</span>
                </div>
                <div className="commodity-card-meta-item">
                    <span className="commodity-card-meta-label">OI</span>
                    <span className="commodity-card-meta-value">
                        {price.openInterest ? formatLargeNumber(price.openInterest) : '—'}
                    </span>
                </div>
                <div className="commodity-card-meta-item">
                    <span className="commodity-card-meta-label">High</span>
                    <span className="commodity-card-meta-value">{formatPrice(price.dayHigh, commodity.currency, 2)}</span>
                </div>
                <div className="commodity-card-meta-item">
                    <span className="commodity-card-meta-label">Low</span>
                    <span className="commodity-card-meta-value">{formatPrice(price.dayLow, commodity.currency, 2)}</span>
                </div>
            </div>
        </div>
    );
}

function CommodityTable({
    commodities,
    prices,
}: {
    commodities: CommoditySpec[];
    prices: Map<string, PriceData>;
}) {
    return (
        <div className="card animate-fade-in" style={{ padding: 0, overflow: 'auto' }}>
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Commodity</th>
                        <th>Exchange</th>
                        <th style={{ textAlign: 'right' }}>Price</th>
                        <th style={{ textAlign: 'right' }}>Change</th>
                        <th style={{ textAlign: 'right' }}>High</th>
                        <th style={{ textAlign: 'right' }}>Low</th>
                        <th style={{ textAlign: 'right' }}>Volume</th>
                        <th style={{ textAlign: 'right' }}>OI</th>
                    </tr>
                </thead>
                <tbody>
                    {commodities.map((c) => {
                        const p = prices.get(c.id);
                        if (!p) return null;
                        const isPositive = p.changePercent >= 0;
                        return (
                            <tr key={c.id}>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                        <span>{SECTOR_META[c.sector].icon}</span>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{c.name}</div>
                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                                                {c.symbol}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <span className="commodity-card-exchange">{c.exchange}</span>
                                </td>
                                <td className="mono-cell" style={{ textAlign: 'right' }}>
                                    {formatPrice(p.price, c.currency, 2)}
                                </td>
                                <td className="mono-cell" style={{ textAlign: 'right' }}>
                                    <span className={isPositive ? 'text-gain' : 'text-loss'}>
                                        {formatChange(p.changePercent)}
                                    </span>
                                </td>
                                <td className="mono-cell" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                                    {formatPrice(p.dayHigh, c.currency, 2)}
                                </td>
                                <td className="mono-cell" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                                    {formatPrice(p.dayLow, c.currency, 2)}
                                </td>
                                <td className="mono-cell" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                                    {formatLargeNumber(p.volume)}
                                </td>
                                <td className="mono-cell" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                                    {p.openInterest ? formatLargeNumber(p.openInterest) : '—'}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function CommodityHeatmap({
    commodities,
    prices,
}: {
    commodities: CommoditySpec[];
    prices: Map<string, PriceData>;
}) {
    // ── Treemap layout algorithm (squarified) ─────────────────
    interface TreeRect {
        commodity: CommoditySpec;
        price: PriceData;
        x: number; y: number; w: number; h: number;
    }

    function squarify(
        items: { commodity: CommoditySpec; price: PriceData; weight: number }[],
        x: number, y: number, w: number, h: number
    ): TreeRect[] {
        if (items.length === 0) return [];
        if (items.length === 1) {
            return [{ commodity: items[0].commodity, price: items[0].price, x, y, w, h }];
        }

        const totalWeight = items.reduce((s, i) => s + i.weight, 0);
        if (totalWeight <= 0) return [];

        // Sort descending by weight for better layout
        const sorted = [...items].sort((a, b) => b.weight - a.weight);

        // Split into two groups that minimize aspect ratio
        let bestSplit = 1;
        let bestRatio = Infinity;
        let runningSum = 0;

        for (let i = 0; i < sorted.length - 1; i++) {
            runningSum += sorted[i].weight;
            const ratio1 = runningSum / totalWeight;
            const ratio2 = 1 - ratio1;

            // Calculate how close each resulting rectangle is to a square
            const isHorizontal = w >= h;
            let aspect: number;
            if (isHorizontal) {
                const w1 = w * ratio1, w2 = w * ratio2;
                aspect = Math.max(w1 / h, h / w1) + Math.max(w2 / h, h / w2);
            } else {
                const h1 = h * ratio1, h2 = h * ratio2;
                aspect = Math.max(w / h1, h1 / w) + Math.max(w / h2, h2 / w);
            }

            if (aspect < bestRatio) {
                bestRatio = aspect;
                bestSplit = i + 1;
            }
        }

        const group1 = sorted.slice(0, bestSplit);
        const group2 = sorted.slice(bestSplit);
        const ratio = group1.reduce((s, i) => s + i.weight, 0) / totalWeight;

        const isHorizontal = w >= h;
        let rects1: TreeRect[], rects2: TreeRect[];

        if (isHorizontal) {
            const w1 = w * ratio;
            rects1 = squarify(group1, x, y, w1, h);
            rects2 = squarify(group2, x + w1, y, w - w1, h);
        } else {
            const h1 = h * ratio;
            rects1 = squarify(group1, x, y, w, h1);
            rects2 = squarify(group2, x, y + h1, w, h - h1);
        }

        return [...rects1, ...rects2];
    }

    // ── Color scale ───────────────────────────────────────────
    const getHeatColor = (pct: number): string => {
        const abs = Math.min(Math.abs(pct), 5);
        const intensity = 0.15 + (abs / 5) * 0.55; // 0.15 → 0.70
        if (pct >= 0) return `rgba(34, 197, 94, ${intensity})`;
        return `rgba(239, 68, 68, ${intensity})`;
    };

    // ── Build treemap data ────────────────────────────────────
    const treeData = useMemo(() => {
        const items = commodities
            .map(c => {
                const p = prices.get(c.id);
                if (!p) return null;
                // Weight by magnitude — give minimum weight so flat items still appear
                const weight = Math.max(Math.abs(p.changePercent), 0.15);
                return { commodity: c, price: p, weight };
            })
            .filter(Boolean) as { commodity: CommoditySpec; price: PriceData; weight: number }[];

        if (items.length === 0) return [];
        return squarify(items, 0, 0, 100, 100);
    }, [commodities, prices]);

    if (treeData.length === 0) {
        return <div className="heatmap-empty" style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>No data to display</div>;
    }

    return (
        <div className="treemap-container animate-fade-in" style={{ position: 'relative', width: '100%', paddingBottom: '60%', overflow: 'hidden', borderRadius: 'var(--radius-lg)' }}>
            {treeData.map(rect => {
                const isPositive = rect.price.changePercent >= 0;
                const isLarge = rect.w > 8 && rect.h > 8;
                const isMedium = rect.w > 5 && rect.h > 5;

                return (
                    <div
                        key={rect.commodity.id}
                        className="treemap-cell"
                        style={{
                            position: 'absolute',
                            left: `${rect.x}%`,
                            top: `${rect.y}%`,
                            width: `${rect.w}%`,
                            height: `${rect.h}%`,
                            background: getHeatColor(rect.price.changePercent),
                            padding: '4px 6px',
                            boxSizing: 'border-box',
                            border: '1px solid var(--bg-primary)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            transition: 'filter var(--transition-fast)',
                        }}
                        title={`${rect.commodity.name}: ${formatPrice(rect.price.price, rect.commodity.currency, 2)} (${formatChange(rect.price.changePercent)})`}
                    >
                        {isLarge ? (
                            <>
                                <div className="heatmap-name" style={{ fontSize: rect.w > 14 ? 'var(--text-sm)' : 'var(--text-xs)' }}>
                                    {rect.commodity.symbol}
                                </div>
                                <div className={`heatmap-change ${isPositive ? 'text-gain' : 'text-loss'}`} style={{ fontSize: rect.w > 14 ? 'var(--text-base)' : 'var(--text-sm)' }}>
                                    {formatChange(rect.price.changePercent)}
                                </div>
                                {rect.w > 12 && rect.h > 12 && (
                                    <div className="heatmap-price" style={{ fontSize: 'var(--text-xs)' }}>
                                        {formatPrice(rect.price.price, rect.commodity.currency, 2)}
                                    </div>
                                )}
                            </>
                        ) : isMedium ? (
                            <>
                                <div className="heatmap-name" style={{ fontSize: '9px' }}>{rect.commodity.symbol}</div>
                                <div className={`heatmap-change ${isPositive ? 'text-gain' : 'text-loss'}`} style={{ fontSize: '10px' }}>
                                    {formatChange(rect.price.changePercent)}
                                </div>
                            </>
                        ) : (
                            <div className="heatmap-name" style={{ fontSize: '8px' }}>{rect.commodity.symbol}</div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
