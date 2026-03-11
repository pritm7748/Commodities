'use client';

import { useMemo } from 'react';
import { ALL_COMMODITIES, CommoditySpec } from '@/lib/data/commodities';
import { PriceData } from '@/lib/services/priceService';
import { formatPrice } from '@/lib/utils/conversions';

interface PremiumRow {
    mcxCommodity: CommoditySpec;
    globalCommodity: CommoditySpec;
    mcxPrice: number;
    globalPrice: number;
    globalPriceInINR: number;
    premium: number;
    premiumPercent: number;
}

interface PremiumCalculatorProps {
    prices: Map<string, PriceData>;
    usdInr?: number;
}

// Convert global price to INR per MCX unit
function convertToMCXUnit(
    globalPrice: number,
    globalCurrency: string,
    globalUnit: string,
    mcxUnit: string,
    usdInr: number,
    importDuty: number = 0
): number {
    let priceInINR = globalPrice * usdInr;

    // Apply import duty
    priceInINR *= (1 + importDuty / 100);

    // Unit conversion
    if (globalUnit.includes('/oz') && mcxUnit.includes('/10g')) {
        // Gold: $/oz → ₹/10g
        return priceInINR * (10 / 31.1035);
    }
    if (globalUnit.includes('/oz') && mcxUnit.includes('/kg')) {
        // Silver: $/oz → ₹/kg
        return priceInINR * (1000 / 31.1035);
    }
    if (globalUnit.includes('/lb') && mcxUnit.includes('/kg')) {
        // Copper: $/lb → ₹/kg
        return priceInINR * 2.20462;
    }
    if (globalUnit.includes('/tonne') && mcxUnit.includes('/kg')) {
        // Aluminium, Zinc, etc: $/tonne → ₹/kg
        return priceInINR / 1000;
    }
    if (globalUnit.includes('/bbl') && mcxUnit.includes('/bbl')) {
        // Crude: $/bbl → ₹/bbl
        return priceInINR;
    }
    if (globalUnit.includes('/MMBtu') && mcxUnit.includes('/MMBtu')) {
        // NatGas
        return priceInINR;
    }
    if (globalUnit.includes('/lb') && mcxUnit.includes('/bale')) {
        // Cotton: ¢/lb → ₹/bale (1 bale = ~170 kg = ~374.8 lb)
        return (priceInINR / 100) * 374.8;
    }

    // Default: just currency convert
    return priceInINR;
}

// MCX-Global pairs
const MCX_GLOBAL_PAIRS = [
    { mcx: 'gold-mcx', global: 'gold-comex' },
    { mcx: 'silver-mcx', global: 'silver-comex' },
    { mcx: 'copper-mcx', global: 'copper-lme' },
    { mcx: 'aluminium-mcx', global: 'aluminium-lme' },
    { mcx: 'zinc-mcx', global: 'zinc-lme' },
    { mcx: 'nickel-mcx', global: 'nickel-lme' },
    { mcx: 'lead-mcx', global: 'lead-lme' },
    { mcx: 'crude-mcx', global: 'crude-wti' },
    { mcx: 'natgas-mcx', global: 'natgas-henry' },
    { mcx: 'cotton-mcx', global: 'cotton-ice' },
];

export default function PremiumCalculator({ prices, usdInr = 83.50 }: PremiumCalculatorProps) {
    const premiumRows = useMemo(() => {
        const rows: PremiumRow[] = [];

        // Get live USD/INR if available
        const usdInrPrice = prices.get('usdinr');
        const rate = usdInrPrice?.price || usdInr;

        for (const pair of MCX_GLOBAL_PAIRS) {
            const mcxCom = ALL_COMMODITIES.find((c) => c.id === pair.mcx);
            const globalCom = ALL_COMMODITIES.find((c) => c.id === pair.global);
            const mcxPrice = prices.get(pair.mcx);
            const globalPrice = prices.get(pair.global);

            if (!mcxCom || !globalCom || !mcxPrice || !globalPrice) continue;

            const duty = mcxCom.importDuty || 0;
            const globalPriceInINR = convertToMCXUnit(
                globalPrice.price,
                globalCom.currency,
                globalCom.unit,
                mcxCom.unit,
                rate,
                duty
            );

            const premium = mcxPrice.price - globalPriceInINR;
            const premiumPercent = (premium / globalPriceInINR) * 100;

            rows.push({
                mcxCommodity: mcxCom,
                globalCommodity: globalCom,
                mcxPrice: mcxPrice.price,
                globalPrice: globalPrice.price,
                globalPriceInINR,
                premium,
                premiumPercent,
            });
        }

        return rows;
    }, [prices, usdInr]);

    const usdInrPrice = prices.get('usdinr');

    return (
        <div className="card animate-fade-in">
            <div className="premium-calc-header">
                <h3 className="premium-calc-title">
                    🔄 MCX Premium / Discount Calculator
                </h3>
                <div className="premium-calc-rate">
                    USD/INR: <strong style={{ fontFamily: 'var(--font-mono)' }}>
                        ₹{(usdInrPrice?.price || usdInr).toFixed(2)}
                    </strong>
                </div>
            </div>

            <div style={{ overflow: 'auto' }}>
                <table className="data-table" style={{ minWidth: 700 }}>
                    <thead>
                        <tr>
                            <th>Commodity</th>
                            <th style={{ textAlign: 'right' }}>Global Price</th>
                            <th style={{ textAlign: 'right' }}>Equiv. INR Price</th>
                            <th style={{ textAlign: 'right' }}>MCX Price</th>
                            <th style={{ textAlign: 'right' }}>Premium / Discount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {premiumRows.map((row) => {
                            const isPositive = row.premium >= 0;
                            return (
                                <tr key={row.mcxCommodity.id}>
                                    <td>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>
                                                {row.mcxCommodity.name}
                                            </div>
                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                                                {row.globalCommodity.exchange} → MCX
                                            </div>
                                        </div>
                                    </td>
                                    <td className="mono-cell" style={{ textAlign: 'right' }}>
                                        {formatPrice(row.globalPrice, row.globalCommodity.currency, 2)}
                                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                                            {row.globalCommodity.unit}
                                        </div>
                                    </td>
                                    <td className="mono-cell" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                                        ₹{row.globalPriceInINR.toFixed(2)}
                                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                                            {row.mcxCommodity.unit}
                                        </div>
                                    </td>
                                    <td className="mono-cell" style={{ textAlign: 'right' }}>
                                        ₹{row.mcxPrice.toFixed(2)}
                                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                                            {row.mcxCommodity.unit}
                                        </div>
                                    </td>
                                    <td className="mono-cell" style={{ textAlign: 'right' }}>
                                        <span
                                            className={isPositive ? 'text-gain' : 'text-loss'}
                                            style={{ fontWeight: 'var(--weight-bold)' as any }}
                                        >
                                            {isPositive ? '+' : ''}₹{row.premium.toFixed(2)}{' '}
                                            ({isPositive ? '+' : ''}{row.premiumPercent.toFixed(2)}%)
                                        </span>
                                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                                            {isPositive ? 'Premium' : 'Discount'}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
