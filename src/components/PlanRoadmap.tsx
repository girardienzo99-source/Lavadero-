import React, { useState } from 'react';
import { Shield, Sparkles, Droplet, CheckCircle, HelpCircle, DollarSign, ArrowRight, Sliders, Briefcase, Award, TrendingUp } from 'lucide-react';

export default function PlanRoadmap() {
  const [activeTab, setActiveTab] = useState<'blueprint' | 'calculator' | 'equipment' | 'roi'>('blueprint');

  // Interactive Pricing Calculator States
  const [vehicleSize, setVehicleSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [vehicleState, setVehicleState] = useState<'mild' | 'moderate' | 'severe'>('moderate');
  const [selectedService, setSelectedService] = useState<'lavado' | 'tapiceria' | 'estetica'>('lavado');

  // Equipment Checklist States
  const [equippedItems, setEquippedItems] = useState<string[]>([
    'hidro', 'aspi', 'extractora'
  ]);

  // ROI Calculator States
  const [roiTurnosDiarios, setRoiTurnosDiarios] = useState(6);
  const [roiPrecioPromedio, setRoiPrecioPromedio] = useState(48000);
  const [roiCostoInsumos, setRoiCostoInsumos] = useState(8);
  const [roiComisionOperario, setRoiComisionOperario] = useState(30);
  const [roiCostosFijos, setRoiCostosFijos] = useState(650000);

  const toggleEquipment = (id: string) => {
    if (equippedItems.includes(id)) {
      setEquippedItems(equippedItems.filter(item => item !== id));
    } else {
      setEquippedItems([...equippedItems, id]);
    }
  };

  const calculateEstimate = () => {
    let basePrice = 0;
    
    // Base Service Cost
    if (selectedService === 'lavado') {
      basePrice = 25000;
    } else if (selectedService === 'tapiceria') {
      basePrice = 75000;
    } else if (selectedService === 'estetica') {
      basePrice = 120000;
    }

    // Vehicle Size multiplier
    const sizeMultiplier = vehicleSize === 'small' ? 0.85 : vehicleSize === 'medium' ? 1.0 : 1.25;

    // Vehicle condition multiplier
    const conditionMultiplier = vehicleState === 'mild' ? 1.0 : vehicleState === 'moderate' ? 1.15 : 1.4;

    const finalPrice = Math.round(basePrice * sizeMultiplier * conditionMultiplier);
    
    // Suggested pricing ranges
    return {
      price: finalPrice,
      duration: selectedService === 'lavado' ? '1-1.5 hs' : selectedService === 'tapiceria' ? '3-5 hs' : '6-12 hs',
      costInsumos: Math.round(finalPrice * 0.08), // ~8% materials cost
      profit: Math.round(finalPrice * 0.65), // ~65% profit after labor and materials
    };
  };

  const estimate = calculateEstimate();

  const allEquipment = [
    { id: 'hidro', name: 'Hidrolavadora Industrial', cat: 'Lavadero', desc: 'Trifásica o monofásica de alta presión (> 150 bar) para remoción de barro.', cost: '$1,200 USD' },
    { id: 'aspi', name: 'Aspiradora de Polvo y Agua', cat: 'Lavadero', desc: 'De 2 o 3 motores industriales con tanque de acero inoxidable de 80 lts.', cost: '$450 USD' },
    { id: 'extractora', name: 'Máquina Inyección/Extracción', cat: 'Tapicería', desc: 'Para inyectar limpiador APC y succionar suciedad de butacas y alfombras.', cost: '$850 USD' },
    { id: 'vaporera', name: 'Generador de Vapor Seco', cat: 'Tapicería', desc: 'Sanitiza conductos de aire y desinfecta manchas complejas sin empapar.', cost: '$600 USD' },
    { id: 'pulidora_roto', name: 'Pulidora Rotoorbital (Doble Acción)', cat: 'Estética', desc: 'Evita marcas de holograma (quemaduras) en la pintura. Ideal para tratamientos cerámicos.', cost: '$380 USD' },
    { id: 'pulidora_rot', name: 'Pulidora Rotativa', cat: 'Estética', desc: 'Para remoción de rayas severas y corrección de pintura pesada.', cost: '$320 USD' },
    { id: 'luz_led', name: 'Lámpara de Detallado (Scangrip)', cat: 'Estética', desc: 'Luces focalizadas de alta fidelidad de color (CRI) para detectar rayones en la laca.', cost: '$220 USD' },
    { id: 'tornador', name: 'Pistola Tornadora de Aire', cat: 'Tapicería', desc: 'Efecto ciclón para limpieza profunda de torpedos, ranuras and alfombras.', cost: '$120 USD' },
  ];

  const calculatedPercentage = Math.round((equippedItems.length / allEquipment.length) * 100);

  return (
    <div className="space-y-6">
      {/* Visual Tab Selection */}
      <div className="flex border-b border-white/[0.08] relative z-20 overflow-x-auto scrollbar-none">
        <button
          id="btn-tab-blueprint"
          onClick={() => setActiveTab('blueprint')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition duration-200 shrink-0 cursor-pointer ${
            activeTab === 'blueprint'
              ? 'border-red-500 text-white bg-white/[0.02]'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Plan de Negocios
        </button>
        <button
          id="btn-tab-calculator"
          onClick={() => setActiveTab('calculator')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition duration-200 shrink-0 cursor-pointer ${
            activeTab === 'calculator'
              ? 'border-red-500 text-white bg-white/[0.02]'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Cotizador Inteligente
        </button>
        <button
          id="btn-tab-equipment"
          onClick={() => setActiveTab('equipment')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition duration-200 shrink-0 cursor-pointer ${
            activeTab === 'equipment'
              ? 'border-red-500 text-white bg-white/[0.02]'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
          }`}
        >
          <Award className="w-4 h-4" />
          Checklist Equipamiento
        </button>
        <button
          id="btn-tab-roi"
          onClick={() => setActiveTab('roi')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition duration-200 shrink-0 cursor-pointer ${
            activeTab === 'roi'
              ? 'border-red-500 text-white bg-white/[0.02]'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Calculadora de ROI
        </button>
      </div>

      {/* Blueprint Tab */}
      {activeTab === 'blueprint' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in relative z-20">
          {/* Column 1: Estructura de Lavadero */}
          <div className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-2 pb-2 border-b border-white/[0.08]">
              <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Droplet className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-bold text-white text-sm font-display uppercase tracking-wide">1. Unidad de Lavadero</h3>
                <span className="text-[10px] text-emerald-400 font-bold font-mono tracking-wider">OPERATORIA ÁGIL</span>
              </div>
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              El corazón de la facturación diaria. Diseñado bajo el concepto de lavado seguro <b className="text-slate-200">sin rayas (Anti-Swirls)</b> usando el método de dos baldes, Foam Lance para prelavado y microfibras de alta absorción.
            </p>

            <ul className="space-y-2.5 text-xs text-slate-300 pt-2">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><b>Prelavado con Espuma (Snow Foam)</b>: Ablanda la suciedad estática sin fricción manual.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><b>Limpieza de Llantas Detallada</b>: Con cepillos blandos y limpiadores ácidos/férricos específicos.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><b>Secado Técnico por Soplado</b>: Elimina agua en hendiduras para evitar gotas calcáreas posteriores.</span>
              </li>
            </ul>

            <div className="bg-white/[0.02] border border-white/[0.06] p-3 rounded-lg text-xs">
              <span className="text-slate-400 block font-bold mb-1">💡 Consejo de Publicidad:</span>
              <p className="text-[11px] text-slate-300">
                "La tarjeta de lavado N° 10 es gratis". Utiliza tarjetas de fidelidad físicas o cupones digitales para asegurar un flujo constante de ingresos diarios.
              </p>
            </div>
          </div>

          {/* Column 2: Estructura de Tapicería */}
          <div className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-2 pb-2 border-b border-white/[0.08]">
              <span className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Sparkles className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-bold text-white text-sm font-display uppercase tracking-wide">2. Unidad de Tapicería</h3>
                <span className="text-[10px] text-[#00d2ff] font-bold font-mono tracking-wider">LIMPIEZA PROFUNDA</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Servicio de alto valor agregado. Se enfoca en remover manchas profundas, olores persistentes (tabaco, humedad) y bacterias mediante desinfección química y vaporización controlada.
            </p>

            <ul className="space-y-2.5 text-xs text-slate-300 pt-2">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-[#00d2ff] shrink-0 mt-0.5" />
                <span><b>Inyección y Extracción Térmica</b>: Aspira la suciedad desde el interior del relleno de las butacas.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-[#00d2ff] shrink-0 mt-0.5" />
                <span><b>Tratamiento de Cuero Premium</b>: Limpieza con cepillo suave de cerdas naturales y humectación mate.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-[#00d2ff] shrink-0 mt-0.5" />
                <span><b>Purificación por Ozono (O3)</b>: Neutraliza olores orgánicos e inorgánicos y sanitiza los conductos del A/C.</span>
              </li>
            </ul>

            <div className="bg-white/[0.02] border border-white/[0.06] p-3 rounded-lg text-xs">
              <span className="text-slate-400 block font-bold mb-1">💡 Consejo de Publicidad:</span>
              <p className="text-[11px] text-slate-300">
                Lanza campañas en otoño/invierno mostrando videos del antes/después del agua negra extraída de los asientos. Esto genera conversiones automáticas de clientes asombrados.
              </p>
            </div>
          </div>

          {/* Column 3: Estructura de Reparación Estética */}
          <div className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-2 pb-2 border-b border-white/[0.08]">
              <span className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Shield className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-bold text-white text-sm font-display uppercase tracking-wide">3. Detallado y Estética</h3>
                <span className="text-[10px] text-amber-400 font-bold font-mono tracking-wider">MÁXIMA CALIDAD (NPS)</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              El servicio estrella de mayor margen del negocio. Incluye corrección de pintura de nivel profesional, reparación estética de focos quemados y recubrimientos protectores duraderos.
            </p>

            <ul className="space-y-2.5 text-xs text-slate-300 pt-2">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span><b>Corrección de Laca de Pintura</b>: Eliminación de rayones superficiales mediante pulidos escalonados.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span><b>Recubrimiento de Vidrio SiO2 (Cerámicos)</b>: Sellado de pintura que repele agua, suciedad e insectos por años.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span><b>Sacabollos Sin Pintar (PDR)</b>: Reparación rápida de golpes menores mediante herramientas de precisión.</span>
              </li>
            </ul>

            <div className="bg-white/[0.02] border border-white/[0.06] p-3 rounded-lg text-xs">
              <span className="text-slate-400 block font-bold mb-1">💡 Consejo de Publicidad:</span>
              <p className="text-[11px] text-slate-300">
                Asocia este servicio con la reventa del auto: "Aumenta el valor de venta de tu vehículo hasta un 15% con una corrección de laca y limpieza de motor."
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Calculator Tab */}
      {activeTab === 'calculator' && (
        <div className="glass-panel p-6 rounded-xl border border-white/[0.08] grid grid-cols-1 md:grid-cols-12 gap-6 animate-fade-in relative z-20 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          {/* Controls */}
          <div className="md:col-span-7 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#00d2ff] mb-2 flex items-center gap-1.5">
              <Sliders className="w-4 h-4" />
              Parámetros de Cotización
            </h3>

            {/* Service Selection */}
            <div>
              <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-2">Unidad de Negocio / Servicio</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  id="btn-calc-lavado"
                  onClick={() => setSelectedService('lavado')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold uppercase border transition ${
                    selectedService === 'lavado'
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                      : 'border-white/[0.08] bg-white/[0.01] text-slate-400 hover:border-white/[0.15]'
                  }`}
                >
                  Lavadero
                </button>
                <button
                  id="btn-calc-tapiceria"
                  onClick={() => setSelectedService('tapiceria')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold uppercase border transition ${
                    selectedService === 'tapiceria'
                      ? 'border-[#00d2ff]/50 bg-[#00d2ff]/10 text-[#00d2ff]'
                      : 'border-white/[0.08] bg-white/[0.01] text-slate-400 hover:border-white/[0.15]'
                  }`}
                >
                  Tapicería
                </button>
                <button
                  id="btn-calc-estetica"
                  onClick={() => setSelectedService('estetica')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold uppercase border transition ${
                    selectedService === 'estetica'
                      ? 'border-[#9d50bb]/50 bg-[#9d50bb]/10 text-purple-300'
                      : 'border-white/[0.08] bg-white/[0.01] text-slate-400 hover:border-white/[0.15]'
                  }`}
                >
                  Detallado / Estética
                </button>
              </div>
            </div>

            {/* Vehicle Size Selection */}
            <div>
              <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-2">Tamaño del Vehículo</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  id="btn-calc-size-small"
                  onClick={() => setVehicleSize('small')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition ${
                    vehicleSize === 'small'
                      ? 'border-[#00d2ff]/50 bg-[#00d2ff]/10 text-[#00d2ff]'
                      : 'border-white/[0.08] bg-white/[0.01] text-slate-400 hover:border-white/[0.15]'
                  }`}
                >
                  Chico / Hatchback
                </button>
                <button
                  id="btn-calc-size-med"
                  onClick={() => setVehicleSize('medium')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition ${
                    vehicleSize === 'medium'
                      ? 'border-[#00d2ff]/50 bg-[#00d2ff]/10 text-[#00d2ff]'
                      : 'border-white/[0.08] bg-white/[0.01] text-slate-400 hover:border-white/[0.15]'
                  }`}
                >
                  Sedán / Mediano
                </button>
                <button
                  id="btn-calc-size-large"
                  onClick={() => setVehicleSize('large')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition ${
                    vehicleSize === 'large'
                      ? 'border-[#00d2ff]/50 bg-[#00d2ff]/10 text-[#00d2ff]'
                      : 'border-white/[0.08] bg-white/[0.01] text-slate-400 hover:border-white/[0.15]'
                  }`}
                >
                  SUV / Camioneta
                </button>
              </div>
            </div>

            {/* Vehicle Condition Selection */}
            <div>
              <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-2">Estado del Vehículo (Suciedad o Desgaste)</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  id="btn-calc-state-mild"
                  onClick={() => setVehicleState('mild')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition ${
                    vehicleState === 'mild'
                      ? 'border-[#00d2ff]/50 bg-[#00d2ff]/10 text-[#00d2ff]'
                      : 'border-white/[0.08] bg-white/[0.01] text-slate-400 hover:border-white/[0.15]'
                  }`}
                >
                  Leve (Común)
                </button>
                <button
                  id="btn-calc-state-mod"
                  onClick={() => setVehicleState('moderate')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition ${
                    vehicleState === 'moderate'
                      ? 'border-[#00d2ff]/50 bg-[#00d2ff]/10 text-[#00d2ff]'
                      : 'border-white/[0.08] bg-white/[0.01] text-slate-400 hover:border-white/[0.15]'
                  }`}
                >
                  Moderado (Manchas/Swirls)
                </button>
                <button
                  id="btn-calc-state-sev"
                  onClick={() => setVehicleState('severe')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition ${
                    vehicleState === 'severe'
                      ? 'border-[#00d2ff]/50 bg-[#00d2ff]/10 text-[#00d2ff]'
                      : 'border-white/[0.08] bg-white/[0.01] text-slate-400 hover:border-white/[0.15]'
                  }`}
                >
                  Severo (Resinas/Extremo)
                </button>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 leading-relaxed bg-white/[0.01] p-3 rounded-lg border border-white/[0.06]">
              ⚠️ <b>Nota técnica:</b> El calculador inteligente aplica coeficientes de mano de obra y tiempo extendido en base a la superficie del vehículo (multiplicador de tamaño) y las horas hombre estimadas para tratar manchas de tapizados o corrección de laca severas.
            </div>
          </div>

          {/* Pricing Results Display */}
          <div className="md:col-span-5 bg-[#0c0f12]/40 border border-white/[0.08] rounded-xl p-5 flex flex-col justify-between shadow-inner">
            <div className="space-y-4">
              <div className="text-center pb-3 border-b border-white/[0.08]">
                <span className="text-[10px] uppercase tracking-widest text-slate-400 block font-bold">COTIZACIÓN SUGERIDA</span>
                <span className="text-4xl font-extrabold text-[#00d2ff] block mt-1 font-mono">${estimate.price.toLocaleString('es-AR')} <span className="text-xs text-slate-400">ARS</span></span>
                <span className="text-[10px] text-[#00d2ff] font-bold uppercase tracking-wider mt-1 block">Rango de Posicionamiento Premium</span>
              </div>

              <div className="space-y-2.5 pt-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Tiempo de Entrega Estimado:</span>
                  <span className="text-white font-bold font-mono">{estimate.duration}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Insumos (8%):</span>
                  <span className="text-red-400 font-bold font-mono">-${estimate.costInsumos.toLocaleString('es-AR')} ARS</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Margen Neto (65%):</span>
                  <span className="text-emerald-400 font-bold font-mono">+${estimate.profit.toLocaleString('es-AR')} ARS</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Margen Operativo:</span>
                  <span className="text-[#00d2ff] font-bold font-mono">82% aprox.</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/[0.06] text-[11px] text-slate-500 leading-relaxed flex items-start gap-1.5 font-sans">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>Esta cotización asegura cubrir la reposición de químicos biodegradables importados y la amortización de paños de microfibra de alta densidad.</span>
            </div>
          </div>
        </div>
      )}

      {/* Equipment Checklist Tab */}
      {activeTab === 'equipment' && (
        <div className="glass-panel p-6 rounded-xl border border-white/[0.08] space-y-5 animate-fade-in relative z-20 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
            <div>
              <h3 className="font-bold text-white text-sm uppercase tracking-wide">Infraestructura y Herramientas Necesarias</h3>
              <p className="text-xs text-slate-400">Selecciona el equipamiento con el que ya cuentas para calcular tu avance de apertura de local.</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-24 bg-white/[0.04] rounded-full h-2 overflow-hidden border border-white/[0.06]">
                <div className="bg-[#00d2ff] h-full transition-all duration-300" style={{ width: `${calculatedPercentage}%` }} />
              </div>
              <span className="text-xs font-mono font-bold text-[#00d2ff]">{calculatedPercentage}% Listo</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allEquipment.map((eq) => {
              const isChecked = equippedItems.includes(eq.id);
              return (
                <div
                  key={eq.id}
                  id={`eq-card-${eq.id}`}
                  onClick={() => toggleEquipment(eq.id)}
                  className={`p-3.5 rounded-lg border text-left cursor-pointer transition flex items-start gap-3 select-none ${
                    isChecked
                      ? 'border-[#00d2ff]/40 bg-white/[0.03] shadow-[0_0_15px_rgba(0,210,255,0.05)]'
                      : 'border-white/[0.06] bg-white/[0.01] hover:border-white/[0.12] hover:bg-white/[0.02]'
                  }`}
                >
                  <div className={`w-5 h-5 rounded border mt-0.5 flex items-center justify-center transition shrink-0 ${
                    isChecked ? 'bg-[#00d2ff] border-[#00d2ff] text-[#06080a]' : 'border-white/[0.15] bg-black/30'
                  }`}>
                    {isChecked && <CheckCircle className="w-3.5 h-3.5 stroke-[3] text-black" />}
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-white font-display">{eq.name}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider border ${
                        eq.cat === 'Lavadero' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        eq.cat === 'Tapicería' ? 'bg-[#00d2ff]/10 text-[#00d2ff] border-[#00d2ff]/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>{eq.cat}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{eq.desc}</p>
                    <div className="text-[10px] text-slate-500 font-mono">Costo estimado: {eq.cost}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ROI Calculator Tab */}
      {activeTab === 'roi' && (
        <div className="glass-panel p-6 rounded-xl border border-red-500/15 grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in relative z-20 shadow-[0_8px_32px_rgba(0,0,0,0.4)] card-sport-border">
          {/* Sliders Controls Column */}
          <div className="lg:col-span-7 space-y-5">
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-red-500 mb-3 flex items-center gap-1.5 font-display">
              <TrendingUp className="w-4 h-4 text-red-500" />
              Parámetros de Rentabilidad
            </h3>

            {/* Slider 1: Turnos Diarios */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-slate-300">
                <span className="uppercase tracking-wider">Turnos Diarios Promedio:</span>
                <span className="text-red-400 font-mono text-sm">{roiTurnosDiarios} turnos/día</span>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={roiTurnosDiarios}
                onChange={(e) => setRoiTurnosDiarios(Number(e.target.value))}
                className="w-full accent-red-600 h-1.5 bg-black/40 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                <span>1 TURNO</span>
                <span>20 TURNOS</span>
              </div>
            </div>

            {/* Slider 2: Precio Promedio */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-slate-300">
                <span className="uppercase tracking-wider">Precio Promedio por Turno:</span>
                <span className="text-red-400 font-mono text-sm">${roiPrecioPromedio.toLocaleString('es-AR')} ARS</span>
              </div>
              <input
                type="range"
                min="15000"
                max="300000"
                step="5000"
                value={roiPrecioPromedio}
                onChange={(e) => setRoiPrecioPromedio(Number(e.target.value))}
                className="w-full accent-red-600 h-1.5 bg-black/40 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                <span>$15.000</span>
                <span>$300.000</span>
              </div>
            </div>

            {/* Slider 3: Costo Insumos */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-slate-300">
                <span className="uppercase tracking-wider">Costo Insumos y Químicos:</span>
                <span className="text-red-400 font-mono text-sm">{roiCostoInsumos}% del valor del servicio</span>
              </div>
              <input
                type="range"
                min="3"
                max="25"
                step="1"
                value={roiCostoInsumos}
                onChange={(e) => setRoiCostoInsumos(Number(e.target.value))}
                className="w-full accent-red-600 h-1.5 bg-black/40 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                <span>3% (MIN)</span>
                <span>25% (MAX)</span>
              </div>
            </div>

            {/* Slider 4: Comisión Empleado */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-slate-300">
                <span className="uppercase tracking-wider">Comisión para el Lavador/Detallador:</span>
                <span className="text-red-400 font-mono text-sm">{roiComisionOperario}% del valor del servicio</span>
              </div>
              <input
                type="range"
                min="15"
                max="50"
                step="5"
                value={roiComisionOperario}
                onChange={(e) => setRoiComisionOperario(Number(e.target.value))}
                className="w-full accent-red-600 h-1.5 bg-black/40 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                <span>15%</span>
                <span>50%</span>
              </div>
            </div>

            {/* Slider 5: Costos Fijos */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-slate-300">
                <span className="uppercase tracking-wider">Costos Fijos Mensuales (Alquiler + Servicios):</span>
                <span className="text-red-400 font-mono text-sm">${roiCostosFijos.toLocaleString('es-AR')} ARS</span>
              </div>
              <input
                type="range"
                min="150000"
                max="2500000"
                step="50000"
                value={roiCostosFijos}
                onChange={(e) => setRoiCostosFijos(Number(e.target.value))}
                className="w-full accent-red-600 h-1.5 bg-black/40 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                <span>$150.000</span>
                <span>$2.500.000</span>
              </div>
            </div>
          </div>

          {/* ROI Outputs Dashboard Column */}
          <div className="lg:col-span-5 bg-black/50 border border-white/[0.06] rounded-xl p-5 flex flex-col justify-between shadow-inner relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/[0.02] rounded-full blur-xl pointer-events-none" />
            
            <div className="space-y-4">
              <div className="text-center pb-3.5 border-b border-white/[0.08]">
                <span className="text-[9px] uppercase tracking-widest text-slate-400 block font-bold">Ganancia Neta Estimada (Mensual)</span>
                <span className={`text-3xl font-black block mt-1.5 font-mono ${
                  (roiTurnosDiarios * roiPrecioPromedio * 30 * (1 - (roiCostoInsumos / 100) - (roiComisionOperario / 100)) - roiCostosFijos) >= 0 
                    ? 'text-emerald-400' 
                    : 'text-red-500'
                }`}>
                  ${Math.round(
                    (roiTurnosDiarios * roiPrecioPromedio * 30 * (1 - (roiCostoInsumos / 100) - (roiComisionOperario / 100))) - roiCostosFijos
                  ).toLocaleString('es-AR')} ARS
                </span>
                <span className="text-[9px] text-red-400 font-extrabold uppercase tracking-widest mt-1 block">Utilidad sobre Caja Operativa</span>
              </div>

              <div className="space-y-2.5 text-xs font-sans">
                <div className="flex justify-between">
                  <span className="text-slate-400">Facturación Bruta (30 días):</span>
                  <span className="text-white font-bold font-mono">${(roiTurnosDiarios * roiPrecioPromedio * 30).toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Costo Insumos ({roiCostoInsumos}%):</span>
                  <span className="text-red-400 font-bold font-mono">-${Math.round(roiTurnosDiarios * roiPrecioPromedio * 30 * (roiCostoInsumos / 100)).toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Comisiones Operarias ({roiComisionOperario}%):</span>
                  <span className="text-red-400 font-bold font-mono">-${Math.round(roiTurnosDiarios * roiPrecioPromedio * 30 * (roiComisionOperario / 100)).toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Costos Fijos Operativos:</span>
                  <span className="text-red-400 font-bold font-mono">-${roiCostosFijos.toLocaleString('es-AR')}</span>
                </div>
                
                <div className="pt-2 border-t border-white/[0.08] flex justify-between font-bold">
                  <span className="text-slate-300">Punto de Equilibrio (Break-even):</span>
                  <span className="text-yellow-400 font-mono">
                    {Math.max(0, Math.ceil(
                      roiCostosFijos / (roiPrecioPromedio * (1 - (roiCostoInsumos / 100) - (roiComisionOperario / 100)))
                    ))} turnos/mes
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/[0.06] text-[10px] text-slate-500 leading-relaxed flex items-start gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span>Cálculos proyectados en base a 30 días laborables. El ROI real puede variar en función de las comisiones operarias acordadas.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
