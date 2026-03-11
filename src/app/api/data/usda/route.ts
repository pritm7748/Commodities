import { NextResponse } from 'next/server';

// ── USDA FAS OpenData API ───────────────────────────────────
// Host: api.fas.usda.gov
// Auth: X-Api-Key header
// PSD endpoints:
//   /api/psd/commodity/{code}/world/year/{marketYear}         — World aggregate
//   /api/psd/commodity/{code}/country/all/year/{marketYear}   — All countries
//   /api/psd/commodity/{code}/country/{cc}/year/{marketYear}  — Single country
//   /api/psd/commodities                                      — Commodity list
//   /api/psd/commodityAttributes                               — Attribute ID map
// GATS endpoints:
//   /api/gats/commodities, countries, regions
//   /api/gats/UNTradeExports/reporterCode/{cc}/year/{year}
//   /api/gats/UNTradeImports/reporterCode/{cc}/year/{year}
// ESR endpoints:
//   /api/esr/exports/commodityCode/{code}/allCountries/marketYear/{year}

const USDA_BASE = 'https://api.fas.usda.gov';

// PSD Commodity codes for key agricultural commodities
const COMMODITY_CODES: Record<string, string> = {
    wheat: '0410000',
    corn: '0440000',
    rice: '0422110',
    soybeans: '2222000',
    cotton: '2631000',
    sugar: '0612000',
    coffee: '0711100',
};

// PSD Attribute IDs — from /api/psd/commodityAttributes
const ATTR = {
    BEGINNING_STOCKS: 20,
    PRODUCTION: 28,
    IMPORTS: 57,
    TOTAL_SUPPLY: 86,
    EXPORTS: 88,
    DOM_CONSUMPTION: 125,       // Grains, oilseeds
    TOTAL_DISAPPEARANCE_ALT: 126, // Sugar (Total Disappearance)
    FEED_DOM_CONSUMPTION: 130,
    HUMAN_DOM_CONSUMPTION: 139,  // Sugar (Human Dom. Consumption)
    DOM_USE: 142,               // Cotton, some others
    TOTAL_USE: 174,             // Fallback
    TOTAL_DISAPPEARANCE: 173,   // Fallback
    ENDING_STOCKS: 176,
    TOTAL_DISTRIBUTION: 178,
    YIELD: 184,
};

// ── USDA WASDE Reference Data (Feb 2025 estimates, 1000 MT unless noted) ──
const REFERENCE_DATA: Record<string, {
    production: number; consumption: number; exports: number;
    imports: number; endingStocks: number; beginningStocks: number;
    unit: string;
}> = {
    wheat: {
        production: 789541, consumption: 800836, exports: 216053,
        imports: 214389, endingStocks: 258829, beginningStocks: 269632,
        unit: '1000 MT',
    },
    corn: {
        production: 1218712, consumption: 1224949, exports: 196974,
        imports: 193421, endingStocks: 293226, beginningStocks: 299463,
        unit: '1000 MT',
    },
    rice: {
        production: 518260, consumption: 523540, exports: 57316,
        imports: 56483, endingStocks: 169614, beginningStocks: 174894,
        unit: '1000 MT',
    },
    soybeans: {
        production: 420878, consumption: 397032, exports: 175291,
        imports: 173420, endingStocks: 134240, beginningStocks: 112265,
        unit: '1000 MT',
    },
    cotton: {
        production: 25616, consumption: 24877, exports: 9814,
        imports: 9704, endingStocks: 17256, beginningStocks: 16627,
        unit: '1000 480lb Bales',
    },
    sugar: {
        production: 186347, consumption: 179498, exports: 66893,
        imports: 65942, endingStocks: 52947, beginningStocks: 47049,
        unit: '1000 MT',
    },
    coffee: {
        production: 174200, consumption: 170500, exports: 83100,
        imports: 82750, endingStocks: 34200, beginningStocks: 30850,
        unit: '1000 60kg Bags',
    },
};

function makeHeaders(apiKey: string): Record<string, string> {
    return {
        'Accept': 'application/json',
        'X-Api-Key': apiKey,
    };
}

