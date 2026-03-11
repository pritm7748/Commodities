import { NextResponse } from 'next/server';

// ── CFTC Commitment of Traders (COT) — Disaggregated Futures Only ───
// SODA API (free, no key needed):
// https://publicreporting.cftc.gov/resource/72hh-3qpy.json
//
// Field reference (disaggregated report):
//   prod_merc_positions_long / prod_merc_positions_short  — Producer/Merchant
//   swap_positions_long_all / swap__positions_short_all    — Swap Dealers
//   m_money_positions_long_all / m_money_positions_short_all — Managed Money
//   other_rept_positions_long / other_rept_positions_short — Other Reportable
//   nonrept_positions_long_all / nonrept_positions_short_all — Non-Reportable
//   open_interest_all — Total Open Interest
//   change_in_* — Weekly changes
//   pct_of_oi_* — As percentage of open interest

const CFTC_BASE = 'https://publicreporting.cftc.gov/resource/72hh-3qpy.json';

// Map our commodity names → CFTC contract_market_name values
const CFTC_CONTRACT_MAP: Record<string, { name: string; exchange: string }> = {
    gold: { name: 'GOLD', exchange: 'COMEX' },
    silver: { name: 'SILVER', exchange: 'COMEX' },
    copper: { name: 'COPPER-GRADE #1', exchange: 'COMEX' },
    crude: { name: 'CRUDE OIL, LIGHT SWEET', exchange: 'NYMEX' },
    'natural-gas': { name: 'NATURAL GAS', exchange: 'NYMEX' },
    wheat: { name: 'WHEAT-SRW', exchange: 'CBOT' },
    corn: { name: 'CORN', exchange: 'CBOT' },
    soybeans: { name: 'SOYBEANS', exchange: 'CBOT' },
    cotton: { name: 'COTTON NO. 2', exchange: 'ICE' },
    sugar: { name: 'SUGAR NO. 11', exchange: 'ICE' },
    coffee: { name: 'COFFEE C', exchange: 'ICE' },
    platinum: { name: 'PLATINUM', exchange: 'NYMEX' },
    palladium: { name: 'PALLADIUM', exchange: 'NYMEX' },
};

interface NormalizedCOTRecord {
    date: string;
    commodity: string;
    contractName: string;
    openInterest: number;
    // Producer/Merchant (Commercial Hedgers)
    prodLong: number;
    prodShort: number;
    prodNet: number;
    // Swap Dealers
    swapLong: number;
    swapShort: number;
    swapSpread: number;
    swapNet: number;
    // Managed Money (Hedge Funds/CTAs)
    mmLong: number;
    mmShort: number;
    mmSpread: number;
    mmNet: number;
    // Other Reportable
    otherLong: number;
    otherShort: number;
    otherSpread: number;
    otherNet: number;
    // Non-Reportable (Retail)
    nonreptLong: number;
    nonreptShort: number;
    nonreptNet: number;
    // Weekly changes
    changeOI: number;
    changeMMLong: number;
    changeMMShort: number;
    changeMMNet: number;
    changeProdLong: number;
    changeProdShort: number;
    changeProdNet: number;
    // Percentages of OI
    pctMMLong: number;
    pctMMShort: number;
    pctProdLong: number;
    pctProdShort: number;
}

