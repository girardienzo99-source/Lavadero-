import React, { useState } from 'react';
import { ShieldAlert, Trash2, Camera, Sparkles, CheckCircle2, FileText } from 'lucide-react';
import { DamageChecklist, VehicleHealthData } from '../types';
import { generateInspectionPDF } from '../utils/ticketGenerator';

const DEFAULT_DAMAGE_CHECKLIST: DamageChecklist = {
  paragolpesDelantero: false,
  paragolpesTrasero: false,
  puertaDerecha: false,
  puertaIzquierda: false,
  capot: false,
  techo: false,
  vidrios: false,
  llantas: false,
  interior: false
};

async function compressReceptionPhoto(file: File): Promise<string> {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('No se pudo abrir la imagen.'));
      element.src = sourceUrl;
    });
    const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo preparar la imagen.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL('image/jpeg', 0.72);
    const estimatedBytes = Math.ceil((result.length - result.indexOf(',') - 1) * 0.75);
    if (estimatedBytes > 700000) throw new Error('La imagen sigue siendo demasiado pesada luego de optimizarla.');
    return result;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

interface VehicleHealthProps {
  patente: string;
  modelo: string;
  isEditMode?: boolean;
  initialData?: VehicleHealthData | null;
  onSave?: (data: VehicleHealthData) => void;
  onClose?: () => void;
}

