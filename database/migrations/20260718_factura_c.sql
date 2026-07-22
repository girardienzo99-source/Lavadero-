-- Persistencia segura para factura electrónica C.
-- Aplicar con el propietario de Supabase antes de habilitar el conector ARCA.

CREATE TABLE IF NOT EXISTS public.facturas_electronicas (
    id BIGSERIAL PRIMARY KEY,
    idempotency_key UUID NOT NULL UNIQUE,
    transaccion_id TEXT NOT NULL,
    tipo_comprobante SMALLINT NOT NULL DEFAULT 11 CHECK (tipo_comprobante = 11),
    punto_venta INTEGER NOT NULL CHECK (punto_venta BETWEEN 1 AND 99998),
    numero_comprobante BIGINT CHECK (numero_comprobante BETWEEN 1 AND 99999999),
    ambiente TEXT NOT NULL CHECK (ambiente IN ('homologacion', 'produccion')),
    estado TEXT NOT NULL CHECK (estado IN ('draft', 'authorizing', 'authorized', 'observed', 'rejected', 'uncertain', 'cancelled')),
    fecha_emision DATE NOT NULL,
    receptor_tipo_documento SMALLINT NOT NULL,
    receptor_numero_documento TEXT NOT NULL,
    receptor_nombre TEXT NOT NULL,
    moneda CHAR(3) NOT NULL DEFAULT 'PES',
    cotizacion NUMERIC(14,6) NOT NULL DEFAULT 1,
    importe_total NUMERIC(14,2) NOT NULL CHECK (importe_total > 0),
    cae CHAR(14),
    cae_vencimiento DATE,
    resultado_arca CHAR(1) CHECK (resultado_arca IN ('A', 'O', 'R')),
    observaciones JSONB NOT NULL DEFAULT '[]'::jsonb,
    errores JSONB NOT NULL DEFAULT '[]'::jsonb,
    solicitud_arca JSONB,
    respuesta_arca JSONB,
    actor TEXT NOT NULL,
    creada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT factura_autorizada_con_cae CHECK (
        estado NOT IN ('authorized', 'observed') OR (cae IS NOT NULL AND cae_vencimiento IS NOT NULL AND numero_comprobante IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_factura_c_correlativa
    ON public.facturas_electronicas (ambiente, punto_venta, tipo_comprobante, numero_comprobante)
    WHERE numero_comprobante IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_factura_c_transaccion_autorizada
    ON public.facturas_electronicas (transaccion_id)
    WHERE estado IN ('authorized', 'observed');

CREATE TABLE IF NOT EXISTS public.factura_items (
    id BIGSERIAL PRIMARY KEY,
    factura_id BIGINT NOT NULL REFERENCES public.facturas_electronicas(id) ON DELETE RESTRICT,
    codigo_interno VARCHAR(30) NOT NULL,
    descripcion VARCHAR(200) NOT NULL,
    cantidad NUMERIC(14,4) NOT NULL CHECK (cantidad > 0),
    unidad_codigo SMALLINT NOT NULL,
    precio_unitario NUMERIC(14,4) NOT NULL CHECK (precio_unitario >= 0),
    importe NUMERIC(14,2) NOT NULL CHECK (importe >= 0)
);

ALTER TABLE public.facturas_electronicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factura_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.facturas_electronicas FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.factura_items FROM PUBLIC, anon, authenticated;
