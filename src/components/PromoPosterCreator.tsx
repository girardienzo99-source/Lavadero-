import React, { useState } from 'react';
import { Sparkles, Share2, Download, Car, Gift, Flame, Droplet, Shield, Check, AlertCircle } from 'lucide-react';
import { TemplatePublicidad, TipoServicio } from '../types';
import { INITIAL_TEMPLATES } from '../data/initialData';
import html2canvas from 'html2canvas';

interface PromoPosterCreatorProps {
  onAddPromotionToConsole: (text: string) => void;
}

export default function PromoPosterCreator({ onAddPromotionToConsole }: PromoPosterCreatorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplatePublicidad>(INITIAL_TEMPLATES[0]);
  const [title, setTitle] = useState(selectedTemplate.titulo);
  const [subTitle, setSubTitle] = useState(selectedTemplate.subtitulo);
  const [discount, setDiscount] = useState(selectedTemplate.descuento);
  const [serviceType, setServiceType] = useState<TipoServicio>(selectedTemplate.servicio);
  
  // Custom design states
  const [bgGradient, setBgGradient] = useState('from-amber-600 to-red-600');
  const [textColor, setTextColor] = useState('text-white');
  const [badgeColor, setBadgeColor] = useState('bg-yellow-400 text-slate-900');
  const [selectedIcon, setSelectedIcon] = useState('Sparkles');
  const [shareStatus, setShareStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const gradients = [
    { name: 'Fuego Intenso (Estética)', value: 'from-amber-600 to-red-600', badge: 'bg-yellow-400 text-slate-900', text: 'text-white' },
    { name: 'Océano Profundo (Tapicería)', value: 'from-blue-600 to-indigo-700', badge: 'bg-cyan-300 text-slate-900', text: 'text-white' },
    { name: 'Bosque Fresco (Lavado)', value: 'from-emerald-600 to-teal-700', badge: 'bg-lime-300 text-slate-900', text: 'text-white' },
    { name: 'Cyberpunk Neon', value: 'from-fuchsia-600 to-purple-800', badge: 'bg-green-300 text-slate-900', text: 'text-white' },
    { name: 'Carbono Premium (Detalle)', value: 'from-neutral-800 to-neutral-950', badge: 'bg-amber-400 text-slate-900', text: 'text-white' },
  ];

  const handleApplyTemplate = (temp: TemplatePublicidad) => {
    setSelectedTemplate(temp);
    setTitle(temp.titulo);
    setSubTitle(temp.subtitulo);
    setDiscount(temp.descuento);
    setServiceType(temp.servicio);
    
    const matchedGradient = gradients.find(g => g.value.includes(temp.colorFondo.split(' ')[0]));
    if (matchedGradient) {
      setBgGradient(matchedGradient.value);
      setBadgeColor(matchedGradient.badge);
      setTextColor(matchedGradient.text);
    } else {
      setBgGradient(temp.colorFondo);
    }
    setSelectedIcon(temp.imagenIcono);
  };

  const handleDownload = () => {
    const element = document.getElementById('flyer-card-preview');
    if (!element) return;
    
    // Temporarily apply a slight shadow class or prepare element for clean snapshot
    html2canvas(element, {
      scale: 2, // 2x scale for high resolution
      useCORS: true,
      backgroundColor: null
    }).then((canvas) => {
      const link = document.createElement('a');
      link.download = `promo_${serviceType.toLowerCase()}_${discount}off.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      const message = `📥 Flyer promocional generado con éxito: "${title}" (${discount}% OFF para ${serviceType}). Archivo guardado como 'promo_${serviceType.toLowerCase()}_${discount}off.png'.`;
      onAddPromotionToConsole(message);
    }).catch((err) => {
      console.error('Error generating image', err);
      const message = '⚠️ No se pudo generar la imagen del flyer.';
      onAddPromotionToConsole(message);
    });
  };

  const handlePrepareCampaign = async () => {
    setShareStatus(null);
    if (!title.trim() || discount < 1 || discount > 90) {
      setShareStatus({ type: 'error', message: 'Completá un título y un descuento válido antes de preparar el texto.' });
      return;
    }

    const caption = `${title.trim()} — ${discount}% OFF. ${subTitle.trim()} Consultá disponibilidad y condiciones con Albelo Detail.`;
    try {
      await navigator.clipboard.writeText(caption);
      setShareStatus({ type: 'success', message: 'Texto copiado. Publicalo manualmente junto con el flyer descargado.' });
      onAddPromotionToConsole(`📋 [MARKETING] Texto de campaña preparado para ${serviceType}. No fue publicado automáticamente.`);
    } catch (error) {
      console.error('Could not copy campaign text', error);
      setShareStatus({ type: 'error', message: 'No se pudo copiar el texto. Revisá los permisos del portapapeles.' });
    }
  };

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'Sparkles': return <Sparkles className="w-8 h-8" />;
      case 'SprayCan': return <Gift className="w-8 h-8" />; // substitute
      case 'Car': return <Car className="w-8 h-8" />;
      case 'Flame': return <Flame className="w-8 h-8" />;
      case 'Droplet': return <Droplet className="w-8 h-8" />;
      case 'Shield': return <Shield className="w-8 h-8" />;
      default: return <Sparkles className="w-8 h-8" />;
    }
  };

  return (
    <div id="promo-maker-section" className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-20">
      {/* Editor Controls */}
      <div className="lg:col-span-5 space-y-5 flex flex-col justify-between">
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Paso 1: Seleccionar Plantilla Rápida</h3>
            <div className="grid grid-cols-3 gap-2">
              {INITIAL_TEMPLATES.map((temp) => (
                <button
                  key={temp.id}
                  id={`btn-template-${temp.id}`}
                  onClick={() => handleApplyTemplate(temp)}
                  className={`p-2.5 text-left rounded-lg text-xs font-semibold border transition duration-200 ${
                    selectedTemplate.id === temp.id
                      ? 'border-[#00d2ff]/50 bg-white/[0.03] text-[#00d2ff] shadow-[0_0_15px_rgba(0,210,255,0.05)]'
                      : 'border-white/[0.06] bg-white/[0.01] text-slate-400 hover:border-white/[0.12] hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold truncate">{temp.titulo}</div>
                  <div className="text-[10px] text-slate-500 truncate">{temp.subtitulo}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-white/[0.08] pt-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Paso 2: Personalizar Textos y Descuento</h3>
            
            <div>
              <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Título de la Promoción</label>
              <input
                id="input-promo-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-white/[0.02] border border-white/[0.08] focus:border-[#00d2ff]/50 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                placeholder="Ej. SUPER COMBO ESTÉTICO"
              />
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Subtítulo / Servicios Incluidos</label>
              <input
                id="input-promo-subtitle"
                type="text"
                value={subTitle}
                onChange={(e) => setSubTitle(e.target.value)}
                className="w-full bg-white/[0.02] border border-white/[0.08] focus:border-[#00d2ff]/50 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                placeholder="Ej. Pulido de ópticas + Encerado"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Porcentaje de Descuento</label>
                <div className="relative">
                  <input
                    id="input-promo-discount"
                    type="number"
                    min="5"
                    max="90"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="w-full bg-white/[0.02] border border-white/[0.08] focus:border-[#00d2ff]/50 focus:outline-none rounded-lg pl-3 pr-8 py-2 text-xs text-white font-mono font-bold"
                  />
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400 text-xs font-bold">%</div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Categoría Principal</label>
                <select
                  id="select-promo-category"
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value as TipoServicio)}
                  className="w-full bg-[#06080a] border border-white/[0.08] focus:border-[#00d2ff]/50 focus:outline-none rounded-lg px-2 py-2 text-xs text-white font-semibold"
                >
                  <option value="LAVADO" className="bg-[#0c0f12]">Lavados</option>
                  <option value="TAPICERIA" className="bg-[#0c0f12]">Tapicería</option>
                  <option value="ESTETICA" className="bg-[#0c0f12]">Reparación Estética</option>
                </select>
              </div>
            </div>
          </div>

          <div className="border-t border-white/[0.08] pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Paso 3: Estilo y Paleta de Colores</h3>
            <div className="grid grid-cols-2 gap-2">
              {gradients.map((g, idx) => (
                <button
                  key={idx}
                  id={`btn-color-${idx}`}
                  onClick={() => {
                    setBgGradient(g.value);
                    setBadgeColor(g.badge);
                    setTextColor(g.text);
                  }}
                  className={`flex items-center gap-2 p-1.5 rounded-lg border text-left text-xs transition ${
                    bgGradient === g.value
                      ? 'border-[#00d2ff]/50 bg-white/[0.03]'
                      : 'border-white/[0.06] hover:border-white/[0.12] bg-white/[0.01]'
                  }`}
                >
                  <span className={`w-4 h-4 rounded bg-gradient-to-br ${g.value} shrink-0`} />
                  <span className="text-[10px] text-slate-300 font-semibold truncate">{g.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Seleccionar Ícono de flyer</h3>
            <div className="flex gap-2.5">
              {['Sparkles', 'Car', 'Flame', 'Droplet', 'Shield'].map((icName) => (
                <button
                  key={icName}
                  id={`btn-icon-${icName}`}
                  onClick={() => setSelectedIcon(icName)}
                  className={`p-2 rounded-lg border transition ${
                    selectedIcon === icName
                      ? 'border-[#00d2ff]/50 bg-white/[0.03] text-[#00d2ff]'
                      : 'border-white/[0.06] hover:border-white/[0.12] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {renderIcon(icName)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-4 space-y-3">
          {shareStatus && (
            <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-[10px] ${shareStatus.type === 'success' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200' : 'border-red-500/25 bg-red-500/10 text-red-200'}`} role={shareStatus.type === 'error' ? 'alert' : 'status'}>
              {shareStatus.type === 'success' ? <Check className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
              <span>{shareStatus.message}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
          <button
            id="btn-download-flyer"
            onClick={handleDownload}
            className="flex items-center justify-center gap-2 bg-white/[0.02] hover:bg-white/[0.08] border border-white/[0.08] text-white font-bold py-2 px-3 rounded-lg text-xs transition duration-200 cursor-pointer"
          >
            <Download className="w-4 h-4 text-red-500" />
            Descargar Flyer
          </button>
          <button
            id="btn-publish-campaign"
            onClick={handlePrepareCampaign}
            className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition duration-200 shadow-[0_0_15px_rgba(220,38,38,0.25)] cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            Copiar Texto
          </button>
          </div>
          <p className="text-[9px] text-slate-500 text-center">Esta herramienta diseña y exporta contenido; no publica en redes ni crea cupones automáticamente.</p>
        </div>
      </div>

      {/* Render Preview Visual */}
      <div className="lg:col-span-7 flex flex-col justify-center items-center bg-black/40 rounded-xl p-6 border border-red-500/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        <span className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-4">VISTA PREVIA DEL FLYER PUBLICITARIO</span>
        
        {/* Flyer Canvas representation */}
        <div 
          id="flyer-card-preview"
          className={`w-full max-w-[340px] aspect-[4/5] rounded-2xl bg-gradient-to-b ${bgGradient} p-6 flex flex-col justify-between shadow-[0_20px_50px_rgba(0,0,0,0.6)] relative overflow-hidden transition-all duration-300 transform hover:scale-[1.02] border border-white/10`}
        >
          {/* Decorative mesh bg styling */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none opacity-40" />
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-red-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-black/40 rounded-full blur-2xl pointer-events-none" />

          {/* Top Row: Brand & Icon */}
          <div className="flex justify-between items-start relative z-10">
            <div className="flex items-center gap-1.5">
              {/* Simplified Albelo Logo */}
              <div className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center font-extrabold text-[10px] tracking-tighter text-white bg-black/40">
                A
              </div>
              <span className="text-[11px] font-black tracking-widest text-white font-display uppercase">ALBELO DETAIL</span>
            </div>
            <div className="p-2 rounded-xl bg-black/30 backdrop-blur-sm border border-white/10 text-white">
              {renderIcon(selectedIcon)}
            </div>
          </div>

          {/* Middle Body */}
          <div className="my-auto space-y-2 relative z-10">
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-600/20 text-red-200 text-[8px] font-black tracking-widest uppercase backdrop-blur-sm border border-red-500/20">
              <Sparkles className="w-2.5 h-2.5 text-red-400 animate-pulse" />
              {serviceType === 'LAVADO' ? 'Lavado Profesional' : serviceType === 'TAPICERIA' ? 'Tapicería y Limpieza' : 'Reparación Estética'}
            </div>
            
            <h2 className="text-xl font-black tracking-tight text-white leading-tight font-display uppercase break-words drop-shadow-md">
              {title || 'TÍTULO INCREÍBLE'}
            </h2>
            
            <p className="text-white/80 text-[10px] font-medium tracking-wide leading-relaxed truncate-3-lines">
              {subTitle || 'Ingresa una descripción de tus servicios en los controles de la izquierda.'}
            </p>
          </div>

          {/* Footer: Discount Badge & CTA */}
          <div className="border-t border-white/15 pt-4 flex justify-between items-center relative z-10">
            <div className="flex flex-col">
              <span className="text-[8px] text-white/60 uppercase tracking-widest font-black">Descuento Especial</span>
              <div className="flex items-baseline gap-0.5">
                <span className="text-3xl font-black tracking-tighter text-white font-display">{discount}%</span>
                <span className="text-lg font-black text-white">OFF</span>
              </div>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-[8px] text-white/60 uppercase tracking-widest font-black">¡Reserva Hoy!</span>
              <span className="text-[10px] font-black bg-white text-black px-3 py-1 rounded-md shadow-md font-display mt-0.5 uppercase tracking-wider">
                Cupos Limitados
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-1.5 text-[10px] text-slate-400 bg-white/[0.01] px-3 py-1.5 rounded-lg border border-white/[0.06] font-semibold">
          <Share2 className="w-3.5 h-3.5 text-red-500" />
          <span>Formatos listos para <b className="text-slate-300">Instagram Story</b> y <b className="text-slate-300">Estados de WhatsApp</b></span>
        </div>
      </div>
    </div>
  );
}
