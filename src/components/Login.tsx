import React, { useState } from 'react';
import { Shield, Car, ShieldAlert, KeyRound, User } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: { nombre: string; rol: string }) => void;
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
      .then((res) => res.json())
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
        setError('Error al conectar con el servidor de autenticación.');
      });
  };

  return (
    <div className="min-h-screen bg-[#06080a] text-slate-100 flex items-center justify-center p-4 relative font-sans">
      {/* Decorative Blur Mesh Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full blur-[120px] opacity-10"
          style={{ backgroundColor: brandConfig.primaryColor }}
        />
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] rounded-full blur-[120px] opacity-10 bg-[#00d2ff]" />
      </div>

      <div className="w-full max-w-[850px] bg-white/[0.02] backdrop-blur-2xl border border-white/[0.08] rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] grid grid-cols-1 md:grid-cols-2 relative z-10">
        
        {/* Left Side: Branding */}
        <div className="p-8 lg:p-12 flex flex-col justify-between border-b md:border-b-0 md:border-r border-white/[0.08] bg-white/[0.01]">
          <div className="flex items-center gap-3">
            <div 
              className="p-2.5 rounded-xl border flex items-center justify-center"
              style={{ 
                backgroundColor: `${brandConfig.primaryColor}15`, 
                borderColor: `${brandConfig.primaryColor}30`,
                color: brandConfig.primaryColor 
              }}
            >
              <Car className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-wider text-white uppercase">
                {brandConfig.nombre}
              </h1>
              <span className="text-[9px] text-slate-400 font-mono tracking-widest uppercase block mt-0.5">
                {brandConfig.tagline}
              </span>
            </div>
          </div>

          <div className="my-10 md:my-0 space-y-4">
            <h2 className="text-2xl font-extrabold tracking-tight text-white leading-tight font-display">
              CONTROL OPERATIVO <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-500" style={{ backgroundImage: `linear-gradient(to right, ${brandConfig.primaryColor}, #f59e0b)` }}>
                Y GESTIÓN INTEGRAL
              </span>
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Accede al tablero comercial para agendar turnos, controlar stock crítico de insumos, ver métricas de satisfacción NPS y gestionar el libro contable de caja diaria.
            </p>
          </div>

          <div className="text-[10px] text-slate-500 font-mono">
            © 2026 {brandConfig.nombre} • Versión 3.0.0
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="p-8 lg:p-12 flex flex-col justify-center gap-6">
          <div>
            <h3 className="text-lg font-bold text-white">Iniciar Sesión</h3>
            <p className="text-xs text-slate-400 mt-1">Ingresa tus credenciales para acceder al sistema.</p>
          </div>

          {error && (
            <div className="p-3 bg-red-950/40 border border-red-800/60 text-red-200 rounded-xl text-xs flex items-center gap-2 animate-shake">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] text-slate-400 uppercase tracking-wider">Usuario / Correo</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="ejemplo@correo.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-white/[0.02] border border-white/[0.1] focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 focus:outline-none rounded-xl px-3 py-2.5 pl-10 text-xs text-white transition-all placeholder:text-slate-600"
                />
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] text-slate-400 uppercase tracking-wider">Contraseña</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/[0.02] border border-white/[0.1] focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 focus:outline-none rounded-xl px-3 py-2.5 pl-10 text-xs text-white transition-all placeholder:text-slate-600"
                />
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-primary hover:bg-brand-hover text-white py-2.5 rounded-xl text-xs font-bold transition duration-200 shadow-md flex items-center justify-center gap-2 cursor-pointer"
              style={{ backgroundColor: brandConfig.primaryColor }}
            >
              {loading ? 'Validando...' : 'Ingresar al Panel'}
            </button>
          </form>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-white/[0.06]"></div>
            <span className="flex-shrink mx-3 text-[10px] text-slate-600 uppercase font-mono">Ingreso Rápido</span>
            <div className="flex-grow border-t border-white/[0.06]"></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => loginWith('admin@gmail.com', '1998')}
              className="py-2 px-3 bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl text-[10px] font-bold text-[#f59e0b] hover:text-white transition duration-200 cursor-pointer"
            >
              ⚡ Admin (1998)
            </button>
            <button
              onClick={() => loginWith('enzo', '1234')}
              className="py-2 px-3 bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl text-[10px] font-bold text-slate-400 hover:text-white transition duration-200 cursor-pointer"
            >
              👤 Enzo (1234)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
