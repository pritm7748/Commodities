// ════════════════════════════════════════════════════════════
// Macroeconomic Reference Data — Key Indicators & Calendar
// ════════════════════════════════════════════════════════════

export interface MacroIndicator {
    name: string;
    value: string;
    previous: string;
    change: 'up' | 'down' | 'flat';
    unit: string;
    source: string;
    lastUpdate: string;
    impact: string; // brief commodity impact
    icon: string;
}

export interface EconomicEvent {
    date: string;
    time: string;
    event: string;
    country: string;
    flag: string;
    importance: 'high' | 'medium' | 'low';
    forecast?: string;
    previous?: string;
    commodityImpact: string;
}

export interface InterestRateData {
    centralBank: string;
    country: string;
    flag: string;
    rate: number;
    previousRate: number;
    nextMeeting: string;
    expectation: string;
}

// ── Key Macro Indicators (latest reference data) ────────────

export const MACRO_INDICATORS: MacroIndicator[] = [
    {
        name: 'US GDP Growth', value: '2.8%', previous: '3.1%', change: 'down', unit: 'QoQ annualized',
        source: 'BEA', lastUpdate: 'Q4 2024', icon: '📊',
        impact: 'Slowing growth — neutral to bearish for industrial metals, mildly bullish Gold.',
    },
    {
        name: 'US CPI Inflation', value: '2.9%', previous: '2.7%', change: 'up', unit: 'YoY',
        source: 'BLS', lastUpdate: 'Jan 2025', icon: '📈',
        impact: 'Rising inflation — bullish Gold & Silver as inflation hedge. Delays Fed cuts.',
    },
    {
        name: 'Fed Funds Rate', value: '4.25-4.50%', previous: '4.50-4.75%', change: 'down', unit: 'target range',
        source: 'Federal Reserve', lastUpdate: 'Dec 2024', icon: '🏛️',
        impact: 'Rate cuts underway — bullish Gold, supports commodity demand via cheaper financing.',
    },
    {
        name: 'US Unemployment', value: '4.0%', previous: '4.2%', change: 'down', unit: '%',
        source: 'BLS', lastUpdate: 'Jan 2025', icon: '👷',
        impact: 'Tight labor market — supports consumer spending and commodity demand.',
    },
    {
        name: 'US PMI Manufacturing', value: '49.2', previous: '49.3', change: 'down', unit: 'index',
        source: 'ISM', lastUpdate: 'Jan 2025', icon: '🏭',
        impact: 'Below 50 = contraction. Bearish for industrial metals (Copper, Aluminium).',
    },
    {
        name: 'China PMI Manufacturing', value: '50.1', previous: '50.3', change: 'down', unit: 'index',
        source: 'NBS', lastUpdate: 'Jan 2025', icon: '🇨🇳',
        impact: 'Barely expanding. Key for Copper, Iron Ore, and base metals demand.',
    },
    {
        name: 'India GDP Growth', value: '6.7%', previous: '7.6%', change: 'down', unit: 'YoY',
        source: 'MoSPI', lastUpdate: 'Q3 FY25', icon: '🇮🇳',
        impact: 'Solid growth supports Gold/Silver demand (festivals/weddings) and energy imports.',
    },
    {
        name: 'US 10Y Treasury Yield', value: '4.52%', previous: '4.57%', change: 'down', unit: '%',
        source: 'US Treasury', lastUpdate: 'Feb 2025', icon: '📉',
        impact: 'Lower yields — bullish Gold (reduces opportunity cost of holding non-yielding gold).',
    },
    {
        name: 'US Dollar Index (DXY)', value: '104.2', previous: '103.8', change: 'up', unit: 'index',
        source: 'ICE', lastUpdate: 'Feb 2025', icon: '💵',
        impact: 'Stronger dollar — headwind for all commodities priced in USD.',
    },
    {
        name: 'VIX (Fear Index)', value: '15.8', previous: '14.5', change: 'up', unit: 'index',
        source: 'CBOE', lastUpdate: 'Feb 2025', icon: '😰',
        impact: 'Rising volatility — bullish Gold as safe haven. Risk-off sentiment.',
    },
];

