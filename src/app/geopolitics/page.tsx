'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import AppShell from '@/components/layout/AppShell';
import {
    REGION_RISKS,
    OPEC_MEMBERS,
    SEVERITY_COLORS,
} from '@/lib/data/fundamentals/geopoliticalData';

// ── Types ─────────────────────────────────────────────────────

interface NewsArticle {
    title: string;
    description: string;
    link: string;
    pubDate: string;
    source_name: string;
    category: string[];
    sentiment: string;
    image_url: string | null;
}

// ── Commodity keyword tagging ────────────────────────────────

const COMMODITY_KEYWORDS: Record<string, string[]> = {
    'Crude Oil': ['oil', 'crude', 'petroleum', 'brent', 'wti', 'opec', 'refinery'],
    'Natural Gas': ['natural gas', 'lng', 'gas pipeline', 'gas prices'],
    'Gold': ['gold', 'bullion', 'precious metal'],
    'Silver': ['silver'],
    'Copper': ['copper'],
    'Wheat': ['wheat', 'grain'],
    'Corn': ['corn', 'maize'],
    'Cotton': ['cotton'],
    'Aluminum': ['aluminium', 'aluminum', 'bauxite'],
};

function tagCommodities(text: string): string[] {
    const lower = text.toLowerCase();
    const tags: string[] = [];
    for (const [commodity, keywords] of Object.entries(COMMODITY_KEYWORDS)) {
        if (keywords.some(kw => lower.includes(kw))) {
            tags.push(commodity);
        }
    }
    return tags.length > 0 ? tags : ['General'];
}

function getSeverityFromSentiment(sentiment: string): 'critical' | 'high' | 'medium' | 'low' {
    if (sentiment === 'negative') return 'high';
    if (sentiment === 'positive') return 'low';
    return 'medium';
}

// ── Main Page ─────────────────────────────────────────────────

