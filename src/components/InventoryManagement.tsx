import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ClipboardList,
  Download,
  Layers,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingCart
} from 'lucide-react';
import { Insumo } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface InventoryMovementInput {
  productId: number;
  delta: number;
  reason: string;
  supplier?: string;
  unitCost?: number;
  registerCashExpense?: boolean;
}

interface InventoryMovementResult {
  movementId: string;
  stock: number;
  cashMovementId?: string;
}

interface InventoryManagementProps {
  insumos: Insumo[];
  onAdjustStock: (input: InventoryMovementInput) => Promise<InventoryMovementResult>;
  onAddLog: (message: string) => void;
}

interface StockMovement {
  id: string;
  insumoNombre: string;
  tipo: 'ENTRADA' | 'AJUSTE';
  cantidad: number;
  unidad: string;
  concepto: string;
  proveedor?: string;
  fecha: string;
}

type ActionStatus = { type: 'success' | 'error'; message: string } | null;

export default function InventoryManagement({
  insumos,
  onAdjustStock,
  onAddLog
}: InventoryManagementProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInsumoId, setSelectedInsumoId] = useState('');
  const [purchaseQuantity, setPurchaseQuantity] = useState('5');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [purchaseSupplier, setPurchaseSupplier] = useState('');
  const [registerInCashBook, setRegisterInCashBook] = useState(true);
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState('1');
  const [adjustmentType, setAdjustmentType] = useState<'MAS' | 'MENOS'>('MAS');
  const [adjustmentReason, setAdjustmentReason] = useState('Ajuste por conteo físico');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionStatus, setActionStatus] = useState<ActionStatus>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  useEffect(() => {
    if (!selectedInsumoId || !insumos.some((item) => item.id === selectedInsumoId)) {
      setSelectedInsumoId(insumos[0]?.id || '');
    }
  }, [insumos, selectedInsumoId]);

  const filteredInsumos = useMemo(
    () => insumos.filter((item) => item.nombre.toLowerCase().includes(searchTerm.toLowerCase())),
    [insumos, searchTerm]
  );
  const totalStockValue = insumos.reduce((total, item) => total + item.stockActual * item.precioCosto, 0);
  const criticalItems = insumos.filter((item) => item.stockActual <= item.stockMinimo);
  const outOfStockItems = insumos.filter((item) => item.stockActual === 0).length;
  const selectedInsumo = insumos.find((item) => item.id === selectedInsumoId);

  const parsePositiveInteger = (raw: string) => {
    const value = Number(raw);
    return Number.isInteger(value) && value > 0 ? value : null;
  };

  const handlePurchaseSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setActionStatus(null);
    const quantity = parsePositiveInteger(purchaseQuantity);
    const unitCost = purchaseCost.trim() ? Number(purchaseCost) : selectedInsumo?.precioCosto || 0;
    if (!selectedInsumo || !quantity) {
      setActionStatus({ type: 'error', message: 'Seleccioná un producto e ingresá una cantidad entera positiva.' });
      return;
    }
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      setActionStatus({ type: 'error', message: 'El costo unitario no es válido.' });
      return;
    }
    if (registerInCashBook && unitCost <= 0) {
      setActionStatus({ type: 'error', message: 'Para registrar el egreso de caja necesitás un costo unitario positivo.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onAdjustStock({
        productId: Number(selectedInsumo.id),
        delta: quantity,
        reason: 'Compra de stock a proveedor',
        supplier: purchaseSupplier.trim(),
        unitCost,
        registerCashExpense: registerInCashBook
      });
      setMovements((previous) => [{
        id: result.movementId,
        insumoNombre: selectedInsumo.nombre,
        tipo: 'ENTRADA',
        cantidad: quantity,
        unidad: selectedInsumo.unidad,
        concepto: registerInCashBook ? 'Compra confirmada con egreso de caja' : 'Entrada de stock confirmada sin egreso',
        proveedor: purchaseSupplier.trim() || undefined,
        fecha: new Date().toISOString()
      }, ...previous]);
      setActionStatus({ type: 'success', message: `Movimiento #${result.movementId} confirmado. Stock actual: ${result.stock}.` });
      onAddLog(`📦 [INVENTARIO] Movimiento ${result.movementId} confirmado para ${selectedInsumo.nombre}: +${quantity}.`);
      setPurchaseQuantity('5');
      setPurchaseCost('');
    } catch (error) {
      setActionStatus({ type: 'error', message: error instanceof Error ? error.message : 'No se pudo confirmar la entrada de stock.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualAdjustment = async (event: React.FormEvent) => {
    event.preventDefault();
    setActionStatus(null);
    if (!editingInsumo) return;
    const amount = parsePositiveInteger(adjustmentAmount);
    if (!amount) {
      setActionStatus({ type: 'error', message: 'La cantidad del ajuste debe ser un entero positivo.' });
      return;
    }
    const delta = adjustmentType === 'MAS' ? amount : -amount;
    if (editingInsumo.stockActual + delta < 0) {
      setActionStatus({ type: 'error', message: 'El ajuste dejaría el stock en negativo.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onAdjustStock({
        productId: Number(editingInsumo.id),
        delta,
        reason: adjustmentReason.trim() || 'Ajuste por conteo físico',
        unitCost: 0,
        registerCashExpense: false
      });
      setMovements((previous) => [{
        id: result.movementId,
        insumoNombre: editingInsumo.nombre,
        tipo: 'AJUSTE',
        cantidad: delta,
        unidad: editingInsumo.unidad,
        concepto: adjustmentReason.trim() || 'Ajuste por conteo físico',
        fecha: new Date().toISOString()
      }, ...previous]);
      setActionStatus({ type: 'success', message: `Ajuste #${result.movementId} confirmado. Stock actual: ${result.stock}.` });
      onAddLog(`⚙️ [INVENTARIO] Ajuste ${result.movementId} confirmado para ${editingInsumo.nombre}: ${delta > 0 ? '+' : ''}${delta}.`);
      setEditingInsumo(null);
    } catch (error) {
      setActionStatus({ type: 'error', message: error instanceof Error ? error.message : 'No se pudo confirmar el ajuste.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const generatePurchaseOrder = () => {
    if (criticalItems.length === 0) {
      setActionStatus({ type: 'error', message: 'No hay productos en stock crítico para preparar la orden.' });
      return;
    }
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('BORRADOR DE ORDEN DE COMPRA', 15, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Documento sugerido: no fue enviado ni registrado como deuda.', 15, 25);
    const rows = criticalItems.map((item) => {
      const suggested = Math.max(1, item.stockMinimo * 2 - item.stockActual);
      return [item.nombre, item.stockActual, item.stockMinimo, suggested, item.unidad];
    });
    autoTable(doc, {
      startY: 34,
      head: [['Producto', 'Stock', 'Mínimo', 'Sugerido', 'Unidad']],
      body: rows
    });
    doc.save(`Borrador_orden_compra_${new Date().toISOString().slice(0, 10)}.pdf`);
    onAddLog('📄 [INVENTARIO] Borrador de orden de compra descargado. No fue enviado al proveedor.');
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 min-w-0">
      <div className="xl:col-span-8 space-y-6 min-w-0">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Productos', value: insumos.length, icon: Package, color: 'text-cyan-300' },
            { label: 'Valor al costo', value: `$${totalStockValue.toLocaleString('es-AR')}`, icon: Layers, color: 'text-emerald-300' },
            { label: 'Stock crítico', value: criticalItems.length, icon: AlertTriangle, color: 'text-amber-300' },
            { label: 'Sin stock', value: outOfStockItems, icon: ShieldCheck, color: 'text-red-300' }
          ].map((card) => (
            <div key={card.label} className="glass-panel p-3 rounded-xl border border-white/[0.06] flex items-center justify-between">
              <div><span className="text-[9px] text-slate-500 uppercase font-bold block">{card.label}</span><span className={`text-lg font-black font-mono ${card.color}`}>{card.value}</span></div>
              <card.icon className={`w-6 h-6 ${card.color} opacity-60`} />
            </div>
          ))}
        </div>

        {actionStatus && (
          <div className={`rounded-xl border px-4 py-3 text-xs ${actionStatus.type === 'success' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200' : 'border-red-500/25 bg-red-500/10 text-red-200'}`} role={actionStatus.type === 'error' ? 'alert' : 'status'}>
            {actionStatus.message}
          </div>
        )}

        <div className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-4">
          <div className="flex flex-col sm:flex-row justify-between gap-3 border-b border-white/[0.06] pb-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2"><Package className="w-4 h-4 text-brand-primary" />Inventario sincronizado</h3>
            <div className="relative sm:w-64"><Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar producto..." className="w-full bg-black/30 border border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white" /></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-[9px] text-slate-500 uppercase border-b border-white/[0.05]"><th className="py-2 text-left">Producto</th><th className="text-right">Stock</th><th className="text-right">Mínimo</th><th className="text-right">Costo</th><th className="text-right">Acciones</th></tr></thead>
              <tbody>
                {filteredInsumos.map((item) => (
                  <tr key={item.id} className="border-b border-white/[0.04]">
                    <td className="py-3 font-semibold text-slate-200">{item.nombre}</td>
                    <td className={`text-right font-mono font-bold ${item.stockActual <= item.stockMinimo ? 'text-amber-300' : 'text-emerald-300'}`}>{item.stockActual} {item.unidad}</td>
                    <td className="text-right font-mono text-slate-400">{item.stockMinimo}</td>
                    <td className="text-right font-mono text-slate-300">${item.precioCosto.toLocaleString('es-AR')}</td>
                    <td className="text-right"><div className="inline-flex gap-1.5"><button type="button" onClick={() => { setEditingInsumo(item); setAdjustmentType('MAS'); }} className="p-1.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300" title="Incrementar stock"><Plus className="w-3.5 h-3.5" /></button><button type="button" onClick={() => { setEditingInsumo(item); setAdjustmentType('MENOS'); }} className="p-1.5 rounded bg-red-500/10 border border-red-500/20 text-red-300" title="Reducir stock"><Minus className="w-3.5 h-3.5" /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="xl:col-span-4 space-y-6 min-w-0">
        {editingInsumo && (
          <form onSubmit={handleManualAdjustment} className="glass-panel p-5 rounded-xl border border-brand-primary/30 space-y-4">
            <div className="flex justify-between border-b border-white/[0.06] pb-2"><h3 className="text-xs font-bold text-white uppercase flex items-center gap-2"><RefreshCw className="w-4 h-4 text-brand-primary" />Ajustar {editingInsumo.nombre}</h3><button type="button" onClick={() => setEditingInsumo(null)} className="text-slate-400">×</button></div>
            <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setAdjustmentType('MAS')} className={`py-2 rounded-lg text-xs font-bold border ${adjustmentType === 'MAS' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'border-white/[0.06] text-slate-400'}`}>Incrementar</button><button type="button" onClick={() => setAdjustmentType('MENOS')} className={`py-2 rounded-lg text-xs font-bold border ${adjustmentType === 'MENOS' ? 'bg-red-500/10 text-red-300 border-red-500/30' : 'border-white/[0.06] text-slate-400'}`}>Reducir</button></div>
            <input type="number" min="1" step="1" required value={adjustmentAmount} onChange={(event) => setAdjustmentAmount(event.target.value)} className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white" aria-label="Cantidad del ajuste" />
            <input type="text" required minLength={3} maxLength={200} value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white" aria-label="Motivo del ajuste" />
            <button type="submit" disabled={isSubmitting} className="w-full bg-brand-primary hover:bg-brand-hover disabled:opacity-50 text-white font-bold py-2 rounded-lg text-xs uppercase">{isSubmitting ? 'Confirmando…' : 'Confirmar ajuste real'}</button>
          </form>
        )}

        <form onSubmit={handlePurchaseSubmit} className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-3">
          <h3 className="text-xs font-bold text-white uppercase flex items-center gap-2 border-b border-white/[0.06] pb-2"><ShoppingCart className="w-4 h-4 text-emerald-300" />Entrada de stock existente</h3>
          <select value={selectedInsumoId} onChange={(event) => setSelectedInsumoId(event.target.value)} disabled={!insumos.length} className="w-full bg-slate-900 border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white">{insumos.map((item) => <option key={item.id} value={item.id}>{item.nombre} — {item.stockActual} {item.unidad}</option>)}</select>
          <div className="grid grid-cols-2 gap-2"><input type="number" min="1" step="1" required value={purchaseQuantity} onChange={(event) => setPurchaseQuantity(event.target.value)} className="bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white" placeholder="Cantidad" /><input type="number" min="0" step="0.01" value={purchaseCost} onChange={(event) => setPurchaseCost(event.target.value)} className="bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white" placeholder={`Costo: ${selectedInsumo?.precioCosto || 0}`} /></div>
          <input type="text" maxLength={100} value={purchaseSupplier} onChange={(event) => setPurchaseSupplier(event.target.value)} className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white" placeholder="Proveedor (opcional)" />
          <label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={registerInCashBook} onChange={(event) => setRegisterInCashBook(event.target.checked)} className="accent-emerald-500" />Registrar egreso atómico en la caja abierta</label>
          <button type="submit" disabled={isSubmitting || !insumos.length} className="w-full bg-emerald-500/20 border border-emerald-500/30 disabled:opacity-50 text-emerald-300 font-bold py-2 rounded-lg text-xs uppercase">{isSubmitting ? 'Confirmando…' : 'Confirmar entrada real'}</button>
          <p className="text-[9px] text-slate-500">El alta de productos nuevos y las compras a crédito quedan bloqueadas hasta incorporar proveedores y cuentas corrientes en Supabase.</p>
        </form>

        <div className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-3">
          <h3 className="text-xs font-bold text-white uppercase flex items-center gap-2"><ClipboardList className="w-4 h-4 text-brand-primary" />Orden sugerida</h3>
          <button type="button" onClick={generatePurchaseOrder} disabled={!criticalItems.length} className="w-full bg-white/[0.04] border border-white/[0.08] disabled:opacity-40 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-2"><Download className="w-3.5 h-3.5" />Descargar borrador PDF</button>
          <p className="text-[9px] text-slate-500">El PDF no se envía ni genera deuda automáticamente.</p>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-3">
          <h3 className="text-xs font-bold text-white uppercase">Movimientos confirmados en esta sesión</h3>
          {movements.length === 0 ? <p className="text-[10px] text-slate-500">Todavía no se confirmaron movimientos desde este panel.</p> : movements.map((movement) => (
            <div key={movement.id} className="rounded-lg border border-white/[0.05] bg-white/[0.01] p-2.5 text-[10px]">
              <div className="flex justify-between"><span className="font-bold text-slate-200">{movement.insumoNombre}</span><span className={movement.cantidad > 0 ? 'text-emerald-300' : 'text-red-300'}>{movement.cantidad > 0 ? <ArrowUpRight className="inline w-3 h-3" /> : <ArrowDownRight className="inline w-3 h-3" />} {movement.cantidad > 0 ? '+' : ''}{movement.cantidad} {movement.unidad}</span></div>
              <p className="text-slate-500 mt-1">#{movement.id} · {movement.concepto}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
