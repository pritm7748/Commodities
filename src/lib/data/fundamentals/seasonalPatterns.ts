// ════════════════════════════════════════════════════════════
// Seasonal Patterns — Historical Average Monthly Returns
// & Crop Calendar Data
// ════════════════════════════════════════════════════════════

export interface SeasonalPattern {
    commodity: string;
    commodityId: string;
    icon: string;
    monthlyReturns: number[]; // Jan-Dec average % returns
    bestMonth: string;
    worstMonth: string;
    seasonalBias: string; // brief description
}

export interface CropCalendarItem {
    crop: string;
    icon: string;
    region: string;
    plantingStart: number; // month (1-12)
    plantingEnd: number;
    harvestStart: number;
    harvestEnd: number;
    notes: string;
}

export interface WeatherRegion {
    name: string;
    lat: number;
    lon: number;
    commodities: string[];
    importance: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export { MONTHS };

// ── Seasonal price patterns (10-year averages) ──────────────

export const SEASONAL_PATTERNS: SeasonalPattern[] = [
    {
        commodity: 'Gold', commodityId: 'gold-comex', icon: '🥇',
        monthlyReturns: [2.1, 0.3, -0.8, 0.5, -0.2, 1.2, 0.8, 2.5, 1.8, -0.5, -0.3, 0.6],
        bestMonth: 'August', worstMonth: 'March',
        seasonalBias: 'Strong in Aug-Sep (Indian wedding season buying), weak in Mar (profit booking before fiscal year-end)',
    },
    {
        commodity: 'Silver', commodityId: 'silver-comex', icon: '🥈',
        monthlyReturns: [1.8, -0.5, -1.2, 0.8, -0.3, 1.5, 2.1, 3.2, 1.2, -1.0, -0.8, 0.5],
        bestMonth: 'August', worstMonth: 'March',
        seasonalBias: 'Follows Gold but more volatile. Industrial demand peaks in late summer.',
    },
    {
        commodity: 'Crude Oil', commodityId: 'crude-wti', icon: '🛢️',
        monthlyReturns: [1.5, -0.8, 2.1, 1.8, 0.5, -0.3, 0.8, -0.5, -1.2, 0.3, -1.5, 1.2],
        bestMonth: 'April', worstMonth: 'November',
        seasonalBias: 'Rally Mar-Apr (refinery maintenance ends, summer driving season ahead). Weak Nov (shoulder season).',
    },
    {
        commodity: 'Natural Gas', commodityId: 'natgas-henry', icon: '🔥',
        monthlyReturns: [-3.5, -2.8, -1.5, -0.8, 0.5, 1.2, 2.8, 1.5, 1.8, 3.5, 5.2, 2.1],
        bestMonth: 'November', worstMonth: 'January',
        seasonalBias: 'Strong Oct-Nov (winter heating demand expectations), weak Jan-Feb (demand priced in, warm weather risk).',
    },
    {
        commodity: 'Copper', commodityId: 'copper-lme', icon: '🔴',
        monthlyReturns: [1.2, 2.5, 0.8, 1.5, -0.3, -0.8, 0.5, -1.2, -0.5, 0.8, 0.3, -0.5],
        bestMonth: 'February', worstMonth: 'August',
        seasonalBias: 'Strong Q1 (Chinese restocking after Lunar New Year), weak summer (demand lull).',
    },
    {
        commodity: 'Wheat', commodityId: 'wheat-cbot', icon: '🌾',
        monthlyReturns: [-0.5, 0.8, 1.5, 2.8, 3.2, 1.8, -2.5, -1.8, -1.2, 0.5, 0.3, -0.8],
        bestMonth: 'May', worstMonth: 'July',
        seasonalBias: 'Rally Apr-Jun (weather premium, crop uncertainty). Collapse Jul (harvest pressure, new supply).',
    },
    {
        commodity: 'Corn', commodityId: 'corn-cbot', icon: '🌽',
        monthlyReturns: [-0.8, 0.5, 1.2, 2.1, 2.5, 3.8, -3.2, -2.1, -1.5, 0.3, 0.5, -0.5],
        bestMonth: 'June', worstMonth: 'July',
        seasonalBias: 'Strong May-Jun (pollination anxiety, weather risk). Sharp decline Jul-Aug (harvest confirms supply).',
    },
    {
        commodity: 'Cotton', commodityId: 'cotton-ice', icon: '🧵',
        monthlyReturns: [0.5, 1.2, 2.5, 1.8, 1.2, -0.5, -1.8, -0.8, -0.5, 1.5, 0.8, -0.3],
        bestMonth: 'March', worstMonth: 'July',
        seasonalBias: 'Rally Feb-Apr (planting decisions, acreage uncertainty). Weak Jul (US harvest approaching).',
    },
    {
        commodity: 'Aluminium', commodityId: 'aluminium-lme', icon: '⬜',
        monthlyReturns: [1.5, 1.8, 0.5, 0.8, -0.5, -1.2, 0.3, -0.8, 0.5, 0.8, -0.3, -0.5],
        bestMonth: 'February', worstMonth: 'June',
        seasonalBias: 'Strong early year (Chinese restocking). Weak mid-year (supply seasonally strong).',
    },
];

// ── Crop Calendar ───────────────────────────────────────────

export const CROP_CALENDAR: CropCalendarItem[] = [
    { crop: 'Wheat', icon: '🌾', region: 'US (Winter)', plantingStart: 9, plantingEnd: 11, harvestStart: 5, harvestEnd: 7, notes: 'HRW/SRW belt — Kansas, Oklahoma' },
    { crop: 'Wheat', icon: '🌾', region: 'India (Rabi)', plantingStart: 10, plantingEnd: 12, harvestStart: 3, harvestEnd: 4, notes: 'Punjab, Haryana, UP — MSP procurement' },
    { crop: 'Wheat', icon: '🌾', region: 'Australia', plantingStart: 4, plantingEnd: 6, harvestStart: 11, harvestEnd: 1, notes: 'WA, NSW — export-focused' },
    { crop: 'Corn', icon: '🌽', region: 'US Midwest', plantingStart: 4, plantingEnd: 5, harvestStart: 9, harvestEnd: 11, notes: 'Iowa, Illinois — 35% of global corn' },
    { crop: 'Corn', icon: '🌽', region: 'Brazil (Safrinha)', plantingStart: 1, plantingEnd: 3, harvestStart: 6, harvestEnd: 8, notes: 'Mato Grosso — 2nd crop after soy' },
    { crop: 'Soybeans', icon: '🫘', region: 'US Midwest', plantingStart: 5, plantingEnd: 6, harvestStart: 9, harvestEnd: 11, notes: 'Illinois, Iowa — CBOT benchmark' },
    { crop: 'Soybeans', icon: '🫘', region: 'Brazil', plantingStart: 9, plantingEnd: 11, harvestStart: 2, harvestEnd: 4, notes: 'Mato Grosso — worlds #1 producer' },
    { crop: 'Cotton', icon: '🧵', region: 'US (Delta/SW)', plantingStart: 3, plantingEnd: 5, harvestStart: 9, harvestEnd: 11, notes: 'Texas, Mississippi — ICE benchmark' },
    { crop: 'Cotton', icon: '🧵', region: 'India', plantingStart: 5, plantingEnd: 7, harvestStart: 10, harvestEnd: 2, notes: 'Gujarat, Maharashtra — #2 producer' },
    { crop: 'Sugar', icon: '🍬', region: 'Brazil (CS)', plantingStart: 3, plantingEnd: 4, harvestStart: 4, harvestEnd: 11, notes: 'São Paulo — 25% of global sugar' },
    { crop: 'Sugar', icon: '🍬', region: 'India', plantingStart: 10, plantingEnd: 12, harvestStart: 11, harvestEnd: 4, notes: 'UP, Maharashtra — world #2 producer' },
];

// ── Weather-sensitive regions for monitoring ─────────────────

export const WEATHER_REGIONS: WeatherRegion[] = [
    { name: 'US Midwest (Corn Belt)', lat: 41.5, lon: -93.0, commodities: ['Corn', 'Soybeans', 'Wheat'], importance: '35% of world corn, 30% of soybeans. Jun-Jul pollination critical.' },
    { name: 'Brazil (Mato Grosso)', lat: -12.6, lon: -55.6, commodities: ['Soybeans', 'Corn', 'Cotton'], importance: 'Worlds #1 soy producer. Dry season stress Dec-Feb critical.' },
    { name: 'India (Punjab/Haryana)', lat: 30.7, lon: 76.7, commodities: ['Wheat', 'Cotton', 'Sugar'], importance: 'Indias breadbasket. Mar-Apr heat stress during wheat harvest.' },
    { name: 'Australia (NSW/WA)', lat: -33.5, lon: 148.0, commodities: ['Wheat', 'Cotton'], importance: 'Major wheat exporter. La Niña brings floods, El Niño drought.' },
    { name: 'Middle East (Gulf)', lat: 25.3, lon: 51.5, commodities: ['Crude Oil', 'Natural Gas'], importance: 'Extreme heat impacts refinery ops and energy demand.' },
    { name: 'Northern Europe', lat: 52.5, lon: 5.0, commodities: ['Natural Gas', 'Wheat'], importance: 'EU gas storage and wheat production. Cold snaps drive gas prices.' },
    { name: 'Argentina (Pampas)', lat: -34.5, lon: -60.0, commodities: ['Soybeans', 'Corn', 'Wheat'], importance: 'Third largest soy exporter. Frequent drought stress.' },
    { name: 'West Africa (Cocoa Belt)', lat: 6.5, lon: -2.5, commodities: ['Cocoa', 'Coffee'], importance: '70% of world cocoa. Harmattan winds and disease critical.' },
];
