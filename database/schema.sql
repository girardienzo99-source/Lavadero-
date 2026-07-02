-- Schema para el Sistema de Gestión y Ventas del Lavadero de Autos (Car Wash)
-- Base de Datos recomendada: PostgreSQL (Supabase)

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla de Empleados
CREATE TABLE empleados (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    rol VARCHAR(50) NOT NULL, -- 'ADMINISTRADOR', 'CAJERO', 'LAVADOR'
    telefono VARCHAR(20),
    activo BOOLEAN DEFAULT TRUE,
    fecha_contratacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Clientes
CREATE TABLE clientes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    clasificacion VARCHAR(20) DEFAULT 'OCASIONAL', -- 'VIP', 'FRECUENTE', 'OCASIONAL'
    ultima_visita TIMESTAMP
);

-- 3. Tabla de Vehículos
CREATE TABLE vehiculos (
    id SERIAL PRIMARY KEY,
    cliente_id INT REFERENCES clientes(id) ON DELETE CASCADE,
    patente VARCHAR(15) UNIQUE NOT NULL, -- Patente / Placa del vehículo
    marca VARCHAR(50),
    modelo VARCHAR(50),
    color VARCHAR(30),
    anio INT
);

-- 4. Tabla de Servicios Ofrecidos
CREATE TABLE servicios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL, -- 'Lavado Simple', 'Lavado Completo', etc.
    descripcion TEXT,
    precio NUMERIC(10, 2) NOT NULL,
    duracion_minutos INT NOT NULL -- Duración estimada en minutos
);

-- 5. Tabla de Turnos / Reservas
CREATE TABLE turnos (
    id SERIAL PRIMARY KEY,
    cliente_id INT REFERENCES clientes(id) ON DELETE CASCADE,
    vehiculo_id INT REFERENCES vehiculos(id) ON DELETE CASCADE,
    servicio_id INT REFERENCES servicios(id),
    empleado_id INT REFERENCES empleados(id) ON DELETE SET NULL,
    fecha_hora TIMESTAMP NOT NULL,
    estado VARCHAR(20) DEFAULT 'PENDIENTE', -- 'PENDIENTE', 'COMPLETADO', 'CANCELADO', 'EN_PROGRESO'
    observaciones TEXT
);

-- 6. Tabla de Productos (Stock e Inventario)
CREATE TABLE productos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    descripcion TEXT,
    stock INT NOT NULL DEFAULT 0,
    stock_minimo INT NOT NULL DEFAULT 5, -- Alerta de bajo stock
    precio_compra NUMERIC(10, 2) NOT NULL,
    precio_venta NUMERIC(10, 2) NOT NULL
);

-- 7. Tabla de Cajas Diarias (Control de Caja)
CREATE TABLE cajas_diarias (
    id SERIAL PRIMARY KEY,
    fecha_apertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre TIMESTAMP,
    monto_apertura NUMERIC(10, 2) NOT NULL,
    monto_cierre NUMERIC(10, 2),
    saldo_actual NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    estado VARCHAR(15) DEFAULT 'ABIERTA', -- 'ABIERTA', 'CERRADA'
    observaciones TEXT
);

-- 8. Tabla de Ventas / Facturación
CREATE TABLE ventas (
    id SERIAL PRIMARY KEY,
    caja_id INT REFERENCES cajas_diarias(id),
    cliente_id INT REFERENCES clientes(id) ON DELETE SET NULL,
    fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    metodo_pago VARCHAR(30) NOT NULL, -- 'EFECTIVO', 'TARJETA', 'TRANSFERENCIA'
    estado VARCHAR(20) DEFAULT 'COMPLETADA' -- 'COMPLETADA', 'ANULADA'
);

-- 9. Detalle de Ventas (Servicios y/o Productos)
CREATE TABLE venta_detalles (
    id SERIAL PRIMARY KEY,
    venta_id INT REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id INT REFERENCES productos(id) ON DELETE SET NULL,
    servicio_id INT REFERENCES servicios(id) ON DELETE SET NULL,
    cantidad INT NOT NULL DEFAULT 1,
    precio_unitario NUMERIC(10, 2) NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL,
    -- Restricción para asegurar que el detalle corresponda a un producto o un servicio, pero no a ninguno
    CONSTRAINT chk_detalle_tipo CHECK (
        (producto_id IS NOT NULL AND servicio_id IS NULL) OR 
        (producto_id IS NULL AND servicio_id IS NOT NULL)
    )
);

