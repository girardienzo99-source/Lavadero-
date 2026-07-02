import React, { useState } from 'react';
import { 
  MessageSquare, Send, CheckCheck, RefreshCw, Settings, Smartphone, 
  Code, Shield, Check, Play, Copy, AlertCircle, FileText, Sparkles, Sliders
} from 'lucide-react';
import { Turno, Cliente } from '../types';

interface WhatsAppLog {
  id: string;
  clienteNombre: string;
  telefono: string;
  mensaje: string;
  fecha: string;
  estado: 'ENVIADO' | 'ENTREGADO' | 'LEIDO';
  tipo: 'CONFIRMACION' | 'RETIRO' | 'NPS';
}

interface WhatsAppIntegrationProps {
  turnos: Turno[];
  clientes: Cliente[];
  onAddLog: (message: string) => void;
}

export default function WhatsAppIntegration({
  turnos,
  clientes,
  onAddLog
}: WhatsAppIntegrationProps) {
  // Config state
  const [gatewayMode, setGatewayMode] = useState<'DIRECT_LINK' | 'META_API'>('DIRECT_LINK');
  const [phoneNumberId, setPhoneNumberId] = useState('109847253841920');
  const [accessToken, setAccessToken] = useState('EAAGx9388... (Simulado para pruebas)');
  const [templateName, setTemplateName] = useState('vehiculo_listo_v1');
  
  // Custom templates
  const [templateReady, setTemplateReady] = useState(
    '¡Hola {{1}}! Te informamos que tu vehículo {{2}} (patente {{3}}) ya se encuentra listo para retirar en Mobile Wash. Servicio: {{4}}. ¡Te esperamos!'
  );
  const [templateConfirm, setTemplateConfirm] = useState(
    'Hola {{1}}, te confirmamos el turno en Mobile Wash para tu auto patente {{2}} para el servicio: {{3}}.'
  );

  // Active logs state
  const [logs, setLogs] = useState<WhatsAppLog[]>([
    {
      id: 'w_log_1',
      clienteNombre: 'Carlos Mendoza',
      telefono: '+54 9 261 458-9214',
      mensaje: '¡Hola Carlos Mendoza! Te informamos que tu vehículo Corolla (patente AA123BB) ya se encuentra listo para retirar en Mobile Wash. Servicio: Lavado Completo + Cera. ¡Te esperamos!',
      fecha: new Date(Date.now() - 3600000 * 2).toISOString(),
      estado: 'LEIDO',
      tipo: 'RETIRO'
    },
    {
      id: 'w_log_2',
      clienteNombre: 'Sofía Rodríguez',
      telefono: '+54 9 261 987-6543',
      mensaje: 'Hola Sofía Rodríguez, te confirmamos el turno en Mobile Wash para tu auto patente AB987CD para el servicio: Detailing Acrílico.',
      fecha: new Date(Date.now() - 3600000 * 5).toISOString(),
      estado: 'ENTREGADO',
      tipo: 'CONFIRMACION'
    }
  ]);

  // Selected client to preview
  const [previewClient, setPreviewClient] = useState<Turno | null>(turnos[0] || null);

  // Copy helper
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const triggerCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
    onAddLog(`📋 Código copiado al portapapeles: ${section}`);
  };

  // Helper to replace placeholders
  const getRenderedMessage = (template: string, item: Turno | null) => {
    if (!item) return template;
    return template
      .replace('{{1}}', item.clienteNombre)
      .replace('{{2}}', item.vehiculoModelo || 'S/D')
      .replace('{{3}}', item.vehiculoPatente.toUpperCase())
      .replace('{{4}}', item.servicioNombre);
  };

  // Simulated API endpoint test
  const [simPhone, setSimPhone] = useState('+549261000000');
  const [simName, setSimName] = useState('Mariano López');
  const [simCar, setSimCar] = useState('Ford Focus');
  const [simService, setSimService] = useState('Lavado Premium');
  const [simulating, setSimulating] = useState(false);

  const triggerSimulatedAPI = (e: React.FormEvent) => {
    e.preventDefault();
    setSimulating(true);
    
    setTimeout(() => {
      const simulatedText = templateReady
        .replace('{{1}}', simName)
        .replace('{{2}}', simCar)
        .replace('{{3}}', 'AB111CD')
        .replace('{{4}}', simService);

      const newL: WhatsAppLog = {
        id: `w_sim_${Date.now()}`,
        clienteNombre: simName,
        telefono: simPhone,
        mensaje: simulatedText,
        fecha: new Date().toISOString(),
        estado: 'ENVIADO',
        tipo: 'RETIRO'
      };

      setLogs(prev => [newL, ...prev]);
      setSimulating(false);
      onAddLog(`⚡ [Python Microservice] Recibida petición POST en /api/notificar-entrega. Despachado WhatsApp a ${simName} (${simPhone})`);
      
      // Simulate delivery update
      setTimeout(() => {
        setLogs(prev => prev.map(item => item.id === newL.id ? { ...item, estado: 'ENTREGADO' } : item));
      }, 3000);
      setTimeout(() => {
        setLogs(prev => prev.map(item => item.id === newL.id ? { ...item, estado: 'LEIDO' } : item));
      }, 7000);

    }, 1200);
  };

  // FastAPI Python Code template
  const pythonCode = `from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import requests

app = FastAPI(title="MobileWash WhatsApp Gateway")

class NotificationPayload(BaseModel):
    telefono: str
    cliente_nombre: str
    vehiculo_modelo: str
    vehiculo_patente: str
    servicio: str

# Configuración Meta Cloud API
WHATSAPP_TOKEN = "${accessToken}"
PHONE_NUMBER_ID = "${phoneNumberId}"
URL_META = f"https://graph.facebook.com/v18.0/{PHONE_NUMBER_ID}/messages"

@app.post("/api/notificar-entrega")
async def enviar_notificacion(payload: NotificationPayload):
    # Formatear el mensaje según la plantilla de Mobile Wash
    mensaje = (
        f"¡Hola {payload.cliente_nombre}! Te informamos que tu vehículo "
        f"{payload.vehiculo_modelo} (patente {payload.vehiculo_patente}) ya se encuentra listo "
        f"para retirar en Mobile Wash. Servicio: {payload.servicio}. ¡Te esperamos!"
    )
    
    # En producción se envía la petición oficial a la API de Meta
    headers = {
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
        "Content-Type": "application/json"
    }
    
    # Payload para plantillas oficiales aprobadas por Meta
    data_meta = {
        "messaging_product": "whatsapp",
        "to": payload.telefono,
        "type": "template",
        "template": {
            "name": "${templateName}",
            "language": { "code": "es" },
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": payload.cliente_nombre},
                        {"type": "text", "text": payload.vehiculo_modelo},
                        {"type": "text", "text": payload.vehiculo_patente},
                        {"type": "text", "text": payload.servicio}
                    ]
                }
            ]
        }
    }
    
    print(f"📡 Despachando notificación a {payload.cliente_nombre} al número {payload.telefono}")
    # Simulación de respuesta exitosa del Gateway
    return {
        "status": "success",
        "message": "Notificación de retiro enviada por WhatsApp",
        "simulated_text": mensaje
    }
`;

  // Java REST Client code template
  const javaCode = `import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import com.google.gson.JsonObject; // Librería GSON para JSON

public class WhatsAppNotificationService {
    private static final String FASTAPI_URL = "http://localhost:8000/api/notificar-entrega";

    public static void notificarVehiculoListo(String telefono, String cliente, String modelo, String patente, String servicio) {
        try {
            HttpClient client = HttpClient.newHttpClient();
            
            // Construir payload JSON
            JsonObject payload = new JsonObject();
            payload.addProperty("telefono", telefono);
            payload.addProperty("cliente_nombre", cliente);
            payload.addProperty("vehiculo_modelo", modelo);
            payload.addProperty("vehiculo_patente", patente);
            payload.addProperty("servicio", servicio);

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(FASTAPI_URL))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload.toString()))
                .build();

            System.out.println("☕ [JAVA Core] Enviando orden de WhatsApp al microservicio Python...");
            client.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .thenApply(HttpResponse::body)
                .thenAccept(System.out::println)
                .join();
                
        } catch (Exception e) {
            System.err.println("❌ Error enviando notificación: " + e.getMessage());
        }
    }
}
`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
      
      {/* COLUMN 1: Gateway Configuration & Templates */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Gateway settings Card */}
        <div className="glass-panel p-5 rounded-xl space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-white/[0.06]">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 font-display">
              <Settings className="w-4 h-4 text-[#00d2ff]" />
              Configuración de Canales de WhatsApp
            </h3>
            <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono font-bold uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Gateway Online
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-[10px] text-slate-400 uppercase tracking-wider font-bold">Modo de Envío</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setGatewayMode('DIRECT_LINK');
                    onAddLog('📱 Canal cambiado a: WhatsApp Direct Link (wa.me/ API)');
                  }}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition flex flex-col items-center gap-1 border ${
                    gatewayMode === 'DIRECT_LINK'
                      ? 'bg-[#00d2ff]/10 text-[#00d2ff] border-[#00d2ff]/30 shadow-[0_0_15px_rgba(0,210,255,0.1)]'
                      : 'bg-white/[0.01] text-slate-400 hover:text-white border-white/[0.06] hover:bg-white/[0.02]'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  Link Directo (Gratis)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGatewayMode('META_API');
                    onAddLog('📡 Canal cambiado a: Meta WhatsApp Cloud API (Oficial)');
                  }}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition flex flex-col items-center gap-1 border ${
                    gatewayMode === 'META_API'
                      ? 'bg-[#00d2ff]/10 text-[#00d2ff] border-[#00d2ff]/30 shadow-[0_0_15px_rgba(0,210,255,0.1)]'
                      : 'bg-white/[0.01] text-slate-400 hover:text-white border-white/[0.06] hover:bg-white/[0.02]'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  Meta Cloud API
                </button>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal">
                {gatewayMode === 'DIRECT_LINK' 
                  ? 'Usa el protocolo wa.me de la app móvil/web. Al marcar un vehículo como LISTO, abrirá la ventana con el mensaje pre-cargado. Ideal para uso de operarios sin costos.' 
                  : 'Envía peticiones JSON automáticas en segundo plano a través de la API oficial de Meta Developer. Requiere token y cuenta empresarial.'}
              </p>
            </div>

            {/* Config Fields */}
            <div className="space-y-3.5 bg-white/[0.01] border border-white/[0.06] p-3.5 rounded-xl">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Parámetros de API (Meta Developers)</span>
              
              <div className="space-y-1.5">
                <label className="block text-[9px] text-slate-500 uppercase tracking-wider">Phone Number ID</label>
                <input
                  type="text"
                  disabled={gatewayMode === 'DIRECT_LINK'}
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  className="w-full bg-white/[0.02] disabled:opacity-50 border border-white/[0.08] rounded-lg px-2 py-1 text-xs text-white font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[9px] text-slate-500 uppercase tracking-wider">Access Token Permanente</label>
                <input
                  type="password"
                  disabled={gatewayMode === 'DIRECT_LINK'}
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  className="w-full bg-white/[0.02] disabled:opacity-50 border border-white/[0.08] rounded-lg px-2 py-1 text-xs text-white font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Templates Editor Card */}
        <div className="glass-panel p-5 rounded-xl space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-display">Editor de Plantillas & Notificaciones Automáticas</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Plantilla: Vehículo Listo para Retirar (Estado LISTO)</label>
                <span className="text-[9px] text-slate-500">Variables: {'{{1}}'}=Nombre, {'{{2}}'}=Modelo, {'{{3}}'}=Patente, {'{{4}}'}=Servicio</span>
              </div>
              <textarea
                value={templateReady}
                onChange={(e) => setTemplateReady(e.target.value)}
                rows={3}
                className="w-full bg-white/[0.01] border border-white/[0.08] rounded-lg p-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Plantilla: Confirmación de Turno Agendado (Estado PENDIENTE)</label>
                <span className="text-[9px] text-slate-500">Variables: {'{{1}}'}=Nombre, {'{{2}}'}=Patente, {'{{3}}'}=Servicio</span>
              </div>
              <textarea
                value={templateConfirm}
                onChange={(e) => setTemplateConfirm(e.target.value)}
                rows={3}
                className="w-full bg-white/[0.01] border border-white/[0.08] rounded-lg p-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-slate-500/50"
              />
            </div>
          </div>
        </div>

        {/* Python + Java Code Blueprint */}
        <div className="glass-panel p-5 rounded-xl space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
            <Code className="w-4 h-4 text-[#00d2ff]" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-display">Integración Híbrida (Python FastAPI + Java Core)</h3>
          </div>
          
          <p className="text-xs text-slate-400 leading-relaxed">
            Tal como define tu arquitectura híbrida de alto nivel, la lógica central de turnos reside en el backend empresarial (Java), el cual realiza un disparo HTTP POST hacia el microservicio autónomo en Python (FastAPI/Flask) para ejecutar las automatizaciones y envíos por WhatsApp.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Python Microservice tab */}
            <div className="space-y-2">
              <div className="flex justify-between items-center bg-white/[0.02] px-3 py-1.5 rounded-lg border border-white/[0.06]">
                <span className="text-xs font-bold text-slate-300 font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full" />
                  microservicio_whatsapp.py (FastAPI)
                </span>
                <button
                  onClick={() => triggerCopy(pythonCode, 'Python microservice')}
                  className="text-[10px] font-bold text-slate-400 hover:text-[#00d2ff] transition flex items-center gap-1"
                >
                  {copiedSection === 'Python microservice' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedSection === 'Python microservice' ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <pre className="text-[10px] font-mono text-slate-300 bg-slate-950/80 p-3 rounded-xl border border-white/[0.04] overflow-x-auto max-h-[220px] scrollbar-thin">
                {pythonCode}
              </pre>
            </div>

            {/* Java core call tab */}
            <div className="space-y-2">
              <div className="flex justify-between items-center bg-white/[0.02] px-3 py-1.5 rounded-lg border border-white/[0.06]">
                <span className="text-xs font-bold text-slate-300 font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                  WhatsAppNotificationService.java
                </span>
                <button
                  onClick={() => triggerCopy(javaCode, 'Java core')}
                  className="text-[10px] font-bold text-slate-400 hover:text-[#00d2ff] transition flex items-center gap-1"
                >
                  {copiedSection === 'Java core' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedSection === 'Java core' ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <pre className="text-[10px] font-mono text-slate-300 bg-slate-950/80 p-3 rounded-xl border border-white/[0.04] overflow-x-auto max-h-[220px] scrollbar-thin">
                {javaCode}
              </pre>
            </div>

          </div>
        </div>

      </div>

      {/* COLUMN 2: Mobile Live Mockup & Logs */}
      <div className="space-y-6">
        
        {/* Mobile Preview Device */}
        <div className="glass-panel p-5 rounded-xl space-y-4">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Visualizador de Dispositivo Móvil</span>
          
          <div className="relative mx-auto w-full max-w-[260px] bg-slate-950 rounded-[30px] border-4 border-slate-800 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
            {/* Notch */}
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-800 rounded-full z-20 flex items-center justify-center">
              <span className="w-1.5 h-1.5 bg-blue-900 rounded-full" />
            </div>
            
            {/* Screen inner */}
            <div className="bg-[#0b141a] rounded-[22px] min-h-[380px] overflow-hidden flex flex-col relative pt-5">
              
              {/* WhatsApp header */}
              <div className="bg-[#075e54] p-2 flex items-center justify-between text-white border-b border-[#128c7e]/30">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-full bg-emerald-700 flex items-center justify-center font-bold text-[9px]">MW</div>
                  <div>
                    <h4 className="text-[10px] font-bold leading-tight">Mobile Wash Detailing</h4>
                    <span className="text-[7px] text-emerald-200">en línea</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
              </div>

              {/* Chat area */}
              <div className="flex-1 p-2.5 space-y-2 overflow-y-auto flex flex-col justify-end bg-[#0b141a] bg-opacity-95 bg-[radial-gradient(#128c7e_0.5px,transparent_0.5px)] [background-size:10px_10px]">
                
                {/* Chat bubble */}
                <div className="bg-[#054d44] text-[#e1f3fc] p-2 rounded-lg text-[9px] max-w-[85%] self-end shadow-sm relative border border-emerald-900/40">
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {previewClient 
                      ? getRenderedMessage(templateReady, previewClient)
                      : '¡Hola Carlos! Tu vehículo Corolla ya se encuentra listo para retirar en Mobile Wash.'
                    }
                  </p>
                  <span className="text-[7px] text-[#80bfb4] block text-right mt-1 font-mono">10:04 AM</span>
                </div>

                {/* Confirm bubble preview */}
                <div className="bg-[#1f2c34] text-slate-300 p-2 rounded-lg text-[9px] max-w-[85%] self-start shadow-sm border border-slate-800">
                  <p className="leading-relaxed">
                    {previewClient
                      ? getRenderedMessage(templateConfirm, previewClient)
                      : 'Hola, te confirmamos el turno en Mobile Wash...'
                    }
                  </p>
                  <span className="text-[7px] text-slate-500 block text-right mt-1 font-mono">9:15 AM</span>
                </div>

              </div>

              {/* Input bar */}
              <div className="bg-[#1f2c34] p-1.5 flex items-center gap-1.5">
                <div className="flex-1 bg-[#2a3942] rounded-full px-2 py-1 text-[8px] text-slate-400">
                  Mensaje
                </div>
                <button className="w-5 h-5 rounded-full bg-[#00a884] flex items-center justify-center text-white shrink-0">
                  <Send className="w-2.5 h-2.5" />
                </button>
              </div>

            </div>
          </div>

          {/* Quick select selector to see other clients templates */}
          <div className="space-y-1.5">
            <label className="block text-[10px] text-slate-400 uppercase tracking-wider font-bold">Vista Previa de Cliente</label>
            <select
              value={previewClient?.id || ''}
              onChange={(e) => {
                const found = turnos.find(t => t.id === e.target.value);
                if (found) setPreviewClient(found);
              }}
              className="w-full bg-white/[0.02] border border-white/[0.08] text-xs text-white rounded-lg px-2 py-1.5"
            >
              {turnos.map(t => (
                <option key={t.id} value={t.id} className="bg-slate-900">
                  {t.clienteNombre} ({t.vehiculoModelo}) - {t.servicioNombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Microservice endpoint tester simulator */}
        <div className="glass-panel p-5 rounded-xl space-y-4">
          <div className="flex items-center gap-1.5 pb-2 border-b border-white/[0.06]">
            <Play className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-display">Probador del Endpoint de Notificación</h3>
          </div>

          <form onSubmit={triggerSimulatedAPI} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[8px] text-slate-400 uppercase tracking-wider">Cliente</label>
                <input
                  type="text"
                  required
                  value={simName}
                  onChange={(e) => setSimName(e.target.value)}
                  className="w-full bg-white/[0.02] border border-white/[0.08] text-xs text-white rounded px-1.5 py-1"
                />
              </div>
              <div>
                <label className="block text-[8px] text-slate-400 uppercase tracking-wider">Vehículo</label>
                <input
                  type="text"
                  required
                  value={simCar}
                  onChange={(e) => setSimCar(e.target.value)}
                  className="w-full bg-white/[0.02] border border-white/[0.08] text-xs text-white rounded px-1.5 py-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[8px] text-slate-400 uppercase tracking-wider">Teléfono</label>
                <input
                  type="text"
                  required
                  value={simPhone}
                  onChange={(e) => setSimPhone(e.target.value)}
                  className="w-full bg-white/[0.02] border border-white/[0.08] text-xs text-white rounded px-1.5 py-1 font-mono"
                />
              </div>
              <div>
                <label className="block text-[8px] text-slate-400 uppercase tracking-wider">Servicio</label>
                <input
                  type="text"
                  required
                  value={simService}
                  onChange={(e) => setSimService(e.target.value)}
                  className="w-full bg-white/[0.02] border border-white/[0.08] text-xs text-white rounded px-1.5 py-1"
                />
              </div>
            </div>

            <button
              id="btn-simulate-whatsapp-post"
              type="submit"
              disabled={simulating}
              className="w-full bg-[#00d2ff]/20 hover:bg-[#00d2ff]/30 text-[#00d2ff] border border-[#00d2ff]/30 font-bold py-2 rounded-lg text-xs transition duration-200 flex items-center justify-center gap-1.5"
            >
              {simulating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              POST a /api/notificar-entrega
            </button>
          </form>
        </div>

        {/* Live Delivery History Logs */}
        <div className="glass-panel p-5 rounded-xl space-y-3.5">
          <div className="flex justify-between items-center pb-2 border-b border-white/[0.06]">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Historial de Despacho (WhatsApp)</span>
            <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono font-bold">{logs.length}</span>
          </div>

          <div className="space-y-2.5 max-h-[190px] overflow-y-auto pr-1 scrollbar-thin">
            {logs.map(log => (
              <div key={log.id} className="bg-white/[0.01] border border-white/[0.04] p-2.5 rounded-lg space-y-1 text-xs">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-slate-200">{log.clienteNombre}</span>
                    <span className="text-[10px] text-slate-400 ml-1.5 font-mono">{log.telefono}</span>
                  </div>
                  
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                    log.estado === 'LEIDO'
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      : log.estado === 'ENTREGADO'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                  }`}>
                    {log.estado === 'LEIDO' ? <CheckCheck className="w-3 h-3 text-blue-400" /> : <Check className="w-3 h-3 text-emerald-400" />}
                    {log.estado}
                  </span>
                </div>

                <p className="text-[10px] text-slate-400 leading-normal line-clamp-2">{log.mensaje}</p>
                <div className="flex justify-between items-center pt-1 text-[9px] text-slate-500 font-mono">
                  <span>{new Date(log.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="uppercase text-[8px] font-bold text-emerald-500/80 bg-emerald-500/5 px-1 py-0.2 rounded">
                    {log.tipo}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
