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
import PlanRoadmap from './components/PlanRoadmap';
import CajaDiariaLedger from './components/CajaDiariaLedger';
import TurnosKanbanView from './components/TurnosKanbanView';
import ArgentineFacturacion from './components/ArgentineFacturacion';
import PublicPage from './components/PublicPage';
import WhatsAppIntegration from './components/WhatsAppIntegration';
import CeramicServices from './components/CeramicServices';
import BrandSettings from './components/BrandSettings';
import Login from './components/Login';

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'overview' | 'turnos' | 'caja' | 'publicidad' | 'roadmap' | 'public-page' | 'whatsapp' | 'ceramic' | 'branding'>('overview');
  const [cajaSubTab, setCajaSubTab] = useState<'pos' | 'facturacion'>('pos');

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
      selectedIcon: 'Car',
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
              visitas: (data.turnos || []).filter((t: any) => t.cliente_id === c.id && t.estado === 'COMPLETADO').length || 0,
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
      const servicioObj = rawDbData.servicios?.find((s: any) => s.nombre === newT.servicioNombre);
      const empleadoObj = rawDbData.empleados?.find((e: any) => e.nombre === newT.lavadorAsignado);

      if (clienteObj && vehiculoObj && servicioObj) {
        let url = `/api/turnos/agendar?clienteId=${clienteObj.id}&vehiculoId=${vehiculoObj.id}&servicioId=${servicioObj.id}&fechaHora=${newT.fechaCreacion.replace('T', ' ').slice(0, 19)}`;
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
        return;
      }
    }

    setTurnos((prev) => [...prev, newT]);
    showToast(`Turno agendado para ${newT.clienteNombre}`, 'success');
  };

  const handleUpdateTurnoEstado = (
    id: string, 
    nuevoEstado: 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADO',
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
            
            setInsumos((prevI) => 
              prevI.map((ins) => {
                if (t.tipo === 'LAVADO' && (ins.id === 'i1' || ins.id === 'i2')) {
                  const newStock = Math.max(0, ins.stockActual - 1);
                  if (newStock === 0) {
                    addConsoleLog(`⚠️ [ALERTA INVENTARIO] El insumo ${ins.nombre} se ha quedado sin stock.`);
                  } else if (newStock <= ins.stockMinimo) {
                    addConsoleLog(`⚠️ [BAJO STOCK] El insumo ${ins.nombre} se encuentra bajo el límite mínimo.`);
                  }
                  return { ...ins, stockActual: newStock };
                }
                if (t.tipo === 'TAPICERIA' && ins.id === 'i4') {
                  const newStock = Math.max(0, ins.stockActual - 1);
                  return { ...ins, stockActual: newStock };
                }
                if (t.tipo === 'ESTETICA' && (ins.id === 'i5' || ins.id === 'i7')) {
                  const newStock = Math.max(0, ins.stockActual - 1);
                  return { ...ins, stockActual: newStock };
                }
                return ins;
              })
            );
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

  const completedTurnos = turnos.filter((t) => t.estado === 'COMPLETADO');
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
      <section className="bg-white/[0.01] border-b border-white/[0.06] backdrop-blur-md px-4 lg:px-8 py-2.5 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 relative z-30">
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-thin">
          <button
            id="btn-nav-overview"
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition shrink-0 ${
              activeTab === 'overview'
                ? 'bg-white/[0.05] text-brand-primary border border-brand-primary/30 shadow-[0_0_15px_var(--brand-glow)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
            }`}
          >
            Dashboard
          </button>
          <button
            id="btn-nav-turnos"
            onClick={() => setActiveTab('turnos')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition shrink-0 ${
              activeTab === 'turnos'
                ? 'bg-white/[0.05] text-brand-primary border border-brand-primary/30 shadow-[0_0_15px_var(--brand-glow)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
            }`}
          >
            Turnos & Kanban
          </button>
          <button
            id="btn-nav-caja"
            onClick={() => setActiveTab('caja')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition shrink-0 ${
              activeTab === 'caja'
                ? 'bg-white/[0.05] text-brand-primary border border-brand-primary/30 shadow-[0_0_15px_var(--brand-glow)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
            }`}
          >
            Caja & POS
          </button>
          <button
            id="btn-nav-publicidad"
            onClick={() => setActiveTab('publicidad')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition shrink-0 ${
              activeTab === 'publicidad'
                ? 'bg-white/[0.05] text-brand-primary border border-brand-primary/30 shadow-[0_0_15px_var(--brand-glow)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
            }`}
          >
            Publicidad & Marketing
          </button>
          <button
            id="btn-nav-roadmap"
            onClick={() => setActiveTab('roadmap')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition shrink-0 ${
              activeTab === 'roadmap'
                ? 'bg-white/[0.05] text-brand-primary border border-brand-primary/30 shadow-[0_0_15px_var(--brand-glow)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
            }`}
          >
            Plan & Estructura
          </button>
          <button
            id="btn-nav-public-page"
            onClick={() => setActiveTab('public-page')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition shrink-0 flex items-center gap-1.5 ${
              activeTab === 'public-page'
                ? 'bg-white/[0.05] text-brand-primary border border-brand-primary/30 shadow-[0_0_15px_var(--brand-glow)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-brand-primary" />
            Portal Público & Tienda
          </button>
          <button
            id="btn-nav-whatsapp"
            onClick={() => setActiveTab('whatsapp')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition shrink-0 flex items-center gap-1.5 ${
              activeTab === 'whatsapp'
                ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/30 shadow-[0_0_15px_var(--brand-glow)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-brand-primary" />
            WhatsApp & API Gateway
          </button>
          <button
            id="btn-nav-ceramic"
            onClick={() => setActiveTab('ceramic')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition shrink-0 flex items-center gap-1.5 ${
              activeTab === 'ceramic'
                ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/30 shadow-[0_0_15px_var(--brand-glow)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-primary" />
            Estética & Cerámicos
          </button>
          <button
            id="btn-nav-branding"
            onClick={() => setActiveTab('branding')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition shrink-0 flex items-center gap-1.5 ${
              activeTab === 'branding'
                ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/30 shadow-[0_0_15px_var(--brand-glow)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-brand-primary" />
            Identidad de Marca
          </button>
        </div>

        {/* Quick button to register a Client */}
        <button
          id="btn-trigger-add-client-modal"
          onClick={() => setShowAddClientForm(!showAddClientForm)}
          className="flex items-center justify-center gap-1.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] hover:border-brand-primary/30 text-slate-200 font-semibold px-4 py-1.5 rounded-lg text-xs transition-all shadow-sm cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-brand-primary" />
          Registrar Patente/Cliente
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
              
              <div className="glass-panel glass-card-hover p-4 rounded-xl flex justify-between items-start">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Caja Diaria</span>
                  <span className="text-xl font-extrabold font-mono text-emerald-400 mt-1 block">${totalIncomingsToday.toLocaleString('es-AR')}</span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Ingresos acumulados hoy</span>
                </div>
                <span className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <DollarSign className="w-5 h-5" />
                </span>
              </div>

              <div className="glass-panel glass-card-hover p-4 rounded-xl flex justify-between items-start">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Turnos en Espera</span>
                  <span className="text-xl font-extrabold font-mono text-[#00d2ff] mt-1 block">{activeTurnosCount}</span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Pendientes y en proceso</span>
                </div>
                <span className="p-2.5 rounded-lg bg-[#00d2ff]/10 border border-[#00d2ff]/20 text-[#00d2ff]">
                  <Car className="w-5 h-5" />
                </span>
              </div>

              <div className="glass-panel glass-card-hover p-4 rounded-xl flex justify-between items-start">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Calidad NPS</span>
                  <span className="text-xl font-extrabold font-mono text-amber-400 mt-1 block flex items-baseline gap-1">
                    {npsAvg} <span className="text-xs text-slate-500 font-normal">/ 5.0</span>
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Estrellas promedio de retiro</span>
                </div>
                <span className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Star className="w-5 h-5 fill-amber-500/10 text-amber-400" />
                </span>
              </div>

              <div className="glass-panel glass-card-hover p-4 rounded-xl flex justify-between items-start">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Alertas de Stock</span>
                  <span className={`text-xl font-extrabold font-mono mt-1 block ${lowStockInsumosCount > 0 ? 'text-red-400' : 'text-slate-300'}`}>
                    {lowStockInsumosCount}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Insumos críticos bajo mínimo</span>
                </div>
                <span className={`p-2.5 rounded-lg border ${lowStockInsumosCount > 0 ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-white/[0.02] border-white/[0.08] text-slate-400'}`}>
                  <Package className="w-5 h-5" />
                </span>
              </div>

            </div>

            {/* Middle row: Dashboard Charts and Registered Patents list */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Dynamic SVG / Styled HTML Bar Chart (Tendencia de Ingresos) */}
              <div className="lg:col-span-8 glass-panel p-5 rounded-xl space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider font-display">Tendencia Operativa Diaria</h3>
                    <span className="text-[10px] text-slate-400">Popularidad de Servicios y Flujos de Dinero</span>
                  </div>
                  <div className="flex gap-1 bg-white/[0.04] p-0.5 rounded border border-white/[0.08] text-[9px] font-bold uppercase tracking-widest text-slate-400">
                    <span className="px-1.5 py-0.5 bg-white/[0.05] rounded text-[#00d2ff]">Filtro: Hoy</span>
                  </div>
                </div>

                {/* SVG Revenue curve simulation */}
                <div className="h-[180px] bg-black/30 rounded-xl border border-white/[0.08] flex flex-col justify-between p-4 relative overflow-hidden">
                  <div className="absolute inset-0 flex flex-col justify-between py-5 px-8 opacity-5">
                    <div className="border-b border-white w-full" />
                    <div className="border-b border-white w-full" />
                    <div className="border-b border-white w-full" />
                  </div>
                  
                  {/* Dynamic Curve */}
                  <div className="flex-1 flex items-end justify-between px-4 pb-2 gap-3.5 z-10">
                    {/* Bar Lavado */}
                    <div className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                      <div className="w-full bg-gradient-to-t from-[#00d2ff]/80 to-[#00d2ff]/20 hover:from-[#00d2ff] hover:to-[#00d2ff]/40 rounded-t-lg transition-all duration-300 relative border border-[#00d2ff]/20" style={{ height: '75%' }}>
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#06080a]/90 text-[10px] font-bold py-0.5 px-2 rounded border border-[#00d2ff]/20 text-[#00d2ff] opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                          $120k ARS
                        </div>
                      </div>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Lavados</span>
                    </div>

                    {/* Bar Tapiceria */}
                    <div className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                      <div className="w-full bg-gradient-to-t from-[#9d50bb]/80 to-[#9d50bb]/20 hover:from-[#9d50bb] hover:to-[#9d50bb]/40 rounded-t-lg transition-all duration-300 relative border border-[#9d50bb]/20" style={{ height: '45%' }}>
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#06080a]/90 text-[10px] font-bold py-0.5 px-2 rounded border border-[#9d50bb]/20 text-purple-400 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                          $75k ARS
                        </div>
                      </div>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Tapicería</span>
                    </div>

                    {/* Bar Estetica */}
                    <div className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                      <div className="w-full bg-gradient-to-t from-amber-500/80 to-amber-500/20 hover:from-amber-400 hover:to-amber-500/40 rounded-t-lg transition-all duration-300 relative border border-amber-500/20" style={{ height: '90%' }}>
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#06080a]/90 text-[10px] font-bold py-0.5 px-2 rounded border border-amber-500/20 text-amber-400 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                          $165k ARS
                        </div>
                      </div>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Estética</span>
                    </div>
                  </div>

                  <div className="border-t border-white/[0.08] pt-2 flex justify-between items-center text-[10px] text-slate-400">
                    <span>Estructura de Ventas del Turno</span>
                    <span>Total Teórico Acumulado: <b className="text-slate-200">$360,000 ARS</b></span>
                  </div>
                </div>
              </div>

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
                    ? 'bg-[#00d2ff]/20 text-[#00d2ff] border border-[#00d2ff]/30 shadow-[0_0_15px_rgba(0,210,255,0.1)]'
                    : 'text-slate-400 hover:text-slate-200 bg-white/[0.01] border border-white/[0.06]'
                }`}
              >
                Arqueo de Caja & POS
              </button>
              <button
                onClick={() => setCajaSubTab('facturacion')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 uppercase tracking-wider cursor-pointer ${
                  cajaSubTab === 'facturacion'
                    ? 'bg-[#00d2ff]/20 text-[#00d2ff] border border-[#00d2ff]/30 shadow-[0_0_15px_rgba(0,210,255,0.1)]'
                    : 'text-slate-400 hover:text-slate-200 bg-white/[0.01] border border-white/[0.06]'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-[#00d2ff]" />
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
            <div className="glass-panel p-5 rounded-xl space-y-2">
              <h3 className="text-base font-bold text-white uppercase tracking-wider font-display">Diseñador de Publicidades y Promociones</h3>
              <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                Utiliza esta herramienta interactiva para crear flyers digitales diseñados para promocionar servicios de <b>lavado premium, tapicería húmeda, tratamientos cerámicos o pulido de ópticas</b>. Podrás lanzar la campaña dinámicamente o descargar la imagen en formato óptimo.
              </p>
            </div>

            <PromoPosterCreator onAddPromotionToConsole={addConsoleLog} />
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

            <PlanRoadmap />
          </div>
        )}

        {/* TAB: WHATSAPP & API GATEWAY */}
        {activeTab === 'whatsapp' && (
          <div className="space-y-6 animate-fade-in">
            <div className="glass-panel p-5 rounded-xl space-y-2">
              <h3 className="text-base font-bold text-white uppercase tracking-wider font-display">Consola de Automatización & Gateway de WhatsApp</h3>
              <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                Controla las notificaciones automáticas que se envían a tus clientes. Este módulo interactivo permite definir las plantillas de mensaje para confirmación de turnos o avisos de vehículos listos, simular peticiones POST de tu microservicio Python y testear la entrega en un simulador de teléfono celular.
              </p>
            </div>

            <WhatsAppIntegration
              turnos={turnos}
              clientes={clientes}
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
