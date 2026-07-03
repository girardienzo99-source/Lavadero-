import React, { useState, useRef } from 'react';
import { 
  Sparkles, Palette, Shield, Car, Image, Upload, RotateCcw, Save, 
  Check, Play, HelpCircle, FileText, Layout, Type, Crown, Flame, Eye,
  Sliders, Info
} from 'lucide-react';
import { BrandConfig } from '../types';

interface BrandSettingsProps {
  config: BrandConfig;
  onSave: (newConfig: BrandConfig) => void;
  onAddLog: (message: string) => void;
}

const PRESET_FONTS = [
  { id: 'Outfit', nombre: 'Outfit (Tech & Deportivo)' },
  { id: 'Space Grotesk', nombre: 'Space Grotesk (Moderna Progresiva)' },
  { id: 'Syne', nombre: 'Syne (Vanguardista & Negrita)' },
  { id: 'Cinzel', nombre: 'Cinzel (Clásica de Lujo)' },
  { id: 'Playfair Display', nombre: 'Playfair Display (Elegante & Premium)' },
  { id: 'Inter', nombre: 'Inter (Suiza Minimalista)' }
];

const PRESET_COLORS = [
  { nombre: 'Rosso Albelo (Original)', primary: '#dc2626', hover: '#b91c1c', desc: 'Rojo carrera de alta energía.' },
  { nombre: 'Cyberpunk Neon Orange', primary: '#f97316', hover: '#ea580c', desc: 'Naranja vibrante de alto contraste.' },
  { nombre: 'Bespoke Imperial Gold', primary: '#d4af37', hover: '#aa8c2c', desc: 'Dorado metálico de alta gama.' },
  { nombre: 'Mint Shield Green', primary: '#10b981', hover: '#059669', desc: 'Verde fresco hidrofóbico.' },
  { nombre: 'Aqua Ceramic Cyan', primary: '#00d2ff', hover: '#00b0d6', desc: 'Cian eléctrico tecnología del cuarzo.' },
  { nombre: 'Royal Amethyst Violet', primary: '#8b5cf6', hover: '#7c3aed', desc: 'Púrpura profundo místico premium.' },
  { nombre: 'Nardo Gray / Carbon', primary: '#6b7280', hover: '#4b5563', desc: 'Gris competición sigiloso elegante.' }
];

