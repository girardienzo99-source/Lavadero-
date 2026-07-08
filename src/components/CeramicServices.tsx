import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Shield, Car, User, Clock, DollarSign, Plus, Trash2, 
  Settings, Calculator, Check, ArrowRight, HelpCircle
} from 'lucide-react';
import { Cliente, Turno, TipoServicio } from '../types';
import { LAVADORES_ACTIVOS } from '../data/initialData';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface CeramicServicesProps {
  clientes: Cliente[];
  turnos: Turno[];
  onAddTurno: (newTurno: Turno) => void;
  onAddLog: (message: string) => void;
}

interface NivelTratamiento {
  id: string;
  nombre: string;
  durabilidad: string; // ej: "1 Año", "3 Años", "5 Años"
  descripcion: string;
  precioBase: number;
  duracionEstimada: string;
}

interface FactorTamano {
  tipo: 'AUTO' | 'SUV' | 'CAMIONETA';
  nombre: string;
  multiplicador: number;
  adicional: number;
}

export default function CeramicServices({
  clientes,
  turnos,
  onAddTurno,
  onAddLog
}: CeramicServicesProps) {
  // Local active tab within Ceramic Module
  const [activeSubTab, setActiveSubTab] = useState<'calculator' | 'config' | 'simulator'>('calculator');

  // Initial Treatment Levels state (stored in local state, seeded with pro values)
  const [niveles, setNiveles] = useState<NivelTratamiento[]>([
    {
      id: 'n1',
      nombre: 'Tratamiento Cerámico SiO2 Express',
      durabilidad: '1 Año',
      descripcion: 'Sellado de acople rápido con base de cuarzo SiO2. Otorga brillo extremo y repelencia hidrofóbica básica de fácil mantenimiento.',
      precioBase: 140000,
      duracionEstimada: '6 hs'
    },
    {
      id: 'n2',
      nombre: 'Tratamiento Cerámico Premium 9H Gyeon',
      durabilidad: '3 Años',
      descripcion: 'Corrección de laca en 2 pasos para eliminar micro-rayas y aplicación de sellador de dureza 9H real. Protección contra resina, rayos UV y sales.',
      precioBase: 240000,
      duracionEstimada: '12 hs'
    },
    {
      id: 'n3',
      nombre: 'Tratamiento de Grafeno / Cerámico Elite',
      durabilidad: '5 Años',
      descripcion: 'Nuestra protección máxima de calidad de exposición. Revestimiento infundido con óxido de grafeno para la máxima resistencia térmica, brillo mojado tridimensional y repelencia.',
      precioBase: 380000,
      duracionEstimada: '18 hs'
    }
  ]);

  // Vehicle Size multipliers & added pricing
  const [factores, setFactores] = useState<FactorTamano[]>([
    { tipo: 'AUTO', nombre: 'Auto / Hatchback / Sedan', multiplicador: 1.0, adicional: 0 },
    { tipo: 'SUV', nombre: 'SUV / Crossover / Monovolumen', multiplicador: 1.25, adicional: 25000 },
    { tipo: 'CAMIONETA', nombre: 'Camioneta / Pick-up / Utilitario Grande', multiplicador: 1.45, adicional: 50000 }
  ]);

  // Simulator States
  const [simColor, setSimColor] = useState<'red' | 'orange' | 'black' | 'cyan'>('red');
  const [simLevel, setSimLevel] = useState<'express' | 'premium' | 'elite'>('premium');
  const [simLightAngle, setSimLightAngle] = useState(50);
  const [isWaterTestActive, setIsWaterTestActive] = useState(false);

  // Form states for adding/editing Treatment Levels
  const [newNombre, setNewNombre] = useState('');
  const [newDurabilidad, setNewDurabilidad] = useState('3 Años');
  const [newDescripcion, setNewDescripcion] = useState('');
  const [newPrecioBase, setNewPrecioBase] = useState('');
  const [newDuracionEstimada, setNewDuracionEstimada] = useState('12 hs');

  // Form states for creating a custom Ceramic Turno
  const [selectedClienteId, setSelectedClienteId] = useState(clientes[0]?.id || '');
  const [selectedNivelId, setSelectedNivelId] = useState(niveles[1]?.id || niveles[0]?.id || '');
  const [selectedTamano, setSelectedTamano] = useState<'AUTO' | 'SUV' | 'CAMIONETA'>('AUTO');
  const [selectedDetallador, setSelectedDetallador] = useState(LAVADORES_ACTIVOS[1] || LAVADORES_ACTIVOS[0]);
  const [customPrecioCalc, setCustomPrecioCalc] = useState<number | null>(null);

  // Derive active selections
  const currentCliente = clientes.find((c) => c.id === selectedClienteId);
  const currentNivel = niveles.find((n) => n.id === selectedNivelId);
  const currentFactor = factores.find((f) => f.tipo === selectedTamano);

  // Auto-calculated pricing based on formula: (Precio Base * Multiplicador) + Adicional
  const calculatedPrice = currentNivel && currentFactor
    ? Math.round((currentNivel.precioBase * currentFactor.multiplicador) + currentFactor.adicional)
    : 0;

  // Use calculated price by default unless custom pricing is set
  const finalPriceToUse = customPrecioCalc !== null ? customPrecioCalc : calculatedPrice;

  // Trigger default selections on load
  useEffect(() => {
    if (clientes.length > 0 && !selectedClienteId) {
      setSelectedClienteId(clientes[0].id);
    }
  }, [clientes, selectedClienteId]);

  // Handle adding a new NivelTratamiento
  const handleAddNivel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNombre || !newPrecioBase) return;

    const newN: NivelTratamiento = {
      id: `n_${Date.now()}`,
      nombre: newNombre,
      durabilidad: newDurabilidad,
      descripcion: newDescripcion,
      precioBase: Number(newPrecioBase),
      duracionEstimada: newDuracionEstimada
    };

    setNiveles([...niveles, newN]);
    setSelectedNivelId(newN.id);
    setNewNombre('');
    setNewDescripcion('');
    setNewPrecioBase('');
    onAddLog(`⚙️ Configuración: Agregado nivel de tratamiento cerámico "${newN.nombre}" (${newN.durabilidad}) con precio base $${newN.precioBase.toLocaleString('es-AR')}`);
  };

  // Handle deleting a NivelTratamiento
  const handleDeleteNivel = (id: string) => {
    if (niveles.length <= 1) {
      alert('Debe conservar al menos un nivel de tratamiento activo en el sistema.');
      return;
    }
    const target = niveles.find(n => n.id === id);
    setNiveles(niveles.filter(n => n.id !== id));
    if (selectedNivelId === id) {
      const remaining = niveles.filter(n => n.id !== id);
      setSelectedNivelId(remaining[0].id);
    }
    if (target) {
      onAddLog(`⚙️ Configuración: Eliminado nivel de tratamiento cerámico "${target.nombre}".`);
    }
  };

  // Handle editing Factor multiplicadores/adicionales directly
  const handleUpdateFactor = (tipo: 'AUTO' | 'SUV' | 'CAMIONETA', key: 'multiplicador' | 'adicional', value: number) => {
    setFactores(factores.map(f => {
      if (f.tipo === tipo) {
        return { ...f, [key]: value };
      }
      return f;
    }));
  };

  // Create Ceramic Turno Action
  const handleScheduleCeramic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCliente || !currentNivel || !currentFactor) return;

    // Create the special Turno object
    const newT: Turno = {
      id: `t_${Date.now()}`,
      clienteId: currentCliente.id,
      clienteNombre: currentCliente.nombre,
      telefono: currentCliente.telefono,
      vehiculoPatente: currentCliente.vehiculoPatente,
      vehiculoModelo: `${currentCliente.vehiculoModelo} (${selectedTamano})`,
      tipo: 'ESTETICA',
      servicioNombre: `Tratamiento Cerámico [${currentNivel.durabilidad}] - ${currentNivel.nombre}`,
      lavadorAsignado: selectedDetallador,
      estado: 'PENDIENTE',
      precio: finalPriceToUse,
      fechaCreacion: new Date().toISOString(),
      isCeramic: true,
      ceramicNivel: currentNivel.durabilidad,
      tamanoVehiculo: selectedTamano
    };

    onAddTurno(newT);
    setCustomPrecioCalc(null);
    onAddLog(`💎 DETAILED AGENDADO: ${newT.clienteNombre} (${newT.vehiculoPatente}) para un ${newT.servicioNombre}. Detallador asignado: ${newT.lavadorAsignado}. Tamaño: ${selectedTamano}. Valor final: $${newT.precio.toLocaleString('es-AR')}.`);
    
    // Quick success scroll indicator or notification
    alert(`¡Tratamiento Cerámico agendado correctamente! Podrás hacerle seguimiento en la sección de Turnos (Tablero Kanban) con una etiqueta especial de servicio complejo.`);
  };

  // Generate Warranty Certificate PDF for detailing treatments
  const generateWarrantyCertificate = (t: Turno) => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const primaryColor = [220, 38, 38]; // Red brand primary

    // Background decoration (Premium Border)
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(1.5);
    doc.rect(5, 5, 287, 200); // outer border
    
    doc.setDrawColor(51, 65, 85);
    doc.setLineWidth(0.5);
    doc.rect(8, 8, 281, 194); // inner border

    // Background watermark/graphics
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 10, 210, 'F');
    doc.rect(287, 0, 10, 210, 'F');

    // Title Block
    doc.setTextColor(220, 38, 38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.text('CERTIFICADO DE GARANTÍA', 148, 30, { align: 'center' });
    
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('ESTÉTICA VEHICULAR PROFESIONAL & TRATAMIENTOS DE ALTA GAMA', 148, 37, { align: 'center' });

    // Certificate Seal divider line
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(1);
    doc.line(80, 44, 217, 44);

    // Body text
    doc.setTextColor(55, 65, 81);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Se certifica por el presente documento que el vehículo descrito a continuación ha sido tratado con', 148, 56, { align: 'center' });
    doc.text('nuestras técnicas de corrección de laca y protegido con un recubrimiento protector premium.', 148, 62, { align: 'center' });

    // Treatment Title (Highlight)
    doc.setTextColor(220, 38, 38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    const trat = t.servicioNombre.replace('Tratamiento Cerámico ', '');
    doc.text(trat.toUpperCase(), 148, 73, { align: 'center' });

    // Detail boxes layout
    const startY = 82;
    // Box 1: Owner & Vehicle
    doc.setFillColor(248, 250, 252);
    doc.rect(20, startY, 120, 48, 'F');
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.5);
    doc.rect(20, startY, 120, 48, 'D');

    doc.setTextColor(220, 38, 38);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL PROPIETARIO Y VEHÍCULO', 25, startY + 6);
    
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(10);
    doc.text(`Cliente: ${t.clienteNombre.toUpperCase()}`, 25, startY + 16);
    doc.text(`Vehículo: ${t.vehiculoModelo.toUpperCase()}`, 25, startY + 24);
    doc.text(`Patente / Placa: ${t.vehiculoPatente.toUpperCase()}`, 25, startY + 32);
    doc.text(`Técnico Aplicador: ${t.lavadorAsignado.toUpperCase()}`, 25, startY + 40);

    // Box 2: Warranty details
    doc.setFillColor(248, 250, 252);
    doc.rect(157, startY, 120, 48, 'F');
    doc.rect(157, startY, 120, 48, 'D');

    doc.setTextColor(220, 38, 38);
    doc.text('TÉRMINOS DE LA GARANTÍA', 162, startY + 6);
    
    doc.setTextColor(51, 65, 85);
    const fechaApli = new Date(t.fechaCreacion).toLocaleDateString('es-AR');
    const duracion = t.ceramicNivel || "3 Años";
    doc.text(`Fecha de Aplicación: ${fechaApli}`, 162, startY + 16);
    doc.text(`Duración Garantizada: ${duracion}`, 162, startY + 24);
    doc.text(`Medición de Laca Promedio: 120 micras (Seguro)`, 162, startY + 32);
    doc.text(`Mantenimientos Sugeridos: Semestral`, 162, startY + 40);

    // Recommendations section (Table-like or bullet points)
    const recY = 142;
    doc.setTextColor(220, 38, 38);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('INSTRUCCIONES CLAVE DE MANTENIMIENTO POST-TRATAMIENTO', 20, recY);

    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('1. Lavar el vehículo únicamente con shampoo de pH neutro (evitar desengrasantes agresivos o productos ácidos).', 20, recY + 6);
    doc.text('2. Utilizar siempre la técnica de los 2 baldes y manoplas de microfibra de alta calidad para prevenir micro-rayas.', 20, recY + 11);
    doc.text('3. No lavar el auto bajo el sol directo o con la chapa caliente. Secar con paños de microfibra ultra absorbentes sin frotar con fuerza.', 20, recY + 16);
    doc.text('4. Asistir a la inspección de garantía y recarga de sellado cerámico cada 6 meses en nuestro centro oficial.', 20, recY + 21);

    // Signature Area
    const sigY = 175;
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.5);
    doc.line(200, sigY, 270, sigY);
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('FIRMA CERTIFICADA', 235, sigY + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text('Centro de Detailing Oficial', 235, sigY + 8, { align: 'center' });

    // Digital ID
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.setFont('courier', 'normal');
    doc.text(`CERT-ID: DS-${t.id}-${t.vehiculoPatente.toLowerCase()}`, 20, 192);

    doc.save(`certificado_garantia_${t.vehiculoPatente.toLowerCase()}.pdf`);
    onAddLog(`📜 EMISIÓN: Se emitió Certificado de Garantía en PDF para el vehículo ${t.vehiculoPatente.toUpperCase()} (${t.vehiculoModelo})`);
  };

  return (
    <div className="space-y-6">
      
      {/* Tab Selector inside CeramicServices */}
      <div className="flex justify-between items-center bg-white/[0.02] p-2 rounded-xl border border-white/[0.08]">
        <div className="flex gap-1.5">
          <button
            onClick={() => setActiveSubTab('calculator')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 ${
              activeSubTab === 'calculator'
                ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30 shadow-[0_0_15px_rgba(255,255,255,0.05)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            Calculadora & Agendador
          </button>
          <button
            onClick={() => setActiveSubTab('config')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 ${
              activeSubTab === 'config'
                ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30 shadow-[0_0_15px_rgba(255,255,255,0.05)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Configurar Tarifas y Niveles
          </button>
          <button
            onClick={() => setActiveSubTab('simulator')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 ${
              activeSubTab === 'simulator'
                ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30 shadow-[0_0_15px_rgba(255,255,255,0.05)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Simulador de Brillo y Curado
          </button>
        </div>
        
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[10px] text-amber-400 font-mono font-bold uppercase">
          <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
          Estética Premium
        </div>
      </div>

      {/* Sub-Tab 1: Calculator & Turno Creator */}
      {activeSubTab === 'calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main Calculator Form */}
          <form onSubmit={handleScheduleCeramic} className="lg:col-span-8 glass-panel p-5 rounded-xl border border-white/[0.08] space-y-5">
            <div className="flex justify-between items-center pb-2 border-b border-white/[0.08]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-primary flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-brand-primary" />
                Cotización de Tratamiento Cerámico Complejo
              </h4>
              <span className="text-[9px] bg-brand-primary/15 text-brand-primary border border-brand-primary/30 px-1.5 py-0.5 rounded font-bold uppercase">ALBELO STUDIO</span>
            </div>

            {/* Selection inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Cliente & Vehiculo */}
              <div className="space-y-1.5">
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider font-bold">1. Seleccionar Cliente Registrado</label>
                <select
                  value={selectedClienteId}
                  onChange={(e) => setSelectedClienteId(e.target.value)}
                  className="w-full bg-[#030406] border border-white/[0.08] focus:border-red-500/50 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                >
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre} ({c.vehiculoPatente})</option>
                  ))}
                </select>
                
                {currentCliente && (
                  <div className="bg-white/[0.01] p-2.5 rounded-lg border border-white/[0.04] text-[10px] text-slate-400 flex justify-between items-center">
                    <span>Modelo: <b className="text-slate-200">{currentCliente.vehiculoModelo}</b></span>
                    <span>Patente: <b className="text-brand-primary uppercase font-mono">{currentCliente.vehiculoPatente}</b></span>
                  </div>
                )}
              </div>

              {/* Detallador / Operario especializado */}
              <div className="space-y-1.5">
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider font-bold">2. Detallador / Técnico Asignado</label>
                <select
                  value={selectedDetallador}
                  onChange={(e) => setSelectedDetallador(e.target.value)}
                  className="w-full bg-[#030406] border border-white/[0.08] focus:border-red-500/50 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                >
                  {LAVADORES_ACTIVOS.map((lav) => (
                    <option key={lav} value={lav}>{lav} (Técnico Detailing)</option>
                  ))}
                </select>
                <div className="text-[9px] text-slate-500 italic px-1">Este técnico liderará la corrección y curado térmico de laca.</div>
              </div>

            </div>

            <hr className="border-white/[0.06]" />

            {/* Treatment Level & Size Selector Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Select Level */}
              <div className="space-y-2">
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider font-bold">3. Nivel de Tratamiento (Garantía)</label>
                <div className="space-y-2">
                  {niveles.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        setSelectedNivelId(n.id);
                        setCustomPrecioCalc(null); // Reset custom price override
                      }}
                      className={`p-3 rounded-lg border cursor-pointer transition text-left relative ${
                        selectedNivelId === n.id
                          ? 'bg-amber-500/10 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.05)]'
                          : 'bg-white/[0.01] border-white/[0.06] hover:border-white/[0.1] hover:bg-white/[0.02]'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-white">{n.nombre}</span>
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 font-extrabold px-1.5 py-0.5 rounded uppercase">
                          {n.durabilidad}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">{n.descripcion}</p>
                      <div className="flex justify-between text-[9px] text-slate-500 mt-2 font-mono">
                        <span>Duración: <b>{n.duracionEstimada}</b></span>
                        <span>Base: <b>${n.precioBase.toLocaleString('es-AR')}</b></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Select Vehicle Size */}
              <div className="space-y-2">
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold">4. Tamaño del Vehículo (Multiplicadores)</label>
                <div className="grid grid-cols-3 gap-2.5">
                  {factores.map((f) => {
                    const isSelected = selectedTamano === f.tipo;
                    return (
                      <div
                        key={f.tipo}
                        onClick={() => {
                          setSelectedTamano(f.tipo);
                          setCustomPrecioCalc(null); // Reset custom price override
                        }}
                        className={`p-3.5 rounded-xl border text-center cursor-pointer transition flex flex-col items-center justify-between h-36 ${
                          isSelected
                            ? 'bg-brand-primary/10 border-brand-primary/30 shadow-[0_0_15px_rgba(255,255,255,0.05)]'
                            : 'bg-black/20 border-white/[0.06] hover:border-white/[0.1] hover:bg-black/30'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-brand-primary/20 text-brand-primary' : 'bg-white/[0.03] text-slate-500'}`}>
                          {f.tipo === 'AUTO' && <Car className="w-6 h-6" />}
                          {f.tipo === 'SUV' && (
                            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M2 13 C 2 13, 5 13, 6 12 L8 9 L15 9 L17 12 C 18 13, 22 13, 22 13 L22 16 L2 16 Z" strokeLinecap="round" strokeLinejoin="round" />
                              <circle cx="6.5" cy="17.5" r="2" />
                              <circle cx="17.5" cy="17.5" r="2" />
                            </svg>
                          )}
                          {f.tipo === 'CAMIONETA' && (
                            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M2 13 L12 13 L12 9 L16 9 L19 12 L22 12 L22 16 L2 16 Z" strokeLinecap="round" strokeLinejoin="round" />
                              <circle cx="6.5" cy="17.5" r="2" />
                              <circle cx="17.5" cy="17.5" r="2" />
                            </svg>
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-black uppercase tracking-wider block text-white">{f.tipo}</span>
                          <span className="text-[8px] text-slate-500 block">
                            {f.multiplicador}x {f.adicional > 0 ? `+$${f.adicional/1000}k` : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Helpful Note about formulas */}
                <div className="bg-white/[0.01] border border-white/[0.06] rounded-lg p-3 space-y-1.5 text-[10px] text-slate-400">
                  <div className="flex items-center gap-1.5 font-bold text-slate-300">
                    <HelpCircle className="w-3.5 h-3.5 text-brand-primary" />
                    <span>Fórmula de Cobro Detailing</span>
                  </div>
                  <p className="leading-relaxed">
                    El valor de los tratamientos de estética premium escala según la laca del vehículo. Se calcula con:
                  </p>
                  <p className="font-mono text-[9px] text-amber-400 text-center bg-black/40 py-1.5 rounded border border-white/[0.04]">
                    Precio Final = (Precio Base * Multiplicador) + Cargo Adicional
                  </p>
                </div>
              </div>

            </div>

            <hr className="border-white/[0.06]" />

            {/* Calculated Price & Form submit */}
            <div className="bg-gradient-to-r from-red-950/20 to-amber-950/10 border border-red-900/30 rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-left space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Precio de Venta Sugerido</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold font-mono text-amber-400">
                    ${finalPriceToUse.toLocaleString('es-AR')}
                  </span>
                  <span className="text-xs text-slate-500">ARS</span>
                </div>
                {customPrecioCalc === null ? (
                  <button
                    type="button"
                    onClick={() => {
                      const promptVal = prompt('Ingrese el precio personalizado para este servicio:', calculatedPrice.toString());
                      if (promptVal && !isNaN(Number(promptVal))) {
                        setCustomPrecioCalc(Number(promptVal));
                      }
                    }}
                    className="text-[10px] text-brand-primary underline hover:opacity-85 transition"
                  >
                    Establecer precio manual
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCustomPrecioCalc(null)}
                    className="text-[10px] text-slate-400 underline hover:text-slate-300 transition"
                  >
                    Restablecer precio sugerido (fórmula)
                  </button>
                )}
              </div>

              <div className="text-right space-y-1 md:max-w-xs">
                <div className="flex items-center gap-1.5 justify-end text-[10px] text-slate-300 font-semibold font-mono">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Duración Estimada: {currentNivel?.duracionEstimada || '12 hs'}</span>
                </div>
                <button
                  type="submit"
                  className="mt-1 w-full bg-red-600 hover:bg-red-700 text-white font-extrabold py-2 px-6 rounded-lg text-xs uppercase tracking-wider transition shadow-[0_0_15px_rgba(220,38,38,0.25)] flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agendar Turno Detailing
                </button>
              </div>
            </div>

          </form>

          {/* Side Panel: Dynamic Active Ceramic Turnos */}
          <div className="lg:col-span-4 space-y-5">
            
            <div className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-white/[0.08]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-500" />
                  Garantías y Control
                </h4>
                <span className="text-[8px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1 rounded font-bold font-mono">LIVE</span>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Cada tratamiento genera una garantía electrónica vinculada a la patente del vehículo. El panel Kanban de turnos alertará automáticamente al personal operario para que apliquen los protocolos de curado sellador térmico correspondientes de forma meticulosa.
              </p>

              {/* Quick Metrics */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-white/[0.02] border border-white/[0.05] p-2.5 rounded-lg text-center">
                  <span className="text-[9px] text-slate-500 block uppercase">Detallados de Hoy</span>
                  <span className="text-sm font-bold text-white font-mono mt-1 block">
                    {turnos.filter(t => t.isCeramic).length} activos
                  </span>
                </div>
                <div className="bg-white/[0.02] border border-white/[0.05] p-2.5 rounded-lg text-center">
                  <span className="text-[9px] text-slate-500 block uppercase">Ingreso Proyectado</span>
                  <span className="text-sm font-bold text-amber-400 font-mono mt-1 block">
                    ${turnos.filter(t => t.isCeramic).reduce((acc, t) => acc + t.precio, 0).toLocaleString('es-AR')}
                  </span>
                </div>
              </div>
            </div>

            {/* List of currently scheduled ceramic jobs */}
            <div className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-white/[0.08]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Monitoreo Detailing</h4>
                <span className="text-[9px] font-mono text-slate-500 font-bold">Patentes</span>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {turnos.filter(t => t.isCeramic).length === 0 ? (
                  <div className="text-center py-6 text-[10px] text-slate-500 italic">No hay tratamientos de estética complejos agendados hoy.</div>
                ) : (
                  turnos.filter(t => t.isCeramic).map((t) => (
                    <div key={t.id} className="bg-white/[0.01] p-2 rounded-lg border border-white/[0.04] space-y-1 text-[11px]">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white truncate max-w-[120px]">{t.clienteNombre}</span>
                        <span className="text-[8px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 rounded uppercase font-bold font-mono">
                          {t.ceramicNivel}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Vehículo: {t.vehiculoModelo}</span>
                        <span className="text-amber-500 font-bold font-mono">${t.precio.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-500 font-mono border-t border-white/[0.03] pt-1">
                        <span>Técnico: {t.lavadorAsignado}</span>
                        <span>Estado: <b className="text-amber-400 uppercase">{t.estado}</b></span>
                      </div>
                      {t.estado === 'COMPLETADO' || t.estado === 'ENTREGADO' ? (
                        <button
                          type="button"
                          onClick={() => generateWarrantyCertificate(t)}
                          className="mt-1 w-full bg-amber-500/10 hover:bg-amber-500/20 active:bg-amber-500/35 border border-amber-500/30 text-amber-400 font-bold py-1 rounded text-[8px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          📜 Emitir Garantía
                        </button>
                      ) : (
                        <div className="text-[8px] text-slate-600 italic text-center mt-1">Garantía disponible al completar</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Sub-Tab 2: Treatment configuration and factors config */}
      {activeSubTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          
          {/* Left Column: List of existing Treatment levels & Create form */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Treatment level configuration form */}
            <form onSubmit={handleAddNivel} className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-white/[0.08]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-primary flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-brand-primary" /> Configurar Niveles de Tratamiento
                </h4>
                <span className="text-[8px] text-slate-500">Formulario Admin</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] text-slate-400 uppercase">Nombre del Tratamiento</label>
                  <input
                    type="text"
                    required
                    value={newNombre}
                    onChange={(e) => setNewNombre(e.target.value)}
                    placeholder="Ej. Tratamiento Cerámico Sonax CC36"
                    className="w-full bg-[#030406] border border-white/[0.08] focus:border-red-500/50 focus:outline-none rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] text-slate-400 uppercase">Durabilidad / Garantía</label>
                  <select
                    value={newDurabilidad}
                    onChange={(e) => setNewDurabilidad(e.target.value)}
                    className="w-full bg-[#030406] border border-white/[0.08] focus:border-red-500/50 focus:outline-none rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="1 Año">1 Año de Protección</option>
                    <option value="2 Años">2 Años de Protección</option>
                    <option value="3 Años">3 Años de Protección</option>
                    <option value="5 Años">5 Años de Protección</option>
                    <option value="De por Vida">De por Vida (Garantía Escrita)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] text-slate-400 uppercase">Precio Base (Auto estándar)</label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      value={newPrecioBase}
                      onChange={(e) => setNewPrecioBase(e.target.value)}
                      placeholder="Ej. 180000"
                      className="w-full bg-[#030406] border border-white/[0.08] focus:border-red-500/50 focus:outline-none rounded-lg pl-6 pr-3 py-1.5 text-xs text-white font-mono"
                    />
                    <span className="absolute left-2 top-1.5 text-slate-500 text-xs">$</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] text-slate-400 uppercase">Duración Estimada de Mano de Obra</label>
                  <input
                    type="text"
                    required
                    value={newDuracionEstimada}
                    onChange={(e) => setNewDuracionEstimada(e.target.value)}
                    placeholder="Ej. 8 hs, 1.5 días"
                    className="w-full bg-[#030406] border border-white/[0.08] focus:border-red-500/50 focus:outline-none rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 uppercase">Descripción detallada técnica del servicio</label>
                <textarea
                  value={newDescripcion}
                  onChange={(e) => setNewDescripcion(e.target.value)}
                  placeholder="Detalla los pasos de descontaminado férreo, cantidad de pasos de pulido, marca y propiedades del compuesto curador."
                  rows={2}
                  className="w-full bg-[#030406] border border-white/[0.08] focus:border-red-500/50 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg text-xs uppercase tracking-wider transition duration-200 flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Crear y Publicar Nivel Cerámico
              </button>
            </form>

            {/* List of current configured levels */}
            <div className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 pb-2 border-b border-white/[0.08]">
                Niveles en Base de Datos ({niveles.length})
              </h4>
              <div className="space-y-3">
                {niveles.map((n) => (
                  <div key={n.id} className="bg-white/[0.01] p-3 rounded-xl border border-white/[0.05] flex justify-between items-start gap-4">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{n.nombre}</span>
                        <span className="text-[8px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1 py-0.5 rounded font-bold uppercase">
                          {n.durabilidad}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-normal">{n.descripcion}</p>
                      <div className="flex gap-4 text-[9px] text-slate-500 font-mono mt-2">
                        <span>Precio Base: <b className="text-slate-300">${n.precioBase.toLocaleString('es-AR')}</b></span>
                        <span>Mano de Obra: <b className="text-slate-300">{n.duracionEstimada}</b></span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteNivel(n.id)}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition shrink-0"
                      title="Eliminar nivel de tratamiento"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column: Editable Factors config */}
          <div className="lg:col-span-5 space-y-6">
            
            <div className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-white/[0.08]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Car className="w-4 h-4 text-brand-primary" />
                  Factores por Tamaño de Vehículo
                </h4>
                <span className="text-[9px] text-slate-500 font-bold uppercase font-mono">Formulas</span>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Los tratamientos cerámicos consumen significativamente más insumos (militros de cuarzo/SiO2) y horas de lijado técnico en SUVs y camionetas de gran volumen que en hatchbacks pequeños o sedanes. Ajusta los coeficientes y cargos adicionales fijos abajo:
              </p>

              <div className="space-y-4 pt-2">
                {factores.map((f) => (
                  <div key={f.tipo} className="bg-white/[0.02] border border-white/[0.05] p-3 rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded bg-brand-primary/20 text-brand-primary">
                        <Car className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold text-white uppercase">{f.tipo} • {f.nombre}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      {/* Multiplier Edit */}
                      <div className="space-y-1">
                        <label className="block text-[9px] text-slate-400 uppercase">Multiplicador Coeficiente</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.05"
                            value={f.multiplicador}
                            onChange={(e) => handleUpdateFactor(f.tipo, 'multiplicador', Number(e.target.value))}
                            className="w-full bg-[#030406] border border-white/[0.08] focus:border-red-500/50 focus:outline-none rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                          />
                          <span className="absolute right-2 top-1 text-slate-500 text-[10px]">x</span>
                        </div>
                      </div>

                      {/* Cargo Adicional edit */}
                      <div className="space-y-1">
                        <label className="block text-[9px] text-slate-400 uppercase">Cargo Adicional Fijo ($)</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="5000"
                            value={f.adicional}
                            onChange={(e) => handleUpdateFactor(f.tipo, 'adicional', Number(e.target.value))}
                            className="w-full bg-[#030406] border border-white/[0.08] focus:border-red-500/50 focus:outline-none rounded-lg pl-5 pr-2 py-1 text-xs text-white font-mono"
                          />
                          <span className="absolute left-1.5 top-1 text-slate-500 text-[10px]">$</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Resumen de Precios de Venta Simulado
              </h4>
              <p className="text-[10px] text-slate-500 leading-normal">Simulación rápida de precios en base a los factores configurados:</p>
              
              <div className="space-y-1.5 font-mono text-[10px]">
                {niveles.map((n) => (
                  <div key={n.id} className="border-b border-white/[0.03] pb-1.5 last:border-none last:pb-0 space-y-1">
                    <div className="font-semibold text-slate-300 text-[11px] font-sans">{n.nombre}</div>
                    <div className="grid grid-cols-3 gap-1 text-[10px]">
                      {factores.map((f) => {
                        const calculated = Math.round((n.precioBase * f.multiplicador) + f.adicional);
                        return (
                          <div key={f.tipo} className="bg-white/[0.01] p-1.5 rounded border border-white/[0.04] text-center">
                            <span className="text-slate-500 text-[8px] block uppercase">{f.tipo}</span>
                            <span className="text-amber-400 font-bold block mt-0.5">${calculated.toLocaleString('es-AR')}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Sub-Tab 3: Gloss & Hydrophobicity Simulator */}
      {activeSubTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in relative z-20">
          
          {/* Controls Column */}
          <div className="lg:col-span-5 space-y-5">
            <div className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
              <div className="pb-2 border-b border-white/[0.08]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Ajustes de Simulación
                </h4>
                <span className="text-[10px] text-slate-500">Configura las condiciones del ensayo óptico</span>
              </div>

              {/* Color Selector */}
              <div className="space-y-2">
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold">1. Color de Pintura</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'red', label: 'Rosso Corsa', color: 'bg-red-600' },
                    { id: 'orange', label: 'Cyber Orange', color: 'bg-orange-500' },
                    { id: 'black', label: 'Carbon Black', color: 'bg-neutral-900' },
                    { id: 'cyan', label: 'Ceramic Cyan', color: 'bg-cyan-500' }
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSimColor(c.id as any)}
                      className={`p-2 rounded-lg border text-center transition flex flex-col items-center gap-1.5 cursor-pointer ${
                        simColor === c.id
                          ? 'border-red-500/50 bg-red-500/10'
                          : 'border-white/[0.06] bg-black/20 hover:border-white/[0.12]'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full ${c.color} border border-white/20`} />
                      <span className="text-[8px] text-slate-400 font-bold truncate max-w-full">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Treatment Level Selector */}
              <div className="space-y-2">
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold">2. Nivel de Protección</label>
                <div className="space-y-2">
                  {[
                    { id: 'express', label: 'SiO2 Express (1 Año)', desc: 'Brillo húmedo y repelencia básica' },
                    { id: 'premium', label: 'Premium 9H Gyeon (3 Años)', desc: 'Profundidad de color, anti-swirl y dureza' },
                    { id: 'elite', label: 'Elite Grafeno (5 Años)', desc: 'Brillo tridimensional y repelencia extrema' }
                  ].map((l) => (
                    <div
                      key={l.id}
                      onClick={() => setSimLevel(l.id as any)}
                      className={`p-3 rounded-lg border cursor-pointer transition text-left ${
                        simLevel === l.id
                          ? 'bg-amber-500/10 border-amber-500/40'
                          : 'bg-white/[0.01] border-white/[0.06] hover:border-white/[0.1]'
                      }`}
                    >
                      <div className="text-xs font-bold text-white">{l.label}</div>
                      <div className="text-[9px] text-slate-400 mt-0.5">{l.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Slider for Light Angle */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <span>3. Ángulo de Luz Analítico</span>
                  <span className="font-mono text-amber-400">{simLightAngle}°</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  value={simLightAngle}
                  onChange={(e) => setSimLightAngle(Number(e.target.value))}
                  className="w-full h-1 bg-white/[0.08] rounded-lg appearance-none cursor-pointer accent-red-600"
                />
                <span className="text-[9px] text-slate-500 block">Desliza la luz para comprobar los reflejos y el brillo especular.</span>
              </div>
            </div>

            {/* Test Evaporation & Water button */}
            <div className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Prueba Hidrofóbica
              </h4>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Comprueba la repelencia al agua y capacidad de escurrimiento (Efecto Loto) del nivel de tratamiento seleccionado.
              </p>
              <button
                type="button"
                disabled={isWaterTestActive}
                onClick={() => {
                  setIsWaterTestActive(true);
                  setTimeout(() => {
                    setIsWaterTestActive(false);
                  }, 2500);
                }}
                className={`w-full py-2.5 rounded-lg text-xs font-extrabold uppercase tracking-wider transition ${
                  isWaterTestActive
                    ? 'bg-slate-800 text-slate-500 border border-white/[0.04]'
                    : 'bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 cursor-pointer'
                }`}
              >
                {isWaterTestActive ? '💧 Escurriendo agua...' : '💦 Disparar Test de Repelencia'}
              </button>
            </div>
          </div>

          {/* Interactive Screen Column */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Visualizer Frame */}
            <div className="glass-panel p-6 rounded-xl border border-white/[0.08] bg-black/60 flex flex-col justify-center items-center relative overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
              {/* Decorative Carbon grid for mockup */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:12px_12px] pointer-events-none opacity-40" />
              
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 z-10">MÓDULO DE INSPECCIÓN ÓPTICA DE BRILLO</span>
              
              {/* Dynamic Sphere representing Paint */}
              <div className="relative w-64 h-64 flex items-center justify-center z-10">
                {/* SVG Metallic Sphere */}
                <svg width="240" height="240" viewBox="0 0 100 100" className="drop-shadow-[0_20px_40px_rgba(0,0,0,0.8)]">
                  <defs>
                    {/* Dynamic Base Gradient */}
                    <radialGradient id="sphere-base" cx="40%" cy="40%" r="60%">
                      {simColor === 'red' && (
                        <>
                          <stop offset="0%" stopColor="#ff4d4d" />
                          <stop offset="70%" stopColor="#990000" />
                          <stop offset="100%" stopColor="#330000" />
                        </>
                      )}
                      {simColor === 'orange' && (
                        <>
                          <stop offset="0%" stopColor="#ffb366" />
                          <stop offset="70%" stopColor="#e67300" />
                          <stop offset="100%" stopColor="#4d2600" />
                        </>
                      )}
                      {simColor === 'black' && (
                        <>
                          <stop offset="0%" stopColor="#555555" />
                          <stop offset="70%" stopColor="#1a1a1a" />
                          <stop offset="100%" stopColor="#000000" />
                        </>
                      )}
                      {simColor === 'cyan' && (
                        <>
                          <stop offset="0%" stopColor="#66ffff" />
                          <stop offset="70%" stopColor="#00b3b3" />
                          <stop offset="100%" stopColor="#003333" />
                        </>
                      )}
                    </radialGradient>

                    {/* Specular Highlight Gradient */}
                    <radialGradient id="specular-highlight" cx={`${simLightAngle}%`} cy="30%" r="25%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity={simLevel === 'elite' ? '0.95' : simLevel === 'premium' ? '0.75' : '0.45'} />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                    </radialGradient>

                    {/* Reflection Highlight Gradient (Elite coating gets deep mirror reflection) */}
                    <linearGradient id="mirror-reflection" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity={simLevel === 'elite' ? '0.2' : simLevel === 'premium' ? '0.1' : '0'} />
                      <stop offset="40%" stopColor="#ffffff" stopOpacity="0" />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity={simLevel === 'elite' ? '0.15' : '0'} />
                    </linearGradient>
                  </defs>

                  {/* Base Paint Sphere */}
                  <circle cx="50" cy="50" r="42" fill="url(#sphere-base)" />

                  {/* Swirl simulations if level is low (Express has slight swirls under light) */}
                  {simLevel === 'express' && (
                    <g opacity="0.15" stroke="#ffffff" strokeWidth="0.2" fill="none">
                      <path d="M42 35 C 48 38, 52 38, 58 35" />
                      <path d="M40 38 C 48 41, 52 41, 60 38" />
                      <path d="M38 42 C 48 45, 52 45, 62 42" />
                    </g>
                  )}

                  {/* Mirror Reflection Overlay */}
                  <circle cx="50" cy="50" r="42" fill="url(#mirror-reflection)" />

                  {/* Specular Light Reflection (Dynamic spot) */}
                  <circle cx="50" cy="50" r="42" fill="url(#specular-highlight)" />

                  {/* Hydrophobic Water Droplets Animation (Dynamic speeds governed by treatment quality) */}
                  {isWaterTestActive && (
                    <g>
                      {/* Droplet 1 (Center) */}
                      <circle cx="50" cy="18" r="2.0" fill="#38bdf8" opacity="0.9">
                        <animate 
                          attributeName="cy" 
                          values="18;85" 
                          dur={simLevel === 'elite' ? '0.5s' : simLevel === 'premium' ? '1.2s' : '2.2s'} 
                          repeatCount="indefinite" 
                        />
                        <animate 
                          attributeName="opacity" 
                          values="0.9;0" 
                          dur={simLevel === 'elite' ? '0.5s' : simLevel === 'premium' ? '1.2s' : '2.2s'} 
                          repeatCount="indefinite" 
                        />
                      </circle>
                      
                      {/* Droplet 2 (Left) */}
                      <circle cx="36" cy="26" r="1.6" fill="#38bdf8" opacity="0.9">
                        <animate 
                          attributeName="cy" 
                          values="26;76" 
                          dur={simLevel === 'elite' ? '0.7s' : simLevel === 'premium' ? '1.5s' : '2.5s'} 
                          begin="0.15s" 
                          repeatCount="indefinite" 
                        />
                        <animate 
                          attributeName="opacity" 
                          values="0.9;0" 
                          dur={simLevel === 'elite' ? '0.7s' : simLevel === 'premium' ? '1.5s' : '2.5s'} 
                          begin="0.15s" 
                          repeatCount="indefinite" 
                        />
                      </circle>

                      {/* Droplet 3 (Right) */}
                      <circle cx="64" cy="24" r="1.8" fill="#38bdf8" opacity="0.9">
                        <animate 
                          attributeName="cy" 
                          values="24;78" 
                          dur={simLevel === 'elite' ? '0.6s' : simLevel === 'premium' ? '1.3s' : '2.3s'} 
                          begin="0.3s" 
                          repeatCount="indefinite" 
                        />
                        <animate 
                          attributeName="opacity" 
                          values="0.9;0" 
                          dur={simLevel === 'elite' ? '0.6s' : simLevel === 'premium' ? '1.3s' : '2.3s'} 
                          begin="0.3s" 
                          repeatCount="indefinite" 
                        />
                      </circle>
                    </g>
                  )}
                </svg>

                {/* Evaporation effect sparkles (Elite gets little neon stars) */}
                {simLevel === 'elite' && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Sparkles className="w-6 h-6 text-amber-400 absolute top-12 left-16 animate-pulse" />
                    <Sparkles className="w-5 h-5 text-cyan-300 absolute bottom-16 right-20 animate-pulse" />
                  </div>
                )}
              </div>

              {/* Water test physics indicator overlay */}
              {isWaterTestActive && (
                <div className="absolute bottom-20 bg-cyan-950/85 border border-cyan-500/30 text-cyan-300 font-mono text-[9px] px-3 py-1 rounded uppercase tracking-wider animate-pulse z-20">
                  Velocidad de Escurrimiento: {simLevel === 'elite' ? '180 cm/s (Extrema)' : simLevel === 'premium' ? '95 cm/s (Rápida)' : '42 cm/s (Lenta)'}
                </div>
              )}

              {/* Specifications Matrix Card */}
              <div className="w-full mt-4 bg-black/40 rounded-xl border border-white/[0.08] p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                <div className="space-y-0.5">
                  <span className="text-[8px] text-slate-500 uppercase font-black">Brillo Especular</span>
                  <span className="text-sm font-extrabold font-mono text-white block">
                    {simLevel === 'elite' ? '99.2 GU' : simLevel === 'premium' ? '95.8 GU' : '88.5 GU'}
                  </span>
                  <span className="text-[7.5px] text-slate-400 block">Gloss Units (Espejo)</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[8px] text-slate-500 uppercase font-black">Ángulo de Contacto</span>
                  <span className="text-sm font-extrabold font-mono text-cyan-400 block">
                    {simLevel === 'elite' ? '122°' : simLevel === 'premium' ? '112°' : '92°'}
                  </span>
                  <span className="text-[7.5px] text-slate-400 block">Repelencia al Agua</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[8px] text-slate-500 uppercase font-black">Dureza Mohs</span>
                  <span className="text-sm font-extrabold font-mono text-amber-500 block">
                    {simLevel === 'elite' ? '9H+ Real' : simLevel === 'premium' ? '9H Gyeon' : '5H Acrílico'}
                  </span>
                  <span className="text-[7.5px] text-slate-400 block">Escala Mineral</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[8px] text-slate-500 uppercase font-black">Curado Térmico</span>
                  <span className="text-sm font-extrabold font-mono text-red-400 block">
                    {simLevel === 'elite' ? '18 hs' : simLevel === 'premium' ? '12 hs' : '6 hs'}
                  </span>
                  <span className="text-[7.5px] text-slate-400 block">Tiempo de reposo</span>
                </div>
              </div>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}
