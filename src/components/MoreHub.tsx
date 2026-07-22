import React from 'react';
import { BadgePercent, FileSpreadsheet, FileText, Globe, Package, Palette, Settings, Sparkles } from 'lucide-react';

export type MoreModule = 'excel' | 'inventario' | 'facturacion' | 'publicidad' | 'public-page' | 'ceramic' | 'branding';

interface MoreHubProps {
  onSelect: (module: MoreModule) => void;
}

const modules = [
  { id: 'excel', title: 'Excel', description: 'Exportar la operación e importar clientes.', icon: FileSpreadsheet },
  { id: 'inventario', title: 'Inventario', description: 'Stock, compras y proveedores.', icon: Package },
  { id: 'facturacion', title: 'Facturación', description: 'Comprobantes y configuración fiscal.', icon: FileText },
  { id: 'ceramic', title: 'Servicios especiales', description: 'Presupuestos y tratamientos cerámicos.', icon: Sparkles },
  { id: 'publicidad', title: 'Marketing', description: 'Promociones, fidelización y WhatsApp.', icon: BadgePercent },
  { id: 'public-page', title: 'Portal público', description: 'Reservas y promociones para clientes.', icon: Globe },
  { id: 'branding', title: 'Configuración', description: 'Marca, colores y datos del negocio.', icon: Palette },
] satisfies Array<{ id: MoreModule; title: string; description: string; icon: typeof Settings }>;

export default function MoreHub({ onSelect }: MoreHubProps) {
  return (
    <section className="space-y-5 animate-fade-in" aria-labelledby="more-title">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-primary">Administración</p>
        <h2 id="more-title" className="mt-1 text-3xl font-black text-white">Más herramientas</h2>
        <p className="mt-1 text-sm text-slate-400">Funciones de uso ocasional separadas del trabajo diario.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map(({ id, title, description, icon: Icon }) => (
          <button key={id} type="button" onClick={() => onSelect(id)} className="glass-panel group flex min-h-32 items-start gap-4 rounded-xl p-5 text-left transition hover:-translate-y-0.5 hover:border-brand-primary/40 hover:bg-white/5">
            <span className="rounded-xl bg-brand-primary/10 p-3 text-brand-primary"><Icon className="h-5 w-5" /></span>
            <span>
              <span className="block font-extrabold text-white group-hover:text-brand-primary">{title}</span>
              <span className="mt-1 block text-sm leading-relaxed text-slate-400">{description}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
