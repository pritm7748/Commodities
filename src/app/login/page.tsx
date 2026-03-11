'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRouter } from 'next/navigation';

/* ── Animated Particles ─────────────────────────── */
function FloatingParticles() {
    return (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
            {Array.from({ length: 20 }).map((_, i) => (
                <div
                    key={i}
                    className="login-particle"
                    style={{
                        left: `${Math.random() * 100}%`,
                        animationDelay: `${Math.random() * 8}s`,
                        animationDuration: `${8 + Math.random() * 12}s`,
                        width: `${2 + Math.random() * 4}px`,
                        height: `${2 + Math.random() * 4}px`,
                        opacity: 0.15 + Math.random() * 0.25,
                    }}
                />
            ))}
        </div>
    );
}

export default function LoginPage() {
    const { signIn, signUp, user, loading } = useAuth();
    const router = useRouter();
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [focused, setFocused] = useState('');
    const emailRef = useRef<HTMLInputElement>(null);

    // Redirect if already logged in
    useEffect(() => {
        if (!loading && user) router.push('/');
    }, [loading, user, router]);

    // Auto-focus email on mode change
    useEffect(() => { emailRef.current?.focus(); }, [mode]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(''); setSuccess('');

        if (!email || !password) { setError('Please fill in all fields.'); return; }
        if (mode === 'signup' && password !== confirm) { setError('Passwords do not match.'); return; }
        if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }

        setSubmitting(true);

        if (mode === 'login') {
            const { error: err } = await signIn(email, password);
            if (err) { setError(err); setSubmitting(false); }
            else router.push('/');
        } else {
            const { error: err, needsConfirmation } = await signUp(email, password);
            if (err) { setError(err); setSubmitting(false); }
            else if (needsConfirmation) {
                setSuccess('Account created! Check your email to confirm, then log in.');
                setMode('login'); setSubmitting(false);
            } else router.push('/');
        }
    }

    return (
        <>
            <div className="login-page">
                <FloatingParticles />

                {/* Ambient glow orbs */}
                <div className="login-orb login-orb-1" />
                <div className="login-orb login-orb-2" />
                <div className="login-orb login-orb-3" />

                <div className="login-card">
                    {/* Brand */}
                    <div className="login-brand">
                        <div className="login-logo">
                            <span className="login-logo-icon">C</span>
                        </div>
                        <h1 className="login-title">Commodity HQ</h1>
                        <p className="login-subtitle">Global Trading Analysis Platform</p>
                    </div>

                    {/* Mode toggle */}
                    <div className="login-tabs">
                        <button
                            className={`login-tab ${mode === 'login' ? 'active' : ''}`}
                            onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                        >
                            Log In
                        </button>
                        <button
                            className={`login-tab ${mode === 'signup' ? 'active' : ''}`}
                            onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}
                        >
                            Sign Up
                        </button>
                        <div className="login-tab-indicator" style={{ transform: mode === 'signup' ? 'translateX(100%)' : 'translateX(0)' }} />
                    </div>

                    {/* Messages */}
                    {error && (
                        <div className="login-msg login-msg-error">
                            <span>⚠️</span> {error}
                        </div>
                    )}
                    {success && (
                        <div className="login-msg login-msg-success">
                            <span>✅</span> {success}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="login-form">
                        <div className={`login-field ${focused === 'email' ? 'focused' : ''} ${email ? 'has-value' : ''}`}>
                            <label className="login-label">Email Address</label>
                            <div className="login-input-wrap">
                                <span className="login-input-icon">✉️</span>
                                <input
                                    ref={emailRef}
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    onFocus={() => setFocused('email')}
                                    onBlur={() => setFocused('')}
                                    placeholder="you@example.com"
                                    autoComplete="email"
                                    className="login-input"
                                />
                            </div>
                        </div>

                        <div className={`login-field ${focused === 'password' ? 'focused' : ''} ${password ? 'has-value' : ''}`}>
                            <label className="login-label">Password</label>
                            <div className="login-input-wrap">
                                <span className="login-input-icon">🔒</span>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    onFocus={() => setFocused('password')}
                                    onBlur={() => setFocused('')}
                                    placeholder="••••••••"
                                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                    className="login-input"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="login-eye-btn"
                                    tabIndex={-1}
                                >
                                    {showPassword ? '🙈' : '👁️'}
                                </button>
                            </div>
                        </div>

                        {mode === 'signup' && (
                            <div className={`login-field ${focused === 'confirm' ? 'focused' : ''} ${confirm ? 'has-value' : ''}`}>
                                <label className="login-label">Confirm Password</label>
                                <div className="login-input-wrap">
                                    <span className="login-input-icon">🔒</span>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={confirm}
                                        onChange={e => setConfirm(e.target.value)}
                                        onFocus={() => setFocused('confirm')}
                                        onBlur={() => setFocused('')}
                                        placeholder="••••••••"
                                        autoComplete="new-password"
                                        className="login-input"
                                    />
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            className="login-submit"
                            disabled={submitting}
                        >
                            {submitting ? (
                                <span className="login-spinner" />
                            ) : (
                                mode === 'login' ? '🚀 Log In' : '✨ Create Account'
                            )}
                        </button>
                    </form>

                    {/* Footer links */}
                    <div className="login-footer">
                        <span className="login-footer-text">
                            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
                        </span>
                        <button
                            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
                            className="login-footer-link"
                        >
                            {mode === 'login' ? 'Sign up' : 'Log in'}
                        </button>
                    </div>

                    <a href="/" className="login-skip">← Continue without login</a>
                </div>
            </div>

            <style>{`
                .login-page {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #0a0a1a;
                    padding: 20px;
                    position: relative;
                    overflow: hidden;
                }

                .login-orb {
                    position: absolute;
                    border-radius: 50%;
                    filter: blur(80px);
                    animation: orbFloat 15s ease-in-out infinite;
                }
                .login-orb-1 {
                    width: 400px; height: 400px;
                    background: radial-gradient(circle, rgba(59,130,246,0.15), transparent 70%);
                    top: -100px; left: -100px;
                }
                .login-orb-2 {
                    width: 350px; height: 350px;
                    background: radial-gradient(circle, rgba(139,92,246,0.12), transparent 70%);
                    bottom: -80px; right: -80px;
                    animation-delay: -5s;
                }
                .login-orb-3 {
                    width: 250px; height: 250px;
                    background: radial-gradient(circle, rgba(6,182,212,0.1), transparent 70%);
                    top: 50%; left: 50%;
                    transform: translate(-50%, -50%);
                    animation-delay: -10s;
                }

                @keyframes orbFloat {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    33% { transform: translate(30px, -20px) scale(1.05); }
                    66% { transform: translate(-20px, 15px) scale(0.95); }
                }

                .login-particle {
                    position: absolute;
                    bottom: -10px;
                    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
                    border-radius: 50%;
                    animation: particleRise linear infinite;
                }

                @keyframes particleRise {
                    0% { transform: translateY(0) rotate(0deg); opacity: 0; }
                    10% { opacity: 0.4; }
                    90% { opacity: 0.1; }
                    100% { transform: translateY(-100vh) rotate(360deg); opacity: 0; }
                }

                .login-card {
                    width: 100%;
                    max-width: 440px;
                    position: relative;
                    z-index: 10;
                    background: rgba(15, 15, 35, 0.75);
                    backdrop-filter: blur(20px) saturate(1.8);
                    border-radius: 24px;
                    border: 1px solid rgba(255,255,255,0.08);
                    padding: 40px 36px;
                    box-shadow:
                        0 0 0 1px rgba(255,255,255,0.03) inset,
                        0 30px 80px rgba(0,0,0,0.5),
                        0 0 40px rgba(59,130,246,0.05);
                    animation: cardIn 0.6s cubic-bezier(0.22, 1, 0.36, 1);
                }

                @keyframes cardIn {
                    from { opacity: 0; transform: translateY(30px) scale(0.96); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }

                .login-brand {
                    text-align: center;
                    margin-bottom: 32px;
                }
                .login-logo {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 12px;
                }
                .login-logo-icon {
                    width: 56px; height: 56px;
                    border-radius: 16px;
                    background: linear-gradient(135deg, #3b82f6, #8b5cf6, #06b6d4);
                    background-size: 200% 200%;
                    animation: gradientShift 4s ease infinite;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 24px; font-weight: 800; color: #fff;
                    box-shadow: 0 8px 25px rgba(59,130,246,0.3);
                }
                @keyframes gradientShift {
                    0%, 100% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                }
                .login-title {
                    font-size: 28px; font-weight: 800; color: #fff; margin: 0;
                    letter-spacing: -0.02em;
                }
                .login-subtitle {
                    font-size: 14px; color: rgba(255,255,255,0.4); margin: 4px 0 0;
                }

                /* Tabs */
                .login-tabs {
                    position: relative;
                    display: flex;
                    background: rgba(255,255,255,0.04);
                    border-radius: 12px;
                    padding: 4px;
                    margin-bottom: 24px;
                    border: 1px solid rgba(255,255,255,0.06);
                }
                .login-tab {
                    flex: 1;
                    padding: 10px;
                    border: none;
                    background: transparent;
                    color: rgba(255,255,255,0.4);
                    font-weight: 600;
                    font-size: 14px;
                    cursor: pointer;
                    border-radius: 8px;
                    position: relative;
                    z-index: 2;
                    transition: color 0.3s;
                }
                .login-tab.active { color: #fff; }
                .login-tab-indicator {
                    position: absolute;
                    top: 4px; left: 4px;
                    width: calc(50% - 4px);
                    height: calc(100% - 8px);
                    background: linear-gradient(135deg, rgba(59,130,246,0.25), rgba(139,92,246,0.25));
                    border-radius: 8px;
                    transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
                    border: 1px solid rgba(59,130,246,0.2);
                }

                /* Messages */
                .login-msg {
                    padding: 10px 14px;
                    border-radius: 10px;
                    font-size: 13px;
                    margin-bottom: 16px;
                    display: flex; align-items: center; gap: 8px;
                    animation: msgIn 0.3s ease;
                }
                @keyframes msgIn {
                    from { opacity: 0; transform: translateY(-8px); }
                }
                .login-msg-error {
                    background: rgba(239,68,68,0.1);
                    border: 1px solid rgba(239,68,68,0.25);
                    color: #f87171;
                }
                .login-msg-success {
                    background: rgba(34,197,94,0.1);
                    border: 1px solid rgba(34,197,94,0.25);
                    color: #4ade80;
                }

                /* Form */
                .login-form { display: flex; flex-direction: column; gap: 16px; }

                .login-field {
                    position: relative;
                }
                .login-label {
                    display: block;
                    font-size: 11px;
                    font-weight: 600;
                    color: rgba(255,255,255,0.35);
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    margin-bottom: 6px;
                    transition: color 0.2s;
                }
                .login-field.focused .login-label { color: #3b82f6; }

                .login-input-wrap {
                    position: relative;
                    display: flex;
                    align-items: center;
                }
                .login-input-icon {
                    position: absolute; left: 14px;
                    font-size: 14px;
                    z-index: 1;
                    transition: transform 0.2s;
                }
                .login-field.focused .login-input-icon { transform: scale(1.15); }

                .login-input {
                    width: 100%;
                    padding: 12px 14px 12px 42px;
                    border-radius: 10px;
                    border: 1px solid rgba(255,255,255,0.08);
                    background: rgba(255,255,255,0.04);
                    color: #fff;
                    font-size: 14px;
                    outline: none;
                    transition: all 0.25s;
                    box-sizing: border-box;
                }
                .login-input:focus {
                    border-color: rgba(59,130,246,0.5);
                    background: rgba(59,130,246,0.06);
                    box-shadow: 0 0 0 3px rgba(59,130,246,0.08);
                }
                .login-input::placeholder { color: rgba(255,255,255,0.2); }

                .login-eye-btn {
                    position: absolute; right: 10px;
                    background: none; border: none;
                    cursor: pointer; font-size: 14px;
                    opacity: 0.5; transition: opacity 0.2s;
                    padding: 4px;
                }
                .login-eye-btn:hover { opacity: 1; }

                /* Submit */
                .login-submit {
                    width: 100%;
                    padding: 14px;
                    border-radius: 12px;
                    border: none;
                    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
                    color: #fff;
                    font-weight: 700;
                    font-size: 15px;
                    cursor: pointer;
                    transition: all 0.25s;
                    margin-top: 4px;
                    position: relative;
                    overflow: hidden;
                }
                .login-submit:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 10px 30px rgba(59,130,246,0.3);
                }
                .login-submit:active:not(:disabled) {
                    transform: translateY(0);
                }
                .login-submit:disabled {
                    opacity: 0.7; cursor: not-allowed;
                }

                .login-spinner {
                    display: inline-block;
                    width: 20px; height: 20px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top-color: #fff;
                    border-radius: 50%;
                    animation: spin 0.6s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }

                /* Footer */
                .login-footer {
                    text-align: center;
                    margin-top: 24px;
                    font-size: 13px;
                }
                .login-footer-text { color: rgba(255,255,255,0.35); }
                .login-footer-link {
                    background: none; border: none;
                    color: #3b82f6;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 13px;
                    margin-left: 4px;
                    transition: color 0.2s;
                }
                .login-footer-link:hover { color: #60a5fa; }

                .login-skip {
                    display: block;
                    text-align: center;
                    margin-top: 16px;
                    color: rgba(255,255,255,0.25);
                    font-size: 12px;
                    text-decoration: none;
                    transition: color 0.2s;
                }
                .login-skip:hover { color: rgba(255,255,255,0.5); }
            `}</style>
        </>
    );
}
