# Plan de implementación — confort visual, Excel, ticket y factura C

## Objetivo

Preparar Lavadero para jornadas prolongadas de trabajo, intercambio habitual con Excel y un circuito documental claro que separe el ticket interno de la factura electrónica C autorizada por ARCA.

## 1. Confort visual

- Aclarar el fondo general desde negro azulado a una gama pizarra suave.
- Elevar ligeramente la luminosidad de tarjetas, formularios y barras de navegación.
- Reducir brillos, sombras fuertes, cuadrículas y animaciones repetitivas.
- Mantener contraste WCAG para textos y controles.
- Conservar el color de marca únicamente para acciones principales y estados importantes.
- Usar tamaños mínimos cómodos, foco visible y superficies consistentes.

### Criterios

- Sin texto gris de bajo contraste sobre fondo oscuro.
- Sin paneles negros puros en el circuito diario.
- Lectura cómoda durante una jornada prolongada.
- Sin desbordamiento horizontal desde 360 px.

## 2. Integración con Excel

Agregar **Más > Excel** con dos operaciones:

### Exportación

Generar un libro `.xlsx` con hojas separadas:

- Resumen.
- Clientes.
- Turnos.
- Caja.
- Inventario.

El archivo debe incluir filtros, encabezados congelados, formatos reales de fecha y moneda, anchos legibles y datos listos para continuar trabajando en Excel.

### Importación

Aceptar `.xlsx` para importar clientes y vehículos mediante una plantilla controlada con las columnas:

- Nombre.
- Teléfono.
- Patente.
- Modelo.

El programa debe mostrar una vista previa, validar campos, detectar duplicados por patente y confirmar el resultado fila por fila. No se informará éxito para filas que no hayan sido persistidas.

## 3. Ticket interno no fiscal

- Formato térmico de 80 mm, corto y legible.
- Nombre del negocio, fecha, número interno, cliente, vehículo, detalle, medio de pago y total.
- Leyenda visible: **TICKET INTERNO — NO VÁLIDO COMO FACTURA**.
- Sin IVA discriminado, CAE, QR fiscal ni leyendas de autorización.
- Disponible después de un cobro confirmado.

## 4. Factura electrónica C

El cliente operará como monotributista, sujeto a confirmación profesional. El sistema se prepara exclusivamente para comprobantes clase C en operaciones locales.

### Flujo

1. Seleccionar un cobro confirmado.
2. Completar o confirmar receptor e ítems.
3. Crear borrador fiscal.
4. El servidor valida configuración, importes, rol e idempotencia.
5. Consultar correlatividad por CUIT, punto de venta y tipo.
6. Solicitar CAE a ARCA en homologación.
7. Interpretar resultados aprobado, observado, rechazado o incierto.
8. Generar PDF y QR versión 1 únicamente con CAE real.
9. Persistir solicitud, respuesta, auditoría y vínculo con el cobro.

### Seguridad

- Certificado, clave privada, token y firma únicamente en el servidor.
- Ambientes de homologación y producción explícitos y separados.
- Emisor, punto de venta y tipo de comprobante definidos por configuración segura.
- Sin CAE, QR, numeración ni estados autorizados simulados.
- Ante timeout incierto, consultar ARCA antes de reintentar.

### Dependencias externas

- CUIT y condición tributaria confirmados.
- Punto de venta para Web Services habilitado.
- Certificado y clave privada de homologación.
- Domicilio comercial, ingresos brutos, fecha de inicio y datos que deban imprimirse.
- Revisión por contador de leyendas y tratamiento tributario aplicable.

## 5. Etapas

1. Aplicar la paleta visual confortable.
2. Implementar exportación e importación Excel.
3. Reemplazar el ticket actual por el formato interno no fiscal.
4. Rehacer Facturación como flujo exclusivo de factura C real.
5. Incorporar contrato de API, estados y migración fiscal.
6. Ejecutar pruebas, revisión móvil y despliegue.

## Definición de terminado

- El uso diario presenta una paleta más clara y consistente.
- Excel exporta datos reales y la importación valida antes de persistir.
- El ticket nunca puede confundirse con una factura.
- La factura C no se marca autorizada sin CAE real.
- Homologación y producción no pueden mezclarse.
- TypeScript, build, pruebas API y validación visual quedan en verde.

## Estado de implementación — 18/07/2026

- **Confort visual:** implementado y verificado en la versión publicada.
- **Excel:** exportación operativa e importación controlada de clientes implementadas.
- **Ticket interno:** formato térmico no fiscal implementado; se retiraron CAE y QR simulados.
- **Factura C:** interfaz, permisos, validaciones, contrato de servidor y migración preparados con cierre seguro.
- **Calidad:** TypeScript, build de producción y 30 pruebas de API aprobados; auditoría npm sin vulnerabilidades.
- **Despliegue:** publicado en `https://lavadero-sigma.vercel.app/`.

La emisión fiscal permanece deshabilitada hasta aplicar la migración en Supabase, cargar certificado, clave, CUIT y punto de venta, y aprobar las pruebas de homologación con ARCA. Esta protección evita generar comprobantes que parezcan válidos sin CAE real.
