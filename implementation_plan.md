# Plan maestro de mejora integral — Lavadero

> La estructura simplificada y el alcance orientado al usuario están definidos en `plan_programa_esencial.md`. Este documento conserva el detalle técnico de implementación.

## Objetivo

Convertir el sistema actual en una plataforma de operación real, segura y verificable para administrar clientes, vehículos, turnos, boxes, caja, inventario, facturación, marketing y el portal público sin datos ficticios ni operaciones silenciosamente simuladas.

## Estado del último checkpoint

- Implementado: alta y reprogramación de turnos con prevención transaccional de superposiciones.
- Implementado: apertura, cobro y cierre de caja con RPC, idempotencia, actor y arqueo auditable.
- Implementado: alta atómica de cliente + vehículo e importación Excel fila por fila sin éxitos ficticios.
- Implementado: WSMTXCA por CAE, reconciliación de timeouts inciertos, persistencia fiscal, QR v1 y PDF Factura C.
- Implementado: fotos reales de recepción desde cámara/archivo; se retiraron las imágenes simuladas.
- Verificado: TypeScript, build de producción, 45 pruebas API/fiscales y auditoría npm sin vulnerabilidades.
- Configurado en Vercel: Supabase público, CORS y secreto de sesión; el conector ARCA permanece deshabilitado.
- Pendiente del propietario: `SUPABASE_SERVICE_ROLE_KEY`, aplicación de las tres migraciones y credenciales/homologación ARCA.

- Implementado: estructura esencial por roles con **Hoy, Turnos, Caja, Clientes y Más** como máximo de navegación.
- Implementado: vista diaria sin analítica ni consola técnica en primer plano, CRM buscable y centro administrativo separado.
- Implementado: cobro de turnos terminados con medio de pago, idempotencia estable y prevención de cobro duplicado.
- Retirado: Roadmap de la aplicación de producción y terminología técnica del circuito principal.
- Verificado: diseño de acceso a 360 px sin desbordamiento, TypeScript, build y 27 pruebas de seguridad/API en verde.
- Publicado: sesiones firmadas, RBAC de API, cabeceras de seguridad, trazabilidad y eliminación de éxitos simulados.
- Publicado: validación estricta de credenciales, defensa contra inyección PostgREST, límite de intentos y límite de payload.
- Publicado: estado inicial sin datos ficticios y bloqueo de emisiones fiscales ARCA simuladas.
- Implementado: máquina de estados de turnos sin efectos financieros ocultos.
- Implementado: altas de turnos esperan confirmación real de Supabase y sólo muestran el ID persistido.
- Implementado: reserva de tienda y agenda cerámica vinculadas al catálogo sincronizado, con errores visibles y horarios locales sin corrimiento UTC.
- Corregido: promociones y tratamientos muestran importes estimados; ya no prometen precio congelado ni WhatsApp automatizado inexistente.
- Corregido: WhatsApp manual ya no se registra como enviado; el panel distingue conversación abierta de entrega confirmada.
- Corregido: flyers y fidelización sólo preparan/exportan material verificable; no declaran publicaciones, cupones ni canjes inexistentes.
- Bloqueado de forma segura: los puntos son estimaciones y las solicitudes de premio no modifican saldos hasta contar con un libro transaccional en Supabase.
- Implementado: contrato de inventario idempotente y auditable; las entradas pagadas actualizan stock y caja dentro de una única RPC.
- Corregido: retirados movimientos, deudas de proveedores y compras precargadas que sólo vivían en React; los PDF se identifican como borradores.
- Pendiente de propietario Supabase: aplicar la RPC `registrar_movimiento_inventario` y configurar `SUPABASE_SERVICE_ROLE_KEY` para habilitar mutaciones reales.
- Preparado: `database/migrations/20260717_transactional_pos.sql` para ventas POS y movimientos de caja atómicos e idempotentes.
- Pendiente de propietario Supabase: aplicar la migración, configurar `SUPABASE_SERVICE_ROLE_KEY`, cerrar RLS y migrar usuarios a Supabase Auth.
- Regla temporal: POS y movimientos manuales se rechazan de forma segura mientras la migración transaccional no esté instalada.

## Principios obligatorios

1. **Una sola arquitectura productiva:** React + FastAPI + Supabase. El backend Java queda fuera del flujo productivo hasta decidir si se elimina o se convierte en un servicio independiente con una necesidad concreta.
2. **Sin simulaciones en producción:** un error debe mostrarse como error recuperable; nunca devolver `success` con datos inventados.
3. **Seguridad por defecto:** autenticación real, autorización en servidor, RLS en Supabase, secretos sólo en Vercel y auditoría de acciones sensibles.
4. **Operaciones atómicas:** caja, ventas, stock, turnos y facturación se guardan mediante transacciones o funciones RPC idempotentes.
5. **Datos confiables:** importes con precisión decimal, fechas en UTC, zona visible `America/Buenos_Aires`, validación de patentes/teléfonos y restricciones en base de datos.
6. **Cada fase termina con pruebas y despliegue controlado.**