-- 10. Tabla de Cupones de Descuento (Fidelización)
CREATE TABLE cupones_descuento (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(30) UNIQUE NOT NULL,
    cliente_id INT REFERENCES clientes(id) ON DELETE CASCADE,
    descuento_porcentaje INT NOT NULL CHECK (descuento_porcentaje > 0 AND descuento_porcentaje <= 100),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_expiracion TIMESTAMP NOT NULL,
    usado BOOLEAN DEFAULT FALSE,
    fecha_uso TIMESTAMP
);

-- 11. Tabla de Feedback y NPS (Satisfacción de Clientes)
CREATE TABLE feedback_clientes (
    id SERIAL PRIMARY KEY,
    cliente_id INT REFERENCES clientes(id) ON DELETE CASCADE,
    puntuacion INT NOT NULL CHECK (puntuacion >= 1 AND puntuacion <= 5),
    comentario TEXT,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. Tabla de Libro Contable de Caja (Ingresos / Egresos Manuales)
CREATE TABLE caja_movimientos (
    id SERIAL PRIMARY KEY,
    caja_id INT REFERENCES cajas_diarias(id) ON DELETE CASCADE,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('INGRESO', 'EGRESO')),
    monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),
    descripcion VARCHAR(200) NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. Tabla de Usuarios (Autenticación y Roles)
CREATE TABLE usuarios (
    id_usuario SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) DEFAULT '',
    rol VARCHAR(50) NOT NULL,
    pin VARCHAR(10) DEFAULT NULL,
    activo BOOLEAN DEFAULT TRUE,
    mail VARCHAR(150) DEFAULT NULL,
    contrasena VARCHAR(150) DEFAULT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(150) NOT NULL
);

-- Índices recomendados para optimización
CREATE INDEX idx_turnos_fecha ON turnos(fecha_hora);
CREATE INDEX idx_clientes_ultima_visita ON clientes(ultima_visita);
CREATE INDEX idx_ventas_fecha ON ventas(fecha_hora);
CREATE INDEX idx_productos_stock ON productos(stock);

-- ============================================================================
-- Datos Semilla (Seed Data)
-- ============================================================================

INSERT INTO servicios (nombre, descripcion, precio, duracion_minutos) VALUES
('Lavado Simple', 'Lavado de carrocería exterior y aspirado básico.', 1500.00, 30),
('Lavado Completo', 'Lavado exterior, aspirado profundo, siliconas y perfume.', 2500.00, 50),
('Lavado de Motor', 'Limpieza a presión del motor con desengrasantes especiales.', 3500.00, 45),
('Limpieza de Tapizados', 'Limpieza profunda húmeda de asientos y alfombras.', 8000.00, 180),
('Encerado y Pulido', 'Tratamiento de abrillantado y protección de pintura.', 6000.00, 90);

INSERT INTO productos (nombre, descripcion, stock, stock_minimo, precio_compra, precio_venta) VALUES
('Silicona Interior Aromatizada', 'Perfuma e hidrata plásticos del auto', 20, 5, 300.00, 600.00),
('Cera Líquida Premium', 'Cera rápida protectora de carrocería', 15, 4, 450.00, 900.00),
('Pino Aromatizante Classic', 'Aromatizante colgante clásico', 50, 10, 80.00, 200.00),
('Paño Microfibra 40x40', 'Paño ultra absorbente para secado', 30, 8, 150.00, 400.00);

INSERT INTO clientes (nombre, telefono, email, fecha_registro, clasificacion, ultima_visita) VALUES
('Juan Pérez', '+5491122334455', 'juan.perez@email.com', CURRENT_TIMESTAMP - INTERVAL '30 days', 'FRECUENTE', CURRENT_TIMESTAMP - INTERVAL '30 days'),
('María Rodríguez', '+5491133445566', 'maria.rod@email.com', CURRENT_TIMESTAMP - INTERVAL '5 days', 'VIP', CURRENT_TIMESTAMP - INTERVAL '5 days'),
('Carlos Gómez', '+5491144556677', 'carlos@email.com', CURRENT_TIMESTAMP - INTERVAL '45 days', 'OCASIONAL', CURRENT_TIMESTAMP - INTERVAL '25 days'),
('Ana López', '+5491155667788', 'ana.lopez@email.com', CURRENT_TIMESTAMP - INTERVAL '2 days', 'OCASIONAL', CURRENT_TIMESTAMP - INTERVAL '2 days');

