import React, { useMemo, useState } from 'react';
import { CalendarDays, Car, Phone, Plus, Search, UserRound } from 'lucide-react';
import { Cliente, Turno } from '../types';

interface ClientsViewProps {
  clientes: Cliente[];
  turnos: Turno[];
  onNewClient: () => void;
  onNewAppointment: () => void;
}

export default function ClientsView({ clientes, turnos, onNewClient, onNewAppointment }: ClientsViewProps) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const normalized = query.trim().toLocaleLowerCase('es-AR');
  const filtered = useMemo(() => clientes.filter((cliente) => {
    if (!normalized) return true;
    return [cliente.nombre, cliente.telefono, cliente.vehiculoPatente, cliente.vehiculoModelo]
      .some((value) => value.toLocaleLowerCase('es-AR').includes(normalized));
  }), [clientes, normalized]);
  const selected = clientes.find((cliente) => cliente.id === selectedId) ?? null;
  const history = selected
    ? turnos.filter((turno) => turno.clienteId === selected.id || turno.clienteNombre === selected.nombre)
      .sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime())
    : [];

  return (
    <section className="space-y-5 animate-fade-in" aria-labelledby="clients-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-primary">Personas y vehículos</p>
          <h2 id="clients-title" className="mt-1 text-3xl font-black text-white">Clientes</h2>
          <p className="mt-1 text-sm text-slate-400">Buscá por nombre, teléfono, patente o vehículo.</p>
        </div>
        <button type="button" onClick={onNewClient} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-extrabold text-white transition hover:brightness-110">
          <Plus className="h-4 w-4" /> Nuevo cliente
        </button>
      </div>

      <label className="relative block">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
        <span className="sr-only">Buscar clientes</span>
        <input autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, teléfono o patente" className="min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.035] py-3 pl-12 pr-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-brand-primary/60" />
      </label>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <div className="glass-panel overflow-hidden rounded-xl">
          <div className="border-b border-white/5 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">
            {filtered.length} cliente{filtered.length === 1 ? '' : 's'}
          </div>
          <div className="max-h-[620px] divide-y divide-white/5 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">No encontramos clientes con esa búsqueda.</p>
            ) : filtered.map((cliente) => (
              <button key={cliente.id} type="button" onClick={() => setSelectedId(cliente.id)} className={`flex w-full items-center gap-3 p-4 text-left transition hover:bg-white/5 ${selected?.id === cliente.id ? 'bg-brand-primary/10' : ''}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-slate-300"><UserRound className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-white">{cliente.nombre}</span>
                  <span className="block truncate text-xs text-slate-400">{cliente.vehiculoPatente || 'Sin patente'} · {cliente.vehiculoModelo || 'Sin vehículo'}</span>
                </span>
                <span className="hidden text-xs text-slate-500 sm:block">{cliente.visitas} visitas</span>
              </button>
            ))}
          </div>
        </div>

        <aside className="glass-panel rounded-xl p-5">
          {!selected ? (
            <div className="flex min-h-56 flex-col items-center justify-center text-center">
              <UserRound className="mb-3 h-9 w-9 text-slate-600" />
              <p className="text-sm font-bold text-slate-300">Seleccioná un cliente</p>
              <p className="mt-1 text-xs text-slate-500">Verás sus datos, vehículos e historial.</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h3 className="text-xl font-black text-white">{selected.nombre}</h3>
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-brand-primary" /> {selected.telefono || 'Sin teléfono'}</p>
                  <p className="flex items-center gap-2"><Car className="h-4 w-4 text-brand-primary" /> {selected.vehiculoPatente} · {selected.vehiculoModelo}</p>
                </div>
              </div>
              <button type="button" onClick={onNewAppointment} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-extrabold text-white">
                <CalendarDays className="h-4 w-4" /> Crear turno
              </button>
              <div>
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Historial</h4>
                <div className="space-y-2">
                  {history.length === 0 ? <p className="text-sm text-slate-500">Todavía no tiene turnos registrados.</p> : history.slice(0, 8).map((turno) => (
                    <div key={turno.id} className="rounded-lg border border-white/5 bg-black/15 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-bold text-white">{turno.servicioNombre}</span>
                        <span className="text-[10px] font-bold uppercase text-slate-400">{turno.estado.replace('_', ' ')}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{new Date(turno.fechaCreacion).toLocaleDateString('es-AR')} · ${turno.precio.toLocaleString('es-AR')}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
