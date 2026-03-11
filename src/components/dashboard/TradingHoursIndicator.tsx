'use client';

import { useMemo } from 'react';

interface ExchangeStatus {
    name: string;
    abbreviation: string;
    timezone: string;
    openHour: number;
    openMinute: number;
    closeHour: number;
    closeMinute: number;
    weekdays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
}

const EXCHANGES: ExchangeStatus[] = [
    { name: 'COMEX', abbreviation: 'COMEX', timezone: 'America/New_York', openHour: 18, openMinute: 0, closeHour: 17, closeMinute: 0, weekdays: [0, 1, 2, 3, 4] },
    { name: 'NYMEX', abbreviation: 'NYMEX', timezone: 'America/New_York', openHour: 18, openMinute: 0, closeHour: 17, closeMinute: 0, weekdays: [0, 1, 2, 3, 4] },
    { name: 'LME', abbreviation: 'LME', timezone: 'Europe/London', openHour: 1, openMinute: 0, closeHour: 19, closeMinute: 0, weekdays: [1, 2, 3, 4, 5] },
    { name: 'ICE', abbreviation: 'ICE', timezone: 'America/New_York', openHour: 4, openMinute: 15, closeHour: 13, closeMinute: 30, weekdays: [1, 2, 3, 4, 5] },
    { name: 'CBOT', abbreviation: 'CBOT', timezone: 'America/Chicago', openHour: 19, openMinute: 0, closeHour: 13, closeMinute: 20, weekdays: [0, 1, 2, 3, 4] },
    { name: 'MCX', abbreviation: 'MCX', timezone: 'Asia/Kolkata', openHour: 9, openMinute: 0, closeHour: 23, closeMinute: 30, weekdays: [1, 2, 3, 4, 5] },
];

function isExchangeOpen(exchange: ExchangeStatus, now: Date): 'open' | 'closed' | 'pre' {
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: exchange.timezone,
            hour: 'numeric',
            minute: 'numeric',
            hour12: false,
            weekday: 'short',
        });

        const parts = formatter.formatToParts(now);
        const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0');
        const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0');
        const weekday = parts.find((p) => p.type === 'weekday')?.value || '';

        const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
        const dayNum = dayMap[weekday] ?? -1;

        if (!exchange.weekdays.includes(dayNum)) return 'closed';

        const currentMinutes = hour * 60 + minute;
        const openMinutes = exchange.openHour * 60 + exchange.openMinute;
        const closeMinutes = exchange.closeHour * 60 + exchange.closeMinute;

        // Handle overnight sessions (e.g., COMEX: 18:00-17:00)
        if (openMinutes > closeMinutes) {
            if (currentMinutes >= openMinutes || currentMinutes < closeMinutes) return 'open';
        } else {
            if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) return 'open';
        }

        // Pre-market: within 30 minutes before open
        const preMarketStart = openMinutes - 30;
        if (preMarketStart > 0 && currentMinutes >= preMarketStart && currentMinutes < openMinutes) return 'pre';

        return 'closed';
    } catch {
        return 'closed';
    }
}

export default function TradingHoursIndicator() {
    const now = useMemo(() => new Date(), []);

    return (
        <div className="trading-hours-bar">
            {EXCHANGES.map((exchange) => {
                const status = isExchangeOpen(exchange, now);
                return (
                    <div key={exchange.abbreviation} className="trading-hours-item" title={exchange.name}>
                        <span className={`trading-hours-dot ${status}`} />
                        <span className="trading-hours-label">{exchange.abbreviation}</span>
                    </div>
                );
            })}
        </div>
    );
}
