import React from 'react';
import { AlertTriangle, CalendarDays, Car, CheckCircle2, DollarSign, Plus, Search, WalletCards } from 'lucide-react';
import { Turno } from '../types';

interface EssentialTodayProps {
  turnos: Turno[];
  cajaAbierta: boolean;
  ingresos: number;
  stockBajo: number;
  onGoToTurnos: () => void;
  onGoToCaja: () => void;
  onGoToClientes: () => void;
  canUseCaja: boolean;
  canUseClients: boolean;
}

const formatTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Sin horario'
    : date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
};

export default function EssentialToday({
  turnos,
  cajaAbierta,
  ingresos,
  stockBajo,
  onGoToTurnos,
  onGoToCaja,
  onGoToClientes,
  canUseCaja,
  canUseClients,
}: EssentialTodayProps) {
  const todayKey = new Date().toLocaleDateString('en-CA');
  const turnosHoy = turnos
    .filter((turno) => {
      const date = new Date(turno.fechaCreacion);
      return !Number.isNaN(date.getTime()) && date.toLocaleDateString('en-CA') === todayKey;
    })
    .sort((a, b) => new Date(a.fechaCreacion).getTime() - new Date(b.fechaCreacion).getTime());
  const enProceso = turnos.filter((turno) => turno.estado === 'EN_PROCESO');
  const listos = turnos.filter((turno) => turno.estado === 'COMPLETADO');
  const proximos = turnosHoy.filter((turno) => turno.estado === 'PENDIENTE').slice(0, 5);

  return (
    <section className="space-y-6 animate-fade-in" aria-labelledby="today-title">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-primary">Trabajo diario</p>
          <h2 id="today-title" className="mt-1 text-3xl font-black text-white">Hoy</h2>
          <p className="mt-1 text-sm text-slate-400">
            {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button type="button" onClick={onGoToTurnos} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-extrabold text-white transition hover:brightness-110">
            <Plus className="h-4 w-4" /> Nuevo turno
          </button>
          {canUseCaja && (
            <button type="button" onClick={onGoToCaja} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/20">
              <WalletCards className="h-4 w-4" /> Cobrar
            </button>
          )}
          {canUseClients && (
            <button type="button" onClick={onGoToClientes} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/10">
              <Search className="h-4 w-4" /> Buscar cliente
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button type="button" onClick={onGoToTurnos} className="glass-panel rounded-xl p-4 text-left transition hover:border-cyan-400/30">
          <CalendarDays className="h-5 w-5 text-cyan-300" />
          <span className="mt-3 block text-2xl font-black text-white">{turnosHoy.length}</span>
          <span className="text-xs text-slate-400">Turnos de hoy</span>
        </button>
        <button type="button" onClick={onGoToTurnos} className="glass-panel rounded-xl p-4 text-left transition hover:border-amber-400/30">
          <Car className="h-5 w-5 text-amber-300" />
          <span className="mt-3 block text-2xl font-black text-white">{enProceso.length}</span>
          <span className="text-xs text-slate-400">En proceso</span>
        </button>
        <button type="button" onClick={onGoToTurnos} className="glass-panel rounded-xl p-4 text-left transition hover:border-emerald-400/30">
          <CheckCircle2 className="h-5 w-5 text-emerald-300" />
          <span className="mt-3 block text-2xl font-black text-white">{listos.length}</span>
          <span className="text-xs text-slate-400">Listos para entregar</span>
        </button>
        <button type="button" onClick={canUseCaja ? onGoToCaja : undefined} className="glass-panel rounded-xl p-4 text-left transition hover:border-emerald-400/30">
          <DollarSign className="h-5 w-5 text-emerald-300" />
          <span className="mt-3 block text-xl font-black text-white">${ingresos.toLocaleString('es-AR')}</span>
          <span className="text-xs text-slate-400">{cajaAbierta ? 'Caja abierta' : 'Caja cerrada'}</span>
        </button>
      </div>

      {(stockBajo > 0 || !cajaAbierta) && (
        <div className="flex flex-col gap-2 sm:flex-row">
          {!cajaAbierta && canUseCaja && (
            <button type="button" onClick={onGoToCaja} className="flex flex-1 items-center gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-left text-sm text-amber-100">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" /> La caja todavía está cerrada. Abrila antes de cobrar.
            </button>
          )}
          {stockBajo > 0 && (
            <div className="flex flex-1 items-center gap-3 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-100">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-300" /> {stockBajo} insumo{stockBajo === 1 ? '' : 's'} con stock bajo.
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass-panel rounded-xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white">Próximos turnos</h3>
              <p className="text-xs text-slate-400">Pendientes para hoy</p>
            </div>
            <button type="button" onClick={onGoToTurnos} className="text-xs font-bold text-brand-primary hover:text-white">Ver agenda</button>
          </div>
          <div className="space-y-2">
            {proximos.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">No hay turnos pendientes para hoy.</p>
            ) : proximos.map((turno) => (
              <button key={turno.id} type="button" onClick={onGoToTurnos} className="flex w-full items-center justify-between rounded-lg border border-white/5 bg-white/[0.025] p-3 text-left transition hover:bg-white/5">
                <span>
                  <span className="block text-sm font-bold text-white">{turno.clienteNombre}</span>
                  <span className="text-xs text-slate-400">{turno.vehiculoPatente} · {turno.servicioNombre}</span>
                </span>
                <span className="font-mono text-sm font-bold text-cyan-300">{formatTime(turno.fechaCreacion)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white">Listos para entregar</h3>
              <p className="text-xs text-slate-400">Trabajos terminados</p>
            </div>
            <button type="button" onClick={onGoToTurnos} className="text-xs font-bold text-brand-primary hover:text-white">Ver trabajos</button>
          </div>
          <div className="space-y-2">
            {listos.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">No hay vehículos esperando entrega.</p>
            ) : listos.slice(0, 5).map((turno) => (
              <button key={turno.id} type="button" onClick={onGoToTurnos} className="flex w-full items-center justify-between rounded-lg border border-emerald-500/10 bg-emerald-500/5 p-3 text-left transition hover:bg-emerald-500/10">
                <span>
                  <span className="block text-sm font-bold text-white">{turno.vehiculoPatente}</span>
                  <span className="text-xs text-slate-400">{turno.clienteNombre} · {turno.servicioNombre}</span>
                </span>
                <span className="text-xs font-bold text-emerald-300">Listo</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
