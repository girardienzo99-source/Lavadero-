-- Endurecimiento operativo integral.
-- IMPORTANTE: aplicar únicamente después de configurar SUPABASE_SERVICE_ROLE_KEY
-- en el backend. Esta migración retira el acceso directo de anon a datos internos.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Autenticación: migrar credenciales heredadas a bcrypt dentro de PostgreSQL.
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.usuarios ALTER COLUMN password DROP NOT NULL;
ALTER TABLE public.clientes ALTER COLUMN telefono DROP NOT NULL;

UPDATE public.usuarios
   SET password_hash = crypt(COALESCE(NULLIF(password, ''), NULLIF(contrasena, '')), gen_salt('bf', 12))
 WHERE password_hash IS NULL
   AND COALESCE(NULLIF(password, ''), NULLIF(contrasena, '')) IS NOT NULL;

UPDATE public.usuarios
   SET password = NULL,
       contrasena = NULL
 WHERE password_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.autenticar_usuario(
    p_username TEXT,
    p_password TEXT
)
RETURNS TABLE (
    id_usuario INTEGER,
    nombre TEXT,
    username TEXT,
    mail TEXT,
    rol TEXT,
    activo BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.id_usuario, u.nombre::TEXT, u.username::TEXT, u.mail::TEXT,
           u.rol::TEXT, COALESCE(u.activo, TRUE)
      FROM public.usuarios u
     WHERE (LOWER(u.username) = LOWER(BTRIM(p_username)) OR LOWER(u.mail) = LOWER(BTRIM(p_username)))
       AND u.password_hash IS NOT NULL
       AND u.password_hash = crypt(p_password, u.password_hash)
       AND COALESCE(u.activo, TRUE)
     LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.autenticar_usuario(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.autenticar_usuario(TEXT, TEXT) TO service_role;

-- Datos operativos y trazabilidad.
ALTER TABLE public.turnos ADD COLUMN IF NOT EXISTS cobrado_en TIMESTAMPTZ;
ALTER TABLE public.turnos ADD COLUMN IF NOT EXISTS entregado_en TIMESTAMPTZ;
ALTER TABLE public.turnos ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS public.turno_estados_historial (
    id BIGSERIAL PRIMARY KEY,
    turno_id INTEGER NOT NULL REFERENCES public.turnos(id) ON DELETE RESTRICT,
    estado_anterior VARCHAR(20) NOT NULL,
    estado_nuevo VARCHAR(20) NOT NULL,
    actor TEXT NOT NULL,
    observacion TEXT,
    fecha TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_turno_historial_turno_fecha
    ON public.turno_estados_historial (turno_id, fecha DESC);

CREATE TABLE IF NOT EXISTS public.turno_inspecciones (
    id BIGSERIAL PRIMARY KEY,
    turno_id INTEGER NOT NULL UNIQUE REFERENCES public.turnos(id) ON DELETE RESTRICT,
    nivel_suciedad VARCHAR(10) NOT NULL CHECK (nivel_suciedad IN ('BAJO','MEDIO','ALTO','EXTREMO')),
    checklist_danos JSONB NOT NULL DEFAULT '{}'::jsonb,
    observaciones TEXT,
    inspector TEXT NOT NULL,
    actor TEXT NOT NULL,
    fecha_inspeccion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.inspeccion_fotos (
    id BIGSERIAL PRIMARY KEY,
    inspeccion_id BIGINT NOT NULL REFERENCES public.turno_inspecciones(id) ON DELETE RESTRICT,
    storage_path TEXT NOT NULL UNIQUE,
    sector VARCHAR(80) NOT NULL,
    descripcion VARCHAR(200),
    mime_type VARCHAR(30) NOT NULL,
    tamano_bytes INTEGER NOT NULL CHECK (tamano_bytes BETWEEN 1 AND 700000),
    actor TEXT NOT NULL,
    creada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('inspecciones', 'inspecciones', FALSE, 700000, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET
    public = FALSE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.guardar_inspeccion_recepcion(
    p_turno_id INTEGER,
    p_nivel_suciedad TEXT,
    p_checklist_danos JSONB,
    p_observaciones TEXT,
    p_inspector TEXT,
    p_actor TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id BIGINT;
    v_nivel TEXT := UPPER(BTRIM(COALESCE(p_nivel_suciedad, '')));
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.turnos WHERE id = p_turno_id) THEN RAISE EXCEPTION 'turno no encontrado'; END IF;
    IF v_nivel NOT IN ('BAJO','MEDIO','ALTO','EXTREMO') THEN RAISE EXCEPTION 'nivel de suciedad invalido'; END IF;
    IF jsonb_typeof(p_checklist_danos) <> 'object' THEN RAISE EXCEPTION 'checklist invalido'; END IF;
    IF LENGTH(BTRIM(COALESCE(p_inspector, ''))) < 2 THEN RAISE EXCEPTION 'inspector obligatorio'; END IF;

    INSERT INTO public.turno_inspecciones(
        turno_id, nivel_suciedad, checklist_danos, observaciones,
        inspector, actor, fecha_inspeccion, actualizada_en
    ) VALUES (
        p_turno_id, v_nivel, p_checklist_danos,
        NULLIF(BTRIM(COALESCE(p_observaciones, '')), ''),
        BTRIM(p_inspector), BTRIM(p_actor), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) ON CONFLICT (turno_id) DO UPDATE SET
        nivel_suciedad = EXCLUDED.nivel_suciedad,
        checklist_danos = EXCLUDED.checklist_danos,
        observaciones = EXCLUDED.observaciones,
        inspector = EXCLUDED.inspector,
        actor = EXCLUDED.actor,
        actualizada_en = CURRENT_TIMESTAMP
    RETURNING id INTO v_id;
    RETURN jsonb_build_object('inspeccion_id', v_id, 'turno_id', p_turno_id);
END;
$$;

REVOKE ALL ON FUNCTION public.guardar_inspeccion_recepcion(INTEGER, TEXT, JSONB, TEXT, TEXT, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_inspeccion_recepcion(INTEGER, TEXT, JSONB, TEXT, TEXT, TEXT)
    TO service_role;

ALTER TABLE public.caja_movimientos ADD COLUMN IF NOT EXISTS turno_id INTEGER REFERENCES public.turnos(id);
ALTER TABLE public.caja_movimientos ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(20);
ALTER TABLE public.caja_movimientos ADD COLUMN IF NOT EXISTS origen VARCHAR(30) NOT NULL DEFAULT 'MANUAL';
ALTER TABLE public.caja_movimientos ADD COLUMN IF NOT EXISTS actor TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_caja_cobro_turno
    ON public.caja_movimientos (turno_id)
    WHERE turno_id IS NOT NULL AND tipo = 'INGRESO' AND origen = 'TURNO';

ALTER TABLE public.cajas_diarias ADD COLUMN IF NOT EXISTS actor_apertura TEXT;
ALTER TABLE public.cajas_diarias ADD COLUMN IF NOT EXISTS actor_cierre TEXT;
ALTER TABLE public.cajas_diarias ADD COLUMN IF NOT EXISTS monto_esperado NUMERIC(14,2);
ALTER TABLE public.cajas_diarias ADD COLUMN IF NOT EXISTS diferencia_cierre NUMERIC(14,2);

CREATE OR REPLACE FUNCTION public.abrir_caja_segura(
    p_monto_apertura NUMERIC,
    p_actor TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caja_id INTEGER;
BEGIN
    IF p_monto_apertura IS NULL OR p_monto_apertura < 0 THEN
        RAISE EXCEPTION 'monto de apertura invalido';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('caja-diaria-abierta'));
    IF EXISTS (SELECT 1 FROM public.cajas_diarias WHERE estado = 'ABIERTA') THEN
        RAISE EXCEPTION 'ya existe una caja abierta';
    END IF;
    INSERT INTO public.cajas_diarias(
        fecha_apertura, monto_apertura, saldo_actual, estado, actor_apertura
    ) VALUES (
        CURRENT_TIMESTAMP, ROUND(p_monto_apertura, 2), ROUND(p_monto_apertura, 2),
        'ABIERTA', BTRIM(p_actor)
    ) RETURNING id INTO v_caja_id;
    RETURN jsonb_build_object('caja_id', v_caja_id, 'saldo_actual', ROUND(p_monto_apertura, 2));
END;
$$;

REVOKE ALL ON FUNCTION public.abrir_caja_segura(NUMERIC, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.abrir_caja_segura(NUMERIC, TEXT) TO service_role;

-- Alta atómica: evita clientes huérfanos cuando falla el vehículo.
CREATE OR REPLACE FUNCTION public.registrar_cliente_vehiculo(
    p_nombre TEXT,
    p_telefono TEXT,
    p_email TEXT,
    p_patente TEXT,
    p_marca TEXT,
    p_modelo TEXT,
    p_color TEXT,
    p_anio INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cliente_id INTEGER;
    v_vehiculo_id INTEGER;
    v_patente TEXT := UPPER(REGEXP_REPLACE(BTRIM(COALESCE(p_patente, '')), '\s+', '', 'g'));
BEGIN
    IF LENGTH(BTRIM(COALESCE(p_nombre, ''))) < 2 THEN
        RAISE EXCEPTION 'nombre invalido';
    END IF;
    IF v_patente !~ '^[A-Z0-9]{6,9}$' THEN
        RAISE EXCEPTION 'patente invalida';
    END IF;
    IF EXISTS (SELECT 1 FROM public.vehiculos WHERE patente = v_patente) THEN
        RETURN jsonb_build_object('status', 'duplicate', 'patente', v_patente);
    END IF;

    INSERT INTO public.clientes (nombre, telefono, email, fecha_registro, clasificacion)
    VALUES (BTRIM(p_nombre), NULLIF(BTRIM(COALESCE(p_telefono, '')), ''),
            NULLIF(BTRIM(COALESCE(p_email, '')), ''), CURRENT_TIMESTAMP, 'OCASIONAL')
    RETURNING id INTO v_cliente_id;

    INSERT INTO public.vehiculos (cliente_id, patente, marca, modelo, color, anio)
    VALUES (v_cliente_id, v_patente, NULLIF(BTRIM(COALESCE(p_marca, '')), ''),
            NULLIF(BTRIM(COALESCE(p_modelo, '')), ''), NULLIF(BTRIM(COALESCE(p_color, '')), ''), p_anio)
    RETURNING id INTO v_vehiculo_id;

    RETURN jsonb_build_object(
        'status', 'created', 'cliente_id', v_cliente_id,
        'vehiculo_id', v_vehiculo_id, 'patente', v_patente
    );
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_cliente_vehiculo(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_cliente_vehiculo(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER)
    TO service_role;

CREATE OR REPLACE FUNCTION public.registrar_vehiculo_cliente(
    p_cliente_id INTEGER,
    p_patente TEXT,
    p_marca TEXT,
    p_modelo TEXT,
    p_color TEXT,
    p_anio INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id INTEGER;
    v_patente TEXT := UPPER(REGEXP_REPLACE(BTRIM(COALESCE(p_patente, '')), '\s+', '', 'g'));
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = p_cliente_id) THEN RAISE EXCEPTION 'cliente no encontrado'; END IF;
    IF v_patente !~ '^[A-Z0-9]{6,9}$' THEN RAISE EXCEPTION 'patente invalida'; END IF;
    SELECT id INTO v_id FROM public.vehiculos WHERE patente = v_patente;
    IF v_id IS NOT NULL THEN RETURN jsonb_build_object('status', 'duplicate', 'vehiculo_id', v_id, 'patente', v_patente); END IF;
    INSERT INTO public.vehiculos(cliente_id, patente, marca, modelo, color, anio)
    VALUES (p_cliente_id, v_patente, NULLIF(BTRIM(COALESCE(p_marca, '')), ''),
            NULLIF(BTRIM(COALESCE(p_modelo, '')), ''), NULLIF(BTRIM(COALESCE(p_color, '')), ''), p_anio)
    RETURNING id INTO v_id;
    RETURN jsonb_build_object('status', 'created', 'vehiculo_id', v_id, 'patente', v_patente);
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_vehiculo_cliente(INTEGER, TEXT, TEXT, TEXT, TEXT, INTEGER)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_vehiculo_cliente(INTEGER, TEXT, TEXT, TEXT, TEXT, INTEGER)
    TO service_role;

CREATE OR REPLACE FUNCTION public.agendar_turno_seguro(
    p_cliente_id INTEGER,
    p_vehiculo_id INTEGER,
    p_servicio_id INTEGER,
    p_empleado_id INTEGER,
    p_fecha_hora TIMESTAMP,
    p_observaciones TEXT,
    p_actor TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_turno_id INTEGER;
    v_duracion INTEGER;
BEGIN
    IF p_fecha_hora IS NULL THEN RAISE EXCEPTION 'fecha obligatoria'; END IF;
    IF p_fecha_hora < (CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires') - INTERVAL '5 minutes' THEN
        RAISE EXCEPTION 'fecha en el pasado';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.vehiculos WHERE id = p_vehiculo_id AND cliente_id = p_cliente_id) THEN
        RAISE EXCEPTION 'el vehiculo no pertenece al cliente';
    END IF;
    SELECT duracion_minutos INTO v_duracion FROM public.servicios WHERE id = p_servicio_id;
    IF v_duracion IS NULL OR v_duracion <= 0 THEN RAISE EXCEPTION 'servicio invalido'; END IF;

    PERFORM pg_advisory_xact_lock(hashtext('agenda:' || p_vehiculo_id::TEXT));
    IF p_empleado_id IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtext('empleado:' || p_empleado_id::TEXT));
    END IF;

    IF EXISTS (
        SELECT 1
          FROM public.turnos t
          JOIN public.servicios s ON s.id = t.servicio_id
         WHERE t.estado <> 'CANCELADO'
           AND (t.vehiculo_id = p_vehiculo_id OR (p_empleado_id IS NOT NULL AND t.empleado_id = p_empleado_id))
           AND tsrange(t.fecha_hora, t.fecha_hora + make_interval(mins => s.duracion_minutos), '[)')
               && tsrange(p_fecha_hora, p_fecha_hora + make_interval(mins => v_duracion), '[)')
    ) THEN
        RAISE EXCEPTION 'el horario se superpone con otro turno';
    END IF;

    INSERT INTO public.turnos(
        cliente_id, vehiculo_id, servicio_id, empleado_id,
        fecha_hora, estado, observaciones, actualizado_en
    ) VALUES (
        p_cliente_id, p_vehiculo_id, p_servicio_id, p_empleado_id,
        p_fecha_hora, 'PENDIENTE', NULLIF(BTRIM(COALESCE(p_observaciones, '')), ''), CURRENT_TIMESTAMP
    ) RETURNING id INTO v_turno_id;

    INSERT INTO public.turno_estados_historial(turno_id, estado_anterior, estado_nuevo, actor, observacion)
    VALUES (v_turno_id, 'NUEVO', 'PENDIENTE', BTRIM(p_actor), 'Turno creado');

    RETURN jsonb_build_object('turno_id', v_turno_id, 'estado', 'PENDIENTE');
END;
$$;

REVOKE ALL ON FUNCTION public.agendar_turno_seguro(INTEGER, INTEGER, INTEGER, INTEGER, TIMESTAMP, TEXT, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agendar_turno_seguro(INTEGER, INTEGER, INTEGER, INTEGER, TIMESTAMP, TEXT, TEXT)
    TO service_role;

CREATE OR REPLACE FUNCTION public.reprogramar_turno_seguro(
    p_turno_id INTEGER,
    p_empleado_id INTEGER,
    p_fecha_hora TIMESTAMP,
    p_actor TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_turno public.turnos%ROWTYPE;
    v_duracion INTEGER;
BEGIN
    SELECT * INTO v_turno FROM public.turnos WHERE id = p_turno_id FOR UPDATE;
    IF v_turno.id IS NULL THEN RAISE EXCEPTION 'turno no encontrado'; END IF;
    IF v_turno.estado NOT IN ('PENDIENTE', 'EN_PROCESO') THEN
        RAISE EXCEPTION 'solo se reprograman turnos pendientes o en proceso';
    END IF;
    IF p_fecha_hora IS NULL OR p_fecha_hora < (CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires') - INTERVAL '5 minutes' THEN
        RAISE EXCEPTION 'fecha invalida';
    END IF;
    SELECT duracion_minutos INTO v_duracion FROM public.servicios WHERE id = v_turno.servicio_id;
    IF v_duracion IS NULL OR v_duracion <= 0 THEN RAISE EXCEPTION 'servicio invalido'; END IF;

    PERFORM pg_advisory_xact_lock(hashtext('agenda:' || v_turno.vehiculo_id::TEXT));
    IF p_empleado_id IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtext('empleado:' || p_empleado_id::TEXT));
    END IF;
    IF EXISTS (
        SELECT 1
          FROM public.turnos t
          JOIN public.servicios s ON s.id = t.servicio_id
         WHERE t.id <> v_turno.id
           AND t.estado <> 'CANCELADO'
           AND (t.vehiculo_id = v_turno.vehiculo_id OR (p_empleado_id IS NOT NULL AND t.empleado_id = p_empleado_id))
           AND tsrange(t.fecha_hora, t.fecha_hora + make_interval(mins => s.duracion_minutos), '[)')
               && tsrange(p_fecha_hora, p_fecha_hora + make_interval(mins => v_duracion), '[)')
    ) THEN
        RAISE EXCEPTION 'el horario se superpone con otro turno';
    END IF;

    UPDATE public.turnos
       SET empleado_id = p_empleado_id, fecha_hora = p_fecha_hora, actualizado_en = CURRENT_TIMESTAMP
     WHERE id = v_turno.id;
    INSERT INTO public.turno_estados_historial(turno_id, estado_anterior, estado_nuevo, actor, observacion)
    VALUES (v_turno.id, v_turno.estado, v_turno.estado, BTRIM(p_actor), 'Turno reprogramado');
    RETURN jsonb_build_object('turno_id', v_turno.id, 'estado', v_turno.estado, 'fecha_hora', p_fecha_hora);
END;
$$;

REVOKE ALL ON FUNCTION public.reprogramar_turno_seguro(INTEGER, INTEGER, TIMESTAMP, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reprogramar_turno_seguro(INTEGER, INTEGER, TIMESTAMP, TEXT)
    TO service_role;

CREATE OR REPLACE FUNCTION public.cambiar_estado_turno(
    p_turno_id INTEGER,
    p_estado TEXT,
    p_actor TEXT,
    p_observacion TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_turno public.turnos%ROWTYPE;
    v_estado TEXT := UPPER(BTRIM(COALESCE(p_estado, '')));
BEGIN
    SELECT * INTO v_turno FROM public.turnos WHERE id = p_turno_id FOR UPDATE;
    IF v_turno.id IS NULL THEN RAISE EXCEPTION 'turno no encontrado'; END IF;
    IF v_turno.estado = v_estado THEN
        RETURN jsonb_build_object('turno_id', v_turno.id, 'estado', v_estado, 'unchanged', TRUE);
    END IF;
    IF NOT (
        (v_turno.estado = 'PENDIENTE' AND v_estado IN ('EN_PROCESO', 'CANCELADO')) OR
        (v_turno.estado = 'EN_PROCESO' AND v_estado IN ('PENDIENTE', 'COMPLETADO', 'CANCELADO')) OR
        (v_turno.estado = 'COMPLETADO' AND v_estado IN ('EN_PROCESO', 'ENTREGADO'))
    ) THEN
        RAISE EXCEPTION 'transicion no permitida: % -> %', v_turno.estado, v_estado;
    END IF;
    IF v_estado = 'ENTREGADO' AND v_turno.cobrado_en IS NULL THEN
        RAISE EXCEPTION 'el turno debe estar cobrado antes de entregarlo';
    END IF;

    UPDATE public.turnos
       SET estado = v_estado,
           entregado_en = CASE WHEN v_estado = 'ENTREGADO' THEN CURRENT_TIMESTAMP ELSE entregado_en END,
           actualizado_en = CURRENT_TIMESTAMP
     WHERE id = v_turno.id;

    INSERT INTO public.turno_estados_historial(turno_id, estado_anterior, estado_nuevo, actor, observacion)
    VALUES (v_turno.id, v_turno.estado, v_estado, BTRIM(p_actor), NULLIF(BTRIM(COALESCE(p_observacion, '')), ''));

    RETURN jsonb_build_object('turno_id', v_turno.id, 'estado', v_estado, 'unchanged', FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.cambiar_estado_turno(INTEGER, TEXT, TEXT, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cambiar_estado_turno(INTEGER, TEXT, TEXT, TEXT) TO service_role;

-- Cobro único, idempotente y ligado al turno.
CREATE OR REPLACE FUNCTION public.cobrar_turno(
    p_turno_id INTEGER,
    p_metodo_pago TEXT,
    p_idempotency_key UUID,
    p_actor TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_turno public.turnos%ROWTYPE;
    v_caja public.cajas_diarias%ROWTYPE;
    v_precio NUMERIC(14,2);
    v_movimiento_id INTEGER;
    v_metodo TEXT := UPPER(BTRIM(COALESCE(p_metodo_pago, '')));
BEGIN
    IF p_idempotency_key IS NULL THEN RAISE EXCEPTION 'idempotency_key obligatorio'; END IF;
    SELECT id INTO v_movimiento_id FROM public.caja_movimientos WHERE idempotency_key = p_idempotency_key;
    IF v_movimiento_id IS NOT NULL THEN
        RETURN jsonb_build_object('movimiento_id', v_movimiento_id, 'idempotent_replay', TRUE);
    END IF;
    IF v_metodo NOT IN ('EFECTIVO', 'TRANSFERENCIA', 'DEBITO', 'CREDITO') THEN
        RAISE EXCEPTION 'metodo de pago invalido';
    END IF;

    SELECT * INTO v_turno FROM public.turnos WHERE id = p_turno_id FOR UPDATE;
    IF v_turno.id IS NULL THEN RAISE EXCEPTION 'turno no encontrado'; END IF;
    IF v_turno.estado <> 'COMPLETADO' THEN RAISE EXCEPTION 'el trabajo no esta completado'; END IF;
    IF v_turno.cobrado_en IS NOT NULL THEN RAISE EXCEPTION 'el turno ya fue cobrado'; END IF;
    SELECT precio INTO v_precio FROM public.servicios WHERE id = v_turno.servicio_id;
    IF v_precio IS NULL OR v_precio <= 0 THEN RAISE EXCEPTION 'precio de servicio invalido'; END IF;

    SELECT * INTO v_caja FROM public.cajas_diarias
     WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1 FOR UPDATE;
    IF v_caja.id IS NULL THEN RAISE EXCEPTION 'no hay una caja abierta'; END IF;

    INSERT INTO public.caja_movimientos(
        caja_id, tipo, monto, descripcion, idempotency_key,
        turno_id, metodo_pago, origen, actor
    ) VALUES (
        v_caja.id, 'INGRESO', v_precio,
        'Cobro turno #' || v_turno.id, p_idempotency_key,
        v_turno.id, v_metodo, 'TURNO', BTRIM(p_actor)
    ) RETURNING id INTO v_movimiento_id;

    UPDATE public.cajas_diarias SET saldo_actual = saldo_actual + v_precio WHERE id = v_caja.id;
    UPDATE public.turnos SET cobrado_en = CURRENT_TIMESTAMP, actualizado_en = CURRENT_TIMESTAMP WHERE id = v_turno.id;

    RETURN jsonb_build_object(
        'movimiento_id', v_movimiento_id, 'monto', v_precio,
        'metodo_pago', v_metodo, 'idempotent_replay', FALSE
    );
END;
$$;

REVOKE ALL ON FUNCTION public.cobrar_turno(INTEGER, TEXT, UUID, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cobrar_turno(INTEGER, TEXT, UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.cerrar_caja_segura(
    p_monto_declarado NUMERIC,
    p_actor TEXT,
    p_observacion TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caja public.cajas_diarias%ROWTYPE;
    v_diferencia NUMERIC(14,2);
BEGIN
    IF p_monto_declarado IS NULL OR p_monto_declarado < 0 THEN RAISE EXCEPTION 'monto de cierre invalido'; END IF;
    SELECT * INTO v_caja FROM public.cajas_diarias
     WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1 FOR UPDATE;
    IF v_caja.id IS NULL THEN RAISE EXCEPTION 'no hay una caja abierta'; END IF;
    v_diferencia := ROUND(p_monto_declarado - v_caja.saldo_actual, 2);
    IF v_diferencia <> 0 AND LENGTH(BTRIM(COALESCE(p_observacion, ''))) < 3 THEN
        RAISE EXCEPTION 'la diferencia requiere una observacion';
    END IF;

    UPDATE public.cajas_diarias
       SET estado = 'CERRADA', fecha_cierre = CURRENT_TIMESTAMP,
           monto_cierre = ROUND(p_monto_declarado, 2), monto_esperado = saldo_actual,
           diferencia_cierre = v_diferencia, actor_cierre = BTRIM(p_actor),
           observaciones = NULLIF(BTRIM(COALESCE(p_observacion, '')), '')
     WHERE id = v_caja.id;

    RETURN jsonb_build_object(
        'caja_id', v_caja.id, 'monto_esperado', v_caja.saldo_actual,
        'monto_declarado', ROUND(p_monto_declarado, 2), 'diferencia', v_diferencia
    );
END;
$$;

REVOKE ALL ON FUNCTION public.cerrar_caja_segura(NUMERIC, TEXT, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cerrar_caja_segura(NUMERIC, TEXT, TEXT) TO service_role;

-- Cola fiscal: una sola autorización activa por CUIT/punto/tipo. Un estado
-- uncertain bloquea nuevas emisiones hasta reconciliarlo con ARCA.
CREATE UNIQUE INDEX IF NOT EXISTS ux_factura_c_emision_activa
    ON public.facturas_electronicas (ambiente, punto_venta, tipo_comprobante)
    WHERE estado IN ('authorizing', 'uncertain');

CREATE OR REPLACE FUNCTION public.crear_borrador_factura_c(
    p_idempotency_key UUID,
    p_transaccion_id TEXT,
    p_punto_venta INTEGER,
    p_ambiente TEXT,
    p_fecha_emision DATE,
    p_receptor_tipo_documento SMALLINT,
    p_receptor_numero_documento TEXT,
    p_receptor_nombre TEXT,
    p_importe_total NUMERIC,
    p_items JSONB,
    p_actor TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_factura_id BIGINT;
    v_existing public.facturas_electronicas%ROWTYPE;
    v_item JSONB;
BEGIN
    SELECT * INTO v_existing FROM public.facturas_electronicas
     WHERE idempotency_key = p_idempotency_key;
    IF v_existing.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'factura_id', v_existing.id, 'estado', v_existing.estado,
            'numero_comprobante', v_existing.numero_comprobante,
            'fecha_emision', v_existing.fecha_emision,
            'cae', v_existing.cae, 'cae_vencimiento', v_existing.cae_vencimiento,
            'resultado_arca', v_existing.resultado_arca,
            'observaciones', v_existing.observaciones, 'errores', v_existing.errores,
            'idempotent_replay', TRUE
        );
    END IF;
    IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'items fiscales obligatorios';
    END IF;

    INSERT INTO public.facturas_electronicas(
        idempotency_key, transaccion_id, tipo_comprobante, punto_venta,
        ambiente, estado, fecha_emision, receptor_tipo_documento,
        receptor_numero_documento, receptor_nombre, importe_total, actor
    ) VALUES (
        p_idempotency_key, BTRIM(p_transaccion_id), 11, p_punto_venta,
        p_ambiente, 'authorizing', p_fecha_emision, p_receptor_tipo_documento,
        BTRIM(p_receptor_numero_documento), BTRIM(p_receptor_nombre),
        ROUND(p_importe_total, 2), BTRIM(p_actor)
    ) RETURNING id INTO v_factura_id;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.factura_items(
            factura_id, codigo_interno, descripcion, cantidad,
            unidad_codigo, precio_unitario, importe
        ) VALUES (
            v_factura_id,
            LEFT(BTRIM(v_item ->> 'internalCode'), 30),
            LEFT(BTRIM(v_item ->> 'description'), 200),
            (v_item ->> 'quantity')::NUMERIC,
            (v_item ->> 'unitCode')::SMALLINT,
            (v_item ->> 'unitPrice')::NUMERIC,
            (v_item ->> 'total')::NUMERIC
        );
    END LOOP;

    RETURN jsonb_build_object(
        'factura_id', v_factura_id, 'estado', 'authorizing',
        'idempotent_replay', FALSE
    );
END;
$$;

REVOKE ALL ON FUNCTION public.crear_borrador_factura_c(
    UUID, TEXT, INTEGER, TEXT, DATE, SMALLINT, TEXT, TEXT, NUMERIC, JSONB, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crear_borrador_factura_c(
    UUID, TEXT, INTEGER, TEXT, DATE, SMALLINT, TEXT, TEXT, NUMERIC, JSONB, TEXT
) TO service_role;

-- RLS: una vez aplicada, sólo el backend con service_role opera datos internos.
DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'usuarios','empleados','clientes','vehiculos','servicios','turnos',
    'turno_estados_historial','turno_inspecciones','inspeccion_fotos',
    'productos','inventario_movimientos','cajas_diarias',
    'caja_movimientos','ventas','venta_detalles','cupones_descuento',
    'feedback_clientes','inspeccion_danos','liquidacion_comisiones',
    'facturas_electronicas','factura_items'
  ] LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
      EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', table_name);
      EXECUTE format('GRANT ALL ON public.%I TO service_role', table_name);
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

COMMIT;
