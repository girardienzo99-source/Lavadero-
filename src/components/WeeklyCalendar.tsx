import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, 
  Plus, Check, Play, User, Car, AlertTriangle, X, Trash2, MessageSquare, Save, ArrowRight, UserCheck, DollarSign
} from 'lucide-react';
import { Turno, Cliente, TipoServicio } from '../types';
import { LAVADORES_ACTIVOS } from '../data/initialData';
import CarDamageInspection from './CarDamageInspection';

interface WeeklyCalendarProps {
  turnos: Turno[];
  clientes: Cliente[];
  onSelectSlot: (date: string, hour: string) => void;
  onUpdateTurnoEstado: (id: string, nuevoEstado: any, nps?: number, comentarios?: string) => void;
  onDeleteTurno: (id: string) => void;
  onUpdateTurno?: (updatedTurno: Turno) => void;
  onSendWhatsApp?: (turno: Turno) => void;
}

const ALLOWED_TURNO_TRANSITIONS: Record<Turno['estado'], Turno['estado'][]> = {
  PENDIENTE: ['EN_PROCESO'],
  EN_PROCESO: ['PENDIENTE', 'COMPLETADO'],
  COMPLETADO: ['EN_PROCESO', 'ENTREGADO'],
  ENTREGADO: ['COMPLETADO'],
};

