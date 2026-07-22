-- Venta POS atomica e idempotente.
-- Aplicar con una cuenta propietaria del proyecto Supabase.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE public.ventas
    ADD COLUMN IF NOT EXISTS idempotency_key UUID;

CREATE UNIQUE INDEX IF NOT EXISTS ux_ventas_idempotency_key
    ON public.ventas (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.caja_movimientos
    ADD COLUMN IF NOT EXISTS idempotency_key UUID;

CREATE UNIQUE INDEX IF NOT EXISTS ux_caja_movimientos_idempotency_key
    ON public.caja_movimientos (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_caja_unica_abierta
    ON public.cajas_diarias ((estado))
    WHERE estado = 'ABIERTA';

CREATE OR REPLACE FUNCTION public.registrar_venta_pos(
    p_cliente_id INTEGER,
    p_metodo_pago TEXT,
    p_detalles JSONB,
    p_codigo_cupon TEXT,
    p_idempotency_key UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caja public.cajas_diarias%ROWTYPE;
    v_venta_id INTEGER;
    v_existing_total NUMERIC(14,2);
    v_producto public.productos%ROWTYPE;
    v_item JSONB;
    v_producto_id INTEGER;
    v_cantidad INTEGER;
    v_subtotal NUMERIC(14,2) := 0;
    v_descuento NUMERIC(14,2) := 0;
    v_total NUMERIC(14,2) := 0;
    v_cupon public.cupones_descuento%ROWTYPE;
BEGIN
    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'idempotency_key es obligatorio';
    END IF;

    SELECT id, total
      INTO v_venta_id, v_existing_total
      FROM public.ventas
     WHERE idempotency_key = p_idempotency_key;

    IF v_venta_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'venta_id', v_venta_id,
            'total', v_existing_total,
            'idempotent_replay', TRUE
        );
    END IF;

    IF p_metodo_pago NOT IN ('EFECTIVO', 'TRANSFERENCIA', 'DEBITO', 'CREDITO') THEN
        RAISE EXCEPTION 'metodo de pago no valido';
    END IF;

    IF jsonb_typeof(p_detalles) <> 'array' OR jsonb_array_length(p_detalles) = 0 THEN
        RAISE EXCEPTION 'la venta debe contener detalles';
    END IF;

    SELECT *
      INTO v_caja
      FROM public.cajas_diarias
     WHERE estado = 'ABIERTA'
     ORDER BY id DESC
     LIMIT 1
     FOR UPDATE;

    IF v_caja.id IS NULL THEN
        RAISE EXCEPTION 'no hay una caja abierta';
    END IF;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_detalles)
    LOOP
        v_producto_id := (v_item ->> 'productoId')::INTEGER;
        v_cantidad := (v_item ->> 'cantidad')::INTEGER;
        IF v_producto_id IS NULL OR v_cantidad IS NULL OR v_cantidad <= 0 THEN
            RAISE EXCEPTION 'detalle de venta no valido';
        END IF;

        SELECT *
          INTO v_producto
          FROM public.productos
         WHERE id = v_producto_id
         FOR UPDATE;

        IF v_producto.id IS NULL THEN
            RAISE EXCEPTION 'producto % no encontrado', v_producto_id;
        END IF;
        IF v_producto.stock < v_cantidad THEN
            RAISE EXCEPTION 'stock insuficiente para %', v_producto.nombre;
        END IF;

        v_subtotal := v_subtotal + (v_producto.precio_venta * v_cantidad);
    END LOOP;

    IF NULLIF(BTRIM(p_codigo_cupon), '') IS NOT NULL THEN
        SELECT *
          INTO v_cupon
          FROM public.cupones_descuento
         WHERE codigo = BTRIM(p_codigo_cupon)
           AND usado = FALSE
           AND fecha_expiracion >= CURRENT_TIMESTAMP
           AND (cliente_id IS NULL OR cliente_id = p_cliente_id)
         FOR UPDATE;

        IF v_cupon.id IS NULL THEN
            RAISE EXCEPTION 'cupon invalido, vencido o ya utilizado';
        END IF;
        v_descuento := ROUND(v_subtotal * v_cupon.descuento_porcentaje / 100.0, 2);
    END IF;

    v_total := v_subtotal - v_descuento;

    INSERT INTO public.ventas (
        caja_id, cliente_id, total, metodo_pago, estado, idempotency_key
    ) VALUES (
        v_caja.id, p_cliente_id, v_total, p_metodo_pago, 'COMPLETADA', p_idempotency_key
    ) RETURNING id INTO v_venta_id;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_detalles)
    LOOP
        v_producto_id := (v_item ->> 'productoId')::INTEGER;
        v_cantidad := (v_item ->> 'cantidad')::INTEGER;

        SELECT * INTO v_producto FROM public.productos WHERE id = v_producto_id;

        INSERT INTO public.venta_detalles (
            venta_id, producto_id, cantidad, precio_unitario, subtotal
        ) VALUES (
            v_venta_id,
            v_producto_id,
            v_cantidad,
            v_producto.precio_venta,
            v_producto.precio_venta * v_cantidad
        );

        UPDATE public.productos
           SET stock = stock - v_cantidad
         WHERE id = v_producto_id;
    END LOOP;

    IF v_cupon.id IS NOT NULL THEN
        UPDATE public.cupones_descuento
           SET usado = TRUE, fecha_uso = CURRENT_TIMESTAMP
         WHERE id = v_cupon.id;
    END IF;

    INSERT INTO public.caja_movimientos (caja_id, tipo, monto, descripcion)
    VALUES (v_caja.id, 'INGRESO', v_total, 'Venta POS #' || v_venta_id);

    UPDATE public.cajas_diarias
       SET saldo_actual = saldo_actual + v_total
     WHERE id = v_caja.id;

    RETURN jsonb_build_object(
        'venta_id', v_venta_id,
        'total', v_total,
        'idempotent_replay', FALSE
    );
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_venta_pos(INTEGER, TEXT, JSONB, TEXT, UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_venta_pos(INTEGER, TEXT, JSONB, TEXT, UUID)
    TO service_role;

CREATE OR REPLACE FUNCTION public.registrar_movimiento_caja(
    p_tipo TEXT,
    p_monto NUMERIC,
    p_descripcion TEXT,
    p_idempotency_key UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caja public.cajas_diarias%ROWTYPE;
    v_movimiento_id INTEGER;
    v_existing_monto NUMERIC(14,2);
    v_delta NUMERIC(14,2);
BEGIN
    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'idempotency_key es obligatorio';
    END IF;

    SELECT id, monto
      INTO v_movimiento_id, v_existing_monto
      FROM public.caja_movimientos
     WHERE idempotency_key = p_idempotency_key;

    IF v_movimiento_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'movimiento_id', v_movimiento_id,
            'monto', v_existing_monto,
            'idempotent_replay', TRUE
        );
    END IF;

    IF p_tipo NOT IN ('INGRESO', 'EGRESO') THEN
        RAISE EXCEPTION 'tipo de movimiento no valido';
    END IF;
    IF p_monto IS NULL OR p_monto <= 0 THEN
        RAISE EXCEPTION 'monto no valido';
    END IF;
    IF LENGTH(BTRIM(COALESCE(p_descripcion, ''))) < 3 THEN
        RAISE EXCEPTION 'descripcion obligatoria';
    END IF;

    SELECT *
      INTO v_caja
      FROM public.cajas_diarias
     WHERE estado = 'ABIERTA'
     ORDER BY id DESC
     LIMIT 1
     FOR UPDATE;

    IF v_caja.id IS NULL THEN
        RAISE EXCEPTION 'no hay una caja abierta';
    END IF;
    IF p_tipo = 'EGRESO' AND v_caja.saldo_actual < p_monto THEN
        RAISE EXCEPTION 'saldo de caja insuficiente';
    END IF;

    INSERT INTO public.caja_movimientos (
        caja_id, tipo, monto, descripcion, idempotency_key
    ) VALUES (
        v_caja.id, p_tipo, ROUND(p_monto, 2), BTRIM(p_descripcion), p_idempotency_key
    ) RETURNING id INTO v_movimiento_id;

    v_delta := CASE WHEN p_tipo = 'INGRESO' THEN p_monto ELSE -p_monto END;
    UPDATE public.cajas_diarias
       SET saldo_actual = saldo_actual + v_delta
     WHERE id = v_caja.id;

    RETURN jsonb_build_object(
        'movimiento_id', v_movimiento_id,
        'monto', ROUND(p_monto, 2),
        'idempotent_replay', FALSE
    );
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_movimiento_caja(TEXT, NUMERIC, TEXT, UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_movimiento_caja(TEXT, NUMERIC, TEXT, UUID)
    TO service_role;

-- Inventario auditable e idempotente. Cada movimiento bloquea el producto y,
-- cuando corresponde, registra el egreso de caja en la misma transaccion.
CREATE TABLE IF NOT EXISTS public.inventario_movimientos (
    id BIGSERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL REFERENCES public.productos(id),
    variacion INTEGER NOT NULL CHECK (variacion <> 0),
    stock_anterior INTEGER NOT NULL CHECK (stock_anterior >= 0),
    stock_nuevo INTEGER NOT NULL CHECK (stock_nuevo >= 0),
    motivo VARCHAR(200) NOT NULL,
    proveedor VARCHAR(100),
    costo_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (costo_total >= 0),
    caja_movimiento_id INTEGER REFERENCES public.caja_movimientos(id),
    actor VARCHAR(100) NOT NULL,
    idempotency_key UUID NOT NULL UNIQUE,
    fecha TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventario_movimientos_producto_fecha
    ON public.inventario_movimientos (producto_id, fecha DESC);

CREATE OR REPLACE FUNCTION public.registrar_movimiento_inventario(
    p_producto_id INTEGER,
    p_variacion INTEGER,
    p_motivo TEXT,
    p_proveedor TEXT,
    p_precio_unitario NUMERIC,
    p_registrar_egreso BOOLEAN,
    p_idempotency_key UUID,
    p_actor TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_producto public.productos%ROWTYPE;
    v_caja public.cajas_diarias%ROWTYPE;
    v_movimiento_id BIGINT;
    v_caja_movimiento_id INTEGER;
    v_stock_anterior INTEGER;
    v_stock_nuevo INTEGER;
    v_costo_total NUMERIC(14,2) := 0;
BEGIN
    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'idempotency_key es obligatorio';
    END IF;

    SELECT id, stock_nuevo
      INTO v_movimiento_id, v_stock_nuevo
      FROM public.inventario_movimientos
     WHERE idempotency_key = p_idempotency_key;

    IF v_movimiento_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'movimiento_id', v_movimiento_id,
            'stock', v_stock_nuevo,
            'idempotent_replay', TRUE
        );
    END IF;

    IF p_producto_id IS NULL OR p_producto_id <= 0 OR p_variacion IS NULL OR p_variacion = 0 THEN
        RAISE EXCEPTION 'movimiento de inventario no valido';
    END IF;
    IF LENGTH(BTRIM(COALESCE(p_motivo, ''))) < 3 THEN
        RAISE EXCEPTION 'motivo obligatorio';
    END IF;
    IF LENGTH(BTRIM(COALESCE(p_actor, ''))) < 1 THEN
        RAISE EXCEPTION 'actor obligatorio';
    END IF;
    IF COALESCE(p_precio_unitario, 0) < 0 THEN
        RAISE EXCEPTION 'precio unitario no valido';
    END IF;
    IF p_registrar_egreso AND (p_variacion <= 0 OR COALESCE(p_precio_unitario, 0) <= 0) THEN
        RAISE EXCEPTION 'el egreso requiere una entrada con costo positivo';
    END IF;

    SELECT *
      INTO v_producto
      FROM public.productos
     WHERE id = p_producto_id
     FOR UPDATE;

    IF v_producto.id IS NULL THEN
        RAISE EXCEPTION 'producto no encontrado';
    END IF;

    v_stock_anterior := v_producto.stock;
    v_stock_nuevo := v_stock_anterior + p_variacion;
    IF v_stock_nuevo < 0 THEN
        RAISE EXCEPTION 'stock insuficiente';
    END IF;

    IF p_variacion > 0 THEN
        v_costo_total := ROUND(p_variacion * COALESCE(p_precio_unitario, 0), 2);
    END IF;

    IF p_registrar_egreso THEN
        SELECT *
          INTO v_caja
          FROM public.cajas_diarias
         WHERE estado = 'ABIERTA'
         ORDER BY id DESC
         LIMIT 1
         FOR UPDATE;

        IF v_caja.id IS NULL THEN
            RAISE EXCEPTION 'no hay una caja abierta';
        END IF;
        IF v_caja.saldo_actual < v_costo_total THEN
            RAISE EXCEPTION 'saldo de caja insuficiente';
        END IF;

        INSERT INTO public.caja_movimientos (
            caja_id, tipo, monto, descripcion, idempotency_key
        ) VALUES (
            v_caja.id,
            'EGRESO',
            v_costo_total,
            'Compra inventario: ' || v_producto.nombre,
            p_idempotency_key
        ) RETURNING id INTO v_caja_movimiento_id;

        UPDATE public.cajas_diarias
           SET saldo_actual = saldo_actual - v_costo_total
         WHERE id = v_caja.id;
    END IF;

    UPDATE public.productos
       SET stock = v_stock_nuevo,
           precio_compra = CASE
               WHEN p_variacion > 0 AND COALESCE(p_precio_unitario, 0) > 0
               THEN ROUND(p_precio_unitario, 2)
               ELSE precio_compra
           END
     WHERE id = p_producto_id;

    INSERT INTO public.inventario_movimientos (
        producto_id, variacion, stock_anterior, stock_nuevo, motivo,
        proveedor, costo_total, caja_movimiento_id, actor, idempotency_key
    ) VALUES (
        p_producto_id,
        p_variacion,
        v_stock_anterior,
        v_stock_nuevo,
        BTRIM(p_motivo),
        NULLIF(BTRIM(COALESCE(p_proveedor, '')), ''),
        v_costo_total,
        v_caja_movimiento_id,
        BTRIM(p_actor),
        p_idempotency_key
    ) RETURNING id INTO v_movimiento_id;

    RETURN jsonb_build_object(
        'movimiento_id', v_movimiento_id,
        'stock', v_stock_nuevo,
        'caja_movimiento_id', v_caja_movimiento_id,
        'idempotent_replay', FALSE
    );
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_movimiento_inventario(
    INTEGER, INTEGER, TEXT, TEXT, NUMERIC, BOOLEAN, UUID, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_movimiento_inventario(
    INTEGER, INTEGER, TEXT, TEXT, NUMERIC, BOOLEAN, UUID, TEXT
) TO service_role;
