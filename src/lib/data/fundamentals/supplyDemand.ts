// ════════════════════════════════════════════════════════════
// Supply–Demand Fundamentals — Curated Reference Data
// Sources: USGS, World Gold Council, IEA, ICSG, USDA, etc.
// ════════════════════════════════════════════════════════════

export interface SupplyDemandItem {
    commodity: string;
    commodityId: string;
    year: number;
    supply: number;       // in standard units (tonnes, mmbbl, etc.)
    demand: number;
    surplus: number;       // supply - demand
    unit: string;
    inventoryWeeks: number; // weeks of consumption in storage
}

export interface ProducerData {
    commodity: string;
    commodityId: string;
    producers: { country: string; share: number; output: number; unit: string }[];
}

export interface InventoryData {
    commodity: string;
    commodityId: string;
    warehouses: { name: string; stocks: number; change: number; unit: string }[];
}

export interface TradeFlowData {
    commodity: string;
    commodityId: string;
    flows: { from: string; to: string; volume: number; unit: string }[];
}

// ── Supply-Demand Balances (2024-2025 estimates) ────────────

export const SUPPLY_DEMAND: SupplyDemandItem[] = [
    // Precious Metals
    { commodity: 'Gold', commodityId: 'gold-comex', year: 2025, supply: 4899, demand: 4974, surplus: -75, unit: 'tonnes', inventoryWeeks: 52 },
    { commodity: 'Silver', commodityId: 'silver-comex', year: 2025, supply: 31200, demand: 36400, surplus: -5200, unit: 'tonnes', inventoryWeeks: 18 },
    { commodity: 'Platinum', commodityId: 'platinum-nymex', year: 2025, supply: 190, demand: 242, surplus: -52, unit: 'tonnes', inventoryWeeks: 10 },

    // Energy
    { commodity: 'Crude Oil', commodityId: 'crude-wti', year: 2025, supply: 103.5, demand: 104.2, surplus: -0.7, unit: 'mmbbl/d', inventoryWeeks: 4.8 },
    { commodity: 'Natural Gas', commodityId: 'natgas-henry', year: 2025, supply: 104.3, demand: 102.8, surplus: 1.5, unit: 'bcf/d', inventoryWeeks: 8 },

    // Base Metals
    { commodity: 'Copper', commodityId: 'copper-lme', year: 2025, supply: 26100, demand: 26800, surplus: -700, unit: 'kt', inventoryWeeks: 3.2 },
    { commodity: 'Aluminium', commodityId: 'aluminium-lme', year: 2025, supply: 70400, demand: 70100, surplus: 300, unit: 'kt', inventoryWeeks: 6.5 },
    { commodity: 'Zinc', commodityId: 'zinc-lme', year: 2025, supply: 13800, demand: 14050, surplus: -250, unit: 'kt', inventoryWeeks: 4.1 },
    { commodity: 'Nickel', commodityId: 'nickel-lme', year: 2025, supply: 3450, demand: 3380, surplus: 70, unit: 'kt', inventoryWeeks: 9.2 },

    // Agriculture
    { commodity: 'Wheat', commodityId: 'wheat-cbot', year: 2025, supply: 793, demand: 800, surplus: -7, unit: 'mt', inventoryWeeks: 16 },
    { commodity: 'Corn', commodityId: 'corn-cbot', year: 2025, supply: 1225, demand: 1210, surplus: 15, unit: 'mt', inventoryWeeks: 12 },
    { commodity: 'Soybeans', commodityId: 'soybean-cbot', year: 2025, supply: 398, demand: 391, surplus: 7, unit: 'mt', inventoryWeeks: 10 },
    { commodity: 'Cotton', commodityId: 'cotton-ice', year: 2025, supply: 25.2, demand: 25.8, surplus: -0.6, unit: 'mt', inventoryWeeks: 14 },
];

// ── Top Producers by Commodity ──────────────────────────────

