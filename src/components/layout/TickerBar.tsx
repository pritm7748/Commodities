'use client';

import { useEffect, useState, useRef } from 'react';
import { ALL_COMMODITIES, SECTOR_META, CommoditySpec } from '@/lib/data/commodities';
import { PriceData, fetchAllPrices } from '@/lib/services/priceService';
import { formatPrice, formatChange } from '@/lib/utils/conversions';

const TICKER_COMMODITIES = [
    'gold-comex', 'silver-comex', 'crude-wti', 'crude-brent', 'natgas-henry',
    'copper-lme', 'dxy', 'usdinr', 'gold-mcx', 'silver-mcx', 'crude-mcx',
    'aluminium-lme', 'zinc-lme', 'nickel-lme', 'corn-cbot', 'soybeans-cbot',
    'cotton-ice', 'coffee-arabica', 'sugar-ice', 'vix', 'us10y',
];

export default function TickerBar() {
    const [prices, setPrices] = useState<Map<string, PriceData>>(new Map());
    const [paused, setPaused] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const response = await fetchAllPrices();
                const priceMap = new Map<string, PriceData>();
                response.data.forEach((p) => priceMap.set(p.commodityId, p));
                setPrices(priceMap);
            } catch (err) {
                console.error('Ticker: Failed to load prices', err);
            }
        };
        load();
        const interval = setInterval(load, 30000);
        return () => clearInterval(interval);
    }, []);

    const tickerItems = TICKER_COMMODITIES
        .map((id) => {
            const commodity = ALL_COMMODITIES.find((c) => c.id === id);
            const price = prices.get(id);
            if (!commodity || !price) return null;
            return { commodity, price };
        })
        .filter(Boolean) as { commodity: CommoditySpec; price: PriceData }[];

    // Duplicate items for seamless scrolling
    const items = [...tickerItems, ...tickerItems];

    return (
        <div
            className="ticker-bar"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            ref={containerRef}
        >
            <div
                className="ticker-bar-inner"
                style={{ animationPlayState: paused ? 'paused' : 'running' }}
            >
                {items.map((item, i) => {
                    const isPositive = item.price.changePercent >= 0;
                    return (
                        <div className="ticker-item" key={`${item.commodity.id}-${i}`}>
                            <span className="ticker-item-name">{item.commodity.symbol}</span>
                            <span className="ticker-item-price">
                                {formatPrice(item.price.price, item.commodity.currency, 2)}
                            </span>
                            <span className={`ticker-item-change ${isPositive ? 'positive' : 'negative'}`}>
                                {isPositive ? '▲' : '▼'} {formatChange(item.price.changePercent)}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
