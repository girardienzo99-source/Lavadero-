import React, { useState, useEffect } from 'react';
import { 
  X, ShieldAlert, Plus, Trash2, AlertOctagon, FileText, Download, CheckCircle
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DamagePin {
  id?: number;
  componente: string;
  tipo_danio: string;
  gravedad: string;
  coordenada_x: number;
  coordenada_y: number;
  detalles: string;
  fecha_registro?: string;
}

interface CarDamageInspectionProps {
  turnoId: string | number;
  clienteNombre: string;
  vehiculoModelo: string;
  vehiculoPatente: string;
  onClose: () => void;
}

export default function CarDamageInspection({
  turnoId,
  clienteNombre,
  vehiculoModelo,
  vehiculoPatente,
  onClose
}: CarDamageInspectionProps) {
  const [pins, setPins] = useState<DamagePin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // New pin form state
  const [selectedX, setSelectedX] = useState<number | null>(null);
  const [selectedY, setSelectedY] = useState<number | null>(null);
  const [component, setComponent] = useState('Paragolpes Delantero');
  const [damageType, setDamageType] = useState('Rayón / Arañazo');
  const [severity, setSeverity] = useState('Leve');
  const [notes, setNotes] = useState('');
  
  const [showAddForm, setShowAddForm] = useState(false);

  // Fetch existing damage pins
  const fetchPins = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/turnos/${turnoId}/inspeccion`);
      const data = await response.json();
      if (data.status === 'success') {
        setPins(data.danos || []);
      } else {
        setError('Error al cargar la inspección de daños.');
      }
    } catch (err) {
      setError('Error al comunicar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPins();
  }, [turnoId]);

  // Handle click on car SVG wireframe
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    // Suggest component based on Y and X coordinate ranges
    let suggestedComp = 'Carrocería General';
    if (y < 35) {
      // Top section: Front/Hood
      if (x < 30) suggestedComp = 'Paragolpes Delantero';
      else if (x < 60) suggestedComp = 'Capot / Parabrisas';
      else suggestedComp = 'Techo';
    } else if (y > 65) {
      // Bottom section: Rear/Trunk
      if (x > 75) suggestedComp = 'Paragolpes Trasero / Baúl';
      else if (x > 45) suggestedComp = 'Luneta / Techo Trasero';
      else suggestedComp = 'Costado Izquierdo';
    } else {
      // Mid section
      if (x < 25) suggestedComp = 'Puerta Delantera Derecha';
      else if (x < 50) suggestedComp = 'Puerta Trasera Derecha';
      else if (x < 75) suggestedComp = 'Puerta Delantera Izquierda';
      else suggestedComp = 'Puerta Trasera Izquierda';
    }

    setSelectedX(x);
    setSelectedY(y);
    setComponent(suggestedComp);
    setShowAddForm(true);
  };

  // Add new damage pin
  const handleAddPin = async () => {
    if (selectedX === null || selectedY === null) return;
    
    const newPin = {
      componente: component,
      tipo_danio: damageType,
      gravedad: severity,
      coordenada_x: selectedX,
      coordenada_y: selectedY,
      detalles: notes
    };

    try {
      const response = await fetch(`/api/turnos/${turnoId}/inspeccion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPin)
      });
      const data = await response.json();
      if (data.status === 'success') {
        fetchPins();
        // Reset form
        setSelectedX(null);
        setSelectedY(null);
        setNotes('');
        setShowAddForm(false);
      } else {
        alert('Error al guardar la marca de daño.');
      }
    } catch (err) {
      alert('Error de conexión.');
    }
  };

  // Delete damage pin
  const handleDeletePin = async (pinId: number) => {
    try {
      const response = await fetch(`/api/turnos/inspeccion/${pinId}/eliminar`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.status === 'success') {
        setPins(prev => prev.filter(p => p.id !== pinId));
      } else {
        alert('Error al eliminar la marca.');
      }
    } catch (err) {
      alert('Error de conexión.');
    }
  };

  // Export PDF Damage Report
  const exportPdf = () => {
    const doc = new jsPDF();
    
    // Header styling
    doc.setFillColor(31, 41, 55); // Dark Slate background
    doc.rect(0, 0, 210, 45, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('FICHA DE INSPECCIÓN DE VEHÍCULO', 15, 20);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Control de Daños Previos y Estado de Recepción', 15, 28);
    doc.text(`Fecha Emisión: ${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR')}`, 15, 36);

    // Client/Car info box
    doc.setDrawColor(229, 231, 235);
    doc.setFillColor(249, 250, 251);
    doc.rect(15, 52, 180, 32, 'FD');
    
    doc.setTextColor(55, 65, 81);
    doc.setFont('helvetica', 'bold');
    doc.text('CLIENTE:', 20, 60);
    doc.text('VEHÍCULO:', 20, 68);
    doc.text('PATENTE / PLACA:', 20, 76);
    doc.text('TURNO ID:', 120, 60);
    doc.text('ESTADO RECEPCIÓN:', 120, 68);

    doc.setFont('helvetica', 'normal');
    doc.text(clienteNombre.toUpperCase(), 45, 60);
    doc.text(vehiculoModelo.toUpperCase(), 45, 68);
    doc.text(vehiculoPatente.toUpperCase(), 60, 76);
    doc.text(`#${turnoId}`, 150, 60);
    doc.text(pins.length > 0 ? `${pins.length} marcas registradas` : 'Sin daños previos', 165, 68);

    // Summary table headers
    const tableRows: any[] = [];
    pins.forEach((p, idx) => {
      tableRows.push([
        idx + 1,
        p.componente,
        p.tipo_danio,
        p.gravedad.toUpperCase(),
        p.detalles || 'Sin observaciones'
      ]);
    });

    autoTable(doc, {
      startY: 92,
      head: [['N°', 'Componente / Zona', 'Tipo de Daño', 'Gravedad', 'Detalles / Observaciones']],
      body: tableRows.length > 0 ? tableRows : [['-', 'Ninguno', 'Sin daños previos detectados', 'OK', 'Vehículo recibido en perfectas condiciones']],
      headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 40 },
        2: { cellWidth: 35 },
        3: { cellWidth: 20 },
        4: { cellWidth: 75 }
      }
    });

    // Signature Area
    const finalY = (doc as any).lastAutoTable.finalY + 25;
    doc.setDrawColor(156, 163, 175);
    doc.line(20, finalY, 80, finalY);
    doc.line(130, finalY, 190, finalY);
    
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('Firma Responsable Lavadero', 32, finalY + 5);
    doc.text('Firma Conformidad Cliente', 145, finalY + 5);

    // Disclaimer
    doc.setFontSize(7);
    doc.text('El cliente declara estar conforme con la inspección realizada y acepta que los daños indicados arriba ya existían en el vehículo al momento de la entrega.', 15, finalY + 20, { maxWidth: 180 });

    doc.save(`inspeccion_daños_${vehiculoPatente.toLowerCase()}_${turnoId}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex justify-center items-center p-4 animate-fade-in">
      <div className="glass-panel p-6 rounded-3xl border border-white/[0.08] w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-6 relative shadow-[0_20px_50px_rgba(0,0,0,0.7)]">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white bg-black/50 hover:bg-black/80 p-2 rounded-full border border-white/[0.08] cursor-pointer transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Info Column (Left 4 cols) */}
        <div className="md:col-span-4 space-y-4 flex flex-col justify-between">
          <div>
            <span className="text-[9px] uppercase tracking-widest text-brand-primary font-bold font-mono">Control y Inspección</span>
            <h3 className="text-lg font-black text-white leading-tight uppercase font-display mt-1">
              Registro de Daños
            </h3>
            <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
              Haz clic sobre el plano del vehículo a la derecha para colocar un pin rojo en la ubicación exacta del daño.
            </p>
          </div>

          {/* Client Details Info Card */}
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4 space-y-2 text-xs">
            <div>
              <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest block">Propietario</span>
              <span className="text-white font-bold block">{clienteNombre}</span>
            </div>
            <div>
              <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest block">Vehículo / Modelo</span>
              <span className="text-slate-200 font-medium block">{vehiculoModelo}</span>
            </div>
            <div>
              <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest block">Patente</span>
              <span className="text-brand-primary font-mono font-bold tracking-wider block">{vehiculoPatente.toUpperCase()}</span>
            </div>
            <div>
              <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest block">Turno Relacionado</span>
              <span className="text-slate-400 block">ID: #{turnoId}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2 pt-4 border-t border-white/[0.04]">
            <button
              onClick={exportPdf}
              className="w-full bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_2px_15px_rgba(220,38,38,0.2)]"
            >
              <Download className="w-4 h-4" />
              Descargar Ficha PDF
            </button>
            <button
              onClick={onClose}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer border border-white/[0.04]"
            >
              Aceptar y Volver
            </button>
          </div>
        </div>

        {/* Visual Map Column (Middle 5 cols) */}
        <div className="md:col-span-5 bg-black/45 border border-white/[0.05] rounded-3xl p-4 flex flex-col justify-between relative min-h-[350px]">
          <div className="flex justify-between items-center border-b border-white/[0.04] pb-2 mb-2">
            <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">Mapa del Auto (Clic para colocar pin)</span>
            <span className="bg-red-500/20 text-red-400 text-[8px] font-black uppercase px-2 py-0.5 rounded-md border border-red-500/30">
              Vista Superior
            </span>
          </div>

          <div className="flex-1 flex justify-center items-center relative">
            {/* SVG CAR MAP */}
            <svg 
              viewBox="0 0 200 400" 
              className="w-full max-h-[360px] cursor-crosshair opacity-85 hover:opacity-100 transition-opacity"
              onClick={handleSvgClick}
            >
              {/* Car Silhouette (Styled outline) */}
              {/* Roof */}
              <rect x="55" y="140" width="90" height="130" rx="15" fill="none" stroke="#475569" strokeWidth="2" />
              {/* Hood */}
              <path d="M 50,110 Q 50,60 100,50 Q 150,60 150,110 L 150,330 Q 150,370 100,380 Q 50,370 50,330 Z" fill="none" stroke="#cbd5e1" strokeWidth="3" />
              {/* Windshield */}
              <path d="M 60,135 L 140,135 Q 120,120 100,120 Q 80,120 60,135" fill="none" stroke="#475569" strokeWidth="2" />
              {/* Mirrors */}
              <rect x="35" y="125" width="15" height="8" rx="2" fill="#475569" />
              <rect x="150" y="125" width="15" height="8" rx="2" fill="#475569" />
              {/* Wheels */}
              <rect x="42" y="80" width="8" height="25" rx="2" fill="#334155" />
              <rect x="150" y="80" width="8" height="25" rx="2" fill="#334155" />
              <rect x="42" y="290" width="8" height="25" rx="2" fill="#334155" />
              <rect x="150" y="290" width="8" height="25" rx="2" fill="#334155" />
              {/* Rear Glass */}
              <path d="M 60,280 L 140,280 Q 120,295 100,295 Q 80,295 60,280" fill="none" stroke="#475569" strokeWidth="2" />
              
              {/* Grid guide */}
              <line x1="100" y1="0" x2="100" y2="400" stroke="white" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.15" />
              <line x1="0" y1="200" x2="200" y2="200" stroke="white" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.15" />

              {/* Render Existing Pins */}
              {pins.map((pin) => (
                <g key={pin.id}>
                  {/* Outer breathing glow */}
                  <circle 
                    cx={(pin.coordenada_x / 100) * 200} 
                    cy={(pin.coordenada_y / 100) * 400} 
                    r="10" 
                    fill="rgba(239, 68, 68, 0.4)" 
                    className="animate-ping"
                  />
                  {/* Solid Red Pin Center */}
                  <circle 
                    cx={(pin.coordenada_x / 100) * 200} 
                    cy={(pin.coordenada_y / 100) * 400} 
                    r="5" 
                    fill="#ef4444" 
                    stroke="white"
                    strokeWidth="1.5"
                    style={{ cursor: 'pointer' }}
                  />
                </g>
              ))}

              {/* Temporary Selected Pin (form placement indicator) */}
              {selectedX !== null && selectedY !== null && (
                <g>
                  <circle 
                    cx={(selectedX / 100) * 200} 
                    cy={(selectedY / 100) * 400} 
                    r="12" 
                    fill="none" 
                    stroke="#eab308" 
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                    className="animate-spin"
                  />
                  <circle 
                    cx={(selectedX / 100) * 200} 
                    cy={(selectedY / 100) * 400} 
                    r="6" 
                    fill="#eab308" 
                    stroke="white"
                    strokeWidth="1.5"
                  />
                </g>
              )}
            </svg>
          </div>

          {/* Form Modal inside SVG panel */}
          {showAddForm && selectedX !== null && selectedY !== null && (
            <div className="absolute inset-x-4 bottom-4 bg-slate-950 border border-amber-500/30 rounded-2xl p-3 space-y-2.5 animate-slide-up shadow-[0_5px_20px_rgba(0,0,0,0.5)]">
              <div className="flex justify-between items-center">
                <span className="text-[9px] uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" />
                  Nueva Falla Detectada
                </span>
                <button 
                  onClick={() => {
                    setSelectedX(null);
                    setSelectedY(null);
                    setShowAddForm(false);
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="space-y-1">
                  <label className="text-slate-400 block">Zona / Componente</label>
                  <input
                    type="text"
                    value={component}
                    onChange={(e) => setComponent(e.target.value)}
                    className="w-full bg-slate-900 border border-white/[0.1] rounded px-2 py-1 text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 block">Tipo de Daño</label>
                  <select
                    value={damageType}
                    onChange={(e) => setDamageType(e.target.value)}
                    className="w-full bg-slate-900 border border-white/[0.1] rounded px-2 py-1 text-white"
                  >
                    <option value="Rayón / Arañazo">Rayón / Arañazo</option>
                    <option value="Abolladura">Abolladura / Golpe</option>
                    <option value="Piquete de Piedra">Piquete de Piedra</option>
                    <option value="Pintura Desgastada / Sol">Pintura Quemada</option>
                    <option value="Cristal Partido">Cristal Partido</option>
                    <option value="Óxido / Corrosión">Óxido / Corrosión</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <div className="space-y-1">
                  <label className="text-slate-400 block">Gravedad</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className="w-full bg-slate-900 border border-white/[0.1] rounded px-2 py-1 text-white"
                  >
                    <option value="Leve">Leve</option>
                    <option value="Moderado">Moderado</option>
                    <option value="Grave">Grave</option>
                  </select>
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-slate-400 block">Notas Adicionales</label>
                  <input
                    type="text"
                    placeholder="Ej: Rayón de 5cm"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-slate-900 border border-white/[0.1] rounded px-2 py-1 text-white"
                  />
                </div>
              </div>

              <button
                onClick={handleAddPin}
                className="w-full bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold py-1.5 rounded-lg text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Registrar Daño
              </button>
            </div>
          )}
        </div>

        {/* Damages List Column (Right 3 cols) */}
        <div className="md:col-span-3 flex flex-col justify-between min-h-[350px]">
          <div>
            <div className="border-b border-white/[0.04] pb-2 mb-2">
              <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">Listado de Marcas ({pins.length})</span>
            </div>

            {loading ? (
              <p className="text-[10px] text-slate-500 italic mt-4">Cargando...</p>
            ) : pins.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <CheckCircle className="w-8 h-8 text-emerald-500/40 mx-auto" />
                <p className="text-[10px] text-slate-500 leading-normal">
                  Ningún daño previo registrado.<br />Vehículo en excelente estado.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {pins.map((pin) => (
                  <div 
                    key={pin.id} 
                    className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-2.5 flex items-start justify-between gap-1 text-[10px]"
                  >
                    <div className="space-y-0.5">
                      <span className="font-extrabold text-white block">{pin.componente}</span>
                      <span className="text-slate-400 block">{pin.tipo_danio}</span>
                      <div className="flex gap-1 items-center mt-1">
                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.2 rounded border ${
                          pin.gravedad === 'Grave' 
                            ? 'bg-red-500/20 border-red-500 text-red-300' 
                            : pin.gravedad === 'Moderado'
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                            : 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        }`}>
                          {pin.gravedad}
                        </span>
                        {pin.detalles && (
                          <span className="text-slate-500 italic font-light truncate max-w-[100px]" title={pin.detalles}>
                            {pin.detalles}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => pin.id && handleDeletePin(pin.id)}
                      className="text-slate-500 hover:text-red-400 p-1 bg-black/25 hover:bg-black/60 rounded border border-white/[0.03] cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-900/50 rounded-xl p-2.5 text-[9px] border border-white/[0.03] mt-2">
            <span className="text-slate-500 block leading-relaxed font-light">
              Nota: Todas las fallas quedan asentadas en la base de datos y se adjuntan en los PDF de cierre.
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
