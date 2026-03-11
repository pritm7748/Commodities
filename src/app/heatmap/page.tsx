'use client';

import { useEffect, useState, useMemo } from 'react';
import AppShell from '@/components/layout/AppShell';
import { ALL_COMMODITIES, SECTOR_META, CommoditySpec } from '@/lib/data/commodities';
import { PriceData, fetchAllPrices } from '@/lib/services/priceService';
import { formatPrice, formatChange } from '@/lib/utils/conversions';

// ── Squarified Treemap Algorithm ──────────────────────────────
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

    const sorted = [...items].sort((a, b) => b.weight - a.weight);

    let bestSplit = 1;
    let bestRatio = Infinity;
    let runningSum = 0;

    for (let i = 0; i < sorted.length - 1; i++) {
        runningSum += sorted[i].weight;
        const ratio1 = runningSum / totalWeight;
        const isHoriz = w >= h;
        let aspect: number;
        if (isHoriz) {
            const w1 = w * ratio1, w2 = w * (1 - ratio1);
            aspect = Math.max(w1 / h, h / w1) + Math.max(w2 / h, h / w2);
        } else {
            const h1 = h * ratio1, h2 = h * (1 - ratio1);
            aspect = Math.max(w / h1, h1 / w) + Math.max(w / h2, h2 / w);
        }
        if (aspect < bestRatio) { bestRatio = aspect; bestSplit = i + 1; }
    }

    const group1 = sorted.slice(0, bestSplit);
    const group2 = sorted.slice(bestSplit);
    const ratio = group1.reduce((s, i) => s + i.weight, 0) / totalWeight;

    if (w >= h) {
        const w1 = w * ratio;
        return [...squarify(group1, x, y, w1, h), ...squarify(group2, x + w1, y, w - w1, h)];
    } else {
        const h1 = h * ratio;
        return [...squarify(group1, x, y, w, h1), ...squarify(group2, x, y + h1, w, h - h1)];
    }
}

// ── Color Scales ──────────────────────────────────────────────
const getHeatColor = (pct: number): string => {
    const abs = Math.min(Math.abs(pct), 5);
    const intensity = 0.15 + (abs / 5) * 0.55;
    if (pct >= 0) return `rgba(34, 197, 94, ${intensity})`;
    return `rgba(239, 68, 68, ${intensity})`;
};

const SECTORS = ['all', 'precious', 'energy', 'base', 'agri', 'softs'] as const;