export const TOP_PRODUCERS: ProducerData[] = [
    {
        commodity: 'Gold', commodityId: 'gold-comex',
        producers: [
            { country: 'China', share: 11.2, output: 370, unit: 't' },
            { country: 'Australia', share: 9.7, output: 310, unit: 't' },
            { country: 'Russia', share: 9.4, output: 300, unit: 't' },
            { country: 'Canada', share: 6.3, output: 200, unit: 't' },
            { country: 'USA', share: 5.6, output: 180, unit: 't' },
            { country: 'Ghana', share: 4.1, output: 130, unit: 't' },
            { country: 'Mexico', share: 3.4, output: 110, unit: 't' },
            { country: 'South Africa', share: 3.1, output: 100, unit: 't' },
        ],
    },
    {
        commodity: 'Silver', commodityId: 'silver-comex',
        producers: [
            { country: 'Mexico', share: 23.8, output: 6300, unit: 't' },
            { country: 'China', share: 13.2, output: 3500, unit: 't' },
            { country: 'Peru', share: 11.7, output: 3100, unit: 't' },
            { country: 'Chile', share: 5.3, output: 1400, unit: 't' },
            { country: 'Australia', share: 4.9, output: 1300, unit: 't' },
            { country: 'Poland', share: 4.9, output: 1300, unit: 't' },
            { country: 'Russia', share: 4.5, output: 1200, unit: 't' },
        ],
    },
    {
        commodity: 'Crude Oil', commodityId: 'crude-wti',
        producers: [
            { country: 'USA', share: 19.5, output: 20.1, unit: 'mmbbl/d' },
            { country: 'Saudi Arabia', share: 10.5, output: 10.8, unit: 'mmbbl/d' },
            { country: 'Russia', share: 10.1, output: 10.4, unit: 'mmbbl/d' },
            { country: 'Canada', share: 5.4, output: 5.6, unit: 'mmbbl/d' },
            { country: 'Iraq', share: 4.5, output: 4.6, unit: 'mmbbl/d' },
            { country: 'China', share: 4.0, output: 4.1, unit: 'mmbbl/d' },
            { country: 'UAE', share: 3.9, output: 4.0, unit: 'mmbbl/d' },
            { country: 'Brazil', share: 3.4, output: 3.5, unit: 'mmbbl/d' },
        ],
    },
    {
        commodity: 'Copper', commodityId: 'copper-lme',
        producers: [
            { country: 'Chile', share: 24.5, output: 5700, unit: 'kt' },
            { country: 'Peru', share: 10.3, output: 2400, unit: 'kt' },
            { country: 'DRC', share: 10.1, output: 2350, unit: 'kt' },
            { country: 'China', share: 8.2, output: 1900, unit: 'kt' },
            { country: 'USA', share: 5.2, output: 1200, unit: 'kt' },
            { country: 'Indonesia', share: 4.3, output: 1000, unit: 'kt' },
            { country: 'Australia', share: 3.9, output: 900, unit: 'kt' },
        ],
    },
    {
        commodity: 'Natural Gas', commodityId: 'natgas-henry',
        producers: [
            { country: 'USA', share: 25.1, output: 103, unit: 'bcf/d' },
            { country: 'Russia', share: 15.8, output: 65, unit: 'bcf/d' },
            { country: 'Iran', share: 6.5, output: 27, unit: 'bcf/d' },
            { country: 'China', share: 5.5, output: 23, unit: 'bcf/d' },
            { country: 'Qatar', share: 4.5, output: 19, unit: 'bcf/d' },
            { country: 'Canada', share: 4.1, output: 17, unit: 'bcf/d' },
            { country: 'Australia', share: 3.7, output: 15, unit: 'bcf/d' },
        ],
    },
    {
        commodity: 'Wheat', commodityId: 'wheat-cbot',
        producers: [
            { country: 'China', share: 17.4, output: 138, unit: 'mt' },
            { country: 'India', share: 14.2, output: 113, unit: 'mt' },
            { country: 'Russia', share: 11.3, output: 90, unit: 'mt' },
            { country: 'USA', share: 5.9, output: 47, unit: 'mt' },
            { country: 'France', share: 4.8, output: 38, unit: 'mt' },
            { country: 'Canada', share: 4.4, output: 35, unit: 'mt' },
            { country: 'Ukraine', share: 3.2, output: 25, unit: 'mt' },
            { country: 'Australia', share: 3.0, output: 24, unit: 'mt' },
        ],
    },
    {
        commodity: 'Aluminium', commodityId: 'aluminium-lme',
        producers: [
            { country: 'China', share: 58.0, output: 40800, unit: 'kt' },
            { country: 'India', share: 5.7, output: 4000, unit: 'kt' },
            { country: 'Russia', share: 5.3, output: 3700, unit: 'kt' },
            { country: 'Canada', share: 4.3, output: 3000, unit: 'kt' },
            { country: 'UAE', share: 3.6, output: 2500, unit: 'kt' },
            { country: 'Australia', share: 2.3, output: 1600, unit: 'kt' },
        ],
    },
];

