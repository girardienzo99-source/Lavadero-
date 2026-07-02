import React, { useState } from 'react';
import { 
  Sparkles, Car, Percent, Calendar, ShieldCheck, Heart, 
  MapPin, Phone, MessageSquare, Plus, Trash2, Edit3, CheckCircle, Gift,
  Zap, ArrowRight, Eye, Star, Info, ShoppingCart, Check
} from 'lucide-react';
import { TipoServicio, Turno } from '../types';

function DetailingSimulationWidget() {
  const [activeCategory, setActiveCategory] = useState<'opticas' | 'laca' | 'tapizados'>('laca');
  const [sliderPosition, setSliderPosition] = useState(50); // percentage

  const categories = {
    opticas: {
      title: 'Pulido de Ópticas',
      beforeLabel: 'Opacas / Amarillentas',
      afterLabel: 'Cristalinas con Sellado UV',
      description: 'Lijado al agua en 3 pasos, pulido de corte pesado y abrillantado + laca selladora de alta dureza con filtro solar.',
      beforeBg: 'bg-gradient-to-r from-yellow-700/40 to-yellow-600/30 blur-sm border border-yellow-600/40',
      afterBg: 'bg-gradient-to-r from-cyan-400/30 to-sky-400/40 shadow-[0_0_20px_rgba(56,189,248,0.5)] border border-sky-400',
    },
    laca: {
      title: 'Corrección de Pintura 3 Pasos',
      beforeLabel: 'Swirls / Micro-Rayas',
      afterLabel: 'Brillo Espejo Gyeon 9H',
      description: 'Eliminación del 90% de defectos de laca con compuestos Menzerna y pulidoras rotativas y roto-orbitales Rupes.',
      beforeBg: 'bg-gradient-to-r from-neutral-800 to-neutral-700 relative overflow-hidden',
      afterBg: 'bg-gradient-to-r from-red-600 to-red-900 shadow-[0_0_25px_rgba(239,68,68,0.4)] border border-red-500',
    },
    tapizados: {
      title: 'Limpieza de Interiores Kärcher',
      beforeLabel: 'Manchado y Suciedad',
      afterLabel: 'Limpio y Desinfectado',
      description: 'Lavado con inyección de vapor caliente y extracción a presión profunda para remover grasa, transpiración y malos olores.',
      beforeBg: 'bg-gradient-to-r from-amber-950/40 to-yellow-950/40 border border-yellow-900/20',
      afterBg: 'bg-gradient-to-r from-emerald-950/40 to-teal-950/40 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]',
    }
  };

  const current = categories[activeCategory];

  return (
    <div className="space-y-4">
      {/* Category Toggles */}
      <div className="flex gap-2 justify-center">
        {(Object.keys(categories) as Array<keyof typeof categories>).map((cat) => (
          <button
            key={cat}
            id={`btn-sim-${cat}`}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition ${
              activeCategory === cat
                ? 'bg-red-600 text-white border border-red-500 shadow-[0_0_12px_rgba(220,38,38,0.3)]'
                : 'bg-white/[0.02] text-slate-400 hover:text-slate-200 border border-white/[0.05]'
            }`}
          >
            {categories[cat].title}
          </button>
        ))}
      </div>

      {/* Interactive Visual Slider Box */}
      <div className="relative w-full h-64 md:h-80 rounded-xl overflow-hidden border border-white/[0.08] select-none bg-neutral-950">
        
        {/* BEFORE CONTAINER (Left side, covers full background) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
          {/* Abstract background representation for Before state */}
          <div className={`absolute inset-0 opacity-40 ${current.beforeBg}`} />
          
          <div className="relative z-10 space-y-2 pointer-events-none">
            <span className="bg-black/60 text-yellow-500 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-widest border border-yellow-600/30">
              {current.beforeLabel}
            </span>
            {activeCategory === 'laca' && (
              <div className="w-16 h-16 mx-auto border-2 border-dashed border-white/20 rounded-full animate-pulse flex items-center justify-center">
                <span className="text-[10px] text-white/40">Swirls</span>
              </div>
            )}
            {activeCategory === 'opticas' && (
              <div className="w-24 h-12 mx-auto bg-yellow-500/15 rounded-full blur-sm border border-yellow-600/30" />
            )}
            {activeCategory === 'tapizados' && (
              <div className="w-16 h-16 mx-auto bg-stone-700/30 rounded-lg flex items-center justify-center text-[10px] text-stone-500">
                Manchas
              </div>
            )}
          </div>
        </div>

        {/* AFTER CONTAINER (Right side, clipped based on slider) */}
        <div 
          className="absolute inset-y-0 right-0 overflow-hidden"
          style={{ left: `${sliderPosition}%` }}
        >
          {/* We must render a container of 100% width aligned to the right to keep content centered or matching */}
          <div 
            className="absolute inset-0 h-full flex flex-col items-center justify-center p-6 text-center"
            style={{ width: '100%', right: 0, left: `-${sliderPosition}%` }}
          >
            {/* Abstract background representation for After state */}
            <div className={`absolute inset-0 ${current.afterBg}`} />
            
            <div className="relative z-10 space-y-2 pointer-events-none">
              <span className="bg-red-600 text-white px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest shadow-[0_0_10px_rgba(239,68,68,0.5)]">
                {current.afterLabel}
              </span>
              {activeCategory === 'laca' && (
                <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-white/30 to-transparent animate-pulse shadow-[0_0_30px_rgba(255,255,255,0.6)] flex items-center justify-center border border-white/40">
                  <span className="text-[9px] text-white font-bold uppercase tracking-wider">Espejo</span>
                </div>
              )}
              {activeCategory === 'opticas' && (
                <div className="w-24 h-12 mx-auto bg-cyan-400/20 rounded-full border-2 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.6)]" />
              )}
              {activeCategory === 'tapizados' && (
                <div className="w-16 h-16 mx-auto bg-emerald-500/20 border border-emerald-400 rounded-lg flex items-center justify-center text-[10px] text-emerald-400 font-bold shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                  Nuevo
                </div>
              )}
            </div>
          </div>
        </div>

        {/* DRAG HANDLE BAR */}
        <div 
          className="absolute inset-y-0 w-1 bg-white hover:bg-red-500 transition-colors cursor-ew-resize z-20 flex items-center justify-center shadow-[0_0_10px_rgba(255,255,255,0.5)]"
          style={{ left: `${sliderPosition}%` }}
        >
          <div className="w-7 h-7 bg-white text-black rounded-full shadow-lg flex items-center justify-center text-xs font-black select-none pointer-events-none border border-neutral-300">
            ⇄
          </div>
        </div>

        {/* INPUT RANGE OVERLAY */}
        <input 
          type="range" 
          min="0" 
          max="100" 
          value={sliderPosition}
          onChange={(e) => setSliderPosition(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-30"
        />

      </div>

      {/* Description text */}
      <p className="text-[11px] text-slate-400 text-center leading-relaxed max-w-xl mx-auto italic">
        "{current.description}"
      </p>
    </div>
  );
}

export interface PromocionTienda {
  id: string;
  titulo: string;
  subtitulo: string;
  servicio: TipoServicio;
  precioOriginal: number;
  descuentoPorcentaje: number;
  precioOferta: number;
  activa: boolean;
  caracteristicas: string[];
  etiqueta?: string;
  tiempoEstimado: string;
}

interface PublicPageProps {
  onAddTurno: (newT: Turno) => void;
  onAddLog: (msg: string) => void;
  initialTurnos: Turno[];
}

export default function PublicPage({
  onAddTurno,
  onAddLog,
  initialTurnos
}: PublicPageProps) {
  // View mode switcher: 'LANDING' (Client facing store) or 'PROMO_ADMIN' (Admin Promo Management)
  const [viewMode, setViewMode] = useState<'landing' | 'admin'>('landing');

  // Interactive Digital Store Promotions State
  const [promociones, setPromociones] = useState<PromocionTienda[]>([
    {
      id: 'p1',
      titulo: 'Polarizado Premium Americano',
      subtitulo: 'Láminas Importadas con Filtro UV 99% + Garantía Escrita',
      servicio: 'ESTETICA',
      precioOriginal: 85000,
      descuentoPorcentaje: 15,
      precioOferta: 72250,
      activa: true,
      caracteristicas: [
        'Lámina americana original de alta densidad térmica',
        'Filtro UV total del 99% y óptima privacidad',
        'Garantía de por vida contra decoloración o burbujas',
        'Incremento de seguridad anti-vandalismo en cristales'
      ],
      etiqueta: 'Recomendado ⭐',
      tiempoEstimado: '3 hs'
    },
    {
      id: 'p2',
      titulo: 'Tratamiento Cerámico Extremo SiO2',
      subtitulo: 'Corrección de Barniz + Sellador Cerámico Gyeon (Brillo Espejo)',
      servicio: 'ESTETICA',
      precioOriginal: 280000,
      descuentoPorcentaje: 20,
      precioOferta: 224000,
      activa: true,
      caracteristicas: [
        'Descontaminado físico y químico profundo de laca',
        'Corrección de pintura en 2 pasos (elimina marcas y telas de araña)',
        'Aplicación de Sellador Cerámico Premium de larga duración (3 años)',
        'Brillo extremo efecto espejo y repelencia hidrofóbica total'
      ],
      etiqueta: 'Tratamiento VIP ✨',
      tiempoEstimado: '12 hs (De un día para otro)'
    },
    {
      id: 'p3',
      titulo: 'Chau Manchas y Olores (Tapizados)',
      subtitulo: 'Limpieza con Inyección y Extracción de Vapor Húmedo Kärcher',
      servicio: 'TAPICERIA',
      precioOriginal: 95000,
      descuentoPorcentaje: 15,
      precioOferta: 80750,
      activa: true,
      caracteristicas: [
        'Extracción profunda de suciedad y manchas rebeldes',
        'Lavado técnico de techo, torpedo, paneles de puertas y alfombras',
        'Desinfección completa con vapor e insumos importados',
        'Sanitizado con ozono para eliminar olores y bacterias de raíz'
      ],
      etiqueta: 'Renovación Interior 🍃',
      tiempoEstimado: '4 hs'
    },
    {
      id: 'p4',
      titulo: 'Lavado Técnico de Motor Detallado',
      subtitulo: 'Desengrasado Dieléctrico Seguro + Acondicionado de Plásticos',
      servicio: 'LAVADO',
      precioOriginal: 48000,
      descuentoPorcentaje: 18,
      precioOferta: 39360,
      activa: true,
      caracteristicas: [
        'Lavado de motor manual con soplado e insumos dieléctricos',
        'Limpieza de marcos, capot inferior e insonorizador',
        'Nutrición protectora de plásticos y mangueras con coating satinado',
        'Detallado artesanal de pasarruedas de alta duración'
      ],
      etiqueta: 'Detalle Técnico ⚙️',
      tiempoEstimado: '2.5 hs'
    }
  ]);

  // Client booking Form state
  const [bookingName, setBookingName] = useState('');
  const [bookingPhone, setBookingPhone] = useState('');
  const [bookingPatente, setBookingPatente] = useState('');
  const [bookingModelo, setBookingModelo] = useState('');
  const [selectedPromoId, setSelectedPromoId] = useState(promociones[0]?.id || '');
  const [bookingFecha, setBookingFecha] = useState('2026-07-03');
  const [bookingHora, setBookingHora] = useState('09:00');
  const [bookingCompleted, setBookingCompleted] = useState(false);
  const [lastBookedTurnoId, setLastBookedTurnoId] = useState('');

  // Admin New Promo state
  const [newPromoTitulo, setNewPromoTitulo] = useState('');
  const [newPromoSubtitulo, setNewPromoSubtitulo] = useState('');
  const [newPromoServicio, setNewPromoServicio] = useState<TipoServicio>('LAVADO');
  const [newPromoPrecioOrig, setNewPromoPrecioOrig] = useState('');
  const [newPromoDescuento, setNewPromoDescuento] = useState('15');
  const [newPromoCaracteristicas, setNewPromoCaracteristicas] = useState('');
  const [newPromoEtiqueta, setNewPromoEtiqueta] = useState('');
  const [newPromoTiempo, setNewPromoTiempo] = useState('1.5 hs');

  // Handle client online reservation simulation
  const handleClientBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingName || !bookingPatente || !bookingPhone) return;

    const chosenPromo = promociones.find((p) => p.id === selectedPromoId);
    if (!chosenPromo) return;

    const newTurnoId = `t_pub_${Date.now()}`;
    const newTurno: Turno = {
      id: newTurnoId,
      clienteId: `c_pub_${Date.now()}`,
      clienteNombre: bookingName,
      telefono: bookingPhone,
      vehiculoPatente: bookingPatente.toUpperCase(),
      vehiculoModelo: bookingModelo || 'Vehículo Cliente Online',
      tipo: chosenPromo.servicio,
      servicioNombre: `PROMO: ${chosenPromo.titulo}`,
      lavadorAsignado: 'Sin Asignar (Online)',
      estado: 'PENDIENTE',
      precio: chosenPromo.precioOferta,
      fechaCreacion: new Date().toISOString(),
      comentarios: `Reserva Online de Tienda Digital para el día ${bookingFecha} a las ${bookingHora}. Pago pendiente.`
    };

    onAddTurno(newTurno);
    setLastBookedTurnoId(newTurnoId);
    setBookingCompleted(true);
    
    onAddLog(`📲 [TIENDA DIGITAL] Nueva reserva recibida online: ${bookingName} (${bookingPatente.toUpperCase()}) solicitó "${chosenPromo.titulo}" para el ${bookingFecha} a las ${bookingHora}.`);
  };

  // Add custom promotion (Admin panel)
  const handleAddPromotion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromoTitulo || !newPromoPrecioOrig) return;

    const orig = Number(newPromoPrecioOrig);
    const desc = Number(newPromoDescuento);
    const oferta = Math.round(orig * (1 - desc / 100));

    const chars = newPromoCaracteristicas
      ? newPromoCaracteristicas.split(',').map((c) => c.trim())
      : ['Servicio de lavado artesanal premium', 'Insumos importados biodegradables'];

    const newPromo: PromocionTienda = {
      id: `p_new_${Date.now()}`,
      titulo: newPromoTitulo,
      subtitulo: newPromoSubtitulo || 'Promoción Especial de Lavadero',
      servicio: newPromoServicio,
      precioOriginal: orig,
      descuentoPorcentaje: desc,
      precioOferta: oferta,
      activa: true,
      caracteristicas: chars,
      etiqueta: newPromoEtiqueta || undefined,
      tiempoEstimado: newPromoTiempo || '1 hs'
    };

    setPromociones((prev) => [...prev, newPromo]);
    onAddLog(`📢 [PROMO] Nueva promoción creada y publicada: "${newPromoTitulo}" (${desc}% OFF - Precio Final: $${oferta} ARS).`);
    
    // Reset admin form
    setNewPromoTitulo('');
    setNewPromoSubtitulo('');
    setNewPromoPrecioOrig('');
    setNewPromoDescuento('15');
    setNewPromoCaracteristicas('');
    setNewPromoEtiqueta('');
    setNewPromoTiempo('1.5 hs');
    setViewMode('landing');
  };

  const handleDeletePromo = (id: string) => {
    setPromociones((prev) => prev.filter((p) => p.id !== id));
    onAddLog(`🗑️ [PROMO] Promoción dada de baja de la Tienda Digital (ID: ${id}).`);
  };

  const handleTogglePromoStatus = (id: string) => {
    setPromociones((prev) =>
      prev.map((p) => (p.id === id ? { ...p, activa: !p.activa } : p))
    );
    const current = promociones.find(p => p.id === id);
    if (current) {
      onAddLog(`🔄 [PROMO] Promoción "${current.titulo}" ${!current.activa ? 'ACTIVADA' : 'DESACTIVADA'} de la tienda pública.`);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Control to toggle Client view / Admin manager */}
      <div className="flex justify-between items-center bg-white/[0.01] p-3 rounded-xl border border-red-500/[0.12] relative z-30 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
          <span className="text-xs font-bold uppercase text-slate-300">Consola Albelo Detail:</span>
        </div>

        <div className="flex items-center gap-2 bg-black/40 p-1 rounded-lg border border-white/[0.08]">
          <button
            onClick={() => {
              setViewMode('landing');
              setBookingCompleted(false);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              viewMode === 'landing'
                ? 'bg-red-600/20 text-red-500 border border-red-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Ver Portal de Clientes (Público)
          </button>
          <button
            onClick={() => setViewMode('admin')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              viewMode === 'admin'
                ? 'bg-red-600/20 text-red-500 border border-red-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            Gestor de Promociones (Admin)
          </button>
        </div>
      </div>

      {/* 1. VIEW MODE: CLIENT LANDING & DIGITAL STORE */}
      {viewMode === 'landing' && (
        <div className="space-y-12">
          {/* CLIENT HERO SECTION */}
          <section className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#030406] via-[#120808] to-[#030406] border border-red-600/25 p-8 md:p-12 shadow-[0_20px_50px_rgba(220,38,38,0.08)]">
            <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-96 h-96 bg-red-700/[0.03] rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-2xl space-y-6 relative z-10">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-950/40 text-red-400 text-[10px] font-bold uppercase tracking-wider border border-red-600/35">
                <Sparkles className="w-3.5 h-3.5 animate-pulse text-yellow-500" />
                Estética Vehicular • Río Cuarto
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase font-display leading-none">
                    ALBELO
                  </h1>
                  <span className="bg-red-600 text-white text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded italic">
                    Detailing
                  </span>
                </div>
                <h3 className="text-xs md:text-sm font-bold tracking-[0.25em] text-red-500 uppercase block">
                  — ESTÉTICA VEHICULAR —
                </h3>
              </div>

              {/* Flyer-style custom brush slogan banner */}
              <div className="py-2.5 px-4 rounded-lg brush-banner-red transform -rotate-1 max-w-lg shadow-lg">
                <p className="text-sm md:text-base font-black text-white uppercase tracking-wider text-center font-display italic">
                  ¡PROTEGÉ Y RENOVÁ TU VEHÍCULO!
                </p>
              </div>

              <p className="text-slate-300 text-xs md:text-sm leading-relaxed max-w-xl">
                Utilizamos materiales de primera línea para resguardar el valor de tu auto y devolverle el brillo espejo de un cero kilómetro. Somos especialistas en tratamientos acrílicos y cerámicos, polarizados con garantía escrita, y limpieza profunda de tapizados y motores.
              </p>

              <div className="flex gap-4 items-center flex-wrap pt-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-red-500" />
                  <span>Garantía Asegurada</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span>Materiales de Primera Línea</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold">
                  <Zap className="w-4 h-4 text-red-500" />
                  <span>Turnos Rápidos</span>
                </div>
              </div>

              <div className="pt-2 flex gap-3 flex-wrap">
                <a
                  href="#promos-store-grid"
                  className="bg-red-600 hover:bg-red-700 text-white font-extrabold px-5 py-2.5 rounded-lg text-xs uppercase tracking-wider transition shadow-[0_4px_20px_rgba(220,38,38,0.35)] flex items-center gap-1.5"
                >
                  Ver Promos Disponibles
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
                <a
                  href="#reserva-seccion"
                  className="bg-white/[0.02] hover:bg-white/[0.08] border border-white/[0.08] text-white font-bold px-5 py-2.5 rounded-lg text-xs uppercase tracking-wider transition flex items-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5 text-red-500" />
                  Reservar Turno Online
                </a>
              </div>
            </div>
          </section>

          {/* FLYER "NUESTROS SERVICIOS" GRID SECTION */}
          <section className="space-y-6">
            <div className="text-center space-y-1">
              <span className="text-[10px] font-bold tracking-widest text-red-500 uppercase block">ALBELO CATALOGUE</span>
              <h3 className="text-xl font-black text-white uppercase tracking-tight font-display">
                Nuestros Servicios Especializados
              </h3>
              <p className="text-xs text-slate-400 max-w-xl mx-auto leading-relaxed">
                Estética integral para vehículos, hogares y comercios. Mirá todo lo que hacemos en nuestro taller de Río Cuarto:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { title: 'LAVADOS Y LAVADOS PREMIUM', desc: 'Lavado artesanal, remoción técnica de insectos, acondicionado de gomas y sellado acrílico exprés.' },
                { title: 'ENCERADOS', desc: 'Aplicación de ceras de carnauba importadas que aumentan la profundidad del color y repelen el polvo.' },
                { title: 'LIMPIEZA DE TAPIZADOS', desc: 'Inyección-extracción de vapor húmedo en butacas, alfombras, techos y paneles con sanitizado de ozono.' },
                { title: 'LIMPIEZA DE MOTORES', desc: 'Lavado técnico manual seguro con desengrasante dieléctrico y sellador protector de mangueras.' },
                { title: 'ABRILLANTADOS', desc: 'Eliminación suave de micro-rayas superficiales y halo holográfico para revivir el brillo original.' },
                { title: 'TRATAMIENTO ACRÍLICO Y CERÁMICO', desc: 'Protección de cuarzo SiO2. Repele líquidos, contaminantes externos y otorga brillo efecto espejo.' },
                { title: 'RESTAURACIÓN DE ÓPTICAS', desc: 'Lijado técnico multi-paso y sellado UV para devolver la transparencia total y aumentar la seguridad.' },
                { title: 'POLARIZADOS PREMIUM', desc: 'Láminas americanas originales para vehículos, hogares y comercios. Máxima intimidad y rechazo de calor.' }
              ].map((serv, index) => (
                <div key={index} className="glass-panel p-4 rounded-xl flex flex-col justify-between space-y-2 relative group hover:border-red-500/40 transition duration-300">
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-red-600/10 text-red-500 flex items-center justify-center font-mono text-[10px] font-bold">
                    {index + 1}
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-extrabold text-white uppercase tracking-wider pr-4 group-hover:text-red-500 transition">
                      {serv.title}
                    </h4>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      {serv.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Guarantees from bottom footer of flyer */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-black/40 p-4 rounded-xl border border-red-500/10">
              {[
                { title: 'GARANTÍA', subtitle: 'En polarizados escritos' },
                { title: 'MATERIALES', subtitle: 'De primera línea importada' },
                { title: 'TURNOS RÁPIDOS', subtitle: 'Atención personalizada' },
                { title: 'PRESUPUESTOS', subtitle: 'Sin cargo y en el acto' }
              ].map((guar, idx) => (
                <div key={idx} className="flex items-center gap-3 border-r border-white/[0.04] last:border-0 pr-2">
                  <div className="p-2 bg-red-600/10 text-red-500 rounded-lg">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-[11px] font-black text-white uppercase tracking-wider">{guar.title}</h5>
                    <p className="text-[9px] text-slate-400">{guar.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ACTIVE PROMOTIONS SECTION (DIGITAL STOREFRONT) */}
          <section id="promos-store-grid" className="space-y-6">
            <div className="text-center space-y-1">
              <span className="text-[10px] font-bold tracking-widest text-red-500 uppercase block">TIENDA DIGITAL DE PROMOCIONES</span>
              <h3 className="text-xl font-black text-white uppercase tracking-tight font-display">
                Combos Activos & Tratamientos Especiales
              </h3>
              <p className="text-xs text-slate-400 max-w-xl mx-auto leading-relaxed">
                Elegí la promoción ideal para tu vehículo. Agendás online, congelás el precio promocional, seleccionás el turno y abonás al retirar.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {promociones
                .filter((p) => p.activa)
                .map((promo) => (
                  <div
                    key={promo.id}
                    className="bg-white/[0.01] rounded-2xl border border-white/[0.08] hover:border-red-600/40 p-5 flex flex-col justify-between transition-all duration-300 transform hover:scale-[1.02] relative group shadow-lg"
                  >
                    {/* Badge alert */}
                    {promo.etiqueta && (
                      <span className="absolute -top-3 left-4 bg-red-600 text-white font-extrabold text-[9px] uppercase tracking-wider px-2.5 py-1 rounded shadow-lg">
                        {promo.etiqueta}
                      </span>
                    )}

                    <div className="space-y-3.5 mt-2">
                      <div className="flex justify-between items-start">
                        <span className="text-[9px] bg-red-950/20 border border-red-500/20 text-red-400 font-bold uppercase tracking-widest px-2 py-0.5 rounded font-mono">
                          {promo.servicio === 'LAVADO' ? 'LAVADOS' : promo.servicio === 'TAPICERIA' ? 'TAPICERÍA' : 'ESTÉTICA'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold font-mono">⏱️ {promo.tiempoEstimado}</span>
                      </div>

                      <div>
                        <h4 className="text-sm font-black text-white group-hover:text-red-500 transition uppercase leading-tight">{promo.titulo}</h4>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{promo.subtitulo}</p>
                      </div>

                      {/* Benefits list bullet points */}
                      <ul className="space-y-1.5 border-t border-white/[0.04] pt-3">
                        {promo.caracteristicas.slice(0, 4).map((carac, idx) => (
                          <li key={idx} className="flex gap-1.5 items-start text-[10px] text-slate-400 leading-snug">
                            <Check className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
                            <span>{carac}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Price Tag and Call to Action */}
                    <div className="pt-4 mt-4 border-t border-white/[0.06] space-y-3">
                      <div className="flex justify-between items-end">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-slate-500 line-through font-mono">
                            ${promo.precioOriginal.toLocaleString('es-AR')} ARS
                          </span>
                          <span className="text-lg font-black text-emerald-400 font-mono tracking-tight flex items-center gap-1 leading-none">
                            ${promo.precioOferta.toLocaleString('es-AR')}
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1 rounded font-bold">{promo.descuentoPorcentaje}% OFF</span>
                          </span>
                        </div>
                      </div>

                      <a
                        href="#reserva-seccion"
                        onClick={() => setSelectedPromoId(promo.id)}
                        className="w-full flex items-center justify-center gap-1.5 bg-white/[0.02] hover:bg-red-600 hover:text-white border border-white/[0.08] hover:border-red-600 text-slate-200 font-bold py-2 rounded-lg text-[10px] uppercase tracking-wider transition duration-300"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        Reservar Promo
                      </a>
                    </div>
                  </div>
                ))}
            </div>
          </section>

          {/* INTERACTIVE DETAILING BEFORE-AND-AFTER SIMULATOR */}
          <section className="glass-panel p-6 rounded-2xl border border-red-500/20 shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-white/[0.08]">
              <div>
                <span className="text-[10px] font-bold tracking-widest text-red-500 uppercase block">SIMULADOR EN TIEMPO REAL</span>
                <h3 className="text-lg font-black text-white uppercase tracking-tight font-display">
                  La Transformación Albelo Detail
                </h3>
              </div>
              <p className="text-[11px] text-slate-400 max-w-sm leading-relaxed">
                Hacé click en los botones para ver el cambio real que sufren las ópticas, laca o tapizados al pasar por nuestro taller.
              </p>
            </div>

            <DetailingSimulationWidget />
          </section>

          {/* CERAMIC COATING & TREATMENTS MARKETING MODULE */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 bg-white/[0.01] rounded-2xl border border-white/[0.08] p-6 md:p-8 shadow-xl relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-red-600/[0.02] rounded-full blur-3xl pointer-events-none transform -translate-x-1/2 -translate-y-1/2" />
            
            {/* Visual Specs */}
            <div className="lg:col-span-5 space-y-4">
              <span className="text-[10px] font-bold tracking-widest text-red-500 uppercase block">ESPECIALIDAD ESTRELLA</span>
              <h3 className="text-xl font-black text-white uppercase tracking-tight font-display leading-tight">
                ¿Qué es un Tratamiento Cerámico 9H Gyeon?
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                El tratamiento cerámico SiO2 es la máxima protección de pintura disponible en el mercado. No es una cera temporal, sino una capa de vidrio de cuarzo líquido ultra-firme de alta resistencia.
              </p>
              
              <div className="space-y-2 pt-2">
                {[
                  { name: 'Eliminación de Micro-Rayas', desc: 'Previamente corregimos la laca eliminando marcas de lavado anteriores (swirls/marcas de trapo).' },
                  { name: 'Dureza Extrema 9H Certificada', desc: 'Añade una micro-capa de vidrio transparente que minimiza nuevas rayas del uso diario.' },
                  { name: 'Repelencia de Agua y Suciedad', desc: 'El polvo, el barro y los excrementos de aves no se adhieren a la pintura. El auto se lava solo con agua.' },
                  { name: 'Brillo Extremo Efecto Vidrio', desc: 'Satura el color original del auto y otorga un reflejo nítido y mojado inigualable.' }
                ].map((spec, i) => (
                  <div key={i} className="flex gap-2.5 items-start">
                    <span className="w-5 h-5 rounded-full bg-red-600/10 border border-red-500/20 text-red-500 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <div>
                      <h5 className="text-[11px] font-bold text-white uppercase tracking-wider">{spec.name}</h5>
                      <p className="text-[10px] text-slate-400 leading-relaxed">{spec.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Simulated interactive quote / comparison widget */}
            <div className="lg:col-span-7 flex flex-col justify-between bg-black/30 rounded-xl p-5 border border-white/[0.05] space-y-4">
              <div className="space-y-1 pb-2 border-b border-white/[0.06]">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Comparador de Protección y Brillo</h4>
                <p className="text-[10px] text-slate-500">¿Cuál es la diferencia entre el tratamiento Acrílico y el Cerámico?</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white/[0.01] border border-white/[0.04] p-3.5 rounded-lg space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-300 uppercase">Tratamiento Acrílico</span>
                    <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1 font-mono rounded font-bold">Por 6 Meses</span>
                  </div>
                  <div className="space-y-1.5 text-[10px] text-slate-400">
                    <div>• Selladores basados en polímeros acrílicos.</div>
                    <div>• Otorga un brillo excelente y repelencia moderada.</div>
                    <div>• No incrementa la dureza contra micro-rayas.</div>
                    <div className="text-emerald-400 font-bold pt-1">Ideal para presupuestos iniciales.</div>
                  </div>
                </div>

                <div className="bg-red-600/5 border border-red-500/20 p-3.5 rounded-lg space-y-2 relative">
                  <div className="absolute top-2 right-2 flex items-center">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-red-500 uppercase">Tratamiento Cerámico SiO2</span>
                    <span className="text-[9px] bg-red-500/10 text-red-400 px-1 font-mono rounded font-bold">Hasta 3 Años</span>
                  </div>
                  <div className="space-y-1.5 text-[10px] text-slate-400">
                    <div>• Basado en cuarzo líquido (Dióxido de Silicio).</div>
                    <div>• Brillo mojado "efecto espejo" tridimensional.</div>
                    <div>• Capa protectora física contra rayos UV y químicos.</div>
                    <div className="text-red-500 font-bold pt-1">La mejor inversión para tu facha.</div>
                  </div>
                </div>
              </div>

              <div className="bg-white/[0.02] p-3 rounded-lg border border-white/[0.05] flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-red-500" />
                  <span className="text-[10px] text-slate-400 font-medium">Todos los tratamientos cerámicos incluyen lavado previo técnico e inspección lumínica.</span>
                </div>
                <a
                  href="#reserva-seccion"
                  className="bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 text-red-500 font-bold px-3 py-1.5 rounded text-[10px] uppercase tracking-wider transition"
                >
                  Ver Tarifas y Reservar
                </a>
              </div>
            </div>
          </section>

          {/* ONLINE BOOKING FORM SECTION */}
          <section id="reserva-seccion" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Form layout */}
            <div className="lg:col-span-7">
              {bookingCompleted ? (
                <div className="bg-emerald-950/20 rounded-2xl border border-emerald-800/40 p-8 flex flex-col items-center justify-center text-center space-y-4 h-full">
                  <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
                    <CheckCircle className="w-12 h-12" />
                  </div>
                  <h3 className="text-xl font-extrabold text-white uppercase tracking-tight font-display">
                    ¡RESERVA CONFIRMADA EXCELENTEMENTE!
                  </h3>
                  <p className="text-xs text-slate-300 max-w-sm leading-relaxed">
                    Hola <b>{bookingName}</b>, tu turno para el coche con patente <b>{bookingPatente.toUpperCase()}</b> fue cargado con éxito en el sistema de Albelo Detailing.
                  </p>
                  
                  <div className="bg-black/30 p-4 rounded-xl border border-white/[0.06] text-left text-[11px] font-mono space-y-1.5 max-w-md w-full">
                    <div className="text-slate-500 font-bold uppercase tracking-wider">Detalles de Operación:</div>
                    <div><span className="text-slate-400">Cliente:</span> {bookingName}</div>
                    <div><span className="text-slate-400">Patente:</span> {bookingPatente.toUpperCase()}</div>
                    <div><span className="text-slate-400">Vehículo:</span> {bookingModelo || 'S/D'}</div>
                    <div><span className="text-slate-400">Fecha/Hora:</span> {bookingFecha} • {bookingHora} hs</div>
                    <div><span className="text-slate-400">Estado Turno:</span> <span className="text-amber-400 font-bold">PENDIENTE</span></div>
                    <div className="pt-1.5 mt-1.5 border-t border-white/[0.05] text-emerald-400 font-bold flex justify-between">
                      <span>Precio Congelado Promo:</span>
                      <span>${promociones.find(p => p.id === selectedPromoId)?.precioOferta.toLocaleString('es-AR')} ARS</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 max-w-sm">
                    ⚠️ Recibirás un mensaje de WhatsApp automatizado para validar el turno. Podés pagar en efectivo con un 10% de descuento o mediante transferencia/tarjeta en el local.
                  </p>

                  <button
                    onClick={() => setBookingCompleted(false)}
                    className="bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.08] text-white font-bold py-2 px-5 rounded-lg text-xs transition uppercase"
                  >
                    Agendar Otro Auto
                  </button>
                </div>
              ) : (
                <form onSubmit={handleClientBookingSubmit} className="glass-panel p-6 rounded-2xl border border-white/[0.08] space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-white/[0.08]">
                    <h4 className="text-sm font-black uppercase tracking-wider text-white font-display">Agenda tu Turno Online</h4>
                    <span className="text-[9px] bg-red-600/10 text-red-500 border border-red-600/20 px-2 py-0.5 rounded font-bold uppercase">Congelá Precio de Oferta</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-bold">Nombre y Apellido</label>
                      <input
                        type="text"
                        required
                        value={bookingName}
                        onChange={(e) => setBookingName(e.target.value)}
                        placeholder="Ej. Juan Perez"
                        className="w-full bg-[#030406] border border-white/[0.08] focus:border-red-500/50 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-bold">Teléfono de Contacto (WhatsApp)</label>
                      <input
                        type="tel"
                        required
                        value={bookingPhone}
                        onChange={(e) => setBookingPhone(e.target.value)}
                        placeholder="Ej. 3584226415"
                        className="w-full bg-[#030406] border border-white/[0.08] focus:border-red-500/50 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-bold">Patente del Coche</label>
                      <input
                        type="text"
                        required
                        value={bookingPatente}
                        onChange={(e) => setBookingPatente(e.target.value)}
                        placeholder="Ej. AB123CD o AA654BB"
                        className="w-full bg-[#030406] border border-white/[0.08] focus:border-red-500/50 focus:outline-none rounded-lg px-3 py-2 text-xs text-white uppercase font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-bold">Modelo del Vehículo y Color</label>
                      <input
                        type="text"
                        value={bookingModelo}
                        onChange={(e) => setBookingModelo(e.target.value)}
                        placeholder="Ej. Peugeot 208 Blanco"
                        className="w-full bg-[#030406] border border-white/[0.08] focus:border-red-500/50 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-1">
                      <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-bold">Seleccionar Promo</label>
                      <select
                        value={selectedPromoId}
                        onChange={(e) => setSelectedPromoId(e.target.value)}
                        className="w-full bg-[#030406] border border-white/[0.08] focus:border-red-500/50 focus:outline-none rounded-lg px-2.5 py-2 text-xs text-white"
                      >
                        {promociones
                          .filter((p) => p.activa)
                          .map((p) => (
                            <option key={p.id} value={p.id} className="bg-[#0c0f12]">
                              {p.titulo} - (${p.precioOferta.toLocaleString('es-AR')})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="sm:col-span-1">
                      <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-bold">Fecha del Turno</label>
                      <input
                        type="date"
                        required
                        value={bookingFecha}
                        onChange={(e) => setBookingFecha(e.target.value)}
                        className="w-full bg-[#030406] border border-white/[0.08] focus:border-red-500/50 focus:outline-none rounded-lg px-3 py-2 text-xs text-white font-mono"
                      />
                    </div>

                    <div className="sm:col-span-1">
                      <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-bold">Hora Preferida</label>
                      <select
                        value={bookingHora}
                        onChange={(e) => setBookingHora(e.target.value)}
                        className="w-full bg-[#030406] border border-white/[0.08] focus:border-red-500/50 focus:outline-none rounded-lg px-2.5 py-2 text-xs text-white font-mono"
                      >
                        <option value="08:00" className="bg-[#0c0f12]">08:00 hs</option>
                        <option value="09:30" className="bg-[#0c0f12]">09:30 hs</option>
                        <option value="11:00" className="bg-[#0c0f12]">11:00 hs</option>
                        <option value="14:00" className="bg-[#0c0f12]">14:00 hs</option>
                        <option value="15:30" className="bg-[#0c0f12]">15:30 hs</option>
                        <option value="17:00" className="bg-[#0c0f12]">17:00 hs</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                    <div className="text-[10px] text-slate-500">
                      *Al enviar el formulario, recibirás una confirmación manual de nuestros operadores.
                    </div>
                    <button
                      type="submit"
                      className="bg-red-600 hover:bg-red-700 text-white font-extrabold py-2 px-6 rounded-lg text-xs uppercase tracking-wider transition shadow-[0_0_15px_rgba(220,38,38,0.25)]"
                    >
                      Confirmar Reserva de Oferta
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Public details on Argentine Detailer salon */}
            <div className="lg:col-span-5 flex flex-col justify-between bg-[#120808]/20 border border-red-500/15 p-6 rounded-2xl">
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider pb-1.5 border-b border-white/[0.08]">Información de Contacto</h4>
                
                <div className="space-y-3">
                  <div className="flex gap-3 items-start">
                    <MapPin className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-[11px] font-bold text-white uppercase tracking-wide">¿Dónde estamos?</h5>
                      <p className="text-[10px] text-slate-300 leading-relaxed font-semibold">
                        Av. Marcelo T. de Alvear 1850, Río Cuarto<br />
                        <span className="text-slate-400 font-normal">Provincia de Córdoba, Argentina</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start pt-2 border-t border-white/[0.05]">
                    <Phone className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-[11px] font-bold text-white uppercase tracking-wide">WhatsApp / Teléfono</h5>
                      <p className="text-[11px] text-emerald-400 font-black font-mono leading-relaxed">
                        358 4226415<br />
                        <span className="text-slate-400 text-[10px] font-normal">Atención Comercial: Lun a Sáb de 8 a 19 hs.</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start pt-2 border-t border-white/[0.05]">
                    <span className="w-4 h-4 text-red-400 font-bold shrink-0 text-center font-display">@</span>
                    <div>
                      <h5 className="text-[11px] font-bold text-white uppercase tracking-wide">Instagram</h5>
                      <p className="text-[11px] text-white font-black leading-relaxed">
                        @ALBELODETAIL
                      </p>
                    </div>
                  </div>
                </div>

                {/* Simulated Local Testimonials */}
                <div className="bg-black/20 p-3 rounded-xl border border-white/[0.04] space-y-2 mt-4">
                  <span className="text-[9px] font-bold tracking-wider text-red-500 uppercase block">Opiniones de Clientes</span>
                  <div className="space-y-2 divide-y divide-white/[0.03]">
                    <div className="space-y-1 py-1">
                      <div className="flex justify-between items-center text-[9px]">
                        <span className="font-bold text-slate-300">Ale Rossi (Cruze Rojo)</span>
                        <span className="text-yellow-500">⭐⭐⭐⭐⭐</span>
                      </div>
                      <p className="text-[10px] text-slate-400 italic leading-snug">"Los pibes me dejaron el Cruze que parece un espejo. El tratamiento cerámico es increíble, vale cada centavo."</p>
                    </div>
                    <div className="space-y-1 pt-2">
                      <div className="flex justify-between items-center text-[9px]">
                        <span className="font-bold text-slate-300">Juan P. (Civic Negro)</span>
                        <span className="text-yellow-400">⭐⭐⭐⭐⭐</span>
                      </div>
                      <p className="text-[10px] text-slate-400 italic leading-snug">"Tenía las butacas destruidas por el perro. El lavado de tapicería con inyección las dejó impecables y perfumadas de primera."</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-500 text-center pt-4 border-t border-white/[0.05] mt-4">
                © 2026 Albelo Detailing • Río Cuarto • Todos los derechos reservados.
              </div>
            </div>
          </section>
        </div>
      )}
      {/* 2. VIEW MODE: ADMIN PROMOTIONS & CAMPAIGNS GENERATOR */}
      {viewMode === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Create Promo panel left Column */}
          <div className="lg:col-span-6 space-y-5">
            <form onSubmit={handleAddPromotion} className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-white/[0.08]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-red-500">Crear Nueva Promoción para la Tienda</h4>
                <span className="text-[9px] bg-red-950/40 text-red-400 border border-red-600/35 px-1.5 py-0.5 rounded font-bold uppercase">Gestor Activo</span>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Título de la Promoción</label>
                <input
                  type="text"
                  required
                  value={newPromoTitulo}
                  onChange={(e) => setNewPromoTitulo(e.target.value)}
                  placeholder="Ej. Combo Carnauba Extremo"
                  className="w-full bg-[#030406] border border-white/[0.08] focus:border-red-500/50 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Subtítulo Descriptivo</label>
                <input
                  type="text"
                  value={newPromoSubtitulo}
                  onChange={(e) => setNewPromoSubtitulo(e.target.value)}
                  placeholder="Ej. Lavado full + encerado manual con microfibra premium"
                  className="w-full bg-[#030406] border border-white/[0.08] focus:border-red-500/50 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Categoría</label>
                  <select
                    value={newPromoServicio}
                    onChange={(e) => setNewPromoServicio(e.target.value as TipoServicio)}
                    className="w-full bg-[#030406] border border-white/[0.08] focus:border-red-500/50 focus:outline-none rounded-lg px-2.5 py-2 text-xs text-white font-semibold"
                  >
                    <option value="LAVADO" className="bg-[#0c0f12]">Lavados</option>
                    <option value="TAPICERIA" className="bg-[#0c0f12]">Tapicería</option>
                    <option value="ESTETICA" className="bg-[#0c0f12]">Reparación Estética</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Tiempo Estimado</label>
                  <input
                    type="text"
                    value={newPromoTiempo}
                    onChange={(e) => setNewPromoTiempo(e.target.value)}
                    placeholder="Ej. 1.5 hs, 4 hs"
                    className="w-full bg-[#030406] border border-white/[0.08] focus:border-red-500/50 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Precio Original (ARS)</label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="1"
                      value={newPromoPrecioOrig}
                      onChange={(e) => setNewPromoPrecioOrig(e.target.value)}
                      placeholder="Ej. 50000"
                      className="w-full bg-[#030406] border border-white/[0.08] focus:border-red-500/50 focus:outline-none rounded-lg pl-6 pr-3 py-2 text-xs text-white font-mono"
                    />
                    <span className="absolute left-2.5 top-2 text-slate-500 text-xs">$</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Descuento (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="90"
                      value={newPromoDescuento}
                      onChange={(e) => setNewPromoDescuento(e.target.value)}
                      placeholder="Ej. 20"
                      className="w-full bg-[#030406] border border-white/[0.08] focus:border-red-500/50 focus:outline-none rounded-lg pl-3 pr-6 py-2 text-xs text-white font-mono"
                    />
                    <span className="absolute right-3 top-2 text-slate-500 text-xs">%</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Características (Separadas por comas)</label>
                <textarea
                  value={newPromoCaracteristicas}
                  onChange={(e) => setNewPromoCaracteristicas(e.target.value)}
                  placeholder="Ej. Encerado acrílico 3M, Perfume premium, Secado técnico seguro"
                  rows={2}
                  className="w-full bg-[#030406] border border-white/[0.08] focus:border-red-500/50 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Etiqueta de Destacado (Opcional)</label>
                <input
                  type="text"
                  value={newPromoEtiqueta}
                  onChange={(e) => setNewPromoEtiqueta(e.target.value)}
                  placeholder="Ej. Hot Sale! 🔥, Recomendado, Lanzamiento!"
                  className="w-full bg-[#030406] border border-white/[0.08] focus:border-red-500/50 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="pt-2 border-t border-white/[0.06] flex justify-end gap-3">
                <button
                  type="submit"
                  className="bg-red-600 hover:bg-red-700 text-white font-extrabold py-2 px-6 rounded-lg text-xs uppercase tracking-wider transition shadow-[0_0_15px_rgba(220,38,38,0.25)] flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Publicar Promoción en Tienda
                </button>
              </div>
            </form>
          </div>

          {/* List of current promos right Column */}
          <div className="lg:col-span-6 space-y-5">
            <div className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 pb-1.5 border-b border-white/[0.08]">
                Promociones Publicadas en Tienda ({promociones.length})
              </h4>

              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin">
                {promociones.map((p) => (
                  <div key={p.id} className="bg-white/[0.01] p-3 rounded-lg border border-white/[0.05] flex justify-between items-center gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${p.activa ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                        <h5 className="text-xs font-bold text-white uppercase">{p.titulo}</h5>
                        {p.etiqueta && <span className="text-[8px] bg-red-950/20 text-red-400 border border-red-500/20 px-1 rounded font-bold uppercase">{p.etiqueta}</span>}
                      </div>
                      <p className="text-[10px] text-slate-500">{p.subtitulo.slice(0, 50)}...</p>
                      <div className="flex gap-2 text-[9px] font-mono font-bold text-slate-400">
                        <span>Oferta: <b className="text-emerald-400">${p.precioOferta.toLocaleString('es-AR')}</b></span>
                        <span>({p.descuentoPorcentaje}% OFF de ${p.precioOriginal.toLocaleString('es-AR')})</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleTogglePromoStatus(p.id)}
                        className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition ${
                          p.activa 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20' 
                            : 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                        }`}
                      >
                        {p.activa ? 'Activa' : 'Pausada'}
                      </button>
                      
                      <button
                        onClick={() => handleDeletePromo(p.id)}
                        className="p-1 rounded bg-red-950/25 hover:bg-red-900 border border-red-900/30 text-red-400 hover:text-white transition"
                        title="Eliminar de tienda"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