export default function HeatmapPage() {
    const [prices, setPrices] = useState<Map<string, PriceData>>(new Map());
    const [loading, setLoading] = useState(true);
    const [sector, setSector] = useState<string>('all');
    const [weightBy, setWeightBy] = useState<'change' | 'equal'>('change');

    useEffect(() => {
        fetchAllPrices().then(response => {
            const priceMap = new Map<string, PriceData>();
            response.data.forEach((p) => priceMap.set(p.commodityId, p));
            setPrices(priceMap);
            setLoading(false);
        });
    }, []);

    const commodities = useMemo(() => {
        const filtered = sector === 'all'
            ? ALL_COMMODITIES
            : ALL_COMMODITIES.filter(c => c.sector === sector);
        return filtered.filter(c => prices.has(c.id));
    }, [sector, prices]);

    const treeData = useMemo(() => {
        const items = commodities
            .map(c => {
                const p = prices.get(c.id);
                if (!p) return null;
                const weight = weightBy === 'change'
                    ? Math.max(Math.abs(p.changePercent), 0.15)
                    : 1;
                return { commodity: c, price: p, weight };
            })
            .filter(Boolean) as { commodity: CommoditySpec; price: PriceData; weight: number }[];

        if (items.length === 0) return [];
        return squarify(items, 0, 0, 100, 100);
    }, [commodities, prices, weightBy]);

    // Stats
    const gainers = commodities.filter(c => (prices.get(c.id)?.changePercent ?? 0) > 0).length;
    const losers = commodities.filter(c => (prices.get(c.id)?.changePercent ?? 0) < 0).length;
    const avgChange = commodities.length > 0
        ? commodities.reduce((s, c) => s + (prices.get(c.id)?.changePercent ?? 0), 0) / commodities.length
        : 0;

    return (
        <AppShell title="Heatmap" subtitle="Commodity Market Heatmap — Price Change Treemap">
            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                <div className="filter-toggle">
                    {SECTORS.map(s => (
                        <button
                            key={s}
                            className={`filter-btn ${sector === s ? 'active' : ''}`}
                            onClick={() => setSector(s)}
                        >
                            {s === 'all' ? 'All' : SECTOR_META[s]?.label || s}
                        </button>
                    ))}
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Size by:</span>
                    <button
                        className={`btn btn-xs ${weightBy === 'change' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setWeightBy('change')}
                    >
                        Change %
                    </button>
                    <button
                        className={`btn btn-xs ${weightBy === 'equal' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setWeightBy('equal')}
                    >
                        Equal
                    </button>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="stats-bar" style={{ marginBottom: 'var(--space-4)' }}>
                <div className="stat-item">
                    <span className="stat-label">Commodities</span>
                    <span className="stat-value">{commodities.length}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Gainers</span>
                    <span className="stat-value text-gain">{gainers}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Losers</span>
                    <span className="stat-value text-loss">{losers}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Avg Change</span>
                    <span className={`stat-value ${avgChange >= 0 ? 'text-gain' : 'text-loss'}`}>
                        {formatChange(avgChange)}
                    </span>
                </div>
            </div>

            {/* Treemap */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--text-tertiary)' }}>
                    ⏳ Loading market data...
                </div>
            ) : treeData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--text-tertiary)' }}>
                    No data available
                </div>
            ) : (
                <div
                    className="treemap-container animate-fade-in"
                    style={{
                        position: 'relative',
                        width: '100%',
                        paddingBottom: '55%',
                        overflow: 'hidden',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-primary)',
                    }}
                >
                    {treeData.map(rect => {
                        const isPositive = rect.price.changePercent >= 0;
                        const isLarge = rect.w > 8 && rect.h > 8;
                        const isMedium = rect.w > 5 && rect.h > 5;
                        const isXL = rect.w > 14 && rect.h > 14;

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
                                title={`${rect.commodity.name} (${rect.commodity.exchange})\n${formatPrice(rect.price.price, rect.commodity.currency, 2)} | ${formatChange(rect.price.changePercent)}`}
                            >
                                {isLarge ? (
                                    <>
                                        <div className="heatmap-name" style={{ fontSize: isXL ? 'var(--text-sm)' : 'var(--text-xs)' }}>
                                            {rect.commodity.symbol}
                                        </div>
                                        <div
                                            className={`heatmap-change ${isPositive ? 'text-gain' : 'text-loss'}`}
                                            style={{ fontSize: isXL ? 'var(--text-lg)' : 'var(--text-sm)' }}
                                        >
                                            {formatChange(rect.price.changePercent)}
                                        </div>
                                        {isXL && (
                                            <div className="heatmap-price" style={{ fontSize: 'var(--text-xs)', marginTop: '4px' }}>
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
            )}

            {/* Legend */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-4)',
                marginTop: 'var(--space-4)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-tertiary)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: 16, height: 12, background: 'rgba(239, 68, 68, 0.6)', borderRadius: 2 }} />
                    <span>-3%+</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: 16, height: 12, background: 'rgba(239, 68, 68, 0.25)', borderRadius: 2 }} />
                    <span>-1%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: 16, height: 12, background: 'rgba(34, 197, 94, 0.25)', borderRadius: 2 }} />
                    <span>+1%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: 16, height: 12, background: 'rgba(34, 197, 94, 0.6)', borderRadius: 2 }} />
                    <span>+3%+</span>
                </div>
                <span style={{ marginLeft: 'var(--space-2)', fontStyle: 'italic' }}>
                    {weightBy === 'change' ? 'Cell size = |change %|' : 'Equal weight'}
                </span>
            </div>
        </AppShell>
    );
}
