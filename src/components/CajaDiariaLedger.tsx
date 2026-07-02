import React, { useState } from 'react';
import { 
  DollarSign, ArrowUpRight, ArrowDownRight, Package, AlertTriangle, 
  Plus, Check, Lock, ShieldAlert, ShoppingBag, RefreshCw, Download 
} from 'lucide-react';
import { Insumo, Transaccion, Rol } from '../types';
import { generateTicketPDF } from '../utils/ticketGenerator';

interface CajaDiariaLedgerProps {
  role: Rol;
  insumos: Insumo[];
  onReplenishInsumo: (id: string) => void;
  transacciones: Transaccion[];
  onAddTransaccion: (monto: number, concepto: string, tipo: 'INGRESO' | 'EGRESO', origen: 'MANUAL' | 'VENTA_POS') => void;
  cajaAbierta: boolean;
  montoApertura: number;
  onOpenCaja: (monto: number) => void;
  onCloseCaja: (montoCierre: number) => void;
  onSellPOS: (insumoId: string, cantidad: number) => void;
}

export default function CajaDiariaLedger({
  role,
  insumos,
  onReplenishInsumo,
  transacciones,
  onAddTransaccion,
  cajaAbierta,
  montoApertura,
  onOpenCaja,
  onCloseCaja,
  onSellPOS,
}: CajaDiariaLedgerProps) {
  // Opening state inputs
  const [openingInput, setOpeningInput] = useState('35000');
  const [closingInput, setClosingInput] = useState('');
  const [isCastingClose, setIsCastingClose] = useState(false);

  // Manual transaction inputs
  const [manualConcepto, setManualConcepto] = useState('');
  const [manualMonto, setManualMonto] = useState('');
  const [manualTipo, setManualTipo] = useState<'INGRESO' | 'EGRESO'>('EGRESO');

  // POS transaction inputs
  const [posSelectedInsumo, setPosSelectedInsumo] = useState(insumos[0]?.id || '');
  const [posCantidad, setPosCantidad] = useState(1);

  // Last POS sale for quick ticket download
  const [lastSale, setLastSale] = useState<{ id: string; concepto: string; monto: number; fecha: string } | null>(null);

  // Check if current role has access
  const isBlockedByRBAC = role === 'LAVADOR' || role === 'OPERARIO';

  const totalIngresos = transacciones
    .filter((t) => t.tipo === 'INGRESO')
    .reduce((sum, t) => sum + t.monto, 0);

  const totalEgresos = transacciones
    .filter((t) => t.tipo === 'EGRESO')
    .reduce((sum, t) => sum + t.monto, 0);

  const saldoActual = totalIngresos - totalEgresos;
  const currentPosInsumo = insumos.find((i) => i.id === posSelectedInsumo);

  const handleOpenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(openingInput);
    if (!isNaN(val) && val >= 0) {
      onOpenCaja(val);
    }
  };

  const handleCloseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(closingInput);
    if (!isNaN(val) && val >= 0) {
      onCloseCaja(val);
      setIsCastingClose(false);
      setClosingInput('');
    }
  };

  const handleManualTxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(manualMonto);
    if (manualConcepto.trim() && !isNaN(val) && val > 0) {
      onAddTransaccion(val, manualConcepto.trim(), manualTipo, 'MANUAL');
      setManualConcepto('');
      setManualMonto('');
    }
  };

  const handlePosSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const insumo = insumos.find((i) => i.id === posSelectedInsumo);
    if (insumo && posCantidad > 0 && insumo.stockActual >= posCantidad) {
      onSellPOS(posSelectedInsumo, posCantidad);
      
      const priceSold = Math.round(insumo.precioCosto * 1.5 * posCantidad);
      const saleId = `tx_pos_${Date.now()}`;
      const saleDate = new Date().toISOString();
      const concepto = `Venta POS: ${posCantidad}x ${insumo.nombre}`;
      
      const newSale = {
        id: saleId,
        concepto,
        monto: priceSold,
        fecha: saleDate
      };
      
      setLastSale(newSale);
      setPosCantidad(1);

      // Automatically download PDF receipt
      generateTicketPDF({
        id: saleId,
        servicioNombre: concepto,
        precio: priceSold,
        fecha: saleDate,
        origen: 'VENTA_POS'
      });
    }
  };

  // Critical stock items (stockActual <= stockMinimo)
  const criticalItems = insumos.filter((item) => item.stockActual <= item.stockMinimo);

  return (
    <div className="space-y-6 relative">
      {/* RBAC Glass Overlays */}
      {isBlockedByRBAC && (
        <div className="absolute inset-0 z-40 bg-[#06080a]/85 backdrop-blur-md rounded-xl flex flex-col justify-center items-center p-6 border border-white/[0.08] select-none animate-fade-in">
          <div className="p-4 rounded-full bg-red-950/20 border border-red-500/30 text-red-400 mb-4 animate-bounce">
            <Lock className="w-10 h-10" />
          </div>
          <h3 className="text-lg font-bold text-white uppercase tracking-wider font-display text-center">PANEL BLOQUEADO POR ROLES</h3>
          <p className="text-xs text-slate-400 text-center max-w-sm mt-2 leading-relaxed font-sans">
            Tu rol actual es <b className="text-red-400">{role}</b>. Por políticas de auditoría del lavadero, solo los roles de <b className="text-white">ADMINISTRADOR</b> y <b className="text-white">SUPERADMIN</b> pueden manipular la Caja Diaria, ingresar egresos o abastecer stock.
          </p>
          <div className="mt-4 flex items-center gap-1.5 text-[11px] text-red-400 bg-red-950/10 px-3 py-1.5 rounded-lg border border-red-900/20">
            <ShieldAlert className="w-4 h-4" />
            <span>Solicita autorización a un administrador para realizar cierres o egresos.</span>
          </div>
        </div>
      )}

      {/* Grid structure */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        {/* LEFT COLUMN: Cashier (Caja) Controls & Ledger */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Card: Opening / Closing cashier control */}
          <div className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <div className="flex justify-between items-center pb-2 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${cajaAbierta ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                <h3 className="font-bold text-white text-sm uppercase tracking-wider">Caja Diaria</h3>
              </div>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Ledger Oficial</span>
            </div>

            {!cajaAbierta ? (
              <form onSubmit={handleOpenSubmit} className="space-y-4 py-2">
                <div className="bg-white/[0.02] p-4 rounded-xl border border-white/[0.06] flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">LA CAJA ESTÁ ACTUALMENTE</span>
                  <span className="text-xl font-extrabold text-red-400 font-display mt-0.5 tracking-wider">CERRADA</span>
                  <p className="text-xs text-slate-400 text-center mt-2 max-w-xs leading-relaxed">
                    Para comenzar a registrar turnos, ventas de POS o egresos de stock, debes inicializar la caja con un fondo de cambio.
                  </p>
                </div>

                <div className="flex gap-3 max-w-md mx-auto">
                  <div className="relative flex-1">
                    <input
                      id="input-caja-opening"
                      type="number"
                      required
                      value={openingInput}
                      onChange={(e) => setOpeningInput(e.target.value)}
                      placeholder="Monto de apertura"
                      className="w-full bg-black/30 border border-white/[0.1] focus:border-[#00d2ff]/60 focus:outline-none rounded-lg pl-8 pr-3 py-2 text-xs text-white font-mono"
                    />
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-500 text-xs">$</div>
                  </div>
                  <button
                    id="btn-open-caja"
                    type="submit"
                    className="bg-[#00d2ff]/20 hover:bg-[#00d2ff]/30 text-[#00d2ff] border border-[#00d2ff]/30 font-bold py-2 px-4 rounded-lg text-xs transition duration-200"
                  >
                    Abrir Caja
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                {/* Financial overview cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white/[0.02] p-3 rounded-lg border border-white/[0.06]">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Ingresos</span>
                    <span className="text-base font-bold text-emerald-400 block font-mono mt-0.5">${totalIngresos.toLocaleString('es-AR')}</span>
                  </div>
                  <div className="bg-white/[0.02] p-3 rounded-lg border border-white/[0.06]">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Egresos</span>
                    <span className="text-base font-bold text-red-400 block font-mono mt-0.5">${totalEgresos.toLocaleString('es-AR')}</span>
                  </div>
                  <div className="bg-white/[0.02] p-3 rounded-lg border border-white/[0.06] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-8 h-8 bg-[#00d2ff]/5 rounded-full blur-sm" />
                    <span className="text-[10px] text-[#00d2ff] block uppercase font-bold tracking-wider">Saldo</span>
                    <span className="text-base font-bold text-white block font-mono mt-0.5">${saldoActual.toLocaleString('es-AR')}</span>
                  </div>
                </div>

                {isCastingClose ? (
                  <form onSubmit={handleCloseSubmit} className="bg-white/[0.02] p-3.5 rounded-lg border border-white/[0.08] space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Arqueo y Cierre de Caja</span>
                      <button 
                        type="button" 
                        onClick={() => setIsCastingClose(false)} 
                        className="text-[10px] text-slate-400 hover:text-slate-200 underline"
                      >
                        Cancelar
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      El saldo teórico según transacciones es de <b>${saldoActual.toLocaleString('es-AR')}</b>. Por favor, ingresa el dinero físico real contado en el cajón.
                    </p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          id="input-caja-closing"
                          type="number"
                          required
                          value={closingInput}
                          onChange={(e) => setClosingInput(e.target.value)}
                          placeholder="Monto real en caja"
                          className="w-full bg-black/30 border border-white/[0.1] focus:border-[#00d2ff]/60 focus:outline-none rounded-lg pl-7 pr-3 py-1.5 text-xs text-white font-mono"
                        />
                        <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none text-slate-500 text-xs">$</div>
                      </div>
                      <button
                        id="btn-confirm-close-caja"
                        type="submit"
                        className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-bold py-1.5 px-3 rounded-lg text-xs transition duration-200"
                      >
                        Cerrar Turno
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex justify-between items-center bg-white/[0.01] p-2 border border-white/[0.06] rounded-lg">
                    <span className="text-[11px] text-slate-400">Caja abierta con base: <b>${montoApertura.toLocaleString('es-AR')}</b></span>
                    <button
                      id="btn-trigger-close"
                      onClick={() => {
                        setIsCastingClose(true);
                        setClosingInput(saldoActual.toString());
                      }}
                      className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-bold py-1 px-2.5 rounded text-[10px] uppercase tracking-wider transition"
                    >
                      Cerrar Caja
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card: History Ledger List */}
          <div className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest pb-1.5 border-b border-white/[0.08]">Historial del Arqueo</h4>
            
            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
              {transacciones.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">Sin transacciones registradas hoy.</div>
              ) : (
                [...transacciones].reverse().map((tx) => (
                  <div key={tx.id} className="bg-white/[0.01] p-2.5 rounded-lg border border-white/[0.04] flex justify-between items-center gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded ${tx.tipo === 'INGRESO' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                        {tx.tipo === 'INGRESO' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <span className="text-xs text-white block font-medium leading-snug">{tx.concepto}</span>
                        <div className="flex gap-1.5 items-center mt-0.5">
                          <span className={`text-[9px] px-1 rounded font-mono font-bold ${
                            tx.origen === 'TURNO' ? 'bg-[#00d2ff]/10 text-[#00d2ff] border border-[#00d2ff]/20' :
                            tx.origen === 'VENTA_POS' ? 'bg-[#9d50bb]/15 text-purple-300 border-[#9d50bb]/20' : 'bg-white/[0.04] text-slate-400 border border-white/[0.06]'
                          }`}>{tx.origen}</span>
                          <span className="text-[9px] text-slate-500 font-mono">
                            {new Date(tx.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold font-mono ${tx.tipo === 'INGRESO' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {tx.tipo === 'INGRESO' ? '+' : '-'}${tx.monto.toLocaleString('es-AR')}
                      </span>
                      {tx.tipo === 'INGRESO' && (tx.origen === 'VENTA_POS' || tx.origen === 'TURNO') && (
                        <button
                          type="button"
                          onClick={() => generateTicketPDF({
                            id: tx.id,
                            servicioNombre: tx.concepto,
                            precio: tx.monto,
                            fecha: tx.fecha,
                            origen: tx.origen === 'TURNO' ? 'TURNO' : 'VENTA_POS',
                            clienteNombre: tx.origen === 'TURNO' ? tx.concepto.replace('Cobro Turno: ', '').split(' (')[0] : undefined
                          })}
                          className="p-1 rounded bg-white/[0.02] hover:bg-[#00d2ff]/10 text-slate-400 hover:text-[#00d2ff] border border-white/[0.06] transition"
                          title="Descargar Ticket PDF"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Quick manual cash transaction entry */}
            {cajaAbierta && (
              <form onSubmit={handleManualTxSubmit} className="bg-white/[0.01] p-3 rounded-lg border border-white/[0.06] space-y-3 pt-3 mt-4">
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">Agregar Movimiento Manual</span>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-5">
                    <input
                      id="input-manual-concept"
                      type="text"
                      required
                      value={manualConcepto}
                      onChange={(e) => setManualConcepto(e.target.value)}
                      placeholder="Concepto (ej: Compra trapos)"
                      className="w-full bg-black/30 border border-white/[0.1] focus:border-[#00d2ff]/60 focus:outline-none rounded px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <div className="relative">
                      <input
                        id="input-manual-amount"
                        type="number"
                        required
                        min="1"
                        value={manualMonto}
                        onChange={(e) => setManualMonto(e.target.value)}
                        placeholder="Monto"
                        className="w-full bg-black/30 border border-white/[0.1] focus:border-[#00d2ff]/60 focus:outline-none rounded pl-5 pr-1.5 py-1.5 text-xs text-white font-mono"
                      />
                      <span className="absolute left-2 inset-y-0 flex items-center text-slate-500 text-xs">$</span>
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <select
                      id="select-manual-type"
                      value={manualTipo}
                      onChange={(e) => setManualTipo(e.target.value as 'INGRESO' | 'EGRESO')}
                      className="w-full bg-[#0c0f12] border border-white/[0.1] focus:border-[#00d2ff]/60 focus:outline-none rounded px-1 py-1.5 text-xs text-white"
                    >
                      <option value="EGRESO" className="bg-[#0c0f12]">Egreso</option>
                      <option value="INGRESO" className="bg-[#0c0f12]">Ingreso</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      id="btn-add-manual-tx"
                      type="submit"
                      className="w-full bg-[#00d2ff]/20 hover:bg-[#00d2ff]/30 text-[#00d2ff] border border-[#00d2ff]/20 py-1.5 rounded text-xs font-bold transition"
                    >
                      Cargar
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: POS (Punto de Venta) & Critical Inventory */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* POS Cart widget */}
          <div className="glass-panel p-5 rounded-xl border border-red-500/15 space-y-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden card-sport-border">
            <div className="flex items-center gap-2 pb-2 border-b border-white/[0.08]">
              <span className="p-2 rounded-lg bg-red-500/10 border border-red-500/25 text-red-500">
                <ShoppingBag className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-extrabold text-white text-sm uppercase tracking-widest font-display">Punto de Venta (POS)</h3>
                <span className="text-[10px] text-red-400 font-bold uppercase tracking-widest">Insumos y Adicionales</span>
              </div>
            </div>

            {cajaAbierta ? (
              <form onSubmit={handlePosSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Producto a Vender</label>
                  <select
                    id="select-pos-insumo"
                    value={posSelectedInsumo}
                    onChange={(e) => setPosSelectedInsumo(e.target.value)}
                    className="w-full bg-black/40 border border-white/[0.08] focus:border-red-500/60 focus:outline-none rounded-lg px-2.5 py-2 text-xs text-white"
                  >
                    {insumos.map((i) => {
                      const isLow = i.stockActual <= i.stockMinimo;
                      const isOut = i.stockActual === 0;
                      return (
                        <option key={i.id} value={i.id} disabled={isOut} className="bg-[#0c0f12] text-white">
                          {i.nombre} - ${Math.round(i.precioCosto * 1.5)} ({isOut ? 'SIN STOCK' : isLow ? `Bajo Stock: ${i.stockActual}` : `Stock: ${i.stockActual}`} {i.unidad})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Cantidad</label>
                    <input
                      id="input-pos-quantity"
                      type="number"
                      required
                      min="1"
                      value={posCantidad}
                      onChange={(e) => setPosCantidad(Number(e.target.value))}
                      className="w-full bg-black/40 border border-white/[0.08] focus:border-red-500/60 focus:outline-none rounded-lg px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>

                  <div className="col-span-2 flex items-end">
                    <button
                      id="btn-pos-sell"
                      type="submit"
                      className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-200 hover:text-white font-black uppercase tracking-widest py-2 rounded-lg text-[10px] transition duration-200 cursor-pointer shadow-md"
                    >
                      Registrar Venta
                    </button>
                  </div>
                </div>

                {/* Live Ticket Mockup Preview */}
                <div className="bg-amber-50/5 text-amber-200/90 font-mono text-[10px] p-4 rounded-lg border border-amber-500/20 space-y-2 relative overflow-hidden shadow-inner bg-black/50">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/5 rounded-full blur-md" />
                  <div className="text-center font-extrabold border-b border-white/[0.08] pb-1.5 uppercase tracking-wider text-white">
                    *** ALBELO DETAIL ***
                    <span className="text-[7.5px] block text-slate-400 normal-case mt-0.5 tracking-normal">Estética Vehicular & Detailing</span>
                  </div>
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between">
                      <span>PRODUCTO:</span>
                      <span className="text-white font-bold">{currentPosInsumo?.nombre || 'Ninguno'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>CANTIDAD:</span>
                      <span className="text-white">{posCantidad} U.</span>
                    </div>
                    <div className="flex justify-between">
                      <span>PRECIO UNIT:</span>
                      <span className="text-slate-300">${Math.round((currentPosInsumo?.precioCosto || 0) * 1.5)} ARS</span>
                    </div>
                    <div className="flex justify-between border-t border-white/[0.08] pt-1.5 text-xs font-bold text-red-400">
                      <span>TOTAL ESTIMADO:</span>
                      <span>${Math.round((currentPosInsumo?.precioCosto || 0) * 1.5 * posCantidad)} ARS</span>
                    </div>
                  </div>
                  <div className="text-[7px] text-slate-500 text-center pt-1 border-t border-white/[0.08] uppercase tracking-wider">
                    Simulador Factura Electrónica AFIP
                  </div>
                </div>
              </form>
            ) : (
              <div className="text-center py-4 text-xs text-slate-500 italic">Debe abrir la Caja Diaria para realizar ventas de POS.</div>
            )}

            {lastSale && (
              <div className="bg-emerald-500/5 border border-emerald-500/25 p-3 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 animate-fade-in">
                <div className="space-y-0.5">
                  <span className="text-[9px] text-emerald-400 font-extrabold uppercase tracking-widest block">¡Venta Registrada!</span>
                  <span className="text-xs text-white block font-medium truncate max-w-[200px]">{lastSale.concepto}</span>
                </div>
                <button
                  id="btn-download-last-pos"
                  type="button"
                  onClick={() => generateTicketPDF({
                    id: lastSale.id,
                    servicioNombre: lastSale.concepto,
                    precio: lastSale.monto,
                    fecha: lastSale.fecha,
                    origen: 'VENTA_POS'
                  })}
                  className="text-[10px] font-black uppercase tracking-widest text-[#00d2ff] hover:text-white flex items-center gap-1 bg-[#00d2ff]/10 hover:bg-[#00d2ff]/20 border border-[#00d2ff]/20 px-2 py-1.5 rounded transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar Ticket
                </button>
              </div>
            )}
          </div>

          {/* Critical Stock widget */}
          <div className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <div className="flex justify-between items-center pb-2 border-b border-white/[0.08]">
              <div className="flex items-center gap-1.5">
                <Package className="w-4 h-4 text-slate-400" />
                <h3 className="font-bold text-white text-sm uppercase tracking-wide">Inventario Crítico</h3>
              </div>
              {criticalItems.length > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded animate-pulse">
                  <AlertTriangle className="w-3 h-3" />
                  {criticalItems.length} Alertas
                </span>
              )}
            </div>

            <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
              {insumos.map((item) => {
                const isLow = item.stockActual <= item.stockMinimo;
                const isOut = item.stockActual === 0;
                
                return (
                  <div
                    key={item.id}
                    id={`insumo-item-${item.id}`}
                    className={`p-2.5 rounded-lg border transition ${
                      isOut ? 'border-red-500/20 bg-red-500/5' :
                      isLow ? 'border-amber-500/20 bg-amber-500/5' : 'border-white/[0.04] bg-white/[0.01]'
                    } flex justify-between items-center gap-3`}
                  >
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <span className="text-xs text-white block font-bold truncate">{item.nombre}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold ${
                          isOut ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-slate-400'
                        }`}>
                          {isOut ? 'SIN STOCK' : `Stock: ${item.stockActual} / ${item.stockMinimo} ${item.unidad}`}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">Costo: ${item.precioCosto}</span>
                      </div>
                    </div>

                    {/* Quick +10 Action */}
                    <button
                      id={`btn-replenish-${item.id}`}
                      onClick={() => onReplenishInsumo(item.id)}
                      className="p-1.5 rounded bg-white/[0.02] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white transition flex items-center gap-1 text-[10px] font-bold"
                      title="Reabastecer con 10 unidades rápido"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#00d2ff]" />
                      <span>+10</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
