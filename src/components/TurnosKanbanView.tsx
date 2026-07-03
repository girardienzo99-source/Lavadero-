import React, { useState } from 'react';
import { 
  Plus, Play, CheckCircle2, Star, Calendar, MessageSquare, 
  Printer, Trash2, ArrowRight, User, Car, Phone, Scissors, Sparkles, Droplet, Clock, ChevronRight, Download,
  ClipboardList, ShieldAlert, ShieldCheck, Shield, AlertTriangle, X
} from 'lucide-react';
import { Turno, Cliente, TipoServicio, VehicleHealthData } from '../types';
import { LAVADORES_ACTIVOS, SERVICIOS_DISPONIBLES } from '../data/initialData';
import { generateTicketPDF } from '../utils/ticketGenerator';
import VehicleHealth from './VehicleHealth';
import WeeklyCalendar from './WeeklyCalendar';

interface TurnosKanbanViewProps {
  turnos: Turno[];
  clientes: Cliente[];
  onAddTurno: (newTurno: Turno) => void;
  onUpdateTurnoEstado: (id: string, nuevoEstado: 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADO', nps?: number, comentarios?: string) => void;
  onDeleteTurno: (id: string) => void;
  onAddLog: (message: string) => void;
  onUpdateTurno?: (updatedTurno: Turno) => void;
}

export default function TurnosKanbanView({
  turnos,
  clientes,
  onAddTurno,
  onUpdateTurnoEstado,
  onDeleteTurno,
  onAddLog,
  onUpdateTurno,
}: TurnosKanbanViewProps) {
  // Filters & Tabs
  const [filterType, setFilterType] = useState<TipoServicio | 'ALL'>('ALL');
  const [viewMode, setViewMode] = useState<'kanban' | 'calendar'>('kanban');

  // Form states
  const [selectedClienteId, setSelectedClienteId] = useState(clientes[0]?.id || '');
  const [selectedTipoServicio, setSelectedTipoServicio] = useState<TipoServicio>('LAVADO');
  
  // Auto-derived lists
  const currentCliente = clientes.find((c) => c.id === selectedClienteId);
  const serviciosDeTipo = SERVICIOS_DISPONIBLES[selectedTipoServicio];
  
  const [selectedServicioNombre, setSelectedServicioNombre] = useState(serviciosDeTipo[0]?.nombre || '');
  const [selectedLavador, setSelectedLavador] = useState(LAVADORES_ACTIVOS[0]);
  const [customPriceInput, setCustomPriceInput] = useState('');
  const [turnoFechaInput, setTurnoFechaInput] = useState(new Date().toISOString().split('T')[0]);
  const [turnoHoraInput, setTurnoHoraInput] = useState('09:00');
  const [showVehicleHistoryModal, setShowVehicleHistoryModal] = useState(false);
  const [searchHistoryPatente, setSearchHistoryPatente] = useState('');
  const [selectedHistoryPatente, setSelectedHistoryPatente] = useState<string | null>(null);

  // Active service price helper
  const activeServiceObj = serviciosDeTipo.find((s) => s.nombre === selectedServicioNombre);
  const currentBasePrice = activeServiceObj ? activeServiceObj.precioBase : 0;
  
  // Feedback popup states
  const [feedbackTurnoId, setFeedbackTurnoId] = useState<string | null>(null);
  const [ratingInput, setRatingInput] = useState(5);
  const [commentsInput, setCommentsInput] = useState('');

  // Ticket Preview modal states
  const [ticketTurno, setTicketTurno] = useState<Turno | null>(null);

  // Vehicle Health Inspection States
  const [showInspectionEditor, setShowInspectionEditor] = useState(false);
  const [activeInspectionData, setActiveInspectionData] = useState<VehicleHealthData | null>(null);
  const [selectedViewHealth, setSelectedViewHealth] = useState<VehicleHealthData | null>(null);

  // Form toggles
  const [showAddForm, setShowAddForm] = useState(false);

  // Auto-adjust service options when category changes
  const handleCategoryChange = (cat: TipoServicio) => {
    setSelectedTipoServicio(cat);
    const newServices = SERVICIOS_DISPONIBLES[cat];
    setSelectedServicioNombre(newServices[0]?.nombre || '');
    setCustomPriceInput('');
  };

  const handleCreateTurno = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCliente) return;

    const finalPrice = customPriceInput ? Number(customPriceInput) : currentBasePrice;

    const scheduledDateTime = new Date(`${turnoFechaInput}T${turnoHoraInput}:00`);

    const newT: Turno = {
      id: `t_${Date.now()}`,
      clienteId: currentCliente.id,
      clienteNombre: currentCliente.nombre,
      telefono: currentCliente.telefono,
      vehiculoPatente: currentCliente.vehiculoPatente,
      vehiculoModelo: currentCliente.vehiculoModelo,
      tipo: selectedTipoServicio,
      servicioNombre: selectedServicioNombre,
      lavadorAsignado: selectedLavador,
      estado: 'PENDIENTE',
      precio: finalPrice,
      fechaCreacion: scheduledDateTime.toISOString(),
      healthData: activeInspectionData || undefined,
    };

