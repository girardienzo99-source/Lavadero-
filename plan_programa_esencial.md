# Plan de simplificación — Lavadero esencial

## Objetivo del producto

Convertir Lavadero en una herramienta diaria simple, rápida y confiable. Una persona nueva debe poder aprender el circuito principal en menos de 10 minutos y completar las tareas habituales sin conocer términos técnicos.

## Estado de implementación — 18 de julio de 2026

- Implementado el menú principal reducido y adaptado por rol.
- Implementada la pantalla **Hoy** con turnos, trabajos en proceso, entregas, caja y stock.
- Implementada la sección **Clientes** con búsqueda por nombre, teléfono, patente o vehículo e historial de turnos.
- Implementado **Más** como centro de herramientas administrativas; Roadmap fue retirado del producto.
- Unificadas las vistas **Agenda** y **Estado del trabajo** dentro de Turnos.
- Implementado el cobro de trabajos terminados desde Caja con medio de pago, clave idempotente y bloqueo de duplicados.
- Simplificado el lenguaje de ingreso, navegación, turnos y pie de página.
- Validado el acceso en 360 px sin desbordamiento horizontal.
- Validaciones superadas: TypeScript, build de producción y 27 pruebas de seguridad/API.
- Pendiente externo: credenciales de propietario de Supabase, migración transaccional, RLS/Auth y credenciales fiscales ARCA.

Principios de producto:

- Como máximo 5 opciones en el menú principal.
- Una sola ruta para cada tarea frecuente.
- Las acciones habituales deben requerir 3 pasos o menos.
- El personal solo ve las funciones que necesita según su rol.
- Las herramientas administrativas y promocionales no interrumpen el trabajo diario.
- Cada operación confirma claramente si fue guardada o si falló.

## Estructura principal propuesta

### 1. Hoy

Es la pantalla de trabajo diario. Debe mostrar únicamente:

- Estado de la caja: cerrada, abierta o pendiente de cierre.
- Próximos turnos.
- Vehículos en proceso.
- Vehículos listos para entregar.
- Alertas importantes: faltantes de stock, cobros pendientes o errores de sincronización.
- Acciones principales: **Nuevo turno**, **Cobrar** y **Buscar cliente**.

Los gráficos, métricas históricas y herramientas técnicas no deben ocupar el primer plano.

### 2. Turnos

Reunirá la agenda semanal y el tablero de trabajo en una sola pantalla, con dos vistas: **Agenda** y **Estado del trabajo**.

Estados simples: **Pendiente**, **En proceso**, **Listo** y **Entregado**.

El alta de un turno debe solicitar solo cliente y teléfono, vehículo y patente, servicio, fecha y hora, responsable y precio estimado.

Los tratamientos cerámicos serán tipos de servicio dentro de Turnos. Su calculadora o configuración avanzada quedará como herramienta opcional, no como sección principal.

### 3. Caja

Debe concentrar todo lo relacionado con dinero:

- Abrir y cerrar caja.
- Cobrar un turno terminado.
- Venta rápida de productos o servicios.
- Registrar ingresos y egresos.
- Consultar movimientos.
- Ver totales por medio de pago.
- Emitir comprobante o factura después del cobro, cuando la integración fiscal esté disponible.

La facturación no será otra aplicación separada: será un paso del cobro.

### 4. Clientes

Debe permitir buscar por nombre, teléfono o patente. Cada ficha reunirá datos de contacto, vehículos, próximos turnos, historial de servicios, pagos y notas.

Cliente y vehículo deben poder crearse juntos sin abandonar el alta de un turno.

### 5. Más

Agrupará las funciones ocasionales o administrativas:

- Inventario.
- Facturación y configuración fiscal.
- Marketing, fidelización y WhatsApp.
- Portal público.
- Configuración de marca y negocio.
- Auditoría y registros técnicos.

La hoja de ruta del desarrollo no debe aparecer dentro del programa de producción.

## Correspondencia con la aplicación actual

| Sección actual | Destino propuesto |
| --- | --- |
| Cockpit / Overview | Hoy |
| Turnos, agenda y Kanban | Turnos |
| Cerámicos | Tipo de servicio en Turnos; configuración en Más |
| Caja y punto de venta | Caja |
| Facturación | Paso posterior al cobro en Caja |
| CRM e historial | Clientes |
| Inventario | Más > Inventario |
| Publicidad, fidelización y WhatsApp | Más > Marketing |
| Página pública | Más > Portal público |
| Branding | Más > Configuración |
| Roadmap | Fuera de la aplicación de producción |

## Circuito esencial del negocio

El diseño y las prioridades deben seguir este único recorrido:

