'use client';

import { useState } from 'react';
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
    const { prefs } = usePreferences();

    return (
        <div className={`app-layout ${prefs.compactMode ? 'compact-mode' : ''}`}>
            <Sidebar
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
            <div className={`main-area ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
                <Header title={title} subtitle={subtitle} />
                {prefs.showTickerBar && <TickerBar />}
                <main className="main-content">
                    {children}
                </main>
            </div>
        </div>
    );
}