function normalizeRecord(raw: any, commodity: string): NormalizedCOTRecord {
    const num = (v: any): number => parseFloat(v) || 0;
    const prodLong = num(raw.prod_merc_positions_long);
    const prodShort = num(raw.prod_merc_positions_short);
    const swapLong = num(raw.swap_positions_long_all);
    const swapShort = num(raw.swap__positions_short_all);
    const swapSpread = num(raw.swap__positions_spread_all);
    const mmLong = num(raw.m_money_positions_long_all);
    const mmShort = num(raw.m_money_positions_short_all);
    const mmSpread = num(raw.m_money_positions_spread);
    const otherLong = num(raw.other_rept_positions_long);
    const otherShort = num(raw.other_rept_positions_short);
    const otherSpread = num(raw.other_rept_positions_spread);
    const nonreptLong = num(raw.nonrept_positions_long_all);
    const nonreptShort = num(raw.nonrept_positions_short_all);

    const changeMMLong = num(raw.change_in_m_money_long_all);
    const changeMMShort = num(raw.change_in_m_money_short_all);
    const changeProdLong = num(raw.change_in_prod_merc_long);
    const changeProdShort = num(raw.change_in_prod_merc_short);

    return {
        date: raw.report_date_as_yyyy_mm_dd?.split('T')[0] || '',
        commodity,
        contractName: raw.contract_market_name || '',
        openInterest: num(raw.open_interest_all),
        prodLong, prodShort, prodNet: prodLong - prodShort,
        swapLong, swapShort, swapSpread, swapNet: swapLong - swapShort,
        mmLong, mmShort, mmSpread, mmNet: mmLong - mmShort,
        otherLong, otherShort, otherSpread, otherNet: otherLong - otherShort,
        nonreptLong, nonreptShort, nonreptNet: nonreptLong - nonreptShort,
        changeOI: num(raw.change_in_open_interest_all),
        changeMMLong, changeMMShort, changeMMNet: changeMMLong - changeMMShort,
        changeProdLong, changeProdShort, changeProdNet: changeProdLong - changeProdShort,
        pctMMLong: num(raw.pct_of_oi_m_money_long_all),
        pctMMShort: num(raw.pct_of_oi_m_money_short_all),
        pctProdLong: num(raw.pct_of_oi_prod_merc_long),
        pctProdShort: num(raw.pct_of_oi_prod_merc_short),
    };
}

function computeCOTIndex(records: NormalizedCOTRecord[]): number | null {
    if (records.length < 10) return null;
    // COT Index = (Current MM Net − 52W Low) / (52W High − 52W Low) × 100
    const nets = records.map(r => r.mmNet);
    const current = nets[0];
    const high = Math.max(...nets);
    const low = Math.min(...nets);
    if (high === low) return 50;
    return Math.round(((current - low) / (high - low)) * 100);
}