---

## Fase 1 — Seguridad, autenticación y permisos

### Trabajo

- Migrar el acceso desde la tabla `usuarios` con contraseñas de texto plano a Supabase Auth.
- Crear perfiles internos vinculados a `auth.users`: `SUPERADMIN`, `ADMIN`, `CAJERO`, `OPERARIO` y `LAVADOR`.
- Activar RLS en todas las tablas y definir políticas por rol y operación.
- Revocar completamente el acceso `anon` a `usuarios`, caja, movimientos, ventas, stock y datos internos.
- Mantener la `service_role` únicamente en Vercel; nunca enviarla al navegador ni guardarla en Git.
- Validar la sesión en FastAPI y aplicar autorización en cada endpoint.
- Agregar rate limiting al login y a reservas públicas.
- Crear `audit_logs` para registrar usuario, acción, entidad, fecha, resultado y metadatos no sensibles.
- Rotar contraseñas que estuvieron versionadas y retirar definitivamente usuarios predeterminados.
- Aplicar cabeceras de seguridad, límites de payload y validación estricta de CORS.

### Criterios de aceptación

- Una petición anónima no puede leer ni modificar información interna.
- Un operario no puede abrir/cerrar caja, editar precios ni administrar usuarios.
- Toda acción financiera registra autor y fecha.
- No quedan secretos o contraseñas reales en archivos ni historial activo de despliegue.

### Dependencias externas

- Acceso de propietario al proyecto Supabase.
- Configuración de `SUPABASE_SERVICE_ROLE_KEY` directamente en Vercel.
- Rotación de credenciales existentes.

---

## Fase 2 — Arquitectura, API y modelo de datos

### Trabajo

- Dividir el monolito `main.py` en routers, servicios, repositorios, esquemas y configuración.
- Centralizar las llamadas del frontend en un cliente API tipado.
- Definir respuestas uniformes: `data`, `error`, `request_id` y códigos HTTP correctos.
- Eliminar endpoints que modifican datos mediante query strings; usar cuerpos JSON validados.
- Incorporar migraciones versionadas y un esquema reproducible sin datos personales semilla.
- Agregar restricciones únicas e índices para patentes, turnos, caja activa, comprobantes y movimientos.
- Usar `numeric(14,2)` o centavos enteros para importes; eliminar cálculos financieros con `float`.
- Normalizar estados y transiciones de turnos en una máquina de estados del servidor.
- Incorporar idempotency keys para ventas, movimientos y facturas.
- Resolver definitivamente la carpeta Java: archivarla o eliminarla si no tiene consumidores reales.

### Criterios de aceptación

- OpenAPI describe todos los endpoints productivos.
- No existen escrituras directas desde componentes React a URLs construidas manualmente.
- Una misma operación repetida no duplica ventas, stock, caja ni comprobantes.
- La base puede reconstruirse mediante migraciones en un entorno vacío.

---

## Fase 3 — Flujo operativo completo

### Flujo objetivo

`Cliente → Vehículo → Presupuesto/servicio → Turno → Recepción → Inspección → Box → Trabajo → Control de calidad → Cobro → Entrega`

### Trabajo

- CRM con búsqueda, deduplicación, historial y múltiples vehículos por cliente.
- Agenda con duración real, capacidad por box, disponibilidad de empleados y prevención de solapamientos.
- Kanban con transiciones autorizadas, responsables, tiempos y registro histórico.
- Asignación de boxes persistente en base de datos, no en `localStorage`.
- Inspección de daños con fotos reales almacenadas en Supabase Storage, consentimiento y firma.
- Presupuestos versionados con adicionales, descuentos autorizados y vigencia.
- Checklists por tipo de servicio y control de calidad antes de marcar “completado”.
- Entrega con conformidad, reseña y mensaje al cliente.

### Criterios de aceptación

- No pueden existir dos turnos incompatibles para el mismo box o empleado.
- Cada cambio de estado conserva autor, fecha y estado anterior.
- Un vehículo puede consultarse con todo su historial operativo y comercial.
- Las fotos tienen permisos privados y URLs temporales.

---

## Fase 4 — Caja, POS e inventario

### Trabajo

- Apertura y cierre de caja por usuario y sucursal.
- Arqueo esperado vs. declarado con diferencia y observaciones obligatorias.
- Métodos de pago separados: efectivo, transferencia, débito, crédito y combinado.
- Ventas, anulaciones, devoluciones y descuentos con autorización.
- Movimientos inmutables; las correcciones se realizan mediante contramovimientos.
- Descuento de stock transaccional por receta de servicio y por venta POS.
- Compras, proveedores, costos, lotes y alertas configurables.
- Reportes diarios exportables y conciliación por método de pago.

