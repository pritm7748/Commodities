'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell';
import { ALL_COMMODITIES, CommoditySpec } from '@/lib/data/commodities';
import CommodityChart, { ChartDataPoint } from '@/components/charts/CommodityChart';
import { fetchHistoricalData } from '@/lib/services/priceService';

const LAYOUTS = [
    { id: '1x2', label: '1×2', cols: 2, rows: 1 },
    { id: '2x1', label: '2×1', cols: 1, rows: 2 },
    { id: '2x2', label: '2×2', cols: 2, rows: 2 },
];

const CHART_COMMODITIES = ALL_COMMODITIES.filter((c) =>
    ['precious', 'energy', 'base'].includes(c.sector)
).slice(0, 30);

interface PanelState {
    commodityId: string;
    chartType: 'candlestick' | 'line' | 'area';
}

function ChartPanel({
    panel,
    onChange,
    height,
}: {
    panel: PanelState;
    onChange: (updates: Partial<PanelState>) => void;
    height: number;
}) {
    const commodity = ALL_COMMODITIES.find((c) => c.id === panel.commodityId) || CHART_COMMODITIES[0];
    const [data, setData] = useState<ChartDataPoint[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        fetchHistoricalData(commodity.id, '1day', 120).then((result) => {
            if (!cancelled) {
                setData(result.map((d) => ({
                    time: d.time,
                    open: d.open,
                    high: d.high,
                    low: d.low,
                    close: d.close,
                    volume: d.volume,
                })));
                setLoading(false);
            }
        });

        return () => { cancelled = true; };
    }, [commodity.id]);

    return (
        <div className="card compare-panel">
            <div className="compare-panel-header">
                <select
                    className="select"
                    style={{ fontSize: 'var(--text-xs)', padding: '4px 8px', flex: 1, minWidth: 0 }}
                    value={panel.commodityId}
                    onChange={(e) => onChange({ commodityId: e.target.value })}
                >
                    {CHART_COMMODITIES.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.exchange})</option>
                    ))}
                </select>

                <div className="compare-chart-types">
                    {(['candlestick', 'line', 'area'] as const).map((type) => (
                        <button
                            key={type}
                            className={`btn btn-xs ${panel.chartType === type ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => onChange({ chartType: type })}
                        >
                            {type === 'candlestick' ? '🕯️' : type === 'line' ? '📈' : '📊'}
                        </button>
                    ))}
                </div>
            </div>

            {loading && data.length === 0 ? (
                <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
                    ⏳ Loading {commodity.name}...
                </div>
            ) : data.length === 0 ? (
                <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
                    No data for {commodity.name}
                </div>
            ) : (
                <CommodityChart
                    commodity={commodity}
                    data={data}
                    chartType={panel.chartType}
                    indicators={[]}
                    height={height}
                />
            )}
        </div>
    );
}

export default function ComparePage() {
    const [layout, setLayout] = useState('2x2');
    const layoutConfig = LAYOUTS.find((l) => l.id === layout) || LAYOUTS[2];
    const panelCount = layoutConfig.cols * layoutConfig.rows;

    const defaultIds = ['gold-comex', 'crude-wti', 'silver-comex', 'copper-lme'];
    const [panels, setPanels] = useState<PanelState[]>(
        defaultIds.map((id) => ({ commodityId: id, chartType: 'candlestick' }))
    );

    const updatePanel = (idx: number, updates: Partial<PanelState>) => {
        setPanels((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], ...updates };
            return next;
        });
    };

    return (
        <AppShell title="Compare Charts" subtitle="Multi-Commodity Comparison">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Layout:</span>
                {LAYOUTS.map((l) => (
                    <button
                        key={l.id}
                        className={`btn btn-sm ${layout === l.id ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setLayout(l.id)}
                    >
                        {l.label}
                    </button>
                ))}
            </div>

            <div
                className="compare-grid"
                style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${layoutConfig.cols}, 1fr)`,
                    gridTemplateRows: `repeat(${layoutConfig.rows}, 1fr)`,
                    gap: 'var(--space-3)',
                }}
            >
                {Array.from({ length: panelCount }).map((_, idx) => {
                    const panel = panels[idx] || { commodityId: defaultIds[idx % defaultIds.length], chartType: 'candlestick' as const };
                    return (
                        <ChartPanel
                            key={idx}
                            panel={panel}
                            onChange={(updates) => updatePanel(idx, updates)}
                            height={panelCount <= 2 ? 400 : 280}
                        />
                    );
                })}
            </div>
        </AppShell>
    );
}