function classifyOIChange(priceChange: number, oiChange: number): { label: string; signal: string; emoji: string } {
    if (priceChange > 0 && oiChange > 0) return { label: 'New Longs', signal: 'bullish', emoji: '🟢' };
    if (priceChange > 0 && oiChange < 0) return { label: 'Short Covering', signal: 'weakly bullish', emoji: '🟡' };
    if (priceChange < 0 && oiChange > 0) return { label: 'New Shorts', signal: 'bearish', emoji: '🔴' };
    if (priceChange < 0 && oiChange < 0) return { label: 'Long Liquidation', signal: 'weakly bearish', emoji: '🟠' };
    return { label: 'Neutral', signal: 'neutral', emoji: '⚪' };
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint') || 'single';
    const commodity = searchParams.get('commodity') || 'gold';
    const weeks = parseInt(searchParams.get('weeks') || '52');

    try {
        // ── Single commodity COT data ───────────────────────
        if (endpoint === 'single') {
            const mapping = CFTC_CONTRACT_MAP[commodity.toLowerCase()];
            if (!mapping) {
                return NextResponse.json({
                    error: `Unknown commodity: ${commodity}`,
                    available: Object.keys(CFTC_CONTRACT_MAP),
                }, { status: 400 });
            }

            // Fetch N weeks of data
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - (weeks * 7 + 30)); // extra buffer
            const cutoff = cutoffDate.toISOString().split('T')[0];

            const where = `contract_market_name = '${mapping.name}' AND report_date_as_yyyy_mm_dd > '${cutoff}' AND futonly_or_combined = 'FutOnly'`;
            const url = `${CFTC_BASE}?$where=${encodeURIComponent(where)}&$limit=${weeks + 10}&$order=${encodeURIComponent('report_date_as_yyyy_mm_dd DESC')}`;

            const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
            if (!res.ok) throw new Error(`CFTC API returned ${res.status}`);

            const rawData = await res.json();
            if (!Array.isArray(rawData) || rawData.length === 0) {
                return NextResponse.json({ status: 'success', commodity, records: [], cotIndex: null, note: 'No COT data found for this commodity' });
            }

            const records = rawData.map((r: any) => normalizeRecord(r, commodity));
            const cotIndex = computeCOTIndex(records);

            // Compute commercial vs speculator divergence
            const latest = records[0];
            const commercialNet = latest.prodLong - latest.prodShort; // Producers = commercial hedgers
            const speculatorNet = latest.mmNet; // Managed money = speculators
            const isDiverging = (commercialNet > 0 && speculatorNet < 0) || (commercialNet < 0 && speculatorNet > 0);

            return NextResponse.json({
                status: 'success',
                source: 'live',
                commodity,
                contractName: latest.contractName,
                exchange: mapping.exchange,
                totalWeeks: records.length,
                latestDate: latest.date,
                cotIndex,
                cotIndexLabel: cotIndex !== null ? (
                    cotIndex >= 80 ? 'Extreme Bullish (contrarian bearish)' :
                        cotIndex >= 60 ? 'Bullish' :
                            cotIndex >= 40 ? 'Neutral' :
                                cotIndex >= 20 ? 'Bearish' :
                                    'Extreme Bearish (contrarian bullish)'
                ) : 'Insufficient data',
                divergence: {
                    isDiverging,
                    commercialNet,
                    speculatorNet,
                    signal: isDiverging ? 'Commercial/Speculator divergence detected' : 'Aligned',
                },
                latest,
                records,
            });
        }

        // ── Multi-commodity COT summary ────────────────────
        if (endpoint === 'summary') {
            const results: any[] = [];
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - (52 * 7 + 30));
            const cutoff = cutoffDate.toISOString().split('T')[0];

            for (const [name, mapping] of Object.entries(CFTC_CONTRACT_MAP)) {
                try {
                    const where = `contract_market_name = '${mapping.name}' AND report_date_as_yyyy_mm_dd > '${cutoff}' AND futonly_or_combined = 'FutOnly'`;
                    const url = `${CFTC_BASE}?$where=${encodeURIComponent(where)}&$limit=55&$order=${encodeURIComponent('report_date_as_yyyy_mm_dd DESC')}`;

                    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
                    if (!res.ok) continue;

                    const rawData = await res.json();
                    if (!Array.isArray(rawData) || rawData.length === 0) continue;

                    const records = rawData.map((r: any) => normalizeRecord(r, name));
                    const cotIndex = computeCOTIndex(records);
                    const latest = records[0];
                    const prev = records[1];

                    const commercialNet = latest.prodNet;
                    const speculatorNet = latest.mmNet;
                    const isDiverging = (commercialNet > 0 && speculatorNet < 0) || (commercialNet < 0 && speculatorNet > 0);

                    results.push({
                        commodity: name.charAt(0).toUpperCase() + name.slice(1),
                        commodityKey: name,
                        exchange: mapping.exchange,
                        latestDate: latest.date,
                        openInterest: latest.openInterest,
                        oiChange: latest.changeOI,
                        mmNet: latest.mmNet,
                        mmNetChange: prev ? latest.mmNet - prev.mmNet : 0,
                        mmLong: latest.mmLong,
                        mmShort: latest.mmShort,
                        prodNet: latest.prodNet,
                        cotIndex,
                        cotIndexLabel: cotIndex !== null ? (
                            cotIndex >= 80 ? 'Extreme Bullish' :
                                cotIndex >= 60 ? 'Bullish' :
                                    cotIndex >= 40 ? 'Neutral' :
                                        cotIndex >= 20 ? 'Bearish' :
                                            'Extreme Bearish'
                        ) : 'N/A',
                        divergence: isDiverging,
                    });
                } catch {
                    // Skip failed commodities
                }
            }

            // Sort by COT index (extremes first for attention)
            results.sort((a, b) => {
                if (a.cotIndex === null) return 1;
                if (b.cotIndex === null) return -1;
                const aExtreme = Math.abs(a.cotIndex - 50);
                const bExtreme = Math.abs(b.cotIndex - 50);
                return bExtreme - aExtreme;
            });

            return NextResponse.json({
                status: 'success',
                source: 'live',
                totalCommodities: results.length,
                commodities: results,
            });
        }

        // ── Available commodities list ──────────────────────
        if (endpoint === 'commodities') {
            return NextResponse.json({
                status: 'success',
                commodities: Object.entries(CFTC_CONTRACT_MAP).map(([key, val]) => ({
                    key,
                    label: key.charAt(0).toUpperCase() + key.slice(1),
                    cftcName: val.name,
                    exchange: val.exchange,
                })),
            });
        }

        return NextResponse.json({ error: `Unknown endpoint: ${endpoint}. Use 'single', 'summary', or 'commodities'.` }, { status: 400 });

    } catch (error: any) {
        console.error('[COT] Route error:', error.message);
        return NextResponse.json({ error: 'Failed to fetch COT data', message: error.message }, { status: 502 });
    }
}