// ── Warehouse Inventory Data ────────────────────────────────

export const INVENTORY_DATA: InventoryData[] = [
    {
        commodity: 'Gold', commodityId: 'gold-comex',
        warehouses: [
            { name: 'COMEX Registered', stocks: 8.92, change: -2.1, unit: 'moz' },
            { name: 'COMEX Eligible', stocks: 14.35, change: -5.3, unit: 'moz' },
            { name: 'LBMA Vaults', stocks: 274, change: -12, unit: 'moz' },
        ],
    },
    {
        commodity: 'Silver', commodityId: 'silver-comex',
        warehouses: [
            { name: 'COMEX Registered', stocks: 32.4, change: -8.5, unit: 'moz' },
            { name: 'COMEX Eligible', stocks: 258.1, change: -15.2, unit: 'moz' },
            { name: 'LBMA Vaults', stocks: 876, change: -22, unit: 'moz' },
        ],
    },
    {
        commodity: 'Copper', commodityId: 'copper-lme',
        warehouses: [
            { name: 'LME Warehouses', stocks: 112, change: -28, unit: 'kt' },
            { name: 'COMEX', stocks: 22.4, change: -5.1, unit: 'kt' },
            { name: 'Shanghai (SHFE)', stocks: 65.3, change: 12, unit: 'kt' },
        ],
    },
    {
        commodity: 'Aluminium', commodityId: 'aluminium-lme',
        warehouses: [
            { name: 'LME Warehouses', stocks: 478, change: -45, unit: 'kt' },
            { name: 'Shanghai (SHFE)', stocks: 215, change: 18, unit: 'kt' },
        ],
    },
    {
        commodity: 'Crude Oil', commodityId: 'crude-wti',
        warehouses: [
            { name: 'Cushing, OK', stocks: 24.3, change: -2.8, unit: 'mmbbls' },
            { name: 'US Total Commercial', stocks: 427, change: -5.1, unit: 'mmbbls' },
            { name: 'Strategic Reserve (SPR)', stocks: 395, change: 0, unit: 'mmbbls' },
        ],
    },
    {
        commodity: 'Natural Gas', commodityId: 'natgas-henry',
        warehouses: [
            { name: 'US Working Gas', stocks: 2180, change: -110, unit: 'bcf' },
            { name: 'EU Storage', stocks: 680, change: -85, unit: 'bcf' },
        ],
    },
    {
        commodity: 'Zinc', commodityId: 'zinc-lme',
        warehouses: [
            { name: 'LME Warehouses', stocks: 87, change: -12, unit: 'kt' },
            { name: 'Shanghai (SHFE)', stocks: 44, change: 3, unit: 'kt' },
        ],
    },
];

// ── Trade Flows ─────────────────────────────────────────────

