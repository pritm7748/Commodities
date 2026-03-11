// ════════════════════════════════════════════════════════════
// Geopolitical Risk Data — Curated Risk Events & Analysis
// ════════════════════════════════════════════════════════════

export interface GeoEvent {
    id: string;
    title: string;
    region: string;
    date: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: 'conflict' | 'sanctions' | 'trade' | 'policy' | 'opec';
    commodities: string[];
    description: string;
    impact: string;
}

export interface RegionRisk {
    region: string;
    emoji: string;
    riskScore: number; // 0-100
    trend: 'rising' | 'stable' | 'falling';
    keyCommodities: string[];
    description: string;
}

export interface OPECMember {
    country: string;
    flag: string;
    quota: number; // mmbbl/d
    production: number;
    compliance: number; // %
}

// ── Active Geopolitical Events ──────────────────────────────

export const GEO_EVENTS: GeoEvent[] = [
    {
        id: 'e1', title: 'Russia-Ukraine War — Energy Disruptions',
        region: 'Eastern Europe', date: '2022–Present', severity: 'critical', category: 'conflict',
        commodities: ['Natural Gas', 'Wheat', 'Crude Oil', 'Palladium', 'Nickel'],
        description: 'Ongoing conflict continues to disrupt Black Sea grain corridors and European energy security.',
        impact: 'EU natural gas volatility, wheat export uncertainty, nickel supply constraints.',
    },
    {
        id: 'e2', title: 'Middle East Tensions — Red Sea Shipping',
        region: 'Middle East', date: '2024–Present', severity: 'high', category: 'conflict',
        commodities: ['Crude Oil', 'Natural Gas', 'Gold'],
        description: 'Houthi attacks on Red Sea shipping lanes forcing rerouting via Cape of Good Hope.',
        impact: 'Higher shipping costs, longer transit times, oil risk premium of $3-5/bbl.',
    },
    {
        id: 'e3', title: 'OPEC+ Production Cuts Extended',
        region: 'Middle East / OPEC', date: 'Q1 2025', severity: 'high', category: 'opec',
        commodities: ['Crude Oil'],
        description: 'Saudi-led voluntary cuts of 2.2 mmbbl/d extended through Q1 2025.',
        impact: 'Floor under oil prices at ~$70/bbl. Supply tightness vs demand uncertainty.',
    },
    {
        id: 'e4', title: 'US-China Trade Restrictions',
        region: 'Asia-Pacific', date: '2024–Present', severity: 'medium', category: 'trade',
        commodities: ['Copper', 'Lithium', 'Rare Earths', 'Aluminium'],
        description: 'Escalating tech export controls and critical mineral restrictions between US and China.',
        impact: 'Supply chain reshoring, increased demand for alternative sources, price premiums.',
    },
    {
        id: 'e5', title: 'Iran Nuclear Deal Uncertainty',
        region: 'Middle East', date: '2025', severity: 'medium', category: 'sanctions',
        commodities: ['Crude Oil', 'Natural Gas'],
        description: 'Potential reimposition of strict sanctions could remove 1-1.5 mmbbl/d from market.',
        impact: 'Oil supply risk. Iranian barrels being discounted to China/India.',
    },
    {
        id: 'e6', title: 'India Import Duty Changes on Gold/Silver',
        region: 'South Asia', date: '2024', severity: 'medium', category: 'policy',
        commodities: ['Gold', 'Silver'],
        description: 'India cut gold import duty from 15% to 6% in July 2024, boosting demand.',
        impact: 'Increased physical demand, higher MCX premiums, structural demand support.',
    },
    {
        id: 'e7', title: 'Congo/Cobalt Supply Disruptions',
        region: 'Central Africa', date: '2025', severity: 'medium', category: 'conflict',
        commodities: ['Cobalt', 'Copper'],
        description: 'Political instability in DRC threatens copper and cobalt supply (65% of global cobalt).',
        impact: 'EV battery supply chain risk, copper supply concentration risk.',
    },
    {
        id: 'e8', title: 'El Niño / La Niña Weather Events',
        region: 'Global', date: 'Cyclical', severity: 'medium', category: 'policy',
        commodities: ['Wheat', 'Corn', 'Soybeans', 'Sugar', 'Coffee', 'Cotton'],
        description: 'La Niña watch for 2025 — could bring drought to US Midwest, floods to Australia.',
        impact: 'Crop yield uncertainty across hemisphere. Agri commodity volatility.',
    },
];