export default function WeeklyCalendar({
  turnos,
  clientes,
  onSelectSlot,
  onUpdateTurnoEstado,
  onDeleteTurno,
  onUpdateTurno,
  onSendWhatsApp
}: WeeklyCalendarProps) {
  // Week navigation offset (0 = current week, 1 = next week, -1 = previous week)
  const [weekOffset, setWeekOffset] = useState(0);
  
  // Selected turno for detail popup modal
  const [selectedTurno, setSelectedTurno] = useState<Turno | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showDamageInspection, setShowDamageInspection] = useState(false);

  // Edit states for rescheduling
  const [editWasher, setEditWasher] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editHour, setEditHour] = useState('');
  
  // Hours to show in agenda (08:00 to 20:00)
  const hours = [
    '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', 
    '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
  ];

  // Calculate Monday-Saturday dates for the current offset
  const getWeekDays = () => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 is Sunday, 1 is Monday...
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay; // Offset to get to Monday
    
    const days = [];
    for (let i = 0; i < 6; i++) { // Monday to Saturday
      const d = new Date(today);
      d.setDate(today.getDate() + mondayOffset + i + (weekOffset * 7));
      days.push(d);
    }
    return days;
  };

  const weekDays = getWeekDays();

  // Helper to format date as YYYY-MM-DD
  const formatDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to calculate daily occupancy (max 8 turnos per day)
  const getDailyOccupancy = (day: Date) => {
    const dateKey = formatDateKey(day);
    const dayTurnos = turnos.filter((t) => {
      if (t.lavadorAsignado === 'Sin Asignar (Online)') return false;
      try {
        const tDate = new Date(t.fechaCreacion);
        return formatDateKey(tDate) === dateKey;
      } catch (e) {
        return false;
      }
    });
    const count = dayTurnos.length;
    const maxCapacity = 8;
    const percent = Math.min(100, Math.round((count / maxCapacity) * 100));
    return { count, maxCapacity, percent };
  };

  // Find turnos scheduled for a specific date key and hour slot
  const getTurnosForSlot = (dateKey: string, hourStr: string) => {
    const targetHour = parseInt(hourStr.split(':')[0], 10);
    
    return turnos.filter((t) => {
      if (t.lavadorAsignado === 'Sin Asignar (Online)') return false; // exclude unassigned online bookings
      
      try {
        const tDate = new Date(t.fechaCreacion);
        const tDateKey = formatDateKey(tDate);
        const tHour = tDate.getHours();
        
        return tDateKey === dateKey && tHour === targetHour;
      } catch (e) {
        return false;
      }
    });
  };

  // Find index of today in weekDays to select it by default on mobile
  const getTodayIdx = () => {
    const todayStr = new Date().toDateString();
    const idx = weekDays.findIndex(d => d.toDateString() === todayStr);
    return idx === -1 ? 0 : idx;
  };

  const [selectedDayIndex, setSelectedDayIndex] = useState(getTodayIdx);

  const handleCardClick = (t: Turno) => {
    setSelectedTurno(t);
    setConfirmDelete(false);
    setShowDamageInspection(false);
    setEditWasher(t.lavadorAsignado);
    
    try {
      const d = new Date(t.fechaCreacion);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      setEditDate(`${year}-${month}-${day}`);
      
      const hourVal = String(d.getHours()).padStart(2, '0') + ':00';
      setEditHour(hourVal);
    } catch (e) {
      setEditDate('');
      setEditHour('');
    }
  };

  const handleSaveChanges = () => {
    if (!selectedTurno || !onUpdateTurno) return;
    
    const newDateTime = `${editDate}T${editHour}:00`;
    
    const updated: Turno = {
      ...selectedTurno,
      lavadorAsignado: editWasher,
      fechaCreacion: newDateTime
    };
    
    onUpdateTurno(updated);
    setSelectedTurno(null);
  };

  const handleStateTransition = (newState: any) => {
    if (!selectedTurno) return;
    if (!ALLOWED_TURNO_TRANSITIONS[selectedTurno.estado].includes(newState)) return;
    onUpdateTurnoEstado(selectedTurno.id, newState);
    setSelectedTurno(prev => prev ? { ...prev, estado: newState } : null);
  };

  return (
    <div className="glass-panel p-4 md:p-5 rounded-xl border border-white/[0.08] space-y-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)] animate-fade-in relative z-20">
      
      {/* Calendar Header with Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-brand-primary" />
          <h3 className="font-extrabold text-white text-xs uppercase tracking-widest font-display">
            Agenda Semanal
          </h3>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2 bg-black/30 border border-white/[0.06] p-1 rounded-lg font-mono">
          <button
            type="button"
            onClick={() => setWeekOffset(prev => prev - 1)}
            className="p-1 hover:bg-white/[0.05] rounded text-slate-400 hover:text-white transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <span className="text-[10px] font-bold text-slate-300 px-2.5 uppercase tracking-wider font-mono">
            {weekOffset === 0 ? 'Semana Actual' : weekOffset === 1 ? 'Próxima Semana' : `Semana Offset: ${weekOffset}`}
          </span>

          <button
            type="button"
            onClick={() => setWeekOffset(prev => prev + 1)}
            className="p-1 hover:bg-white/[0.05] rounded text-slate-400 hover:text-white transition cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Legend */}
        <div className="flex gap-3 text-[9px] uppercase tracking-wider font-bold text-slate-400 font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-amber-400/20 border border-amber-400/50" />
            <span>Pendiente</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-cyan-500/20 border border-cyan-500/50" />
            <span>Proceso</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-emerald-500/20 border border-emerald-500/50" />
            <span>Listo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-slate-500/20 border border-slate-500/50" />
            <span>Entregado</span>
          </div>
        </div>
      </div>

      {/* Mobile Day Selector Tabs (Visible only on mobile/tablet) */}
      <div className="md:hidden flex gap-1.5 overflow-x-auto pb-2 scrollbar-none border-b border-white/[0.04]">
        {weekDays.map((day, idx) => {
          const isSelected = selectedDayIndex === idx;
          const dayName = day.toLocaleDateString('es-AR', { weekday: 'short' });
          const dateStr = day.toLocaleDateString('es-AR', { day: '2-digit' });
          const isToday = new Date().toDateString() === day.toDateString();
          const { count, percent } = getDailyOccupancy(day);

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => setSelectedDayIndex(idx)}
              className={`flex-1 min-w-[60px] py-2 px-1 rounded-lg border text-center transition flex flex-col items-center justify-center cursor-pointer ${
                isSelected
                  ? 'bg-brand-primary/10 border-brand-primary text-white shadow-[0_0_10px_rgba(255,255,255,0.05)]'
                  : 'bg-black/30 border-white/[0.06] text-slate-400 hover:text-slate-200'
              }`}
              title={`${count} turnos agendados (${percent}% de ocupación)`}
            >
              <span className={`text-[8.5px] font-black uppercase ${isToday && !isSelected ? 'text-brand-primary' : ''}`}>
                {dayName}
              </span>
              <span className="text-xs font-black mt-0.5">{dateStr}</span>
              
              {/* Mini occupancy bar */}
              <div className="w-8 h-1 bg-white/[0.08] rounded-full mt-1.5 overflow-hidden border border-white/[0.04]">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    percent >= 90
                      ? 'bg-purple-500'
                      : percent >= 70
                      ? 'bg-red-400'
                      : percent >= 40
                      ? 'bg-amber-400'
                      : count > 0
                      ? 'bg-emerald-400'
                      : 'bg-transparent'
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* DESKTOP VIEW: Full 7-column week grid */}
      <div className="hidden md:block overflow-x-auto min-w-0">
        <div className="min-w-[950px] border border-white/[0.06] rounded-xl overflow-hidden bg-slate-950/40 shadow-inner">
          
          {/* Header Row */}
          <div className="grid grid-cols-7 border-b border-white/[0.08] bg-white/[0.02] sticky top-0 backdrop-blur-sm z-10">
            <div className="py-3 px-3 text-center border-r border-white/[0.06] flex items-center justify-center gap-1.5 text-slate-500 font-bold uppercase text-[9px] tracking-wider font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Hora</span>
            </div>

            {weekDays.map((day) => {
              const dateStr = day.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
              const dayName = day.toLocaleDateString('es-AR', { weekday: 'short' });
              const isToday = new Date().toDateString() === day.toDateString();
              const { count, percent } = getDailyOccupancy(day);

              return (
                <div 
                  key={day.toISOString()} 
                  className={`py-2 text-center border-r border-white/[0.06] last:border-r-0 flex flex-col justify-center items-center ${
                    isToday ? 'bg-brand-primary/10 border-b-2 border-b-brand-primary' : ''
                  }`}
                >
                  <span className={`text-[10px] font-black uppercase tracking-wider ${isToday ? 'text-brand-primary' : 'text-slate-300'}`}>
                    {dayName}
                  </span>
                  <span className="text-[9px] font-mono text-slate-500 font-bold mt-0.5">
                    {dateStr}
                  </span>
                  
                  {/* Occupancy Indicator */}
                  <div className="w-16 mt-1.5 flex flex-col items-center gap-0.5 cursor-help" title={`${count} turnos agendados (${percent}% de ocupación)`}>
                    <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden border border-white/[0.04]">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          percent >= 90
                            ? 'bg-purple-500 shadow-[0_0_6px_rgba(168,85,247,0.4)]'
                            : percent >= 70
                            ? 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.4)]'
                            : percent >= 40
                            ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.4)]'
                            : count > 0
                            ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]'
                            : 'bg-transparent'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="text-[7.5px] font-mono font-bold text-slate-500">
                      {count === 0 ? 'Vacío' : `${count}/8 turnos`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time Slot Rows */}
          <div className="divide-y divide-white/[0.04]">
            {hours.map((hour) => (
              <div key={hour} className="grid grid-cols-7 hover:bg-white/[0.005] transition duration-150">
                
                {/* Hour indicator cell */}
                <div className="py-4 px-2 text-center border-r border-white/[0.06] flex justify-center items-center font-mono font-bold text-slate-400 text-xs bg-white/[0.005]">
                  {hour} hs
                </div>

                {/* Day columns for this hour */}
                {weekDays.map((day) => {
                  const dateKey = formatDateKey(day);
                  const cellTurnos = getTurnosForSlot(dateKey, hour);

                  return (
                    <div 
                      key={dateKey} 
                      onClick={() => cellTurnos.length === 0 && onSelectSlot(dateKey, hour)}
                      className={`p-1.5 border-r border-white/[0.06] last:border-r-0 min-h-[75px] relative flex flex-col gap-1.5 justify-start overflow-y-auto max-h-[140px] transition duration-150 group scrollbar-thin ${
                        cellTurnos.length === 0 
                          ? 'hover:bg-brand-primary/[0.02] cursor-pointer' 
                          : 'bg-white/[0.002]'
                      }`}
                    >
                      {/* Plus icon on hover for empty slots */}
                      {cellTurnos.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-150 pointer-events-none">
                          <div className="p-1 rounded bg-brand-primary/20 text-brand-primary border border-brand-primary/30 shadow-[0_0_8px_rgba(255,255,255,0.04)]">
                            <Plus className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      )}

                      {/* Display scheduled turnos in compact badges */}
                      {cellTurnos.map((t) => (
                        <div 
                          key={t.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCardClick(t);
                          }}
                          className={`p-1.5 rounded-lg border text-left flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98] select-none ${
                            t.estado === 'PENDIENTE' 
                              ? 'bg-amber-500/10 hover:bg-amber-500/15 border-amber-500/30 text-amber-200'
                              : t.estado === 'EN_PROCESO'
                              ? 'bg-[#00d2ff]/10 hover:bg-[#00d2ff]/15 border-[#00d2ff]/30 text-cyan-200 shadow-[0_0_8px_rgba(0,210,255,0.08)]'
                              : t.estado === 'ENTREGADO'
                              ? 'bg-slate-500/10 hover:bg-slate-500/15 border-slate-500/30 text-slate-400 line-through'
                              : 'bg-emerald-500/10 hover:bg-emerald-500/15 border-emerald-500/30 text-emerald-200 shadow-[0_0_8px_rgba(16,185,129,0.08)]'
                          }`}
                        >
                          <div className="flex justify-between items-center gap-1">
                            <span className="font-bold text-[9.5px] truncate font-display leading-tight flex items-center gap-1">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                t.estado === 'PENDIENTE' ? 'bg-amber-400' : t.estado === 'EN_PROCESO' ? 'bg-cyan-400' : t.estado === 'ENTREGADO' ? 'bg-slate-500' : 'bg-emerald-400'
                              }`} />
                              {t.clienteNombre.split(' ')[0]}
                            </span>
                            <span className="text-[7.5px] shrink-0 bg-black/45 px-1 py-0.2 rounded font-mono uppercase tracking-widest text-slate-400">
                              {t.tipo.slice(0,3)}
                            </span>
                          </div>

                          <div className="flex justify-between items-end mt-1 text-[7.5px] font-mono text-slate-400 font-semibold">
                            <span className="truncate max-w-[90px]">{t.vehiculoModelo}</span>
                            <span className="text-[7px] text-slate-500">[{t.vehiculoPatente.slice(-4).toUpperCase()}]</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MOBILE VIEW: Single day vertical view */}
      <div className="md:hidden border border-white/[0.06] rounded-xl overflow-hidden bg-slate-950/40 divide-y divide-white/[0.04]">
        {hours.map((hour) => {
          const selectedDay = weekDays[selectedDayIndex];
          const dateKey = formatDateKey(selectedDay);
          const cellTurnos = getTurnosForSlot(dateKey, hour);
          return (
            <div key={hour} className="flex hover:bg-white/[0.005] transition duration-150 p-2 items-center gap-3">
              {/* Hour Column */}
              <div className="w-16 shrink-0 text-center font-mono font-bold text-slate-400 text-xs py-2 bg-white/[0.005] rounded-lg border border-white/[0.04]">
                {hour}
              </div>
              
              {/* Content Column */}
              <div 
                onClick={() => cellTurnos.length === 0 && onSelectSlot(dateKey, hour)}
                className={`flex-1 min-h-[50px] relative flex flex-col gap-1.5 justify-center transition duration-150 rounded-lg p-1 ${
                  cellTurnos.length === 0 ? 'hover:bg-brand-primary/[0.02] cursor-pointer' : ''
                }`}
              >
                {cellTurnos.length === 0 ? (
                  <div className="text-[10px] text-slate-600 font-medium italic pl-1 flex items-center gap-1 font-mono">
                    <Plus className="w-3 h-3 text-slate-600" />
                    <span>Disponible</span>
                  </div>
                ) : (
                  cellTurnos.map((t) => (
                    <div 
                      key={t.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCardClick(t);
                      }}
                      className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition-all duration-200 cursor-pointer select-none ${
                        t.estado === 'PENDIENTE' 
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                          : t.estado === 'EN_PROCESO'
                          ? 'bg-[#00d2ff]/10 border-[#00d2ff]/30 text-cyan-200'
                          : t.estado === 'ENTREGADO'
                          ? 'bg-slate-500/10 border-slate-500/30 text-slate-400 line-through'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-1">
                        <span className="font-bold text-xs font-display leading-tight flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            t.estado === 'PENDIENTE' ? 'bg-amber-400' : t.estado === 'EN_PROCESO' ? 'bg-cyan-400' : t.estado === 'ENTREGADO' ? 'bg-slate-500' : 'bg-emerald-400'
                          }`} />
                          {t.clienteNombre}
                        </span>
                        <span className="text-[7.5px] shrink-0 bg-black/40 px-1.5 py-0.5 rounded font-mono uppercase tracking-widest text-slate-400">
                          {t.tipo}
                        </span>
                      </div>

                      <span className="text-[9px] text-slate-400 font-mono mt-1">
                        🚗 {t.vehiculoModelo} [{t.vehiculoPatente}]
                      </span>

                      <div className="flex justify-between items-center text-[9px] font-mono mt-2 pt-2 border-t border-white/[0.04] text-slate-500">
                        <span>Operario: {t.lavadorAsignado}</span>
                        <span className="font-extrabold text-emerald-400">${t.precio.toLocaleString('es-AR')}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* APPOINTMENT INTERACTIVE DETAIL & RESCHEDULE MODAL */}
      {selectedTurno && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex justify-center items-center p-4 overflow-y-auto animate-fade-in">
          <div className="glass-panel p-6 rounded-2xl border border-white/[0.08] w-full max-w-lg space-y-5 relative shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
            
            <button 
              type="button" 
              onClick={() => setSelectedTurno(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white bg-black/50 hover:bg-black/80 p-1.5 rounded-full border border-white/[0.08] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div>
              <span className="text-[9px] uppercase tracking-widest text-brand-primary font-bold font-mono">Detalle del Turno</span>
              <h3 className="text-base font-extrabold text-white uppercase tracking-wider font-display mt-0.5">
                {selectedTurno.clienteNombre}
              </h3>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {selectedTurno.id}</p>
            </div>

            {/* Client & Car Card */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3.5 grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <div>
                  <span className="text-[8px] uppercase tracking-widest text-slate-500 font-bold block">Vehículo</span>
                  <span className="font-bold text-white flex items-center gap-1.5 mt-0.5">
                    <Car className="w-3.5 h-3.5 text-brand-primary" />
                    {selectedTurno.vehiculoModelo}
                  </span>
                </div>
                <div>
                  <span className="text-[8px] uppercase tracking-widest text-slate-500 font-bold block">Patente / Placa</span>
                  <span className="font-mono text-brand-primary uppercase font-bold tracking-widest block mt-0.5">
                    {selectedTurno.vehiculoPatente}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <span className="text-[8px] uppercase tracking-widest text-slate-500 font-bold block">Servicio Solicitado</span>
                  <span className="font-bold text-slate-200 block mt-0.5">{selectedTurno.servicioNombre}</span>
                </div>
                <div>
                  <span className="text-[8px] uppercase tracking-widest text-slate-500 font-bold block">Precio de Lista</span>
                  <span className="font-mono font-bold text-emerald-400 flex items-center gap-0.5 mt-0.5">
                    <DollarSign className="w-3.5 h-3.5" />
                    {selectedTurno.precio.toLocaleString('es-AR')}
                  </span>
                </div>
              </div>
            </div>

            {/* Inspección de Vehículo (Control de Daños) */}
            <button
              type="button"
              onClick={() => setShowDamageInspection(true)}
              className="w-full bg-amber-500/10 hover:bg-amber-500/20 active:bg-amber-500/30 border border-amber-500/30 text-amber-400 font-bold py-2 rounded-xl text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              📋 Inspección de Vehículo / Control de Daños
            </button>

            {/* Action State Transition Buttons */}
            <div className="space-y-1.5">
              <label className="block text-[9px] text-slate-500 uppercase tracking-widest font-bold">Estado del Vehículo</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['PENDIENTE', 'EN_PROCESO', 'COMPLETADO', 'ENTREGADO'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    disabled={selectedTurno.estado === st || !ALLOWED_TURNO_TRANSITIONS[selectedTurno.estado].includes(st)}
                    onClick={() => handleStateTransition(st)}
                    className={`py-1.5 text-[9px] font-black uppercase rounded-lg border transition cursor-pointer ${
                      selectedTurno.estado === st
                        ? st === 'PENDIENTE'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                          : st === 'EN_PROCESO'
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                          : st === 'ENTREGADO'
                          ? 'bg-slate-500/20 border-slate-500 text-slate-400'
                          : 'bg-emerald-500/20 border-emerald-500 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                        : 'bg-black/35 border-white/[0.06] text-slate-400 hover:text-white'
                    }`}
                  >
                    {st === 'PENDIENTE' ? 'Pendiente' : st === 'EN_PROCESO' ? 'Proceso' : st === 'COMPLETADO' ? 'Listo' : 'Entregado'}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-white/[0.06] pt-4 grid grid-cols-2 gap-4">
              {/* Reschedule fields */}
              <div className="space-y-3.5">
                <h4 className="text-[10px] font-black text-brand-primary uppercase tracking-wider flex items-center gap-1 border-b border-white/[0.04] pb-1">
                  <UserCheck className="w-3.5 h-3.5" />
                  Operador & Fecha
                </h4>

                <div className="space-y-1">
                  <label className="block text-[8px] text-slate-400 uppercase tracking-widest font-bold">Asignar Operario</label>
                  <select
                    value={editWasher}
                    onChange={(e) => setEditWasher(e.target.value)}
                    className="w-full bg-slate-900 border border-white/[0.1] focus:outline-none rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    {LAVADORES_ACTIVOS.map((lav) => (
                      <option key={lav} value={lav} className="bg-slate-950 text-white">{lav}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[8px] text-slate-400 uppercase tracking-widest font-bold">Día de Reserva</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full bg-slate-900 border border-white/[0.1] focus:outline-none rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[8px] text-slate-400 uppercase tracking-widest font-bold">Hora de Reserva</label>
                  <select
                    value={editHour}
                    onChange={(e) => setEditHour(e.target.value)}
                    className="w-full bg-slate-900 border border-white/[0.1] focus:outline-none rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                  >
                    {hours.map(h => (
                      <option key={h} value={h} className="bg-slate-950 text-white">{h} hs</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* CRM / Notification actions */}
              <div className="space-y-3.5 flex flex-col justify-between">
                <div>
                  <h4 className="text-[10px] font-black text-brand-primary uppercase tracking-wider flex items-center gap-1 border-b border-white/[0.04] pb-1">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Notificaciones
                  </h4>
                  
                  <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                    Envía avisos de turno directamente al WhatsApp del cliente registrado en el sistema.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  {onSendWhatsApp && (
                    <button
                      type="button"
                      onClick={() => onSendWhatsApp(selectedTurno)}
                      className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 active:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 font-extrabold py-2 rounded-lg text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Avisar por WhatsApp
                    </button>
                  )}

                  {confirmDelete ? (
                    <div className="flex gap-1.5 animate-pulse">
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteTurno(selectedTurno.id);
                          setSelectedTurno(null);
                        }}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-lg text-[10px] uppercase tracking-wider cursor-pointer"
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 rounded-lg text-[10px] uppercase tracking-wider cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="w-full bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 border border-red-500/30 text-red-400 font-extrabold py-2 rounded-lg text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Eliminar Turno
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="border-t border-white/[0.06] pt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedTurno(null)}
                className="px-4 py-2 bg-slate-850 hover:bg-slate-800 border border-white/[0.08] text-slate-300 font-bold rounded-lg text-[10px] uppercase tracking-wider cursor-pointer"
              >
                Cerrar
              </button>
              {onUpdateTurno && (
                <button
                  type="button"
                  onClick={handleSaveChanges}
                  className="px-4 py-2 bg-brand-primary hover:bg-brand-hover text-white font-black rounded-lg text-[10px] uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-[0_2px_10px_rgba(220,38,38,0.25)]"
                >
                  <Save className="w-3.5 h-3.5" />
                  Guardar Cambios
                </button>
              )}
            </div>

          </div>

          {showDamageInspection && (
            <CarDamageInspection
              turnoId={selectedTurno.id}
              clienteNombre={selectedTurno.clienteNombre}
              vehiculoModelo={selectedTurno.vehiculoModelo}
              vehiculoPatente={selectedTurno.vehiculoPatente}
              onClose={() => setShowDamageInspection(false)}
            />
          )}
        </div>
      )}

    </div>
  );
}