const AlbeloIcon = (props: any) => (
  <svg {...props} viewBox="0 0 100 100" fill="currentColor">
    <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="6" />
    <path d="M30 68 L50 26 L70 68 M36 54 L64 54" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const LOGO_ICONS = [
  { id: 'Albelo', component: AlbeloIcon, label: 'Albelo Emblem' },
  { id: 'Car', component: Car, label: 'Superdeportivo' },
  { id: 'Sparkles', component: Sparkles, label: 'Brillo Extremo' },
  { id: 'Shield', component: Shield, label: 'Protección Gyeon' },
  { id: 'Crown', component: Crown, label: 'Corona Elite' },
  { id: 'Flame', component: Flame, label: 'Fuego / Performance' }
];

export default function BrandSettings({
  config,
  onSave,
  onAddLog
}: BrandSettingsProps) {
  // Local form states initialized from current config
  const [nombre, setNombre] = useState(config.nombre);
  const [tagline, setTagline] = useState(config.tagline);
  const [primaryColor, setPrimaryColor] = useState(config.primaryColor);
  const [hoverColor, setHoverColor] = useState(config.hoverColor);
  const [logoType, setLogoType] = useState<Required<BrandConfig>['logoType']>(config.logoType);
  const [selectedIcon, setSelectedIcon] = useState(config.selectedIcon);
  const [customLogoUrl, setCustomLogoUrl] = useState(config.customLogoUrl || '');
  const [fontFamily, setFontFamily] = useState(config.fontFamily);

  // Drag and drop states
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle Preset select
  const handleSelectPreset = (preset: typeof PRESET_COLORS[0]) => {
    setPrimaryColor(preset.primary);
    setHoverColor(preset.hover);
  };

  // Auto-calculate hover color (make it 15% darker or lighter)
  const handleAutoHoverColor = (hex: string) => {
    setPrimaryColor(hex);
    // Simple hex darken formula (reverts to default preset if anything fails)
    try {
      const rgb = hexToRgb(hex);
      if (rgb) {
        const darkerR = Math.max(0, Math.floor(rgb.r * 0.82));
        const darkerG = Math.max(0, Math.floor(rgb.g * 0.82));
        const darkerB = Math.max(0, Math.floor(rgb.b * 0.82));
        setHoverColor(rgbToHex(darkerR, darkerG, darkerB));
      }
    } catch (e) {
      setHoverColor(hex);
    }
  };

  // Helper functions for color calculation
  function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  function rgbToHex(r: number, g: number, b: number) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // Handle custom file upload and conversion to base64
  const handleLogoFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setCustomLogoUrl(e.target.result as string);
        setLogoType('custom');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleLogoFile(e.dataTransfer.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleLogoFile(e.target.files[0]);
    }
  };

  // Save Config action
  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: BrandConfig = {
      nombre: nombre.toUpperCase(),
      tagline: tagline.toUpperCase(),
      primaryColor,
      hoverColor,
      logoType,
      selectedIcon,
      customLogoUrl,
      fontFamily
    };
    onSave(updated);
    onAddLog(`🎨 Identidad Visual Actualizada: "${updated.nombre}" con color de marca ${updated.primaryColor} y tipografía "${updated.fontFamily}".`);
    alert('¡Identidad visual guardada con éxito! Todos los paneles de Albelo Detail se han actualizado con consistencia.');
  };

  // Reset to original brand
  const handleResetToDefault = () => {
    if (window.confirm('¿Estás seguro de que deseas restablecer los colores y logos originales de Albelo Detail?')) {
      const original: BrandConfig = {
        nombre: 'ALBELO DETAIL',
        tagline: 'ESTÉTICA VEHICULAR • POLARIZADOS • DETAILING',
        primaryColor: '#dc2626',
        hoverColor: '#b91c1c',
        logoType: 'icon',
        selectedIcon: 'Albelo',
        customLogoUrl: '',
        fontFamily: 'Outfit'
      };
      setNombre(original.nombre);
      setTagline(original.tagline);
      setPrimaryColor(original.primaryColor);
      setHoverColor(original.hoverColor);
      setLogoType(original.logoType);
      setSelectedIcon(original.selectedIcon);
      setCustomLogoUrl('');
      setFontFamily(original.fontFamily);
      onSave(original);
      onAddLog('🔄 Identidad de marca restablecida a la configuración Rosso Albelo de fábrica.');
      alert('Configuración de marca Rosso Albelo reestablecida.');
    }
  };

  // Dynamic preview helper
  const renderPreviewLogo = () => {
    if (logoType === 'custom' && customLogoUrl) {
      return (
        <img 
          src={customLogoUrl} 
          alt="Custom Brand Logo" 
          className="w-10 h-10 object-contain rounded-lg border border-white/[0.08]"
        />
      );
    }
    const IconComponent = LOGO_ICONS.find(i => i.id === selectedIcon)?.component || Car;
    return (
      <div 
        className="p-2 rounded-xl transition duration-200 flex items-center justify-center border"
        style={{ 
          backgroundColor: `${primaryColor}15`, 
          borderColor: `${primaryColor}30`,
          color: primaryColor 
        }}
      >
        <IconComponent className="w-6 h-6 animate-pulse" />
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* Configuration Settings Panel */}
      <form onSubmit={handleSaveConfig} className="lg:col-span-7 space-y-6">
        
        {/* Module Header */}
        <div className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-white/[0.08]">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-primary flex items-center gap-1.5" style={{ color: primaryColor }}>
              <Palette className="w-4 h-4" />
              Ajustes de Marca e Identidad Visual Premium
            </h4>
            <span className="text-[9px] bg-white/[0.04] text-slate-400 border border-white/[0.08] px-1.5 py-0.5 rounded font-mono font-bold">ADMIN v2.8</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Personaliza el ecosistema de Albelo Detail para adaptarlo a tu marca o sucursal. Cambia el esquema de colores globales, sube tu logotipo corporativo, define las tipografías para la cartelería publicitaria, el portal de reservas online y los tickets de facturación impresos AFIP.
          </p>
        </div>

        {/* Section 1: Names & Taglines */}
        <div className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-4">
          <h5 className="text-[10px] uppercase font-bold text-slate-300 tracking-wider flex items-center gap-1.5 border-b border-white/[0.04] pb-2">
            <Layout className="w-3.5 h-3.5 text-slate-400" />
            1. Textos Identificativos de Marca
          </h5>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] text-slate-400 uppercase">Nombre Comercial</label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. ALBELO DETAIL"
                className="w-full bg-[#030406] border border-white/[0.08] focus:border-brand-primary/50 focus:outline-none rounded-lg px-3 py-1.5 text-xs text-white"
                style={{ focusBorderColor: primaryColor }}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] text-slate-400 uppercase">Tagline / Descripción Comercial</label>
              <input
                type="text"
                required
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Ej. ESTÉTICA VEHICULAR • DETAILING"
                className="w-full bg-[#030406] border border-white/[0.08] focus:outline-none rounded-lg px-3 py-1.5 text-xs text-white"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Accent Palette */}
        <div className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-4">
          <h5 className="text-[10px] uppercase font-bold text-slate-300 tracking-wider flex items-center gap-1.5 border-b border-white/[0.04] pb-2">
            <Palette className="w-3.5 h-3.5 text-slate-400" />
            2. Paleta de Colores de Alto Rendimiento
          </h5>

          {/* Quick presets list */}
          <div className="space-y-1.5">
            <span className="block text-[9px] text-slate-500 uppercase font-mono">Paletas de Colores Sugeridas (Estilos Premium)</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {PRESET_COLORS.map((p) => (
                <button
                  key={p.nombre}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  className={`p-2 rounded-lg border text-left transition text-[10px] ${
                    primaryColor === p.primary
                      ? 'bg-white/[0.05] border-slate-400'
                      : 'bg-white/[0.01] border-white/[0.05] hover:border-white/[0.1] hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex gap-1 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: p.primary }} />
                    <span className="w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: p.hover }} />
                  </div>
                  <span className="font-bold text-white truncate block">{p.nombre}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            
            {/* Primary Color Picker */}
            <div className="space-y-1.5">
              <label className="block text-[10px] text-slate-400 uppercase">Color Primario (Acento)</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => handleAutoHoverColor(e.target.value)}
                  className="w-10 h-8 bg-transparent border border-white/[0.08] rounded cursor-pointer"
                />
                <input
                  type="text"
                  maxLength={7}
                  value={primaryColor}
                  onChange={(e) => handleAutoHoverColor(e.target.value)}
                  className="bg-[#030406] border border-white/[0.08] focus:outline-none rounded-lg px-2.5 py-1 text-xs text-white font-mono flex-1"
                />
              </div>
              <span className="text-[8px] text-slate-500 italic">Al cambiar el primario, calculamos el color hover sugerido de forma automática.</span>
            </div>

            {/* Hover Color Picker */}
            <div className="space-y-1.5">
              <label className="block text-[10px] text-slate-400 uppercase">Color Secundario (Hover/Brillo)</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={hoverColor}
                  onChange={(e) => setHoverColor(e.target.value)}
                  className="w-10 h-8 bg-transparent border border-white/[0.08] rounded cursor-pointer"
                />
                <input
                  type="text"
                  maxLength={7}
                  value={hoverColor}
                  onChange={(e) => setHoverColor(e.target.value)}
                  className="bg-[#030406] border border-white/[0.08] focus:outline-none rounded-lg px-2.5 py-1 text-xs text-white font-mono flex-1"
                />
              </div>
            </div>

          </div>
        </div>

        {/* Section 3: Logo & Graphic Brand Mark */}
        <div className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-4">
          <h5 className="text-[10px] uppercase font-bold text-slate-300 tracking-wider flex items-center gap-1.5 border-b border-white/[0.04] pb-2">
            <Image className="w-3.5 h-3.5 text-slate-400" />
            3. Identificador Gráfico (Logo)
          </h5>

          {/* Logo Type Selector */}
          <div className="flex gap-3 bg-white/[0.02] p-1 rounded-lg border border-white/[0.06] w-fit">
            <button
              type="button"
              onClick={() => setLogoType('icon')}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition ${
                logoType === 'icon' ? 'bg-white/[0.06] text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Logo de Icono Premium
            </button>
            <button
              type="button"
              onClick={() => setLogoType('custom')}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition ${
                logoType === 'custom' ? 'bg-white/[0.06] text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Subir Logo Personalizado
            </button>
          </div>

          {/* Render Option 1: Premium Icon selector */}
          {logoType === 'icon' && (
            <div className="space-y-2">
              <span className="block text-[9px] text-slate-500 uppercase font-mono">Seleccionar Icono Corporativo</span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {LOGO_ICONS.map((i) => {
                  const Icon = i.component;
                  const isSelected = selectedIcon === i.id;
                  return (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => setSelectedIcon(i.id)}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-center transition ${
                        isSelected 
                          ? 'bg-white/[0.04] border-slate-400' 
                          : 'bg-[#030406] border-white/[0.05] hover:border-white/[0.1] hover:bg-white/[0.01]'
                      }`}
                    >
                      <Icon className="w-5 h-5 text-slate-300" style={{ color: isSelected ? primaryColor : undefined }} />
                      <span className="text-[9px] font-bold text-slate-400">{i.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Render Option 2: Drag & Drop File Upload */}
          {logoType === 'custom' && (
            <div className="space-y-2">
              <span className="block text-[9px] text-slate-500 uppercase font-mono">Carga de Isologotipo (PNG, SVG, JPG)</span>
              
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={triggerFileInput}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
                  isDragging 
                    ? 'border-brand-primary bg-brand-primary/5' 
                    : 'border-white/[0.1] hover:border-white/[0.2] bg-white/[0.01]'
                }`}
                style={{ 
                  borderColor: isDragging ? primaryColor : undefined,
                  backgroundColor: isDragging ? `${primaryColor}10` : undefined
                }}
              >
                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-2">
                  <div className="p-2.5 rounded-full bg-white/[0.03] text-slate-400">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-300">
                    Arrastra tu logo aquí o <span className="text-red-400 underline hover:text-red-300" style={{ color: primaryColor }}>búscalo en tu PC</span>
                  </p>
                  <p className="text-[9px] text-slate-500">Soporta formatos vectoriales y transparentes. Máx 3MB.</p>
                </div>
              </div>

              {customLogoUrl && (
                <div className="bg-[#030406] p-3 rounded-xl border border-white/[0.04] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img 
                      src={customLogoUrl} 
                      alt="Current custom logo" 
                      className="w-12 h-12 object-contain rounded bg-black/40 p-1 border border-white/[0.08]" 
                    />
                    <div>
                      <span className="text-[10px] text-white font-bold block">Logotipo Personalizado Activo</span>
                      <span className="text-[8px] text-emerald-400 font-mono">✓ Convertido a base64 local</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomLogoUrl('')}
                    className="text-[9px] bg-red-950/40 text-red-400 hover:text-red-300 border border-red-900/30 px-2 py-1 rounded"
                  >
                    Quitar logo
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 4: Typography Preset */}
        <div className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-4">
          <h5 className="text-[10px] uppercase font-bold text-slate-300 tracking-wider flex items-center gap-1.5 border-b border-white/[0.04] pb-2">
            <Type className="w-3.5 h-3.5 text-slate-400" />
            4. Tipografía y Estilo de Fuente
          </h5>

          <div className="space-y-1.5">
            <span className="block text-[9px] text-slate-500 uppercase font-mono">Estilo de Tipografía Principal</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {PRESET_FONTS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFontFamily(f.id)}
                  className={`p-2.5 rounded-lg border text-left transition flex items-center justify-between ${
                    fontFamily === f.id
                      ? 'bg-white/[0.04] border-slate-400'
                      : 'bg-[#030406] border-white/[0.05] hover:border-white/[0.1] hover:bg-white/[0.01]'
                  }`}
                >
                  <span className="text-xs text-slate-200" style={{ fontFamily: `"${f.id}", sans-serif` }}>{f.nombre}</span>
                  {fontFamily === f.id && (
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: primaryColor }} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Form Action Controls */}
        <div className="flex gap-4">
          <button
            type="submit"
            className="flex-1 text-white font-extrabold py-2.5 px-6 rounded-lg text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5 shadow-lg cursor-pointer"
            style={{ 
              backgroundColor: primaryColor,
              boxShadow: `0 4px 20px ${primaryColor}20` 
            }}
          >
            <Save className="w-4 h-4" />
            Guardar y Aplicar Cambios
          </button>
          <button
            type="button"
            onClick={handleResetToDefault}
            className="bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.08] text-slate-300 font-bold py-2.5 px-5 rounded-lg text-xs uppercase tracking-wider transition flex items-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4" />
            Restablecer Albelo original
          </button>
        </div>

      </form>

      {/* Dynamic Live Preview Panel */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* Preview Title Box */}
        <div className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-white/[0.08]">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-emerald-400" />
              Vista Previa Interactiva en Tiempo Real
            </h4>
            <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-1 rounded font-bold font-mono">DYN</span>
          </div>
          <p className="text-[11px] text-slate-400">
            A continuación se renderizan componentes interactivos del sistema Albelo Detail aplicando los valores de tu personalización visual:
          </p>
        </div>

        {/* Live Mock Component 1: Main Header Section */}
        <div className="glass-panel p-4 rounded-xl border border-white/[0.06] space-y-3">
          <span className="text-[9px] text-slate-500 uppercase font-mono block">Mockup 1: Cabecera del Software</span>
          
          <div className="bg-[#030406]/90 border border-white/[0.06] p-3 rounded-lg flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              {renderPreviewLogo()}
              <div>
                <h1 className="text-xs font-extrabold tracking-tight text-white uppercase" style={{ fontFamily: `"${fontFamily}", sans-serif` }}>
                  {nombre || 'ALBELO DETAIL'}
                </h1>
                <span className="text-[8px] text-slate-500 font-semibold tracking-wider block mt-0.5">
                  {tagline || 'ESTÉTICA VEHICULAR'}
                </span>
              </div>
            </div>
            <div className="bg-white/[0.04] p-1 px-2 rounded text-[8px] text-slate-400 font-mono uppercase">
              Admin / POS
            </div>
          </div>
        </div>

        {/* Live Mock Component 2: CTA Buttons & Interactive Cards */}
        <div className="glass-panel p-4 rounded-xl border border-white/[0.06] space-y-3">
          <span className="text-[9px] text-slate-500 uppercase font-mono block">Mockup 2: Tarjetas y Botones de Acción</span>

          <div className="bg-[#030406]/90 border border-white/[0.06] p-4 rounded-lg space-y-3.5">
            <div className="p-3 rounded-lg border flex justify-between items-center transition bg-white/[0.01]" style={{ borderColor: `${primaryColor}25` }}>
              <div className="space-y-0.5">
                <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded font-bold uppercase">Tratamiento Cerámico</span>
                <span className="text-xs font-bold text-white block mt-1">Audi R8 Spyder (SUV)</span>
              </div>
              <span className="text-xs font-mono font-bold" style={{ color: primaryColor }}>$240.000</span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 text-white text-[10px] font-extrabold py-2 rounded-lg uppercase tracking-wider transition"
                style={{ backgroundColor: primaryColor }}
              >
                Confirmar Turno
              </button>
              <button
                type="button"
                className="bg-white/[0.04] text-slate-300 text-[10px] border border-white/[0.08] font-bold py-2 px-3 rounded-lg uppercase tracking-wider"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>

        {/* Live Mock Component 3: Ticket / Invoice Receipt */}
        <div className="glass-panel p-4 rounded-xl border border-white/[0.06] space-y-3">
          <span className="text-[9px] text-slate-500 uppercase font-mono block">Mockup 3: Cabezal de Ticket Impreso AFIP</span>

          <div className="bg-white text-black p-4 rounded-lg font-mono text-[9px] space-y-1.5 border border-white shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 bg-neutral-200 text-black px-2 py-0.5 text-[8px] font-bold">SIM AFIP</div>
            
            <div className="text-center font-bold border-b border-dashed border-neutral-300 pb-1.5 space-y-0.5">
              <div className="text-[11px] tracking-wide" style={{ fontFamily: `"${fontFamily}", sans-serif` }}>
                {nombre || 'ALBELO DETAIL'}
              </div>
              <div className="text-[7px] text-neutral-500">{tagline || 'ESTÉTICA VEHICULAR'}</div>
              <div className="text-[7px] text-neutral-500">CUIT: 30-71649255-9 • RESP. INSCRIPTO</div>
            </div>

            <div className="space-y-0.5 text-neutral-700">
              <div>FECHA: {new Date().toLocaleDateString('es-AR')}</div>
              <div>PATENTE: AB-123-CD</div>
              <div>CLIENTE: PEDRO GOMEZ</div>
            </div>

            <div className="border-t border-dashed border-neutral-300 pt-1 text-right font-bold text-[10px]">
              TOTAL: $140.000,00 ARS
            </div>
          </div>
        </div>

        {/* Brand System Context and Guidelines */}
        <div className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-3.5">
          <h5 className="text-[10px] uppercase font-bold text-slate-300 tracking-wider flex items-center gap-1.5">
            <Info className="w-4 h-4 text-brand-primary" style={{ color: primaryColor }} />
            Consistencia del Sistema
          </h5>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Nuestra arquitectura utiliza el motor de compilación de **Vite** y **Tailwind CSS v4** mediante una vinculación dinámica de variables nativas en el árbol de estilos. Esto garantiza que todos los elementos (incluso animaciones de brillo y rebotes CSS) se recalculen en tiempo de ejecución sin pérdida de performance ni flickering en el renderizado.
          </p>
        </div>

      </div>

    </div>
  );
}
