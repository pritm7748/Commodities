'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_SECTIONS = [
    {
        label: 'Markets',
        items: [
            { name: 'Dashboard', icon: '📊', href: '/' },
            { name: 'Heatmap', icon: '🗺️', href: '/heatmap' },
            { name: 'Watchlist', icon: '⭐', href: '/watchlist' },
        ],
    },
    {
        label: 'Trading',
        items: [
            { name: 'F&O Chain', icon: '⛓️', href: '/fno' },
            { name: 'Open Interest', icon: '📈', href: '/oi' },
            { name: 'Charts', icon: '📉', href: '/charts' },
            { name: 'Compare', icon: '🔀', href: '/charts/compare' },
            { name: 'Spreads', icon: '↔️', href: '/spreads' },
        ],
    },
    {
        label: 'Analysis',
        items: [
            { name: 'Demand & Supply', icon: '⚖️', href: '/demand-supply' },
            { name: 'Dollar & Currency', icon: '💵', href: '/dollar' },
            { name: 'Weather', icon: '🌦️', href: '/weather' },
            { name: 'Geopolitics', icon: '🌍', href: '/geopolitics' },
            { name: 'Macro Data', icon: '🏛️', href: '/macro' },
            { name: 'Sentiment', icon: '💬', href: '/sentiment' },
        ],
    },
    {
        label: 'Tools',
        items: [
            { name: 'Scoring Model', icon: '🎯', href: '/scoring' },
            { name: 'Correlations', icon: '🔗', href: '/correlations' },
            { name: 'COT / FII-DII', icon: '🏦', href: '/cot' },
            { name: 'Alerts', icon: '🔔', href: '/alerts' },
            { name: 'Reports', icon: '📄', href: '/reports' },
        ],
    },
];

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
    const pathname = usePathname();

    return (
        <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
            <Link href="/" className="sidebar-logo" style={{ textDecoration: 'none', cursor: 'pointer' }}>
                <div className="sidebar-logo-icon">C</div>
                <div className="sidebar-logo-text">
                    <h1>Commodity HQ</h1>
                    <span>Global Trading Analysis</span>
                </div>
            </Link>

            <nav className="sidebar-nav">
                {NAV_SECTIONS.map((section) => (
                    <div key={section.label}>
                        <div className="sidebar-section-label">{section.label}</div>
                        {section.items.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
                            >
                                <span className="sidebar-link-icon">{item.icon}</span>
                                <span>{item.name}</span>
                            </Link>
                        ))}
                    </div>
                ))}
            </nav>

            <div className="sidebar-toggle">
                <Link
                    href="/settings"
                    className={`sidebar-link ${pathname === '/settings' ? 'active' : ''}`}
                    style={{ textDecoration: 'none' }}
                >
                    <span className="sidebar-link-icon">⚙️</span>
                    <span>Settings</span>
                </Link>
            </div>
        </aside>
    );
}