1. Buscar o crear cliente y vehículo.
2. Crear el turno.
3. Recibir el vehículo.
4. Iniciar y completar el trabajo.
5. Cobrar.
6. Facturar, si corresponde.
7. Entregar el vehículo.

No debe existir más de una pantalla o botón principal para iniciar cada paso.

## Vistas según el rol

### Operario

- Hoy.
- Turnos.
- Datos del vehículo e instrucciones del trabajo.

### Cajero

- Hoy.
- Caja.
- Clientes.
- Consulta de turnos.

### Administrador

- Todas las secciones.
- Configuración, reportes, inventario, marketing y auditoría.

Las secciones sin permiso deben ocultarse, no mostrarse deshabilitadas.

## Alcance funcional

### Esencial ahora

- Inicio de sesión y sesión persistente.
- Resumen de Hoy.
- Clientes y vehículos.
- Agenda y turnos.
- Cambio de estado del trabajo.
- Apertura, cobro y cierre de caja.
- Alertas básicas de inventario.
- Facturación únicamente cuando ARCA y la seguridad estén correctamente configuradas.

### Segunda prioridad

- Compras y proveedores.
- Cuenta corriente.
- Reportes operativos.
- Historial y ajustes avanzados de inventario.

### Opcional o posterior

- Generador de flyers.
- Campañas de fidelización.
- Automatizaciones de WhatsApp.
- Portal público avanzado.
- Personalización visual extensa.
- Simuladores o calculadoras especializadas.

## Reglas de interfaz

- Una acción principal visible por bloque o pantalla.
- Lenguaje cotidiano: “Hoy”, “Turnos”, “En proceso” y “Cobrar”.
- Evitar nombres como Cockpit, Growth, Kanban, REST o términos internos de desarrollo.
- Errores junto al campo o acción afectada; no usar ventanas técnicas ni mensajes ambiguos.
- Estados consistentes de carga, guardado, éxito y error.
- Botones y formularios cómodos en celular desde 360 px de ancho.
- Pedir confirmación antes de cerrar caja, eliminar o anular operaciones.
- Los registros técnicos deben estar en Auditoría, nunca en la pantalla diaria.

## Etapas de ejecución

### Etapa 1 — Simplificar la navegación

- Cambiar el menú principal a Hoy, Turnos, Caja, Clientes y Más.
- Retirar Roadmap del producto.
- Mover herramientas promocionales y de configuración a Más.
- Integrar Cerámicos como categoría de servicio.

**Resultado:** el usuario entiende la estructura sin capacitación.

### Etapa 2 — Unificar el circuito principal

- Crear un flujo único cliente → vehículo → turno.
- Unificar Agenda y Estado del trabajo.
- Conectar turno terminado con Cobrar.
- Ofrecer factura como paso posterior al cobro.

**Resultado:** no hay carga duplicada ni caminos paralelos.

### Etapa 3 — Adaptar por roles

- Definir permisos de administrador, cajero y operario.
- Ocultar secciones no autorizadas.
- Ajustar la pantalla Hoy para cada rol.

**Resultado:** cada persona ve solo lo necesario para trabajar.

### Etapa 4 — Mejorar claridad y uso móvil

- Reescribir títulos, ayudas y mensajes en lenguaje simple.
- Normalizar formularios, botones y confirmaciones.
- Revisar cada pantalla en celular y escritorio.

**Resultado:** las tareas principales son rápidas y comprensibles en cualquier dispositivo.

### Etapa 5 — Asegurar funcionamiento

- Completar autenticación, permisos RLS y manejo seguro de credenciales.
- Aplicar migraciones pendientes del backend.
- Probar automáticamente el circuito completo.
- Registrar errores sin exponer detalles técnicos al usuario.

**Resultado:** el programa confirma correctamente cada operación y protege la información.

## Criterios de aceptación

La simplificación se considerará completa cuando:

- Existan como máximo 5 opciones principales.
- Un turno nuevo pueda registrarse en 3 pasos o menos.
- Un turno terminado pueda cobrarse en 2 pasos o menos.
- Un cliente pueda encontrarse por nombre, teléfono o patente en menos de 10 segundos.
- Operarios y cajeros no vean Roadmap, Branding ni herramientas de marketing.
- Cada tarea frecuente tenga un único punto de entrada.
- Ninguna operación se muestre como exitosa sin confirmación del servidor.
- El circuito cliente → turno → trabajo → cobro → entrega funcione en celular y escritorio.
- Un administrador, un cajero y un operario puedan completar sus tareas principales sin instrucciones externas.

## Relación con el plan técnico

Este documento define qué debe ver y usar el negocio. El archivo `implementation_plan.md` conserva el detalle técnico de seguridad, base de datos, API, integraciones, pruebas y despliegue necesario para implementar esta estructura.
