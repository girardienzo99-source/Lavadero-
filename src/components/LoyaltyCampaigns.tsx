import React, { useState, useRef } from 'react';
import { 
  Users, Award, Gift, Clock, Download, MessageSquare, 
  Search, ShieldAlert, Sparkles, Check, Copy 
} from 'lucide-react';
import { Cliente } from '../types';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface LoyaltyCampaignsProps {
  clientes: Cliente[];
  onAddLog: (message: string) => void;
}

interface CampaignTemplate {
  id: string;
  name: string;
  type: 'RETORNO' | 'VIP';
  title: string;
  benefit: string;
  code: string;
  bgColor: string;
}

export default function LoyaltyCampaigns({
  clientes,
  onAddLog
}: LoyaltyCampaignsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'INACTIVE' | 'VIP'>('ALL');
  const [crmSubTab, setCrmSubTab] = useState<'coupon' | 'prizes'>('coupon');
  
  // Selected client for coupon customization preview
  const [selectedClient, setSelectedClient] = useState<Cliente | null>(clientes[0] || null);
  const [customDiscountCode, setCustomDiscountCode] = useState('ALBELO-LOYAL-10');
  const [activeTemplate, setActiveTemplate] = useState<CampaignTemplate>({
    id: 't_ret',
    name: 'Campaña Retorno 15%',
    type: 'RETORNO',
    title: 'CUPÓN RETORNO',
    benefit: '15% DE DESCUENTO',
    code: 'RETORNO15',
    bgColor: 'linear-gradient(135deg, #dc2626 0%, #1e1b4b 100%)'
  });

  const couponCardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  const templates: CampaignTemplate[] = [
    {
      id: 't_ret',
      name: 'Campaña Retorno 15%',
      type: 'RETORNO',
      title: 'CUPÓN RETORNO',
      benefit: '15% DE DESCUENTO',
      code: 'RETORNO15',
      bgColor: 'linear-gradient(135deg, #dc2626 0%, #1e1b4b 100%)'
    },
    {
      id: 't_vip',
      name: 'Pase VIP Cera Bonificada',
      type: 'VIP',
      title: 'PASE VIP ALBELO',
      benefit: 'EN CERADO CARNAUBA FREE',
      code: 'VIPCARNAUBA',
      bgColor: 'linear-gradient(135deg, #1e1b4b 0%, #030508 100%)'
    },
    {
      id: 't_ceramic',
      name: 'Upgrade Tratamiento Cerámico',
      type: 'VIP',
      title: 'UPGRADE DETAILING',
      benefit: 'SiO2 LIQUIDA BONIFICADA',
      code: 'CERAMICUP',
      bgColor: 'linear-gradient(135deg, #0f172a 0%, #00d2ff 100%)'
    }
  ];

  // Logic to classify clients
  // Inactive: visits > 1 and last visit >= 20 days
  // VIP: visits >= 4
  const classifiedClients = clientes.map(c => {
    const isInactive = c.visitas > 1 && c.ultimaVisitaDiasAgo >= 20;
    const isVip = c.visitas >= 4;
    return {
      ...c,
      isInactive,
      isVip
    };
  });

  // Filtered clients list
  const filteredClients = classifiedClients.filter(c => {
    const matchesSearch = c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.vehiculoPatente.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    if (activeFilter === 'INACTIVE') return c.isInactive;
    if (activeFilter === 'VIP') return c.isVip;
    return true;
  });

  const handleSelectClient = (client: Cliente) => {
    setSelectedClient(client);
    const isVip = client.visitas >= 4;
    const code = `ALBELO-${isVip ? 'VIP' : 'RET'}-${client.vehiculoPatente.slice(0,4).toUpperCase()}`;
    setCustomDiscountCode(code);
  };

  const handleDownloadCoupon = () => {
    if (!couponCardRef.current || !selectedClient) return;

    setDownloading(true);
    // Give canvas slight delay to load styles
    setTimeout(() => {
      html2canvas(couponCardRef.current!, {
        scale: 2, // high res
        useCORS: true,
        backgroundColor: null
      }).then((canvas) => {
        const link = document.createElement('a');
        link.download = `Cupon_${selectedClient.nombre.replace(/\s+/g, '_')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        setDownloading(false);
        onAddLog(`🏆 [MARKETING] Descargado cupón digital PNG para ${selectedClient.nombre} (${customDiscountCode})`);
      }).catch(err => {
        console.error(err);
        setDownloading(false);
      });
    }, 300);
  };

  const generateGiftCardPdf = () => {
    if (!selectedClient) return;

    // Elegant voucher size: 180mm x 90mm
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [180, 90]
    });

    // Luxury Dark Background
    doc.setFillColor(15, 23, 42); // Dark slate
    doc.rect(0, 0, 180, 90, 'F');

    // Double borders
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(1.2);
    doc.rect(4, 4, 172, 82);
    
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.3);
    doc.rect(6, 6, 168, 78);

    // Decorative geometric triangles in corner
    doc.setFillColor(30, 41, 59);
    doc.triangle(140, 4, 176, 4, 176, 40, 'F');
    doc.setFillColor(220, 38, 38);
    doc.triangle(165, 4, 176, 4, 176, 15, 'F');

    // Brand Header
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('ALBELO DETAIL', 15, 16);
    
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('ESTÉTICA & DETALLADO VEHICULAR', 15, 20);

    // Voucher Title
    doc.setTextColor(220, 38, 38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(activeTemplate.title.toUpperCase(), 90, 30, { align: 'center' });

    // Benefit (Big highlight)
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text(activeTemplate.benefit.toUpperCase(), 90, 42, { align: 'center' });

    // Recipient Name
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Preparado exclusivamente para:', 90, 52, { align: 'center' });
    
    doc.setTextColor(234, 179, 8); // Yellow / Gold text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(selectedClient.nombre.toUpperCase(), 90, 58, { align: 'center' });

    // Footer Code block
    doc.setFillColor(30, 41, 59);
    doc.rect(40, 66, 100, 10, 'F');
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.5);
    doc.rect(40, 66, 100, 10, 'D');

    doc.setTextColor(148, 163, 184);
    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.text('CÓDIGO DE VALIDACIÓN:', 45, 72.5);

    doc.setTextColor(255, 255, 255);
    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    doc.text(customDiscountCode, 100, 73);

    // Terms of use
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text('* Válido por 30 días a partir de la emisión. Presentar en recepción antes del servicio.', 90, 81, { align: 'center' });

    doc.save(`Voucher_${selectedClient.nombre.replace(/\s+/g, '_')}.pdf`);
    onAddLog(`🏆 [MARKETING] Descargado voucher de regalo PDF para ${selectedClient.nombre} (${customDiscountCode})`);
  };

  const redeemPrize = (prizeName: string, pointsCost: number) => {
    if (!selectedClient) return;
    const clientPoints = (selectedClient.visitas || 0) * 100;
    if (clientPoints < pointsCost) {
      alert(`Puntos insuficientes. ${selectedClient.nombre} tiene ${clientPoints} puntos (requiere ${pointsCost}).`);
      return;
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [120, 150]
    });

    // Background slate
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 120, 150, 'F');

    // Borders
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(1);
    doc.rect(4, 4, 112, 142);

    // Header
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('ALBELO DETAIL', 60, 15, { align: 'center' });
    
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('CLUB DE PUNTOS & FIDELIZACIÓN', 60, 19, { align: 'center' });

    // Ticket Title
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.5);
    doc.line(20, 24, 100, 24);

    doc.setTextColor(220, 38, 38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('VALE DE CANJE DE PREMIO', 60, 30, { align: 'center' });

    // Prize Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text(prizeName.toUpperCase(), 60, 44, { align: 'center' });

    // Client Info
    doc.setFillColor(30, 41, 59);
    doc.rect(10, 52, 100, 32, 'F');
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.5);
    doc.rect(10, 52, 100, 32, 'D');

    doc.setTextColor(220, 38, 38);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DE LA REDENCIÓN', 15, 58);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Beneficiario: ${selectedClient.nombre.toUpperCase()}`, 15, 66);
    doc.text(`Patente Asociada: ${selectedClient.vehiculoPatente.toUpperCase()}`, 15, 73);
    doc.text(`Costo del Canje: ${pointsCost} PUNTOS`, 15, 80);

    // Barcode simulated lines
    const barY = 92;
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(1.5);
    doc.line(30, barY, 30, barY + 12);
    doc.line(33, barY, 33, barY + 12);
    doc.line(38, barY, 38, barY + 12);
    doc.line(45, barY, 45, barY + 12);
    doc.line(48, barY, 48, barY + 12);
    doc.line(53, barY, 53, barY + 12);
    doc.line(57, barY, 57, barY + 12);
    doc.line(60, barY, 60, barY + 12);
    doc.line(65, barY, 65, barY + 12);
    doc.line(70, barY, 70, barY + 12);
    doc.line(74, barY, 74, barY + 12);
    doc.line(78, barY, 78, barY + 12);
    doc.line(82, barY, 82, barY + 12);
    doc.line(87, barY, 87, barY + 12);
    doc.line(90, barY, 90, barY + 12);
    
    doc.setTextColor(148, 163, 184);
    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.text(`*ALB-RW-${selectedClient.id}-${pointsCost}*`, 60, barY + 16, { align: 'center' });

    // Terms
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Presentar este vale en recepción para retirar el producto o realizar el servicio.', 60, 122, { align: 'center', maxWidth: 90 });
    doc.text('Los puntos canjeados han sido debitados del saldo de fidelización.', 60, 128, { align: 'center', maxWidth: 90 });

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(6.5);
    doc.text(`Emitido el: ${new Date().toLocaleDateString('es-AR')}`, 60, 140, { align: 'center' });

    doc.save(`Premio_${prizeName.replace(/\s+/g, '_')}_${selectedClient.vehiculoPatente.toLowerCase()}.pdf`);
    
    // Mutate visits locally to represent the discount
    selectedClient.visitas = Math.max(0, selectedClient.visitas - (pointsCost / 100));
    onAddLog(`🏆 [LOYALTY] Cliente ${selectedClient.nombre} canjeó premio "${prizeName}" por ${pointsCost} puntos.`);
    alert(`¡Premio "${prizeName}" canjeado con éxito! Se descontaron ${pointsCost} puntos (${pointsCost / 100} visitas) y se descargó el vale PDF.`);
  };

  const getWhatsAppMessage = () => {
    if (!selectedClient) return '';
    if (activeTemplate.type === 'RETORNO') {
      return `¡Hola ${selectedClient.nombre}! 🚗 En Albelo Detail te extrañamos. Hace ${selectedClient.ultimaVisitaDiasAgo} días que no nos visitás. Queremos regalarte un *${activeTemplate.benefit}* en tu próximo servicio presentando este código: *${customDiscountCode}*. Adjuntamos tu pase digital. ¡Te esperamos!`;
    }
    return `¡Hola ${selectedClient.nombre}! 🏆 Queremos agradecer tu confianza continua en Albelo Detail (${selectedClient.visitas} visitas). Te regalamos un *${activeTemplate.benefit}* en tu próximo tratamiento usando el código VIP: *${customDiscountCode}*. Presentá tu tarjeta digital. ¡Saludos de Albelo Detail!`;
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(getWhatsAppMessage());
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
    onAddLog(`📲 [MARKETING] Copiado mensaje pre-redactado de fidelización para ${selectedClient?.nombre}.`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in min-w-0">
      
      {/* COLUMN 1: CRM Client Scan & Filter */}
      <div className="lg:col-span-7 space-y-6">
        <div className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pb-2 border-b border-white/[0.06]">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 font-display">
              <Users className="w-4 h-4 text-brand-primary" />
              Auditoría CRM: Segmentación de Clientes
            </h3>

            {/* Filter buttons */}
            <div className="flex gap-1.5 overflow-x-auto py-0.5">
              {(['ALL', 'INACTIVE', 'VIP'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition ${
                    activeFilter === filter
                      ? 'bg-white/[0.05] text-brand-primary border border-brand-primary/30'
                      : 'bg-white/[0.01] text-slate-400 border border-white/[0.04]'
                  }`}
                >
                  {filter === 'ALL' ? 'Todos' : filter === 'INACTIVE' ? 'Inactivos' : 'VIP / Fieles'}
                </button>
              ))}
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por nombre o patente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/[0.02] border border-white/[0.08] focus:border-brand-primary/50 text-xs text-white rounded-lg pl-8 pr-3 py-1.5 focus:outline-none"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          </div>

          {/* Clients Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin">
            {filteredClients.length === 0 ? (
              <div className="col-span-2 text-center py-12 text-xs text-slate-500 italic">No se encontraron clientes bajo este segmento.</div>
            ) : (
              filteredClients.map((c) => {
                const isSelected = selectedClient?.id === c.id;
                return (
                  <div 
                    key={c.id}
                    onClick={() => handleSelectClient(c)}
                    className={`p-3 rounded-lg border transition duration-200 cursor-pointer flex flex-col justify-between space-y-2.5 relative ${
                      isSelected 
                        ? 'bg-brand-primary/10 border-brand-primary/30 shadow-[0_0_15px_rgba(220,38,38,0.08)]' 
                        : 'bg-[#030406]/30 border-white/[0.04] hover:border-white/[0.08]'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-xs text-slate-200 block">{c.nombre}</span>
                        <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">{c.vehiculoModelo} [{c.vehiculoPatente}]</span>
                      </div>
                      
                      {/* Segment tag */}
                      {c.isVip ? (
                        <span className="text-[8px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.2 rounded font-extrabold flex items-center gap-0.5 shadow-[0_0_8px_rgba(245,158,11,0.2)]">
                          <Award className="w-2.5 h-2.5" />
                          VIP
                        </span>
                      ) : c.isInactive ? (
                        <span className="text-[8px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.2 rounded font-extrabold flex items-center gap-0.5 animate-pulse">
                          <Clock className="w-2.5 h-2.5" />
                          INACTIVO
                        </span>
                      ) : (
                        <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded font-extrabold">
                          ACTIVO
                        </span>
                      )}
                    </div>

                    <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono pt-1 border-t border-white/[0.03]">
                      <span>Visitas: <b>{c.visitas}</b></span>
                      <span>Hace: <b>{c.ultimaVisitaDiasAgo} días</b></span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* COLUMN 2: Coupon Card Creator & Preview */}
      <div className="lg:col-span-5 space-y-6">
        {selectedClient ? (
          <div className="glass-panel p-5 rounded-xl border border-white/[0.08] space-y-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            {/* Sub-tab switcher inside Column 2 */}
            <div className="flex gap-2 bg-black/45 p-1 rounded-lg border border-white/[0.05]">
              <button
                type="button"
                onClick={() => setCrmSubTab('coupon')}
                className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition ${
                  crmSubTab === 'coupon'
                    ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🎟️ Cupón de Descuento
              </button>
              <button
                type="button"
                onClick={() => setCrmSubTab('prizes')}
                className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition ${
                  crmSubTab === 'prizes'
                    ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🎁 Canjear Puntos
              </button>
            </div>

            {crmSubTab === 'coupon' ? (
              <div className="space-y-5">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider pb-2 border-b border-white/[0.06] flex items-center gap-1">
                  <Gift className="w-4 h-4 text-emerald-400" />
                  Generador de Cupones Digitales
                </h3>

                {/* Select template */}
                <div className="space-y-1.5">
                  <label className="block text-[8px] text-slate-400 uppercase tracking-wider font-bold">Seleccionar Campaña</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {templates.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setActiveTemplate(t)}
                        className={`py-1.5 px-2 rounded text-[8px] font-bold uppercase tracking-wider border transition text-center truncate ${
                          activeTemplate.id === t.id
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-white/[0.01] text-slate-500 border-white/[0.04] hover:text-slate-300'
                        }`}
                      >
                        {t.name.split(' ')[1] || t.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom discount code */}
                <div className="space-y-1.5">
                  <label className="block text-[8px] text-slate-400 uppercase tracking-wider font-bold">Código de Descuento Custom</label>
                  <input
                    type="text"
                    value={customDiscountCode}
                    onChange={(e) => setCustomDiscountCode(e.target.value.toUpperCase())}
                    className="w-full bg-white/[0.02] border border-white/[0.08] rounded px-2.5 py-1 text-xs text-white font-mono uppercase"
                  />
                </div>

                {/* CARD PNG PREVIEW CONTAINER */}
                <div className="relative p-1 bg-slate-950 rounded-2xl border border-white/[0.04] shadow-inner max-w-[300px] mx-auto overflow-hidden">
                  
                  <div 
                    ref={couponCardRef}
                    className="p-5 text-center flex flex-col justify-between min-h-[220px] rounded-xl relative overflow-hidden select-none"
                    style={{ background: activeTemplate.bgColor }}
                  >
                    {/* Sports carbon texture or glow effects */}
                    <div className="absolute inset-0 bg-[radial-gradient(#ffffff_0.3px,transparent_0.3px)] [background-size:8px_8px] opacity-10 pointer-events-none" />
                    <div className="absolute -top-12 -left-12 w-28 h-28 rounded-full bg-white/5 blur-xl pointer-events-none" />

                    {/* Header */}
                    <div className="flex justify-between items-center text-white border-b border-white/10 pb-1.5 z-10">
                      <span className="text-[10px] font-black tracking-widest font-display">ALBELO DETAIL</span>
                      <span className="text-[7px] font-mono font-bold tracking-widest bg-white/10 px-1 py-0.2 rounded">COUPON</span>
                    </div>

                    {/* Body details */}
                    <div className="my-3 space-y-1.5 z-10">
                      <span className="text-[8px] text-slate-300 font-extrabold uppercase tracking-widest block">
                        {activeTemplate.title}
                      </span>
                      <h2 className="text-base font-black text-white font-display uppercase tracking-widest leading-none drop-shadow">
                        {activeTemplate.benefit}
                      </h2>
                      <span className="text-[8px] text-white/60 block pt-0.5">
                        Preparado exclusivamente para:
                      </span>
                      <div className="text-[11px] font-black text-yellow-300 uppercase tracking-wide">
                        {selectedClient.nombre}
                      </div>
                    </div>

                    {/* Footer Code */}
                    <div className="bg-black/40 border border-white/10 p-1.5 rounded-lg flex justify-between items-center z-10">
                      <span className="text-[6.5px] text-slate-400 font-mono tracking-widest">PRESENTAR EN EL TALLER:</span>
                      <span className="text-[9.5px] text-white font-mono font-bold tracking-wider">{customDiscountCode}</span>
                    </div>
                  </div>

                </div>

                {/* Copy WhatsApp / Download Actions */}
                <div className="space-y-2">
                  <button
                    onClick={handleCopyText}
                    className="w-full bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 text-[#25D366] font-bold py-2 rounded-lg text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copiedText ? <Check className="w-3.5 h-3.5 text-[#25D366]" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedText ? 'Copiado' : 'Copiar Texto para WhatsApp'}
                  </button>

                  <button
                    onClick={handleDownloadCoupon}
                    disabled={downloading}
                    className="w-full bg-brand-primary hover:bg-brand-hover text-white font-bold py-2 rounded-lg text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {downloading ? 'Capturando...' : 'Descargar Tarjeta PNG'}
                  </button>

                  <button
                    onClick={generateGiftCardPdf}
                    className="w-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-400 font-bold py-2 rounded-lg text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar Gift Card PDF
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-white/[0.06]">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-display">
                    <Award className="w-4 h-4 text-brand-primary" />
                    Canje de Premios por Fidelidad
                  </h3>
                  <span className="font-mono text-[10px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                    {(selectedClient.visitas || 0) * 100} pts
                  </span>
                </div>

                <p className="text-[10px] text-slate-400 leading-normal">
                  <b>{selectedClient.nombre}</b> acumuló <b>{(selectedClient.visitas || 0) * 100} puntos</b> (equivalente a {selectedClient.visitas} visitas). Podés canjearlos por premios físicos o servicios bonificados:
                </p>

                {/* Prizes Grid Catalog */}
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {[
                    { name: 'Pino Aromatizante Classic', cost: 100, icon: '🌲' },
                    { name: 'Lavado de Motor Express', cost: 300, icon: '⚙️' },
                    { name: 'Encerado Rápido de Carnauba', cost: 500, icon: '✨' },
                    { name: 'Lavado Simple Bonificado', cost: 800, icon: '🧼' },
                    { name: 'Tratamiento Cerámico SiO2 Express', cost: 1500, icon: '💎' }
                  ].map((prize, idx) => {
                    const clientPoints = (selectedClient.visitas || 0) * 100;
                    const canClaim = clientPoints >= prize.cost;

                    return (
                      <div 
                        key={idx}
                        className={`flex justify-between items-center p-2.5 rounded-xl border transition ${
                          canClaim 
                            ? 'bg-white/[0.02] border-white/[0.08] hover:border-brand-primary/20' 
                            : 'bg-black/40 border-white/[0.03] opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{prize.icon}</span>
                          <div>
                            <span className="font-bold text-slate-200 block text-xs">{prize.name}</span>
                            <span className="text-[9px] text-slate-500 font-mono">Requerido: {prize.cost} pts</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={!canClaim}
                          onClick={() => redeemPrize(prize.name, prize.cost)}
                          className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all cursor-pointer ${
                            canClaim
                              ? 'bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {canClaim ? 'Canjear' : 'Bloqueado'}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-slate-900/50 rounded-xl p-2.5 text-[9px] border border-white/[0.03] leading-relaxed text-slate-500 font-light">
                  Nota: El canje deducirá automáticamente los puntos de su historial. Esto descargará el Vale en PDF para el operario.
                </div>
              </div>
            )}

          </div>
        ) : (
          <div className="glass-panel p-6 rounded-xl border border-white/[0.08] text-center text-xs text-slate-500 italic">
            Selecciona un cliente de la lista de segmentación del CRM para empezar a crear el cupón de fidelización.
          </div>
        )}
      </div>

    </div>
  );
}
