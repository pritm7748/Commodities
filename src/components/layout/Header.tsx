'use client';

import { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useAuth } from '@/components/providers/AuthProvider';
import Link from 'next/link';

interface HeaderProps {
    title: string;
    subtitle?: string;
    onMenuToggle?: () => void;
}

export default function Header({ title, subtitle, onMenuToggle }: HeaderProps) {
    const { theme, toggleTheme } = useTheme();
    const { user, loading, signOut } = useAuth();

    const [notifOpen, setNotifOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const notifRef = useRef<HTMLDivElement>(null);
    const userRef = useRef<HTMLDivElement>(null);

    /* ── Click-outside handlers ───────────────────── */
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setNotifOpen(false);
            }
            if (userRef.current && !userRef.current.contains(e.target as Node)) {
                setUserMenuOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    return (
        <header className="header">
            <div className="header-left">
                {/* Hamburger for mobile */}
                <button
                    className="btn-icon mobile-menu-btn"
                    onClick={onMenuToggle}
                    aria-label="Menu"
                >
                    ☰
                </button>
                <div>
                    <div className="header-title">{title}</div>
                    {subtitle && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                            {subtitle}
                        </div>
                    )}
                </div>
            </div>

            <div className="header-right">
                <div className="live-badge">
                    <span className="live-dot" />
                    LIVE
                </div>

                {/* ── Theme toggle ────────────────────── */}
                <button
                    className="btn-icon"
                    onClick={toggleTheme}
                    title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                >
                    {theme === 'dark' ? '☀️' : '🌙'}
                </button>

                {/* ── Notifications ───────────────────── */}
                <div ref={notifRef} style={{ position: 'relative' }}>
                    <button
                        className="btn-icon"
                        title="Notifications"
                        onClick={() => { setNotifOpen(!notifOpen); setUserMenuOpen(false); }}
                    >
                        🔔
                    </button>

                    {notifOpen && (
                        <div style={{
                            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                            width: '320px', background: 'var(--bg-primary)',
                            border: '1px solid var(--border-primary)',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: '0 12px 40px rgba(0,0,0,0.35)', zIndex: 100,
                            animation: 'dropIn 0.2s ease',
                        }}>
                            <div style={{
                                padding: '14px 16px', borderBottom: '1px solid var(--border-primary)',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            }}>
                                <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>Notifications</span>
                                <Link
                                    href="/alerts"
                                    onClick={() => setNotifOpen(false)}
                                    style={{ fontSize: '11px', color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}
                                >
                                    View All Alerts →
                                </Link>
                            </div>
                            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
                                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔔</div>
                                <p style={{ margin: 0 }}>No new notifications</p>
                                <p style={{ margin: '4px 0 0', fontSize: '12px' }}>
                                    Set up <Link href="/alerts" onClick={() => setNotifOpen(false)} style={{ color: '#3b82f6', textDecoration: 'none' }}>price alerts</Link> to get notified
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Auth section ────────────────────── */}
                {!loading && (
                    user ? (
                        <div ref={userRef} style={{ position: 'relative', marginLeft: '4px' }}>
                            <button
                                onClick={() => { setUserMenuOpen(!userMenuOpen); setNotifOpen(false); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '4px 10px 4px 4px', borderRadius: 'var(--radius-lg)',
                                    border: '1px solid var(--border-primary)',
                                    background: 'var(--bg-secondary)', cursor: 'pointer',
                                    transition: 'all 0.15s',
                                }}
                            >
                                <div style={{
                                    width: '30px', height: '30px', borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '12px', fontWeight: 700, color: '#fff', flexShrink: 0,
                                }}>
                                    {user.email?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <span style={{
                                    fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)',
                                    maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}>
                                    {user.email?.split('@')[0]}
                                </span>
                                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', transition: 'transform 0.2s', transform: userMenuOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
                            </button>

                            {userMenuOpen && (
                                <div style={{
                                    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                                    width: '220px', background: 'var(--bg-primary)',
                                    border: '1px solid var(--border-primary)',
                                    borderRadius: 'var(--radius-lg)',
                                    boxShadow: '0 12px 40px rgba(0,0,0,0.35)', zIndex: 100,
                                    animation: 'dropIn 0.2s ease', overflow: 'hidden',
                                }}>
                                    <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-primary)' }}>
                                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>
                                            {user.email?.split('@')[0]}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {user.email}
                                        </div>
                                    </div>
                                    <div style={{ padding: '4px' }}>
                                        <Link href="/settings" onClick={() => setUserMenuOpen(false)} style={{
                                            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
                                            borderRadius: 'var(--radius-md)', textDecoration: 'none',
                                            color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500,
                                            transition: 'background 0.15s',
                                        }}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                        >
                                            ⚙️ Settings
                                        </Link>
                                    </div>
                                    <div style={{ padding: '4px', borderTop: '1px solid var(--border-primary)' }}>
                                        <button
                                            onClick={() => { signOut(); setUserMenuOpen(false); }}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '8px',
                                                padding: '8px 10px', width: '100%',
                                                borderRadius: 'var(--radius-md)', border: 'none',
                                                background: 'transparent', color: '#ef4444',
                                                fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                                                transition: 'background 0.15s',
                                            }}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                        >
                                            🚪 Log Out
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <Link href="/login" style={{
                            padding: '8px 16px', borderRadius: 'var(--radius-md)',
                            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                            color: '#fff', fontWeight: 600, fontSize: '12px',
                            textDecoration: 'none', marginLeft: '4px',
                            transition: 'all 0.2s',
                            boxShadow: '0 2px 8px rgba(59,130,246,0.25)',
                        }}>
                            Login
                        </Link>
                    )
                )}
            </div>

            <style>{`
                @keyframes dropIn {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </header>
    );
}