INSERT INTO vehiculos (cliente_id, patente, marca, modelo, color, anio) VALUES
(1, 'AA123BB', 'Toyota', 'Corolla', 'Gris', 2018),
(2, 'AF987ZZ', 'Ford', 'Focus', 'Blanco', 2021),
(3, 'AB456CD', 'Chevrolet', 'Onix', 'Negro', 2019),
(4, 'AD789EF', 'Volkswagen', 'Gol Trend', 'Rojo', 2020);

INSERT INTO feedback_clientes (cliente_id, puntuacion, comentario) VALUES
(1, 5, 'Excelente servicio de aspirado profundo y atencion muy atenta.'),
(2, 5, 'El pulido y encerado quedo increible, muy recomendable!'),
(3, 4, 'Buen lavado rapido, pero tardaron un poco mas de lo acordado.'),
(4, 2, 'No secaron bien las llantas, hay detalles para mejorar.');

-- Insertar caja activa de demostración
INSERT INTO cajas_diarias (id, fecha_apertura, monto_apertura, saldo_actual, estado) VALUES
(1, CURRENT_TIMESTAMP - INTERVAL '12 hours', 10000.00, 10300.00, 'ABIERTA');

-- Insertar movimientos para esa caja activa
INSERT INTO caja_movimientos (caja_id, tipo, monto, descripcion) VALUES
(1, 'EGRESO', 1200.00, 'Compra de esponjas y trapos de microfibra extra'),
(1, 'INGRESO', 1500.00, 'Aporte cambio monedas inicial');

-- Insertar usuarios predeterminados (incluyendo admin/1998)
INSERT INTO usuarios (nombre, apellido, rol, pin, activo, mail, contrasena, username, password) VALUES
('Super Admin', '', 'superadmin', '1234', TRUE, 'super@admi.com', 'superadmi2026/', 'super@admi.com', 'superadmi2026/'),
('Administrador', '', 'administrador', '1234', TRUE, 'admi@patron.com', 'Elpatron2026/', 'admi@patron.com', 'Elpatron2026/'),
('Mozo', '', 'mozo', NULL, TRUE, NULL, NULL, 'mozo@patron.com', 'Elpatronmozo2026/'),
('Enzo', 'Fernández', 'mozo', NULL, TRUE, NULL, NULL, 'enzo', '1234'),
('Micaela', 'Gómez', 'mozo', NULL, TRUE, NULL, NULL, 'micaela', '1234'),
('Damián', 'Martínez', 'cocina', NULL, TRUE, NULL, NULL, 'damian', '1234'),
('Sofía', 'Alegre', 'administrador', NULL, TRUE, NULL, NULL, 'sofia', '1234'),
('Nuevo', 'Usuario', 'mozo', NULL, TRUE, NULL, NULL, 'nuevo', 'clave'),
('Admin', '', 'superadmin', NULL, TRUE, NULL, NULL, 'admin', '1998'),
('Admin Gmail', '', 'superadmin', NULL, TRUE, 'admin@gmail.com', '1998', 'admin@gmail.com', '1998');


-- Sincronizar secuencias
SELECT setval('servicios_id_seq', (SELECT MAX(id) FROM servicios));
SELECT setval('productos_id_seq', (SELECT MAX(id) FROM productos));
SELECT setval('clientes_id_seq', (SELECT MAX(id) FROM clientes));
SELECT setval('vehiculos_id_seq', (SELECT MAX(id) FROM vehiculos));
SELECT setval('feedback_clientes_id_seq', (SELECT MAX(id) FROM feedback_clientes));
SELECT setval('cajas_diarias_id_seq', (SELECT MAX(id) FROM cajas_diarias));
SELECT setval('caja_movimientos_id_seq', (SELECT MAX(id) FROM caja_movimientos));
SELECT setval('usuarios_id_usuario_seq', (SELECT MAX(id_usuario) FROM usuarios));
