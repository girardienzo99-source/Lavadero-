import React, { lazy, Suspense, useState, useEffect } from 'react';
import { 
  Car, Shield, Sparkles, Droplet, Users, DollarSign, Package, 
  Terminal, ShieldAlert, BadgePercent, CheckCircle, HelpCircle, 
  ChevronRight, RefreshCw, AlertCircle, Plus, Info, Star, Trash2,
  FileText, Globe, MessageSquare, Crown, Flame, Palette, LogOut
} from 'lucide-react';
import { Rol, Cliente, Turno, Insumo, Transaccion, TipoServicio, BrandConfig, SessionUser } from './types';
import Login from './components/Login';
import EssentialToday from './components/EssentialToday';
import ClientsView from './components/ClientsView';
import MoreHub, { MoreModule } from './components/MoreHub';
import type { ExcelClientRow } from './components/ExcelIntegration';

type PrimaryTab = 'overview' | 'turnos' | 'caja' | 'clientes' | 'more';
type AppTab = PrimaryTab | 'legacy-overview' | 'excel' | 'publicidad' | 'roadmap' | 'public-page' | 'inventario' | 'ceramic' | 'branding';

const PromoPosterCreator = lazy(() => import('./components/PromoPosterCreator'));
const LoyaltyCampaigns = lazy(() => import('./components/LoyaltyCampaigns'));
const CajaDiariaLedger = lazy(() => import('./components/CajaDiariaLedger'));
const TurnosKanbanView = lazy(() => import('./components/TurnosKanbanView'));
const ArgentineFacturacion = lazy(() => import('./components/ArgentineFacturacion'));
const PublicPage = lazy(() => import('./components/PublicPage'));
const InventoryManagement = lazy(() => import('./components/InventoryManagement'));
const CeramicServices = lazy(() => import('./components/CeramicServices'));
const BrandSettings = lazy(() => import('./components/BrandSettings'));
const WhatsAppCRMHub = lazy(() => import('./components/WhatsAppCRMHub'));
const ExcelIntegration = lazy(() => import('./components/ExcelIntegration'));