// ── Regional Risk Assessment ────────────────────────────────

export const REGION_RISKS: RegionRisk[] = [
    {
        region: 'Middle East', emoji: '🏜️', riskScore: 82, trend: 'rising',
        keyCommodities: ['Crude Oil', 'Natural Gas', 'Gold'],
        description: 'Elevated risk from Red Sea disruptions, Iran tensions, and OPEC politics.',
    },
    {
        region: 'Eastern Europe', emoji: '🇺🇦', riskScore: 88, trend: 'stable',
        keyCommodities: ['Natural Gas', 'Wheat', 'Palladium', 'Nickel'],
        description: 'Russia-Ukraine conflict ongoing. EU energy diversification progressing but not complete.',
    },
    {
        region: 'Central Africa', emoji: '🌍', riskScore: 65, trend: 'rising',
        keyCommodities: ['Cobalt', 'Copper', 'Gold'],
        description: 'DRC instability threatens critical mineral supply. Artisanal mining disruptions.',
    },
    {
        region: 'South America', emoji: '🌎', riskScore: 42, trend: 'stable',
        keyCommodities: ['Copper', 'Soybeans', 'Coffee', 'Lithium'],
        description: 'Chile copper regulations, Brazilian deforestation policies. Generally stable.',
    },
    {
        region: 'Asia-Pacific', emoji: '🌏', riskScore: 55, trend: 'rising',
        keyCommodities: ['Copper', 'Aluminium', 'Nickel', 'Cotton'],
        description: 'US-China trade tensions, Taiwan strait risk, Chinese demand uncertainty.',
    },
    {
        region: 'North America', emoji: '🇺🇸', riskScore: 25, trend: 'stable',
        keyCommodities: ['Crude Oil', 'Natural Gas', 'Corn', 'Wheat'],
        description: 'Stable production environment. Policy risk from energy transition mandates.',
    },
    {
        region: 'South Asia', emoji: '🇮🇳', riskScore: 35, trend: 'falling',
        keyCommodities: ['Gold', 'Silver', 'Cotton', 'Sugar'],
        description: 'India stabilizing imports with duty cuts. Strong domestic consumption.',
    },
];

// ── OPEC+ Members ───────────────────────────────────────────

export const OPEC_MEMBERS: OPECMember[] = [
    { country: 'Saudi Arabia', flag: '🇸🇦', quota: 10.5, production: 9.0, compliance: 86 },
    { country: 'Russia', flag: '🇷🇺', quota: 10.5, production: 9.4, compliance: 90 },
    { country: 'Iraq', flag: '🇮🇶', quota: 4.4, production: 4.3, compliance: 98 },
    { country: 'UAE', flag: '🇦🇪', quota: 3.2, production: 3.0, compliance: 94 },
    { country: 'Kuwait', flag: '🇰🇼', quota: 2.7, production: 2.5, compliance: 93 },
    { country: 'Nigeria', flag: '🇳🇬', quota: 1.5, production: 1.3, compliance: 87 },
    { country: 'Algeria', flag: '🇩🇿', quota: 1.0, production: 0.95, compliance: 95 },
    { country: 'Angola', flag: '🇦🇴', quota: 1.3, production: 1.1, compliance: 85 },
    { country: 'Kazakhstan', flag: '🇰🇿', quota: 1.6, production: 1.7, compliance: 106 },
    { country: 'Libya', flag: '🇱🇾', quota: 1.2, production: 1.2, compliance: 100 },
];

// ── Severity colors ──────────────────────────────────────────

export const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    critical: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.4)' },
    high: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.4)' },
    medium: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.4)' },
    low: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', border: 'rgba(34, 197, 94, 0.4)' },
};
