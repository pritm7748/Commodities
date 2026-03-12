'use client';

import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import TickerBar from './TickerBar';
import { usePreferences } from '@/components/providers/PreferencesProvider';

interface AppShellProps {
    children: React.ReactNode;
    title?: string;
    subtitle?: string;
}

export default function AppShell({ children, title = 'Dashboard', subtitle }: AppShellProps) {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { prefs } = usePreferences();

    // Close mobile menu on route change (resize)
    useEffect(() => {
        function handleResize() {
            if (window.innerWidth > 1024) setMobileMenuOpen(false);
        }
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Prevent body scroll when mobile menu is open
    useEffect(() => {
        if (mobileMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [mobileMenuOpen]);

    return (
        <div className={`app-layout ${prefs.compactMode ? 'compact-mode' : ''}`}>
            {/* Mobile overlay */}
            {mobileMenuOpen && (
                <div
                    className="mobile-overlay"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            <Sidebar
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
                mobileOpen={mobileMenuOpen}
                onMobileClose={() => setMobileMenuOpen(false)}
            />
            <div className={`main-area ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
                <Header
                    title={title}
                    subtitle={subtitle}
                    onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
                />
                {prefs.showTickerBar && <TickerBar />}
                <main className="main-content">
                    {children}
                </main>
            </div>
        </div>
    );
}
