export type Rol = 'SUPERADMIN' | 'ADMIN' | 'CAJERO' | 'OPERARIO' | 'LAVADOR';

export interface SessionUser {
  id?: number | string;
  nombre: string;
  username?: string;
  rol: string;
  token: string;
  expiresAt?: number;
}

export interface Cliente {
  id: string;
  nombre: string;
  telefono: string;
  vehiculoPatente: string;
  vehiculoModelo: string;
  visitas: number;
  ultimaVisitaDiasAgo: number;
}

export type TipoServicio = 'LAVADO' | 'TAPICERIA' | 'ESTETICA';

export interface DamageChecklist {
  paragolpesDelantero: boolean;
  paragolpesTrasero: boolean;
  puertaDerecha: boolean;
  puertaIzquierda: boolean;
  capot: boolean;
  techo: boolean;
  vidrios: boolean;
  llantas: boolean;
  interior: boolean;
}

export interface VehicleHealthData {
  patente: string;
  nivelSuciedad: 'BAJO' | 'MEDIO' | 'ALTO' | 'EXTREMO';
  checklistDanos: DamageChecklist;
  observaciones: string;
  fotos: { sector: string; url: string; descripcion: string }[];
  /** Compatibilidad temporal con inspecciones de versiones anteriores. */
  fotosSimuladas?: { sector: string; url: string; descripcion: string }[];
  operarioInspector: string;
  fechaInspeccion: string;
}

export interface Turno {
  id: string;
  clienteId: string;
  clienteNombre: string;
  telefono: string;
  vehiculoPatente: string;
  vehiculoModelo: string;
  tipo: TipoServicio;
  servicioNombre: string;
  lavadorAsignado: string;
  estado: 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADO' | 'ENTREGADO';
  precio: number;
  fechaCreacion: string;
  npsScore?: number; // 1-5 estrellas
  comentarios?: string;
  isCeramic?: boolean;
  ceramicNivel?: string;
  tamanoVehiculo?: 'AUTO' | 'SUV' | 'CAMIONETA';
  healthData?: VehicleHealthData;
}

export interface Insumo {
  id: string;
  nombre: string;
  stockActual: number;
  stockMinimo: number;
  unidad: string;
  precioCosto: number;
}

export interface Transaccion {
  id: string;
  tipo: 'INGRESO' | 'EGRESO';
  monto: number;
  concepto: string;
  origen: 'TURNO' | 'VENTA_POS' | 'MANUAL';
  fecha: string;
  metodoPago?: 'EFECTIVO' | 'TRANSFERENCIA' | 'DEBITO' | 'CREDITO';
  turnoId?: string;
}

export interface TemplatePublicidad {
  id: string;
  titulo: string;
  subtitulo: string;
  servicio: TipoServicio;
  descuento: number;
  colorFondo: string;
  colorTexto: string;
  imagenIcono: string;
}

export interface BrandConfig {
  nombre: string;
  tagline: string;
  primaryColor: string;
  hoverColor: string;
  logoType: 'icon' | 'custom';
  selectedIcon: string;
  customLogoUrl?: string;
  fontFamily: string;
}