const EmployeeCommissions = lazy(() => import('./components/EmployeeCommissions'));

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<AppTab>('overview');
  const [cajaSubTab, setCajaSubTab] = useState<'pos' | 'facturacion' | 'comisiones'>('pos');
  const [statsSubTab, setStatsSubTab] = useState<'semanal' | 'mix' | 'lavadores'>('semanal');
  const [subTabPublicidad, setSubTabPublicidad] = useState<'flyers' | 'loyalty' | 'whatsapp-crm'>('flyers');
  const [preselectedClienteId, setPreselectedClienteId] = useState<string | undefined>(undefined);

  // Session state
  const [session, setSession] = useState<SessionUser | null>(() => {
    const saved = localStorage.getItem('session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as SessionUser;
        return parsed?.token ? parsed : null;
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    const handleSessionExpired = () => setSession(null);
    window.addEventListener('lavadero:session-expired', handleSessionExpired);
    return () => window.removeEventListener('lavadero:session-expired', handleSessionExpired);
  }, []);

  // Role Base Access Control State
  const [currentRole, setCurrentRole] = useState<Rol>('LAVADOR');

  // Database synchronization state
  const [dbOnline, setDbOnline] = useState(true);
  const [dataStatus, setDataStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  // Core App States
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [rawDbData, setRawDbData] = useState<any>(null);
  
  // Brand Configuration State (Durable client persistence)
  const [brandConfig, setBrandConfig] = useState<BrandConfig>(() => {
    const saved = localStorage.getItem('albelo_brand_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    return {
      nombre: 'ALBELO DETAIL',
      tagline: 'ESTÉTICA VEHICULAR • POLARIZADOS • DETAILING',
      primaryColor: '#dc2626',
      hoverColor: '#b91c1c',
      logoType: 'icon',
      selectedIcon: 'Albelo',
      customLogoUrl: '',
      fontFamily: 'Outfit'
    };
  });

  const handleSaveBrandConfig = (newConfig: BrandConfig) => {
    setBrandConfig(newConfig);
    localStorage.setItem('albelo_brand_config', JSON.stringify(newConfig));
  };

  const renderBrandLogo = (sizeClass = "w-6 h-6") => {
    if (brandConfig.logoType === 'custom' && brandConfig.customLogoUrl) {
      return (
        <img 
          src={brandConfig.customLogoUrl} 
          alt="Brand Logo" 
          className={`${sizeClass} object-contain rounded-lg`}
        />
      );
    }
    switch (brandConfig.selectedIcon) {
      case 'Albelo':
        return (
          <svg className={sizeClass} viewBox="0 0 100 100" fill="currentColor">
            <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="6" />
            <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2" />
            <path d="M30 68 L50 26 L70 68 M36 54 L64 54" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        );
      case 'Sparkles':
        return <Sparkles className={sizeClass} />;
      case 'Shield':
        return <Shield className={sizeClass} />;
      case 'Crown':
        return <Crown className={sizeClass} />;
      case 'Flame':
        return <Flame className={sizeClass} />;
      case 'Car':
      default:
        return <Car className={sizeClass} />;
    }
  };
  
  // Cashier Drawer state
  const [cajaAbierta, setCajaAbierta] = useState(false);
  const [montoApertura, setMontoApertura] = useState(0);

  // Workshop work bays state (persistent via localStorage)
  const [bays, setBays] = useState<{ [key: string]: string | null }>(() => {
    try {
      const saved = localStorage.getItem('albelo_bays');
      return saved ? JSON.parse(saved) : { box1: null, box2: null, box3: null };
    } catch {
      return { box1: null, box2: null, box3: null };
    }
  });

  useEffect(() => {
    localStorage.setItem('albelo_bays', JSON.stringify(bays));
  }, [bays]);

  // Background Console Log simulator state
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    '🟢 [SYS] Panel de gestión iniciado.',
    '🔄 [DB] Verificando sincronización con Supabase…'
  ]);

  // Modals
  const [showAddClientForm, setShowAddClientForm] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientPatente, setNewClientPatente] = useState('');
  const [newClientModelo, setNewClientModelo] = useState('');

  // Toast notifications (simulated)
  const [toasts, setToasts] = useState<{ id: string; text: string; type: 'success' | 'warning' | 'info' }[]>([]);

  // Show dynamic toast alert
  const showToast = (text: string, type: 'success' | 'warning' | 'info' = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Add a log to the retro console
  const addConsoleLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('es-AR');
    setConsoleLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
    showToast(message.replace(/^[^\s]+\s/, ''), 'info');
  };

  // Synchronize role based on Supabase session
  useEffect(() => {
    if (session) {
      const normalizedRole = session.rol.toLocaleLowerCase('es-AR');
      const isManager = normalizedRole === 'superadmin' || normalizedRole === 'administrador' || normalizedRole === 'admin';
      const isCashier = normalizedRole === 'cajero' || normalizedRole === 'caja';
      setCurrentRole(isManager ? 'SUPERADMIN' : isCashier ? 'CAJERO' : 'OPERARIO');
    }
  }, [session]);

  // REST API dashboard loader
  const loadDashboardData = () => {
    if (!dbOnline) return;

    setDataStatus('checking');
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12000);

    fetch('/api/dashboard-data', { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || `Error HTTP ${res.status}`);
        return data;
      })
      .then((data) => {
        if (data.status !== 'success') {
          throw new Error(data.message || 'La API devolvió una respuesta incompleta.');
        }

          setRawDbData(data);

          // Map DB clients
          const mappedClientes: Cliente[] = (data.clientes || []).map((c: any) => {
            const clientVehicles = (data.vehiculos || []).filter((v: any) => v.cliente_id === c.id);
            const pat = clientVehicles.map((v: any) => v.patente).join(', ') || 'Sin Auto';
            const mod = clientVehicles.map((v: any) => `${v.marca} ${v.modelo}`).join(', ') || 'Sin Auto';
            
            const clientIdStr = String(c.id);
            const localMembSaved = localStorage.getItem(`albelo_membership_${clientIdStr}`);
            const membership = localMembSaved ? JSON.parse(localMembSaved) : {};
            
            return {
              id: clientIdStr,
              nombre: c.nombre,
              telefono: c.telefono || '',
              vehiculoPatente: pat,
              vehiculoModelo: mod,
              visitas: (data.turnos || []).filter((t: any) => t.cliente_id === c.id && (t.estado === 'COMPLETADO' || t.estado === 'ENTREGADO')).length || 0,
              ultimaVisitaDiasAgo: c.ultima_visita ? Math.max(0, Math.floor((Date.now() - new Date(c.ultima_visita).getTime()) / (1000 * 60 * 60 * 24))) : 99,
              ...membership
            };
          });
          setClientes(mappedClientes);

          // Map DB turnos
          const mappedTurnos: Turno[] = (data.turnos || []).map((t: any) => {
            let cat: TipoServicio = 'LAVADO';
            const nameLower = t.servicio_nombre.toLowerCase();
            const isCeramic = nameLower.includes('cerámico') || nameLower.includes('ceramico') || nameLower.includes('grafeno');
            if (nameLower.includes('tapizado') || nameLower.includes('butaca') || nameLower.includes('habitáculo')) {
              cat = 'TAPICERIA';
            } else if (nameLower.includes('tratamiento') || nameLower.includes('pulido') || nameLower.includes('cerámico') || nameLower.includes('óptica')) {
              cat = 'ESTETICA';
            }

            const clientInfo = mappedClientes.find(c => c.nombre === t.cliente_nombre);

            return {
              id: String(t.id),
              clienteId: String(t.cliente_id || ''),
              clienteNombre: t.cliente_nombre || '',
              telefono: clientInfo?.telefono || '',
              vehiculoPatente: t.patente || '',
              vehiculoModelo: (data.vehiculos || []).find((v: any) => v.patente === t.patente)?.modelo || 'Auto',
              tipo: cat,
              servicioNombre: t.servicio_nombre,
              lavadorAsignado: t.empleado_nombre || 'Sin asignar',
              estado: t.estado,
              precio: Number(t.precio),
              fechaCreacion: t.fecha_hora,
              isCeramic,
              npsScore: t.nps_puntuacion || undefined,
              comentarios: t.comentario_feedback || undefined
            };
          });
          setTurnos(mappedTurnos);

          // Map DB insumos
          const mappedInsumos: Insumo[] = (data.productos || []).map((p: any) => ({
            id: String(p.id),
            nombre: p.nombre,
            stockActual: p.stock,
            stockMinimo: p.stock_minimo,
            unidad: 'U',
            precioCosto: Number(p.precio_compra)
          }));
          setInsumos(mappedInsumos);

          // Map DB cash ledger transactions
          const mappedTx: Transaccion[] = (data.cajaMovimientos || []).map((m: any) => ({
            id: String(m.id),
            tipo: m.tipo as 'INGRESO' | 'EGRESO',
            monto: Number(m.monto),
            concepto: m.descripcion,
            origen: m.origen === 'TURNO' || m.origen === 'VENTA_POS' || m.origen === 'MANUAL'
              ? m.origen
              : (m.descripcion.includes('Venta POS') ? 'VENTA_POS' : (m.descripcion.includes('Turno') ? 'TURNO' : 'MANUAL')),
            fecha: m.fecha || `${new Date().toISOString().split('T')[0]}T${m.hora || '00:00'}:00`,
            metodoPago: m.metodo_pago || undefined,
            turnoId: m.turno_id ? String(m.turno_id) : undefined
          }));
          setTransacciones(mappedTx);

          // Map cashbox
          if (data.caja) {
            setCajaAbierta(data.caja.estado === 'ABIERTA');
            setMontoApertura(Number(data.caja.monto_apertura));
          } else {
            setCajaAbierta(false);
          }
          setDbOnline(true);
          setDataStatus('online');
          setLastSyncAt(new Date());
      })
      .catch((err) => {
        console.error("Error loading dashboard data:", err);
        setDataStatus('offline');
        setDbOnline(false);
        showToast(
          err instanceof DOMException && err.name === 'AbortError'
            ? 'La sincronización demoró demasiado. Se mantienen los últimos datos disponibles.'
            : 'No se pudo sincronizar con Supabase. Se mantienen los últimos datos disponibles.',
          'warning'
        );
      })
      .finally(() => window.clearTimeout(timeoutId));
  };

  useEffect(() => {
    if (session) {
      loadDashboardData();
    }
  }, [session, dbOnline]);

  // Core Handlers connected to real API
  const handleAddTurno = async (newT: Turno): Promise<{ id: string }> => {
    if (!dbOnline || !rawDbData) {
      showToast('No se puede agendar sin conexión y datos sincronizados.', 'warning');
      throw new Error('No hay conexión con Supabase.');
    }

    if (dbOnline && rawDbData) {
      const clienteObj = rawDbData.clientes?.find((c: any) => c.nombre === newT.clienteNombre);
      const vehiculoObj = rawDbData.vehiculos?.find((v: any) => v.patente === newT.vehiculoPatente);
      const servicioObj = rawDbData.servicios?.find((s: any) => s.nombre === newT.servicioNombre || newT.servicioNombre.includes(s.nombre));
      const empleadoObj = rawDbData.empleados?.find((e: any) => e.nombre === newT.lavadorAsignado);

      const insertTurno = async (cId: number | string, vId: number | string, sId: number | string) => {
        let url = `/api/turnos/agendar?clienteId=${cId}&vehiculoId=${vId}&servicioId=${sId}&fechaHora=${newT.fechaCreacion.replace('T', ' ').slice(0, 19)}`;
        if (empleadoObj) {
          url += `&empleadoId=${empleadoObj.id}`;
        }

        const response = await fetch(url, { method: 'POST' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.status !== 'success' || !data.id) {
          throw new Error(data.detail || 'Supabase no confirmó el turno.');
        }
        addConsoleLog(`📅 [REST] Turno agendado en Supabase ID: ${data.id}`);
        loadDashboardData();
        return { id: String(data.id) };
      };

      if (clienteObj && vehiculoObj && servicioObj) {
        return await insertTurno(clienteObj.id, vehiculoObj.id, servicioObj.id);
      }

      if (servicioObj) {
        // Step 1: Create client if missing
        const getOrCreateClient = (): Promise<number | string> => {
          if (clienteObj) return Promise.resolve(clienteObj.id);
          const cliUrl = `/api/clientes/nuevo?nombre=${encodeURIComponent(newT.clienteNombre)}&telefono=${encodeURIComponent(newT.telefono || '+549261000000')}`;
          return fetch(cliUrl, { method: 'POST' })
            .then(async res => {
              const data = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(data.detail || 'No se pudo crear el cliente.');
              return data;
            })
            .then(data => {
              if (data.status === 'success') return data.id;
              throw new Error('Failed to create client');
            });
        };

        // Step 2: Create vehicle if missing
        const getOrCreateVehicle = (cId: number | string): Promise<number | string> => {
          if (vehiculoObj) return Promise.resolve(vehiculoObj.id);
          const vehUrl = `/api/vehiculos/nuevo?clienteId=${cId}&patente=${encodeURIComponent(newT.vehiculoPatente.toUpperCase())}&marca=Auto&modelo=${encodeURIComponent(newT.vehiculoModelo || 'Vehículo Cliente Online')}`;
          return fetch(vehUrl, { method: 'POST' })
            .then(async res => {
              const data = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(data.detail || 'No se pudo crear el vehículo.');
              return data;
            })
            .then(data => {
              if (data.status === 'success') return data.id;
              throw new Error('Failed to create vehicle');
            });
        };

        const clientId = await getOrCreateClient();
        const vehicleId = await getOrCreateVehicle(clientId);
        return await insertTurno(clientId, vehicleId, servicioObj.id);
      }
    }

    showToast('El servicio seleccionado no existe en la base de datos.', 'warning');
    throw new Error('El servicio seleccionado no existe en el catálogo sincronizado.');
  };

  const handleUpdateTurnoEstado = (
    id: string, 
    nuevoEstado: 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADO' | 'ENTREGADO',
    nps?: number,
    comentarios?: string
  ) => {
    if (!dbOnline || id.startsWith('t_')) {
      showToast('No se puede actualizar un turno sin sincronización real.', 'warning');
      return;
    }

    fetch(`/api/turnos/${id}/transiciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: nuevoEstado })
    })
        .then((res) => res.json())
        .then((data) => {
          if (data.status === 'success') {
            addConsoleLog(`🔄 [REST] Turno #${id} actualizado a ${nuevoEstado} en Supabase.`);
            
            if (nuevoEstado === 'COMPLETADO' && nps !== undefined) {
              const turnoObj = turnos.find(t => t.id === id);
              if (turnoObj) {
                const fbUrl = `/api/pos/feedback?clienteId=${turnoObj.clienteId}&puntuacion=${nps}&comentario=${encodeURIComponent(comentarios || '')}`;
                fetch(fbUrl, { method: 'POST' })
                  .then(() => {
                    addConsoleLog(`⭐ [REST] Feedback registrado para Cliente #${turnoObj.clienteId}: ${nps}★`);
                    loadDashboardData();
                  });
              }
            } else {
              loadDashboardData();
            }
          } else {
            showToast('Error al cambiar estado.', 'warning');
          }
        })
        .catch(() => showToast('Error de red al cambiar estado.', 'warning'));
      return;
  };

  const handleDeleteTurno = (id: string) => {
    showToast(`La eliminación del turno #${id} está deshabilitada hasta contar con cancelación auditada.`, 'warning');
  };

  const handleInventoryMovement = async (input: {
    productId: number;
    delta: number;
    reason: string;
    supplier?: string;
    unitCost?: number;
    registerCashExpense?: boolean;
  }): Promise<{ movementId: string; stock: number; cashMovementId?: string }> => {
    if (!dbOnline || !rawDbData) {
      throw new Error('No se puede modificar inventario sin datos sincronizados.');
    }

    const response = await fetch('/api/inventario/movimientos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID()
      },
      body: JSON.stringify(input)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status !== 'success' || !data.movementId) {
      throw new Error(data.detail || 'Supabase no confirmó el movimiento de inventario.');
    }
    loadDashboardData();
    return {
      movementId: String(data.movementId),
      stock: Number(data.stock),
      cashMovementId: data.cashMovementId ? String(data.cashMovementId) : undefined
    };
  };

  const handleReplenishInsumo = async (id: string) => {
    if (currentRole === 'LAVADOR' || currentRole === 'OPERARIO') {
      showToast('No tienes permisos de administrador para reabastecer inventario.', 'warning');
      return;
    }

    if (!dbOnline || id.startsWith('i')) {
      showToast('No se puede modificar stock sin conexión a Supabase.', 'warning');
      return;
    }

    try {
      const result = await handleInventoryMovement({
        productId: Number(id),
        delta: 10,
        reason: 'Reabastecimiento rápido desde POS',
        unitCost: 0,
        registerCashExpense: false
      });
      addConsoleLog(`📦 [INVENTARIO] Movimiento ${result.movementId} confirmado. Stock actual: ${result.stock}.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Error al reabastecer stock.', 'warning');
    }
  };

  const handleAddTransaccion = (
    monto: number, 
    concepto: string, 
    tipo: 'INGRESO' | 'EGRESO', 
    origen: 'MANUAL' | 'VENTA_POS'
  ) => {
    if (!dbOnline) {
      showToast('No se puede registrar un movimiento sin conexión a Supabase.', 'warning');
      return;
    }

    fetch(`/api/caja/movimiento?tipo=${tipo}&monto=${monto}&descripcion=${encodeURIComponent(concepto)}`, {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.detail || 'No se pudo confirmar el movimiento.');
          return data;
        })
        .then((data) => {
          if (data.status === 'success') {
            addConsoleLog(`💰 [REST] Movimiento contable registrado en Supabase: $${monto}`);
            loadDashboardData();
          } else {
            showToast('Error al registrar movimiento.', 'warning');
          }
        })
        .catch((error) => showToast(error instanceof Error ? error.message : 'Error al registrar movimiento.', 'warning'));
      return;
  };

  const handleChargeTurno = async (
    turno: Turno,
    metodoPago: 'EFECTIVO' | 'DEBITO' | 'CREDITO' | 'TRANSFERENCIA'
  ): Promise<void> => {
    if (!dbOnline) throw new Error('No se puede cobrar sin conexión con el servidor.');
    if (!cajaAbierta) throw new Error('Abrí la caja antes de registrar el cobro.');
    if (turno.estado !== 'COMPLETADO') throw new Error('El trabajo debe estar listo antes de cobrarlo.');
    if (transacciones.some((tx) => tx.tipo === 'INGRESO' && tx.concepto.includes(`Turno #${turno.id} ·`))) {
      throw new Error('Este turno ya tiene un cobro registrado.');
    }

    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`lavadero:cobro:${turno.id}`)
    );
    const uuidChars = Array.from(new Uint8Array(digest).slice(0, 16), (byte) => byte.toString(16).padStart(2, '0')).join('').split('');
    uuidChars[12] = '4';
    uuidChars[16] = ['8', '9', 'a', 'b'][Number.parseInt(uuidChars[16], 16) % 4];
    const stableIdempotencyKey = `${uuidChars.slice(0, 8).join('')}-${uuidChars.slice(8, 12).join('')}-${uuidChars.slice(12, 16).join('')}-${uuidChars.slice(16, 20).join('')}-${uuidChars.slice(20, 32).join('')}`;
    const response = await fetch('/api/caja/cobrar-turno', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': stableIdempotencyKey
      },
      body: JSON.stringify({ appointmentId: Number(turno.id), paymentMethod: metodoPago })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status !== 'success') {
      throw new Error(data.detail || 'El servidor no confirmó el cobro.');
    }
    addConsoleLog(`Cobro confirmado para el turno #${turno.id} por $${turno.precio.toLocaleString('es-AR')} (${metodoPago}).`);
    loadDashboardData();
  };

  const handleSellPOS = (insumoId: string, cantidad: number) => {
    if (!dbOnline || !rawDbData || insumoId.startsWith('i')) {
      showToast('No se puede registrar una venta sin stock sincronizado.', 'warning');
      return;
    }

    const payload = {
      clienteId: null,
      metodoPago: 'EFECTIVO',
      detalles: [{ productoId: Number(insumoId), cantidad }],
      codigoCupon: null
    };

    fetch('/api/pos/venta', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify(payload)
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || 'La venta no pudo confirmarse.');
        return data;
      })
      .then((data) => {
        addConsoleLog(`🛒 [REST] Venta POS confirmada. Total cobrado: $${data.venta.total}`);
        loadDashboardData();
      })
      .catch((error) => {
        showToast(error instanceof Error ? error.message : 'Error al registrar la venta POS.', 'warning');
      });
  };

  const handleOpenCaja = (monto: number) => {
    if (!dbOnline) {
      showToast('No se puede abrir la caja sin conexión a Supabase.', 'warning');
      return;
    }

    fetch('/api/caja/abrir-segura', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ openingAmount: monto }),
    })
        .then((res) => res.json())
        .then((data) => {
          if (data.status === 'success') {
            addConsoleLog(`💰 [REST] Caja abierta con base de $${monto}`);
            loadDashboardData();
          } else {
            showToast('Error al abrir la caja.', 'warning');
          }
        })
        .catch(() => showToast('Error de red al abrir la caja.', 'warning'));
      return;
  };

  const handleCloseCaja = (montoCierre: number) => {
    if (!dbOnline) {
      showToast('No se puede cerrar la caja sin conexión a Supabase.', 'warning');
      return;
    }

    fetch('/api/caja/cerrar-segura', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ declaredAmount: montoCierre, observation: '' })
    })
        .then((res) => res.json())
        .then((data) => {
          if (data.status === 'success') {
            addConsoleLog(`🏁 [REST] Caja Cerrada con Arqueo Real de $${montoCierre} ARS.`);
            loadDashboardData();
          } else {
            showToast('Error al cerrar la caja.', 'warning');
          }
        })
        .catch(() => showToast('Error de red al cerrar la caja.', 'warning'));
      return;
  };

  const handleCloseCajaSecure = async (montoCierre: number, observacion: string): Promise<void> => {
    if (!dbOnline) throw new Error('No se puede cerrar la caja sin conexión a Supabase.');
    const response = await fetch('/api/caja/cerrar-segura', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ declaredAmount: montoCierre, observation: observacion })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status !== 'success') {
      throw new Error(data.detail || 'El servidor no confirmó el cierre de caja.');
    }
    addConsoleLog(`Caja cerrada. Declarado: $${montoCierre.toLocaleString('es-AR')} · Diferencia: $${Number(data.difference || 0).toLocaleString('es-AR')}.`);
    await loadDashboardData();
  };

  const createCustomerVehicle = async (input: {
    name: string;
    phone?: string;
    plate: string;
    model?: string;
    make?: string;
  }) => {
    const response = await fetch('/api/clientes-con-vehiculo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status !== 'success') {
      throw new Error(data.detail || 'No se pudo registrar cliente y vehículo.');
    }
    return data as { outcome: 'created' | 'duplicate'; clientId?: number; vehicleId?: number; plate: string };
  };

  const handleAddTurnoSecure = async (newT: Turno): Promise<{ id: string }> => {
    if (!dbOnline || !rawDbData) throw new Error('No hay conexión con Supabase.');
    const service = rawDbData.servicios?.find((item: any) => item.nombre === newT.servicioNombre || newT.servicioNombre.includes(item.nombre));
    const employee = rawDbData.empleados?.find((item: any) => item.nombre === newT.lavadorAsignado);
    const existingClient = rawDbData.clientes?.find((item: any) => item.nombre === newT.clienteNombre);
    const existingVehicle = rawDbData.vehiculos?.find((item: any) => item.patente === newT.vehiculoPatente.toUpperCase());
    if (!service) throw new Error('El servicio seleccionado no existe en el catálogo sincronizado.');

    let clientId: number;
    let vehicleId: number;
    if (existingVehicle) {
      vehicleId = Number(existingVehicle.id);
      clientId = Number(existingVehicle.cliente_id ?? existingClient?.id);
      if (!clientId) throw new Error('La patente ya existe pero no tiene un cliente válido.');
    } else if (existingClient) {
      clientId = Number(existingClient.id);
      const response = await fetch('/api/vehiculos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          plate: newT.vehiculoPatente,
          make: 'Auto',
          model: newT.vehiculoModelo || 'Vehículo sin modelo'
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.status !== 'success' || !data.vehicleId) throw new Error(data.detail || 'No se confirmó el vehículo.');
      vehicleId = Number(data.vehicleId);
    } else {
      const created = await createCustomerVehicle({
        name: newT.clienteNombre,
        phone: newT.telefono || '+549261000000',
        plate: newT.vehiculoPatente,
        make: 'Auto',
        model: newT.vehiculoModelo || 'Vehículo sin modelo'
      });
      if (created.outcome !== 'created' || !created.clientId || !created.vehicleId) {
        throw new Error('La patente ya pertenece a otro cliente.');
      }
      clientId = created.clientId;
      vehicleId = created.vehicleId;
    }

    const response = await fetch('/api/turnos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        vehicleId,
        serviceId: Number(service.id),
        employeeId: employee ? Number(employee.id) : null,
        scheduledAt: newT.fechaCreacion,
        observations: newT.comentarios || ''
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status !== 'success' || !data.id) throw new Error(data.detail || 'No se confirmó el turno.');
    addConsoleLog(`Turno #${data.id} creado sin superposición.`);
    if (newT.healthData) {
      try {
        const inspectionResponse = await fetch(`/api/turnos/${data.id}/recepcion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dirtLevel: newT.healthData.nivelSuciedad,
            damageChecklist: newT.healthData.checklistDanos,
            observations: newT.healthData.observaciones,
            inspector: newT.healthData.operarioInspector,
          }),
        });
        const inspection = await inspectionResponse.json().catch(() => ({}));
        if (!inspectionResponse.ok || !inspection.inspectionId) {
          throw new Error(inspection.detail || 'No se confirmó la inspección.');
        }
        for (const photo of newT.healthData.fotos) {
          const photoResponse = await fetch(`/api/turnos/${data.id}/recepcion/fotos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              inspectionId: Number(inspection.inspectionId),
              dataUrl: photo.url,
              sector: photo.sector,
              description: photo.descripcion,
            }),
          });
          const photoResult = await photoResponse.json().catch(() => ({}));
          if (!photoResponse.ok || photoResult.status !== 'success') {
            throw new Error(photoResult.detail || 'Una foto no pudo guardarse.');
          }
        }
        addConsoleLog(`Inspección de recepción del turno #${data.id} guardada con ${newT.healthData.fotos.length} foto(s) privada(s).`);
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'El turno se creó, pero la inspección quedó pendiente.', 'warning');
      }
    }
    await loadDashboardData();
    return { id: String(data.id) };
  };

  const handleCreateClientAtomic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !newClientPatente) return;
    if (!dbOnline) {
      showToast('No se puede registrar un cliente sin conexión a Supabase.', 'warning');
      return;
    }
    try {
      const result = await createCustomerVehicle({
        name: newClientName,
        phone: newClientPhone || '+549261000000',
        plate: newClientPatente.toUpperCase(),
        make: 'Auto',
        model: newClientModelo || 'Vehículo sin modelo'
      });
      if (result.outcome === 'duplicate') {
        showToast(`La patente ${result.plate} ya está registrada.`, 'warning');
        return;
      }
      addConsoleLog(`Cliente y vehículo ${result.plate} registrados en una sola operación.`);
      setNewClientName('');
      setNewClientPhone('');
      setNewClientPatente('');
      setNewClientModelo('');
      await loadDashboardData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo crear el cliente.', 'warning');
    }
  };

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !newClientPatente) return;

    if (!dbOnline) {
      showToast('No se puede registrar un cliente sin conexión a Supabase.', 'warning');
      return;
    }

    const cliUrl = `/api/clientes/nuevo?nombre=${encodeURIComponent(newClientName)}&telefono=${encodeURIComponent(newClientPhone || '+549261000000')}`;
      fetch(cliUrl, { method: 'POST' })
        .then((res) => res.json())
        .then((cliData) => {
          if (cliData.status === 'success') {
            const cliId = cliData.id;
            const vehUrl = `/api/vehiculos/nuevo?clienteId=${cliId}&patente=${encodeURIComponent(newClientPatente.toUpperCase())}&marca=Auto&modelo=${encodeURIComponent(newClientModelo || 'Vehículo Genérico')}`;
            
            fetch(vehUrl, { method: 'POST' })
              .then((res) => res.json())
              .then((vehData) => {
                if (vehData.status === 'success') {
                  addConsoleLog(`👤 [REST] Cliente ${newClientName} y vehículo ${newClientPatente.toUpperCase()} creados en Supabase.`);
                  setShowAddClientForm(false);
                  setNewClientName('');
                  setNewClientPhone('');
                  setNewClientPatente('');
                  setNewClientModelo('');
                  loadDashboardData();
                } else {
                  showToast('Error al vincular el vehículo.', 'warning');
                }
              });
          } else {
            showToast('Error al crear el cliente.', 'warning');
          }
        })
        .catch(() => showToast('Error de red al crear el cliente.', 'warning'));
      return;
  };

  const handleImportClients = async (rows: ExcelClientRow[]): Promise<{ created: number; skipped: number; errors: string[] }> => {
    if (!dbOnline) throw new Error('No se puede importar sin conexión con el servidor.');
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];
    const knownPatents = new Set(
      clientes.flatMap((cliente) => cliente.vehiculoPatente.split(',')).map((patente) => patente.trim().toUpperCase()).filter(Boolean)
    );

    for (const row of rows) {
      if (knownPatents.has(row.patente)) {
        skipped += 1;
        continue;
      }
      try {
        const clientResponse = await fetch(`/api/clientes/nuevo?nombre=${encodeURIComponent(row.nombre)}&telefono=${encodeURIComponent(row.telefono || '+5490000000000')}`, { method: 'POST' });
        const clientData = await clientResponse.json().catch(() => ({}));
        if (!clientResponse.ok || clientData.status !== 'success' || !clientData.id) {
          throw new Error(clientData.detail || 'cliente no confirmado');
        }
        const vehicleResponse = await fetch(`/api/vehiculos/nuevo?clienteId=${clientData.id}&patente=${encodeURIComponent(row.patente)}&marca=Auto&modelo=${encodeURIComponent(row.modelo)}`, { method: 'POST' });
        const vehicleData = await vehicleResponse.json().catch(() => ({}));
        if (!vehicleResponse.ok || vehicleData.status !== 'success' || !vehicleData.id) {
          throw new Error(vehicleData.detail || 'vehículo no confirmado');
        }
        knownPatents.add(row.patente);
        created += 1;
      } catch (error) {
        errors.push(`Fila ${row.rowNumber} (${row.patente}): ${error instanceof Error ? error.message : 'error de importación'}.`);
      }
    }

    if (created > 0) {
      addConsoleLog(`Importación Excel confirmada: ${created} clientes y vehículos creados.`);
      loadDashboardData();
    }
    return { created, skipped, errors };
  };

  const handleUpdateClient = (updatedClient: Cliente) => {
    const clientIdStr = String(updatedClient.id);
    const membership = {
      membershipPlan: updatedClient.membershipPlan,
      membershipRenewal: updatedClient.membershipRenewal,
      membershipRemainingWashes: updatedClient.membershipRemainingWashes
    };
    if (updatedClient.membershipPlan) {
      localStorage.setItem(`albelo_membership_${clientIdStr}`, JSON.stringify(membership));
    } else {
      localStorage.removeItem(`albelo_membership_${clientIdStr}`);
    }

    setClientes((prev) => prev.map((c) => (c.id === updatedClient.id ? updatedClient : c)));
    addConsoleLog(`👤 [CLIENTE] Membresía/Datos del cliente ${updatedClient.nombre} actualizados.`);
  };

  const handleImportClientsAtomic = async (rows: ExcelClientRow[]): Promise<{ created: number; skipped: number; errors: string[] }> => {
    if (!dbOnline) throw new Error('No se puede importar sin conexión con el servidor.');
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];
    const knownPatents = new Set(
      clientes.flatMap((cliente) => cliente.vehiculoPatente.split(',')).map((plate) => plate.trim().toUpperCase()).filter(Boolean)
    );
    for (const row of rows) {
      if (knownPatents.has(row.patente)) {
        skipped += 1;
        continue;
      }
      try {
        const result = await createCustomerVehicle({
          name: row.nombre,
          phone: row.telefono || '+5490000000000',
          plate: row.patente,
          make: 'Auto',
          model: row.modelo
        });
        if (result.outcome === 'duplicate') skipped += 1;
        else created += 1;
        knownPatents.add(row.patente);
      } catch (error) {
        errors.push(`Fila ${row.rowNumber} (${row.patente}): ${error instanceof Error ? error.message : 'error de importación'}.`);
      }
    }
    if (created > 0) {
      addConsoleLog(`Importación Excel atómica: ${created} clientes y vehículos creados.`);
      await loadDashboardData();
    }
    return { created, skipped, errors };
  };

  const handleRunLoyaltyCampaign = () => {
    if (!dbOnline) {
      showToast('No se puede ejecutar la campaña sin conexión a Supabase.', 'warning');
      return;
    }

    addConsoleLog('🚀 Iniciando script de Growth Marketing en background...');
    addConsoleLog('🔍 Buscando en base de datos clientes con inactividad mayor a 20 días...');

    fetch('/api/marketing/run-loyalty', { method: 'POST' })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.detail || 'No se pudo ejecutar la campaña.');
          return data;
        })
        .then((data) => {
          if (data.success) {
            addConsoleLog(`✅ [REST] Campaña de marketing ejecutada con éxito. Salida: ${data.exitCode}`);
            const lines = (data.stdout || '').split('\n');
            lines.forEach((line: string) => {
              if (line.trim()) addConsoleLog(`🐍 [PYTHON] ${line}`);
            });
            loadDashboardData();
          } else {
            throw new Error('La campaña no pudo completarse.');
          }
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : 'Error al ejecutar la campaña.';
          addConsoleLog(`🔴 [REST] ${message}`);
          showToast(message, 'warning');
        });
  };

  const handleLogout = () => {
    localStorage.removeItem('session');
    setSession(null);
    showToast('Sesión cerrada correctamente', 'info');
  };

  // Derive metrics
  const totalIncomingsToday = transacciones
    .filter((t) => t.tipo === 'INGRESO')
    .reduce((sum, t) => sum + t.monto, 0);

  const completedTurnos = turnos.filter((t) => t.estado === 'COMPLETADO' || t.estado === 'ENTREGADO');
  const scoredTurnos = completedTurnos.filter((t) => typeof t.npsScore === 'number');
  const satisfactionAvg = scoredTurnos.length > 0
    ? (scoredTurnos.reduce((sum, t) => sum + Number(t.npsScore), 0) / scoredTurnos.length).toFixed(1)
    : null;

  const lowStockInsumosCount = insumos.filter((i) => i.stockActual <= i.stockMinimo).length;
  const activeTurnosCount = turnos.filter((t) => t.estado === 'EN_PROCESO' || t.estado === 'PENDIENTE').length;

  const isAdmin = currentRole === 'SUPERADMIN' || currentRole === 'ADMIN';
  const canUseCaja = isAdmin || currentRole === 'CAJERO';
  const canUseClients = isAdmin || currentRole === 'CAJERO';
  const adminModules: AppTab[] = ['excel', 'publicidad', 'public-page', 'inventario', 'ceramic', 'branding'];
  const activePrimaryTab: PrimaryTab = adminModules.includes(activeTab)
    ? 'more'
    : activeTab === 'legacy-overview' || activeTab === 'roadmap'
      ? 'overview'
      : activeTab as PrimaryTab;
  const navigationItems: Array<{ id: PrimaryTab; label: string }> = [
    { id: 'overview', label: 'Hoy' },
    { id: 'turnos', label: 'Turnos' },
    ...(canUseCaja ? [{ id: 'caja' as const, label: 'Caja' }] : []),
    ...(canUseClients ? [{ id: 'clientes' as const, label: 'Clientes' }] : []),
    ...(isAdmin ? [{ id: 'more' as const, label: 'Más' }] : []),
  ];

  const handleSelectMoreModule = (module: MoreModule) => {
    if (module === 'facturacion') {
      setCajaSubTab('facturacion');
      setActiveTab('caja');
      return;
    }
    setActiveTab(module);
  };

  useEffect(() => {
    if (!isAdmin && (adminModules.includes(activeTab) || activeTab === 'more' || activeTab === 'roadmap')) {
      setActiveTab('overview');
    }
    if (!canUseCaja && activeTab === 'caja') {
      setActiveTab('overview');
    }
    if (!canUseClients && activeTab === 'clientes') {
      setActiveTab('overview');
    }
  }, [activeTab, canUseCaja, canUseClients, isAdmin]);

  // Render Login view if no active session
  if (!session) {
    return (
      <Login 
        onLoginSuccess={(user) => setSession(user)} 
        brandConfig={{
          nombre: brandConfig.nombre,
          tagline: brandConfig.tagline,
          primaryColor: brandConfig.primaryColor,
          hoverColor: brandConfig.hoverColor
        }}
      />
    );
  }

  return (
    <div id="app-root-container" className="comfort-theme min-h-screen bg-[#273449] text-slate-100 flex flex-col font-sans selection:bg-brand-primary selection:text-white relative">
      
      {/* Dynamic Brand Custom Theme Styles Injection */}
      <style>{`
        :root {
          --brand-primary: ${brandConfig.primaryColor};
          --brand-hover: ${brandConfig.hoverColor};
          --brand-glow: ${brandConfig.primaryColor}30;
          --brand-glow-neon: ${brandConfig.primaryColor}60;
          --brand-mesh-1: ${brandConfig.primaryColor}1f;
          --brand-mesh-2: ${brandConfig.primaryColor}0f;
          --brand-glass-border: ${brandConfig.primaryColor}2e;
          --brand-hover-card-bg: ${brandConfig.primaryColor}0f;
          --brand-hover-card-border: ${brandConfig.primaryColor}66;
          --brand-hover-card-shadow: ${brandConfig.primaryColor}26;
          --brand-badge-bg: ${brandConfig.primaryColor}26;
          --brand-badge-border: ${brandConfig.primaryColor}59;
          --brand-badge-text: ${brandConfig.primaryColor === '#6b7280' ? '#e2e8f0' : brandConfig.primaryColor};
          --brand-badge-glow: ${brandConfig.primaryColor}80;
          --font-display: "${brandConfig.fontFamily}", "Outfit", var(--font-sans);
        }
        
        .text-brand-primary {
          color: var(--brand-primary) !important;
        }
        .bg-brand-primary {
          background-color: var(--brand-primary) !important;
        }
        .border-brand-primary {
          border-color: var(--brand-primary) !important;
        }
        .hover\\:bg-brand-hover:hover {
          background-color: var(--brand-hover) !important;
        }
      `}</style>

      {/* Frosted Glass Mesh Background Layer */}
      <div className="mesh-bg" />

      {/* Toast Alert list */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="p-3 rounded-xl shadow-2xl flex items-center gap-2.5 bg-white/[0.04] backdrop-blur-xl border border-white/[0.12] pointer-events-auto transition-all animate-fade-in"
          >
            <span className={`w-2 h-2 rounded-full ${
              toast.type === 'success' ? 'bg-emerald-400 animate-pulse' :
              toast.type === 'warning' ? 'bg-amber-400' : 'bg-brand-primary'
            }`} />
            <span className="text-xs text-slate-200 font-semibold">{toast.text}</span>
          </div>
        ))}
      </div>

      {/* Database connection status warning banner */}
      {!dbOnline && (
        <div id="offline-banner" className="bg-amber-950/45 backdrop-blur-md border-b border-amber-700/50 text-amber-100 px-4 py-2 text-center text-xs font-bold flex items-center justify-center gap-2 relative z-50">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span>Sin conexión con Supabase. Mostrando los últimos datos disponibles.</span>
          <button 
            onClick={() => {
              setDbOnline(true);
              setDataStatus('checking');
            }} 
            className="ml-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-100 px-2 py-1 rounded text-[10px] uppercase transition font-bold"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Primary Header Navbar */}
      <header className="border-b border-white/[0.08] bg-white/[0.02] backdrop-blur-xl sticky top-0 z-40 px-4 lg:px-8 py-3 flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div 
            className="p-2 rounded-xl border transition duration-200 flex items-center justify-center"
            style={{ 
              backgroundColor: `${brandConfig.primaryColor}15`, 
              borderColor: `${brandConfig.primaryColor}30`,
              color: brandConfig.primaryColor 
            }}
          >
            {renderBrandLogo("w-6 h-6")}
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-white font-display uppercase">
              {brandConfig.nombre}
            </h1>
            <span className="text-[10px] text-slate-400 font-semibold font-mono tracking-wider block mt-0.5">{brandConfig.tagline}</span>
          </div>
        </div>

        {/* System control: Role, DB, Logout */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Live synchronization status */}
          <button
            id="btn-toggle-db"
            onClick={() => {
              if (dbOnline) loadDashboardData();
              else setDbOnline(true);
            }}
            disabled={dataStatus === 'checking'}
            title={lastSyncAt ? `Última sincronización: ${lastSyncAt.toLocaleTimeString('es-AR')}` : 'Sincronizar datos'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition ${
              dataStatus === 'online'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' 
                : dataStatus === 'checking'
                  ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300 cursor-wait'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
            }`}
          >
            <RefreshCw className={`w-3 h-3 ${dataStatus === 'checking' ? 'animate-spin' : ''}`} />
            {dataStatus === 'online' ? 'Datos sincronizados' : dataStatus === 'checking' ? 'Sincronizando' : 'Sin conexión'}
          </button>

          {/* User badge & Logout */}
          <div className="flex items-center gap-2 bg-white/[0.02] p-1 rounded-lg border border-white/[0.08]">
            <span className="text-[10px] text-slate-400 px-1.5 font-bold uppercase font-mono">
              👤 {session.nombre} ({session.rol})
            </span>
            <button
              onClick={handleLogout}
              className="p-1 rounded-md text-red-400 hover:text-white hover:bg-red-950/40 border border-transparent hover:border-red-500/20 transition cursor-pointer"
              title="Cerrar Sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Subheader Toolbar & Tab Selectors */}
      <section className="bg-slate-900/70 border-b border-white/10 backdrop-blur-md px-4 lg:px-8 py-2.5 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 relative z-30">
        <select
          aria-label="Seleccionar sección"
          value={activePrimaryTab}
          onChange={(event) => setActiveTab(event.target.value as PrimaryTab)}
          className="sm:hidden w-full bg-[#111827] border border-white/[0.12] text-white rounded-xl px-3 py-3 text-sm font-bold focus:outline-none focus:border-brand-primary"
        >
          {navigationItems.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>

        <nav className="hidden sm:flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none" aria-label="Navegación principal">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              id={`btn-nav-${item.id}`}
              type="button"
              onClick={() => setActiveTab(item.id)}
              aria-current={activePrimaryTab === item.id ? 'page' : undefined}
              className={`min-h-10 px-4 py-2 rounded-xl text-xs font-extrabold transition shrink-0 cursor-pointer ${
                activePrimaryTab === item.id
                  ? 'bg-brand-primary/15 text-white border border-brand-primary/30 shadow-[0_0_15px_var(--brand-glow)]'
                  : 'text-slate-400 border border-transparent hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {false && <>
        <select
          aria-label="Seleccionar módulo"
          value={activeTab}
          onChange={(event) => setActiveTab(event.target.value as typeof activeTab)}
          className="sm:hidden w-full bg-[#111827] border border-white/[0.12] text-white rounded-lg px-3 py-2.5 text-xs font-bold uppercase tracking-wider focus:outline-none focus:border-brand-primary"
        >
          <option value="overview">Dashboard</option>
          <option value="turnos">Turnos & Kanban</option>
          <option value="caja">Caja & POS</option>
          <option value="publicidad">Publicidad & Marketing</option>
          <option value="roadmap">Plan & Estructura</option>
          <option value="public-page">Portal Público</option>
          <option value="inventario">Inventario & Stock</option>
          <option value="ceramic">Estética & Cerámicos</option>
          <option value="branding">Branding</option>
        </select>

        <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
          <button
            id="btn-nav-overview"
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition shrink-0 cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-brand-primary/15 text-white border border-brand-primary/30 shadow-[0_0_15px_var(--brand-glow)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
            }`}
          >
            Dashboard
          </button>
          <button
            id="btn-nav-turnos"
            onClick={() => setActiveTab('turnos')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition shrink-0 cursor-pointer ${
              activeTab === 'turnos'
                ? 'bg-brand-primary/15 text-white border border-brand-primary/30 shadow-[0_0_15px_var(--brand-glow)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
            }`}
          >
            Turnos & Kanban
          </button>
          <button
            id="btn-nav-caja"
            onClick={() => setActiveTab('caja')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition shrink-0 cursor-pointer ${
              activeTab === 'caja'
                ? 'bg-brand-primary/15 text-white border border-brand-primary/30 shadow-[0_0_15px_var(--brand-glow)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
            }`}
          >
            Caja & POS
          </button>
          <button
            id="btn-nav-publicidad"
            onClick={() => setActiveTab('publicidad')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition shrink-0 cursor-pointer ${
              activeTab === 'publicidad'
                ? 'bg-brand-primary/15 text-white border border-brand-primary/30 shadow-[0_0_15px_var(--brand-glow)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
            }`}
          >
            Publicidad & Marketing
          </button>
          <button
            id="btn-nav-roadmap"
            onClick={() => setActiveTab('roadmap')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition shrink-0 cursor-pointer ${
              activeTab === 'roadmap'
                ? 'bg-brand-primary/15 text-white border border-brand-primary/30 shadow-[0_0_15px_var(--brand-glow)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
            }`}
          >
            Plan & Estructura
          </button>
          <button
            id="btn-nav-public-page"
            onClick={() => setActiveTab('public-page')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition shrink-0 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'public-page'
                ? 'bg-brand-primary/15 text-white border border-brand-primary/30 shadow-[0_0_15px_var(--brand-glow)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
            }`}
          >
            <Globe className="w-3 h-3 text-brand-primary" />
            Portal Público
          </button>
          <button
            id="btn-nav-inventario"
            onClick={() => setActiveTab('inventario')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition shrink-0 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'inventario'
                ? 'bg-brand-primary/15 text-white border border-brand-primary/30 shadow-[0_0_15px_var(--brand-glow)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
            }`}
          >
            <Package className="w-3 h-3 text-brand-primary" />
            Inventario & Stock
          </button>
          <button
            id="btn-nav-ceramic"
            onClick={() => setActiveTab('ceramic')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition shrink-0 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'ceramic'
                ? 'bg-brand-primary/15 text-white border border-brand-primary/30 shadow-[0_0_15px_var(--brand-glow)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
            }`}
          >
            <Sparkles className="w-3 h-3 text-brand-primary" />
            Estética & Cerámicos
          </button>
          <button
            id="btn-nav-branding"
            onClick={() => setActiveTab('branding')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition shrink-0 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'branding'
                ? 'bg-brand-primary/15 text-white border border-brand-primary/30 shadow-[0_0_15px_var(--brand-glow)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
            }`}
          >
            <Palette className="w-3 h-3 text-brand-primary" />
            Branding
          </button>
        </div>
        </>}

        {/* Quick button to register a Client */}
        {canUseClients && (
        <button
          id="btn-trigger-add-client-modal"
          onClick={() => setShowAddClientForm(!showAddClientForm)}
          className="flex items-center justify-center gap-1.5 bg-brand-primary/10 hover:bg-brand-primary/20 border border-brand-primary/30 text-brand-primary font-extrabold px-4 py-1.5 rounded-lg text-[10px] uppercase tracking-widest transition-all duration-300 shadow-[0_0_10px_var(--brand-glow)] cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-3 h-3 text-brand-primary" />
          Nuevo cliente
        </button>
        )}
      </section>

      {/* Main Workspace Frame */}
      <main className="flex-1 p-4 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
        <Suspense fallback={(
          <div className="glass-panel rounded-xl p-8 flex items-center justify-center gap-3 text-sm text-slate-300" role="status">
            <RefreshCw className="w-4 h-4 animate-spin text-brand-primary" />
            Cargando módulo…
          </div>
        )}>
        
        {/* New Client Form Drawer */}
        {showAddClientForm && (
          <div className="glass-panel p-5 rounded-xl space-y-4 animate-fade-in relative z-30 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="flex justify-between items-center pb-2 border-b border-white/[0.08]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-red-500 flex items-center gap-2">
                <Users className="w-3.5 h-3.5" /> Registrar Cliente & Vincular Patente
              </h3>
              <button onClick={() => setShowAddClientForm(false)} className="text-xs text-slate-400 hover:text-white transition">Cerrar</button>
            </div>

            <form onSubmit={handleCreateClientAtomic} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Nombre Completo</label>
                <input
                  id="input-client-name"
                  type="text"
                  required
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Ej. Carlos Mendoza"
                  className="w-full bg-white/[0.02] border border-white/[0.1] focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 focus:outline-none rounded-lg px-2.5 py-1.5 text-xs text-white transition-all placeholder:text-slate-600"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Teléfono Móvil (WhatsApp)</label>
                <input
                  id="input-client-phone"
                  type="text"
                  required
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  placeholder="Ej. +5492615551234"
                  className="w-full bg-white/[0.02] border border-white/[0.1] focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 focus:outline-none rounded-lg px-2.5 py-1.5 text-xs text-white font-mono transition-all placeholder:text-slate-600"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Patente del Auto</label>
                <input
                  id="input-client-patent"
                  type="text"
                  required
                  value={newClientPatente}
                  onChange={(e) => setNewClientPatente(e.target.value)}
                  placeholder="Ej. AB123CD"
                  className="w-full bg-white/[0.02] border border-white/[0.1] focus:border-[#00d2ff]/60 focus:ring-1 focus:ring-[#00d2ff]/20 focus:outline-none rounded-lg px-2.5 py-1.5 text-xs text-white font-mono uppercase transition-all placeholder:text-slate-600"
                />
              </div>

              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Modelo / Color</label>
                  <input
                    id="input-client-model"
                    type="text"
                    required
                    value={newClientModelo}
                    onChange={(e) => setNewClientModelo(e.target.value)}
                    placeholder="Ej. Toyota Corolla (Gris)"
                    className="w-full bg-white/[0.02] border border-white/[0.1] focus:border-[#00d2ff]/60 focus:ring-1 focus:ring-[#00d2ff]/20 focus:outline-none rounded-lg px-2.5 py-1.5 text-xs text-white transition-all placeholder:text-slate-600"
                  />
                </div>
                <button
                  id="btn-save-client"
                  type="submit"
                  className="bg-[#00d2ff]/20 hover:bg-[#00d2ff]/30 text-[#00d2ff] border border-[#00d2ff]/30 px-4 py-1.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'overview' && (
          <EssentialToday
            turnos={turnos}
            cajaAbierta={cajaAbierta}
            ingresos={totalIncomingsToday}
            stockBajo={lowStockInsumosCount}
            onGoToTurnos={() => setActiveTab('turnos')}
            onGoToCaja={() => setActiveTab('caja')}
            onGoToClientes={() => setActiveTab('clientes')}
            canUseCaja={canUseCaja}
            canUseClients={canUseClients}
          />
        )}

        {/* Legacy analytics kept out of the daily navigation while the reports module is redesigned. */}
        {activeTab === 'legacy-overview' && (
          <div className="space-y-6 animate-fade-in relative z-20">
            
             {/* Bento Grid Metrics Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              
              <div className="glass-panel glass-card-hover glow-emerald p-4 rounded-xl flex justify-between items-start transition duration-300">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider font-mono">Caja Diaria</span>
                  <span className="text-xl font-extrabold font-mono text-emerald-400 mt-1 block">${totalIncomingsToday.toLocaleString('es-AR')}</span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Ticket Prom: <b className="text-white">${Math.round(turnos.filter(t => t.estado === 'COMPLETADO' || t.estado === 'ENTREGADO').reduce((sum, t) => sum + t.precio, 0) / (turnos.filter(t => t.estado === 'COMPLETADO' || t.estado === 'ENTREGADO').length || 1)).toLocaleString('es-AR')}</b>
                  </span>
                </div>
                <span className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
                  <DollarSign className="w-5 h-5" />
                </span>
              </div>

              <div className="glass-panel glass-card-hover glow-cyan p-4 rounded-xl flex justify-between items-start transition duration-300">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider font-mono">Turnos en Espera</span>
                  <span className="text-xl font-extrabold font-mono text-[#00d2ff] mt-1 block">{activeTurnosCount}</span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block font-medium">Pendientes y en proceso</span>
                </div>
                <span className="p-2.5 rounded-lg bg-[#00d2ff]/10 border border-[#00d2ff]/20 text-[#00d2ff] shadow-[0_0_12px_rgba(6,182,212,0.15)]">
                  <Car className="w-5 h-5" />
                </span>
              </div>

              <div className="glass-panel glass-card-hover glow-amber p-4 rounded-xl flex justify-between items-start transition duration-300">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider font-mono">Satisfacción</span>
                  <span className="text-xl font-extrabold font-mono text-amber-400 mt-1 block flex items-baseline gap-1">
                    {satisfactionAvg ?? '—'} {satisfactionAvg && <span className="text-xs text-slate-500 font-normal">/ 5.0</span>}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">{satisfactionAvg ? `${scoredTurnos.length} reseñas registradas` : 'Sin reseñas todavía'}</span>
                </div>
                <span className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]">
                  <Star className="w-5 h-5 fill-amber-500/10 text-amber-400" />
                </span>
              </div>

              <div className={`glass-panel glass-card-hover p-4 rounded-xl flex justify-between items-start transition duration-300 ${
                lowStockInsumosCount > 0 ? 'glow-red animate-pulse' : 'glow-brand'
              }`}>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider font-mono">Alertas de Stock</span>
                  <span className={`text-xl font-extrabold font-mono mt-1 block ${lowStockInsumosCount > 0 ? 'text-red-400' : 'text-slate-300'}`}>
                    {lowStockInsumosCount}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Insumos críticos bajo mínimo</span>
                </div>
                <span className={`p-2.5 rounded-lg border ${
                  lowStockInsumosCount > 0 
                    ? 'bg-red-500/10 border-red-500/20 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.15)]' 
                    : 'bg-white/[0.02] border-white/[0.08] text-slate-400'
                }`}>
                  <Package className="w-5 h-5" />
                </span>
              </div>

            </div>

            {/* Middle row: Dashboard Charts and Registered Patents list */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Dynamic Dashboard Charts Panel (Advanced Analytics) */}
              {(() => {
                const countLavado = turnos.filter((t) => t.tipo === 'LAVADO').length;
                const countTapiceria = turnos.filter((t) => t.tipo === 'TAPICERIA').length;
                const countEstetica = turnos.filter((t) => t.tipo === 'ESTETICA').length;
                const totalServices = countLavado + countTapiceria + countEstetica || 1;

                const pctLavado = Math.round((countLavado / totalServices) * 100);
                const pctTapiceria = Math.round((countTapiceria / totalServices) * 100);
                const pctEstetica = 100 - pctLavado - pctTapiceria;

                // Weekly revenue from transactions dynamically calculated
                const getRealWeeklyRevenue = () => {
                  const today = new Date();
                  const currentDay = today.getDay(); // 0 Sunday, 1 Monday...
                  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
                  const mondayDate = new Date(today);
                  mondayDate.setDate(today.getDate() + mondayOffset);
                  mondayDate.setHours(0,0,0,0);

                  const rev = { 'Lun': 0, 'Mar': 0, 'Mié': 0, 'Jue': 0, 'Vie': 0, 'Sáb': 0, 'Dom': 0 };

                  turnos.filter(t => t.estado === 'COMPLETADO' || t.estado === 'ENTREGADO').forEach(t => {
                    try {
                      const tDate = new Date(t.fechaCreacion);
                      if (tDate >= mondayDate) {
                        const dayName = tDate.toLocaleDateString('es-AR', { weekday: 'short' });
                        if (dayName.startsWith('lun')) rev['Lun'] += t.precio;
                        else if (dayName.startsWith('mar')) rev['Mar'] += t.precio;
                        else if (dayName.startsWith('mi')) rev['Mié'] += t.precio;
                        else if (dayName.startsWith('jue')) rev['Jue'] += t.precio;
                        else if (dayName.startsWith('vie')) rev['Vie'] += t.precio;
                        else if (dayName.startsWith('sáb')) rev['Sáb'] += t.precio;
                        else if (dayName.startsWith('dom')) rev['Dom'] += t.precio;
                      }
                    } catch (e) {}
                  });

                  return rev;
                };

                const weeklyRevenue = getRealWeeklyRevenue();
                const maxWeeklyRevenue = Math.max(...Object.values(weeklyRevenue), 1);

                // Staff list performance dynamically calculated
                const staffNames = ['Mateo', 'Enzo', 'Santiago'];
                const staffStats = staffNames.map(name => {
                  const staffTurnos = turnos.filter(t => t.lavadorAsignado === name && (t.estado === 'COMPLETADO' || t.estado === 'ENTREGADO'));
                  const completed = staffTurnos.length;
                  const active = turnos.filter(t => t.lavadorAsignado === name && t.estado !== 'COMPLETADO' && t.estado !== 'ENTREGADO').length;
                  const revenue = staffTurnos.reduce((sum, t) => sum + t.precio, 0);
                  const staffScored = staffTurnos.filter((t) => typeof t.npsScore === 'number');
                  const npsSum = staffScored.reduce((sum, t) => sum + Number(t.npsScore), 0);
                  const rating = staffScored.length > 0 ? (npsSum / staffScored.length).toFixed(1) : '—';
                  return { name, completed, active, revenue, rating };
                });
                const maxStaffRevenue = Math.max(...staffStats.map(s => s.revenue), 1);

                return (
                  <div className="lg:col-span-8 glass-panel p-5 rounded-xl space-y-4">
                    <div className="flex justify-between items-center flex-wrap gap-2 pb-2 border-b border-white/[0.06]">
                      <div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider font-display">Estadísticas Operativas</h3>
                        <span className="text-[10px] text-slate-400">Analítica interactiva del taller</span>
                      </div>
                      <div className="flex gap-1 bg-white/[0.04] p-0.5 rounded border border-white/[0.08] text-[9px] font-bold uppercase tracking-wider">
                        <button
                          type="button"
                          onClick={() => setStatsSubTab('semanal')}
                          className={`px-2 py-1 rounded transition cursor-pointer ${
                            statsSubTab === 'semanal' ? 'bg-brand-primary/10 text-brand-primary' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Facturación Semanal
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatsSubTab('mix')}
                          className={`px-2 py-1 rounded transition cursor-pointer ${
                            statsSubTab === 'mix' ? 'bg-brand-primary/10 text-brand-primary' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Mix de Servicios
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatsSubTab('lavadores')}
                          className={`px-2 py-1 rounded transition cursor-pointer ${
                            statsSubTab === 'lavadores' ? 'bg-brand-primary/10 text-brand-primary' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Rendimiento Personal
                        </button>
                      </div>
                    </div>

                    {/* Chart 1: Facturación Semanal */}
                    {statsSubTab === 'semanal' && (
                      <div className="h-[200px] bg-black/30 rounded-xl border border-white/[0.08] flex flex-col justify-between p-4 relative overflow-hidden animate-fade-in">
                        <div className="absolute inset-0 flex flex-col justify-between py-6 px-8 opacity-[0.02] pointer-events-none">
                          <div className="border-b border-white w-full" />
                          <div className="border-b border-white w-full" />
                          <div className="border-b border-white w-full" />
                        </div>
                        <div className="flex-1 flex items-end justify-between px-2 pb-2 gap-2 z-10">
                          {Object.entries(weeklyRevenue).map(([day, val]) => {
                            const barPct = (val / maxWeeklyRevenue) * 80;
                            return (
                               <div key={day} className="flex-1 h-[120px] flex flex-col justify-end items-center gap-1.5 group cursor-pointer">
                                <div
                                  className="w-full rounded-t bg-gradient-to-t from-brand-primary to-brand-primary/20 hover:from-brand-primary hover:to-brand-primary/50 transition-all duration-500 ease-out relative border border-brand-primary/10 shadow-[0_0_12px_var(--brand-hover-card-shadow,rgba(220,38,38,0.1))]"
                                  style={{ height: `${barPct}%` }}
                                >
                                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#06080a]/90 text-[9px] font-mono font-bold py-0.5 px-1.5 rounded border border-white/10 text-white opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-30 shadow-lg">
                                    ${val.toLocaleString('es-AR')}
                                  </div>
                                </div>
                                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold font-mono">{day}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="border-t border-white/[0.06] pt-2 flex justify-between items-center text-[9px] text-slate-500">
                          <span>Ingresos por turnos finalizados</span>
                          <span>Total semanal: <b className="text-emerald-400 font-mono">${Object.values(weeklyRevenue).reduce((a,b)=>a+b,0).toLocaleString('es-AR')} ARS</b></span>
                        </div>
                      </div>
                    )}

                    {/* Chart 2: Mix de Servicios */}
                    {statsSubTab === 'mix' && (
                      <div className="h-[200px] bg-black/30 rounded-xl border border-white/[0.08] flex items-center justify-around p-4 relative overflow-hidden animate-fade-in">
                        {/* SVG Donut Chart */}
                        <div className="relative w-36 h-36">
                          <svg width="100%" height="100%" viewBox="0 0 42 42" className="transform -rotate-90">
                            <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#10b981" strokeWidth="5" strokeDasharray={`${pctLavado} ${100 - pctLavado}`} strokeDashoffset="0" />
                            <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#8b5cf6" strokeWidth="5" strokeDasharray={`${pctTapiceria} ${100 - pctTapiceria}`} strokeDashoffset={-pctLavado} />
                            <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#fbbf24" strokeWidth="5" strokeDasharray={`${pctEstetica} ${100 - pctEstetica}`} strokeDashoffset={-(pctLavado + pctTapiceria)} />
                            <circle cx="21" cy="21" r="12" fill="#080a0e" />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                            <span className="text-[8px] text-slate-500 uppercase tracking-widest leading-none font-bold">TOTAL</span>
                            <span className="text-base font-black text-white font-mono">{totalServices}</span>
                            <span className="text-[7px] text-slate-400 uppercase tracking-wider font-bold">Turnos</span>
                          </div>
                        </div>

                        {/* Donut Legend */}
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded bg-emerald-500 shrink-0" />
                            <span className="text-slate-300 font-medium">Lavado:</span>
                            <span className="font-mono font-bold text-white">{pctLavado}%</span>
                            <span className="text-slate-500 text-[10px]">({countLavado} u.)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded bg-purple-500 shrink-0" />
                            <span className="text-slate-300 font-medium">Tapicería:</span>
                            <span className="font-mono font-bold text-white">{pctTapiceria}%</span>
                            <span className="text-slate-500 text-[10px]">({countTapiceria} u.)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded bg-amber-500 shrink-0" />
                            <span className="text-slate-300 font-medium">Estética:</span>
                            <span className="font-mono font-bold text-white">{pctEstetica}%</span>
                            <span className="text-slate-500 text-[10px]">({countEstetica} u.)</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Chart 3: Rendimiento de Lavadores */}
                    {statsSubTab === 'lavadores' && (
                      <div className="h-[200px] bg-black/30 rounded-xl border border-white/[0.08] p-4 relative overflow-hidden animate-fade-in overflow-y-auto scrollbar-thin space-y-3">
                        {staffStats.map((staff) => {
                          const gaugePct = Math.min(100, Math.round((staff.revenue / (maxStaffRevenue || 1)) * 100));
                          return (
                            <div key={staff.name} className="space-y-1">
                              <div className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-white">{staff.name}</span>
                                  <span className="text-[9px] bg-white/[0.03] border border-white/[0.06] text-slate-400 px-1.5 py-0.2 rounded font-mono">
                                    {staff.completed} listos
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 font-mono font-bold">
                                  <span className="text-amber-400 text-[10px] flex items-center gap-0.5">★ {staff.rating}</span>
                                  <span className="text-[#00d2ff]">${staff.revenue.toLocaleString('es-AR')}</span>
                                </div>
                              </div>
                              <div className="w-full bg-white/[0.03] rounded-full h-1.5 border border-white/[0.05] overflow-hidden">
                                <div className="bg-brand-primary h-full rounded-full transition-all duration-500" style={{ width: `${gaugePct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Client registry patents quick list */}
              <div className="lg:col-span-4 glass-panel p-5 rounded-xl space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-white/[0.08]">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-display">Patentes Fieles</h3>
                  <span className="text-[10px] text-slate-500 font-mono">Clientes Frecuentes</span>
                </div>

                <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1">
                  {clientes.map((c) => (
                    <div key={c.id} className="flex justify-between items-center bg-white/[0.02] p-2.5 rounded-lg border border-white/[0.05] hover:border-white/[0.1] transition-all">
                      <div className="min-w-0">
                        <span className="text-xs text-slate-100 block font-bold truncate">{c.nombre}</span>
                        <span className="text-[10px] text-slate-400 font-mono truncate block">{c.vehiculoModelo}</span>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-[10px] bg-[#00d2ff]/10 border border-[#00d2ff]/20 text-[#00d2ff] font-mono font-bold px-1.5 py-0.5 rounded uppercase">
                          {c.vehiculoPatente}
                        </span>
                        <span className="text-[9px] text-slate-400 mt-1">{c.visitas} visitas</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* WORKSHOP BAY MONITOR */}
            <div className="glass-panel p-5 rounded-xl space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-red-600/10 border border-red-600/20 text-red-500 shadow-[0_0_10px_rgba(220,38,38,0.15)] animate-pulse">
                    <Car className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider font-display">Monitor de Boxes en Tiempo Real</h3>
                    <span className="text-[9px] text-slate-500 font-mono">LAYOUT OPERATIVO DEL TALLER</span>
                  </div>
                </div>

                <span className="text-[8px] bg-red-600/20 text-red-500 border border-red-600/30 px-2 py-0.5 rounded uppercase font-bold tracking-widest font-mono">
                  PROCESO ACTIVO
                </span>
              </div>

              {/* 3 Columns Grid representing Boxes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* BOX 1 */}
                {(() => {
                  const bayId = 'box1';
                  const turnoId = bays.box1;
                  const turnoObj = turnos.find(t => t.id === turnoId);
                  const isOccupied = !!turnoObj;

                  return (
                    <div className={`p-4 rounded-xl border transition-all ${
                      isOccupied 
                        ? 'bg-gradient-to-br from-[#120808]/80 to-[#030406]/60 border-red-500/30 shadow-[0_4px_20px_rgba(220,38,38,0.05)]' 
                        : 'bg-[#030406]/20 border-white/[0.04] opacity-75'
                    }`}>
                      <div className="flex justify-between items-start pb-2 border-b border-white/[0.05] mb-3">
                        <div>
                          <span className="text-[9px] text-slate-500 font-mono font-bold block">BOX 1</span>
                          <span className="text-xs font-black text-slate-200 uppercase font-display">Lavado & Prep</span>
                        </div>
                        <span className={`text-[8px] px-1.5 py-0.2 rounded font-extrabold tracking-wider ${
                          isOccupied ? 'bg-red-500/15 text-red-400' : 'bg-slate-800 text-slate-500'
                        }`}>
                          {isOccupied ? 'OCUPADO' : 'LIBRE'}
                        </span>
                      </div>

                      {isOccupied ? (
                        <div className="space-y-3">
                          <div className="space-y-0.5">
                            <span className="text-[9px] bg-red-600/10 text-red-400 border border-red-600/20 px-1.5 py-0.2 rounded font-mono font-bold uppercase inline-block">
                              {turnoObj.vehiculoPatente}
                            </span>
                            <h4 className="text-xs font-bold text-slate-100 uppercase">{turnoObj.vehiculoModelo}</h4>
                            <p className="text-[10px] text-slate-400 font-medium truncate">{turnoObj.servicioNombre}</p>
                          </div>

                          <div className="flex justify-between text-[9px] text-slate-500 pt-1.5 border-t border-white/[0.03]">
                            <span>Operario: <b className="text-slate-300 font-bold">{turnoObj.lavadorAsignado || 'Sin asignar'}</b></span>
                            <span className="animate-pulse text-red-500">🧼 Lavando...</span>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full bg-white/[0.03] rounded-full h-1 overflow-hidden border border-white/[0.05]">
                            <div className="bg-red-600 h-full animate-[shimmer_2s_infinite]" style={{ width: '40%' }} />
                          </div>

                          {/* Action Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setBays(prev => ({ ...prev, box1: null, box2: turnoId }));
                              addConsoleLog(`➡️ [TALLER] Vehículo ${turnoObj.vehiculoModelo} [${turnoObj.vehiculoPatente}] avanzó del Box 1 al Box 2 (Pulido).`);
                            }}
                            className="w-full py-1.5 rounded-lg bg-white/[0.03] hover:bg-red-600 hover:text-white border border-white/[0.06] hover:border-red-500 text-[10px] font-black uppercase tracking-wider text-slate-300 transition duration-300 cursor-pointer flex items-center justify-center gap-1"
                          >
                            Mover a Box 2 (Pulido) ➡️
                          </button>
                        </div>
                      ) : (
                        <div className="py-6 text-center space-y-3">
                          <span className="text-2xl block grayscale opacity-30">🧼</span>
                          <span className="text-[10px] text-slate-500 block italic">Sin vehículos en preparación</span>
                          
                          {/* Selector to assign */}
                          <select
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val) {
                                setBays(prev => ({ ...prev, box1: val }));
                                handleUpdateTurnoEstado(val, 'EN_PROCESO');
                                addConsoleLog(`🧼 [TALLER] Vehículo ingresado al Box 1 (Lavado). Estado actualizado a EN_PROCESO.`);
                              }
                            }}
                            className="bg-slate-900/80 border border-white/[0.08] focus:border-red-500/50 rounded-lg px-2 py-1 text-[9px] text-slate-400 font-bold w-full focus:outline-none"
                            defaultValue=""
                          >
                            <option value="">+ INGRESAR AUTO</option>
                            {turnos.filter(t => t.estado === 'PENDIENTE').map(t => (
                              <option key={t.id} value={t.id}>
                                {t.vehiculoModelo} [{t.vehiculoPatente}] - {t.clienteNombre}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* BOX 2 */}
                {(() => {
                  const bayId = 'box2';
                  const turnoId = bays.box2;
                  const turnoObj = turnos.find(t => t.id === turnoId);
                  const isOccupied = !!turnoObj;

                  return (
                    <div className={`p-4 rounded-xl border transition-all ${
                      isOccupied 
                        ? 'bg-gradient-to-br from-[#120808]/80 to-[#030406]/60 border-[#00d2ff]/30 shadow-[0_4px_20px_rgba(6,182,212,0.05)]' 
                        : 'bg-[#030406]/20 border-white/[0.04] opacity-75'
                    }`}>
                      <div className="flex justify-between items-start pb-2 border-b border-white/[0.05] mb-3">
                        <div>
                          <span className="text-[9px] text-slate-500 font-mono font-bold block">BOX 2</span>
                          <span className="text-xs font-black text-slate-200 uppercase font-display">Corrección & Pulido</span>
                        </div>
                        <span className={`text-[8px] px-1.5 py-0.2 rounded font-extrabold tracking-wider ${
                          isOccupied ? 'bg-[#00d2ff]/15 text-[#00d2ff]' : 'bg-slate-800 text-slate-500'
                        }`}>
                          {isOccupied ? 'OCUPADO' : 'LIBRE'}
                        </span>
                      </div>

                      {isOccupied ? (
                        <div className="space-y-3">
                          <div className="space-y-0.5">
                            <span className="text-[9px] bg-[#00d2ff]/10 text-[#00d2ff] border border-[#00d2ff]/20 px-1.5 py-0.2 rounded font-mono font-bold uppercase inline-block">
                              {turnoObj.vehiculoPatente}
                            </span>
                            <h4 className="text-xs font-bold text-slate-100 uppercase">{turnoObj.vehiculoModelo}</h4>
                            <p className="text-[10px] text-slate-400 font-medium truncate">{turnoObj.servicioNombre}</p>
                          </div>

                          <div className="flex justify-between text-[9px] text-slate-500 pt-1.5 border-t border-white/[0.03]">
                            <span>Operario: <b className="text-slate-300 font-bold">{turnoObj.lavadorAsignado || 'Sin asignar'}</b></span>
                            <span className="animate-pulse text-[#00d2ff]">✨ Puliendo...</span>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full bg-white/[0.03] rounded-full h-1 overflow-hidden border border-white/[0.05]">
                            <div className="bg-[#00d2ff] h-full" style={{ width: '70%' }} />
                          </div>

                          {/* Action Buttons */}
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setBays(prev => ({ ...prev, box2: null, box1: turnoId }));
                                addConsoleLog(`⬅️ [TALLER] Vehículo ${turnoObj.vehiculoModelo} regresado al Box 1 (Lavado) para reapretar.`);
                              }}
                              className="py-1.5 rounded bg-white/[0.02] hover:bg-slate-800 text-[9px] font-bold uppercase tracking-wider text-slate-400 transition cursor-pointer text-center"
                            >
                              ⬅️ Regresar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setBays(prev => ({ ...prev, box2: null, box3: turnoId }));
                                addConsoleLog(`➡️ [TALLER] Vehículo ${turnoObj.vehiculoModelo} avanzó al Box 3 (Sellado).`);
                              }}
                              className="py-1.5 rounded bg-[#00d2ff]/10 hover:bg-[#00d2ff]/20 border border-[#00d2ff]/20 text-[9px] font-bold uppercase tracking-wider text-[#00d2ff] transition cursor-pointer text-center"
                            >
                              Siguiente ➡️
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="py-6 text-center space-y-3">
                          <span className="text-2xl block grayscale opacity-30">✨</span>
                          <span className="text-[10px] text-slate-500 block italic">Sin vehículos en pulido</span>
                          
                          {/* Selector to assign */}
                          <select
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val) {
                                setBays(prev => ({ ...prev, box2: val }));
                                handleUpdateTurnoEstado(val, 'EN_PROCESO');
                                addConsoleLog(`✨ [TALLER] Vehículo ingresado directamente al Box 2 (Pulido). Estado actualizado a EN_PROCESO.`);
                              }
                            }}
                            className="bg-slate-900/80 border border-white/[0.08] focus:border-[#00d2ff]/50 rounded-lg px-2 py-1 text-[9px] text-slate-400 font-bold w-full focus:outline-none"
                            defaultValue=""
                          >
                            <option value="">+ INGRESAR AUTO</option>
                            {turnos.filter(t => t.estado === 'PENDIENTE' || t.estado === 'EN_PROCESO').map(t => (
                              <option key={t.id} value={t.id}>
                                {t.vehiculoModelo} [{t.vehiculoPatente}] - {t.clienteNombre}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* BOX 3 */}
                {(() => {
                  const bayId = 'box3';
                  const turnoId = bays.box3;
                  const turnoObj = turnos.find(t => t.id === turnoId);
                  const isOccupied = !!turnoObj;

                  return (
                    <div className={`p-4 rounded-xl border transition-all ${
                      isOccupied 
                        ? 'bg-gradient-to-br from-[#120808]/80 to-[#030406]/60 border-amber-500/30 shadow-[0_4px_20px_rgba(245,158,11,0.05)]' 
                        : 'bg-[#030406]/20 border-white/[0.04] opacity-75'
                    }`}>
                      <div className="flex justify-between items-start pb-2 border-b border-white/[0.05] mb-3">
                        <div>
                          <span className="text-[9px] text-slate-500 font-mono font-bold block">BOX 3</span>
                          <span className="text-xs font-black text-slate-200 uppercase font-display">Curado & Sellado</span>
                        </div>
                        <span className={`text-[8px] px-1.5 py-0.2 rounded font-extrabold tracking-wider ${
                          isOccupied ? 'bg-amber-500/15 text-amber-400' : 'bg-slate-800 text-slate-500'
                        }`}>
                          {isOccupied ? 'OCUPADO' : 'LIBRE'}
                        </span>
                      </div>

                      {isOccupied ? (
                        <div className="space-y-3">
                          <div className="space-y-0.5">
                            <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.2 rounded font-mono font-bold uppercase inline-block">
                              {turnoObj.vehiculoPatente}
                            </span>
                            <h4 className="text-xs font-bold text-slate-100 uppercase">{turnoObj.vehiculoModelo}</h4>
                            <p className="text-[10px] text-slate-400 font-medium truncate">{turnoObj.servicioNombre}</p>
                          </div>

                          <div className="flex justify-between text-[9px] text-slate-500 pt-1.5 border-t border-white/[0.03]">
                            <span>Operario: <b className="text-slate-300 font-bold">{turnoObj.lavadorAsignado || 'Sin asignar'}</b></span>
                            <span className="animate-pulse text-amber-400">🔥 Curando laca...</span>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full bg-white/[0.03] rounded-full h-1 overflow-hidden border border-white/[0.05]">
                            <div className="bg-amber-500 h-full" style={{ width: '95%' }} />
                          </div>

                          {/* Action Buttons */}
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setBays(prev => ({ ...prev, box3: null, box2: turnoId }));
                                addConsoleLog(`⬅️ [TALLER] Vehículo ${turnoObj.vehiculoModelo} regresado al Box 2 (Pulido) para retoques.`);
                              }}
                              className="py-1.5 rounded bg-white/[0.02] hover:bg-slate-800 text-[9px] font-bold uppercase tracking-wider text-slate-400 transition cursor-pointer text-center"
                            >
                              ⬅️ Regresar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setBays(prev => ({ ...prev, box3: null }));
                                handleUpdateTurnoEstado(turnoId, 'COMPLETADO');
                                addConsoleLog(`✅ [TALLER] ¡Acondicionamiento finalizado! Vehículo ${turnoObj.vehiculoModelo} listo para entregar.`);
                              }}
                              className="py-1.5 rounded bg-emerald-500 text-slate-950 text-[9px] font-black uppercase tracking-wider transition cursor-pointer text-center shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                            >
                              Finalizar ✅
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="py-6 text-center space-y-3">
                          <span className="text-2xl block grayscale opacity-30">💎</span>
                          <span className="text-[10px] text-slate-500 block italic">Sin vehículos en sellado</span>
                          
                          {/* Selector to assign */}
                          <select
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val) {
                                setBays(prev => ({ ...prev, box3: val }));
                                handleUpdateTurnoEstado(val, 'EN_PROCESO');
                                addConsoleLog(`💎 [TALLER] Vehículo ingresado directamente al Box 3 (Sellado). Estado actualizado a EN_PROCESO.`);
                              }
                            }}
                            className="bg-slate-900/80 border border-white/[0.08] focus:border-amber-500/50 rounded-lg px-2 py-1 text-[9px] text-slate-400 font-bold w-full focus:outline-none"
                            defaultValue=""
                          >
                            <option value="">+ INGRESAR AUTO</option>
                            {turnos.filter(t => t.estado === 'PENDIENTE' || t.estado === 'EN_PROCESO').map(t => (
                              <option key={t.id} value={t.id}>
                                {t.vehiculoModelo} [{t.vehiculoPatente}] - {t.clienteNombre}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })()}

              </div>

            </div>

            {/* Bottom Row: Retró Terminal Simulator (Marketing campaign outputs) */}
            <div className="glass-panel p-5 rounded-xl space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-[#00d2ff]/10 border border-[#00d2ff]/20 text-[#00d2ff]">
                    <Terminal className="w-4 h-4" />
                  </span>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Consola de Automatización & Fidelización (Growth Marketing)</h3>
                </div>
                
                {/* Execute Campaign action */}
                <button
                  id="btn-run-marketing-script"
                  onClick={handleRunLoyaltyCampaign}
                  className="bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] hover:border-[#00d2ff]/30 text-[10px] font-bold text-[#00d2ff] hover:text-white px-3 py-1.5 rounded-lg transition-all uppercase tracking-wider cursor-pointer"
                >
                  Ejecutar Campaña Fidelidad
                </button>
              </div>

              {/* Terminal code logs representation */}
              <div className="bg-black/80 text-emerald-400 font-mono text-xs p-4 rounded-xl border border-white/[0.08] h-[140px] overflow-y-auto space-y-1.5 scrollbar-thin">
                {consoleLogs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed hover:bg-white/[0.02] px-1.5 py-0.5 rounded transition">
                    {log}
                  </div>
                ))}
              </div>

              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>Comandos en segundo plano (Python-fastapi daemon)</span>
                <span>Visitas inactivas automáticas: {clientes.filter((c) => c.ultimaVisitaDiasAgo > 20).length} detectadas</span>
              </div>
            </div>

          </div>
        )}

        {/* TAB: TURNOS */}
        {activeTab === 'turnos' && (
          <div className="space-y-6 animate-fade-in">
            <TurnosKanbanView
              turnos={turnos}
              clientes={clientes}
              onAddTurno={handleAddTurnoSecure}
              onUpdateTurnoEstado={handleUpdateTurnoEstado}
              onDeleteTurno={handleDeleteTurno}
              onAddLog={addConsoleLog}
              preselectedClienteId={preselectedClienteId}
              onClearPreselectedCliente={() => setPreselectedClienteId(undefined)}
              onUpdateClient={handleUpdateClient}
              onUpdateTurno={(updated) => {
                if (dbOnline && !updated.id.startsWith('t_')) {
                  const employee = rawDbData.empleados?.find((item: any) => item.nombre === updated.lavadorAsignado);
                  fetch(`/api/turnos/${updated.id}/reprogramaciones`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      employeeId: employee?.id ?? null,
                      scheduledAt: updated.fechaCreacion,
                    }),
                  })
                    .then(res => res.json())
                    .then(data => {
                      if (data.status === 'success') {
                        setTurnos(prev => prev.map(t => t.id === updated.id ? updated : t));
                        addConsoleLog(`🔄 [REST] Turno #${updated.id} reprogramado en Supabase.`);
                        loadDashboardData();
                      } else {
                        showToast('Error al reprogramar turno.', 'warning');
                      }
                    })
                    .catch(() => showToast('Error de red al reprogramar.', 'warning'));
                } else {
                  setTurnos(prev => prev.map(t => t.id === updated.id ? updated : t));
                }
              }}
            />
          </div>
        )}

        {activeTab === 'clientes' && canUseClients && (
          <ClientsView
            clientes={clientes}
            turnos={turnos}
            onNewClient={() => setShowAddClientForm(true)}
            onNewAppointment={(clientId) => {
              setPreselectedClienteId(clientId);
              setActiveTab('turnos');
            }}
            onUpdateClient={handleUpdateClient}
          />
        )}

        {activeTab === 'more' && isAdmin && (
          <MoreHub onSelect={handleSelectMoreModule} />
        )}

        {activeTab === 'excel' && isAdmin && (
          <ExcelIntegration
            clientes={clientes}
            turnos={turnos}
            transacciones={transacciones}
            insumos={insumos}
            onImportClients={handleImportClientsAtomic}
          />
        )}

        {/* TAB: CAJA & INVENTARIO */}
        {activeTab === 'caja' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex gap-2 border-b border-white/[0.06] pb-3 overflow-x-auto">
              <button
                onClick={() => setCajaSubTab('pos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition uppercase tracking-wider cursor-pointer ${
                  cajaSubTab === 'pos'
                    ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30 shadow-[0_0_15px_rgba(255,255,255,0.05)]'
                    : 'text-slate-400 hover:text-slate-200 bg-white/[0.01] border border-white/[0.06]'
                }`}
              >
                Caja y tickets
              </button>
              <button
                onClick={() => setCajaSubTab('facturacion')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 uppercase tracking-wider cursor-pointer ${
                  cajaSubTab === 'facturacion'
                    ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30 shadow-[0_0_15px_rgba(255,255,255,0.05)]'
                    : 'text-slate-400 hover:text-slate-200 bg-white/[0.01] border border-white/[0.06]'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-brand-primary" />
                Factura electrónica C
              </button>
              <button
                onClick={() => setCajaSubTab('comisiones')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 uppercase tracking-wider cursor-pointer ${
                  cajaSubTab === 'comisiones'
                    ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30 shadow-[0_0_15px_rgba(255,255,255,0.05)]'
                    : 'text-slate-400 hover:text-slate-200 bg-white/[0.01] border border-white/[0.06]'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-brand-primary" />
                Comisiones Operarios
              </button>
            </div>

            {cajaSubTab === 'pos' && (
              <CajaDiariaLedger
                role={currentRole}
                insumos={insumos}
                onReplenishInsumo={handleReplenishInsumo}
                transacciones={transacciones}
                onAddTransaccion={handleAddTransaccion}
                cajaAbierta={cajaAbierta}
                montoApertura={montoApertura}
                onOpenCaja={handleOpenCaja}
                onCloseCaja={handleCloseCajaSecure}
                onSellPOS={handleSellPOS}
                turnos={turnos}
                onChargeTurno={handleChargeTurno}
              />
            )}
            {cajaSubTab === 'facturacion' && (
              <ArgentineFacturacion
                transacciones={transacciones}
                clientes={clientes}
                turnos={turnos}
                onAddLog={addConsoleLog}
              />
            )}
            {cajaSubTab === 'comisiones' && (
              <EmployeeCommissions
                turnos={turnos}
                transacciones={transacciones}
                cajaAbierta={cajaAbierta}
                onAddTransaccion={handleAddTransaccion}
                onAddLog={addConsoleLog}
              />
            )}
          </div>
        )}

        {/* TAB: PUBLIC PORTAL & DIGITAL STORE */}
        {activeTab === 'public-page' && (
          <div className="space-y-6 animate-fade-in">
            <div className="glass-panel p-5 rounded-xl space-y-2">
              <h3 className="text-base font-bold text-white uppercase tracking-wider font-display">Portal Comercial & Tienda de Promociones</h3>
              <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                Este es el portal web público interactivo de tu lavadero. Los clientes pueden ver tratamientos cerámicos, comprar promociones activas y agendar turnos directamente online. Las reservas ingresarán automáticamente como turnos pendientes en tu panel Kanban de administración.
              </p>
            </div>

            <PublicPage
              onAddTurno={handleAddTurnoSecure}
              onAddLog={addConsoleLog}
              initialTurnos={turnos}
              servicios={rawDbData?.servicios || []}
            />
          </div>
        )}

        {/* TAB: PUBLICIDAD & CAMPAÑAS */}
        {activeTab === 'publicidad' && (
          <div className="space-y-6 animate-fade-in">
            {/* Sub-tab navigation */}
            <div className="flex border-b border-white/[0.08] relative z-20 overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setSubTabPublicidad('flyers')}
                className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition duration-200 shrink-0 cursor-pointer ${
                  subTabPublicidad === 'flyers'
                    ? 'border-brand-primary text-white bg-white/[0.02]'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
                }`}
              >
                Diseñador de Flyers
              </button>
              <button
                type="button"
                onClick={() => setSubTabPublicidad('loyalty')}
                className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition duration-200 shrink-0 cursor-pointer ${
                  subTabPublicidad === 'loyalty'
                    ? 'border-brand-primary text-white bg-white/[0.02]'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
                }`}
              >
                CRM & Cupones VIP
              </button>
              <button
                type="button"
                onClick={() => setSubTabPublicidad('whatsapp-crm')}
                className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition duration-200 shrink-0 cursor-pointer ${
                  subTabPublicidad === 'whatsapp-crm'
                    ? 'border-brand-primary text-white bg-white/[0.02]'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
                }`}
              >
                CRM WhatsApp & Alertas
              </button>
            </div>

            {subTabPublicidad === 'flyers' && (
              <>
                <div className="glass-panel p-5 rounded-xl space-y-2">
                  <h3 className="text-base font-bold text-white uppercase tracking-wider font-display">Diseñador de Publicidades y Promociones</h3>
                  <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                    Utilizá esta herramienta para diseñar y descargar flyers de <b>lavado premium, tapicería húmeda, tratamientos cerámicos o pulido de ópticas</b>. También podés copiar el texto sugerido y publicarlo manualmente en el canal que elijas.
                  </p>
                </div>
                <PromoPosterCreator onAddPromotionToConsole={addConsoleLog} />
              </>
            )}

            {subTabPublicidad === 'loyalty' && (
              <>
                <div className="glass-panel p-5 rounded-xl space-y-2">
                  <h3 className="text-base font-bold text-white uppercase tracking-wider font-display">CRM & Campañas de Fidelización</h3>
                  <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                    Segmenta automáticamente tu base de clientes para identificar vehículos inactivos o clientes VIP fieles. Crea cupones digitales personalizados y copia plantillas de mensajes listas para WhatsApp.
                  </p>
                </div>
                <LoyaltyCampaigns clientes={clientes} onAddLog={addConsoleLog} />
              </>
            )}

            {subTabPublicidad === 'whatsapp-crm' && (
              <WhatsAppCRMHub 
                turnos={turnos}
                onAddLog={addConsoleLog}
              />
            )}
          </div>
        )}

        {/* TAB: INVENTARIO & STOCK */}
        {activeTab === 'inventario' && (
          <div className="space-y-6 animate-fade-in">
            <div className="glass-panel p-5 rounded-xl space-y-2">
              <h3 className="text-base font-bold text-white uppercase tracking-wider font-display">Control de Stock & Compras a Proveedores</h3>
              <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                Administrá el inventario sincronizado con movimientos auditables. Las entradas pagadas impactan stock y caja en una única operación; las órdenes PDF son borradores sin efectos contables.
              </p>
            </div>

            <InventoryManagement
              insumos={insumos}
              onAdjustStock={handleInventoryMovement}
              onAddLog={addConsoleLog}
            />
          </div>
        )}

        {/* TAB: CERAMIC SERVICES & PREMIUM DETAILING */}
        {activeTab === 'ceramic' && (
          <div className="space-y-6 animate-fade-in">
            <div className="glass-panel p-5 rounded-xl space-y-2">
              <h3 className="text-base font-bold text-white uppercase tracking-wider font-display flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-red-500 animate-pulse" />
                Estética Vehicular & Tratamientos Cerámicos
              </h3>
              <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
                Gestiona y configura los servicios de valor agregado premium para Albelo Detail. Calcula presupuestos automatizados en base al tamaño del vehículo, configura durabilidades de 1, 3 y 5 años con sus respectivas fórmulas de recargo, y agenda turnos complejos integrados con el Kanban.
              </p>
            </div>

            <CeramicServices
              clientes={clientes}
              turnos={turnos}
              onAddTurno={handleAddTurnoSecure}
              onAddLog={addConsoleLog}
              servicios={rawDbData?.servicios || []}
            />
          </div>
        )}

        {/* TAB: BRANDING IDENTIDAD PREMIUM */}
        {activeTab === 'branding' && (
          <div className="space-y-6 animate-fade-in">
            <div className="glass-panel p-5 rounded-xl space-y-2">
              <h3 className="text-base font-bold text-white uppercase tracking-wider font-display flex items-center gap-2">
                <Palette className="w-5 h-5 text-brand-primary" />
                Identidad de Marca & Branding Personalizado
              </h3>
              <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
                Controla la experiencia visual premium de tu taller Albelo Detail. Define el logotipo, el nombre comercial de tu sucursal y la paleta de colores para que se propague de manera consistente por el dashboard, el portal público de reservas y el sistema de impresión de facturas AFIP.
              </p>
            </div>

            <BrandSettings
              config={brandConfig}
              onSave={handleSaveBrandConfig}
              onAddLog={addConsoleLog}
            />
          </div>
        )}

        </Suspense>
      </main>

      {/* Elegant Footer */}
      <footer className="border-t border-white/[0.08] bg-white/[0.01] backdrop-blur-md py-6 px-4 lg:px-8 text-center text-xs text-slate-500 space-y-2 mt-12 relative z-30">
        <p className="font-semibold text-slate-400 font-display uppercase tracking-widest text-[10px]">
          MOBILE <span className="text-[#00d2ff]">WASH</span> CAR WASH • GESTIÓN DIARIA 2026
        </p>
        <p>Sistema de turnos, clientes, trabajos y caja para el lavadero.</p>
      </footer>

    </div>
  );
}
