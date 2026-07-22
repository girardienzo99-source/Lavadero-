import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileCheck2, FileText, RefreshCw, ShieldCheck } from 'lucide-react';
import { Cliente, Transaccion, Turno } from '../types';
import { generateInvoiceCPDF, InvoiceCInput } from '../utils/ticketGenerator';

interface ArgentineFacturacionProps {
  transacciones: Transaccion[];
  clientes: Cliente[];
  turnos: Turno[];
  onAddLog: (msg: string) => void;
}

interface FiscalConfiguration {
  ready: boolean;
  environment: 'homologacion' | 'produccion';
  invoiceType: 'C';
  pointOfSaleConfigured: boolean;
  certificateConfigured: boolean;
  issuerConfigured: boolean;
  connectorEnabled: boolean;
  missing: string[];
}

interface InvoiceResult {
  status: 'authorized' | 'observed' | 'rejected' | 'uncertain';
  invoiceNumber?: number;
  pointOfSale?: number;
  cae?: string;
  caeExpiration?: string;
  issueDate?: string;
  qrUrl?: string;
  issuer?: InvoiceCInput['issuer'];
  observations?: string[];
  errors?: string[];
}

const defaultConfiguration: FiscalConfiguration = {
  ready: false,
  environment: 'homologacion',
  invoiceType: 'C',
  pointOfSaleConfigured: false,
  certificateConfigured: false,
  issuerConfigured: false,
  connectorEnabled: false,
  missing: ['Consultando configuración fiscal…'],
};

