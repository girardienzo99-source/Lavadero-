# Operación y puesta en marcha — Lavadero

## Estado seguro por defecto

La aplicación puede publicarse con `ARCA_CONNECTOR_ENABLED=false`. En ese estado:

- el ticket interno funciona y se identifica como no fiscal;
- la Factura C permanece bloqueada;
- las operaciones que requieren transacciones privadas se rechazan si falta `SUPABASE_SERVICE_ROLE_KEY`;
- nunca se fabrica un CAE, número fiscal o QR.

## Puesta en marcha de Supabase

Aplicar con el propietario del proyecto, en este orden, y con backup previo:

1. `database/migrations/20260717_transactional_pos.sql`
2. `database/migrations/20260718_factura_c.sql`
3. `database/migrations/20260719_operational_hardening.sql`

La tercera migración convierte las contraseñas heredadas a bcrypt, retira el acceso de `anon`, habilita RLS y deja las tablas internas disponibles sólo para el backend con `service_role`. Antes de ejecutarla, cargar `SUPABASE_SERVICE_ROLE_KEY` en Vercel. Después de validarla, cambiar `ALLOW_LEGACY_AUTH=false`.

Comprobaciones posteriores:

- una petición anónima a tablas internas debe ser rechazada;
- el login debe responder mediante `autenticar_usuario`;
- sólo debe existir una caja `ABIERTA`;
- un turno superpuesto para el mismo vehículo o responsable debe rechazarse;
- el segundo cobro del mismo turno debe rechazarse;
- una diferencia de arqueo requiere observación.

## Variables de Vercel

Obligatorias para operación:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (sólo servidor)
- `APP_SESSION_SECRET` de al menos 32 caracteres
- `ALLOWED_ORIGINS`
- `ALLOW_LEGACY_AUTH=false` después de migrar

ARCA, primero en homologación:

- `ARCA_ENVIRONMENT=homologacion`
- `ARCA_CUIT`
- `ARCA_POINT_OF_SALE`
- `ARCA_CERTIFICATE_B64`
- `ARCA_PRIVATE_KEY_B64`
- `ARCA_BUSINESS_NAME`
- `ARCA_BUSINESS_ADDRESS`
- `ARCA_GROSS_INCOME`
- `ARCA_ACTIVITY_START_DATE` en formato `AAAA-MM-DD`
- `ARCA_TAX_CONDITION=Monotributo`
- códigos verificados con las tablas de WSMTXCA: concepto, condición IVA de ítems, condición IVA del receptor y unidad de medida

Los certificados, la clave privada, el ticket WSAA, el token y la firma nunca deben usar nombres `VITE_*` ni llegar al navegador.

## Homologación de Factura C

1. Confirmar con el contador condición fiscal, leyendas, tratamiento de IVA y datos impresos.
2. Habilitar un punto de venta exclusivo para Web Services.
3. Probar `dummy`, autenticación WSAA y consulta de último comprobante.
4. Emitir en homologación casos de consumidor final, DNI, CUIT, rechazo funcional y timeout incierto.
5. Verificar correlatividad, CAE, vencimiento y QR versión 1.
6. Simular un timeout después del envío: el sistema debe consultar el comprobante y no reenviar a ciegas.
7. Recién con evidencia aprobada establecer `ARCA_CONNECTOR_ENABLED=true`.
8. Para producción, cargar credenciales de producción, cambiar el ambiente y repetir una validación controlada.

Una factura autorizada puede descargarse en PDF A4 con tipo C, código 011, emisor, receptor, detalle, total, CAE, vencimiento y QR fiscal. Un ticket interno no contiene ninguno de esos elementos fiscales.

## Excel

En **Más → Excel**:

- **Exportar** genera Resumen, Clientes, Turnos, Caja e Inventario con filtros, encabezados congelados, fechas, moneda y conciliación por medio de pago.
- **Importar** usa la plantilla, limita el archivo a 5 MB y 500 filas, valida nombre/patente, muestra vista previa y confirma cada alta atómica de cliente y vehículo.

## Validación y recuperación

Comandos antes de publicar:

```powershell
npm.cmd run lint
npm.cmd run build
python -m pytest automation-python/tests -q
npm.cmd audit --audit-level=high
```

Antes de migraciones: crear backup lógico y confirmar restauración en un proyecto de prueba. Para rollback de aplicación, promover el despliegue anterior de Vercel. No revertir una migración fiscal borrando comprobantes; corregir mediante una migración posterior y conservar la auditoría.

El endpoint autenticado `/api/readiness` informa sólo indicadores booleanos de configuración y no expone secretos.