    onAddTurno(newT);
    setShowAddForm(false);
    setActiveInspectionData(null);
    onAddLog(`📅 Turno agendado: ${newT.clienteNombre} (${newT.vehiculoPatente}) para ${newT.servicioNombre} con ${newT.lavadorAsignado}. Estado: PENDIENTE.`);
  };

  const triggerStartTurno = (t: Turno) => {
    onUpdateTurnoEstado(t.id, 'EN_PROCESO');
    onAddLog(`⚙️ Trabajo iniciado: El vehículo de ${t.clienteNombre} (Patente ${t.vehiculoPatente}) ingresa a la fosa. Lavador: ${t.lavadorAsignado}.`);
  };

  const triggerCompleteTurno = (t: Turno) => {
    setFeedbackTurnoId(t.id);
  };

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (feedbackTurnoId) {
      onUpdateTurnoEstado(feedbackTurnoId, 'COMPLETADO', ratingInput, commentsInput);
      const targetT = turnos.find((t) => t.id === feedbackTurnoId);
      if (targetT) {
        onAddLog(`✅ Trabajo completado: ${targetT.clienteNombre} (${targetT.vehiculoPatente}) está listo para retiro. Calificación NPS registrada: ${ratingInput} ⭐.`);
        
        // AUTOMATICALLY NOTIFY CLIENT VIA WHATSAPP ON RETIREMENT
        setTimeout(() => {
          handleSendWhatsApp({ ...targetT, estado: 'COMPLETADO' });
        }, 800);
      }
      setFeedbackTurnoId(null);
      setRatingInput(5);
      setCommentsInput('');
    }
  };

  const handleSendWhatsApp = (t: Turno) => {
    const templateReady = localStorage.getItem('albelo_whatsapp_template_ready') ||
      '¡Hola {{1}}! Te informamos que tu vehículo {{2}} (patente {{3}}) ya se encuentra listo para retirar en Albelo Detail. Servicio: {{4}}. ¡Te esperamos!';
    const templateConfirm = localStorage.getItem('albelo_whatsapp_template_confirm') ||
      'Hola {{1}}, te confirmamos el turno en Albelo Detail para tu auto patente {{2}} para el servicio: {{3}}.';

    const text = t.estado === 'PENDIENTE' 
      ? templateConfirm
          .replace('{{1}}', t.clienteNombre)
          .replace('{{2}}', t.vehiculoPatente.toUpperCase())
          .replace('{{3}}', t.servicioNombre)
      : templateReady
          .replace('{{1}}', t.clienteNombre)
          .replace('{{2}}', t.vehiculoModelo || 'S/D')
          .replace('{{3}}', t.vehiculoPatente.toUpperCase())
          .replace('{{4}}', t.servicioNombre);
    
    const encoded = encodeURIComponent(text);
    const link = `https://api.whatsapp.com/send?phone=${t.telefono.replace('+', '').replace(/\s/g, '')}&text=${encoded}`;
    
    // Simulate opening link or log
    onAddLog(`📱 WhatsApp enviado a ${t.clienteNombre} (${t.telefono}): "${text}"`);
    window.open(link, '_blank');
  };

  // Local state for tracking dropdown selected operators on online pending cards
  const [assignedOperators, setAssignedOperators] = useState<{ [turnoId: string]: string }>({});

  // Kanban Columns (excluding online approvals pending assignment)
  const pendientes = turnos.filter((t) => t.estado === 'PENDIENTE' && t.lavadorAsignado !== 'Sin Asignar (Online)' && (filterType === 'ALL' || t.tipo === filterType));
  const enProceso = turnos.filter((t) => t.estado === 'EN_PROCESO' && (filterType === 'ALL' || t.tipo === filterType));
  const completados = turnos.filter((t) => t.estado === 'COMPLETADO' && (filterType === 'ALL' || t.tipo === filterType));

  // Online reservation requests pending approval
  const solicitudesOnline = turnos.filter((t) => t.lavadorAsignado === 'Sin Asignar (Online)');

  return (
    <div className="space-y-6">
      
      {/* Category filters & Add Turno button row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white/[0.02] p-3 rounded-xl border border-white/[0.08] relative z-20">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-400 mr-2 uppercase tracking-wider">Filtrar:</span>
          {(['ALL', 'LAVADO', 'TAPICERIA', 'ESTETICA'] as const).map((cat) => (
            <button
              key={cat}
              id={`btn-filter-${cat}`}
              onClick={() => setFilterType(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                filterType === cat
                  ? 'bg-white/[0.05] text-[#00d2ff] border border-[#00d2ff]/30 shadow-[0_0_15px_rgba(0,210,255,0.15)]'
                  : 'bg-white/[0.01] text-slate-400 hover:text-white hover:bg-white/[0.03] border border-white/[0.04]'
              }`}
            >
              {cat === 'ALL' ? 'Todos' : cat === 'LAVADO' ? 'Lavados' : cat === 'TAPICERIA' ? 'Tapicería' : 'Estética'}
            </button>
          ))}
        </div>

        <div className="flex w-full sm:w-auto items-center gap-2">
          <div className="flex bg-black/40 border border-white/[0.08] p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-brand-primary text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Tablero Kanban
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition cursor-pointer ${
                viewMode === 'calendar'
                  ? 'bg-brand-primary text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Agenda Semanal
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowVehicleHistoryModal(true);
              if (clientes.length > 0) {
                setSearchHistoryPatente('');
                setSelectedHistoryPatente(clientes[0].vehiculoPatente);
              }
            }}
            className="flex items-center justify-center gap-1.5 bg-white/[0.03] hover:bg-white/[0.08] text-slate-300 border border-white/[0.08] font-bold px-3 py-2 rounded-lg text-xs transition duration-200 cursor-pointer"
            title="Ver Ficha Clínica e Historial por Patente"
          >
            <ClipboardList className="w-4 h-4 text-brand-primary" />
            Historial Clínico
          </button>

          <button
            id="btn-show-add-turno"
            onClick={() => {
              setShowAddForm(!showAddForm);
              if (clientes.length > 0) {
                setSelectedClienteId(clientes[0].id);
              }
            }}
            className="flex items-center justify-center gap-1.5 bg-[#00d2ff]/20 hover:bg-[#00d2ff]/30 text-[#00d2ff] border border-[#00d2ff]/30 font-bold px-4 py-2 rounded-lg text-xs transition duration-200 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Agendar Nuevo Turno
          </button>
        </div>
      </div>

      {/* Add Turno Form Dropdown Drawer */}
      {showAddForm && (
        <form onSubmit={handleCreateTurno} className="glass-panel p-5 rounded-xl border border-white/[0.08] grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in relative z-20 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          
          {/* Client select with auto-filling vehicle patent & model */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-[#00d2ff] uppercase tracking-widest border-b border-white/[0.08] pb-1.5">1. Cliente y Vehículo</h4>
            
            <div>
              <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Seleccionar Cliente Registrado</label>
              <select
                id="select-turno-cliente"
                value={selectedClienteId}
                onChange={(e) => setSelectedClienteId(e.target.value)}
                className="w-full bg-black/30 border border-white/[0.1] focus:border-[#00d2ff]/60 focus:outline-none rounded-lg px-2.5 py-2 text-xs text-white"
              >
                {clientes.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#0c0f12] text-white">{c.nombre} ({c.vehiculoPatente})</option>
                ))}
              </select>
            </div>

            {currentCliente && (
              <div className="space-y-2">
                <div className="bg-white/[0.02] p-2.5 rounded-lg border border-white/[0.06] text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Auto Vinculado:</span>
                    <span className="text-white font-bold">{currentCliente.vehiculoModelo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Patente:</span>
                    <span className="text-[#00d2ff] font-mono font-bold uppercase">{currentCliente.vehiculoPatente}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Contacto:</span>
                    <span className="text-slate-300 font-mono">{currentCliente.telefono}</span>
                  </div>
                </div>

                {/* Entry inspection button trigger */}
                <button
                  type="button"
                  id="btn-trigger-inspection-editor"
                  onClick={() => setShowInspectionEditor(true)}
                  className={`w-full py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition duration-200 ${
                    activeInspectionData
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25'
                      : 'bg-[#00d2ff]/10 border-[#00d2ff]/20 text-[#00d2ff] hover:bg-[#00d2ff]/20'
                  }`}
                >
                  <ClipboardList className="w-4 h-4" />
                  {activeInspectionData 
                    ? `Inspección de Entrada Lista` 
                    : 'Registrar Inspección de Entrada'}
                </button>

                {activeInspectionData && (
                  <div className="flex items-center justify-between text-[10px] bg-emerald-500/5 border border-emerald-500/10 p-1.5 rounded-lg">
                    <span className="flex items-center gap-1 text-slate-300">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      {Object.values(activeInspectionData.checklistDanos).filter(Boolean).length} daño(s) • Suciedad: {activeInspectionData.nivelSuciedad}
                    </span>
                    <button 
                      type="button" 
                      onClick={() => setActiveInspectionData(null)} 
                      className="text-red-400 hover:text-red-300 font-bold uppercase text-[9px] font-mono"
                    >
                      Remover
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Service selection and custom price overrides */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-[#00d2ff] uppercase tracking-widest border-b border-white/[0.08] pb-1.5">2. Servicio Especializado</h4>
            
            <div className="grid grid-cols-3 gap-1">
              {(['LAVADO', 'TAPICERIA', 'ESTETICA'] as const).map((cat) => (
                <button
                  key={cat}
                  id={`btn-form-cat-${cat}`}
                  type="button"
                  onClick={() => handleCategoryChange(cat)}
                  className={`py-1 text-[10px] font-bold uppercase rounded border transition ${
                    selectedTipoServicio === cat
                      ? 'border-[#00d2ff]/50 bg-[#00d2ff]/15 text-[#00d2ff]'
                      : 'border-white/[0.08] bg-white/[0.02] text-slate-400 hover:text-white'
                  }`}
                >
                  {cat === 'LAVADO' ? 'Lavado' : cat === 'TAPICERIA' ? 'Tapicería' : 'Estética'}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Elegir Servicio del Menú</label>
              <select
                id="select-turno-service"
                value={selectedServicioNombre}
                onChange={(e) => setSelectedServicioNombre(e.target.value)}
                className="w-full bg-black/30 border border-white/[0.1] focus:border-[#00d2ff]/60 focus:outline-none rounded-lg px-2.5 py-2 text-xs text-white"
              >
                {serviciosDeTipo.map((s) => (
                  <option key={s.nombre} value={s.nombre} className="bg-[#0c0f12] text-white">{s.nombre} - ${s.precioBase.toLocaleString('es-AR')}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Precio Personalizado (Opcional, sobreescribir base)</label>
              <div className="relative">
                <input
                  id="input-turno-custom-price"
                  type="number"
                  value={customPriceInput}
                  onChange={(e) => setCustomPriceInput(e.target.value)}
                  placeholder={`Base: $${currentBasePrice}`}
                  className="w-full bg-black/30 border border-white/[0.1] focus:border-[#00d2ff]/60 focus:outline-none rounded-lg pl-7 pr-3 py-2 text-xs text-white font-mono"
                />
                <span className="absolute left-2.5 inset-y-0 flex items-center text-slate-500 text-xs">$</span>
              </div>
            </div>
          </div>

          {/* Operational staff allocation and actions */}
          <div className="space-y-3 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-[#00d2ff] uppercase tracking-widest border-b border-white/[0.08] pb-1.5">3. Asignación Operaria</h4>
              
              <div className="mt-2">
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Asignar Operario / Detallador Activo</label>
                <select
                  id="select-turno-lavador"
                  value={selectedLavador}
                  onChange={(e) => setSelectedLavador(e.target.value)}
                  className="w-full bg-black/30 border border-white/[0.1] focus:border-[#00d2ff]/60 focus:outline-none rounded-lg px-2.5 py-2 text-xs text-white"
                >
                  {LAVADORES_ACTIVOS.map((lav) => (
                    <option key={lav} value={lav} className="bg-[#0c0f12] text-white">{lav}</option>
                  ))}
                </select>
              </div>

              <div className="mt-2.5">
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Fecha de Reserva</label>
                <input
                  type="date"
                  value={turnoFechaInput}
                  onChange={(e) => setTurnoFechaInput(e.target.value)}
                  className="w-full bg-black/30 border border-white/[0.1] focus:border-[#00d2ff]/60 focus:outline-none rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>

              <div className="mt-2.5">
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Hora de Reserva</label>
                <select
                  value={turnoHoraInput}
                  onChange={(e) => setTurnoHoraInput(e.target.value)}
                  className="w-full bg-black/30 border border-white/[0.1] focus:border-[#00d2ff]/60 focus:outline-none rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  {['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'].map(h => (
                    <option key={h} value={h} className="bg-[#0c0f12] text-white">{h} hs</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-4 flex gap-2">
              <button
                id="btn-cancel-turno"
                type="button"
                onClick={() => setShowAddForm(false)}
                className="flex-1 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-300 font-bold py-2 rounded-lg text-xs transition"
              >
                Cancelar
              </button>
              <button
                id="btn-submit-turno"
                type="submit"
                className="flex-1 bg-[#00d2ff]/20 hover:bg-[#00d2ff]/30 text-[#00d2ff] border border-[#00d2ff]/30 font-bold py-2 rounded-lg text-xs transition shadow-lg"
              >
                Confirmar Turno
              </button>
            </div>
          </div>

        </form>
      )}

      {/* Online Reservation Requests Approval Queue */}
      {solicitudesOnline.length > 0 && (
        <div className="glass-panel p-5 rounded-xl border border-[#00d2ff]/20 space-y-4 animate-fade-in relative z-20 shadow-[0_4px_25px_rgba(0,210,255,0.05)]">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 font-display">
              <span className="w-2 h-2 bg-[#00d2ff] rounded-full animate-ping" />
              📩 Solicitudes de Reservas Online Pendientes de Asignación
            </h3>
            <span className="text-[10px] bg-[#00d2ff]/10 text-[#00d2ff] border border-[#00d2ff]/20 px-2 py-0.5 rounded-full font-mono font-bold uppercase">
              {solicitudesOnline.length} Por Aprobar
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {solicitudesOnline.map((t) => {
              const currentAssigned = assignedOperators[t.id] || LAVADORES_ACTIVOS[0];

              return (
                <div key={t.id} className="bg-white/[0.01] hover:bg-white/[0.02] border border-white/[0.06] hover:border-[#00d2ff]/30 p-4 rounded-xl space-y-3 transition duration-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-200">{t.clienteNombre}</h4>
                      <span className="text-[10px] text-slate-500 font-mono font-bold block">{t.telefono}</span>
                    </div>
                    <span className="font-mono text-emerald-400 font-bold bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10 text-xs">
                      ${t.precio.toLocaleString('es-AR')}
                    </span>
                  </div>

                  <div className="space-y-1 bg-black/20 p-2.5 rounded-lg border border-white/[0.03]">
                    <div className="text-[11px] font-bold text-slate-300">
                      Servicio: <span className="text-[#00d2ff]">{t.servicioNombre}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Vehículo: {t.vehiculoModelo} <span className="text-slate-500">[{t.vehiculoPatente.toUpperCase()}]</span>
                    </div>
                    {t.comentarios && (
                      <p className="text-[10px] text-slate-500 italic leading-relaxed pt-1 border-t border-white/[0.04] mt-1">
                        {t.comentarios}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 border-t border-white/[0.04]">
                    {/* Operator selector */}
                    <div className="flex-1 space-y-1">
                      <label className="block text-[8px] text-slate-400 uppercase tracking-wider font-bold">Asignar Técnico Especialista</label>
                      <select
                        value={currentAssigned}
                        onChange={(e) => {
                          setAssignedOperators(prev => ({ ...prev, [t.id]: e.target.value }));
                        }}
                        className="w-full bg-slate-900 border border-white/[0.08] focus:border-[#00d2ff]/40 rounded px-2 py-1 text-xs text-white"
                      >
                        {LAVADORES_ACTIVOS.map((lav) => (
                          <option key={lav} value={lav} className="bg-slate-950 text-white">{lav}</option>
                        ))}
                      </select>
                    </div>

                    {/* Actions */}
                    <div className="flex items-end gap-1.5 shrink-0 self-end sm:self-auto">
                      <button
                        onClick={() => {
                          if (onUpdateTurno) {
                            const updated = {
                              ...t,
                              lavadorAsignado: currentAssigned,
                              estado: 'PENDIENTE' as const
                            };
                            onUpdateTurno(updated);
                            onAddLog(`✅ [TIENDA] Turno online de ${t.clienteNombre} (${t.vehiculoPatente}) aprobado y asignado a ${currentAssigned} para ${t.servicioNombre}.`);
                          }
                        }}
                        className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold rounded-lg text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Aprobar
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`¿Rechazar y eliminar la solicitud de reserva de ${t.clienteNombre}?`)) {
                            onDeleteTurno(t.id);
                            onAddLog(`❌ [TIENDA] Solicitud de reserva online de ${t.clienteNombre} (${t.vehiculoPatente}) rechazada.`);
                          }
                        }}
                        className="p-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg transition cursor-pointer"
                        title="Rechazar y Eliminar"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-20">
        
        {/* Column 1: PENDIENTE */}
        <div className="glass-panel p-4 rounded-xl flex flex-col min-h-[450px] border-amber-500/15 relative">
          <div className="flex justify-between items-center pb-3 border-b border-white/[0.08] mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 badge-neon-yellow animate-pulse" />
              <h3 className="font-extrabold text-white text-xs uppercase tracking-widest font-display">Pendientes</h3>
            </div>
            <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-mono font-bold">{pendientes.length}</span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px] pr-1 scrollbar-thin">
            {pendientes.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-500 italic">No hay vehículos en espera.</div>
            ) : (
              pendientes.map((t) => (
                <div key={t.id} id={`turno-card-${t.id}`} className={`p-3.5 rounded-lg space-y-3 relative group transition-all shadow-sm duration-200 ${
                  t.isCeramic
                    ? 'border border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent hover:border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.08)]'
                    : 'bg-white/[0.02] border border-white/[0.06] hover:border-red-500/40 hover:bg-white/[0.03]'
                }`}>
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-extrabold tracking-wider border ${
                        t.isCeramic ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        t.tipo === 'LAVADO' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        t.tipo === 'TAPICERIA' ? 'bg-[#9d50bb]/15 text-purple-300 border-[#9d50bb]/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>{t.isCeramic ? 'DETAILED' : t.tipo}</span>
                      
                      {t.isCeramic && (
                        <span className="text-[8px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider flex items-center gap-0.5 shadow-[0_0_10px_rgba(245,158,11,0.15)]">
                          <Sparkles className="w-2.5 h-2.5 text-amber-400 animate-pulse" />
                          {t.ceramicNivel} • {t.tamanoVehiculo}
                        </span>
                      )}
                    </div>
                    <button
                      id={`btn-delete-turno-${t.id}`}
                      onClick={() => onDeleteTurno(t.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 rounded hover:bg-white/[0.05] transition"
                      title="Eliminar Turno"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-100 font-display leading-snug">{t.servicioNombre}</h4>
                    <div className="flex items-center justify-between gap-1 text-[11px] text-slate-400">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Car className="w-3.5 h-3.5 text-[#00d2ff] shrink-0" />
                        <span className="truncate text-slate-200">{t.vehiculoModelo}</span>
                        <span className="text-[#00d2ff] font-mono font-bold uppercase shrink-0">[{t.vehiculoPatente}]</span>
                      </div>
                      {t.healthData && (
                        <button
                          type="button"
                          id={`btn-view-health-${t.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedViewHealth(t.healthData!);
                          }}
                          className="px-1.5 py-0.5 rounded bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary border border-brand-primary/30 text-[9px] font-extrabold flex items-center gap-0.5 shrink-0"
                          title="Inspección de Entrada Registrada"
                        >
                          <ClipboardList className="w-2.5 h-2.5" />
                          <span>INFO</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-white/[0.06] pt-2 flex justify-between items-center text-[10px] text-slate-400">
                    <div className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-slate-300">{t.clienteNombre}</span>
                    </div>
                    <span className="font-mono text-[#00d2ff] font-bold">${t.precio.toLocaleString('es-AR')}</span>
                  </div>

                  <div className="pt-1.5 flex gap-1.5">
                    <button
                      id={`btn-whatsapp-${t.id}`}
                      onClick={() => handleSendWhatsApp(t)}
                      className="flex-1 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] hover:border-emerald-500/30 text-[10px] font-bold text-slate-300 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1"
                    >
                      <MessageSquare className="w-3 h-3 text-emerald-400 animate-pulse" />
                      WhatsApp
                    </button>
                    <button
                      id={`btn-start-${t.id}`}
                      onClick={() => triggerStartTurno(t)}
                      className="flex-1 bg-[#00d2ff]/10 hover:bg-[#00d2ff]/20 border border-[#00d2ff]/20 text-[10px] font-bold text-[#00d2ff] py-1.5 rounded-lg transition-all flex items-center justify-center gap-1"
                    >
                      <Play className="w-3 h-3 fill-[#00d2ff] stroke-none" />
                      Iniciar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: EN PROCESO */}
        <div className="glass-panel p-4 rounded-xl flex flex-col min-h-[450px] border-red-500/25 shadow-[0_0_20px_rgba(220,38,38,0.06)] relative card-sport-border">
          <div className="flex justify-between items-center pb-3 border-b border-white/[0.08] mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 badge-neon-red animate-ping" />
              <h3 className="font-extrabold text-white text-xs uppercase tracking-widest font-display">En Proceso</h3>
            </div>
            <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded font-mono font-bold">{enProceso.length}</span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px] pr-1 scrollbar-thin">
            {enProceso.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-500 italic">No hay vehículos en tratamiento actual.</div>
            ) : (
              enProceso.map((t) => (
                <div key={t.id} id={`turno-card-${t.id}`} className={`p-3.5 rounded-lg space-y-3 relative group transition-all shadow-sm duration-200 ${
                  t.isCeramic
                    ? 'border border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent hover:border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.08)]'
                    : 'bg-white/[0.02] border border-white/[0.06] hover:border-red-500/40 hover:bg-white/[0.03]'
                }`}>
                  <div className="flex justify-between items-center flex-wrap gap-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-extrabold tracking-wider border ${
                        t.isCeramic ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        t.tipo === 'LAVADO' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        t.tipo === 'TAPICERIA' ? 'bg-[#9d50bb]/15 text-purple-300 border-[#9d50bb]/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>{t.isCeramic ? 'DETAILED' : t.tipo}</span>
                      
                      {t.isCeramic && (
                        <span className="text-[8px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider flex items-center gap-0.5 shadow-[0_0_10px_rgba(245,158,11,0.15)]">
                          <Sparkles className="w-2.5 h-2.5 text-amber-400 animate-pulse" />
                          {t.ceramicNivel} • {t.tamanoVehiculo}
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] text-[#00d2ff] font-mono font-bold flex items-center gap-1 bg-[#00d2ff]/10 border border-[#00d2ff]/20 px-1.5 py-0.5 rounded">
                      <Clock className="w-2.5 h-2.5 animate-spin" />
                      Ejecutando
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-100 font-display leading-snug">{t.servicioNombre}</h4>
                    <div className="flex items-center justify-between gap-1 text-[11px] text-slate-400">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Car className="w-3.5 h-3.5 text-[#00d2ff] shrink-0" />
                        <span className="truncate text-slate-200">{t.vehiculoModelo}</span>
                        <span className="text-[#00d2ff] font-mono font-bold uppercase shrink-0">[{t.vehiculoPatente}]</span>
                      </div>
                      {t.healthData && (
                        <button
                          type="button"
                          id={`btn-view-health-${t.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedViewHealth(t.healthData!);
                          }}
                          className="px-1.5 py-0.5 rounded bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary border border-brand-primary/30 text-[9px] font-extrabold flex items-center gap-0.5 shrink-0"
                          title="Inspección de Entrada Registrada"
                        >
                          <ClipboardList className="w-2.5 h-2.5" />
                          <span>INFO</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-white/[0.06] pt-2 flex justify-between items-center text-[10px] text-slate-400">
                    <div className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-slate-300">Encargado: <b>{t.lavadorAsignado}</b></span>
                    </div>
                    <span className="font-mono text-[#00d2ff] font-bold">${t.precio.toLocaleString('es-AR')}</span>
                  </div>

                  <div className="pt-1">
                    <button
                      id={`btn-complete-${t.id}`}
                      onClick={() => triggerCompleteTurno(t)}
                      className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Marcar Listo y Cobrar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 3: LISTO PARA ENTREGA / COMPLETADO */}
        <div className="glass-panel p-4 rounded-xl flex flex-col min-h-[450px] border-emerald-500/15 relative">
          <div className="flex justify-between items-center pb-3 border-b border-white/[0.08] mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 badge-neon-green" />
              <h3 className="font-extrabold text-white text-xs uppercase tracking-widest font-display">Listos para Entrega</h3>
            </div>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono font-bold">{completados.length}</span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px] pr-1 scrollbar-thin">
            {completados.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-500 italic">No hay vehículos listos de hoy.</div>
            ) : (
              completados.map((t) => (
                <div key={t.id} id={`turno-card-${t.id}`} className={`p-3.5 rounded-lg space-y-3 relative group transition-all duration-200 ${
                  t.isCeramic
                    ? 'border border-amber-500/20 bg-amber-500/[0.01] hover:border-amber-500/35'
                    : 'bg-white/[0.01] border border-white/[0.04] hover:border-white/[0.1]'
                }`}>
                  <div className="flex justify-between items-center flex-wrap gap-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider bg-white/[0.04] border border-white/[0.06] text-slate-400">
                        Entregado
                      </span>
                      {t.isCeramic && (
                        <span className="text-[8px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider flex items-center gap-0.5">
                          <Sparkles className="w-2.5 h-2.5 text-amber-500/60" />
                          {t.ceramicNivel} • {t.tamanoVehiculo}
                        </span>
                      )}
                    </div>
                    
                    {t.npsScore && (
                      <div className="flex items-center gap-0.5 text-yellow-500">
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <Star key={idx} className={`w-3 h-3 ${idx < (t.npsScore || 0) ? 'fill-yellow-500' : 'text-slate-800'}`} />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-400 font-display leading-snug line-through">{t.servicioNombre}</h4>
                    <div className="flex items-center justify-between gap-1 text-[11px] text-slate-500">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Car className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{t.vehiculoModelo}</span>
                        <span className="font-mono uppercase shrink-0">[{t.vehiculoPatente}]</span>
                      </div>
                      {t.healthData && (
                        <button
                          type="button"
                          id={`btn-view-health-${t.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedViewHealth(t.healthData!);
                          }}
                          className="px-1.5 py-0.5 rounded bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 border border-slate-500/30 text-[9px] font-extrabold flex items-center gap-0.5 shrink-0"
                          title="Inspección de Entrada Registrada"
                        >
                          <ClipboardList className="w-2.5 h-2.5" />
                          <span>INFO</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {t.comentarios && (
                    <div className="bg-white/[0.01] p-2 rounded text-[10px] text-slate-400 border border-white/[0.04] italic">
                      "{t.comentarios}"
                    </div>
                  )}

                  <div className="border-t border-white/[0.04] pt-2 flex justify-between items-center text-[10px] text-slate-500 font-mono">
                    <span>Lavó: <b>{t.lavadorAsignado}</b></span>
                    <span className="font-bold text-emerald-500/85">${t.precio.toLocaleString('es-AR')}</span>
                  </div>

                  <div className="pt-1 flex gap-1.5">
                    <button
                      id={`btn-whatsapp-ready-${t.id}`}
                      onClick={() => handleSendWhatsApp(t)}
                      className="flex-1 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] hover:border-emerald-500/30 text-[10px] font-semibold text-slate-300 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1"
                    >
                      <MessageSquare className="w-3 h-3 text-emerald-400" />
                      Avisar Retiro
                    </button>
                    <button
                      id={`btn-print-ticket-${t.id}`}
                      onClick={() => setTicketTurno(t)}
                      className="flex-1 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] hover:border-[#00d2ff]/30 text-[10px] font-semibold text-slate-300 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1"
                    >
                      <Printer className="w-3 h-3 text-[#00d2ff]" />
                      Ticket AFIP
                    </button>
                    <button
                      id={`btn-download-pdf-${t.id}`}
                      onClick={() => generateTicketPDF({
                        id: t.id,
                        clienteNombre: t.clienteNombre,
                        vehiculoModelo: t.vehiculoModelo,
                        vehiculoPatente: t.vehiculoPatente,
                        servicioNombre: t.servicioNombre,
                        precio: t.precio,
                        lavadorAsignado: t.lavadorAsignado,
                        fecha: t.fechaCreacion,
                        origen: 'TURNO'
                      })}
                      className="px-2 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] hover:border-[#00d2ff]/30 text-slate-300 rounded-lg transition-all flex items-center justify-center"
                      title="Descargar Ticket PDF"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
      ) : (
        <WeeklyCalendar
          turnos={turnos}
          clientes={clientes}
          onUpdateTurnoEstado={onUpdateTurnoEstado}
          onSelectSlot={(dateKey, hourStr) => {
            setTurnoFechaInput(dateKey);
            setTurnoHoraInput(hourStr);
            setShowAddForm(true);
            
            setTimeout(() => {
              const formElement = document.querySelector('form');
              if (formElement) {
                formElement.scrollIntoView({ behavior: 'smooth' });
              }
            }, 100);
          }}
        />
      )}

      {/* NPS Evaluation Popup Dialog */}
      {feedbackTurnoId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex justify-center items-center p-4">
          <form onSubmit={handleFeedbackSubmit} className="glass-panel p-6 rounded-xl border border-white/[0.08] w-full max-w-md space-y-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="text-center">
              <span className="text-xs uppercase tracking-widest text-[#00d2ff] font-bold">Fidelización y NPS</span>
              <h3 className="text-base font-extrabold text-white mt-1 font-display">Registrar Cobro y Calidad del Servicio</h3>
              <p className="text-xs text-slate-400 mt-1">Por favor, registra el nivel de satisfacción que reportó el cliente al retirar su vehículo.</p>
            </div>

            <div className="flex justify-center gap-2.5 py-2">
              {[1, 2, 3, 4, 5].map((val) => (
                <button
                  key={val}
                  id={`btn-star-rating-${val}`}
                  type="button"
                  onClick={() => setRatingInput(val)}
                  className="p-1 text-yellow-500 hover:scale-110 transition"
                >
                  <Star className={`w-8 h-8 ${val <= ratingInput ? 'fill-yellow-500' : 'text-slate-800'}`} />
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] text-slate-400 uppercase tracking-wider">Comentarios del cliente (opcional)</label>
              <textarea
                id="textarea-nps-comment"
                value={commentsInput}
                onChange={(e) => setCommentsInput(e.target.value)}
                placeholder="Ej. Quedó muy conforme, agendó para pulido el mes que viene..."
                rows={3}
                className="w-full bg-black/30 border border-white/[0.1] focus:border-[#00d2ff]/60 focus:outline-none rounded-lg p-2.5 text-xs text-white resize-none transition-all placeholder:text-slate-600"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFeedbackTurnoId(null)}
                className="flex-1 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-300 font-bold py-2 rounded-lg text-xs transition"
              >
                Volver
              </button>
              <button
                id="btn-confirm-feedback"
                type="submit"
                className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 font-bold py-2 rounded-lg text-xs transition shadow-lg"
              >
                Registrar Pago
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Ticket/Invoice Printer Preview Simulation Drawer */}
      {ticketTurno && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex justify-center items-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/[0.08] w-full max-w-[380px] space-y-4 relative overflow-hidden flex flex-col justify-between max-h-[90vh] shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
            
            {/* Top Close Button */}
            <button 
              onClick={() => setTicketTurno(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-xs font-semibold"
            >
              Cerrar
            </button>

            {/* Thermal Print Receipt Wrapper */}
            <div id="thermal-ticket-print" className="bg-white text-slate-900 p-5 rounded-lg font-mono text-xs shadow-xl overflow-y-auto max-h-[60vh] space-y-4 border-t-8 border-[#00d2ff]">
              <div className="text-center space-y-1">
                <h4 className="font-bold text-sm tracking-widest">MOBILE WASH CAR WASH</h4>
                <p className="text-[10px] text-slate-500">Av. Las Heras 1234, Mendoza</p>
                <p className="text-[10px] text-slate-500">CUIT: 30-71458925-9</p>
                <p className="text-[9px] text-slate-400">Responsable Inscripto</p>
              </div>

              <div className="border-b border-dashed border-slate-400 py-1 space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span>FECHA: {new Date().toLocaleDateString('es-AR')}</span>
                  <span>HORA: {new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div>TICKET-FACTURA N°: 0001-00045129</div>
                <div>ATENDIDO POR: {ticketTurno.lavadorAsignado}</div>
              </div>

              <div className="border-b border-dashed border-slate-400 py-1.5 space-y-1">
                <div className="font-bold text-[10px] uppercase">Datos del Cliente:</div>
                <div className="text-[10px]">CLIENTE: {ticketTurno.clienteNombre}</div>
                <div className="text-[10px]">VEHÍCULO: {ticketTurno.vehiculoModelo}</div>
                <div className="text-[10px]">PATENTE: <span className="font-bold">{ticketTurno.vehiculoPatente.toUpperCase()}</span></div>
              </div>

              <div className="py-2 border-b border-dashed border-slate-400 space-y-1.5">
                <div className="flex justify-between font-bold">
                  <span>DESCRIPCIÓN</span>
                  <span>PRECIO</span>
                </div>
                <div className="flex justify-between text-[11px] gap-2">
                  <span className="truncate">{ticketTurno.servicioNombre}</span>
                  <span className="shrink-0">${ticketTurno.precio.toLocaleString('es-AR')}</span>
                </div>
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal Neto (81%):</span>
                  <span>${Math.round(ticketTurno.precio * 0.81).toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>IVA (21%):</span>
                  <span>${Math.round(ticketTurno.precio * 0.19).toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between font-bold text-sm pt-2 border-t border-slate-300">
                  <span>TOTAL COBRADO:</span>
                  <span>${ticketTurno.precio.toLocaleString('es-AR')} ARS</span>
                </div>
              </div>

              <div className="text-center pt-4 space-y-2">
                <div className="inline-block bg-slate-100 p-1.5 rounded">
                  {/* Mock QR Code for AFIP digital invoice link */}
                  <div className="w-20 h-20 bg-slate-300 border-2 border-slate-400 flex items-center justify-center text-[10px] font-bold text-slate-600">
                    QR AFIP
                  </div>
                </div>
                <p className="text-[9px] text-slate-500 leading-normal">CAE N°: 73254915648521<br />Vto. CAE: {new Date(Date.now() + 864000000).toLocaleDateString('es-AR')}<br />¡Gracias por confiar en Mobile Wash!</p>
              </div>
            </div>

            {/* Quick Simulation controls */}
            <div className="space-y-2 pt-2">
              <button
                id="btn-trigger-hardware-print"
                onClick={() => {
                  window.print();
                  onAddLog(`🖨️ Ticket de venta impreso para ${ticketTurno.clienteNombre} - Turno #${ticketTurno.id}.`);
                  setTicketTurno(null);
                }}
                className="w-full bg-[#00d2ff]/20 hover:bg-[#00d2ff]/30 text-[#00d2ff] border border-[#00d2ff]/30 font-bold py-2.5 rounded-xl text-xs transition duration-200 flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Imprimir Ticket Físico (AFIP)
              </button>

              <button
                id="btn-download-pdf-modal"
                onClick={() => {
                  generateTicketPDF({
                    id: ticketTurno.id,
                    clienteNombre: ticketTurno.clienteNombre,
                    vehiculoModelo: ticketTurno.vehiculoModelo,
                    vehiculoPatente: ticketTurno.vehiculoPatente,
                    servicioNombre: ticketTurno.servicioNombre,
                    precio: ticketTurno.precio,
                    lavadorAsignado: ticketTurno.lavadorAsignado,
                    fecha: ticketTurno.fechaCreacion,
                    origen: 'TURNO'
                  });
                  onAddLog(`📥 Ticket de venta PDF descargado para ${ticketTurno.clienteNombre} - Turno #${ticketTurno.id}.`);
                  setTicketTurno(null);
                }}
                className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 font-bold py-2.5 rounded-xl text-xs transition duration-200 flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                Descargar Comprobante PDF
              </button>
              
              <button
                onClick={() => setTicketTurno(null)}
                className="w-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 py-1.5 rounded-xl text-[11px] transition"
              >
                Cerrar Vista Previa
              </button>
            </div>

          </div>
        </div>
      )}

      {/* VEHICLE HEALTH INSPECTION FORM MODAL */}
      {showInspectionEditor && currentCliente && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex justify-center items-center p-4 overflow-y-auto animate-fade-in">
          <div className="w-full max-w-4xl relative my-8">
            <button 
              type="button"
              onClick={() => setShowInspectionEditor(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white bg-black/60 hover:bg-black/95 p-1.5 rounded-full z-10 border border-white/[0.08]"
            >
              <X className="w-4 h-4" />
            </button>
            <VehicleHealth
              patente={currentCliente.vehiculoPatente}
              modelo={currentCliente.vehiculoModelo}
              isEditMode={true}
              initialData={activeInspectionData}
              onSave={(data) => {
                setActiveInspectionData(data);
                setShowInspectionEditor(false);
                onAddLog(`📋 Inspección inicial registrada para patente [${data.patente.toUpperCase()}]: ${Object.values(data.checklistDanos).filter(Boolean).length} daño(s) y suciedad ${data.nivelSuciedad}.`);
              }}
              onClose={() => setShowInspectionEditor(false)}
            />
          </div>
        </div>
      )}

      {/* VEHICLE HEALTH INFO VIEW MODAL */}
      {selectedViewHealth && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex justify-center items-center p-4 overflow-y-auto animate-fade-in">
          <div className="w-full max-w-4xl relative my-8">
            <button 
              type="button"
              onClick={() => setSelectedViewHealth(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white bg-black/60 hover:bg-black/95 p-1.5 rounded-full z-10 border border-white/[0.08]"
            >
              <X className="w-4 h-4" />
            </button>
            <VehicleHealth
              patente={selectedViewHealth.patente}
              modelo="Historial / Peritaje de Recepción"
              isEditMode={false}
              initialData={selectedViewHealth}
              onClose={() => setSelectedViewHealth(null)}
            />
          </div>
        </div>
      )}

      {/* VEHICLE CLINICAL HISTORY MODAL */}
      {showVehicleHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex justify-center items-center p-4 overflow-y-auto animate-fade-in">
          <div className="glass-panel p-6 rounded-2xl border border-white/[0.08] w-full max-w-5xl grid grid-cols-1 md:grid-cols-12 gap-6 relative max-h-[90vh] overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
            
            <button 
              type="button"
              onClick={() => setShowVehicleHistoryModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white bg-black/60 hover:bg-black/95 p-1.5 rounded-full border border-white/[0.08] z-20 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Left Column: Search & Plate Selection */}
            <div className="md:col-span-4 flex flex-col space-y-4 max-h-[80vh] overflow-hidden">
              <div>
                <span className="text-[9px] uppercase tracking-widest text-[#00d2ff] font-bold">CRM VEHICULAR</span>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-display mt-0.5">Buscador de Patentes</h3>
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar por patente o modelo..."
                  value={searchHistoryPatente}
                  onChange={(e) => setSearchHistoryPatente(e.target.value)}
                  className="w-full bg-black/40 border border-white/[0.1] focus:border-[#00d2ff]/60 focus:outline-none rounded-lg pl-8 pr-3 py-1.5 text-xs text-white"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
              </div>

              {/* Unique plates list */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                {Array.from(new Set(turnos.map(t => t.vehiculoPatente))).filter(plate => {
                  if (!plate) return false;
                  const search = searchHistoryPatente.toLowerCase();
                  const tObj = turnos.find(t => t.vehiculoPatente === plate);
                  return plate.toLowerCase().includes(search) || (tObj && tObj.vehiculoModelo?.toLowerCase().includes(search));
                }).map((plate) => {
                  const plateTurnoObj = turnos.find(t => t.vehiculoPatente === plate);
                  const isSelected = selectedHistoryPatente === plate;
                  const totalVisitsCount = turnos.filter(t => t.vehiculoPatente === plate).length;

                  return (
                    <div
                      key={plate}
                      onClick={() => setSelectedHistoryPatente(plate)}
                      className={`p-3 rounded-xl border transition duration-200 cursor-pointer flex justify-between items-center ${
                        isSelected
                          ? 'bg-brand-primary/10 border-brand-primary/30 shadow-[0_0_15px_rgba(220,38,38,0.08)]'
                          : 'bg-[#030406]/30 border-white/[0.04] hover:border-white/[0.08]'
                      }`}
                    >
                      <div>
                        <span className="font-mono font-bold text-xs uppercase tracking-widest text-[#00d2ff] block">
                          {plate}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {plateTurnoObj?.vehiculoModelo || 'Modelo Desconocido'}
                        </span>
                      </div>
                      <span className="text-[9px] bg-slate-800 text-slate-300 font-mono font-bold px-2 py-0.5 rounded-full">
                        {totalVisitsCount} serv.
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Medical Record Timeline */}
            <div className="md:col-span-8 flex flex-col space-y-4 max-h-[80vh] overflow-hidden">
              {selectedHistoryPatente ? (() => {
                const plateTurnosList = turnos
                  .filter(t => t.vehiculoPatente.toLowerCase() === selectedHistoryPatente.toLowerCase())
                  .sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime());

                const completedCount = plateTurnosList.filter(t => t.estado === 'COMPLETADO').length;
                const totalSpentAmount = plateTurnosList.filter(t => t.estado === 'COMPLETADO').reduce((sum, t) => sum + t.precio, 0);
                const sampleTurno = plateTurnosList[0];

                return (
                  <>
                    {/* Header Summary Card */}
                    <div className="bg-white/[0.01] border border-white/[0.06] p-4 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-4 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 bg-brand-primary/5 rounded-full blur-xl pointer-events-none" />
                      
                      <div className="space-y-0.5">
                        <span className="text-[8px] uppercase tracking-widest text-slate-500 font-bold block">Vehículo</span>
                        <span className="font-bold text-white text-xs truncate block">{sampleTurno?.vehiculoModelo || 'S/D'}</span>
                        <span className="text-[9px] font-mono text-[#00d2ff] uppercase font-bold tracking-widest">{selectedHistoryPatente}</span>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[8px] uppercase tracking-widest text-slate-500 font-bold block">Propietario</span>
                        <span className="font-bold text-slate-200 text-xs truncate block">{sampleTurno?.clienteNombre || 'S/D'}</span>
                        <span className="text-[9px] font-mono text-slate-400 block">{sampleTurno?.telefono || 'S/D'}</span>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[8px] uppercase tracking-widest text-slate-500 font-bold block">Visitas</span>
                        <span className="font-bold text-white text-xs block">{plateTurnosList.length} Totales</span>
                        <span className="text-[9px] text-emerald-400 font-bold block">{completedCount} Entregadas</span>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[8px] uppercase tracking-widest text-slate-500 font-bold block">Facturación</span>
                        <span className="font-bold text-emerald-400 text-xs block">${totalSpentAmount.toLocaleString('es-AR')}</span>
                        <span className="text-[9px] text-slate-400 block">Inversión Detailing</span>
                      </div>
                    </div>

                    {/* Timeline */}
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest pb-1 border-b border-white/[0.06]">
                      Línea de Tiempo de Historial Técnico
                    </h4>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                      {plateTurnosList.map((t) => {
                        const dateFormatted = new Date(t.fechaCreacion).toLocaleString('es-AR', {
                          day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
                        });

                        return (
                          <div key={t.id} className="relative pl-6 border-l border-white/[0.08] last:border-l-0 pb-1">
                            {/* Bullet */}
                            <div className={`absolute -left-1.5 top-1.5 w-3 h-3 rounded-full border-2 border-[#090d13] ${
                              t.estado === 'PENDIENTE' ? 'bg-amber-400' :
                              t.estado === 'EN_PROCESO' ? 'bg-[#00d2ff]' : 'bg-emerald-500'
                            }`} />

                            <div className="bg-[#030406]/40 border border-white/[0.04] p-3 rounded-xl space-y-2 hover:border-white/[0.08] transition duration-200">
                              
                              <div className="flex flex-wrap justify-between items-center gap-2">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[8px] px-1.5 py-0.2 rounded font-extrabold tracking-widest border ${
                                    t.tipo === 'LAVADO' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                    t.tipo === 'TAPICERIA' ? 'bg-[#9d50bb]/15 text-purple-300 border-[#9d50bb]/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  }`}>
                                    {t.tipo}
                                  </span>
                                  <span className="text-xs font-bold text-slate-200 font-display">{t.servicioNombre}</span>
                                </div>
                                <span className="text-[9px] text-slate-500 font-mono">{dateFormatted} hs</span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 font-mono pt-1">
                                <span>Operario: <b className="text-slate-300">{t.lavadorAsignado}</b></span>
                                <span className="text-right">Cobrado: <b className="text-emerald-400">${t.precio.toLocaleString('es-AR')}</b></span>
                              </div>

                              {/* Satisfaction details */}
                              {(t.npsScore || t.comentarios) && (
                                <div className="bg-white/[0.01] border border-white/[0.03] p-2 rounded-lg space-y-1.5 mt-1.5">
                                  {t.npsScore && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-[9px] text-slate-500 font-bold uppercase">Calidad:</span>
                                      <div className="flex text-yellow-500">
                                        {Array.from({ length: 5 }).map((_, idx) => (
                                          <Star key={idx} className={`w-2.5 h-2.5 ${idx < (t.npsScore || 0) ? 'fill-yellow-500' : 'text-slate-800'}`} />
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {t.comentarios && (
                                    <p className="text-[9.5px] text-slate-400 italic">
                                      "{t.comentarios}"
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Damage Checklist reference */}
                              {t.healthData && (
                                <div className="pt-2 flex justify-between items-center border-t border-white/[0.03] mt-2">
                                  <span className="text-[9px] text-slate-500 flex items-center gap-1">
                                    ⚠️ {Object.values(t.healthData.checklistDanos).filter(Boolean).length} Daño(s) de ingreso registrados
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedViewHealth(t.healthData!)}
                                    className="px-2 py-0.5 bg-brand-primary/10 hover:bg-brand-primary/25 border border-brand-primary/30 text-brand-primary font-bold rounded text-[8.5px] uppercase tracking-wider transition cursor-pointer"
                                  >
                                    Ver Ficha Daños
                                  </button>
                                </div>
                              )}

                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })() : (
                <div className="flex-1 flex flex-col justify-center items-center text-slate-500 text-xs italic py-12">
                  Selecciona una patente del buscador de la izquierda para desplegar su ficha técnica e historial clínico.
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
