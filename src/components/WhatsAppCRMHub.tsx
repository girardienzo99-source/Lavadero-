import React, { useState } from 'react';
import { MessageSquare, Calendar, Check, Send, Settings, Search } from 'lucide-react';
import { Turno } from '../types';

interface WhatsAppCRMHubProps {
  turnos: Turno[];
  onAddLog?: (message: string) => void;
}

export default function WhatsAppCRMHub({ turnos = [], onAddLog }: WhatsAppCRMHubProps) {
  // Templates saved in localStorage
  const [templateConfirm, setTemplateConfirm] = useState(() => 
    localStorage.getItem('albelo_whatsapp_template_confirm') || 
    'Hola {{1}}, te confirmamos tu turno agendado en Albelo Detail para tu auto patente {{2}} para el servicio de: {{3}}. ¡Te esperamos!'
  );
  
  const [templateReady, setTemplateReady] = useState(() => 
    localStorage.getItem('albelo_whatsapp_template_ready') || 
    '¡Hola {{1}}! Te informamos que tu vehículo {{2}} (patente {{3}}) ya se encuentra listo para retirar en Albelo Detail. Servicio: {{4}}. ¡Te esperamos!'
  );

  const [templateReminder, setTemplateReminder] = useState(() => 
    localStorage.getItem('albelo_whatsapp_template_reminder') || 
    '¡Hola {{1}}! Te recordamos tu turno reservado en Albelo Detail para mañana a las {{2}} hs para tu auto patente {{3}} (Servicio: {{4}}). Por favor confirma asistencia. ¡Gracias!'
  );

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'reminders' | 'templates'>('reminders');
  const [searchTerm, setSearchTerm] = useState('');
  const [openedReminderIds, setOpenedReminderIds] = useState<Set<string>>(() => new Set());
  const [reminderError, setReminderError] = useState('');

  const formatLocalDate = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };

  // Handle Save
  const handleSaveTemplates = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('albelo_whatsapp_template_confirm', templateConfirm);
    localStorage.setItem('albelo_whatsapp_template_ready', templateReady);
    localStorage.setItem('albelo_whatsapp_template_reminder', templateReminder);
    setSavedSuccess(true);
    if (onAddLog) onAddLog('⚙️ [CRM] Plantillas de WhatsApp guardadas localmente en este navegador.');
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  // Find all turnos scheduled for today and tomorrow to send 24h reminders
  const getUpcomingTurnos = () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const todayStr = formatLocalDate(today);
    const tomorrowStr = formatLocalDate(tomorrow);

    return turnos.filter((t) => {
      try {
        const tDate = new Date(t.fechaCreacion);
        const tDateStr = formatLocalDate(tDate);
        return (tDateStr === todayStr || tDateStr === tomorrowStr) && t.estado === 'PENDIENTE';
      } catch (e) {
        return false;
      }
    });
  };

  const upcomingTurnos = getUpcomingTurnos();

  // Search filter
  const filteredTurnos = upcomingTurnos.filter(t => 
    t.clienteNombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.vehiculoPatente.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Open a pre-filled WhatsApp conversation. This does not prove delivery.
  const triggerReminder = (t: Turno) => {
    setReminderError('');
    const d = new Date(t.fechaCreacion);
    const hourStr = Number.isNaN(d.getTime())
      ? '10:00'
      : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    const text = templateReminder
      .replace('{{1}}', t.clienteNombre)
      .replace('{{2}}', hourStr)
      .replace('{{3}}', t.vehiculoPatente.toUpperCase())
      .replace('{{4}}', t.servicioNombre);

    const phone = (t.telefono || '').replace(/\D/g, '');
    if (phone.length < 8 || phone.length > 15) {
      setReminderError(`El teléfono de ${t.clienteNombre} no es válido para abrir WhatsApp.`);
      return;
    }

    const link = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    const opened = window.open(link, '_blank');
    if (!opened) {
      setReminderError('El navegador bloqueó la ventana de WhatsApp. Habilitá ventanas emergentes e intentá nuevamente.');
      return;
    }
    opened.opener = null;
    setOpenedReminderIds((previous) => new Set(previous).add(t.id));
    if (onAddLog) onAddLog(`📱 [CRM] WhatsApp abierto para preparar el recordatorio del turno ${t.id}. Envío no confirmado.`);
  };

  const wasReminderOpened = (turnoId: string) => openedReminderIds.has(turnoId);

  return (
    <div className="space-y-6">
      {/* Header Cards */}
      <div className="glass-panel p-5 rounded-xl space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-brand-primary" />
            <h3 className="text-base font-bold text-white uppercase tracking-wider font-display">Centro de Alertas & Notificaciones WhatsApp</h3>
          </div>
          
          <div className="flex gap-1 bg-black/40 border border-white/[0.06] p-1 rounded-lg">
            <button
              onClick={() => setActiveSubTab('reminders')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition ${
                activeSubTab === 'reminders'
                  ? 'bg-brand-primary text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Control de Turnos (48 hs)
            </button>
            <button
              onClick={() => setActiveSubTab('templates')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition ${
                activeSubTab === 'templates'
                  ? 'bg-brand-primary text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Configurar Plantillas
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
          Prepará recordatorios para los próximos turnos y abrilos en WhatsApp Web. El mensaje se envía manualmente desde WhatsApp; este panel no confirma entrega ni lectura.
        </p>
      </div>

      {activeSubTab === 'reminders' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main List Column */}
          <div className="lg:col-span-8 glass-panel p-5 rounded-xl border border-white/[0.08] space-y-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <div className="flex justify-between items-center pb-1.5 border-b border-white/[0.08]">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest font-mono">
                Próximos Turnos (Hoy / Mañana)
              </h4>
              
              <div className="relative w-48">
                <input
                  type="text"
                  placeholder="Buscar patente o cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-black/35 border border-white/[0.08] rounded-lg pl-7 pr-3 py-1 text-[11px] text-white focus:outline-none focus:border-brand-primary/50"
                />
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
              </div>
            </div>

            {filteredTurnos.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs italic font-mono">
                No hay turnos pendientes programados para hoy o mañana.
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {reminderError && (
                  <div className="mb-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-[10px] text-red-200" role="alert">
                    {reminderError}
                  </div>
                )}
                {filteredTurnos.map((t) => {
                  const opened = wasReminderOpened(t.id);
                  let hourVal = '10:00';
                  let dateVal = 'Hoy';
                  try {
                    const d = new Date(t.fechaCreacion);
                    hourVal = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                    const isTom = formatLocalDate(new Date()) !== formatLocalDate(d);
                    dateVal = isTom ? 'Mañana' : 'Hoy';
                  } catch {}

                  return (
                    <div key={t.id} className="py-3 flex justify-between items-center gap-4 group">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{t.clienteNombre}</span>
                          <span className="text-[9px] bg-white/[0.03] text-slate-400 px-1.5 py-0.5 rounded font-mono uppercase border border-white/[0.04]">{t.vehiculoPatente}</span>
                          <span className="text-[8px] bg-amber-500/10 text-amber-400 border border-amber-500/25 px-1.5 rounded uppercase font-bold tracking-wider">{t.tipo}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-brand-primary" /> {dateVal} a las {hourVal} hs</span>
                          <span className="text-slate-500">•</span>
                          <span>Modelo: <b>{t.vehiculoModelo}</b></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {opened ? (
                          <span className="flex items-center gap-1 text-[10px] text-cyan-300 bg-cyan-950/20 border border-cyan-500/30 px-2 py-1 rounded-lg font-bold uppercase tracking-wider font-mono">
                            <Check className="w-3.5 h-3.5 text-cyan-300" /> WhatsApp abierto
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-400 bg-amber-950/10 border border-amber-500/20 px-2 py-1 rounded-lg font-mono uppercase tracking-wider font-bold">
                            Sin abrir
                          </span>
                        )}
                        
                        <button
                          type="button"
                          onClick={() => triggerReminder(t)}
                          className="flex items-center gap-1 bg-brand-primary hover:bg-brand-hover text-white text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg transition cursor-pointer"
                        >
                          <Send className="w-3 h-3" /> {opened ? 'Reabrir' : 'Abrir WhatsApp'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Guidelines Column */}
          <div className="lg:col-span-4 space-y-6">
            <div className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest font-mono pb-2 border-b border-white/[0.08]">
                Estadísticas CRM
              </h4>

              <div className="space-y-4">
                <div className="bg-white/[0.01] p-3 rounded-lg border border-white/[0.04] flex justify-between items-center">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider font-mono">Total Pendientes</span>
                    <span className="text-lg font-extrabold text-white block font-mono">{upcomingTurnos.length}</span>
                  </div>
                  <Calendar className="w-8 h-8 text-amber-500 opacity-60" />
                </div>

                <div className="bg-white/[0.01] p-3 rounded-lg border border-white/[0.04] flex justify-between items-center">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider font-mono">Modo de envío</span>
                    <span className="text-sm font-extrabold text-cyan-300 block font-mono">Manual</span>
                  </div>
                  <MessageSquare className="w-8 h-8 text-cyan-500 opacity-60" />
                </div>
              </div>

              <div className="text-[9.5px] text-slate-500 leading-relaxed pt-2 border-t border-white/[0.04]">
                Abrir una conversación no significa que el mensaje haya sido enviado. La entrega y lectura sólo pueden confirmarse con una integración oficial y webhooks.
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Templates tab */
        <form onSubmit={handleSaveTemplates} className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] max-w-2xl">
          <div className="flex justify-between items-center pb-2 border-b border-white/[0.08]">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest font-mono">
              Configurar Plantillas de Notificación
            </h4>
            
            {savedSuccess && (
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider font-mono flex items-center gap-1 animate-bounce">
                <Check className="w-3.5 h-3.5" /> Guardado en este navegador
              </span>
            )}
          </div>

          <div className="space-y-4">
            {/* Template 1 */}
            <div className="space-y-1.5">
              <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold">1. Plantilla de Confirmación de Turno</label>
              <textarea
                value={templateConfirm}
                onChange={(e) => setTemplateConfirm(e.target.value)}
                rows={3}
                className="w-full bg-black/45 border border-white/[0.08] focus:border-brand-primary/50 focus:outline-none rounded-lg p-2.5 text-xs text-white leading-relaxed"
                placeholder="Ingresa la plantilla..."
              />
              <span className="text-[8px] text-slate-500 block">Campos dinámicos: <b>&#123;&#123;1&#125;&#125;</b> = Cliente, <b>&#123;&#123;2&#125;&#125;</b> = Patente, <b>&#123;&#123;3&#125;&#125;</b> = Servicio</span>
            </div>

            {/* Template 2 */}
            <div className="space-y-1.5">
              <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold">2. Plantilla de Recordatorio 24 horas</label>
              <textarea
                value={templateReminder}
                onChange={(e) => setTemplateReminder(e.target.value)}
                rows={3}
                className="w-full bg-black/45 border border-white/[0.08] focus:border-brand-primary/50 focus:outline-none rounded-lg p-2.5 text-xs text-white leading-relaxed"
                placeholder="Ingresa la plantilla..."
              />
              <span className="text-[8px] text-slate-500 block">Campos dinámicos: <b>&#123;&#123;1&#125;&#125;</b> = Cliente, <b>&#123;&#123;2&#125;&#125;</b> = Hora, <b>&#123;&#123;3&#125;&#125;</b> = Patente, <b>&#123;&#123;4&#125;&#125;</b> = Servicio</span>
            </div>

            {/* Template 3 */}
            <div className="space-y-1.5">
              <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold">3. Plantilla de Vehículo Listo (Retiro)</label>
              <textarea
                value={templateReady}
                onChange={(e) => setTemplateReady(e.target.value)}
                rows={3}
                className="w-full bg-black/45 border border-white/[0.08] focus:border-brand-primary/50 focus:outline-none rounded-lg p-2.5 text-xs text-white leading-relaxed"
                placeholder="Ingresa la plantilla..."
              />
              <span className="text-[8px] text-slate-500 block">Campos dinámicos: <b>&#123;&#123;1&#125;&#125;</b> = Cliente, <b>&#123;&#123;2&#125;&#125;</b> = Vehículo, <b>&#123;&#123;3&#125;&#125;</b> = Patente, <b>&#123;&#123;4&#125;&#125;</b> = Servicio</span>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-brand-primary hover:bg-brand-hover text-white font-bold py-2.5 rounded-lg text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Settings className="w-4 h-4" /> Guardar Cambios en Plantillas
          </button>
          <p className="text-[9px] text-slate-500 text-center">Configuración local: todavía no se sincroniza entre usuarios o dispositivos.</p>
        </form>
      )}
    </div>
  );
}