export default function GeopoliticsPage() {
    const [activeTab, setActiveTab] = useState<'news' | 'regions' | 'opec'>('news');
    const [articles, setArticles] = useState<NewsArticle[]>([]);
    const [newsLoading, setNewsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [fromCache, setFromCache] = useState(false);
    const [fetchedAt, setFetchedAt] = useState('');

    // Fetch news (from cache or fresh)
    const fetchNews = useCallback(async (forceRefresh = false) => {
        if (forceRefresh) setRefreshing(true);
        else setNewsLoading(true);

        try {
            const url = forceRefresh ? '/api/data/news?refresh=true' : '/api/data/news';
            const res = await fetch(url);
            const data = await res.json();
            const results = data?.results || [];
            setArticles(results);
            setFromCache(data?.fromCache || false);
            setFetchedAt(data?.fetchedAt || '');
        } catch (err) {
            console.error('News fetch error:', err);
        } finally {
            setNewsLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchNews();
    }, [fetchNews]);

    // Stats
    const avgRisk = REGION_RISKS.reduce((s, r) => s + r.riskScore, 0) / REGION_RISKS.length;
    const opecCompliance = OPEC_MEMBERS.reduce((s, m) => s + m.compliance, 0) / OPEC_MEMBERS.length;

    return (
        <AppShell title="Geopolitical Risk" subtitle="Live News Feed, Regional Analysis & OPEC Monitor">
            {/* Live Data Banner */}
            <div style={{
                padding: 'var(--space-3) var(--space-4)',
                marginBottom: 'var(--space-4)',
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-xs)',
                color: '#22c55e',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
            }}>
                <span style={{ fontSize: '1rem' }}>🟢</span>
                <span>
                    <strong>Live + Reference Data</strong> — News feed from NewsData.io API (live).
                    Regional risk scores & OPEC data are curated reference snapshots.
                </span>
            </div>

            {/* Stats Bar */}
            <div className="stats-bar" style={{ marginBottom: 'var(--space-4)' }}>
                <div className="stat-item">
                    <span className="stat-label">Live Articles</span>
                    <span className="stat-value">{newsLoading ? '...' : articles.length}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Regions Monitored</span>
                    <span className="stat-value">{REGION_RISKS.length}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Avg Regional Risk</span>
                    <span className="stat-value" style={{ color: avgRisk > 60 ? '#ef4444' : avgRisk > 40 ? '#f59e0b' : '#22c55e' }}>
                        {avgRisk.toFixed(0)}/100
                    </span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">OPEC Compliance</span>
                    <span className="stat-value">{opecCompliance.toFixed(0)}%</span>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="filter-toggle">
                    {(['news', 'regions', 'opec'] as const).map(tab => (
                        <button
                            key={tab}
                            className={`filter-btn ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab === 'news' ? '📰 Live News' : tab === 'regions' ? '🗺️ Regions' : '🛢️ OPEC'}
                        </button>
                    ))}
                </div>

                {activeTab === 'news' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginLeft: 'auto' }}>
                        {fetchedAt && (
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                                {fromCache ? '📦 Cached' : '🔄 Fresh'} •
                                Updated {new Date(fetchedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </span>
                        )}
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => fetchNews(true)}
                            disabled={refreshing}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: refreshing ? 0.5 : 1 }}
                        >
                            <span style={{ display: 'inline-block', animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>🔄</span>
                            {refreshing ? 'Refreshing...' : 'Refresh News'}
                        </button>
                    </div>
                )}
            </div>

            {/* TAB: Live News — from NewsData.io */}
            {activeTab === 'news' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {newsLoading ? (
                        // Skeleton loaders
                        Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="card" style={{ padding: 'var(--space-4)', opacity: 0.5 }}>
                                <div style={{ height: 16, background: 'var(--bg-tertiary)', borderRadius: 4, marginBottom: 10, width: '30%' }} />
                                <div style={{ height: 22, background: 'var(--bg-tertiary)', borderRadius: 4, marginBottom: 8, width: '80%' }} />
                                <div style={{ height: 14, background: 'var(--bg-tertiary)', borderRadius: 4, width: '100%' }} />
                            </div>
                        ))
                    ) : articles.length > 0 ? (
                        articles.map((article, idx) => {
                            const commodityTags = tagCommodities(`${article.title} ${article.description || ''}`);
                            const severity = getSeverityFromSentiment(article.sentiment || 'neutral');
                            const sev = SEVERITY_COLORS[severity] || SEVERITY_COLORS.medium;
                            const pubDate = article.pubDate ? new Date(article.pubDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

                            return (
                                <div key={idx} className="card" style={{
                                    padding: 'var(--space-4)',
                                    borderLeft: `3px solid ${sev.text}`,
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                                        <div style={{ flex: 1, minWidth: 200 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                                                <span style={{
                                                    padding: '2px 8px',
                                                    borderRadius: 'var(--radius-full)',
                                                    fontSize: '10px',
                                                    fontWeight: 'var(--weight-bold)',
                                                    textTransform: 'uppercase',
                                                    background: sev.bg,
                                                    color: sev.text,
                                                    border: `1px solid ${sev.border}`,
                                                }}>
                                                    {severity}
                                                </span>
                                                <span style={{
                                                    padding: '2px 8px',
                                                    borderRadius: 'var(--radius-full)',
                                                    fontSize: '10px',
                                                    background: 'rgba(34, 197, 94, 0.15)',
                                                    color: '#22c55e',
                                                }}>
                                                    LIVE
                                                </span>
                                                {article.source_name && (
                                                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{article.source_name}</span>
                                                )}
                                                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{pubDate}</span>
                                            </div>
                                            <a
                                                href={article.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    fontSize: 'var(--text-base)',
                                                    fontWeight: 'var(--weight-bold)',
                                                    color: 'var(--text-primary)',
                                                    marginBottom: 'var(--space-2)',
                                                    display: 'block',
                                                    textDecoration: 'none',
                                                }}
                                            >
                                                {article.title}
                                            </a>
                                            {article.description && (
                                                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 'var(--space-2)' }}>
                                                    {article.description.slice(0, 200)}{article.description.length > 200 ? '...' : ''}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: 200 }}>
                                            {commodityTags.map(c => (
                                                <span key={c} style={{
                                                    padding: '2px 8px',
                                                    fontSize: '10px',
                                                    borderRadius: 'var(--radius-full)',
                                                    background: 'var(--bg-tertiary)',
                                                    color: 'var(--text-primary)',
                                                    whiteSpace: 'nowrap',
                                                }}>
                                                    {c}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="card" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>
                            <div style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>📰</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                                Unable to fetch live news. Please check NEWS_API_KEY in .env.local
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB: Regional Risk */}
            {activeTab === 'regions' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 'var(--space-3)' }}>
                    {REGION_RISKS.sort((a, b) => b.riskScore - a.riskScore).map(region => {
                        const riskColor = region.riskScore > 70 ? '#ef4444' : region.riskScore > 50 ? '#f59e0b' : region.riskScore > 30 ? '#3b82f6' : '#22c55e';
                        const trendIcon = region.trend === 'rising' ? '📈' : region.trend === 'falling' ? '📉' : '➡️';

                        return (
                            <div key={region.region} className="card" style={{ padding: 'var(--space-4)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                        <span style={{ fontSize: '1.5rem' }}>{region.emoji}</span>
                                        <div>
                                            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)' }}>{region.region}</div>
                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                                                {trendIcon} Trend: {region.trend}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{
                                        fontSize: 'var(--text-xl)',
                                        fontWeight: 'var(--weight-black)',
                                        fontFamily: 'var(--font-mono)',
                                        color: riskColor,
                                    }}>
                                        {region.riskScore}
                                    </div>
                                </div>

                                {/* Risk bar */}
                                <div style={{ height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden', marginBottom: 'var(--space-2)' }}>
                                    <div style={{
                                        width: `${region.riskScore}%`,
                                        height: '100%',
                                        background: `linear-gradient(90deg, ${riskColor}88, ${riskColor})`,
                                        borderRadius: 4,
                                        transition: 'width 0.5s ease',
                                    }} />
                                </div>

                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 'var(--space-2)' }}>
                                    {region.description}
                                </div>

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {region.keyCommodities.map(c => (
                                        <span key={c} style={{
                                            padding: '2px 8px',
                                            fontSize: '10px',
                                            borderRadius: 'var(--radius-full)',
                                            background: `${riskColor}15`,
                                            color: riskColor,
                                            border: `1px solid ${riskColor}30`,
                                        }}>
                                            {c}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* TAB: OPEC Monitor */}
            {activeTab === 'opec' && (
                <div>
                    {/* OPEC Summary */}
                    <div className="card" style={{
                        padding: 'var(--space-5)',
                        marginBottom: 'var(--space-4)',
                        background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.05))',
                        borderColor: 'rgba(245,158,11,0.2)',
                    }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-4)' }}>
                            <div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Total Quota</div>
                                <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-black)', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                                    {OPEC_MEMBERS.reduce((s, m) => s + m.quota, 0).toFixed(1)} mmbbl/d
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Actual Production</div>
                                <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-black)', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                                    {OPEC_MEMBERS.reduce((s, m) => s + m.production, 0).toFixed(1)} mmbbl/d
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Spare Capacity</div>
                                <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-black)', fontFamily: 'var(--font-mono)', color: '#f59e0b' }}>
                                    {(OPEC_MEMBERS.reduce((s, m) => s + m.quota, 0) - OPEC_MEMBERS.reduce((s, m) => s + m.production, 0)).toFixed(1)} mmbbl/d
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Avg Compliance</div>
                                <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-black)', fontFamily: 'var(--font-mono)', color: opecCompliance > 95 ? '#22c55e' : '#f59e0b' }}>
                                    {opecCompliance.toFixed(0)}%
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Member Table */}
                    <div className="card" style={{ padding: 'var(--space-4)', overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'left', padding: '8px', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)' }}>Member</th>
                                    <th style={{ textAlign: 'right', padding: '8px', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)' }}>Quota (mmbbl/d)</th>
                                    <th style={{ textAlign: 'right', padding: '8px', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)' }}>Production</th>
                                    <th style={{ textAlign: 'right', padding: '8px', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)' }}>Compliance</th>
                                    <th style={{ textAlign: 'left', padding: '8px', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)', minWidth: 120 }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {OPEC_MEMBERS.sort((a, b) => b.quota - a.quota).map(member => {
                                    const compColor = member.compliance > 100 ? '#ef4444' : member.compliance > 95 ? '#22c55e' : member.compliance > 85 ? '#f59e0b' : '#ef4444';
                                    const barPct = Math.min(member.compliance, 110);

                                    return (
                                        <tr key={member.country} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                                            <td style={{ padding: '8px', color: 'var(--text-primary)' }}>
                                                <span style={{ marginRight: '6px' }}>{member.flag}</span>{member.country}
                                            </td>
                                            <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                                                {member.quota.toFixed(1)}
                                            </td>
                                            <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                                                {member.production.toFixed(1)}
                                            </td>
                                            <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 'var(--weight-bold)', color: compColor }}>
                                                {member.compliance}%
                                            </td>
                                            <td style={{ padding: '8px' }}>
                                                <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                                                    <div style={{
                                                        width: `${barPct}%`,
                                                        height: '100%',
                                                        background: compColor,
                                                        borderRadius: 3,
                                                        transition: 'width 0.3s ease',
                                                    }} />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </AppShell>
    );
}