export default function VehicleHealth({
  patente,
  modelo,
  isEditMode = false,
  initialData = null,
  onSave,
  onClose
}: VehicleHealthProps) {
  // Try to load state or set defaults
  const [nivelSuciedad, setNivelSuciedad] = useState<VehicleHealthData['nivelSuciedad']>(
    initialData?.nivelSuciedad || 'MEDIO'
  );
  const [checklist, setChecklist] = useState<DamageChecklist>(
    initialData?.checklistDanos || DEFAULT_DAMAGE_CHECKLIST
  );
  const [observaciones, setObservaciones] = useState(initialData?.observaciones || '');
  const [inspector, setInspector] = useState(initialData?.operarioInspector || 'Supervisor Albelo');

  const [fotos, setFotos] = useState<VehicleHealthData['fotos']>(
    initialData?.fotos || initialData?.fotosSimuladas || []
  );
  const [photoError, setPhotoError] = useState('');

  const toggleSector = (sector: keyof DamageChecklist) => {
    if (!isEditMode) return;
    const nextVal = !checklist[sector];
    setChecklist(prev => ({
      ...prev,
      [sector]: nextVal
    }));
  };

  const getSectorLabel = (key: keyof DamageChecklist): string => {
    switch (key) {
      case 'paragolpesDelantero': return 'Paragolpes Delantero';
      case 'paragolpesTrasero': return 'Paragolpes Trasero';
      case 'puertaDerecha': return 'Puerta Derecha';
      case 'puertaIzquierda': return 'Puerta Izquierda';
      case 'capot': return 'Capot';
      case 'techo': return 'Techo';
      case 'vidrios': return 'Vidrios y Cristales';
      case 'llantas': return 'Llantas de Aleación';
      case 'interior': return 'Interior y Tapizado';
    }
  };

  const handlePhotoSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError('');
    const selected: File[] = event.currentTarget.files
      ? Array.from(event.currentTarget.files as FileList)
      : [];
    event.target.value = '';
    if (fotos.length + selected.length > 6) {
      setPhotoError('Podés adjuntar hasta 6 fotos por inspección.');
      return;
    }
    if (selected.some(file => !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024)) {
      setPhotoError('Cada archivo debe ser una imagen de hasta 5 MB.');
      return;
    }
    const damagedSector = (Object.keys(checklist) as Array<keyof DamageChecklist>).find(key => checklist[key]);
    const sector = damagedSector ? getSectorLabel(damagedSector) : 'Vista general';
    try {
      const additions = await Promise.all(selected.map(async (file): Promise<VehicleHealthData['fotos'][number]> => ({
        sector,
        url: await compressReceptionPhoto(file),
        descripcion: file.name,
      })));
      setFotos(current => [...current, ...additions]);
    } catch {
      setPhotoError('No se pudo procesar una de las imágenes.');
    }
  };

  const handleSave = () => {
    if (onSave) {
      onSave({
        patente: patente.toUpperCase(),
        nivelSuciedad,
        checklistDanos: checklist,
        observaciones,
        fotos,
        operarioInspector: inspector,
        fechaInspeccion: new Date().toISOString()
      });
    }
  };

  // Counting damaged sectors
  const countDanos = Object.values(checklist).filter(Boolean).length;

  return (
    <div className="bg-[#0c0f12]/95 border border-white/[0.08] rounded-xl overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
      
      {/* Visual Header */}
      <div className="bg-gradient-to-r from-neutral-900 to-black p-4 border-b border-white/[0.08] flex justify-between items-center">
        <div>
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-brand-primary" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100">
              Inspección de Estado Inicial
            </h4>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] font-bold text-slate-300 font-display">{modelo}</span>
            <span className="text-[10px] bg-brand-primary/10 text-brand-primary border border-brand-primary/20 px-1.5 py-0.2 rounded font-mono font-bold uppercase">
              {patente}
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[9px] font-mono font-bold text-slate-500 block">FÓRMULA ALBELO</span>
          <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 justify-end">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Auditado Activo
          </span>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Left column: Visual Interactive Wireframe & Dirt level */}
        <div className="md:col-span-7 space-y-5">
          
          {/* Section title */}
          <div>
            <h5 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-slate-500" />
              1. Mapa de Daños y Golpes Pre-existentes
            </h5>
            <p className="text-[10px] text-slate-500">
              {isEditMode 
                ? 'Haz clic sobre los componentes del diagrama para marcar abolladuras, raspaduras o defectos en el informe.' 
                : 'Detalles de daños detectados durante el peritaje inicial de recepción.'}
            </p>
          </div>

          {/* Interactive Car Wireframe (Custom high quality SVG layout) */}
          <div className="relative bg-black/40 rounded-xl border border-white/[0.04] p-4 flex flex-col items-center justify-center min-h-[220px]">
            
            {/* SVG Wireframe Schematic Top-Down view of Car */}
            <svg viewBox="0 0 400 180" className="w-full max-w-sm h-auto opacity-95">
              {/* Central Car Body Chassis */}
              <rect x="100" y="45" width="200" height="90" rx="30" fill="none" stroke="#334155" strokeWidth="2.5" />
              
              {/* Windshield */}
              <path d="M150 55 L250 55 C260 55, 260 125, 250 125 L150 125 Z" fill="none" stroke="#475569" strokeWidth="1.5" />
              <path d="M170 55 L210 55 L210 125 L170 125 Z" fill="none" stroke="#475569" strokeWidth="1.5" />
              
              {/* 1. Capot (Front section) */}
              <path 
                d="M100 55 L150 50 L150 130 L100 125 Z" 
                fill={checklist.capot ? 'rgba(239, 68, 68, 0.35)' : 'rgba(30, 41, 59, 0.2)'} 
                stroke={checklist.capot ? '#ef4444' : '#475569'} 
                strokeWidth={checklist.capot ? '2.5' : '1.5'} 
                className="cursor-pointer transition duration-150"
                onClick={() => toggleSector('capot')}
              />
              <text x="115" y="95" className="text-[9px] fill-slate-400 font-bold font-sans pointer-events-none">Capot</text>

              {/* 2. Paragolpes Delantero */}
              <path 
                d="M75 60 L100 55 L100 125 L75 120 Z" 
                fill={checklist.paragolpesDelantero ? 'rgba(239, 68, 68, 0.35)' : 'rgba(30, 41, 59, 0.2)'} 
                stroke={checklist.paragolpesDelantero ? '#ef4444' : '#475569'} 
                strokeWidth={checklist.paragolpesDelantero ? '2.5' : '1.5'} 
                className="cursor-pointer transition duration-150"
                onClick={() => toggleSector('paragolpesDelantero')}
              />
              <text x="80" y="95" className="text-[8px] fill-slate-400 font-bold font-sans rotate-90 origin-[80px_95px] pointer-events-none">Frontera</text>

              {/* 3. Puerta Izquierda (Top side of the 2D schematic representing Left side of car) */}
              <path 
                d="M150 45 L220 45 L220 55 L150 55 Z" 
                fill={checklist.puertaIzquierda ? 'rgba(239, 68, 68, 0.35)' : 'rgba(30, 41, 59, 0.2)'} 
                stroke={checklist.puertaIzquierda ? '#ef4444' : '#475569'} 
                strokeWidth={checklist.puertaIzquierda ? '2.5' : '1.5'} 
                className="cursor-pointer transition duration-150"
                onClick={() => toggleSector('puertaIzquierda')}
              />
              <text x="160" y="38" className="text-[7px] fill-slate-400 font-bold font-sans pointer-events-none">Pta. Izq.</text>

              {/* 4. Puerta Derecha (Bottom side of 2D schematic) */}
              <path 
                d="M150 125 L220 125 L220 135 L150 135 Z" 
                fill={checklist.puertaDerecha ? 'rgba(239, 68, 68, 0.35)' : 'rgba(30, 41, 59, 0.2)'} 
                stroke={checklist.puertaDerecha ? '#ef4444' : '#475569'} 
                strokeWidth={checklist.puertaDerecha ? '2.5' : '1.5'} 
                className="cursor-pointer transition duration-150"
                onClick={() => toggleSector('puertaDerecha')}
              />
              <text x="160" y="145" className="text-[7px] fill-slate-400 font-bold font-sans pointer-events-none">Pta. Der.</text>

              {/* 5. Techo (Roof central glass) */}
              <path 
                d="M180 65 L240 65 L240 115 L180 115 Z" 
                fill={checklist.techo ? 'rgba(239, 68, 68, 0.35)' : 'rgba(30, 41, 59, 0.2)'} 
                stroke={checklist.techo ? '#ef4444' : '#475569'} 
                strokeWidth={checklist.techo ? '2.5' : '1.5'} 
                className="cursor-pointer transition duration-150"
                onClick={() => toggleSector('techo')}
              />
              <text x="200" y="95" className="text-[9px] fill-slate-400 font-bold font-sans pointer-events-none">Techo</text>

              {/* 6. Paragolpes Trasero */}
              <path 
                d="M300 55 L325 60 L325 120 L300 125 Z" 
                fill={checklist.paragolpesTrasero ? 'rgba(239, 68, 68, 0.35)' : 'rgba(30, 41, 59, 0.2)'} 
                stroke={checklist.paragolpesTrasero ? '#ef4444' : '#475569'} 
                strokeWidth={checklist.paragolpesTrasero ? '2.5' : '1.5'} 
                className="cursor-pointer transition duration-150"
                onClick={() => toggleSector('paragolpesTrasero')}
              />
              <text x="305" y="95" className="text-[8px] fill-slate-400 font-bold font-sans rotate-270 origin-[305px_95px] pointer-events-none">Trasero</text>

              {/* Wheels (4 corners) */}
              {/* Front Left Wheel */}
              <rect 
                x="110" y="25" width="28" height="15" rx="3" 
                fill={checklist.llantas ? '#ef4444' : '#1e293b'} 
                stroke={checklist.llantas ? '#ef4444' : '#475569'} 
                className="cursor-pointer"
                onClick={() => toggleSector('llantas')} 
              />
              {/* Front Right Wheel */}
              <rect 
                x="110" y="140" width="28" height="15" rx="3" 
                fill={checklist.llantas ? '#ef4444' : '#1e293b'} 
                stroke={checklist.llantas ? '#ef4444' : '#475569'} 
                className="cursor-pointer"
                onClick={() => toggleSector('llantas')} 
              />
              {/* Rear Left Wheel */}
              <rect 
                x="260" y="25" width="28" height="15" rx="3" 
                fill={checklist.llantas ? '#ef4444' : '#1e293b'} 
                stroke={checklist.llantas ? '#ef4444' : '#475569'} 
                className="cursor-pointer"
                onClick={() => toggleSector('llantas')} 
              />
              {/* Rear Right Wheel */}
              <rect 
                x="260" y="140" width="28" height="15" rx="3" 
                fill={checklist.llantas ? '#ef4444' : '#1e293b'} 
                stroke={checklist.llantas ? '#ef4444' : '#475569'} 
                className="cursor-pointer"
                onClick={() => toggleSector('llantas')} 
              />

              {/* Indicator Texts for glass, tires, etc. */}
              <text x="345" y="45" className="text-[8px] fill-slate-500 font-semibold font-mono pointer-events-none">Marcadores:</text>
              <circle cx="350" cy="65" r="4" fill={checklist.vidrios ? '#ef4444' : '#334155'} className="cursor-pointer" onClick={() => toggleSector('vidrios')} />
              <text x="358" y="68" className="text-[7.5px] fill-slate-400 font-bold pointer-events-none">Vidrios</text>
              
              <circle cx="350" cy="85" r="4" fill={checklist.llantas ? '#ef4444' : '#334155'} className="cursor-pointer" onClick={() => toggleSector('llantas')} />
              <text x="358" y="88" className="text-[7.5px] fill-slate-400 font-bold pointer-events-none">Llantas</text>

              <circle cx="350" cy="105" r="4" fill={checklist.interior ? '#ef4444' : '#334155'} className="cursor-pointer" onClick={() => toggleSector('interior')} />
              <text x="358" y="108" className="text-[7.5px] fill-slate-400 font-bold pointer-events-none">Interior</text>
            </svg>

            {/* Badge overlay status of defects */}
            <div className="absolute top-2 left-2 flex gap-1.5">
              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                countDanos > 0 ? 'bg-red-950/80 text-red-400 border border-red-900/40 animate-pulse' : 'bg-emerald-950/80 text-emerald-400 border border-emerald-900/40'
              }`}>
                {countDanos === 0 ? 'Sin daños declarados' : `${countDanos} Defecto(s) Registrado(s)`}
              </span>
            </div>
          </div>

          {/* Checklist textual toggles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(Object.keys(DEFAULT_DAMAGE_CHECKLIST) as Array<keyof DamageChecklist>).map((key) => (
              <button
                key={key}
                type="button"
                disabled={!isEditMode}
                onClick={() => toggleSector(key)}
                className={`p-2 rounded-lg border text-left transition flex items-center justify-between ${
                  checklist[key]
                    ? 'bg-red-950/30 border-red-500/40 text-red-200'
                    : 'bg-[#030406]/50 border-white/[0.04] text-slate-400 hover:border-white/[0.08] hover:text-slate-300'
                }`}
              >
                <span className="text-[10px] font-bold truncate">{getSectorLabel(key)}</span>
                <span className={`w-2 h-2 rounded-full ${checklist[key] ? 'bg-red-500 animate-ping' : 'bg-slate-700'}`} />
              </button>
            ))}
          </div>

          {/* Dirt Level Gauge Slider */}
          <div className="glass-panel p-4 rounded-xl border border-white/[0.06] space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                2. Nivel de Suciedad del Vehículo
              </span>
              <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                nivelSuciedad === 'BAJO' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                nivelSuciedad === 'MEDIO' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                nivelSuciedad === 'ALTO' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                'bg-red-500/15 text-red-400 border border-red-500/30 animate-pulse'
              }`}>
                {nivelSuciedad}
              </span>
            </div>

            {isEditMode ? (
              <div className="flex gap-1">
                {(['BAJO', 'MEDIO', 'ALTO', 'EXTREMO'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setNivelSuciedad(lvl)}
                    className={`flex-1 py-1.5 text-[9px] font-bold uppercase rounded-lg border transition ${
                      nivelSuciedad === lvl
                        ? 'bg-brand-primary/10 border-brand-primary text-brand-primary'
                        : 'bg-[#030406] border-white/[0.04] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            ) : (
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${
                    nivelSuciedad === 'BAJO' ? 'bg-emerald-400 w-1/4' :
                    nivelSuciedad === 'MEDIO' ? 'bg-amber-400 w-2/4' :
                    nivelSuciedad === 'ALTO' ? 'bg-orange-400 w-3/4' : 'bg-red-500 w-full animate-pulse'
                  }`}
                />
              </div>
            )}
            <p className="text-[9px] text-slate-500 leading-normal italic">
              {nivelSuciedad === 'BAJO' && '"El auto solo tiene polvillo superficial o marcas leves de agua de lluvia."'}
              {nivelSuciedad === 'MEDIO' && '"Tránsito normal cotidiano. Tierra asentada, insectos pegados en trompa y suciedad en guardabarros."'}
              {nivelSuciedad === 'ALTO' && '"Suciedad severa. Barro acumulado, llantas con hollín denso de freno y restos orgánicos en exterior."'}
              {nivelSuciedad === 'EXTREMO' && '"Estado crítico. Capas endurecidas de barro, tapizados con derrames graves u olores persistentes."'}
            </p>
          </div>

        </div>

        {/* Right column: Photos, observations and action controls */}
        <div className="md:col-span-5 space-y-4 flex flex-col justify-between">
          
          <div className="space-y-4">
            {/* Real reception photo roll */}
            <div>
              <h5 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-slate-500" />
                3. Fotos de Respaldo de Recepción
              </h5>
              {isEditMode && (
                <label className="mb-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-brand-primary/35 bg-brand-primary/5 px-3 py-2 text-[10px] font-bold text-brand-primary transition hover:bg-brand-primary/10">
                  <Camera className="h-4 w-4" />
                  Tomar o adjuntar fotos reales
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={handlePhotoSelection}
                    className="sr-only"
                  />
                </label>
              )}
              {photoError && <p role="alert" className="mb-2 text-[10px] text-red-400">{photoError}</p>}
              
              <div className="space-y-2">
                {fotos.length === 0 ? (
                  <div className="bg-[#030406]/40 border border-dashed border-white/[0.08] p-6 rounded-xl text-center flex flex-col items-center justify-center gap-2">
                    <Camera className="w-6 h-6 text-slate-600" />
                    <span className="text-[10px] text-slate-500">Todavía no se adjuntaron fotos de recepción.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin">
                    {fotos.map((f, idx) => (
                      <div key={idx} className="relative group bg-neutral-900 border border-white/[0.04] rounded-lg overflow-hidden h-20">
                        <img 
                          src={f.url} 
                          alt={f.sector} 
                          className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-1.5 flex flex-col justify-end text-left">
                          <span className="text-[7.5px] font-bold text-red-400 uppercase tracking-wide block">{f.sector}</span>
                          <span className="text-[6.5px] text-slate-300 truncate">{f.descripcion}</span>
                        </div>
                        {isEditMode && (
                          <button
                            type="button"
                            onClick={() => setFotos(current => current.filter((_, photoIndex) => photoIndex !== idx))}
                            aria-label={`Eliminar foto ${idx + 1}`}
                            className="absolute right-1 top-1 rounded bg-black/70 p-1 text-white transition hover:bg-red-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Structured Observations */}
            <div className="space-y-1.5">
              <label className="block text-[10px] text-slate-400 uppercase tracking-wider">4. Observaciones del Recibidor</label>
              {isEditMode ? (
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Detalles adicionales, pertenencias de valor declaradas en habitáculo, fallas eléctricas pre-existentes, etc."
                  rows={4}
                  className="w-full bg-[#030406] border border-white/[0.08] focus:outline-none focus:border-red-500/40 rounded-lg px-2.5 py-2 text-xs text-slate-200 resize-none font-sans"
                />
              ) : (
                <div className="bg-[#030406]/60 border border-white/[0.05] p-3 rounded-lg text-xs text-slate-300 italic min-h-[80px]">
                  {observaciones ? `"${observaciones}"` : 'Sin observaciones adicionales registradas para este peritaje.'}
                </div>
              )}
            </div>

            {/* Inspector Staff badge */}
            <div className="flex items-center justify-between text-[10px] bg-white/[0.01] border border-white/[0.04] p-2.5 rounded-lg">
              <span className="text-slate-500">Inspector Responsable:</span>
              {isEditMode ? (
                <input 
                  type="text"
                  value={inspector}
                  onChange={(e) => setInspector(e.target.value)}
                  className="bg-transparent text-right text-white font-bold text-[10px] border-b border-white/10 focus:outline-none focus:border-red-500/50 w-28"
                />
              ) : (
                <span className="text-slate-200 font-bold">{inspector}</span>
              )}
            </div>
          </div>

          {/* Form Action Controls */}
          <div className="flex gap-2 pt-2 border-t border-white/[0.06]">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 font-semibold py-1.5 rounded-lg text-xs transition cursor-pointer"
              >
                Cerrar
              </button>
            )}
            <button
              type="button"
              onClick={() => generateInspectionPDF({
                patente,
                modelo,
                inspector,
                checklistDanos: checklist,
                observaciones,
                fecha: new Date().toISOString()
              })}
              className="flex-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-200 font-extrabold py-1.5 rounded-lg text-xs uppercase tracking-wider transition flex items-center justify-center gap-1 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF Reporte</span>
            </button>
            {isEditMode && onSave && (
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 bg-brand-primary text-white font-extrabold py-1.5 rounded-lg text-xs uppercase tracking-wider transition-all shadow-md hover:opacity-90 cursor-pointer"
              >
                Vincular Inspección
              </button>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
