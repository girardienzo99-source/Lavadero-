import React, { useState } from 'react';
import { Shield, Car, ShieldAlert, KeyRound, User } from 'lucide-react';
import type { SessionUser } from '../types';

interface LoginProps {
  onLoginSuccess: (user: SessionUser) => void;
  brandConfig: {
    nombre: string;
    tagline: string;
    primaryColor: string;
    hoverColor: string;
  };
}

export default function Login({ onLoginSuccess, brandConfig }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    loginWith(username.trim(), password);
  };

  const loginWith = (userVal: string, passVal: string) => {
    setLoading(true);
    setError('');

    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: userVal, password: passVal })
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.detail || data.message || 'No se pudo validar el acceso.');
        }
        return data;
      })
      .then((data) => {
        setLoading(false);
        if (data.status === 'success') {
          localStorage.setItem('session', JSON.stringify(data.user));
          onLoginSuccess(data.user);
        } else {
          setError(data.message || 'Usuario o contraseña incorrectos.');
        }
      })
      .catch((err) => {
        setLoading(false);
        console.error(err);
        setError(err instanceof Error ? err.message : 'Error al conectar con el servidor de autenticación.');
      });
  };  return (
    <div className="comfort-theme min-h-screen bg-[#273449] text-slate-100 flex items-center justify-center p-4 relative font-sans">
      {/* Decorative Blur Mesh Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full blur-[140px] opacity-10"
          style={{ backgroundColor: brandConfig.primaryColor }}
        />
        <div className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] rounded-full blur-[140px] opacity-10 bg-[#00d2ff]" />
      </div>

      <div 
        className="w-full max-w-[850px] bg-slate-800/80 backdrop-blur-3xl rounded-2xl overflow-hidden shadow-xl grid grid-cols-1 md:grid-cols-2 relative z-10 border transition-all duration-300"
        style={{ 
          borderColor: `${brandConfig.primaryColor}2e`, 
          boxShadow: `0 0 50px ${brandConfig.primaryColor}1a` 
        }}
      >
        
        {/* Left Side: Branding / Flyer Mockup */}
        <div 
          className="p-8 lg:p-12 flex flex-col justify-between border-b md:border-b-0 md:border-r bg-gradient-to-b from-slate-900/75 via-slate-800/70 to-slate-900/75 relative overflow-hidden"
          style={{ borderColor: `${brandConfig.primaryColor}15` }}
        >
          {/* Subtle grid pattern overlay */}
          <div className="absolute inset-0 grid-pattern opacity-15 pointer-events-none" />
          
          <div className="relative z-10 flex items-center gap-3">
            <div 
              className="p-2.5 rounded-xl border flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.05)]"
              style={{ 
                backgroundColor: `${brandConfig.primaryColor}15`, 
                borderColor: `${brandConfig.primaryColor}30`,
                color: brandConfig.primaryColor 
              }}
            >
              <Car className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-wider text-white uppercase font-display">
                {brandConfig.nombre}
              </h1>
              <span 
                className="text-[9px] font-mono tracking-widest uppercase block mt-0.5 font-bold"
                style={{ color: brandConfig.primaryColor }}
              >
                {brandConfig.tagline}
              </span>
            </div>
          </div>

          {/* Circular Albelo Detailing Flyer Logo Design */}
          <div className="relative z-10 my-8 flex flex-col items-center justify-center text-center">
            <div 
              className="relative p-2 bg-black/80 rounded-full border-2 shadow-2xl mb-4"
              style={{ 
                borderColor: `${brandConfig.primaryColor}35`,
                boxShadow: `0 0 30px ${brandConfig.primaryColor}25`
              }}
            >
              <svg className="w-28 h-28" viewBox="0 0 100 100">
                {/* Outer red ring with racing notches */}
                <circle cx="50" cy="50" r="46" fill="none" stroke={brandConfig.primaryColor} strokeWidth="3.5" strokeDasharray="6 2" />
                <circle cx="50" cy="50" r="41" fill="#0c0e12" stroke={brandConfig.primaryColor} strokeWidth="1" />
                
                {/* Inner details: Spray gun & buffer silhouette in vector */}
                <path d="M32 55 C 32 40, 68 40, 68 55" stroke={brandConfig.primaryColor} strokeWidth="2.5" fill="none" strokeLinecap="round" />
                <path d="M22 62 L78 62" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
                
                {/* Polisher rotary head */}
                <circle cx="50" cy="45" r="9" fill="none" stroke="#ffffff" strokeWidth="2" />
                <circle cx="50" cy="45" r="4" fill={brandConfig.primaryColor} />
                
                {/* Brand Banner red text box */}
                <path d="M15 62 L85 62 L80 75 L20 75 Z" fill={brandConfig.primaryColor} />
                <text x="50" y="71" fill="#ffffff" fontSize="7.5" fontWeight="900" textAnchor="middle" letterSpacing="0.8" fontFamily="sans-serif">ALBELO</text>
                <text x="50" y="86" fill="#94a3b8" fontSize="5.5" fontWeight="bold" textAnchor="middle" letterSpacing="0.5">Estética Vehicular</text>
                <text x="50" y="93" fill="#e11d48" fontSize="4.5" fontWeight="black" textAnchor="middle">EST. 2021</text>
              </svg>
            </div>
            
            <h2 className="text-xl font-extrabold tracking-tight text-white uppercase font-display leading-tight">
              Transformamos <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r font-black" style={{ backgroundImage: `linear-gradient(to right, ${brandConfig.primaryColor}, #f59e0b)` }}>
                TU VEHÍCULO
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 max-w-xs mt-3 leading-relaxed">
              Gestión simple de turnos, trabajos, clientes y caja para el uso diario del lavadero.
            </p>
          </div>

          {/* Core Flyer Badges */}
          <div className="relative z-10 flex flex-wrap gap-2 justify-center text-[9px] font-bold uppercase tracking-wider text-slate-400">
            <span 
              className="flex items-center gap-1 border px-2 py-1 rounded bg-white/[0.01]"
              style={{ borderColor: `${brandConfig.primaryColor}20`, color: brandConfig.primaryColor }}
            >
              🛡️ Calidad Profesional
            </span>
            <span 
              className="flex items-center gap-1 border px-2 py-1 rounded bg-white/[0.01]"
              style={{ borderColor: `${brandConfig.primaryColor}20`, color: brandConfig.primaryColor }}
            >
              ⚡ Turnos Rápidos
            </span>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="p-8 lg:p-12 flex flex-col justify-center gap-6 bg-slate-700/45 relative">
          <div className="absolute inset-0 grid-pattern opacity-5 pointer-events-none" />
          
          <div className="relative z-10">
            <h3 className="text-base font-black text-white uppercase tracking-wider font-display">Ingreso al Sistema</h3>
            <p className="text-xs text-slate-400 mt-1">Introducí tus credenciales autorizadas.</p>
          </div>

          {error && (
            <div className="relative z-10 p-3 bg-red-950/50 border border-red-500/30 text-red-200 rounded-lg text-xs flex items-center gap-2.5 animate-shake">
              <ShieldAlert className="w-4.5 h-4.5 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="relative z-10 space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold">Usuario / Email</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  autoComplete="username"
                  placeholder="ejemplo@albelo.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-white/[0.02] border border-white/[0.08] focus:border-brand-primary/60 focus:ring-1 focus:ring-brand-primary/20 focus:outline-none rounded-xl px-3 py-2.5 pl-10 text-xs text-white transition-all placeholder:text-slate-650 font-mono"
                />
                <User className="w-4 h-4 text-slate-550 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold">Contraseña</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/[0.02] border border-white/[0.08] focus:border-brand-primary/60 focus:ring-1 focus:ring-brand-primary/20 focus:outline-none rounded-xl px-3 py-2.5 pl-10 text-xs text-white transition-all placeholder:text-slate-655 font-mono"
                />
                <KeyRound className="w-4 h-4 text-slate-550 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-lg flex items-center justify-center gap-2 cursor-pointer border border-white/[0.08] hover:scale-[1.01] active:scale-[0.99]"
              style={{ 
                backgroundColor: brandConfig.primaryColor,
                boxShadow: `0 4px 15px ${brandConfig.primaryColor}33`
              }}
            >
              {loading ? 'Validando...' : 'Ingresar'}
            </button>
          </form>

          <p className="relative z-10 text-center text-[10px] text-slate-500 leading-relaxed">
            Acceso exclusivo para personal autorizado. Si no podés ingresar, contactá al administrador del sistema.
          </p>
        </div>
      </div>
    </div>
  );
}
