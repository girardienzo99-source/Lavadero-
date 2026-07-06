import React, { useState, useEffect } from 'react';
import { 
  Car, Shield, Sparkles, Droplet, Users, DollarSign, Package, 
  Terminal, ShieldAlert, BadgePercent, CheckCircle, HelpCircle, 
  ChevronRight, RefreshCw, AlertCircle, Plus, Info, Star, Trash2,
  FileText, Globe, MessageSquare, Crown, Flame, Palette, LogOut
} from 'lucide-react';
import { Rol, Cliente, Turno, Insumo, Transaccion, TipoServicio, BrandConfig } from './types';
import { 
  INITIAL_CLIENTES, INITIAL_TURNOS, INITIAL_INSUMOS, INITIAL_TRANSACCIONES 
} from './data/initialData';
import PromoPosterCreator from './components/PromoPosterCreator';
import LoyaltyCampaigns from './components/LoyaltyCampaigns';
import PlanRoadmap from './components/PlanRoadmap';
import CajaDiariaLedger from './components/CajaDiariaLedger';
import TurnosKanbanView from './components/TurnosKanbanView';
import ArgentineFacturacion from './components/ArgentineFacturacion';
import PublicPage from './components/PublicPage';
import InventoryManagement from './components/InventoryManagement';
import CeramicServices from './components/CeramicServices';
import BrandSettings from './components/BrandSettings';
import Login from './components/Login';
import WhatsAppCRMHub from './components/WhatsAppCRMHub';

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'overview' | 'turnos' | 'caja' | 'publicidad' | 'roadmap' | 'public-page' | 'inventario' | 'ceramic' | 'branding'>('overview');
  const [cajaSubTab, setCajaSubTab] = useState<'pos' | 'facturacion'>('pos');
  const [statsSubTab, setStatsSubTab] = useState<'semanal' | 'mix' | 'lavadores'>('semanal');
  const [subTabPublicidad, setSubTabPublicidad] = useState<'flyers' | 'loyalty' | 'whatsapp-crm'>('flyers');

  // Session state
  const [session, setSession] = useState<{ nombre: string; rol: string } | null>(() => {
    const saved = localStorage.getItem('session');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  // Role Base Access Control State
  const [currentRole, setCurrentRole] = useState<Rol>('SUPERADMIN');

  // Database Connection Simulator State
  const [dbOnline, setDbOnline] = useState(true);

  // Core App States
  const [clientes, setClientes] = useState<Cliente[]>(INITIAL_CLIENTES);
  const [turnos, setTurnos] = useState<Turno[]>(INITIAL_TURNOS);
  const [insumos, setInsumos] = useState<Insumo[]>(INITIAL_INSUMOS);
  const [transacciones, setTransacciones] = useState<Transaccion[]>(INITIAL_TRANSACCIONES);
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
  const [cajaAbierta, setCajaAbierta] = useState(true);
  const [montoApertura, setMontoApertura] = useState(35000);

  // Background Console Log simulator state
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    '🟢 [SYS] Sistema inicializado en puerto :3000.',
    '💾 [DB] Conexión establecida con Supabase PostgreSQL.',
    '🔑 [RBAC] Sesión iniciada con privilegios Superadmin.',
    '💰 [CAJA] Caja abierta automáticamente con $35,000 ARS de base.'
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
      const isManager = session.rol === 'superadmin' || session.rol === 'administrador';
      setCurrentRole(isManager ? 'SUPERADMIN' : 'LAVADOR');
    }
  }, [session]);

  // REST API dashboard loader
  const loadDashboardData = () => {
    if (!dbOnline) return;

    fetch('/api/dashboard-data')
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'success') {
          setRawDbData(data);

          // Map DB clients
          const mappedClientes: Cliente[] = (data.clientes || []).map((c: any) => {
            const clientVehicles = (data.vehiculos || []).filter((v: any) => v.cliente_id === c.id);
            const pat = clientVehicles.map((v: any) => v.patente).join(', ') || 'Sin Auto';
            const mod = clientVehicles.map((v: any) => `${v.marca} ${v.modelo}`).join(', ') || 'Sin Auto';
            
            return {
              id: String(c.id),
              nombre: c.nombre,
              telefono: c.telefono || '',
              vehiculoPatente: pat,
              vehiculoModelo: mod,
              visitas: (data.turnos || []).filter((t: any) => t.cliente_id === c.id && (t.estado === 'COMPLETADO' || t.estado === 'ENTREGADO')).length || 0,
              ultimaVisitaDiasAgo: c.ultima_visita ? Math.max(0, Math.floor((Date.now() - new Date(c.ultima_visita).getTime()) / (1000 * 60 * 60 * 24))) : 99
            };
          });
          setClientes(mappedClientes);

          // Map DB turnos
          const mappedTurnos: Turno[] = (data.turnos || []).map((t: any) => {
            let cat: TipoServicio = 'LAVADO';
            const nameLower = t.servicio_nombre.toLowerCase();
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
            origen: m.descripcion.includes('Venta POS') ? 'VENTA_POS' : (m.descripcion.includes('Turno') ? 'TURNO' : 'MANUAL'),
            fecha: new Date().toISOString().split('T')[0] + 'T' + m.hora + ':00.000Z'
          }));
          setTransacciones(mappedTx);

          // Map cashbox
          if (data.caja) {
            setCajaAbierta(data.caja.estado === 'ABIERTA');
            setMontoApertura(Number(data.caja.monto_apertura));
          } else {
            setCajaAbierta(false);
          }
        }
      })
      .catch((err) => {
        console.error("Error loading dashboard data:", err);
      });
  };

  useEffect(() => {
    if (session) {
      loadDashboardData();
    }
  }, [session, dbOnline]);

  // Core Handlers connected to real API
  const handleAddTurno = (newT: Turno) => {
    if (dbOnline && rawDbData) {
      const clienteObj = rawDbData.clientes?.find((c: any) => c.nombre === newT.clienteNombre);
      const vehiculoObj = rawDbData.vehiculos?.find((v: any) => v.patente === newT.vehiculoPatente);
      const servicioObj = rawDbData.servicios?.find((s: any) => s.nombre === newT.servicioNombre || newT.servicioNombre.includes(s.nombre));
      const empleadoObj = rawDbData.empleados?.find((e: any) => e.nombre === newT.lavadorAsignado);

      const insertTurno = (cId: number | string, vId: number | string, sId: number | string) => {
        let url = `/api/turnos/agendar?clienteId=${cId}&vehiculoId=${vId}&servicioId=${sId}&fechaHora=${newT.fechaCreacion.replace('T', ' ').slice(0, 19)}`;
        if (empleadoObj) {
          url += `&empleadoId=${empleadoObj.id}`;
        }

        fetch(url, { method: 'POST' })
          .then((res) => res.json())
          .then((data) => {
            if (data.status === 'success') {
              addConsoleLog(`📅 [REST] Turno agendado en Supabase ID: ${data.id}`);
              loadDashboardData();
            } else {
              showToast('Error al agendar turno.', 'warning');
            }
          })
          .catch(() => showToast('Error de red al agendar turno.', 'warning'));
      };

      if (clienteObj && vehiculoObj && servicioObj) {
        insertTurno(clienteObj.id, vehiculoObj.id, servicioObj.id);
        return;
      }

      if (servicioObj) {
        // Step 1: Create client if missing
        const getOrCreateClient = (): Promise<number | string> => {
          if (clienteObj) return Promise.resolve(clienteObj.id);
          const cliUrl = `/api/clientes/nuevo?nombre=${encodeURIComponent(newT.clienteNombre)}&telefono=${encodeURIComponent(newT.telefono || '+549261000000')}`;
          return fetch(cliUrl, { method: 'POST' })
            .then(res => res.json())
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
            .then(res => res.json())
            .then(data => {
              if (data.status === 'success') return data.id;
              throw new Error('Failed to create vehicle');
            });
        };

        getOrCreateClient()
          .then(cId => {
            return getOrCreateVehicle(cId).then(vId => {
              insertTurno(cId, vId, servicioObj.id);
            });
          })
          .catch(err => {
            console.error(err);
            showToast('Error al registrar cliente/vehículo para el turno.', 'warning');
          });
        return;
      }
    }

    setTurnos((prev) => [...prev, newT]);
    showToast(`Turno agendado para ${newT.clienteNombre}`, 'success');
  };

  const handleUpdateTurnoEstado = (
    id: string, 
    nuevoEstado: 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADO' | 'ENTREGADO',
    nps?: number,
    comentarios?: string
  ) => {
    if (dbOnline && !id.startsWith('t_')) {
      fetch(`/api/turnos/${id}/estado?estado=${nuevoEstado}`, { method: 'POST' })
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
    }

    // Local Simulation
    setTurnos((prev) => 
      prev.map((t) => {
        if (t.id === id) {
          const updated = { ...t, estado: nuevoEstado, npsScore: nps, comentarios };
          
          if (nuevoEstado === 'COMPLETADO') {
            const newTx: Transaccion = {
              id: `tx_aut_${Date.now()}`,
              tipo: 'INGRESO',
              monto: t.precio,
              concepto: `Cobro Turno #${t.id.slice(-4)} - ${t.clienteNombre} (${t.servicioNombre})`,
              origen: 'TURNO',
              fecha: new Date().toISOString()
            };
            setTransacciones((prevT) => [...prevT, newTx]);
            
            setInsumos((prevI) => {
              const updatedInsumos = prevI.map((ins) => {
                let qtyDeduction = 0;

                if (t.tipo === 'LAVADO') {
                  if (ins.id === 'i1') qtyDeduction = 1; // Shampoo pH Neutro
                  if (ins.id === 'i2') qtyDeduction = 0.5; // Silicona Premium
                  if (ins.id === 'i3' && (t.servicioNombre.toLowerCase().includes('encerado') || t.servicioNombre.toLowerCase().includes('carnauba') || t.servicioNombre.toLowerCase().includes('premium'))) {
                    qtyDeduction = 0.2; // Cera líquida Carnauba
                  }
                } else if (t.tipo === 'TAPICERIA') {
                  if (ins.id === 'i4') qtyDeduction = 1; // Limpiador APC
                  if (ins.id === 'i6') qtyDeduction = 0.5; // Paños de Microfibra
                } else if (t.tipo === 'ESTETICA') {
                  const sName = t.servicioNombre.toLowerCase();
                  if (ins.id === 'i7' && (sName.includes('cerámico') || sName.includes('sio2'))) {
                    qtyDeduction = 0.2; // Sellador SiO2
                  }
                  if (ins.id === 'i5' && (sName.includes('pulido') || sName.includes('corrección') || sName.includes('tratamiento'))) {
                    qtyDeduction = 0.2; // Compuesto Pulidor
                  }
                  if (ins.id === 'i6' && (sName.includes('pulido') || sName.includes('corrección') || sName.includes('tratamiento'))) {
                    qtyDeduction = 1; // Paños de Microfibra
                  }
                }

                if (qtyDeduction > 0) {
                  const newStock = Math.max(0, Number((ins.stockActual - qtyDeduction).toFixed(2)));
                  
                  if (newStock === 0) {
                    addConsoleLog(`🚨 [ALERTA STOCK] ¡El insumo "${ins.nombre}" se ha AGOTADO por completo!`);
                  } else if (newStock <= ins.stockMinimo) {
                    addConsoleLog(`⚠️ [BAJO STOCK] El insumo "${ins.nombre}" cayó bajo el límite mínimo (${newStock} / ${ins.stockMinimo} ${ins.unidad}).`);
                  } else {
                    addConsoleLog(`📉 [INVENTARIO] Deducido automático por servicio: -${qtyDeduction} ${ins.unidad} de "${ins.nombre}".`);
                  }
                  return { ...ins, stockActual: newStock };
                }
                return ins;
              });
              return updatedInsumos;
            });
          }
          return updated;
        }
        return t;
      })
    );
  };

  const handleDeleteTurno = (id: string) => {
    // Local / Simulation delete (can extend with backend cancellation endpoint if needed)
    setTurnos((prev) => prev.filter((t) => t.id !== id));
    addConsoleLog(`🗑️ Turno eliminado ID: ${id}`);
    showToast('Turno eliminado correctamente', 'warning');
  };

  const handleReplenishInsumo = (id: string) => {
    if (currentRole === 'LAVADOR' || currentRole === 'OPERARIO') {
      showToast('No tienes permisos de administrador para reabastecer inventario.', 'warning');
      return;
    }

    if (dbOnline && !id.startsWith('i')) {
      fetch(`/api/pos/productos/${id}/reabastecer?cantidad=10`, { method: 'POST' })
        .then((res) => res.json())
        .then((data) => {
          if (data.status === 'success' || data.stock !== undefined) {
            addConsoleLog(`📦 [REST] Stock de insumo reabastecido (+10) en Supabase.`);
            loadDashboardData();
          } else {
            showToast('Error al reabastecer stock.', 'warning');
          }
        })
        .catch(() => showToast('Error de red al reabastecer stock.', 'warning'));
      return;
    }

    setInsumos((prev) => 
      prev.map((ins) => {
        if (ins.id === id) {
          const added = 10;
          const cost = ins.precioCosto * added;
          
          const newTx: Transaccion = {
            id: `tx_rep_${Date.now()}`,
            tipo: 'EGRESO',
            monto: cost,
            concepto: `Abastecimiento de Stock: +10 ${ins.nombre}`,
            origen: 'MANUAL',
            fecha: new Date().toISOString()
          };
          setTransacciones((prevT) => [...prevT, newTx]);
          addConsoleLog(`📦 [STOCK] Reabastecido ${ins.nombre} con +10 unidades. Egreso registrado: -$${cost} ARS.`);
          return { ...ins, stockActual: ins.stockActual + added };
        }
        return ins;
      })
    );
  };

  const handleAddTransaccion = (
    monto: number, 
    concepto: string, 
    tipo: 'INGRESO' | 'EGRESO', 
    origen: 'MANUAL' | 'VENTA_POS'
  ) => {
    if (dbOnline) {
      fetch(`/api/caja/movimiento?tipo=${tipo}&monto=${monto}&descripcion=${encodeURIComponent(concepto)}`, { method: 'POST' })
        .then((res) => res.json())
        .then((data) => {
          if (data.status === 'success') {
            addConsoleLog(`💰 [REST] Movimiento contable registrado en Supabase: $${monto}`);
            loadDashboardData();
          } else {
            showToast('Error al registrar movimiento.', 'warning');
          }
        })
        .catch(() => showToast('Error de red al registrar movimiento.', 'warning'));
      return;
    }

    const newTx: Transaccion = {
      id: `tx_man_${Date.now()}`,
      tipo,
      monto,
      concepto,
      origen,
      fecha: new Date().toISOString()
    };
    setTransacciones((prev) => [...prev, newTx]);
    addConsoleLog(`💰 [CAJA] Transacción registrada: ${tipo} de $${monto} por "${concepto}".`);
    showToast(`Transacción registrada: $${monto}`, tipo === 'INGRESO' ? 'success' : 'warning');
  };

  const handleSellPOS = (insumoId: string, cantidad: number) => {
    if (dbOnline && !insumoId.startsWith('i') && rawDbData) {
      const clientObj = rawDbData.clientes?.[0]; // default client
      if (clientObj) {
        const payload = {
          clienteId: clientObj.id,
          metodoPago: 'EFECTIVO',
          detalles: [{ productoId: Number(insumoId), cantidad: cantidad }],
          codigoCupon: null
        };

        fetch(`/api/pos/venta`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        .then((res) => res.json())
        .then((data) => {
          if (data.status === 'error') {
            showToast(`Error: ${data.message}`, 'warning');
          } else {
            addConsoleLog(`🛒 [REST] Venta POS registrada en Supabase. Total cobrado: $${data.venta.total}`);
            loadDashboardData();
          }
        })
        .catch(() => showToast('Error de red al registrar venta POS.', 'warning'));
        return;
      }
    }

    setInsumos((prev) => 
      prev.map((ins) => {
        if (ins.id === insumoId) {
          const newStock = Math.max(0, ins.stockActual - cantidad);
          const priceSold = Math.round(ins.precioCosto * 1.5 * cantidad);
          
          handleAddTransaccion(
            priceSold,
            `Venta POS: ${cantidad}x ${ins.nombre}`,
            'INGRESO',
            'VENTA_POS'
          );
          
          return { ...ins, stockActual: newStock };
        }
        return ins;
      })
    );
  };

  const handleOpenCaja = (monto: number) => {
    if (dbOnline) {
      fetch(`/api/caja/abrir?montoApertura=${monto}`, { method: 'POST' })
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
    }

    setCajaAbierta(true);
    setMontoApertura(monto);
    setTransacciones([{
      id: `tx_init_${Date.now()}`,
      tipo: 'INGRESO',
      monto,
      concepto: 'Monto de Apertura de Caja',
      origen: 'MANUAL',
      fecha: new Date().toISOString()
    }]);
    addConsoleLog(`💰 [CAJA] Turno Abierto. Fondo inicial establecido: $${monto} ARS.`);
  };

  const handleCloseCaja = (montoCierre: number) => {
    if (dbOnline) {
      fetch(`/api/caja/cerrar?montoCierre=${montoCierre}`, { method: 'POST' })
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
    }

    setCajaAbierta(false);
    addConsoleLog(`🏁 [CAJA] Caja Cerrada con Arqueo Real de $${montoCierre} ARS.`);
    showToast(`Arqueo Cerrado. Saldo de Cierre: $${montoCierre}`, 'success');
  };

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !newClientPatente) return;

    if (dbOnline) {
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
    }

    const newC: Cliente = {
      id: `c_${Date.now()}`,
      nombre: newClientName,
      telefono: newClientPhone || '+549261000000',
      vehiculoPatente: newClientPatente.toUpperCase(),
      vehiculoModelo: newClientModelo || 'Vehículo Genérico',
      visitas: 1,
      ultimaVisitaDiasAgo: 0
    };

    setClientes((prev) => [newC, ...prev]);
    setShowAddClientForm(false);
    setNewClientName('');
    setNewClientPhone('');
    setNewClientPatente('');
    setNewClientModelo('');

    addConsoleLog(`👤 Nuevo cliente registrado: ${newC.nombre} con auto ${newC.vehiculoModelo} (${newC.vehiculoPatente}).`);
    showToast('Cliente guardado con éxito', 'success');
  };

  const handleRunLoyaltyCampaign = () => {
    addConsoleLog('🚀 Iniciando script de Growth Marketing en background...');
    addConsoleLog('🔍 Buscando en base de datos clientes con inactividad mayor a 20 días...');
    
    if (dbOnline) {
      fetch('/api/marketing/run-loyalty', { method: 'POST' })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            addConsoleLog(`✅ [REST] Campaña de marketing ejecutada con éxito. Salida: ${data.exitCode}`);
            const lines = (data.stdout || '').split('\n');
            lines.forEach((line: string) => {
              if (line.trim()) addConsoleLog(`🐍 [PYTHON] ${line}`);
            });
            loadDashboardData();
          } else {
            addConsoleLog(`🔴 [REST] Error al procesar campaña: ${data.stderr}`);
          }
        })
        .catch(() => showToast('Error de red al ejecutar campaña.', 'warning'));
      return;
    }

    setTimeout(() => {
      const inactiveClients = clientes.filter((c) => c.ultimaVisitaDiasAgo > 20);
      
      if (inactiveClients.length === 0) {
        addConsoleLog('✅ Escaneo completo: No se encontraron clientes inactivos.');
        showToast('Escaneo completo: No se detectaron clientes inactivos', 'info');
        return;
      }

      addConsoleLog(`📋 Encontrados ${inactiveClients.length} clientes inactivos. Generando cupones...`);
      
      inactiveClients.forEach((client, idx) => {
        setTimeout(() => {
          const promoLink = `https://albelodetail.promo/coupon-15off-${client.id}`;
          addConsoleLog(`📧 [Enviado] Cupón enviado a ${client.nombre} (${client.telefono}). Promo: 15% OFF. Enlace: ${promoLink}`);
        }, (idx + 1) * 800);
      });

      setClientes((prev) => 
        prev.map((c) => {
          if (c.ultimaVisitaDiasAgo > 20) {
            return { ...c, visitas: c.visitas + 1, ultimaVisitaDiasAgo: 0 };
          }
          return c;
        })
      );

      setTimeout(() => {
        addConsoleLog('✅ Campaña finalizada con éxito. Cupones despachados.');
        showToast('¡Campaña despachada correctamente!', 'success');
      }, (inactiveClients.length + 1) * 800);

    }, 1000);
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
  const npsAvg = completedTurnos.length > 0
    ? (completedTurnos.reduce((sum, t) => sum + (t.npsScore || 5), 0) / completedTurnos.length).toFixed(1)
    : '5.0';

  const lowStockInsumosCount = insumos.filter((i) => i.stockActual <= i.stockMinimo).length;
  const activeTurnosCount = turnos.filter((t) => t.estado === 'EN_PROCESO' || t.estado === 'PENDIENTE').length;

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
    <div id="app-root-container" className="min-h-screen bg-[#06080a] text-slate-100 flex flex-col font-sans selection:bg-brand-primary selection:text-white relative">
      
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
        <div id="offline-banner" className="bg-red-950/40 backdrop-blur-md border-b border-red-800/60 text-red-200 px-4 py-2 text-center text-xs font-bold flex items-center justify-center gap-2 animate-pulse relative z-50">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span>MODO OFFLINE ACTIVADO: Supabase PostgreSQL se ha desconectado. Operando bajo simulación local.</span>
          <button 
            onClick={() => {
              setDbOnline(true);
              addConsoleLog('🟢 [SYS] Base de datos restablecida. Sincronizando registros locales...');
            }} 
            className="ml-4 bg-red-900/80 hover:bg-red-800 text-white px-2 py-0.5 rounded text-[10px] uppercase transition font-bold"
          >
            Reconectar
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
          {/* DB Emulator Switcher */}
          <button
            id="btn-toggle-db"
            onClick={() => {
              setDbOnline(!dbOnline);
              if (dbOnline) {
                addConsoleLog('🔴 [DB] Conexión caída con Supabase. Activando simulación local.');
              } else {
                addConsoleLog('🟢 [DB] Conexión establecida con Supabase PostgreSQL. Modo Online.');
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition ${
              dbOnline 
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' 
                : 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${dbOnline ? 'bg-emerald-400 animate-ping' : 'bg-red-400'}`} />
            DB: {dbOnline ? 'Supabase Online' : 'Offline Sim'}
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
      <section className="bg-black/45 border-b border-brand-primary/10 backdrop-blur-md px-4 lg:px-8 py-2.5 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 relative z-30">
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
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

        {/* Quick button to register a Client */}
        <button
          id="btn-trigger-add-client-modal"
          onClick={() => setShowAddClientForm(!showAddClientForm)}
          className="flex items-center justify-center gap-1.5 bg-brand-primary/10 hover:bg-brand-primary/20 border border-brand-primary/30 text-brand-primary font-extrabold px-4 py-1.5 rounded-lg text-[10px] uppercase tracking-widest transition-all duration-300 shadow-[0_0_10px_var(--brand-glow)] cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-3 h-3 text-brand-primary" />
          Registrar Cliente
        </button>
      </section>

      {/* Main Workspace Frame */}
      <main className="flex-1 p-4 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
        
        {/* New Client Form Drawer */}
        {showAddClientForm && (
          <div className="glass-panel p-5 rounded-xl space-y-4 animate-fade-in relative z-30 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="flex justify-between items-center pb-2 border-b border-white/[0.08]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-red-500 flex items-center gap-2">
                <Users className="w-3.5 h-3.5" /> Registrar Cliente & Vincular Patente
              </h3>
              <button onClick={() => setShowAddClientForm(false)} className="text-xs text-slate-400 hover:text-white transition">Cerrar</button>
            </div>

            <form onSubmit={handleCreateClient} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
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

        {/* TAB: OVERVIEW */}
        {activeTab === 'overview' && (
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
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider font-mono">Calidad NPS</span>
                  <span className="text-xl font-extrabold font-mono text-amber-400 mt-1 block flex items-baseline gap-1">
                    {npsAvg} <span className="text-xs text-slate-500 font-normal">/ 5.0</span>
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Estrellas promedio de retiro</span>
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

                  const allZero = Object.values(rev).every(v => v === 0);
                  if (allZero) {
                    return { 'Lun': 85000, 'Mar': 112000, 'Mié': 98000, 'Jue': 135000, 'Vie': 195000, 'Sáb': 240000, 'Dom': 45000 };
                  }
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
                  const npsSum = staffTurnos.reduce((sum, t) => sum + (t.npsScore || 5), 0);
                  const rating = completed > 0 ? (npsSum / completed).toFixed(1) : '5.0';
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
                          <span>Proyección en base a tickets emitidos</span>
                          <span>Total Semanal Estimado: <b className="text-emerald-400 font-mono">${Object.values(weeklyRevenue).reduce((a,b)=>a+b,0).toLocaleString('es-AR')} ARS</b></span>
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
              onAddTurno={handleAddTurno}
              onUpdateTurnoEstado={handleUpdateTurnoEstado}
              onDeleteTurno={handleDeleteTurno}
              onAddLog={addConsoleLog}
              onUpdateTurno={(updated) => {
                setTurnos(prev => prev.map(t => t.id === updated.id ? updated : t));
                if (dbOnline && !updated.id.startsWith('t_')) {
                  const url = `/api/turnos/${updated.id}/reprogramar?lavador=${encodeURIComponent(updated.lavadorAsignado)}&fechaHora=${updated.fechaCreacion}`;
                  fetch(url, { method: 'POST' })
                    .then(res => res.json())
                    .then(data => {
                      if (data.status === 'success') {
                        addConsoleLog(`🔄 [REST] Turno #${updated.id} reprogramado en Supabase.`);
                        loadDashboardData();
                      } else {
                        showToast('Error al reprogramar turno.', 'warning');
                      }
                    })
                    .catch(() => showToast('Error de red al reprogramar.', 'warning'));
                }
              }}
            />
          </div>
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
                Arqueo de Caja & POS
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
                Facturación AFIP (A / B)
              </button>
            </div>

            {cajaSubTab === 'pos' ? (
              <CajaDiariaLedger
                role={currentRole}
                insumos={insumos}
                onReplenishInsumo={handleReplenishInsumo}
                transacciones={transacciones}
                onAddTransaccion={handleAddTransaccion}
                cajaAbierta={cajaAbierta}
                montoApertura={montoApertura}
                onOpenCaja={handleOpenCaja}
                onCloseCaja={handleCloseCaja}
                onSellPOS={handleSellPOS}
              />
            ) : (
              <ArgentineFacturacion
                transacciones={transacciones}
                clientes={clientes}
                turnos={turnos}
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
              onAddTurno={handleAddTurno}
              onAddLog={addConsoleLog}
              initialTurnos={turnos}
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
                    Utiliza esta herramienta interactiva para crear flyers digitales diseñados para promocionar servicios de <b>lavado premium, tapicería húmeda, tratamientos cerámicos o pulido de ópticas</b>. Podrás lanzar la campaña dinámicamente o descargar la imagen en formato óptimo.
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

        {/* TAB: ROADMAP / PLAN */}
        {activeTab === 'roadmap' && (
          <div className="space-y-6 animate-fade-in">
            <div className="glass-panel p-5 rounded-xl space-y-2">
              <h3 className="text-base font-bold text-white uppercase tracking-wider font-display">Estructura Operativa & Plan de Negocios</h3>
              <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                Esta sección presenta la estructura completa recomendada para un Lavadero, Centro de Estética vehicular y Detailing profesional. Utiliza los siguientes tableros para planificar el equipamiento inicial y calcular tarifas operativas inteligentes.
              </p>
            </div>

            <PlanRoadmap 
              turnos={turnos}
              empleados={rawDbData?.empleados || []}
              transacciones={transacciones}
              onAddLog={addConsoleLog}
              onAddTransaccion={(tx) => setTransacciones(prev => [...prev, tx])}
              onReloadData={loadDashboardData}
            />
          </div>
        )}

        {/* TAB: INVENTARIO & STOCK */}
        {activeTab === 'inventario' && (
          <div className="space-y-6 animate-fade-in">
            <div className="glass-panel p-5 rounded-xl space-y-2">
              <h3 className="text-base font-bold text-white uppercase tracking-wider font-display">Control de Stock & Compras a Proveedores</h3>
              <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                Administra el inventario de insumos, químicos, paños de microfibra y cerámicos de Albelo Detail. Registrá compras a proveedores de forma directa integradas con el Libro de Caja Diaria.
              </p>
            </div>

            <InventoryManagement
              insumos={insumos}
              onUpdateInsumos={setInsumos}
              onAddLog={addConsoleLog}
              onAddTransaccion={(tx) => setTransacciones(prev => [...prev, tx])}
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
              onAddTurno={handleAddTurno}
              onAddLog={addConsoleLog}
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

      </main>

      {/* Elegant Footer */}
      <footer className="border-t border-white/[0.08] bg-white/[0.01] backdrop-blur-md py-6 px-4 lg:px-8 text-center text-xs text-slate-500 space-y-2 mt-12 relative z-30">
        <p className="font-semibold text-slate-400 font-display uppercase tracking-widest text-[10px]">
          MOBILE <span className="text-[#00d2ff]">WASH</span> CAR WASH • SISTEMA COCKPIT 2026
        </p>
        <p>Software de operación desacoplada. Todos los derechos reservados. Desarrollado con React y Tailwind CSS.</p>
      </footer>

    </div>
  );
}