// ── Interest Rate Dashboard ─────────────────────────────────

export const INTEREST_RATES: InterestRateData[] = [
    { centralBank: 'Federal Reserve', country: 'USA', flag: '🇺🇸', rate: 4.375, previousRate: 4.625, nextMeeting: 'Mar 19, 2025', expectation: 'Hold (78% probability)' },
    { centralBank: 'ECB', country: 'Eurozone', flag: '🇪🇺', rate: 2.90, previousRate: 3.15, nextMeeting: 'Mar 6, 2025', expectation: 'Cut 25bps (65%)' },
    { centralBank: 'Bank of England', country: 'UK', flag: '🇬🇧', rate: 4.50, previousRate: 4.75, nextMeeting: 'Mar 20, 2025', expectation: 'Hold (70%)' },
    { centralBank: 'Bank of Japan', country: 'Japan', flag: '🇯🇵', rate: 0.50, previousRate: 0.25, nextMeeting: 'Mar 14, 2025', expectation: 'Hold (85%)' },
    { centralBank: 'RBI', country: 'India', flag: '🇮🇳', rate: 6.25, previousRate: 6.50, nextMeeting: 'Apr 9, 2025', expectation: 'Cut 25bps (60%)' },
    { centralBank: "People's Bank of China", country: 'China', flag: '🇨🇳', rate: 3.10, previousRate: 3.35, nextMeeting: 'Mar 2025', expectation: 'Cut 10bps (50%)' },
];

// ── Economic Calendar (upcoming events) ─────────────────────

export const ECONOMIC_CALENDAR: EconomicEvent[] = [
    { date: 'Feb 21', time: '14:45', event: 'US Manufacturing PMI (Flash)', country: 'US', flag: '🇺🇸', importance: 'high', forecast: '49.5', previous: '49.2', commodityImpact: 'Industrial metals, Crude' },
    { date: 'Feb 25', time: '15:00', event: 'US Consumer Confidence', country: 'US', flag: '🇺🇸', importance: 'medium', forecast: '103.0', previous: '104.1', commodityImpact: 'Gold, Oil' },
    { date: 'Feb 26', time: '13:30', event: 'US Durable Goods Orders', country: 'US', flag: '🇺🇸', importance: 'medium', forecast: '-0.8%', previous: '-2.2%', commodityImpact: 'Copper, Aluminium' },
    { date: 'Feb 27', time: '13:30', event: 'US GDP Revision (Q4)', country: 'US', flag: '🇺🇸', importance: 'high', forecast: '2.8%', previous: '3.1%', commodityImpact: 'Broad commodity impact' },
    { date: 'Feb 28', time: '13:30', event: 'US PCE Inflation (Fed preferred)', country: 'US', flag: '🇺🇸', importance: 'high', forecast: '2.6%', previous: '2.6%', commodityImpact: 'Gold, Silver — Fed rate path' },
    { date: 'Mar 1', time: '01:30', event: 'China Manufacturing PMI', country: 'CN', flag: '🇨🇳', importance: 'high', forecast: '50.0', previous: '50.1', commodityImpact: 'Copper, Iron Ore, Aluminium' },
    { date: 'Mar 3', time: '15:00', event: 'US ISM Manufacturing', country: 'US', flag: '🇺🇸', importance: 'high', forecast: '49.5', previous: '49.2', commodityImpact: 'Industrial metals' },
    { date: 'Mar 5', time: '13:15', event: 'US ADP Employment', country: 'US', flag: '🇺🇸', importance: 'medium', forecast: '160k', previous: '183k', commodityImpact: 'Gold, DXY impact' },
    { date: 'Mar 6', time: '13:15', event: 'ECB Rate Decision', country: 'EU', flag: '🇪🇺', importance: 'high', forecast: 'Cut 25bps', previous: '2.90%', commodityImpact: 'EUR/USD → all commodities' },
    { date: 'Mar 7', time: '13:30', event: 'US Non-Farm Payrolls', country: 'US', flag: '🇺🇸', importance: 'high', forecast: '175k', previous: '256k', commodityImpact: 'Gold, DXY, broad impact' },
];