export const TRADE_FLOWS: TradeFlowData[] = [
    {
        commodity: 'Gold', commodityId: 'gold-comex',
        flows: [
            { from: 'Switzerland', to: 'India', volume: 680, unit: 't' },
            { from: 'Switzerland', to: 'China', volume: 510, unit: 't' },
            { from: 'Australia', to: 'Switzerland', volume: 180, unit: 't' },
            { from: 'USA', to: 'Switzerland', volume: 150, unit: 't' },
            { from: 'South Africa', to: 'UAE', volume: 45, unit: 't' },
            { from: 'UAE', to: 'India', volume: 140, unit: 't' },
        ],
    },
    {
        commodity: 'Crude Oil', commodityId: 'crude-wti',
        flows: [
            { from: 'Saudi Arabia', to: 'China', volume: 1.8, unit: 'mmbbl/d' },
            { from: 'Russia', to: 'China', volume: 2.1, unit: 'mmbbl/d' },
            { from: 'Russia', to: 'India', volume: 1.9, unit: 'mmbbl/d' },
            { from: 'Iraq', to: 'India', volume: 1.1, unit: 'mmbbl/d' },
            { from: 'Saudi Arabia', to: 'India', volume: 0.8, unit: 'mmbbl/d' },
            { from: 'USA', to: 'Europe', volume: 3.5, unit: 'mmbbl/d' },
            { from: 'Canada', to: 'USA', volume: 3.9, unit: 'mmbbl/d' },
        ],
    },
    {
        commodity: 'Copper', commodityId: 'copper-lme',
        flows: [
            { from: 'Chile', to: 'China', volume: 2100, unit: 'kt' },
            { from: 'Peru', to: 'China', volume: 1200, unit: 'kt' },
            { from: 'DRC', to: 'China', volume: 850, unit: 'kt' },
            { from: 'Australia', to: 'China', volume: 450, unit: 'kt' },
            { from: 'Chile', to: 'Japan', volume: 380, unit: 'kt' },
            { from: 'Chile', to: 'Europe', volume: 520, unit: 'kt' },
        ],
    },
    {
        commodity: 'Natural Gas', commodityId: 'natgas-henry',
        flows: [
            { from: 'Qatar', to: 'Asia', volume: 10.8, unit: 'bcf/d' },
            { from: 'Australia', to: 'Asia', volume: 10.2, unit: 'bcf/d' },
            { from: 'USA', to: 'Europe', volume: 6.5, unit: 'bcf/d' },
            { from: 'Russia', to: 'Europe', volume: 4.2, unit: 'bcf/d' },
            { from: 'USA', to: 'Asia', volume: 4.8, unit: 'bcf/d' },
        ],
    },
    {
        commodity: 'Wheat', commodityId: 'wheat-cbot',
        flows: [
            { from: 'Russia', to: 'Egypt', volume: 8.5, unit: 'mt' },
            { from: 'Russia', to: 'Turkey', volume: 5.2, unit: 'mt' },
            { from: 'USA', to: 'Japan', volume: 3.1, unit: 'mt' },
            { from: 'Canada', to: 'Indonesia', volume: 2.8, unit: 'mt' },
            { from: 'Australia', to: 'Indonesia', volume: 4.5, unit: 'mt' },
            { from: 'France', to: 'Algeria', volume: 3.8, unit: 'mt' },
        ],
    },
];

// ── Sector color mapping ────────────────────────────────────

export const COMMODITY_COLORS: Record<string, string> = {
    'gold-comex': '#FFD700',
    'silver-comex': '#C0C0C0',
    'platinum-nymex': '#E5E4E2',
    'crude-wti': '#2D2D2D',
    'natgas-henry': '#4ECDC4',
    'copper-lme': '#B87333',
    'aluminium-lme': '#848789',
    'zinc-lme': '#7D8E9E',
    'nickel-lme': '#727472',
    'wheat-cbot': '#DEB887',
    'corn-cbot': '#FFE135',
    'soybean-cbot': '#8B7D3C',
    'cotton-ice': '#FEFEFA',
};
