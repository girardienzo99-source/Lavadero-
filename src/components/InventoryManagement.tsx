import React, { useState } from 'react';
import { 
  Package, AlertTriangle, ArrowUpRight, ArrowDownRight, Plus, Minus, DollarSign, 
  ShoppingCart, RefreshCw, Layers, ShieldCheck, ClipboardList, User, Search, Download
} from 'lucide-react';
import { Insumo, Transaccion } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface InventoryManagementProps {
  insumos: Insumo[];
  onUpdateInsumos: (updated: Insumo[]) => void;
  onAddLog: (message: string) => void;
  onAddTransaccion?: (tx: Transaccion) => void;
}

interface StockMovement {
  id: string;
  insumoNombre: string;
  tipo: 'ENTRADA' | 'SALIDA' | 'AJUSTE';
  cantidad: number;
  unidad: string;
  concepto: string;
  proveedor?: string;
  fecha: string;
}

export default function InventoryManagement({
  insumos,
  onUpdateInsumos,
  onAddLog,
  onAddTransaccion
}: InventoryManagementProps) {
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  
  // Purchase form states
  const [selectedInsumoId, setSelectedInsumoId] = useState<string>(insumos[0]?.id || 'NEW');
  const [newInsumoNombre, setNewInsumoNombre] = useState('');
  const [newInsumoUnidad, setNewInsumoUnidad] = useState('Lts');
  const [newInsumoStockMinimo, setNewInsumoStockMinimo] = useState('5');
  const [purchaseQuantity, setPurchaseQuantity] = useState('5');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [purchaseSupplier, setPurchaseSupplier] = useState('Detailers Mayorista');
  const [purchasePaymentMethod, setPurchasePaymentMethod] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
  
  const [supplierDebts, setSupplierDebts] = useState<any[]>([
    { id: 's1', supplierName: 'Detailers Mayorista', totalDebt: 12500 },
    { id: 's2', supplierName: 'Toxic Shine Oficial', totalDebt: 0 },
    { id: 's3', supplierName: 'Químicos Córdoba', totalDebt: 45000 }
  ]);

  const [selectedSupplierForPayment, setSelectedSupplierForPayment] = useState('Detailers Mayorista');
  const [supplierPaymentAmount, setSupplierPaymentAmount] = useState('');
  const [registerInCashBook, setRegisterInCashBook] = useState(true);

  const handlePaySupplierDebtSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(supplierPaymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    const supplierObj = supplierDebts.find(s => s.supplierName === selectedSupplierForPayment);
    if (!supplierObj) return;

    if (amount > supplierObj.totalDebt) {
      alert(`El pago ingresado ($${amount}) supera la deuda actual con este proveedor ($${supplierObj.totalDebt}).`);
      return;
    }

    setSupplierDebts(prev => prev.map(s => s.supplierName === selectedSupplierForPayment 
      ? { ...s, totalDebt: Math.max(0, s.totalDebt - amount), lastPaymentDate: new Date().toISOString() } 
      : s
    ));

    if (onAddTransaccion) {
      const newTx: Transaccion = {
        id: `tx_supp_${Date.now()}`,
        tipo: 'EGRESO',
        monto: amount,
        concepto: `Pago Cuenta Corriente Proveedor: ${selectedSupplierForPayment}`,
        origen: 'MANUAL',
        fecha: new Date().toISOString()
      };
      onAddTransaccion(newTx);
    }

    onAddLog(`💸 [PROVEEDORES] Registrado pago de $${amount} a ${selectedSupplierForPayment}. Deuda restante: $${supplierObj.totalDebt - amount}.`);
    setSupplierPaymentAmount('');
    alert(`Pago de $${amount} registrado con éxito para ${selectedSupplierForPayment}.`);
  };

  // Manual adjustment modal states
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState('1');
  const [adjustmentType, setAdjustmentType] = useState<'MAS' | 'MENOS'>('MAS');

  // Local movement logs state
  const [movements, setMovements] = useState<StockMovement[]>([
    {
      id: 'm1',
      insumoNombre: 'Shampoo pH Neutro Concentrado',
      tipo: 'ENTRADA',
      cantidad: 10,
      unidad: 'Lts',
      concepto: 'Compra de stock a distribuidor',
      proveedor: 'Detailers Mayorista',
      fecha: new Date(Date.now() - 3600000 * 2).toISOString()
    },
    {
      id: 'm2',
      insumoNombre: 'Cera Rápida de Carnauba líquida',
      tipo: 'SALIDA',
      cantidad: 0.5,
      unidad: 'Lts',
      concepto: 'Consumo automático - Turno #t3',
      fecha: new Date(Date.now() - 3600000 * 4).toISOString()
    },
    {
      id: 'm3',
      insumoNombre: 'Compuesto Pulidor de Corte Medio',
      tipo: 'AJUSTE',
      cantidad: 2,
      unidad: 'Unidades',
      concepto: 'Ajuste manual de stock por auditoría',
      fecha: new Date(Date.now() - 3600000 * 24).toISOString()
    }
  ]);

  // Derived statistics
  const totalItems = insumos.length;
  const totalStockValue = insumos.reduce((acc, item) => acc + (item.stockActual * item.precioCosto), 0);
  const criticalItems = insumos.filter(item => item.stockActual <= item.stockMinimo).length;
  const outOfStockItems = insumos.filter(item => item.stockActual === 0).length;

  // Filtered insumos list
  const filteredInsumos = insumos.filter(item => 
    item.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handlers
  const handlePurchaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(purchaseQuantity);
    const cost = purchaseCost ? Number(purchaseCost) : 0;
    if (isNaN(qty) || qty <= 0) return;

    let targetInsumoName = '';
    let updatedInsumos = [...insumos];

    if (selectedInsumoId === 'NEW') {
      if (!newInsumoNombre.trim()) {
        alert('Por favor ingresa el nombre del nuevo insumo.');
        return;
      }
      // Create new Insumo
      const newId = `i_${Date.now()}`;
      const newInsumo: Insumo = {
        id: newId,
        nombre: newInsumoNombre,
        stockActual: qty,
        stockMinimo: Number(newInsumoStockMinimo) || 2,
        unidad: newInsumoUnidad,
        precioCosto: cost
      };
      updatedInsumos.push(newInsumo);
      targetInsumoName = newInsumo.nombre;
      onAddLog(`📦 [INVENTARIO] Creado nuevo insumo: "${newInsumo.nombre}" con stock inicial de ${qty} ${newInsumo.unidad}.`);
    } else {
      // Add stock to existing Insumo
      updatedInsumos = insumos.map(item => {
        if (item.id === selectedInsumoId) {
          targetInsumoName = item.nombre;
          const updatedCost = cost > 0 ? cost : item.precioCosto;
          return {
            ...item,
            stockActual: item.stockActual + qty,
            precioCosto: updatedCost
          };
        }
        return item;
      });
      onAddLog(`📦 [INVENTARIO] Abastecimiento de ${qty} unidades de "${targetInsumoName}".`);
    }

    onUpdateInsumos(updatedInsumos);

    const totalCost = qty * (cost || updatedInsumos.find(i => i.nombre === targetInsumoName)?.precioCosto || 0);

    if (purchasePaymentMethod === 'CREDITO') {
      setSupplierDebts(prev => {
        const exists = prev.some(s => s.supplierName.toLowerCase() === purchaseSupplier.toLowerCase());
        if (exists) {
          return prev.map(s => s.supplierName.toLowerCase() === purchaseSupplier.toLowerCase() 
            ? { ...s, totalDebt: s.totalDebt + totalCost } 
            : s
          );
        } else {
          return [...prev, { id: `s_${Date.now()}`, supplierName: purchaseSupplier, totalDebt: totalCost }];
        }
      });
      onAddLog(`💸 [CREDITO] Compra a cuenta corriente de "${targetInsumoName}": Agregados $${totalCost} a la deuda con ${purchaseSupplier}.`);
    } else {
      if (registerInCashBook && onAddTransaccion && totalCost > 0) {
        const newTx: Transaccion = {
          id: `tx_inv_${Date.now()}`,
          tipo: 'EGRESO',
          monto: totalCost,
          concepto: `Compra Insumo: ${targetInsumoName} (${qty} x $${cost || 'Costo Base'}) - Prov: ${purchaseSupplier}`,
          origen: 'MANUAL',
          fecha: new Date().toISOString()
        };
        onAddTransaccion(newTx);
        onAddLog(`💸 [CAJA] Registrado egreso automático por $${totalCost} por compra de insumos.`);
      }
    }

    // Add to local movements log
    const newMovement: StockMovement = {
      id: `mov_${Date.now()}`,
      insumoNombre: targetInsumoName,
      tipo: 'ENTRADA',
      cantidad: qty,
      unidad: selectedInsumoId === 'NEW' ? newInsumoUnidad : insumos.find(i => i.id === selectedInsumoId)?.unidad || 'U',
      concepto: 'Compra de stock a proveedor',
      proveedor: purchaseSupplier,
      fecha: new Date().toISOString()
    };
    setMovements(prev => [newMovement, ...prev]);

    // Reset Form
    setNewInsumoNombre('');
    setPurchaseQuantity('5');
    setPurchaseCost('');
    alert('Compra confirmada y stock actualizado.');
  };

  const handleManualAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInsumo) return;

    const amt = Number(adjustmentAmount);
    if (isNaN(amt) || amt <= 0) return;

    const diff = adjustmentType === 'MAS' ? amt : -amt;
    const nextStock = Math.max(0, editingInsumo.stockActual + diff);

    const updated = insumos.map(item => {
      if (item.id === editingInsumo.id) {
        return { ...item, stockActual: nextStock };
      }
      return item;
    });

    onUpdateInsumos(updated);
    onAddLog(`⚙️ [INVENTARIO] Ajuste de stock manual para "${editingInsumo.nombre}": ${diff > 0 ? '+' : ''}${diff}. Stock actual: ${nextStock}.`);

    // Add movement
    const newMovement: StockMovement = {
      id: `mov_${Date.now()}`,
      insumoNombre: editingInsumo.nombre,
      tipo: 'AJUSTE',
      cantidad: amt,
      unidad: editingInsumo.unidad,
      concepto: `Ajuste manual (${adjustmentType === 'MAS' ? 'Incremento' : 'Reducción'})`,
      fecha: new Date().toISOString()
    };
    setMovements(prev => [newMovement, ...prev]);
    setEditingInsumo(null);
  };

  // Generate PDF Purchase Order to send to supplier
  const generatePurchaseOrder = (supplierName: string) => {
    const lowStockItems = insumos.filter(i => i.stockActual <= i.stockMinimo);
    if (lowStockItems.length === 0) {
      alert("No hay insumos con stock crítico para generar una orden de compra.");
      return;
    }

    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(30, 41, 59); // Dark slate
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('ORDEN DE COMPRA SUGERIDA', 15, 18);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Reabastecimiento Automático de Stock Crítico', 15, 26);
    doc.text(`Fecha Emisión: ${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR')}`, 15, 33);

    // Supplier & Buyer Info Box
    doc.setDrawColor(229, 231, 235);
    doc.setFillColor(249, 250, 251);
    doc.rect(15, 48, 180, 28, 'FD');
    
    doc.setTextColor(55, 65, 81);
    doc.setFont('helvetica', 'bold');
    doc.text('PROVEEDOR DESTINATARIO:', 20, 55);
    doc.text('COMPRADOR / SOLICITANTE:', 20, 63);
    doc.text('DETALLE:', 20, 71);

    doc.setFont('helvetica', 'normal');
    doc.text(supplierName.toUpperCase(), 75, 55);
    doc.text('ALBELO DETAIL - SISTEMA DE INVENTARIO', 75, 63);
    doc.text(`Reposición de ${lowStockItems.length} insumos en nivel crítico`, 75, 71);

    // Table rows: code, item name, current stock, suggested order, unit cost, total cost
    let grandTotal = 0;
    const tableRows = lowStockItems.map((item, idx) => {
      const suggestedQty = Math.max(1, (item.stockMinimo * 2) - item.stockActual);
      const totalCost = suggestedQty * item.precioCosto;
      grandTotal += totalCost;
      
      return [
        `INS-${100 + idx}`,
        item.nombre,
        `${item.stockActual} ${item.unidad}`,
        `${item.stockMinimo} ${item.unidad}`,
        `${suggestedQty} ${item.unidad}`,
        `$${item.precioCosto.toLocaleString('es-AR')}`,
        `$${totalCost.toLocaleString('es-AR')}`
      ];
    });

    autoTable(doc, {
      startY: 84,
      head: [['Código', 'Producto / Detalle', 'Stock Act.', 'Stock Mín.', 'Sugerido a Pedir', 'Costo Unit.', 'Subtotal Est.']],
      body: tableRows,
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 50 },
        2: { cellWidth: 20 },
        3: { cellWidth: 20 },
        4: { cellWidth: 25 },
        5: { cellWidth: 25 },
        6: { cellWidth: 25 }
      }
    });

    // Total Cost Highlight
    const finalY = (doc as any).lastAutoTable.finalY + 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`VALOR TOTAL ESTIMADO DE LA COMPRA:`, 85, finalY);
    
    doc.setTextColor(16, 185, 129); // Emerald color
    doc.setFontSize(12);
    doc.text(`$${grandTotal.toLocaleString('es-AR')} ARS`, 160, finalY);

    // Disclaimer
    const discY = finalY + 15;
    doc.setDrawColor(200, 200, 200);
    doc.line(15, discY, 195, discY);
    
    doc.setFontSize(7.5);
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'normal');
    doc.text('Nota: Esta orden de compra fue generada automáticamente por el control semafórico de stock crítico.', 15, discY + 5);
    doc.text('El costo total estimado es indicativo y está sujeto a cambios por parte del distribuidor.', 15, discY + 9);

    // Signatures
    const sigY = discY + 28;
    doc.line(70, sigY, 140, sigY);
    doc.text('Firma Encargado de Compras', 105, sigY + 4, { align: 'center' });

    doc.save(`OrdenCompra_${supplierName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`);
    onAddLog(`📦 [COMPRAS] Generada orden de compra sugerida en PDF para ${supplierName} (${lowStockItems.length} ítems)`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in min-w-0">
      
      {/* COLUMN 1: Stock List & Analytics */}
      <div className="lg:col-span-2 space-y-6 min-w-0">
        
        {/* KPI Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-panel p-4 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Catálogo Insumos</span>
            <div className="flex justify-between items-baseline">
              <span className="text-xl font-bold text-white font-display">{totalItems}</span>
              <span className="text-[9px] text-slate-500 font-bold font-mono">Ítems</span>
            </div>
            <div className="w-full bg-white/[0.05] h-1 rounded-full overflow-hidden mt-2">
              <div className="bg-[#00d2ff] h-full" style={{ width: '100%' }} />
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Valor de Activos</span>
            <div className="flex justify-between items-baseline">
              <span className="text-xl font-bold text-white font-display">${totalStockValue.toLocaleString('es-AR')}</span>
              <span className="text-[9px] text-emerald-400 font-bold font-mono">ARS</span>
            </div>
            <div className="w-full bg-white/[0.05] h-1 rounded-full overflow-hidden mt-2">
              <div className="bg-emerald-500 h-full" style={{ width: '100%' }} />
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Stock Crítico</span>
            <div className="flex justify-between items-baseline">
              <span className={`text-xl font-bold font-display ${criticalItems > 0 ? 'text-amber-400' : 'text-white'}`}>{criticalItems}</span>
              <span className="text-[9px] text-amber-400 font-bold font-mono">Alertas</span>
            </div>
            <div className="w-full bg-white/[0.05] h-1 rounded-full overflow-hidden mt-2">
              <div className={`h-full ${criticalItems > 0 ? 'bg-amber-500' : 'bg-slate-500'}`} style={{ width: `${(criticalItems / (totalItems || 1)) * 100}%` }} />
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Sin Stock (Quiebre)</span>
            <div className="flex justify-between items-baseline">
              <span className={`text-xl font-bold font-display ${outOfStockItems > 0 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{outOfStockItems}</span>
              <span className="text-[9px] text-red-500 font-bold font-mono">Agotado</span>
            </div>
            <div className="w-full bg-white/[0.05] h-1 rounded-full overflow-hidden mt-2">
              <div className={`h-full ${outOfStockItems > 0 ? 'bg-red-500' : 'bg-slate-500'}`} style={{ width: `${(outOfStockItems / (totalItems || 1)) * 100}%` }} />
            </div>
          </div>
        </div>

        {/* Catalog Table Card */}
        <div className="glass-panel p-5 rounded-xl space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pb-2 border-b border-white/[0.06]">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 font-display">
              <Layers className="w-4 h-4 text-brand-primary" />
              Inventario de Insumos & Productos
            </h3>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar insumo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white/[0.02] border border-white/[0.08] focus:border-brand-primary/50 text-xs text-white rounded-lg pl-8 pr-3 py-1.5 w-full sm:w-48 focus:outline-none"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/[0.06] text-slate-400 uppercase text-[9px] tracking-wider">
                  <th className="py-2.5 font-bold">Código</th>
                  <th className="py-2.5 font-bold">Detalle del Producto</th>
                  <th className="py-2.5 font-bold text-center">Mínimo</th>
                  <th className="py-2.5 font-bold text-center">Stock Actual</th>
                  <th className="py-2.5 font-bold text-right">Costo Unit.</th>
                  <th className="py-2.5 font-bold text-right">Valor Total</th>
                  <th className="py-2.5 font-bold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredInsumos.map((item, index) => {
                  const isCritical = item.stockActual <= item.stockMinimo;
                  const isAgotado = item.stockActual === 0;
                  const itemValue = item.stockActual * item.precioCosto;

                  return (
                    <tr key={item.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="py-3 font-mono text-[10px] text-slate-500">INS-{10 + index}</td>
                      <td className="py-3 pr-2">
                        <div className="font-bold text-slate-200">{item.nombre}</div>
                        <div className="text-[10px] text-slate-500">Medida: {item.unidad}</div>
                      </td>
                      <td className="py-3 text-center font-mono font-bold text-slate-400">
                        {item.stockMinimo} {item.unidad}
                      </td>
                      <td className="py-3 text-center">
                        <div className="flex flex-col items-center gap-1 min-w-[90px]">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold text-[9px] ${
                            isAgotado 
                              ? 'bg-red-500/10 text-red-500 border border-red-500/20 shadow-[0_0_8px_rgba(239,68,68,0.08)]'
                              : isCritical
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_8px_rgba(245,158,11,0.08)]'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.08)]'
                          }`}>
                            {item.stockActual} {item.unidad}
                            {isAgotado && ' (Agotado)'}
                          </span>
                          
                          {/* Mini visual semaphoric level bar */}
                          <div className="w-16 h-1 bg-white/[0.04] rounded-full overflow-hidden border border-white/[0.04]">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                isAgotado 
                                  ? 'bg-red-500' 
                                  : isCritical
                                  ? 'bg-amber-500' 
                                  : 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                              }`} 
                              style={{ width: `${Math.min((item.stockActual / (item.stockMinimo * 2 || 1)) * 100, 100)}%` }} 
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-right font-mono text-slate-300">
                        ${item.precioCosto.toLocaleString('es-AR')}
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-slate-200">
                        ${itemValue.toLocaleString('es-AR')}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setEditingInsumo(item);
                              setAdjustmentType('MAS');
                              setAdjustmentAmount('1');
                            }}
                            className="p-1 rounded bg-brand-primary/10 hover:bg-brand-primary/20 border border-brand-primary/20 text-brand-primary transition cursor-pointer"
                            title="Sumar Stock"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingInsumo(item);
                              setAdjustmentType('MENOS');
                              setAdjustmentAmount('1');
                            }}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 border border-white/[0.06] text-slate-300 transition cursor-pointer"
                            title="Restar Stock"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* COLUMN 2: Supplier Orders & Stock Movements */}
      <div className="space-y-6 min-w-0">
        
        {/* Manual Stock Adjuster Panel (Contextual) */}
        {editingInsumo && (
          <div className="glass-panel p-5 rounded-xl border border-brand-primary/30 shadow-[0_0_20px_rgba(220,38,38,0.1)] space-y-4 animate-slide-in">
            <div className="flex justify-between items-center pb-2 border-b border-white/[0.06]">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-display flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 text-brand-primary" />
                Ajuste Rápido: {editingInsumo.nombre}
              </h3>
              <button 
                onClick={() => setEditingInsumo(null)}
                className="text-slate-500 hover:text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualAdjustment} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustmentType('MAS')}
                  className={`py-2 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-1 ${
                    adjustmentType === 'MAS'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-white/[0.01] text-slate-400 border-white/[0.06]'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" /> Incrementar (+)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentType('MENOS')}
                  className={`py-2 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-1 ${
                    adjustmentType === 'MENOS'
                      ? 'bg-red-500/10 text-red-500 border-red-500/30'
                      : 'bg-white/[0.01] text-slate-400 border-white/[0.06]'
                  }`}
                >
                  <Minus className="w-3.5 h-3.5" /> Reducir (-)
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[9px] text-slate-400 uppercase tracking-wider">Cantidad ({editingInsumo.unidad})</label>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  required
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(e.target.value)}
                  className="w-full bg-white/[0.02] border border-white/[0.08] focus:border-brand-primary/40 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-brand-primary hover:bg-brand-hover text-white font-bold py-2 rounded-lg text-xs uppercase tracking-wider transition cursor-pointer"
              >
                Confirmar Ajuste
              </button>
            </form>
          </div>
        )}

        {/* Purchase & Supplier order card */}
        <div className="glass-panel p-5 rounded-xl space-y-4">
          <div className="flex items-center gap-1.5 pb-2 border-b border-white/[0.06]">
            <ShoppingCart className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-display">Registrar Compra / Entrada</h3>
          </div>

          <form onSubmit={handlePurchaseSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <label className="block text-[9px] text-slate-400 uppercase tracking-wider">Producto / Insumo</label>
              <select
                value={selectedInsumoId}
                onChange={(e) => setSelectedInsumoId(e.target.value)}
                className="w-full bg-white/[0.02] border border-white/[0.08] text-xs text-white rounded-lg px-2 py-1.5 focus:outline-none"
              >
                {insumos.map(i => (
                  <option key={i.id} value={i.id} className="bg-slate-900">
                    {i.nombre} (Stock: {i.stockActual} {i.unidad})
                  </option>
                ))}
                <option value="NEW" className="bg-slate-900 font-bold text-[#00d2ff]">+ AGREGAR NUEVO PRODUCTO...</option>
              </select>
            </div>

            {/* Conditional fields for new items */}
            {selectedInsumoId === 'NEW' && (
              <div className="space-y-3 p-3 bg-white/[0.01] border border-[#00d2ff]/20 rounded-xl animate-fade-in">
                <span className="text-[9px] text-[#00d2ff] font-bold uppercase tracking-wider block">Detalles del Nuevo Producto</span>
                
                <div className="space-y-1.5">
                  <label className="block text-[8px] text-slate-500 uppercase tracking-wider">Nombre del Producto</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Paños de Microfibra de Secado 60x90"
                    value={newInsumoNombre}
                    onChange={(e) => setNewInsumoNombre(e.target.value)}
                    className="w-full bg-white/[0.02] border border-white/[0.08] rounded px-2 py-1 text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="block text-[8px] text-slate-500 uppercase tracking-wider">Unidad</label>
                    <select
                      value={newInsumoUnidad}
                      onChange={(e) => setNewInsumoUnidad(e.target.value)}
                      className="w-full bg-slate-900 border border-white/[0.08] rounded px-1.5 py-1 text-xs text-white"
                    >
                      <option value="Lts">Litros (Lts)</option>
                      <option value="Unidades">Unidades (U)</option>
                      <option value="Mililitros">Mililitros (ml)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[8px] text-slate-500 uppercase tracking-wider">Stock Mínimo</label>
                    <input
                      type="number"
                      required
                      value={newInsumoStockMinimo}
                      onChange={(e) => setNewInsumoStockMinimo(e.target.value)}
                      className="w-full bg-white/[0.02] border border-white/[0.08] rounded px-2 py-1 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="block text-[8px] text-slate-400 uppercase tracking-wider">Cantidad a Ingresar</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={purchaseQuantity}
                  onChange={(e) => setPurchaseQuantity(e.target.value)}
                  className="w-full bg-white/[0.02] border border-white/[0.08] rounded px-2 py-1 text-xs text-white font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[8px] text-slate-400 uppercase tracking-wider">Costo Unitario ($)</label>
                <input
                  type="number"
                  placeholder={selectedInsumoId !== 'NEW' ? `${insumos.find(i => i.id === selectedInsumoId)?.precioCosto || ''}` : 'Ej. 500'}
                  value={purchaseCost}
                  onChange={(e) => setPurchaseCost(e.target.value)}
                  className="w-full bg-white/[0.02] border border-white/[0.08] rounded px-2 py-1 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[8px] text-slate-400 uppercase tracking-wider">Proveedor</label>
              <input
                type="text"
                required
                value={purchaseSupplier}
                onChange={(e) => setPurchaseSupplier(e.target.value)}
                className="w-full bg-white/[0.02] border border-white/[0.08] rounded px-2 py-1 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[8px] text-slate-400 uppercase tracking-wider font-bold">Método de Pago</label>
                <select
                  value={purchasePaymentMethod}
                  onChange={(e) => setPurchasePaymentMethod(e.target.value as any)}
                  className="w-full bg-slate-900 border border-white/[0.08] rounded px-2 py-1 text-xs text-white"
                >
                  <option value="CONTADO" className="bg-slate-950">Contado (Efectivo)</option>
                  <option value="CREDITO" className="bg-slate-950">A Crédito (Cta. Cte.)</option>
                </select>
              </div>

              {purchasePaymentMethod === 'CONTADO' && (
                <div className="flex items-center gap-2 pt-4">
                  <input
                    type="checkbox"
                    id="check-register-cash"
                    checked={registerInCashBook}
                    onChange={(e) => setRegisterInCashBook(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 rounded bg-slate-900 border-white/[0.08]"
                  />
                  <label htmlFor="check-register-cash" className="text-[9px] text-slate-400 cursor-pointer font-bold select-none leading-tight">
                    Registrar egreso en Caja Diaria
                  </label>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 font-bold py-2 rounded-lg text-xs transition duration-200 uppercase tracking-wider cursor-pointer"
            >
              Confirmar Entrada de Stock
            </button>
          </form>
        </div>

        {/* Orden de Compra Inteligente */}
        <div className="glass-panel p-5 rounded-xl space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-white/[0.06]">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-display flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4 text-brand-primary" />
              Orden de Compra Sugerida (PO)
            </h3>
            <span className="text-[8px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded uppercase font-bold">
              Stock Crítico
            </span>
          </div>

          {insumos.filter(i => i.stockActual <= i.stockMinimo).length === 0 ? (
            <div className="bg-emerald-950/10 text-emerald-400 border border-emerald-900/20 p-3 rounded-lg text-center text-[10px] leading-relaxed">
              ✔️ Todos los productos disponen de stock óptimo. No se requiere generar órdenes de compra en este momento.
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[10px] text-slate-400 leading-normal">
                El sistema detectó <b>{insumos.filter(i => i.stockActual <= i.stockMinimo).length} insumos</b> por debajo del stock mínimo. Se sugiere reabastecerlos.
              </p>

              <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                {insumos.filter(i => i.stockActual <= i.stockMinimo).map(i => {
                  const suggested = Math.max(1, (i.stockMinimo * 2) - i.stockActual);
                  return (
                    <div key={i.id} className="flex justify-between items-center bg-white/[0.01] border border-white/[0.04] p-2 rounded text-[10px]">
                      <div>
                        <span className="font-bold text-slate-200">{i.nombre}</span>
                        <span className="text-slate-500 block text-[9px]">Stock actual: {i.stockActual} {i.unidad} (Mín: {i.stockMinimo})</span>
                      </div>
                      <span className="font-mono text-brand-primary font-bold">Pedir: {suggested} {i.unidad}</span>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-1.5">
                <label className="block text-[8px] text-slate-400 uppercase tracking-wider font-bold">Proveedor Destinatario</label>
                <select
                  id="po-supplier-select"
                  className="w-full bg-slate-900 border border-white/[0.08] rounded px-2 py-1 text-xs text-white"
                >
                  <option value="Toxic Shine Oficial">Toxic Shine Oficial</option>
                  <option value="Detailers Mayorista">Detailers Mayorista</option>
                  <option value="Químicos Córdoba">Químicos Córdoba</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  const select = document.getElementById('po-supplier-select') as HTMLSelectElement;
                  const supplier = select ? select.value : 'Toxic Shine Oficial';
                  generatePurchaseOrder(supplier);
                }}
                className="w-full bg-brand-primary hover:bg-brand-hover text-white font-extrabold py-2 rounded-lg text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_2px_10px_rgba(220,38,38,0.2)]"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar Orden de Compra PDF
              </button>
            </div>
          )}
        </div>

        {/* Cuentas Corrientes con Proveedores (Credit Accounts payable) */}
        <div className="glass-panel p-5 rounded-xl space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-white/[0.06]">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-display flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-[#00d2ff]" />
              Saldos Pendientes con Proveedores
            </h3>
          </div>

          {/* Debt list */}
          <div className="space-y-2">
            {supplierDebts.map((s) => (
              <div key={s.id} className="flex justify-between items-center bg-white/[0.01] border border-white/[0.04] p-2.5 rounded-lg text-xs">
                <div>
                  <span className="font-bold text-slate-200 block">{s.supplierName}</span>
                  {s.lastPaymentDate && (
                    <span className="text-[9px] text-slate-500 font-mono">Último Pago: {new Date(s.lastPaymentDate).toLocaleDateString('es-AR')}</span>
                  )}
                </div>
                
                <div className="text-right">
                  <span className={`font-mono font-bold block ${s.totalDebt > 0 ? 'text-amber-400' : 'text-emerald-500'}`}>
                    ${s.totalDebt.toLocaleString('es-AR')}
                  </span>
                  <span className="text-[9px] text-slate-500 block">{s.totalDebt > 0 ? 'A pagar' : 'Al día'}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Pay Off Debt Form */}
          {supplierDebts.some(s => s.totalDebt > 0) ? (
            <form onSubmit={handlePaySupplierDebtSubmit} className="bg-white/[0.02] p-3 rounded-lg border border-white/[0.08] space-y-3">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Registrar Entrega de Dinero</span>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[8px] text-slate-500 uppercase mb-1">Proveedor</label>
                  <select
                    value={selectedSupplierForPayment}
                    onChange={(e) => setSelectedSupplierForPayment(e.target.value)}
                    className="w-full bg-slate-900 border border-white/[0.08] rounded px-2 py-1 text-xs text-white"
                  >
                    {supplierDebts.filter(s => s.totalDebt > 0).map(s => (
                      <option key={s.id} value={s.supplierName} className="bg-slate-950">{s.supplierName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[8px] text-slate-500 uppercase mb-1">Monto a Asentar</label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      value={supplierPaymentAmount}
                      onChange={(e) => setSupplierPaymentAmount(e.target.value)}
                      placeholder="Monto"
                      className="w-full bg-slate-900 border border-white/[0.08] rounded pl-5 pr-2 py-1 text-xs text-white font-mono"
                    />
                    <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none text-slate-500 text-xs">$</div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#00d2ff]/20 hover:bg-[#00d2ff]/30 text-[#00d2ff] border border-[#00d2ff]/30 font-bold py-1.5 rounded text-[10px] uppercase tracking-wider transition duration-200 cursor-pointer"
              >
                Registrar Pago de Deuda
              </button>
            </form>
          ) : (
            <div className="bg-emerald-950/10 text-emerald-400 border border-emerald-900/20 p-2.5 rounded-lg text-center text-[10px]">
              ✔️ Todas las cuentas corrientes con proveedores se encuentran saldadas y al día.
            </div>
          )}
        </div>

        {/* Recent stock movements log */}
        <div className="glass-panel p-5 rounded-xl space-y-3.5">
          <div className="flex justify-between items-center pb-2 border-b border-white/[0.06]">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Movimientos de Stock Recientes</span>
            <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono font-bold">{movements.length}</span>
          </div>

          <div className="space-y-2.5 max-h-[190px] overflow-y-auto pr-1 scrollbar-thin">
            {movements.map(log => {
              const isEntrada = log.tipo === 'ENTRADA';
              const isSalida = log.tipo === 'SALIDA';

              return (
                <div key={log.id} className="bg-white/[0.01] border border-white/[0.04] p-2.5 rounded-lg space-y-1 text-xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-slate-200">{log.insumoNombre}</span>
                    </div>
                    
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                      isEntrada
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : isSalida
                        ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-emerald-500/20'
                    }`}>
                      {isEntrada ? <ArrowUpRight className="w-2.5 h-2.5" /> : isSalida ? <ArrowDownRight className="w-2.5 h-2.5" /> : <RefreshCw className="w-2.5 h-2.5" />}
                      {log.tipo}
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-normal">
                    {log.concepto} • <span className="font-mono font-bold">{log.cantidad > 0 ? `+${log.cantidad}` : log.cantidad} {log.unidad}</span>
                  </p>
                  
                  {log.proveedor && (
                    <div className="text-[9px] text-slate-500">
                      Proveedor: <span className="text-slate-400 font-semibold">{log.proveedor}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-1 text-[9px] text-slate-500 font-mono">
                    <span>{new Date(log.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span>{new Date(log.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
