import { Cliente, Turno, Insumo, Transaccion, TemplatePublicidad } from '../types';

export const INITIAL_CLIENTES: Cliente[] = [
  { id: 'c1', nombre: 'Carlos Mendoza', telefono: '+5492615551234', vehiculoPatente: 'AB123CD', vehiculoModelo: 'Toyota Corolla (Gris)', visitas: 5, ultimaVisitaDiasAgo: 4 },
  { id: 'c2', nombre: 'Mariana Gomez', telefono: '+5492615555678', vehiculoPatente: 'AE987FG', vehiculoModelo: 'Ford Fiesta (Blanco)', visitas: 2, ultimaVisitaDiasAgo: 24 }, // Candidate for loyalty campaign!
  { id: 'c3', nombre: 'Juan Ignacio Perez', telefono: '+5492615559012', vehiculoPatente: 'AA654BB', vehiculoModelo: 'Honda Civic (Negro)', visitas: 8, ultimaVisitaDiasAgo: 32 }, // Candidate for loyalty campaign!
  { id: 'c4', nombre: 'Sofía Martínez', telefono: '+5491134567890', vehiculoPatente: 'AF321CC', vehiculoModelo: 'Jeep Renegade (Azul)', visitas: 1, ultimaVisitaDiasAgo: 2 },
  { id: 'c5', nombre: 'Lucas Silva', telefono: '+5493514561122', vehiculoPatente: 'AD741XX', vehiculoModelo: 'Volkswagen Golf (Gris Oscuro)', visitas: 12, ultimaVisitaDiasAgo: 15 },
  { id: 'c6', nombre: 'Alejandro Rossi', telefono: '+5492614553344', vehiculoPatente: 'AC852ZZ', vehiculoModelo: 'Chevrolet Cruze (Rojo)', visitas: 4, ultimaVisitaDiasAgo: 28 }, // Candidate for loyalty campaign!
];

export const INITIAL_TURNOS: Turno[] = [
  {
    id: 't1',
    clienteId: 'c1',
    clienteNombre: 'Carlos Mendoza',
    telefono: '+5492615551234',
    vehiculoPatente: 'AB123CD',
    vehiculoModelo: 'Toyota Corolla',
    tipo: 'LAVADO',
    servicioNombre: 'Lavado Premium + Encerado',
    lavadorAsignado: 'Mateo',
    estado: 'EN_PROCESO',
    precio: 35000,
    fechaCreacion: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  },
  {
    id: 't2',
    clienteId: 'c4',
    clienteNombre: 'Sofía Martínez',
    telefono: '+5491134567890',
    vehiculoPatente: 'AF321CC',
    vehiculoModelo: 'Jeep Renegade',
    tipo: 'TAPICERIA',
    servicioNombre: 'Limpieza de Butacas con Extracción',
    lavadorAsignado: 'Enzo',
    estado: 'PENDIENTE',
    precio: 75000,
    fechaCreacion: new Date(Date.now() - 1800000).toISOString(), // 30 mins ago
  },
  {
    id: 't3',
    clienteId: 'c5',
    clienteNombre: 'Lucas Silva',
    telefono: '+5493514561122',
    vehiculoPatente: 'AD741XX',
    vehiculoModelo: 'Volkswagen Golf',
    tipo: 'ESTETICA',
    servicioNombre: 'Corrección de Pintura en 1 Paso + Tratamiento Acrílico',
    lavadorAsignado: 'Santiago',
    estado: 'COMPLETADO',
    precio: 120000,
    fechaCreacion: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    npsScore: 5,
    comentarios: 'Impresionante brillo, quedó mejor que nuevo.'
  }
];

export const INITIAL_INSUMOS: Insumo[] = [
  { id: 'i1', nombre: 'Shampoo pH Neutro Concentrado', stockActual: 15, stockMinimo: 5, unidad: 'Lts', precioCosto: 3200 },
  { id: 'i2', nombre: 'Silicona Premium Exterior (Brillo)', stockActual: 3, stockMinimo: 5, unidad: 'Lts', precioCosto: 4500 }, // LOW STOCK!
  { id: 'i3', nombre: 'Cera Rápida de Carnauba líquida', stockActual: 2, stockMinimo: 4, unidad: 'Lts', precioCosto: 6000 }, // LOW STOCK!
  { id: 'i4', nombre: 'Limpiador de Tapizados APC', stockActual: 8, stockMinimo: 3, unidad: 'Lts', precioCosto: 2800 },
  { id: 'i5', nombre: 'Compuesto Pulidor de Corte Medio', stockActual: 0, stockMinimo: 2, unidad: 'Unidades', precioCosto: 12500 }, // OUT OF STOCK!
  { id: 'i6', nombre: 'Paños de Microfibra 40x40 (Gris)', stockActual: 25, stockMinimo: 10, unidad: 'Unidades', precioCosto: 850 },
  { id: 'i7', nombre: 'Sellador Cerámico Híbrido SiO2', stockActual: 4, stockMinimo: 2, unidad: 'Unidades', precioCosto: 18000 }
];

