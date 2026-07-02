import React, { useState, useEffect } from 'react';
import { 
  FileText, Printer, CheckCircle, Download, ArrowUpRight, 
  Search, Eye, ShieldCheck, QrCode, Building, User, Calendar
} from 'lucide-react';
import { Transaccion, Cliente, Turno } from '../types';

interface Invoice {
  id: string;
  nroFactura: string;
  puntoVenta: string;
  tipo: 'A' | 'B' | 'T'; // A: Responsable Inscripto, B: Monotributista/Consumidor Final, T: Ticket Consumidor Final
  cae: string;
  vencimientoCae: string;
  cuitCliente: string;
  razonSocialCliente: string;
  condicionIvaCliente: string;
  direccionCliente: string;
  concepto: string;
  neto: number;
  iva: number;
  total: number;
  fechaEmision: string;
  patenteAsociada?: string;
}

interface ArgentineFacturacionProps {
  transacciones: Transaccion[];
  clientes: Cliente[];
  turnos: Turno[];
  onAddLog: (msg: string) => void;
}

export default function ArgentineFacturacion({
  transacciones,
  clientes,
  turnos,
  onAddLog
}: ArgentineFacturacionProps) {
  const [activeTab, setActiveTab] = useState<'emitir' | 'historial'>('emitir');
  const [invoiceHistory, setInvoiceHistory] = useState<Invoice[]>([
    {
      id: 'inv_1',
      nroFactura: '00001248',
      puntoVenta: '0004',
      tipo: 'B',
      cae: '76123456789012',
      vencimientoCae: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      cuitCliente: '20-38491823-9',
      razonSocialCliente: 'Lucas Silva',
      condicionIvaCliente: 'Consumidor Final',
      direccionCliente: 'Av. Colón 450, Córdoba',
      concepto: 'Corrección de Pintura en 1 Paso + Tratamiento Acrílico (Volkswagen Golf - AD741XX)',
      neto: 99173.55,
      iva: 20826.45,
      total: 120000,
      fechaEmision: new Date(Date.now() - 7200000).toISOString(),
      patenteAsociada: 'AD741XX'
    }
  ]);

  // Form States
  const [selectedTxId, setSelectedTxId] = useState<string>('');
  const [invoiceType, setInvoiceType] = useState<'A' | 'B' | 'T'>('B');
  const [cuitCliente, setCuitCliente] = useState('');
  const [razonSocialCliente, setRazonSocialCliente] = useState('');
  const [condicionIvaCliente, setCondicionIvaCliente] = useState('Consumidor Final');
  const [direccionCliente, setDireccionCliente] = useState('');
  const [concepto, setConcepto] = useState('');
  const [montoTotal, setMontoTotal] = useState<number>(0);
  const [patente, setPatente] = useState('');

  // AFIP communication simulator
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [activePreviewInvoice, setActivePreviewInvoice] = useState<Invoice | null>(null);

  // Auto-fill from transaction selection
  const handleSelectTransaction = (txId: string) => {
    setSelectedTxId(txId);
    if (!txId) {
      resetForm();
      return;
    }

    const tx = transacciones.find((t) => t.id === txId);
    if (tx) {
      setConcepto(tx.concepto);
      setMontoTotal(tx.monto);

      // Check if this transaction is linked to a turno
      if (tx.origen === 'TURNO') {
        // Try to find the completed/associated turno to get more client details
        const matchingTurno = turnos.find(
          (t) => `Cobro Turno #${t.id.slice(-4)}` === tx.concepto.split(' - ')[0] || 
                 tx.concepto.includes(t.clienteNombre) ||
                 tx.concepto.includes(t.id.slice(-4))
        );

        if (matchingTurno) {
          setPatente(matchingTurno.vehiculoPatente);
          setConcepto(`${matchingTurno.servicioNombre} (${matchingTurno.vehiculoModelo} - Patente ${matchingTurno.vehiculoPatente})`);
          
          const client = clientes.find((c) => c.id === matchingTurno.clienteId || c.nombre === matchingTurno.clienteNombre);
          if (client) {
            setRazonSocialCliente(client.nombre);
            setDireccionCliente('Domicilio Registrado S/D');
            // Auto-assign mock DNI/CUIT
            setCuitCliente(client.vehiculoPatente ? `20-35${client.telefono.slice(-6)}-9` : '20-99999999-9');
          } else {
            setRazonSocialCliente(matchingTurno.clienteNombre);
            setCuitCliente('20-99999999-9');
          }
        }
      } else {
        // Simple manual or POS sales
        setRazonSocialCliente('Consumidor Final');
        setCuitCliente('99-99999999-9');
        setCondicionIvaCliente('Consumidor Final');
        setPatente('');
      }
    }
  };

  const resetForm = () => {
    setSelectedTxId('');
    setConcepto('');
    setMontoTotal(0);
    setCuitCliente('');
    setRazonSocialCliente('');
    setCondicionIvaCliente('Consumidor Final');
    setDireccionCliente('');
    setPatente('');
    setShowPreview(false);
  };

  const handleCreateMockInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!concepto || montoTotal <= 0) return;

    setIsAuthorizing(true);
    onAddLog(`🔌 [AFIP] Estableciendo conexión con el Web Service de la AFIP (WSFEX/WSCMT)...`);
    
    setTimeout(() => {
      onAddLog(`🔑 [AFIP] Certificado digital homologado y token de autorización activo.`);
      onAddLog(`📝 [AFIP] Enviando lote para facturación electrónica Punto de Venta 0004...`);
      
      setTimeout(() => {
        const subtotalNeto = invoiceType === 'A' ? Number((montoTotal / 1.21).toFixed(2)) : Number((montoTotal).toFixed(2));
        const ivaImporte = invoiceType === 'A' ? Number((montoTotal - subtotalNeto).toFixed(2)) : 0;
        
        // Generate mock invoice numbers
        const lastInvoiceNumber = invoiceHistory.length > 0 
          ? parseInt(invoiceHistory[0].nroFactura) + 1 
          : 1249;
        
        const padInvoiceNro = String(lastInvoiceNumber).padStart(8, '0');
        const randomCae = '76' + Math.floor(100000000000 + Math.random() * 900000000000);
        const caeExpiracy = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const newInvoice: Invoice = {
          id: `inv_${Date.now()}`,
          nroFactura: padInvoiceNro,
          puntoVenta: '0004',
          tipo: invoiceType,
          cae: randomCae,
          vencimientoCae: caeExpiracy,
          cuitCliente: cuitCliente || '20-99999999-9',
          razonSocialCliente: razonSocialCliente || 'Consumidor Final',
          condicionIvaCliente: condicionIvaCliente,
          direccionCliente: direccionCliente || 'S/D, Argentina',
          concepto: concepto,
          neto: subtotalNeto,
          iva: ivaImporte,
          total: montoTotal,
          fechaEmision: new Date().toISOString(),
          patenteAsociada: patente
        };

        setInvoiceHistory((prev) => [newInvoice, ...prev]);
        setIsAuthorizing(false);
        setActivePreviewInvoice(newInvoice);
        setShowPreview(true);
        
        onAddLog(`✅ [AFIP] Factura Autorizada con Éxito. CAE: ${randomCae} - N° ${newInvoice.puntoVenta}-${padInvoiceNro}.`);
        resetForm();
      }, 1500);
    }, 1200);
  };

  const calculateTaxes = () => {
    if (invoiceType === 'A') {
      const neto = montoTotal / 1.21;
      const iva = montoTotal - neto;
      return { neto: neto.toFixed(2), iva: iva.toFixed(2), total: montoTotal.toFixed(2) };
    } else {
      return { neto: montoTotal.toFixed(2), iva: '0.00 (Incl.)', total: montoTotal.toFixed(2) };
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Module Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white/[0.01] p-4 rounded-xl border border-white/[0.06]">
        <div>
          <h3 className="text-base font-bold text-white uppercase tracking-wider font-display flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#00d2ff]" /> Facturación Homologada AFIP (Simulación)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5 max-w-xl">
            Facturador integrado adaptado a las normativas de Argentina. Genera tickets, facturas tipo B (Consumidor Final) y tipo A (Inscriptos con discriminación de IVA 21%) con emisión de CAE fiscal ficticio.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setActiveTab('emitir');
              setShowPreview(false);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'emitir' && !showPreview
                ? 'bg-[#00d2ff]/20 text-[#00d2ff] border border-[#00d2ff]/30 shadow-[0_0_15px_rgba(0,210,255,0.1)]'
                : 'text-slate-400 hover:text-slate-200 bg-white/[0.01] border border-white/[0.06]'
            }`}
          >
            Emitir Comprobante
          </button>
          <button
            onClick={() => {
              setActiveTab('historial');
              setShowPreview(false);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'historial' && !showPreview
                ? 'bg-[#00d2ff]/20 text-[#00d2ff] border border-[#00d2ff]/30 shadow-[0_0_15px_rgba(0,210,255,0.1)]'
                : 'text-slate-400 hover:text-slate-200 bg-white/[0.01] border border-white/[0.06]'
            }`}
          >
            Comprobantes Emitidos ({invoiceHistory.length})
          </button>
        </div>
      </div>

      {activeTab === 'emitir' && !showPreview && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form left Column */}
          <div className="lg:col-span-7 space-y-5">
            <form onSubmit={handleCreateMockInvoice} className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-white/[0.08]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#00d2ff]">Crear Comprobante Oficial</h4>
                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold uppercase">AFIP WS Conectado</span>
              </div>

              {/* Step 1: Link transaction */}
              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5 font-bold">Paso 1: Vincular Transacción o Turno Reciente (Opcional)</label>
                <select
                  value={selectedTxId}
                  onChange={(e) => handleSelectTransaction(e.target.value)}
                  className="w-full bg-[#06080a] border border-white/[0.08] focus:border-[#00d2ff]/50 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="">-- Cargar desde transacciones de hoy (Venta libre) --</option>
                  {transacciones
                    .filter((t) => t.tipo === 'INGRESO')
                    .map((t) => (
                      <option key={t.id} value={t.id} className="bg-[#0c0f12]">
                        [{t.origen}] {t.concepto.slice(0, 45)}... - ${t.monto.toLocaleString('es-AR')}
                      </option>
                    ))}
                </select>
              </div>

              <div className="border-t border-white/[0.06] pt-4 space-y-4">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Paso 2: Datos del Comprobante</span>
                
                {/* Tipo de Factura */}
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-2">Tipo de Comprobante</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { type: 'B', name: 'Factura B', desc: 'A Consumidor Final' },
                      { type: 'A', name: 'Factura A', desc: 'Discriminado con IVA 21%' },
                      { type: 'T', name: 'Ticket Fiscal', desc: 'Comprobante Express' }
                    ].map((btn) => (
                      <button
                        key={btn.type}
                        type="button"
                        onClick={() => {
                          setInvoiceType(btn.type as 'A' | 'B' | 'T');
                          if (btn.type === 'A') {
                            setCondicionIvaCliente('Responsable Inscripto');
                          } else {
                            setCondicionIvaCliente('Consumidor Final');
                          }
                        }}
                        className={`p-2.5 rounded-lg border text-left transition ${
                          invoiceType === btn.type
                            ? 'border-[#00d2ff]/50 bg-[#00d2ff]/5 text-[#00d2ff]'
                            : 'border-white/[0.06] bg-white/[0.01] hover:border-white/[0.12] text-slate-400'
                        }`}
                      >
                        <div className="text-xs font-bold">{btn.name}</div>
                        <div className="text-[9px] text-slate-500 mt-0.5">{btn.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cliente details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">CUIT / CUIL / DNI del Cliente</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={cuitCliente}
                        onChange={(e) => setCuitCliente(e.target.value)}
                        placeholder="Ej. 20-38491823-9"
                        className="w-full bg-[#06080a] border border-white/[0.08] focus:border-[#00d2ff]/50 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          // mock CUIT generation based on name
                          setCuitCliente(`20-${Math.floor(10000000 + Math.random() * 80000000)}-${Math.floor(Math.random() * 9)}`);
                          onAddLog(`⚡ [AFIP] Generando consulta padrón CUIT con API simulada...`);
                        }}
                        className="absolute right-2 top-1.5 text-[9px] bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 border border-white/[0.08] px-1.5 py-0.5 rounded"
                      >
                        Autocit
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Razón Social / Nombre</label>
                    <input
                      type="text"
                      required
                      value={razonSocialCliente}
                      onChange={(e) => setRazonSocialCliente(e.target.value)}
                      placeholder="Ej. Carlos Mendoza"
                      className="w-full bg-[#06080a] border border-white/[0.08] focus:border-[#00d2ff]/50 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Condición Frente al IVA</label>
                    <select
                      value={condicionIvaCliente}
                      onChange={(e) => setCondicionIvaCliente(e.target.value)}
                      className="w-full bg-[#06080a] border border-white/[0.08] focus:border-[#00d2ff]/50 focus:outline-none rounded-lg px-2.5 py-2 text-xs text-white"
                    >
                      <option value="Consumidor Final" className="bg-[#0c0f12]">Consumidor Final</option>
                      <option value="Responsable Inscripto" className="bg-[#0c0f12]">Responsable Inscripto</option>
                      <option value="Responsable Monotributo" className="bg-[#0c0f12]">Monotributista</option>
                      <option value="Exento" className="bg-[#0c0f12]">Exento / No Responsable</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Dirección Comercial/Particular</label>
                    <input
                      type="text"
                      value={direccionCliente}
                      onChange={(e) => setDireccionCliente(e.target.value)}
                      placeholder="Ej. Av. San Martín 1500, Mendoza"
                      className="w-full bg-[#06080a] border border-white/[0.08] focus:border-[#00d2ff]/50 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                {/* Concepto & Importe */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-8">
                    <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Concepto o Detalle de Servicio</label>
                    <input
                      type="text"
                      required
                      value={concepto}
                      onChange={(e) => setConcepto(e.target.value)}
                      placeholder="Ej. Lavado Premium + Detalle de Llantas (Toyota Corolla - AB123CD)"
                      className="w-full bg-[#06080a] border border-white/[0.08] focus:border-[#00d2ff]/50 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Precio Total (ARS)</label>
                    <div className="relative">
                      <input
                        type="number"
                        required
                        min="1"
                        value={montoTotal || ''}
                        onChange={(e) => setMontoTotal(Number(e.target.value))}
                        placeholder="Importe"
                        className="w-full bg-[#06080a] border border-white/[0.08] focus:border-[#00d2ff]/50 focus:outline-none rounded-lg pl-6 pr-3 py-2 text-xs text-white font-mono font-bold"
                      />
                      <span className="absolute left-2.5 top-2 text-slate-500 text-xs font-bold">$</span>
                    </div>
                  </div>
                </div>

                {patente && (
                  <div className="bg-[#00d2ff]/5 p-2 rounded border border-[#00d2ff]/20 flex justify-between items-center text-[10px]">
                    <span className="text-slate-400 uppercase tracking-wider font-bold">Vehículo Vinculado</span>
                    <span className="bg-[#00d2ff]/10 text-[#00d2ff] font-mono font-bold px-2 py-0.5 rounded border border-[#00d2ff]/20">{patente}</span>
                  </div>
                )}
              </div>

              {/* Action trigger */}
              <div className="pt-2 border-t border-white/[0.06] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-white/[0.01] hover:bg-white/[0.06] border border-white/[0.08] text-slate-300 font-bold py-2 px-4 rounded-lg text-xs transition duration-200"
                >
                  Limpiar Formulario
                </button>
                <button
                  type="submit"
                  disabled={isAuthorizing || montoTotal <= 0 || !concepto}
                  className="flex items-center justify-center gap-1.5 bg-[#00d2ff] hover:bg-[#00d2ff]/80 text-black font-bold py-2 px-5 rounded-lg text-xs transition duration-200 disabled:opacity-50 shadow-[0_0_20px_rgba(0,210,255,0.2)]"
                >
                  {isAuthorizing ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                      Autorizando AFIP...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      Emitir Factura Electrónica
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* AFIP Simulation Info right Column */}
          <div className="lg:col-span-5 space-y-5">
            <div className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 pb-1.5 border-b border-white/[0.08]">Consola Homologación</h4>
              <div className="bg-black/40 p-4 rounded-xl border border-white/[0.05] font-mono text-[10px] space-y-2 text-slate-300 leading-relaxed min-h-[220px]">
                <div className="text-emerald-400 font-bold">AFIP WEB SERVICES GATEWAY v4.1</div>
                <div>[INFO] Punto de venta asignado: PV-0004 (Lavadero Argentina)</div>
                <div>[INFO] Condición fiscal: Responsable Inscripto</div>
                <div>[INFO] CUIT Emisor: 30-71458921-5</div>
                <div>[INFO] Alícuotas de IVA activas en sistema: 21.00%, 10.50%</div>
                <div className="border-t border-white/[0.05] my-2 pt-2 text-[9px] text-slate-500">RESUMEN TRIBUTARIO PROYECTADO (Factura A):</div>
                {montoTotal > 0 ? (
                  <div className="space-y-1 bg-white/[0.01] p-2 rounded border border-white/[0.04]">
                    <div className="flex justify-between">
                      <span>Importe Total Cobrado:</span>
                      <span className="text-white">${montoTotal.toLocaleString('es-AR')} ARS</span>
                    </div>
                    {invoiceType === 'A' ? (
                      <>
                        <div className="flex justify-between text-yellow-400">
                          <span>Base Imponible (Neto):</span>
                          <span>${calculateTaxes().neto} ARS</span>
                        </div>
                        <div className="flex justify-between text-[#00d2ff]">
                          <span>Débito Fiscal IVA (21%):</span>
                          <span>${calculateTaxes().iva} ARS</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-slate-400 italic text-[9px]">
                        *IVA 21% incluido en importe total sin discriminar.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-slate-500 italic">Ingresa un importe en el formulario para previsualizar los impuestos.</div>
                )}
              </div>
            </div>

            <div className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-3.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Formatos Autorizados</span>
              <div className="space-y-2">
                <div className="flex gap-2.5 items-start">
                  <div className="p-1 px-1.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold text-xs mt-0.5">A</div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    <b>Factura A:</b> Emitida a clientes Responsables Inscriptos. Discrimina el IVA para cómputo de crédito fiscal. Requiere CUIT registrado.
                  </p>
                </div>
                <div className="flex gap-2.5 items-start pt-2 border-t border-white/[0.05]">
                  <div className="p-1 px-1.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold text-xs mt-0.5">B</div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    <b>Factura B:</b> Emitida a Consumidores Finales, Monotributistas o Exentos. El IVA está cargado pero no se discrimina en el ticket.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RENDER INVOICE PREVIEW VIEW */}
      {showPreview && activePreviewInvoice && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white/[0.02] p-3 rounded-lg border border-white/[0.08]">
            <span className="text-xs text-slate-400">Vista previa del PDF de AFIP: <b>Factura {activePreviewInvoice.tipo} #{activePreviewInvoice.puntoVenta}-{activePreviewInvoice.nroFactura}</b></span>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPreview(false)}
                className="bg-white/[0.01] hover:bg-white/[0.06] border border-white/[0.08] text-slate-300 font-bold py-1.5 px-3 rounded-lg text-xs transition"
              >
                Cerrar Vista Previa
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1 bg-[#00d2ff] hover:bg-[#00d2ff]/80 text-black font-bold py-1.5 px-4 rounded-lg text-xs transition"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir Comprobante (PDF)
              </button>
            </div>
          </div>

          {/* AFIP Rendered Sheet */}
          <div id="afip-invoice-sheet" className="bg-white text-slate-900 p-6 md:p-8 rounded-xl border border-slate-300 max-w-3xl mx-auto shadow-2xl font-sans text-xs">
            {/* Box container border */}
            <div className="border-2 border-slate-900 p-4 space-y-4">
              {/* Top Row: Header & Type Indicator */}
              <div className="grid grid-cols-12 border-b-2 border-slate-900 pb-4 relative">
                {/* Left: Emisor */}
                <div className="col-span-5 space-y-1 pr-4">
                  <h1 className="text-base font-black tracking-tight uppercase leading-none">MOBILE WASH ARGENTINA</h1>
                  <span className="text-[10px] block font-bold text-slate-600">Servicios de Detallado Profesional y Lavados</span>
                  <p className="text-[9px] text-slate-500 mt-1">
                    Razón Social: Lavaderos El Gaucho S.R.L.<br />
                    Dirección: Av. de Mayo 850, CABA<br />
                    Condición IVA: IVA Responsable Inscripto
                  </p>
                </div>

                {/* Center: BIG LETTER OF INVOICE */}
                <div className="col-span-2 flex flex-col items-center justify-center">
                  <div className="w-12 h-12 border-2 border-slate-900 bg-white flex flex-col items-center justify-center relative -top-4 z-10">
                    <span className="text-2xl font-black">{activePreviewInvoice.tipo}</span>
                    <span className="text-[8px] font-bold leading-none uppercase">Cod. {activePreviewInvoice.tipo === 'A' ? '001' : '006'}</span>
                  </div>
                </div>

                {/* Right: Factura Details */}
                <div className="col-span-5 pl-4 text-right space-y-1">
                  <h2 className="text-sm font-black uppercase">COMPROBANTE ELECTRÓNICO</h2>
                  <div className="text-[10px] font-bold">N° {activePreviewInvoice.puntoVenta}-{activePreviewInvoice.nroFactura}</div>
                  <div className="text-[9px] text-slate-700 mt-1 space-y-0.5">
                    <div><b>Fecha de Emisión:</b> {new Date(activePreviewInvoice.fechaEmision).toLocaleDateString('es-AR')}</div>
                    <div><b>CUIT Emisor:</b> 30-71458921-5</div>
                    <div><b>Ingresos Brutos:</b> 30-71458921-5 (Convenio Multilateral)</div>
                    <div><b>Inicio de Actividades:</b> 12/03/2021</div>
                  </div>
                </div>
              </div>

              {/* Client section block */}
              <div className="border-b-2 border-slate-900 pb-3 space-y-1.5 bg-slate-50 p-2.5 rounded">
                <div className="grid grid-cols-12 gap-2 text-[10px]">
                  <div className="col-span-2 font-bold text-slate-600">CUIT / CUIL:</div>
                  <div className="col-span-4 font-mono font-bold text-slate-900">{activePreviewInvoice.cuitCliente}</div>
                  <div className="col-span-2 font-bold text-slate-600">IVA Cond.:</div>
                  <div className="col-span-4 font-bold text-slate-900">{activePreviewInvoice.condicionIvaCliente}</div>
                </div>
                <div className="grid grid-cols-12 gap-2 text-[10px]">
                  <div className="col-span-2 font-bold text-slate-600">Nombre / R.S:</div>
                  <div className="col-span-10 font-bold text-slate-900">{activePreviewInvoice.razonSocialCliente}</div>
                </div>
                <div className="grid grid-cols-12 gap-2 text-[10px]">
                  <div className="col-span-2 font-bold text-slate-600">Dirección:</div>
                  <div className="col-span-10 text-slate-700">{activePreviewInvoice.direccionCliente}</div>
                </div>
                {activePreviewInvoice.patenteAsociada && (
                  <div className="grid grid-cols-12 gap-2 text-[9px] border-t border-slate-200 pt-1.5 mt-1.5">
                    <div className="col-span-2 font-bold text-slate-600">Vehículo/Patente:</div>
                    <div className="col-span-10 font-mono font-bold text-slate-900 uppercase">Patente {activePreviewInvoice.patenteAsociada}</div>
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className="min-h-[140px]">
                <table className="w-full text-[10px] text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-900 font-bold text-slate-700">
                      <th className="py-1">Código</th>
                      <th className="py-1">Producto / Servicio</th>
                      <th className="py-1 text-center">Cant.</th>
                      <th className="py-1">U.Medida</th>
                      <th className="py-1 text-right">Precio Unit.</th>
                      <th className="py-1 text-right">Alic. IVA</th>
                      <th className="py-1 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-300 font-medium">
                      <td className="py-2.5 font-mono text-slate-500">SERV-004</td>
                      <td className="py-2.5 font-bold text-slate-900">{activePreviewInvoice.concepto}</td>
                      <td className="py-2.5 text-center">1.00</td>
                      <td className="py-2.5">unidades</td>
                      <td className="py-2.5 text-right">${activePreviewInvoice.neto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 text-right">{activePreviewInvoice.tipo === 'A' ? '21.00%' : 'Incluido'}</td>
                      <td className="py-2.5 text-right font-bold">${activePreviewInvoice.neto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Tax Breakdowns and Totals */}
              <div className="border-t-2 border-slate-900 pt-4 grid grid-cols-12 gap-4">
                {/* Left side: QR code mock and Barcode */}
                <div className="col-span-7 flex items-start gap-4">
                  {/* Mock QR Code */}
                  <div className="p-2 border border-slate-400 bg-slate-50 flex flex-col items-center">
                    <QrCode className="w-16 h-16 text-black" />
                    <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest mt-1">Escaneá p/Verificar</span>
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <div className="text-[8px] text-slate-500 leading-relaxed">
                      El comprobante presentado simula las especificaciones técnicas obligatorias vigentes para la facturación electrónica fiscal de la República Argentina.
                    </div>
                    {/* Barcode Mock */}
                    <div className="bg-slate-100 p-1 rounded font-mono text-[9px] text-slate-800 flex flex-col items-center border border-slate-200">
                      <div className="tracking-[3px] font-bold text-slate-700">||| | || |||| | ||| | || |||</div>
                      <div className="text-[7px] mt-0.5 font-bold">30714589215060004{activePreviewInvoice.cae}2026</div>
                    </div>
                  </div>
                </div>

                {/* Right side: Totals summary */}
                <div className="col-span-5 space-y-2 text-right">
                  <div className="space-y-1">
                    <div className="grid grid-cols-12 text-[10px] gap-1">
                      <div className="col-span-7 font-bold text-slate-600">Importe Neto Gravado:</div>
                      <div className="col-span-5 font-mono font-bold">${activePreviewInvoice.neto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                    </div>
                    {activePreviewInvoice.tipo === 'A' && (
                      <div className="grid grid-cols-12 text-[10px] gap-1 text-slate-700">
                        <div className="col-span-7 font-bold">IVA 21.00%:</div>
                        <div className="col-span-5 font-mono font-bold">${activePreviewInvoice.iva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                      </div>
                    )}
                    <div className="grid grid-cols-12 text-[10px] gap-1">
                      <div className="col-span-7 font-bold text-slate-600">Conceptos No Gravados:</div>
                      <div className="col-span-5 font-mono">$0.00</div>
                    </div>
                  </div>

                  <div className="border-t border-slate-400 pt-2 grid grid-cols-12 gap-1 text-sm font-black uppercase text-slate-900 bg-slate-50 p-1.5 rounded">
                    <div className="col-span-7">Importe Total:</div>
                    <div className="col-span-5 font-mono">${activePreviewInvoice.total.toLocaleString('es-AR')} ARS</div>
                  </div>
                </div>
              </div>

              {/* Bottom line: CAE & Expiracy details */}
              <div className="border-t border-slate-300 pt-3 flex justify-between items-center text-[9px] font-bold text-slate-700">
                <div className="flex items-center gap-1.5 text-emerald-700">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Comprobante simulado autorizado digitalmente por AFIP</span>
                </div>
                <div className="flex gap-4">
                  <div>CAE N°: <span className="font-mono font-black text-slate-900">{activePreviewInvoice.cae}</span></div>
                  <div>Vto. CAE: <span className="font-mono font-black text-slate-900">{new Date(activePreviewInvoice.vencimientoCae).toLocaleDateString('es-AR')}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COMPROBANTES EMITIDOS HISTORY LIST */}
      {activeTab === 'historial' && !showPreview && (
        <div className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-white/[0.08]">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Registro de Facturación Electrónica</h4>
            <span className="text-[10px] text-slate-400 font-bold uppercase">Año Fiscal 2026</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-white/[0.02] text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-white/[0.06]">
                <tr>
                  <th className="p-3">Factura</th>
                  <th className="p-3">Cliente / CUIT</th>
                  <th className="p-3">Concepto</th>
                  <th className="p-3 font-mono text-right">Neto</th>
                  <th className="p-3 font-mono text-right">IVA</th>
                  <th className="p-3 font-mono text-right">Total</th>
                  <th className="p-3 text-center">CAE</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {invoiceHistory.map((inv) => (
                  <tr key={inv.id} className="hover:bg-white/[0.01] transition">
                    <td className="p-3 font-bold">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] mr-1.5 font-bold ${
                        inv.tipo === 'A' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}>{inv.tipo}</span>
                      {inv.puntoVenta}-{inv.nroFactura}
                    </td>
                    <td className="p-3">
                      <div className="font-bold">{inv.razonSocialCliente}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">{inv.cuitCliente}</div>
                    </td>
                    <td className="p-3 max-w-xs truncate font-medium text-slate-400" title={inv.concepto}>
                      {inv.concepto}
                    </td>
                    <td className="p-3 text-right font-mono text-slate-400">${inv.neto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right font-mono text-slate-400">${inv.iva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-400">${inv.total.toLocaleString('es-AR')}</td>
                    <td className="p-3 text-center font-mono text-[10px] text-slate-500" title={`Vence: ${inv.vencimientoCae}`}>{inv.cae}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          setActivePreviewInvoice(inv);
                          setShowPreview(true);
                        }}
                        className="p-1.5 rounded bg-white/[0.03] hover:bg-white/[0.08] text-[#00d2ff] hover:text-white transition inline-flex items-center gap-1 font-bold text-[10px] uppercase border border-white/[0.06]"
                      >
                        <Eye className="w-3.5 h-3.5" /> Ver PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
