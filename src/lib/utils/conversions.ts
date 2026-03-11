// ============================================================
// Unit Conversion Utilities for Commodity Trading
// ============================================================

// Weight conversions
export const TROY_OZ_TO_GRAMS = 31.1035;
export const GRAMS_TO_TROY_OZ = 1 / TROY_OZ_TO_GRAMS;
export const KG_TO_TROY_OZ = 1000 / TROY_OZ_TO_GRAMS;
export const LB_TO_KG = 0.453592;
export const KG_TO_LB = 1 / LB_TO_KG;
export const TONNE_TO_KG = 1000;
export const SHORT_TON_TO_KG = 907.185;
export const QUINTAL_TO_KG = 100;

// Volume
export const BBL_TO_LITERS = 158.987;
export const GAL_TO_LITERS = 3.78541;
export const MMBTU_TO_GJ = 1.05506;

// Bushel (varies by commodity)
export const BUSHEL_TO_KG: Record<string, number> = {
    corn: 25.4012,
    soybeans: 27.2155,
    wheat: 27.2155,
};

/**
 * Convert price from one unit to another
 */
export function convertPrice(
    price: number,
    fromUnit: string,
    toUnit: string,
    commodity?: string
): number {
    // Same unit
    if (fromUnit === toUnit) return price;

    // Troy ounce to various gram units
    if (fromUnit === 'oz' && toUnit === 'g') {
        return price / TROY_OZ_TO_GRAMS;
    }
    if (fromUnit === 'oz' && toUnit === '1g') {
        return price / TROY_OZ_TO_GRAMS;
    }
    if (fromUnit === 'oz' && toUnit === '8g') {
        return (price / TROY_OZ_TO_GRAMS) * 8;
    }
    if (fromUnit === 'oz' && toUnit === '10g') {
        return (price / TROY_OZ_TO_GRAMS) * 10;
    }
    if (fromUnit === 'oz' && toUnit === 'kg') {
        return price * KG_TO_TROY_OZ;
    }

    // Grams to troy ounce
    if (fromUnit === 'g' && toUnit === 'oz') {
        return price * TROY_OZ_TO_GRAMS;
    }
    if (fromUnit === '1g' && toUnit === 'oz') {
        return price * TROY_OZ_TO_GRAMS;
    }
    if (fromUnit === '8g' && toUnit === 'oz') {
        return (price * TROY_OZ_TO_GRAMS) / 8;
    }
    if (fromUnit === '10g' && toUnit === 'oz') {
        return (price * TROY_OZ_TO_GRAMS) / 10;
    }

    // Tonne to kg and derived units
    if (fromUnit === 'tonne' && toUnit === 'kg') {
        return price / TONNE_TO_KG;
    }
    if (fromUnit === 'tonne' && toUnit === '10kg') {
        return price / (TONNE_TO_KG / 10);
    }
    if (fromUnit === 'tonne' && toUnit === '20kg') {
        return price / (TONNE_TO_KG / 20);
    }
    if (fromUnit === 'tonne' && toUnit === 'quintal') {
        return price / (TONNE_TO_KG / QUINTAL_TO_KG);
    }
    if (fromUnit === 'kg' && toUnit === 'tonne') {
        return price * TONNE_TO_KG;
    }

    // Pound to kg
    if (fromUnit === 'lb' && toUnit === 'kg') {
        return price / LB_TO_KG;
    }
    if (fromUnit === 'kg' && toUnit === 'lb') {
        return price * LB_TO_KG;
    }

    // Shorthand for tonne to lb
    if (fromUnit === 'tonne' && toUnit === 'lb') {
        return price / (TONNE_TO_KG * KG_TO_LB);
    }

    // Pound to tonne
    if (fromUnit === 'lb' && toUnit === 'tonne') {
        return price * LB_TO_KG * TONNE_TO_KG;
    }

    return price;
}

/**
 * Calculate MCX price from international price
 * MCX Price = (International Price × Conversion Factor × USD/INR) × (1 + Import Duty%) + Local Premium
 */
export function calculateMCXPrice(params: {
    internationalPrice: number;
    fromUnit: string;
    toUnit: string;
    usdInr: number;
    importDuty?: number; // percentage, e.g., 15 for 15%
    localPremium?: number; // in INR
}): number {
    const { internationalPrice, fromUnit, toUnit, usdInr, importDuty = 0, localPremium = 0 } = params;

    // Convert unit first
    const priceInTargetUnit = convertPrice(internationalPrice, fromUnit, toUnit);

    // Apply USD/INR conversion
    const priceInINR = priceInTargetUnit * usdInr;

    // Apply import duty
    const priceWithDuty = priceInINR * (1 + importDuty / 100);

    // Add local premium
    return priceWithDuty + localPremium;
}

/**
 * Calculate premium/discount of MCX vs International
 * Returns percentage: positive = premium, negative = discount
 */
export function calculatePremiumDiscount(params: {
    mcxPrice: number;
    mcxUnit: string;
    internationalPrice: number;
    internationalUnit: string;
    usdInr: number;
}): number {
    const { mcxPrice, mcxUnit, internationalPrice, internationalUnit, usdInr } = params;

    // Convert international price to MCX unit and INR
    const intlPriceInMCXUnit = convertPrice(internationalPrice, internationalUnit, mcxUnit);
    const intlPriceInINR = intlPriceInMCXUnit * usdInr;

    if (intlPriceInINR === 0) return 0;

    return ((mcxPrice - intlPriceInINR) / intlPriceInINR) * 100;
}

/**
 * Format price for display
 */
export function formatPrice(price: number, currency: string = 'USD', decimals?: number): string {
    const effectiveDecimals = decimals ?? (price > 100 ? 2 : price > 1 ? 4 : 6);

    if (currency === 'INR') {
        return `₹${formatIndianNumber(price, effectiveDecimals)}`;
    }

    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: effectiveDecimals,
        maximumFractionDigits: effectiveDecimals,
    }).format(price);
}

/**
 * Format number in Indian notation (lakhs, crores)
 */
function formatIndianNumber(num: number, decimals: number = 2): string {
    const fixed = num.toFixed(decimals);
    const [intPart, decPart] = fixed.split('.');
    const lastThree = intPart.slice(-3);
    const rest = intPart.slice(0, -3);
    const formatted = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree : lastThree;
    return decPart ? `${formatted}.${decPart}` : formatted;
}

/**
 * Format change percentage
 */
export function formatChange(change: number): string {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
}

/**
 * Format large numbers (K, M, B)
 */
export function formatLargeNumber(num: number): string {
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toFixed(0);
}

/**
 * Get unit label for display
 */
export function getUnitLabel(unit: string): string {
    const labels: Record<string, string> = {
        oz: 'US$/oz',
        g: 'per gram',
        '10g': 'per 10g',
        kg: 'per kg',
        tonne: 'US$/tonne',
        'short ton': 'US$/short ton',
        lb: 'US¢/lb',
        bbl: 'US$/bbl',
        gal: 'US$/gal',
        MMBtu: 'US$/MMBtu',
        MWh: '€/MWh',
        bu: 'US¢/bu',
        bale: 'per bale',
        quintal: 'per quintal',
        '20kg': 'per 20kg',
        '10kg': 'per 10kg',
        index: 'points',
        rate: 'rate',
        '%': '%',
    };
    return labels[unit] || unit;
}