export const SERVICIOS_DISPONIBLES = {
  LAVADO: [
    { nombre: 'Lavado Express Exterior', precioBase: 15000, duracion: '30 min', desc: 'Lavado con hidrolavadora, shampoo pH neutro, secado rápido y silicona de neumáticos.' },
    { nombre: 'Lavado Premium + Aspirado', precioBase: 25000, duracion: '60 min', desc: 'Lavado completo manual, aspirado profundo de alfombras, limpieza de torpedo, vidrios y silicona.' },
    { nombre: 'Lavado Premium + Encerado', precioBase: 35000, duracion: '90 min', desc: 'Lavado Premium + aplicación de cera rápida de Carnauba para mayor brillo y repelencia.' },
    { nombre: 'Lavado Técnico de Chasis y Motor', precioBase: 42000, duracion: '120 min', desc: 'Lavado de motor con desengrasante dieléctrico y sellador protector de plásticos + lavado de chasis inferior.' }
  ],
  TAPICERIA: [
    { nombre: 'Limpieza de Butacas (Tela)', precioBase: 70000, duracion: '3 hs', desc: 'Limpieza profunda con máquina de inyección-extracción y desinfección a vapor.' },
    { nombre: 'Nutrición y Limpieza de Cuero', precioBase: 85000, duracion: '2.5 hs', desc: 'Limpieza suave con cepillo de cerdas naturales + acondicionador de cuero pH neutro mate.' },
    { nombre: 'Desinfección & Limpieza Completa de Habitáculo', precioBase: 130000, duracion: '5 hs', desc: 'Techo, alfombras, butacas, paneles de puertas, torpedo y sanitización con ozono.' }
  ],
  ESTETICA: [
    { nombre: 'Pulido de Ópticas y Sellado', precioBase: 30000, duracion: '1.5 hs', desc: 'Lijado al agua de ópticas opacas, pulido rotativo de corte y brillo + sellador acrílico protector UV.' },
    { nombre: 'Corrección de Pintura (1 Paso) + Tratamiento Acrílico', precioBase: 120000, duracion: '6 hs', desc: 'Eliminación del 60-70% de micro-rayas (swirls), abrillantador y protección acrílica por 6 meses.' },
    { nombre: 'Tratamiento Cerámico SiO2 (9H)', precioBase: 240000, duracion: '12 hs', desc: 'Corrección de pintura en 2 pasos para máximo reflejo + sellador cerámico de alta dureza por 2 años.' },
    { nombre: 'Reparación Estética de Abolladuras (Sacabollos)', precioBase: 45000, duracion: '2 hs', desc: 'Remoción de abolladuras pequeñas sin dañar la pintura original del vehículo mediante varillas.' }
  ]
};

export const INITIAL_TEMPLATES: TemplatePublicidad[] = [
  {
    id: 'temp1',
    titulo: 'SUPER COMBO ESTÉTICO',
    subtitulo: 'Pulido de ópticas + Encerado 3M',
    servicio: 'ESTETICA',
    descuento: 25,
    colorFondo: 'from-amber-600 to-red-600',
    colorTexto: 'text-white',
    imagenIcono: 'Sparkles'
  },
  {
    id: 'temp2',
    titulo: 'CHAU MANCHAS Y OLORES',
    subtitulo: 'Limpieza de Butacas Extracción + Sanitizado',
    servicio: 'TAPICERIA',
    descuento: 15,
    colorFondo: 'from-blue-600 to-indigo-700',
    colorTexto: 'text-white',
    imagenIcono: 'SprayCan'
  },
  {
    id: 'temp3',
    titulo: 'LAVADO PREMIUM FULL',
    subtitulo: 'Lavado Completo + Silicona + Perfume',
    servicio: 'LAVADO',
    descuento: 20,
    colorFondo: 'from-emerald-600 to-teal-700',
    colorTexto: 'text-white',
    imagenIcono: 'Car'
  }
];

export const LAVADORES_ACTIVOS = ['Mateo', 'Enzo', 'Santiago', 'Julián', 'Sofía'];

export const INITIAL_TRANSACCIONES: Transaccion[] = [
  { id: 'tr1', tipo: 'INGRESO', monto: 35000, concepto: 'Monto Apertura de Caja', origen: 'MANUAL', fecha: new Date(Date.now() - 14400000).toISOString() }, // 4h ago
  { id: 'tr2', tipo: 'INGRESO', monto: 120000, concepto: 'Pago Turno #t3 - Lucas Silva', origen: 'TURNO', fecha: new Date(Date.now() - 7200000).toISOString() }, // 2h ago
  { id: 'tr3', tipo: 'EGRESO', monto: 8500, concepto: 'Compra urgente de Microfibras de repuesto', origen: 'MANUAL', fecha: new Date(Date.now() - 3600000).toISOString() } // 1h ago
];
