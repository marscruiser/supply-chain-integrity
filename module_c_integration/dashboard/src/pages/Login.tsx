import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export default function Login() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isRegister, setIsRegister] = useState(false);
    const [company, setCompany] = useState('');
    const [role, setRole] = useState('sender');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const url = isRegister ? `${API_BASE}/auth/register` : `${API_BASE}/auth/token`;
            const body = isRegister
                ? { email, password, company, role }
                : { email, password };

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Login failed');
            }

            const data = await res.json();
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('user', JSON.stringify(data.user));
            toast.success(`Welcome, ${data.user.email}!`);
            navigate('/dashboard');
        } catch (err: any) {
            toast.error(err.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-base)',
            backgroundImage: 'radial-gradient(circle at 30% 40%, rgba(56,189,248,0.08), transparent 40%), radial-gradient(circle at 70% 60%, rgba(139,92,246,0.08), transparent 40%)',
        }}>
            <div className="glass-pane" style={{ width: '100%', maxWidth: 440, padding: '2.5rem' }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        fontSize: '2.5rem', marginBottom: '0.5rem',
                        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-purple))',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        fontFamily: 'var(--font-display)', fontWeight: 700,
                    }}>
                        🛡️ SupplyGuard
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Supply Chain Integrity Verification System
                    </p>
                </div>

                {/* Toggle */}
                <div style={{
                    display: 'flex', gap: '0.5rem', marginBottom: '1.5rem',
                    background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 4,
                }}>
                    <button onClick={() => setIsRegister(false)} style={{
                        flex: 1, padding: '0.6rem', borderRadius: 6, border: 'none', cursor: 'pointer',
                        background: !isRegister ? 'var(--accent-primary)' : 'transparent',
                        color: !isRegister ? '#000' : 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem',
                    }}>Sign In</button>
                    <button onClick={() => setIsRegister(true)} style={{
                        flex: 1, padding: '0.6rem', borderRadius: 6, border: 'none', cursor: 'pointer',
                        background: isRegister ? 'var(--accent-primary)' : 'transparent',
                        color: isRegister ? '#000' : 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem',
                    }}>Register</button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                            placeholder="sender@apple.com"
                            style={{
                                width: '100%', padding: '0.75rem 1rem', marginTop: 4, borderRadius: 8,
                                border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.04)',
                                color: 'var(--text-primary)', fontSize: '0.95rem', outline: 'none',
                            }} />
                    </div>

                    <div>
                        <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                            placeholder="••••••••"
                            style={{
                                width: '100%', padding: '0.75rem 1rem', marginTop: 4, borderRadius: 8,
                                border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.04)',
                                color: 'var(--text-primary)', fontSize: '0.95rem', outline: 'none',
                            }} />
                    </div>

                    {isRegister && (
                        <>
                            <div>
                                <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Company</label>
                                <input type="text" value={company} onChange={e => setCompany(e.target.value)} required
                                    placeholder="Apple"
                                    style={{
                                        width: '100%', padding: '0.75rem 1rem', marginTop: 4, borderRadius: 8,
                                        border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.04)',
                                        color: 'var(--text-primary)', fontSize: '0.95rem', outline: 'none',
                                    }} />
                            </div>
                            <div>
                                <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</label>
                                <select value={role} onChange={e => setRole(e.target.value)}
                                    style={{
                                        width: '100%', padding: '0.75rem 1rem', marginTop: 4, borderRadius: 8,
                                        border: '1px solid var(--border-subtle)', background: 'rgba(17,24,39,0.9)',
                                        color: 'var(--text-primary)', fontSize: '0.95rem', outline: 'none',
                                    }}>
                                    <option value="sender">Sender (Ship Cargo)</option>
                                    <option value="inspector">Inspector (Verify Cargo)</option>
                                </select>
                            </div>
                        </>
                    )}

                    <button type="submit" disabled={loading} style={{
                        padding: '0.85rem', borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-purple))',
                        color: '#000', fontWeight: 700, fontSize: '1rem', marginTop: '0.5rem',
                        opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s',
                    }}>
                        {loading ? '⏳ Processing...' : (isRegister ? 'Create Account' : 'Sign In')}
                    </button>
                </form>

                {/* Demo credentials hint */}
                <div style={{
                    marginTop: '1.5rem', padding: '1rem', borderRadius: 8,
                    background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.1)',
                }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.5rem' }}>DEMO ACCOUNTS:</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: 1.8 }}>
                        <code style={{ color: 'var(--accent-primary)' }}>sender@apple.com</code> / sender123<br />
                        <code style={{ color: 'var(--accent-success)' }}>inspector@bestbuy.com</code> / inspector123<br />
                        <code style={{ color: 'var(--accent-purple)' }}>admin@supplyguard.com</code> / admin123
                    </p>
                </div>
            </div>
        </div>
    );
}
