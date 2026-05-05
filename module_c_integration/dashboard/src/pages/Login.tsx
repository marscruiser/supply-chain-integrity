import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Shield, Eye, EyeOff, ArrowRight, Play, Pause } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
const EARTH_VIDEO = 'https://cdn.pixabay.com/video/2020/05/25/39655-424930032_large.mp4';
const EARTH_IMAGE = 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?ixlib=rb-4.0.3&auto=format&fit=crop&w=2072&q=80';

export default function Login() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isRegister, setIsRegister] = useState(false);
    const [company, setCompany] = useState('');
    const [role, setRole] = useState('sender');
    const [showPassword, setShowPassword] = useState(false);
    const [isVideoPlaying, setIsVideoPlaying] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const url = isRegister ? `${API_BASE}/auth/register` : `${API_BASE}/auth/token`;
            const body = isRegister ? { email, password, company, role } : { email, password };
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

    const toggleVideo = () => {
        if (!videoRef.current) return;
        if (isVideoPlaying) { videoRef.current.pause(); } else { videoRef.current.play(); }
        setIsVideoPlaying(!isVideoPlaying);
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
            {/* Background Video */}
            <div className="absolute inset-0 z-0">
                <img src={EARTH_IMAGE} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <video
                    ref={videoRef}
                    src={EARTH_VIDEO}
                    className="absolute inset-0 w-full h-full object-cover"
                    autoPlay muted loop playsInline
                    onCanPlay={(e) => (e.currentTarget.style.opacity = '1')}
                    style={{ opacity: 0, transition: 'opacity 1s ease' }}
                />
                <div className="absolute inset-0 bg-black/60" />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/40 to-transparent" />
            </div>

            {/* Video Play/Pause Button */}
            <button onClick={toggleVideo}
                className="absolute bottom-6 right-6 z-20 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm
                           border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all">
                {isVideoPlaying
                    ? <Pause className="h-4 w-4 text-white" />
                    : <Play className="h-4 w-4 text-white ml-0.5" />}
            </button>

            {/* Login Card */}
            <div className="relative z-10 w-full max-w-md mx-4 animate-fade-in">
                <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-8 shadow-2xl">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 mb-4">
                            <Shield className="h-7 w-7 text-blue-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-white">SupplyGuard</h1>
                        <p className="text-gray-400 text-sm mt-1">Supply Chain Integrity Platform</p>
                    </div>

                    {/* Toggle */}
                    <div className="flex bg-gray-800 rounded-lg p-1 mb-6">
                        <button onClick={() => setIsRegister(false)}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                                !isRegister ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-300'
                            }`}>Sign In</button>
                        <button onClick={() => setIsRegister(true)}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                                isRegister ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-300'
                            }`}>Register</button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="label">Email</label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                                required placeholder="you@company.com" className="input" />
                        </div>

                        <div>
                            <label className="label">Password</label>
                            <div className="relative">
                                <input type={showPassword ? 'text' : 'password'} value={password}
                                    onChange={e => setPassword(e.target.value)} required
                                    placeholder="••••••••" className="input pr-10" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-400">
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {isRegister && (
                            <>
                                <div>
                                    <label className="label">Company</label>
                                    <input type="text" value={company} onChange={e => setCompany(e.target.value)}
                                        required placeholder="Apple Inc." className="input" />
                                </div>
                                <div>
                                    <label className="label">Role</label>
                                    <select value={role} onChange={e => setRole(e.target.value)} className="input">
                                        <option value="sender">Sender (Ship Cargo)</option>
                                        <option value="inspector">Inspector (Verify Cargo)</option>
                                    </select>
                                </div>
                            </>
                        )}

                        <button type="submit" disabled={loading}
                            className="btn-primary w-full flex items-center justify-center gap-2 py-3 mt-2">
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>{isRegister ? 'Create Account' : 'Sign In'}<ArrowRight className="h-4 w-4" /></>
                            )}
                        </button>
                    </form>

                    {/* Demo Credentials */}
                    <div className="mt-6 p-4 rounded-lg bg-gray-800/50 border border-gray-700/50">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Demo Accounts</p>
                        <div className="space-y-1.5 text-xs text-gray-400">
                            <div className="flex justify-between">
                                <code className="text-blue-400">sender@apple.com</code>
                                <span className="text-gray-600">sender123</span>
                            </div>
                            <div className="flex justify-between">
                                <code className="text-emerald-400">inspector@bestbuy.com</code>
                                <span className="text-gray-600">inspector123</span>
                            </div>
                            <div className="flex justify-between">
                                <code className="text-purple-400">admin@supplyguard.com</code>
                                <span className="text-gray-600">admin123</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
