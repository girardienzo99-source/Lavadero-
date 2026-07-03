import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, 
  Plus, Check, Play, User, Car, AlertTriangle 
} from 'lucide-react';
import { Turno, Cliente, TipoServicio } from '../types';

interface WeeklyCalendarProps {
  turnos: Turno[];
  clientes: Cliente[];
  onSelectSlot: (date: string, hour: string) => void;
  onUpdateTurnoEstado: (id: string, nuevoEstado: 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADO') => void;
}

export default function WeeklyCalendar({
  turnos,
  clientes,
  onSelectSlot,
  onUpdateTurnoEstado
}: WeeklyCalendarProps) {
  // Week navigation offset (0 = current week, 1 = next week, -1 = previous week)
  const [weekOffset, setWeekOffset] = useState(0);
  
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

  return (
    <div className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)] animate-fade-in">
      
      {/* Calendar Header with Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-[#00d2ff]" />
          <h3 className="font-bold text-white text-sm font-display uppercase tracking-wider">
            Agenda Semanal de Servicios
          </h3>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2 bg-black/30 border border-white/[0.06] p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setWeekOffset(prev => prev - 1)}
            className="p-1 hover:bg-white/[0.05] rounded text-slate-400 hover:text-white transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <span className="text-[10px] font-bold text-slate-300 px-2 uppercase tracking-wide">
            {weekOffset === 0 ? 'Semana Actual' : weekOffset === 1 ? 'Próxima Semana' : `Hace ${Math.abs(weekOffset)} Semana(s)`}
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
        <div className="flex gap-3 text-[9px] uppercase tracking-wider font-bold text-slate-400">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-amber-400" />
            <span>Pendiente</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-[#00d2ff]" />
            <span>Proceso</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-emerald-500" />
            <span>Listo</span>
          </div>
        </div>
      </div>

      {/* Grid wrapper */}
      <div className="overflow-x-auto min-w-0">
        <div className="min-w-[800px] border border-white/[0.06] rounded-xl overflow-hidden bg-slate-950/40">
          
          {/* Header Row */}
          <div className="grid grid-cols-7 border-b border-white/[0.08] bg-white/[0.02]">
            <div className="py-3 px-3 text-center border-r border-white/[0.06] flex items-center justify-center gap-1.5 text-slate-500 font-bold uppercase text-[9px] tracking-wider">
              <Clock className="w-3.5 h-3.5" />
              <span>Hora</span>
            </div>

            {weekDays.map((day) => {
              const dateStr = day.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
              const dayName = day.toLocaleDateString('es-AR', { weekday: 'short' });
              const isToday = new Date().toDateString() === day.toDateString();

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
                  <span className="text-[9px] font-mono text-slate-500 font-semibold mt-0.5">
                    {dateStr}
                  </span>
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
                      className={`p-1.5 border-r border-white/[0.06] last:border-r-0 min-h-[70px] relative flex flex-col gap-1 justify-center transition duration-150 group ${
                        cellTurnos.length === 0 
                          ? 'hover:bg-[#00d2ff]/[0.02] cursor-pointer' 
                          : ''
                      }`}
                    >
                      {/* Plus icon on hover for empty slots */}
                      {cellTurnos.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-150 pointer-events-none">
                          <div className="p-1 rounded bg-[#00d2ff]/20 text-[#00d2ff] border border-[#00d2ff]/30 shadow-[0_0_8px_rgba(0,210,255,0.2)]">
                            <Plus className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      )}

                      {/* Display scheduled turnos */}
                      {cellTurnos.map((t) => (
                        <div 
                          key={t.id}
                          onClick={(e) => e.stopPropagation()} // prevent triggering slot click
                          className={`p-2 rounded-lg border text-left flex flex-col justify-between transition-all duration-200 select-none ${
                            t.estado === 'PENDIENTE' 
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-200 hover:bg-amber-500/15'
                              : t.estado === 'EN_PROCESO'
                              ? 'bg-[#00d2ff]/10 border-[#00d2ff]/30 text-cyan-200 hover:bg-[#00d2ff]/15'
                              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/15'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-1">
                            <span className="font-bold text-[9.5px] truncate font-display leading-tight">
                              {t.clienteNombre.split(' ')[0]}
                            </span>
                            <span className="text-[7.5px] shrink-0 bg-black/40 px-1 py-0.2 rounded font-mono uppercase tracking-widest text-slate-400">
                              {t.tipo.slice(0,3)}
                            </span>
                          </div>

                          <span className="text-[7.5px] text-slate-400 font-mono truncate leading-none mt-1">
                            {t.vehiculoModelo} [{t.vehiculoPatente.slice(0,4)}]
                          </span>

                          <div className="flex justify-between items-center text-[7.5px] font-mono mt-1.5 pt-1.5 border-t border-white/[0.04]">
                            <span className="text-slate-500 truncate max-w-[50px]">{t.lavadorAsignado}</span>
                            
                            {/* Action Buttons to update state directly from cell */}
                            <div className="flex gap-1">
                              {t.estado === 'PENDIENTE' && (
                                <button
                                  type="button"
                                  onClick={() => onUpdateTurnoEstado(t.id, 'EN_PROCESO')}
                                  className="p-0.5 bg-cyan-900/30 border border-cyan-500/30 rounded text-cyan-400 hover:bg-cyan-500/20"
                                  title="Iniciar servicio"
                                >
                                  <Play className="w-2 h-2" />
                                </button>
                              )}
                              {t.estado === 'EN_PROCESO' && (
                                <button
                                  type="button"
                                  onClick={() => onUpdateTurnoEstado(t.id, 'COMPLETADO')}
                                  className="p-0.5 bg-emerald-950/30 border border-emerald-500/30 rounded text-emerald-400 hover:bg-emerald-500/20"
                                  title="Finalizar servicio"
                                >
                                  <Check className="w-2 h-2" />
                                </button>
                              )}
                            </div>
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

    </div>
  );
}