export async function GET(request: Request) {
    const apiKey = process.env.USDA_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'USDA_API_KEY not configured in .env.local' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint') || 'psd';
    const commodity = searchParams.get('commodity') || 'wheat';
    const marketYear = searchParams.get('year') || new Date().getFullYear().toString();
    const headers = makeHeaders(apiKey);

    try {
        // ── PSD: Single commodity world data ────────────────
        if (endpoint === 'psd') {
            const code = COMMODITY_CODES[commodity.toLowerCase()] || commodity;
            const url = `${USDA_BASE}/api/psd/commodity/${code}/world/year/${marketYear}`;

            try {
                const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
                if (res.ok) {
                    const data = await res.json();
                    return NextResponse.json({ status: 'success', source: 'live', commodity, commodityCode: code, marketYear, totalRecords: data.length, data });
                }
            } catch { /* fall through */ }

            const ref = REFERENCE_DATA[commodity.toLowerCase()];
            if (ref) return NextResponse.json({ status: 'success', source: 'reference', commodity, marketYear: '2024/25', note: 'USDA FAS API unavailable — using latest WASDE estimates', data: ref });
            return NextResponse.json({ error: `Unknown commodity: ${commodity}` }, { status: 400 });
        }

        // ── PSD: All tracked commodities summary (world level) ──
        if (endpoint === 'all-commodities-summary') {
            const year = parseInt(marketYear);
            const results: any[] = [];
            let overallSource = 'reference';

            for (const [name, code] of Object.entries(COMMODITY_CODES)) {
                let usedLive = false;

                try {
                    const url = `${USDA_BASE}/api/psd/commodity/${code}/world/year/${year}`;
                    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });

                    if (res.ok) {
                        const rawData = await res.json();

                        if (Array.isArray(rawData) && rawData.length > 0) {
                            const getVal = (attrId: number): number => {
                                const row = rawData.find((d: any) => d.attributeId === attrId);
                                return row ? parseFloat(row.value) || 0 : 0;
                            };

                            const production = getVal(ATTR.PRODUCTION);
                            // Try multiple consumption attributes: grains use 125, cotton uses 142, sugar uses 139
                            const consumption = getVal(ATTR.DOM_CONSUMPTION) || getVal(ATTR.DOM_USE) || getVal(ATTR.HUMAN_DOM_CONSUMPTION) || getVal(ATTR.TOTAL_DISAPPEARANCE_ALT) || getVal(ATTR.TOTAL_USE) || getVal(ATTR.TOTAL_DISAPPEARANCE);
                            const exports = getVal(ATTR.EXPORTS);
                            const imports = getVal(ATTR.IMPORTS);
                            const beginningStocks = getVal(ATTR.BEGINNING_STOCKS);
                            const endingStocks = getVal(ATTR.ENDING_STOCKS);
                            const totalSupply = getVal(ATTR.TOTAL_SUPPLY);
                            const feedConsumption = getVal(ATTR.FEED_DOM_CONSUMPTION);

                            // Determine unit from unitId (4 = 1000 MT, 21 = 1000 480lb Bales, 26 = 1000 60kg Bags)
                            const unitId = rawData[0]?.unitId;
                            let unit = '1000 MT';
                            if (unitId === 21) unit = '1000 480lb Bales';
                            else if (unitId === 26) unit = '1000 60kg Bags';

                            if (production > 0 || consumption > 0) {
                                results.push({
                                    commodity: name.charAt(0).toUpperCase() + name.slice(1),
                                    commodityCode: code,
                                    marketYear: year,
                                    unit,
                                    production,
                                    consumption,
                                    feedConsumption,
                                    exports,
                                    imports,
                                    beginningStocks,
                                    endingStocks,
                                    totalSupply,
                                    surplus: production - consumption,
                                    stocksToUseRatio: consumption > 0
                                        ? ((endingStocks / consumption) * 100).toFixed(1)
                                        : 'N/A',
                                    source: 'live',
                                });
                                usedLive = true;
                                overallSource = 'live';
                            }
                        }
                    }
                } catch {
                    // Live fetch failed — fall through to reference
                }

                if (!usedLive) {
                    const ref = REFERENCE_DATA[name];
                    if (ref) {
                        results.push({
                            commodity: name.charAt(0).toUpperCase() + name.slice(1),
                            commodityCode: code,
                            marketYear: 2024,
                            unit: ref.unit,
                            production: ref.production,
                            consumption: ref.consumption,
                            exports: ref.exports,
                            imports: ref.imports,
                            beginningStocks: ref.beginningStocks,
                            endingStocks: ref.endingStocks,
                            surplus: ref.production - ref.consumption,
                            stocksToUseRatio: ref.consumption > 0
                                ? ((ref.endingStocks / ref.consumption) * 100).toFixed(1)
                                : 'N/A',
                            source: 'reference',
                        });
                    }
                }
            }

            return NextResponse.json({
                status: 'success',
                source: overallSource,
                marketYear: year,
                commodities: results,
                note: overallSource === 'reference'
                    ? 'USDA FAS API unavailable — showing WASDE estimates. Will auto-switch to live when API is back.'
                    : undefined,
            });
        }

        // ── PSD Commodities list ────────────────────────────
        if (endpoint === 'commodities') {
            const res = await fetch(`${USDA_BASE}/api/psd/commodities`, { headers, signal: AbortSignal.timeout(10000) });
            if (!res.ok) throw new Error(`USDA ${res.status}`);
            const data = await res.json();
            return NextResponse.json({ status: 'success', source: 'live', data });
        }

        // ── PSD Commodity Attributes ────────────────────────
        if (endpoint === 'attributes') {
            const res = await fetch(`${USDA_BASE}/api/psd/commodityAttributes`, { headers, signal: AbortSignal.timeout(10000) });
            if (!res.ok) throw new Error(`USDA ${res.status}`);
            const data = await res.json();
            return NextResponse.json({ status: 'success', source: 'live', data });
        }

        // ── GATS: Countries ─────────────────────────────────
        if (endpoint === 'gats-countries') {
            const res = await fetch(`${USDA_BASE}/api/gats/countries`, { headers, signal: AbortSignal.timeout(10000) });
            if (!res.ok) throw new Error(`USDA GATS ${res.status}`);
            const data = await res.json();
            return NextResponse.json({ status: 'success', source: 'live', data });
        }

        // ── GATS: Commodities ───────────────────────────────
        if (endpoint === 'gats-commodities') {
            const res = await fetch(`${USDA_BASE}/api/gats/commodities`, { headers, signal: AbortSignal.timeout(10000) });
            if (!res.ok) throw new Error(`USDA GATS ${res.status}`);
            const data = await res.json();
            return NextResponse.json({ status: 'success', source: 'live', data });
        }

        // ── GATS: UN Trade Exports ──────────────────────────
        if (endpoint === 'gats-exports') {
            const reporter = searchParams.get('reporter') || 'US';
            const yr = searchParams.get('year') || new Date().getFullYear().toString();
            const res = await fetch(
                `${USDA_BASE}/api/gats/UNTradeExports/reporterCode/${reporter}/year/${yr}`,
                { headers, signal: AbortSignal.timeout(10000) }
            );
            if (!res.ok) throw new Error(`USDA GATS ${res.status}`);
            const data = await res.json();
            return NextResponse.json({ status: 'success', source: 'live', data });
        }

        // ── GATS: UN Trade Imports ──────────────────────────
        if (endpoint === 'gats-imports') {
            const reporter = searchParams.get('reporter') || 'US';
            const yr = searchParams.get('year') || new Date().getFullYear().toString();
            const res = await fetch(
                `${USDA_BASE}/api/gats/UNTradeImports/reporterCode/${reporter}/year/${yr}`,
                { headers, signal: AbortSignal.timeout(10000) }
            );
            if (!res.ok) throw new Error(`USDA GATS ${res.status}`);
            const data = await res.json();
            return NextResponse.json({ status: 'success', source: 'live', data });
        }

        // ── ESR: Export Sales ───────────────────────────────
        if (endpoint === 'esr-exports') {
            const code = searchParams.get('code') || '101';
            const yr = searchParams.get('year') || new Date().getFullYear().toString();
            const res = await fetch(
                `${USDA_BASE}/api/esr/exports/commodityCode/${code}/allCountries/marketYear/${yr}`,
                { headers, signal: AbortSignal.timeout(10000) }
            );
            if (!res.ok) throw new Error(`USDA ESR ${res.status}`);
            const data = await res.json();
            return NextResponse.json({ status: 'success', source: 'live', data });
        }

        return NextResponse.json(
            { error: `Unknown endpoint: ${endpoint}. Use 'psd', 'all-commodities-summary', 'commodities', 'attributes', 'gats-countries', 'gats-commodities', 'gats-exports', 'gats-imports', 'esr-exports'.` },
            { status: 400 }
        );

    } catch (error: any) {
        console.error('[USDA] Route error:', error.message);
        return NextResponse.json({ error: 'Failed to fetch USDA data', message: error.message }, { status: 502 });
    }
}