### Criterios de aceptación

- Venta, movimiento de caja y descuento de stock confirman juntos o fallan juntos.
- No se permite stock negativo salvo permiso explícito y auditado.
- La caja cerrada no acepta nuevos movimientos.
- El reporte diario coincide con las operaciones persistidas.

---

## Fase 5 — Facturación electrónica ARCA

### Trabajo

- Reemplazar por completo la simulación AFIP/ARCA.
- Integrar WSAA y WSMTXCA con certificados protegidos en el servidor.
- Administrar punto de venta, tipo de comprobante, numeración y condición fiscal.
- Solicitar CAE o CAEA, guardar respuesta completa y manejar rechazos.
- Generar QR fiscal versión 1, PDF y representación imprimible válidos.
- Implementar notas de crédito/débito y reintentos idempotentes.
- Separar homologación y producción mediante configuración segura.

### Criterios de aceptación

- Ningún comprobante se marca autorizado sin respuesta válida de ARCA.
- Numeración y CAE son persistentes, correlativos y auditables.
- El QR puede verificarse con el validador correspondiente.
- Existen pruebas de homologación para casos aceptados y rechazados.

### Dependencias externas

- CUIT, certificado y clave privada de homologación/producción.
- Punto de venta habilitado y definición de tipos de comprobante utilizados.

---

## Fase 6 — Portal público, comunicación y fidelización

### Trabajo

- Portal público independiente del panel administrativo.
- Catálogo y precios publicados desde base de datos.
- Disponibilidad real y reserva con confirmación, reCAPTCHA/Turnstile y rate limiting.
- Reprogramación/cancelación mediante enlace firmado y vencimiento.
- Consentimiento de comunicaciones y políticas de privacidad.
- Integración oficial con WhatsApp Business o proveedor aprobado; retirar automatización por teclado.
- Plantillas para confirmación, recordatorio, vehículo listo y encuesta.
- Cupones con reglas, vencimiento, límites, trazabilidad y prevención de reutilización.
- Segmentación y campañas usando datos reales; eliminar fallbacks ficticios.

### Criterios de aceptación

- Una reserva pública aparece una sola vez en el tablero y respeta capacidad.
- Cada mensaje tiene estado de entrega y consentimiento asociado.
- Los cupones no pueden usarse fuera de sus reglas.

### Dependencias externas

- Cuenta/proveedor de WhatsApp Business y plantillas aprobadas.
- Textos legales, horarios, ubicación, teléfono y reglas comerciales definitivas.

---

## Fase 7 — Experiencia, calidad y lanzamiento

### UX y accesibilidad

- Rediseñar navegación de escritorio y móvil por tareas frecuentes.
- Incorporar búsqueda global, comandos rápidos y estados vacíos útiles.
- Formularios con validación inline, prevención de doble envío y mensajes accionables.
- Accesibilidad WCAG 2.2 AA: teclado, foco, contraste, etiquetas y lectores de pantalla.
- Diseño consistente mediante componentes compartidos y tokens visuales.

### Calidad técnica

- Pruebas unitarias para reglas de negocio y cálculos financieros.
- Pruebas de integración API + Supabase en entorno separado.
- Pruebas E2E para login, alta, turno, caja, venta, stock, factura y reserva pública.
- CI obligatoria con TypeScript, lint, tests, build, escaneo de secretos y migraciones.
- Monitoreo de errores, métricas, logs estructurados y alertas.
- Backups, restauración ensayada, retención y procedimiento de incidentes.
- Preview por cambio, despliegue progresivo y rollback documentado.

### Criterios de aceptación final

- Cero errores críticos/altos abiertos.
- Flujos esenciales E2E en verde.
- Restauración de backup probada.
- Operación móvil validada en dispositivos reales.
- Manual breve de caja, turnos, inventario, facturación y administración.

---

## Orden de ejecución recomendado

| Etapa | Alcance | Resultado utilizable |
|---|---|---|
| 1 | Seguridad + Auth + RLS | Acceso interno protegido |
| 2 | API + esquema + migraciones | Base técnica confiable |
| 3 | CRM + turnos + boxes + inspección | Operación del taller completa |
| 4 | Caja + POS + stock | Circuito financiero trazable |
| 5 | ARCA | Facturación fiscal real |
| 6 | Portal + WhatsApp + fidelización | Canal comercial automatizado |
| 7 | UX + pruebas + observabilidad | Lanzamiento estable y mantenible |

## Definición de “completo”

El programa se considera completo cuando todos los flujos críticos trabajan con datos reales, permisos de servidor, trazabilidad y pruebas; no existen credenciales embebidas, respuestas simuladas en producción ni operaciones financieras/fiscales sin confirmación persistida.
