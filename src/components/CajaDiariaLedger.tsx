import React, { useState } from 'react';
import { 
  DollarSign, ArrowUpRight, ArrowDownRight, Package, AlertTriangle, 
  Plus, Check, Lock, ShieldAlert, ShoppingBag, RefreshCw, Download, X 
} from 'lucide-react';
import { Insumo, Transaccion, Rol } from '../types';
import { generateTicketPDF } from '../utils/ticketGenerator';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const [auditResult, setAuditResult] = useState<{ teorico: number; fisico: number; desvio: number; fecha: string } | null>(null);

  // Filter states for transaction ledger history
  const [txSearch, setTxSearch] = useState('');
  const [txFilter, setTxFilter] = useState<'TODAS' | 'INGRESOS' | 'EGRESOS' | 'VENTAS_POS'>('TODAS');

  // Check if current role has access
  const isBlockedByRBAC = role === 'LAVADOR' || role === 'OPERARIO';

  const handleExportCSV = () => {
    if (transacciones.length === 0) {
      alert('No hay transacciones registradas para exportar.');
      return;
    }

    let csvContent = '\uFEFF'; // UTF-8 BOM
    csvContent += 'ID;Fecha;Tipo;Monto;Concepto;Origen\n';

    transacciones.forEach((tx, idx) => {
      const formattedDate = new Date(tx.fecha).toLocaleString('es-AR');
      const cleanConcept = tx.concepto.replace(/;/g, ',');
      csvContent += `TX-${1000 + idx};${formattedDate};${tx.tipo};${tx.monto};${cleanConcept};${tx.origen}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Caja_Diaria_AlbeloDetail_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadActaPDF = (teorico: number, fisico: number, desvio: number, fechaStr: string) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a5'
    });

    // Top banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 148, 15, 'F');
    doc.setFillColor(220, 38, 38); // Rosso Albelo
    doc.rect(0, 0, 148, 2, 'F');

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('ALBELO DETAIL - ACTA DE ARQUEO Y CIERRE', 10, 10);

    // Date/Time
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Fecha del Cierre: ${new Date(fechaStr).toLocaleDateString('es-AR')}`, 10, 22);
    doc.text(`Hora del Cierre: ${new Date(fechaStr).toLocaleTimeString('es-AR')}`, 10, 26);

    // Audit summary card
    doc.setFillColor(248, 250, 252);
    doc.rect(10, 30, 128, 22, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(10, 30, 128, 22, 'S');

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('RESULTADO DE AUDITORÍA CONTABLE', 15, 36);
    
    doc.setFontSize(8);
    if (desvio === 0) {
      doc.setTextColor(22, 163, 74); // Green
      doc.text('ESTADO: CONFORME - SIN DESVÍOS', 15, 42);
    } else {
      doc.setTextColor(220, 38, 38); // Red
      doc.text(`ESTADO: DIVERGENCIA DETECTADA (${desvio < 0 ? 'FALTANTE' : 'SOBRANTE'})`, 15, 42);
    }
    
    doc.setTextColor(100, 116, 139);
    doc.text(`Supervisor Auditor: Administrador General`, 15, 47);

    // Details table
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('Cómputo de Valores:', 10, 60);
    doc.line(10, 62, 138, 62);

    doc.setFont('helvetica', 'normal');
    doc.text('Base de Apertura de Caja:', 15, 68);
    doc.text(`$${montoApertura.toLocaleString('es-AR')}`, 100, 68, { align: 'right' });

    doc.text('Ingresos de Caja Registrados:', 15, 74);
    doc.text(`$${totalIngresos.toLocaleString('es-AR')}`, 100, 74, { align: 'right' });

    doc.text('Egresos de Caja Registrados:', 15, 80);
    doc.text(`-$${totalEgresos.toLocaleString('es-AR')}`, 100, 80, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.text('SALDO TEÓRICO ESPERADO:', 15, 86);
    doc.text(`$${teorico.toLocaleString('es-AR')}`, 100, 86, { align: 'right' });

    doc.setTextColor(29, 78, 216); // blue
    doc.text('EFECTIVO FÍSICO DECLARADO:', 15, 92);
    doc.text(`$${fisico.toLocaleString('es-AR')}`, 100, 92, { align: 'right' });

    doc.line(10, 96, 138, 96);
    
    if (desvio === 0) {
      doc.setTextColor(22, 163, 74);
    } else {
      doc.setTextColor(220, 38, 38);
    }
    doc.setFontSize(9);
    doc.text(`DESVÍO / DIFERENCIA:`, 15, 102);
    doc.text(`${desvio >= 0 ? '+' : ''}$${desvio.toLocaleString('es-AR')}`, 100, 102, { align: 'right' });

    // Signature lines
    const signY = 125;
    doc.setDrawColor(203, 213, 225);
    doc.line(15, signY, 55, signY);
    doc.line(85, signY, 125, signY);

    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('Firma Responsable Turno', 35, signY + 4, { align: 'center' });
    doc.text('Firma Dirección / Auditor', 105, signY + 4, { align: 'center' });

    doc.save(`Acta_Arqueo_Caja_${new Date(fechaStr).toISOString().split('T')[0]}.pdf`);
  };

  const handleExportPDF = () => {
    if (transacciones.length === 0) {
      alert('No hay transacciones registradas para exportar.');
      return;
    }

    const doc = new jsPDF();

    // Header strip
    doc.setFillColor(220, 38, 38);
    doc.rect(0, 0, 210, 8, 'F');

    // Title & Brand
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('ALBELO DETAIL', 15, 22);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('ESTÉTICA VEHICULAR • POLARIZADOS • DETAILING', 15, 28);
    doc.text(`Fecha del Reporte: ${new Date().toLocaleDateString('es-AR')}`, 150, 22);
    doc.text(`Hora: ${new Date().toLocaleTimeString('es-AR')}`, 150, 28);

    doc.setDrawColor(226, 232, 240);
    doc.line(15, 33, 195, 33);

    // Summary Card Box
    doc.setFillColor(248, 250, 252);
    doc.rect(15, 38, 180, 28, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(15, 38, 180, 28, 'S');

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('BALANCE GENERAL DE CAJA DIARIA', 20, 44);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Base de Apertura: $${montoApertura.toLocaleString('es-AR')}`, 20, 52);
    doc.text(`Total Ingresos:  $${totalIngresos.toLocaleString('es-AR')}`, 20, 59);

    doc.text(`Total Egresos:   $${totalEgresos.toLocaleString('es-AR')}`, 110, 52);
    
    const balanceNeto = totalIngresos - totalEgresos;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(balanceNeto >= 0 ? 22 : 220, balanceNeto >= 0 ? 163 : 38, balanceNeto >= 0 ? 74 : 38);
    doc.text(`Saldo Neto Teórico: $${(montoApertura + totalIngresos - totalEgresos).toLocaleString('es-AR')}`, 110, 59);

    // Transactions Table
    const tableBody = transacciones.map((tx, idx) => [
      `TX-${1000 + idx}`,
      new Date(tx.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      tx.concepto,
      tx.origen,
      tx.tipo === 'INGRESO' ? 'INGRESO' : 'EGRESO',
      `$${tx.monto.toLocaleString('es-AR')}`
    ]);

    autoTable(doc, {
      startY: 72,
      head: [['ID', 'Hora', 'Concepto / Detalle', 'Origen', 'Tipo', 'Monto']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9
      },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 20 },
        2: { cellWidth: 80 },
        3: { cellWidth: 25 },
        4: { cellWidth: 20, halign: 'center' },
        5: { cellWidth: 25, halign: 'right' }
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 3
      },
      didParseCell: (data) => {
        if (data.column.index === 4 && data.cell.section === 'body') {
          if (data.cell.text[0] === 'INGRESO') {
            data.cell.styles.textColor = [22, 163, 74];
          } else {
            data.cell.styles.textColor = [220, 38, 38];
          }
        }
      }
    });

    doc.save(`Reporte_Caja_AlbeloDetail_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const totalIngresos = transacciones
    .filter((t) => t.tipo === 'INGRESO')
    .reduce((sum, t) => sum + t.monto, 0);

  const totalEgresos = transacciones
    .filter((t) => t.tipo === 'EGRESO')
    .reduce((sum, t) => sum + t.monto, 0);

  const saldoActual = totalIngresos - totalEgresos;
  const currentPosInsumo = insumos.find((i) => i.id === posSelectedInsumo);

  // Filtered transactions computed array
  const filteredTransacciones = transacciones.filter((tx) => {
    const matchesSearch = tx.concepto.toLowerCase().includes(txSearch.toLowerCase());
    if (txFilter === 'INGRESOS') {
      return matchesSearch && tx.tipo === 'INGRESO';
    }
    if (txFilter === 'EGRESOS') {
      return matchesSearch && tx.tipo === 'EGRESO';
    }
    if (txFilter === 'VENTAS_POS') {
      return matchesSearch && tx.origen === 'VENTA_POS';
    }
    return matchesSearch;
  });

  const getEgresosByCategory = () => {
    const categories = {
      Quimicos: 0,
      Insumos: 0,
      Servicios: 0,
      Sueldos: 0,
      Otros: 0
    };
    transacciones
      .filter(t => t.tipo === 'EGRESO')
      .forEach(t => {
        const conc = t.concepto.toLowerCase();
        if (conc.includes('quim') || conc.includes('quím')) {
          categories.Quimicos += t.monto;
        } else if (conc.includes('insum') || conc.includes('trapo') || conc.includes('microfibra') || conc.includes('shampoo')) {
          categories.Insumos += t.monto;
        } else if (conc.includes('luz') || conc.includes('agua') || conc.includes('alquiler') || conc.includes('servici')) {
          categories.Servicios += t.monto;
        } else if (conc.includes('sueldo') || conc.includes('comisi') || conc.includes('comisió') || conc.includes('operar')) {
          categories.Sueldos += t.monto;
        } else {
          categories.Otros += t.monto;
        }
      });
    return categories;
  };
  const egresosByCat = getEgresosByCategory();

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
      const teorico = montoApertura + totalIngresos - totalEgresos;
      const desvio = val - teorico;
      const closingDate = new Date().toISOString();

      setAuditResult({
        teorico,
        fisico: val,
        desvio,
        fecha: closingDate
      });

      onCloseCaja(val);
      setIsCastingClose(false);
      setClosingInput('');

      // Trigger automatic A5 PDF download
      handleDownloadActaPDF(teorico, val, desvio, closingDate);
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
                      className="w-full bg-black/30 border border-white/[0.1] focus:border-brand-primary/60 focus:outline-none rounded-lg pl-8 pr-3 py-2 text-xs text-white font-mono transition-all"
                    />
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-500 text-xs">$</div>
                  </div>
                  <button
                    id="btn-open-caja"
                    type="submit"
                    className="bg-brand-primary/20 hover:bg-brand-primary/30 text-brand-primary border border-brand-primary/30 font-bold py-2 px-4 rounded-lg text-xs transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Abrir Caja
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                {/* Financial overview cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white/[0.02] p-3 rounded-lg border border-white/[0.06] shadow-sm hover:scale-[1.01] transition-transform">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider font-mono">Ingresos</span>
                    <span className="text-base font-bold text-emerald-400 block font-mono mt-0.5">${totalIngresos.toLocaleString('es-AR')}</span>
                  </div>
                  <div className="bg-white/[0.02] p-3 rounded-lg border border-white/[0.06] shadow-sm hover:scale-[1.01] transition-transform">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider font-mono">Egresos</span>
                    <span className="text-base font-bold text-red-400 block font-mono mt-0.5">${totalEgresos.toLocaleString('es-AR')}</span>
                  </div>
                  <div className="bg-white/[0.02] p-3 rounded-lg border border-white/[0.06] relative overflow-hidden shadow-sm hover:scale-[1.01] transition-transform">
                    <div className="absolute top-0 right-0 w-8 h-8 bg-[#00d2ff]/5 rounded-full blur-sm" />
                    <span className="text-[10px] text-[#00d2ff] block uppercase font-bold tracking-wider font-mono">Saldo</span>
                    <span className="text-base font-bold text-white block font-mono mt-0.5">${saldoActual.toLocaleString('es-AR')}</span>
                  </div>
                </div>

                {/* Comparative Cashflow Bar */}
                {(totalIngresos > 0 || totalEgresos > 0) && (
                  <div className="bg-white/[0.02] border border-white/[0.06] p-3.5 rounded-lg space-y-2 animate-fade-in">
                    <div className="flex justify-between text-[9px] uppercase tracking-wider font-extrabold font-mono">
                      <span className="text-emerald-400">Ingresos ({Math.round(totalIngresos / (totalIngresos + totalEgresos || 1) * 100)}%)</span>
                      <span className="text-red-400">Egresos ({Math.round(totalEgresos / (totalIngresos + totalEgresos || 1) * 100)}%)</span>
                    </div>
                    <div className="w-full h-2.5 bg-white/[0.04] rounded-full overflow-hidden border border-white/[0.04] flex shadow-inner">
                      {totalIngresos > 0 && (
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.3)] transition-all duration-500 ease-out" 
                          style={{ width: `${(totalIngresos / (totalIngresos + totalEgresos || 1)) * 100}%` }} 
                        />
                      )}
                      {totalEgresos > 0 && (
                        <div 
                          className="h-full bg-gradient-to-r from-red-500 to-amber-500 shadow-[0_0_8px_rgba(239,68,68,0.3)] transition-all duration-500 ease-out" 
                          style={{ width: `${(totalEgresos / (totalIngresos + totalEgresos || 1)) * 100}%` }} 
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Category breakdown for expenses */}
                {totalEgresos > 0 && (
                  <div className="bg-white/[0.01] border border-white/[0.04] p-3 rounded-lg space-y-2.5 animate-fade-in">
                    <span className="text-[9px] text-slate-400 uppercase tracking-widest font-black block border-b border-white/[0.04] pb-1 font-mono">
                      Distribución de Gastos (Egresos)
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 pt-1">
                      {Object.entries(egresosByCat).map(([cat, val]) => {
                        if (val === 0) return null;
                        const pct = Math.round((val / totalEgresos) * 100);
                        return (
                          <div key={cat} className="space-y-1">
                            <div className="flex justify-between items-baseline text-[8.5px] font-mono font-bold">
                              <span className="text-slate-400">{cat}</span>
                              <span className="text-slate-200">${val.toLocaleString('es-AR')}</span>
                            </div>
                            <div className="w-full h-1.5 bg-white/[0.04] rounded-full overflow-hidden border border-white/[0.04]">
                              <div 
                                className="h-full bg-amber-500 rounded-full" 
                                style={{ width: `${pct}%` }} 
                              />
                            </div>
                            <span className="text-[7.5px] text-slate-500 font-mono font-bold block">{pct}% del total</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

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
                      ⚠️ <b>Arqueo Ciego Activo:</b> Por favor, realiza el conteo físico del dinero en la caja y asienta el total a continuación. El sistema auditará cualquier desvío.
                    </p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          id="input-caja-closing"
                          type="number"
                          required
                          value={closingInput}
                          onChange={(e) => setClosingInput(e.target.value)}
                          placeholder="Monto real contado"
                          className="w-full bg-black/30 border border-white/[0.1] focus:border-brand-primary/60 focus:outline-none rounded-lg pl-7 pr-3 py-1.5 text-xs text-white font-mono transition-all"
                        />
                        <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none text-slate-500 text-xs">$</div>
                      </div>
                      <button
                        id="btn-confirm-close-caja"
                        type="submit"
                        className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-bold py-1.5 px-3 rounded-lg text-xs transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
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
                        setClosingInput('');
                      }}
                      className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-bold py-1 px-2.5 rounded text-[10px] uppercase tracking-wider transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
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
            <div className="flex justify-between items-center pb-1.5 border-b border-white/[0.08]">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Historial del Arqueo</h4>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="flex items-center gap-1 bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] px-2 py-1 rounded text-[9px] text-slate-300 font-bold uppercase transition cursor-pointer"
                  title="Exportar Libro a Excel/CSV"
                >
                  <Download className="w-3 h-3 text-slate-400" />
                  Excel/CSV
                </button>
                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="flex items-center gap-1 bg-brand-primary/10 hover:bg-brand-primary/20 border border-brand-primary/30 px-2 py-1 rounded text-[9px] text-brand-primary font-bold uppercase tracking-wider transition cursor-pointer"
                  title="Descargar Reporte de Caja en PDF"
                >
                  <Download className="w-3 h-3 text-brand-primary" />
                  PDF
                </button>
              </div>
            </div>

            {/* Search & Filter Chips */}
            <div className="flex flex-col gap-2.5">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar por concepto (ej. Silic, Sueldo, Turno)..."
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  className="w-full bg-white/[0.02] border border-white/[0.08] focus:border-brand-primary/50 text-xs text-white rounded-lg pl-8 pr-3 py-1.5 focus:outline-none"
                />
                <DollarSign className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                {txSearch && (
                  <button 
                    onClick={() => setTxSearch('')} 
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs font-mono"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1">
                {(['TODAS', 'INGRESOS', 'EGRESOS', 'VENTAS_POS'] as const).map((filterOpt) => {
                  const label = 
                    filterOpt === 'TODAS' ? 'Todas' :
                    filterOpt === 'INGRESOS' ? 'Ingresos' :
                    filterOpt === 'EGRESOS' ? 'Egresos' : 'Ventas POS';
                  
                  const isActive = txFilter === filterOpt;
                  return (
                    <button
                      key={filterOpt}
                      type="button"
                      onClick={() => setTxFilter(filterOpt)}
                      className={`text-[9px] font-bold px-2 py-0.5 rounded transition cursor-pointer border ${
                        isActive
                          ? 'bg-brand-primary/15 text-brand-primary border-brand-primary/30 shadow-[0_0_10px_rgba(220,38,38,0.1)]'
                          : 'bg-white/[0.02] text-slate-400 border-white/[0.06] hover:bg-white/[0.04]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
              {filteredTransacciones.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">No se encontraron movimientos registrados hoy.</div>
              ) : (
                [...filteredTransacciones].reverse().map((tx) => (
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

            {/* Quick manual cash transaction entry with categories */}
            {cajaAbierta && (
              <div className="bg-white/[0.01] p-3.5 rounded-lg border border-white/[0.06] space-y-3 pt-3 mt-4">
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">Gestor de Egresos y Caja</span>
                
                {/* Category Preset buttons for quick filling */}
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {[
                    { label: '🧪 Químicos', prefix: '[Químicos] Compra de ' },
                    { label: '🧽 Insumos', prefix: '[Insumos] Limpieza ' },
                    { label: '⚡ Servicios', prefix: '[Servicios] Pago de ' },
                    { label: '💼 Sueldos', prefix: '[Sueldos] Comisión de ' }
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setManualConcepto(preset.prefix);
                        setManualTipo('EGRESO');
                      }}
                      className="px-2 py-1 bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] rounded text-[9px] text-slate-300 font-bold uppercase transition cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleManualTxSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-5">
                    <input
                      id="input-manual-concept"
                      type="text"
                      required
                      value={manualConcepto}
                      onChange={(e) => setManualConcepto(e.target.value)}
                      placeholder="Concepto (ej: Compra trapos)"
                      className="w-full bg-black/30 border border-white/[0.1] focus:border-brand-primary/60 focus:outline-none rounded px-2.5 py-1.5 text-xs text-white"
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
                        className="w-full bg-black/30 border border-white/[0.1] focus:border-brand-primary/60 focus:outline-none rounded pl-5 pr-1.5 py-1.5 text-xs text-white font-mono"
                      />
                      <span className="absolute left-2 inset-y-0 flex items-center text-slate-500 text-xs">$</span>
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <select
                      id="select-manual-type"
                      value={manualTipo}
                      onChange={(e) => setManualTipo(e.target.value as 'INGRESO' | 'EGRESO')}
                      className="w-full bg-[#0c0f12] border border-white/[0.1] focus:border-brand-primary/60 focus:outline-none rounded px-1 py-1.5 text-xs text-white"
                    >
                      <option value="EGRESO" className="bg-[#0c0f12]">Egreso</option>
                      <option value="INGRESO" className="bg-[#0c0f12]">Ingreso</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      id="btn-add-manual-tx"
                      type="submit"
                      className="w-full bg-brand-primary/20 hover:bg-brand-primary/30 text-brand-primary border border-brand-primary/30 py-1.5 rounded text-xs font-bold transition cursor-pointer"
                    >
                      Cargar
                    </button>
                  </div>
                </form>
              </div>
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
                    className="w-full bg-black/40 border border-white/[0.08] focus:border-brand-primary/60 focus:outline-none rounded-lg px-2.5 py-2 text-xs text-white"
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
                      className="w-full bg-black/40 border border-white/[0.08] focus:border-brand-primary/60 focus:outline-none rounded-lg px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>

                  <div className="col-span-2 flex items-end">
                    <button
                      id="btn-pos-sell"
                      type="submit"
                      className="w-full bg-brand-primary/10 hover:bg-brand-primary/20 border border-brand-primary/30 text-brand-primary hover:text-white font-black uppercase tracking-widest py-2 rounded-lg text-[10px] transition-all duration-200 cursor-pointer shadow-md hover:scale-[1.01] active:scale-[0.99]"
                    >
                      Registrar Venta
                    </button>
                  </div>
                </div>

                {/* Live Ticket Mockup Preview */}
                <div className="bg-amber-50/5 text-amber-200/90 font-mono text-[10px] p-4 rounded-lg border border-white/[0.06] space-y-2 relative overflow-hidden shadow-inner bg-black/50">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-brand-primary/5 rounded-full blur-md" />
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
                    <div className="flex justify-between border-t border-white/[0.08] pt-1.5 text-xs font-bold text-brand-primary">
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

      {/* AUDIT CLOSURE RESULTS MODAL */}
      {auditResult && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex justify-center items-center p-4">
          <div 
            className={`glass-panel p-6 rounded-2xl w-full max-w-md space-y-5 text-center relative border transition-all duration-500 ${
              auditResult.desvio === 0 
                ? 'border-emerald-500/40 shadow-[0_0_40px_rgba(16,185,129,0.18)]' 
                : 'border-red-500/40 shadow-[0_0_40px_rgba(239,68,68,0.22)] animate-pulse'
            }`}
          >
            <button 
              type="button"
              onClick={() => setAuditResult(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white bg-black/60 hover:bg-black/95 p-1.5 rounded-full border border-white/[0.08] z-20 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* Header Icon Indicator */}
            <div className="flex justify-center pt-2">
              {auditResult.desvio === 0 ? (
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)] animate-bounce">
                  <Check className="w-8 h-8" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.25)]">
                  <ShieldAlert className="w-8 h-8 text-red-500 animate-pulse" />
                </div>
              )}
            </div>
            
            <div>
              <span className={`text-[10px] uppercase tracking-widest font-mono font-bold ${
                auditResult.desvio === 0 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {auditResult.desvio === 0 ? 'AUDITORÍA CONFORME' : 'DIVERGENCIA DE CAJA'}
              </span>
              <h3 className="text-base font-extrabold text-white mt-1 font-display">
                {auditResult.desvio === 0 ? '¡Arqueo Cuadrado Exitosamente!' : 'Diferencia en Arqueo Detectada'}
              </h3>
            </div>

            <div className="bg-white/[0.01] border border-white/[0.06] p-4 rounded-xl space-y-2.5 text-xs text-left font-sans shadow-inner">
              <div className="flex justify-between">
                <span className="text-slate-400 font-mono">Total Esperado (Sistema):</span>
                <span className="text-white font-mono font-bold">${auditResult.teorico.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-mono">Efectivo Real Declarado:</span>
                <span className="text-[#00d2ff] font-mono font-bold">${auditResult.fisico.toLocaleString('es-AR')}</span>
              </div>
              <div className="pt-2 border-t border-white/[0.06] flex justify-between items-center">
                <span className="text-slate-300 font-bold font-mono">Desvío / Diferencia:</span>
                <span className={`font-mono font-bold text-base ${
                  auditResult.desvio === 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {auditResult.desvio >= 0 ? '+' : ''}${auditResult.desvio.toLocaleString('es-AR')}
                </span>
              </div>
            </div>

            <div className={`p-3 rounded-lg text-xs leading-relaxed border text-center ${
              auditResult.desvio === 0 
                ? 'bg-emerald-950/20 text-emerald-300 border-emerald-900/30' 
                : 'bg-red-950/20 text-red-300 border-red-900/30'
            }`}>
              {auditResult.desvio === 0 
                ? '✔️ El efectivo físico declarado coincide perfectamente con el libro contable de ingresos y egresos.' 
                : `⚠️ Alerta de Auditoría: Se detectó una diferencia de $${Math.abs(auditResult.desvio).toLocaleString('es-AR')} en el arqueo físico. El desvío ha sido asentado en el sistema.`
              }
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => handleDownloadActaPDF(auditResult.teorico, auditResult.fisico, auditResult.desvio, auditResult.fecha)}
                className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                Descargar Acta de Arqueo PDF
              </button>
              <button
                type="button"
                onClick={() => setAuditResult(null)}
                className="w-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-400 hover:text-white font-bold py-2 rounded-xl text-[10px] uppercase transition cursor-pointer"
              >
                Cerrar Reporte
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