export default function ArgentineFacturacion({ transacciones, clientes, turnos, onAddLog }: ArgentineFacturacionProps) {
  const [configuration, setConfiguration] = useState<FiscalConfiguration>(defaultConfiguration);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [selectedTxId, setSelectedTxId] = useState('');
  const [recipientType, setRecipientType] = useState<'CONSUMIDOR_FINAL' | 'IDENTIFICADO'>('CONSUMIDOR_FINAL');
  const [documentType, setDocumentType] = useState<'DNI' | 'CUIT'>('DNI');
  const [documentNumber, setDocumentNumber] = useState('');
  const [recipientName, setRecipientName] = useState('Consumidor Final');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<InvoiceResult | null>(null);
  const [invoiceSnapshot, setInvoiceSnapshot] = useState<InvoiceCInput | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const billableTransactions = useMemo(
    () => transacciones.filter((tx) => tx.tipo === 'INGRESO'),
    [transacciones]
  );
  const selectedTransaction = billableTransactions.find((tx) => tx.id === selectedTxId) ?? null;

  const loadConfiguration = async () => {
    setIsLoadingConfig(true);
    try {
      const response = await fetch('/api/facturacion/configuracion');
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || 'No se pudo consultar la configuración fiscal.');
      setConfiguration(data);
      setMessage('');
    } catch (error) {
      setConfiguration(defaultConfiguration);
      setMessage(error instanceof Error ? error.message : 'Configuración fiscal no disponible.');
    } finally {
      setIsLoadingConfig(false);
    }
  };

  useEffect(() => {
    loadConfiguration();
  }, []);

  const selectTransaction = (transactionId: string) => {
    setSelectedTxId(transactionId);
    setResult(null);
    setInvoiceSnapshot(null);
    const tx = billableTransactions.find((item) => item.id === transactionId);
    if (!tx) {
      setDescription('');
      return;
    }
    setDescription(tx.concepto);
    const turno = turnos.find((item) => tx.turnoId === item.id || tx.concepto.toLowerCase().includes(`turno #${item.id}`));
    const cliente = turno ? clientes.find((item) => item.id === turno.clienteId || item.nombre === turno.clienteNombre) : null;
    if (cliente) setRecipientName(cliente.nombre);
  };

  const submitInvoice = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTransaction || !configuration.ready || isSubmitting) return;
    if (recipientType === 'IDENTIFICADO' && (!recipientName.trim() || !/^\d{7,11}$/.test(documentNumber.replace(/\D/g, '')))) {
      setMessage('Completá nombre y documento válido del receptor.');
      return;
    }
    setIsSubmitting(true);
    setMessage('Solicitando autorización a ARCA…');
    setResult(null);
    try {
      const response = await fetch('/api/facturacion/comprobantes-c', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({
          transactionId: selectedTransaction.id,
          issueDate: new Date().toISOString().slice(0, 10),
          recipient: recipientType === 'CONSUMIDOR_FINAL'
            ? { condition: 'CONSUMIDOR_FINAL', documentType: 99, documentNumber: '0', name: 'CONSUMIDOR FINAL' }
            : {
                condition: 'CONSUMIDOR_FINAL',
                documentType: documentType === 'CUIT' ? 80 : 96,
                documentNumber: documentNumber.replace(/\D/g, ''),
                name: recipientName.trim(),
              },
          currency: 'PES',
          exchangeRate: 1,
          items: [{
            internalCode: `TX-${selectedTransaction.id}`.slice(0, 30),
            description: description.trim() || selectedTransaction.concepto,
            quantity: 1,
            unitCode: 7,
            unitPrice: selectedTransaction.monto,
            total: selectedTransaction.monto,
          }],
          total: selectedTransaction.monto,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || 'ARCA no confirmó la factura.');
      setResult(data);
      setMessage(data.status === 'authorized' || data.status === 'observed'
        ? 'Factura C autorizada por ARCA.'
        : 'La solicitud no fue autorizada. Revisá el detalle.');
      onAddLog(`Factura C ${data.status} para movimiento ${selectedTransaction.id}.`);
      if (data.status === 'authorized' || data.status === 'observed') {
        if (data.cae && data.caeExpiration && data.qrUrl && data.issuer && data.invoiceNumber && data.pointOfSale) {
          setInvoiceSnapshot({
            invoiceNumber: data.invoiceNumber,
            pointOfSale: data.pointOfSale,
            issueDate: data.issueDate || new Date().toISOString().slice(0, 10),
            cae: data.cae,
            caeExpiration: data.caeExpiration,
            qrUrl: data.qrUrl,
            issuer: data.issuer,
            recipient: {
              name: recipientType === 'CONSUMIDOR_FINAL' ? 'CONSUMIDOR FINAL' : recipientName.trim(),
              documentLabel: recipientType === 'CONSUMIDOR_FINAL' ? 'Documento' : documentType,
              documentNumber: recipientType === 'CONSUMIDOR_FINAL' ? '0' : documentNumber.replace(/\D/g, ''),
              taxCondition: 'Consumidor Final',
            },
            items: [{
              description: description.trim() || selectedTransaction.concepto,
              quantity: 1,
              unitPrice: selectedTransaction.monto,
              total: selectedTransaction.monto,
            }],
            total: selectedTransaction.monto,
          });
        }
        setIdempotencyKey(crypto.randomUUID());
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo autorizar la factura C.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-5" aria-labelledby="invoice-c-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Documento fiscal</p>
          <h2 id="invoice-c-title" className="mt-1 text-2xl font-black text-white">Factura electrónica C</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-300">Emisión exclusiva para monotributo. El comprobante solo existe cuando ARCA devuelve un CAE real.</p>
        </div>
        <button type="button" onClick={loadConfiguration} disabled={isLoadingConfig} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200">
          <RefreshCw className={`h-4 w-4 ${isLoadingConfig ? 'animate-spin' : ''}`} /> Revisar configuración
        </button>
      </div>

      <div className={`rounded-xl border p-4 ${configuration.ready ? 'border-emerald-500/25 bg-emerald-500/10' : 'border-amber-500/25 bg-amber-500/10'}`}>
        <div className="flex items-start gap-3">
          {configuration.ready ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" /> : <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" />}
          <div>
            <h3 className={`font-extrabold ${configuration.ready ? 'text-emerald-100' : 'text-amber-100'}`}>
              {configuration.ready ? 'ARCA lista para homologación' : 'Emisión fiscal bloqueada de forma segura'}
            </h3>
            <p className="mt-1 text-xs text-slate-300">Ambiente: {configuration.environment} · Comprobante: C</p>
            {!configuration.ready && <ul className="mt-2 space-y-1 text-xs text-amber-100/80">{configuration.missing.map((item) => <li key={item}>• {item}</li>)}</ul>}
          </div>
        </div>
      </div>

      <form onSubmit={submitInvoice} className="glass-panel grid gap-5 rounded-xl p-5 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-300">Cobro confirmado</label>
            <select value={selectedTxId} onChange={(event) => selectTransaction(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50">
              <option value="">Seleccionar movimiento</option>
              {billableTransactions.map((tx) => <option key={tx.id} value={tx.id}>{tx.concepto} · ${tx.monto.toLocaleString('es-AR')}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-300">Detalle</label>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={200} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50" />
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total factura C</span>
            <strong className="mt-1 block text-2xl text-white">${(selectedTransaction?.monto ?? 0).toLocaleString('es-AR')}</strong>
            <span className="text-xs text-slate-400">Moneda: pesos argentinos</span>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <span className="text-xs font-bold text-slate-300">Receptor</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setRecipientType('CONSUMIDOR_FINAL'); setRecipientName('Consumidor Final'); }} className={`min-h-11 rounded-xl border px-3 text-sm font-bold ${recipientType === 'CONSUMIDOR_FINAL' ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200' : 'border-white/10 bg-white/5 text-slate-300'}`}>Consumidor final</button>
              <button type="button" onClick={() => setRecipientType('IDENTIFICADO')} className={`min-h-11 rounded-xl border px-3 text-sm font-bold ${recipientType === 'IDENTIFICADO' ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200' : 'border-white/10 bg-white/5 text-slate-300'}`}>Identificado</button>
            </div>
          </div>
          {recipientType === 'IDENTIFICADO' && (
            <div className="grid gap-3 sm:grid-cols-3">
              <select value={documentType} onChange={(event) => setDocumentType(event.target.value as 'DNI' | 'CUIT')} className="min-h-11 rounded-xl border border-white/10 bg-slate-900/70 px-3 text-sm text-white"><option value="DNI">DNI</option><option value="CUIT">CUIT</option></select>
              <input value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} placeholder="Documento" inputMode="numeric" className="min-h-11 rounded-xl border border-white/10 bg-slate-900/70 px-3 text-sm text-white sm:col-span-2" />
              <input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} placeholder="Nombre o razón social" className="min-h-11 rounded-xl border border-white/10 bg-slate-900/70 px-3 text-sm text-white sm:col-span-3" />
            </div>
          )}
          <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-3 text-xs leading-relaxed text-slate-300">
            <ShieldCheck className="mr-2 inline h-4 w-4 text-cyan-300" /> CUIT emisor, punto de venta, certificado y endpoints se determinan exclusivamente en el servidor.
          </div>
          <button type="submit" disabled={!configuration.ready || !selectedTransaction || isSubmitting} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-black text-cyan-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40">
            {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
            {isSubmitting ? 'Autorizando…' : 'Solicitar CAE y emitir factura C'}
          </button>
        </div>
      </form>

      {message && <p role="status" className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm font-bold text-slate-200">{message}</p>}

      {result && (
        <div className="glass-panel rounded-xl p-5">
          <div className="flex items-center gap-2"><FileText className="h-5 w-5 text-cyan-300" /><h3 className="font-extrabold text-white">Resultado ARCA: {result.status}</h3></div>
          {result.cae && <div className="mt-4 grid gap-3 sm:grid-cols-3"><div><span className="text-xs text-slate-400">Comprobante</span><strong className="block text-white">C {result.pointOfSale}-{result.invoiceNumber}</strong></div><div><span className="text-xs text-slate-400">CAE</span><strong className="block font-mono text-white">{result.cae}</strong></div><div><span className="text-xs text-slate-400">Vencimiento</span><strong className="block text-white">{result.caeExpiration}</strong></div></div>}
          {invoiceSnapshot && (
            <button
              type="button"
              onClick={() => generateInvoiceCPDF(invoiceSnapshot).catch((error) => setMessage(error instanceof Error ? error.message : 'No se pudo generar el PDF fiscal.'))}
              className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-black text-cyan-950 hover:bg-cyan-400"
            >
              <FileText className="h-4 w-4" /> Descargar Factura C en PDF
            </button>
          )}
          {[...(result.observations ?? []), ...(result.errors ?? [])].map((detail) => <p key={detail} className="mt-2 text-xs text-amber-200">{detail}</p>)}
        </div>
      )}
    </section>
  );
}
