import React, { useState, useEffect } from 'react';
import { Users, DollarSign, Calculator, FileText, Check, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { Turno, Transaccion } from '../types';
import { generateCommissionReceiptPDF } from '../utils/ticketGenerator';

interface EmployeeCommissionsProps {
  turnos: Turno[];
  transacciones: Transaccion[];
  cajaAbierta: boolean;
  onAddTransaccion: (monto: number, concepto: string, tipo: 'INGRESO' | 'EGRESO', origen: 'MANUAL' | 'VENTA_POS') => void;
  onAddLog: (message: string) => void;
}

export default function EmployeeCommissions({
  turnos,
  transacciones,
  cajaAbierta,
  onAddTransaccion,
  onAddLog
}: EmployeeCommissionsProps) {
  // Configurable commission rates per operator
  const [rates, setRates] = useState<{ [key: string]: number }>(() => {
    try {
      const saved = localStorage.getItem('albelo_commission_rates');
      return saved ? JSON.parse(saved) : {
        'Mateo': 30,
        'Enzo': 30,
        'Santiago': 35,
        'Julián': 30,
        'Sofía': 30
      };
    } catch {
      return {
        'Mateo': 30,
        'Enzo': 30,
        'Santiago': 35,
        'Julián': 30,
        'Sofía': 30
      };
    }
  });

  // Persist rates to localStorage
  useEffect(() => {
    localStorage.setItem('albelo_commission_rates', JSON.stringify(rates));
  }, [rates]);

  // Set of settled (paid) turno IDs
  const [settledIds, setSettledIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('albelo_settled_turno_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Persist settled IDs
  useEffect(() => {
    localStorage.setItem('albelo_settled_turno_ids', JSON.stringify(settledIds));
  }, [settledIds]);

  // UI state
  const [editingOperator, setEditingOperator] = useState<string | null>(null);
  const [editRateValue, setEditRateValue] = useState('');
  const [expandedOperator, setExpandedOperator] = useState<string | null>(null);
  const [payoutMessage, setPayoutMessage] = useState('');

  // Extract operators
  const operators = Object.keys(rates);

  // Group turnos per operator
  const getOperatorJobs = (name: string) => {
    return turnos.filter(
      (t) => t.lavadorAsignado === name && 
      (t.estado === 'COMPLETADO' || t.estado === 'ENTREGADO') &&
      !settledIds.includes(t.id)
    );
  };

  // Perform payout / settlement
  const handlePayout = (name: string) => {
    if (!cajaAbierta) {
      alert('La caja debe estar abierta para registrar un egreso de comisiones.');
      return;
    }

    const jobs = getOperatorJobs(name);
    if (jobs.length === 0) return;

    const rate = rates[name] || 30;
    const totalEarnings = jobs.reduce((sum, j) => sum + j.precio, 0);
    const totalPayout = Math.round((totalEarnings * rate) / 100);

    if (totalPayout <= 0) return;

    // 1. Add Cash Ledger transaction
    onAddTransaccion(
      totalPayout,
      `Liquidación comisiones operario: ${name} (${jobs.length} trabajos)`,
      'EGRESO',
      'MANUAL'
    );

    // 2. Mark turnos as settled
    const jobIds = jobs.map((j) => j.id);
    const newSettled = [...settledIds, ...jobIds];
    setSettledIds(newSettled);

    // 3. Export PDF Receipt
    generateCommissionReceiptPDF({
      employeeName: name,
      commissionRate: rate,
      totalEarnings,
      totalPayout,
      jobs: jobs.map((j) => ({
        id: j.id,
        fecha: j.fechaCreacion,
        patente: j.vehiculoPatente,
        modelo: j.vehiculoModelo,
        servicio: j.servicioNombre,
        precio: j.precio,
        comision: Math.round((j.precio * rate) / 100)
      }))
    });

    onAddLog(`💰 [CAJA] Liquidación de comisiones realizada para ${name}. Egreso de $${totalPayout.toLocaleString('es-AR')} registrado.`);
    setPayoutMessage(`¡Liquidación de ${name} procesada con éxito! Recibo PDF descargado.`);
    
    setTimeout(() => setPayoutMessage(''), 6000);
  };

  // Calculate global metrics
  const totalUnpaidCommissions = operators.reduce((sum, name) => {
    const jobs = getOperatorJobs(name);
    const rate = rates[name] || 30;
    return sum + jobs.reduce((s, j) => s + (j.precio * rate) / 100, 0);
  }, 0);

  return (
    <div className="space-y-6 animate-fade-in text-slate-200">
      
      {/* Overview Card */}
      <div className="glass-panel p-5 rounded-2xl border border-red-500/20 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-red-600/[0.02] rounded-full blur-2xl pointer-events-none" />
        
        <div className="space-y-1">
          <span className="text-[10px] text-red-500 uppercase tracking-widest block font-bold">Fuerza de Trabajo</span>
          <h2 className="text-xl font-black text-white uppercase tracking-tight font-display">Comisiones de Operarios</h2>
          <p className="text-xs text-slate-400 max-w-md">
            Administrá la tasa de comisión para cada lavador y liquidá los saldos acumulados registrando egresos en la caja diaria.
          </p>
        </div>

        <div className="bg-white/[0.02] border border-white/[0.08] px-4 py-3 rounded-xl flex items-center gap-3 shrink-0">
          <span className="p-2 bg-amber-500/10 rounded-lg text-amber-400 border border-amber-500/20">
            <DollarSign className="w-5 h-5" />
          </span>
          <div>
            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">Pendiente de Liquidar</span>
            <span className="text-lg font-black text-amber-400 font-mono">${Math.round(totalUnpaidCommissions).toLocaleString('es-AR')}</span>
          </div>
        </div>
      </div>

      {payoutMessage && (
        <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4" />
          <span className="font-bold">{payoutMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Main List */}
        <div className="lg:col-span-8 space-y-4">
          
          {operators.map((name) => {
            const jobs = getOperatorJobs(name);
            const rate = rates[name] || 30;
            const totalEarned = jobs.reduce((sum, j) => sum + j.precio, 0);
            const unpaidCommission = Math.round((totalEarned * rate) / 100);
            const isExpanded = expandedOperator === name;

            return (
              <div key={name} className="glass-panel rounded-2xl border border-white/[0.06] overflow-hidden hover:border-white/[0.1] transition-all">
                
                {/* Operator Header Card */}
                <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white/[0.01]">
                  
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-white uppercase text-sm font-mono shrink-0">
                      {name.slice(0, 2)}
                    </span>
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-tight">{name}</h3>
                      <span className="text-[10px] text-slate-400 font-mono">{jobs.length} trabajos pendientes de pago</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-wrap w-full sm:w-auto justify-between sm:justify-end">
                    
                    {/* Rate Editor */}
                    <div className="flex items-center gap-2">
                      {editingOperator === name ? (
                        <div className="flex items-center gap-1 bg-black/40 px-1 py-0.5 rounded border border-white/10">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={editRateValue}
                            onChange={(e) => setEditRateValue(e.target.value)}
                            className="w-12 bg-transparent text-center text-xs font-mono font-bold outline-none text-white"
                          />
                          <span className="text-[10px] text-slate-500 font-bold">%</span>
                          <button
                            onClick={() => {
                              const newRate = Number(editRateValue);
                              if (!isNaN(newRate) && newRate >= 0 && newRate <= 100) {
                                setRates(prev => ({ ...prev, [name]: newRate }));
                              }
                              setEditingOperator(null);
                            }}
                            className="p-1 text-emerald-400 hover:text-white"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-300 font-mono">{rate}% Comisión</span>
                          <button
                            onClick={() => {
                              setEditingOperator(name);
                              setEditRateValue(String(rate));
                            }}
                            className="text-[9px] text-red-500 hover:text-white uppercase font-bold"
                          >
                            Editar
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Unpaid commission */}
                    <div className="text-right font-mono">
                      <span className="text-[9px] text-slate-500 uppercase font-bold block">Acumulado</span>
                      <span className="text-sm font-black text-white">${unpaidCommission.toLocaleString('es-AR')}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setExpandedOperator(isExpanded ? null : name)}
                        className="p-1.5 rounded-lg bg-white/[0.02] hover:bg-white/5 border border-white/[0.06] text-slate-400 hover:text-white transition cursor-pointer"
                        title="Ver trabajos"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      <button
                        onClick={() => handlePayout(name)}
                        disabled={unpaidCommission === 0 || !cajaAbierta}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/[0.02] text-slate-950 disabled:text-slate-500 font-extrabold text-[10px] uppercase tracking-wider transition cursor-pointer disabled:cursor-not-allowed shadow-[0_0_15px_rgba(16,185,129,0.1)] disabled:shadow-none"
                      >
                        Pagar Liquidación
                      </button>
                    </div>

                  </div>

                </div>

                {/* Collapsible turnos list */}
                {isExpanded && (
                  <div className="border-t border-white/[0.06] bg-black/20 p-4 space-y-2 animate-fade-in">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-mono">Listado de Servicios</h4>
                    {jobs.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No hay trabajos registrados pendientes de liquidar.</p>
                    ) : (
                      <div className="divide-y divide-white/[0.04] overflow-x-auto">
                        <table className="w-full text-left text-xs min-w-[500px]">
                          <thead>
                            <tr className="text-slate-500 font-mono text-[9px] uppercase tracking-wider">
                              <th className="pb-2">Fecha</th>
                              <th className="pb-2">Patente</th>
                              <th className="pb-2">Vehículo</th>
                              <th className="pb-2">Servicio</th>
                              <th className="pb-2 text-right">Precio</th>
                              <th className="pb-2 text-right">Comisión ({rate}%)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.04]">
                            {jobs.map((job) => (
                              <tr key={job.id} className="text-slate-300 font-mono">
                                <td className="py-2.5">{new Date(job.fechaCreacion).toLocaleDateString('es-AR')}</td>
                                <td className="py-2.5 font-bold text-white uppercase">{job.vehiculoPatente}</td>
                                <td className="py-2.5 max-w-[120px] truncate">{job.vehiculoModelo}</td>
                                <td className="py-2.5 truncate max-w-[140px]">{job.servicioNombre}</td>
                                <td className="py-2.5 text-right text-slate-400">${job.precio.toLocaleString('es-AR')}</td>
                                <td className="py-2.5 text-right text-emerald-400 font-bold">${Math.round((job.precio * rate) / 100).toLocaleString('es-AR')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

              </div>
            );
          })}

        </div>

        {/* Right Sidebar: Quick Rules & Guidelines */}
        <div className="lg:col-span-4 space-y-6">
          
          <div className="glass-panel p-5 rounded-2xl border border-white/[0.06] space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-white/[0.08]">
              <Calculator className="w-4 h-4 text-red-500" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-display">Políticas de Sueldos</h3>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-slate-400">
              <p>
                • El sistema escanea y agrupa automáticamente los servicios completados para cada operario que aún no han sido cobrados o asentados.
              </p>
              <p>
                • Al presionar <b>Pagar Liquidación</b>, el monto total se descuenta del cajón físico (Caja Diaria) bajo el concepto de egreso de haberes y se descarga automáticamente el recibo de comisiones oficial.
              </p>
              <div className="p-3 bg-red-950/20 border border-red-900/20 text-red-400 rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="text-[10px] leading-relaxed">
                  <b>Nota de Caja Cerrada:</b> Si la caja diaria está cerrada o pendiente de apertura, los botones de liquidación de sueldos permanecerán bloqueados temporalmente para evitar desvíos contables.
                </p>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
