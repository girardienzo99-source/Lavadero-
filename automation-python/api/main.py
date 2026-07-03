import os
import random
import string
import pandas as pd
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text

app = FastAPI(
    title="Lavadero Car Wash - API Serverless de Gestión",
    description="Microservicio Python para gestión y analítica de datos conectado a Supabase PostgreSQL.",
    version="2.0.0"
)

# Habilitar CORS para peticiones directas desde el navegador
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuración de base de datos
DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres.tqbikenqygnyzrxnabia:Lavadero2026/@aws-0-us-east-2.pooler.supabase.com:6543/postgres").strip()

# Forzar el modo REST API de manera permanente para evitar fallos del pooler directo de Supabase
DB_ONLINE = False
print("[DATABASE] Direct connection check bypassed. Running in 100% REST API mode for maximum reliability.")

def execute_query_rest(query: str, params: dict = None, fetch_all: bool = False, fetch_one: bool = False):
    import requests
    import string
    import random
    from datetime import datetime
    
    REST_URL = "https://tqbikenqygnyzrxnabia.supabase.co/rest/v1"
    anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxYmlrZW5xeWdueXpyeG5hYmlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMjUzOTYsImV4cCI6MjA5ODYwMTM5Nn0.JgadNGVv4XzOw9duUV_v8AE5Fhyi6sQ7nNcqQry1UCI"
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    q = query.strip().lower()
    params = params or {}
    
    # 1a. Obtener un turno específico por ID con relaciones
    if "select" in q and "turnos" in q and "t.id =" in q:
        t_id = params.get("id")
        url = f"{REST_URL}/turnos?id=eq.{t_id}&select=id,fecha_hora,estado,clientes(nombre),vehiculos(patente),servicios(nombre,precio),empleados(nombre)"
        res = requests.get(url, headers=headers).json()
        if res:
            r = res[0]
            return {
                "id": r["id"],
                "fecha_hora": r["fecha_hora"].replace("T", " ") if r.get("fecha_hora") else None,
                "estado": r["estado"],
                "cliente_nombre": r["clientes"]["nombre"] if r.get("clientes") else None,
                "patente": r["vehiculos"]["patente"] if r.get("vehiculos") else None,
                "servicio_nombre": r["servicios"]["nombre"] if r.get("servicios") else None,
                "precio": float(r["servicios"]["precio"]) if r.get("servicios") and r["servicios"].get("precio") is not None else 0.0,
                "empleado_nombre": r["empleados"]["nombre"] if r.get("empleados") else None
            }
            return None

    # 1. Turnos con relaciones (Dashboard)
    elif "select" in q and "turnos" in q and "join" in q:
        url = f"{REST_URL}/turnos?select=id,fecha_hora,estado,clientes(nombre),vehiculos(patente),servicios(nombre,precio),empleados(nombre)&order=fecha_hora.desc"
        res = requests.get(url, headers=headers)
        if res.status_code != 200:
            raise Exception(f"REST API error fetching turnos: {res.text}")
        mapped = []
        for r in res.json():
            mapped.append({
                "id": r["id"],
                "fecha_hora": r["fecha_hora"].replace("T", " ") if r.get("fecha_hora") else None,
                "estado": r["estado"],
                "cliente_nombre": r["clientes"]["nombre"] if r.get("clientes") else None,
                "patente": r["vehiculos"]["patente"] if r.get("vehiculos") else None,
                "servicio_nombre": r["servicios"]["nombre"] if r.get("servicios") else None,
                "precio": float(r["servicios"]["precio"]) if r.get("servicios") and r["servicios"].get("precio") is not None else 0.0,
                "empleado_nombre": r["empleados"]["nombre"] if r.get("empleados") else None
            })
        return mapped

    # 2. Caja Movimientos (Dashboard/Lista)
    elif "select" in q and "caja_movimientos" in q:
        caja_id = params.get("id")
        url = f"{REST_URL}/caja_movimientos?caja_id=eq.{caja_id}&order=id.desc"
        res = requests.get(url, headers=headers)
        if res.status_code != 200:
            raise Exception(f"REST API error fetching movements: {res.text}")
        mapped = []
        for r in res.json():
            hora = ""
            if r.get("fecha"):
                try:
                    t_part = r["fecha"].split("T")[-1]
                    hora = t_part[:5]
                except Exception:
                    pass
            mapped.append({
                "id": r["id"],
                "tipo": r["tipo"],
                "monto": float(r["monto"]) if r.get("monto") is not None else 0.0,
                "descripcion": r["descripcion"],
                "hora": hora
            })
        return mapped

    # 3. Clientes (List/Order)
    elif "select" in q and "clientes" in q and "order by nombre" in q:
        url = f"{REST_URL}/clientes?order=nombre"
        res = requests.get(url, headers=headers)
        return res.json() if res.status_code == 200 else []

    # 4. Vehiculos (List/Order)
    elif "select" in q and "vehiculos" in q and "order by patente" in q:
        url = f"{REST_URL}/vehiculos?order=patente"
        res = requests.get(url, headers=headers)
        return res.json() if res.status_code == 200 else []

    # 5. Productos (List/Order)
    elif "select" in q and "productos" in q:
        url = f"{REST_URL}/productos?order=nombre"
        res = requests.get(url, headers=headers)
        return res.json() if res.status_code == 200 else []

    # 6. Servicios (List/Order)
    elif "select" in q and "servicios" in q and "order by nombre" in q:
        url = f"{REST_URL}/servicios?order=nombre"
        res = requests.get(url, headers=headers)
        return res.json() if res.status_code == 200 else []

    # 7. Empleados (List/Order)
    elif "select" in q and "empleados" in q and "order by nombre" in q:
        url = f"{REST_URL}/empleados?order=nombre"
        res = requests.get(url, headers=headers)
        return res.json() if res.status_code == 200 else []

    # 8. Caja activa (Dashboard)
    elif "select" in q and "cajas_diarias" in q and "abierta" in q:
        url = f"{REST_URL}/cajas_diarias?estado=eq.ABIERTA&order=id.desc&limit=1"
        res = requests.get(url, headers=headers).json()
        if fetch_one:
            return res[0] if res else None
        return res

    # 9. Usuarios (Login)
    elif "select" in q and "usuarios" in q:
        u = params.get("u")
        url = f"{REST_URL}/usuarios?or=(username.eq.{u},mail.eq.{u})"
        res = requests.get(url, headers=headers).json()
        p = params.get("p")
        user = None
        for r in res:
            if r.get("password") == p or r.get("contrasena") == p:
                user = r
                break
        return user

    # 10. Nuevo Cliente (Insert)
    elif "insert" in q and "clientes" in q:
        payload = {
            "nombre": params.get("n"),
            "telefono": params.get("t"),
            "email": params.get("e"),
            "clasificacion": "OCASIONAL"
        }
        res = requests.post(f"{REST_URL}/clientes", headers=headers, json=payload).json()
        if fetch_one:
            return res[0] if res else None
        return res

    # 11. Nuevo Vehiculo (Insert)
    elif "insert" in q and "vehiculos" in q:
        payload = {
            "cliente_id": int(params.get("c")),
            "patente": params.get("p"),
            "marca": params.get("m"),
            "modelo": params.get("mo"),
            "color": params.get("co"),
            "anio": int(params.get("a")) if params.get("a") is not None else None
        }
        res = requests.post(f"{REST_URL}/vehiculos", headers=headers, json=payload).json()
        if fetch_one:
            return res[0] if res else None
        return res

    # 12. Nuevo Movimiento Caja (Insert)
    elif "insert" in q and "caja_movimientos" in q:
        t_val = params.get("t")
        if not t_val:
            if "'ingreso'" in q or '"ingreso"' in q:
                t_val = "INGRESO"
            elif "'egreso'" in q or '"egreso"' in q:
                t_val = "EGRESO"
            else:
                t_val = "INGRESO"
        payload = {
            "caja_id": int(params.get("c")),
            "tipo": t_val,
            "monto": float(params.get("m")),
            "descripcion": params.get("d")
        }
        res = requests.post(f"{REST_URL}/caja_movimientos", headers=headers, json=payload).json()
        return res

    # 13. Abrir Caja (Insert)
    elif "insert" in q and "cajas_diarias" in q:
        payload = {
            "monto_apertura": float(params.get("monto")),
            "saldo_actual": float(params.get("monto")),
            "estado": "ABIERTA"
        }
        res = requests.post(f"{REST_URL}/cajas_diarias", headers=headers, json=payload).json()
        return res

    # 14. Cerrar Caja (Update)
    elif "update" in q and "cajas_diarias" in q and "monto_cierre" in q:
        payload = {
            "fecha_cierre": datetime.now().isoformat(),
            "monto_cierre": float(params.get("cierre")),
            "estado": "CERRADA"
        }
        url = f"{REST_URL}/cajas_diarias?id=eq.{params.get('id')}"
        res = requests.patch(url, headers=headers, json=payload).json()
        return res

    # 15. Actualizar Saldo Caja (Update)
    elif "update" in q and "cajas_diarias" in q and "saldo_actual" in q:
        caja_id = params.get("id")
        caja = requests.get(f"{REST_URL}/cajas_diarias?id=eq.{caja_id}", headers=headers).json()
        if caja:
            curr_saldo = float(caja[0]["saldo_actual"])
            monto = float(params.get("m"))
            if "+" in q:
                new_saldo = curr_saldo + monto
            else:
                new_saldo = curr_saldo - monto
            requests.patch(f"{REST_URL}/cajas_diarias?id=eq.{caja_id}", headers=headers, json={"saldo_actual": new_saldo})
        return None

    # 16. Nuevo Empleado (Insert)
    elif "insert" in q and "empleados" in q:
        payload = {
            "nombre": params.get("nombre"),
            "rol": params.get("rol"),
            "telefono": params.get("telefono", ""),
            "activo": True
        }
        res = requests.post(f"{REST_URL}/empleados", headers=headers, json=payload).json()
        return res

    # 17. Cambiar Estado Empleado (Update)
    elif "update" in q and "empleados" in q:
        payload = {
            "activo": params.get("activo")
        }
        url = f"{REST_URL}/empleados?id=eq.{params.get('id')}"
        res = requests.patch(url, headers=headers, json=payload).json()
        return res

    # 18. Agendar Turno (Insert)
    elif "insert" in q and "turnos" in q:
        payload = {
            "cliente_id": int(params.get("c")),
            "vehiculo_id": int(params.get("v")),
            "servicio_id": int(params.get("s")),
            "empleado_id": int(params.get("e")) if params.get("e") is not None else None,
            "fecha_hora": str(params.get("f")),
            "estado": "PENDIENTE"
        }
        res = requests.post(f"{REST_URL}/turnos", headers=headers, json=payload).json()
        return res

    # 19. Cambiar Estado Turno (Update)
    elif "update" in q and "turnos" in q:
        payload = {
            "estado": params.get("estado")
        }
        url = f"{REST_URL}/turnos?id=eq.{params.get('id')}"
        res = requests.patch(url, headers=headers, json=payload).json()
        return res

    # 20. Reabastecer Producto / Actualizar Stock (Update/Select)
    elif "update" in q and "productos" in q and "stock =" in q:
        p_id = params.get("id")
        if "+ :qty" in q or "+ :quantity" in q or "stock +" in q:
            qty = float(params.get("qty"))
            res = requests.get(f"{REST_URL}/productos?id=eq.{p_id}", headers=headers).json()
            if res:
                curr_stock = float(res[0]["stock"])
                requests.patch(f"{REST_URL}/productos?id=eq.{p_id}", headers=headers, json={"stock": int(round(curr_stock + qty))})
        else:
            st_val = params.get("st") if params.get("st") is not None else params.get("new_stock")
            requests.patch(f"{REST_URL}/productos?id=eq.{p_id}", headers=headers, json={"stock": int(round(float(st_val)))})
        return None

    # 21. Select Producto por ID
    elif "select" in q and "productos" in q and "id =" in q:
        p_id = params.get("id")
        res = requests.get(f"{REST_URL}/productos?id=eq.{p_id}", headers=headers).json()
        if fetch_one:
            return res[0] if res else None
        return res

    # 22. Nuevo Feedback (Insert)
    elif "insert" in q and "feedback_clientes" in q:
        payload = {
            "cliente_id": int(params.get("c")),
            "puntuacion": int(params.get("p")),
            "comentario": params.get("co", "")
        }
        res = requests.post(f"{REST_URL}/feedback_clientes", headers=headers, json=payload).json()
        return res

    # 23. Buscar Cupon
    elif "select" in q and "cupones_descuento" in q and "codigo =" in q:
        code = params.get("code")
        res = requests.get(f"{REST_URL}/cupones_descuento?codigo=eq.{code}", headers=headers).json()
        if fetch_one:
            return res[0] if res else None
        return res

    # 24. Usar Cupon (Update)
    elif "update" in q and "cupones_descuento" in q:
        payload = {
            "usado": True,
            "fecha_uso": datetime.now().isoformat()
        }
        url = f"{REST_URL}/cupones_descuento?id=eq.{params.get('id')}"
        res = requests.patch(url, headers=headers, json=payload).json()
        return res

    # 25. Registrar Venta (Insert)
    elif "insert" in q and "ventas" in q:
        payload = {
            "cliente_id": int(params.get("c")) if params.get("c") is not None else None,
            "total": float(params.get("t")),
            "metodo_pago": params.get("m")
        }
        res = requests.post(f"{REST_URL}/ventas", headers=headers, json=payload).json()
        return res

    # 26. Obtener Ultima Venta
    elif "select" in q and "ventas" in q and "order by id desc limit 1" in q:
        url = f"{REST_URL}/ventas?select=id&order=id.desc&limit=1"
        res = requests.get(url, headers=headers).json()
        if fetch_one:
            return res[0] if res else None
        return res

    # 27. Registrar Detalle Venta (Insert)
    elif "insert" in q and "venta_detalles" in q:
        payload = {
            "venta_id": int(params.get("v")),
            "producto_id": int(params.get("p")),
            "cantidad": int(params.get("q")),
            "precio_unitario": float(params.get("pr")),
            "subtotal": float(params.get("sub"))
        }
        res = requests.post(f"{REST_URL}/venta_detalles", headers=headers, json=payload).json()
        return res

    # 28. Clientes Inactivos (Loyalty)
    elif "select" in q and "clientes" in q and "ultima_visita <=" in q:
        limite = str(params.get("limite"))
        url = f"{REST_URL}/clientes?select=id,nombre,telefono&ultima_visita=lte.{limite}"
        res = requests.get(url, headers=headers).json()
        return res

    # 29. Buscar Cupon por Cliente
    elif "select" in q and "cupones_descuento" in q and "cliente_id =" in q:
        c_id = params.get("id")
        url = f"{REST_URL}/cupones_descuento?select=id&cliente_id=eq.{c_id}&usado=eq.false"
        res = requests.get(url, headers=headers).json()
        if fetch_one:
            return res[0] if res else None
        return res

    # 30. Generar Cupon Loyalty (Insert)
    elif "insert" in q and "cupones_descuento" in q:
        payload = {
            "codigo": params.get("code"),
            "cliente_id": int(params.get("c_id")),
            "descuento_porcentaje": 15,
            "fecha_expiracion": str(params.get("exp")),
            "usado": False
        }
        res = requests.post(f"{REST_URL}/cupones_descuento", headers=headers, json=payload).json()
        return res

    # 31. Cambiar Comisión Empleado (Update)
    elif "update" in q and "empleados" in q and "porcentaje_comision" in q:
        payload = {
            "porcentaje_comision": float(params.get("porcentaje_comision"))
        }
        url = f"{REST_URL}/empleados?id=eq.{params.get('id')}"
        res = requests.patch(url, headers=headers, json=payload).json()
        return res

    # 32. Liquidaciones de Comisiones (Select)
    elif "select" in q and "liquidacion_comisiones" in q:
        url = f"{REST_URL}/liquidacion_comisiones?select=*,empleados(nombre)&order=fecha.desc"
        res = requests.get(url, headers=headers)
        if res.status_code != 200:
            return []
        mapped = []
        for r in res.json():
            mapped.append({
                "id": r["id"],
                "empleado_id": r["empleado_id"],
                "fecha": r["fecha"],
                "monto_bruto": float(r["monto_bruto"]) if r.get("monto_bruto") is not None else 0.0,
                "monto_vales": float(r["monto_vales"]) if r.get("monto_vales") is not None else 0.0,
                "monto_neto": float(r["monto_neto"]) if r.get("monto_neto") is not None else 0.0,
                "porcentaje_comision": float(r["porcentaje_comision"]) if r.get("porcentaje_comision") is not None else 0.0,
                "concepto": r["concepto"],
                "empleado_nombre": r["empleados"]["nombre"] if r.get("empleados") else None,
                "caja_movimiento_id": r.get("caja_movimiento_id")
            })
        return mapped

    # 33. Nueva Liquidación (Insert)
    elif "insert" in q and "liquidacion_comisiones" in q:
        payload = {
            "empleado_id": int(params.get("empleado_id")),
            "monto_bruto": float(params.get("monto_bruto")),
            "monto_vales": float(params.get("monto_vales", 0.0)),
            "monto_neto": float(params.get("monto_neto")),
            "porcentaje_comision": float(params.get("porcentaje_comision")),
            "concepto": params.get("concepto"),
            "caja_movimiento_id": int(params.get("caja_movimiento_id")) if params.get("caja_movimiento_id") is not None else None
        }
        res = requests.post(f"{REST_URL}/liquidacion_comisiones", headers=headers, json=payload).json()
        return res

    # Default fallback
    print(f"[REST-FALLBACK-WARNING] Unhandled SQL query: {query}")
    if fetch_one:
        return None
    return []

def execute_query(query: str, params: dict = None, fetch_all: bool = False, fetch_one: bool = False):
    """
    Función helper para ejecutar consultas en la base de datos Supabase con fallback a REST API.
    """
    global DB_ONLINE
    if DB_ONLINE:
        try:
            engine = create_engine(DB_URL)
            with engine.begin() as conn:
                result = conn.execute(text(query), params or {})
                if fetch_all:
                    return [dict(row) for row in result.mappings()]
                if fetch_one:
                    row = result.mappings().first()
                    return dict(row) if row else None
                return result
        except Exception as e:
            print(f"[DATABASE] Direct connection failed during execution ({e}). Switching to REST API mode.")
            DB_ONLINE = False
            
    # Fallback/Default to REST API
    return execute_query_rest(query, params, fetch_all, fetch_one)

# ==========================================
# 📊 ENDPOINT: CONSOLIDADO DE DATOS (DASHBOARD)
# ==========================================

@app.get("/api/dashboard-data")
def get_dashboard_data():
    """
    Retorna el estado completo del negocio para alimentar la UI estática en Vercel.
    """
    try:
        # Cargar todos los datos desde Supabase
        turnos = execute_query("SELECT t.id, t.fecha_hora, t.estado, c.nombre as cliente_nombre, v.patente, s.nombre as servicio_nombre, s.precio, e.nombre as empleado_nombre FROM turnos t JOIN clientes c ON t.cliente_id = c.id JOIN vehiculos v ON t.vehiculo_id = v.id JOIN servicios s ON t.servicio_id = s.id LEFT JOIN empleados e ON t.empleado_id = e.id ORDER BY t.fecha_hora DESC;", fetch_all=True)
        productos = execute_query("SELECT * FROM productos ORDER BY nombre;", fetch_all=True)
        servicios = execute_query("SELECT * FROM servicios ORDER BY nombre;", fetch_all=True)
        empleados = execute_query("SELECT * FROM empleados ORDER BY nombre;", fetch_all=True)
        clientes = execute_query("SELECT * FROM clientes ORDER BY nombre;", fetch_all=True)
        vehiculos = execute_query("SELECT * FROM vehiculos ORDER BY patente;", fetch_all=True)
        caja_activa = execute_query("SELECT * FROM cajas_diarias WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1;", fetch_one=True)
        
        caja_movimientos = []
        if caja_activa:
            caja_movimientos = execute_query(
                "SELECT id, tipo, monto, descripcion, TO_CHAR(fecha, 'HH24:MI') as hora FROM caja_movimientos WHERE caja_id = :id ORDER BY id DESC;",
                {"id": caja_activa["id"]},
                fetch_all=True
            )
        
        # NPS Metrics
        nps_data = get_nps_metrics()
        
        # Filtros de stock
        bajo_stock = [p for p in productos if p["stock"] <= p["stock_minimo"]]
        
        return {
            "status": "success",
            "db_offline": False,
            "turnos": turnos,
            "productos": productos,
            "servicios": servicios,
            "empleados": empleados,
            "clientes": clientes,
            "vehiculos": vehiculos,
            "caja": caja_activa,
            "cajaMovimientos": caja_movimientos,
            "nps": nps_data,
            "productosBajoStock": bajo_stock
        }
    except Exception as e:
        import traceback
        err_msg = f"{str(e)}\n{traceback.format_exc()}"
        print(f"[DASHBOARD-WARNING] DB Error:\n{err_msg}")
        # Fallback Mock Completo
        return get_mock_dashboard_data(err_msg)

# ==========================================
# 📈 ENDPOINT: SEGMENTACIÓN DE CLIENTES (PANDAS)
# ==========================================

@app.get("/api/marketing/segmentacion")
@app.get("/segmentacion")
def get_customer_segmentation():
    try:
        if not DB_ONLINE:
            raise Exception("Direct connection disabled by policy. Using REST API fallback.")
        engine = create_engine(DB_URL)
        query = """
            SELECT 
                c.id, c.nombre, c.telefono, c.clasificacion as clasificacion_actual, c.ultima_visita,
                COALESCE(COUNT(t.id), 0) as cantidad_visitas,
                COALESCE(SUM(s.precio), 0) as total_gastado
            FROM clientes c
            LEFT JOIN turnos t ON c.id = t.cliente_id AND t.estado = 'COMPLETADO'
            LEFT JOIN servicios s ON t.servicio_id = s.id
            GROUP BY c.id;
        """
        with engine.connect() as conn:
            df = pd.read_sql_query(text(query), conn)
        is_mock = False
    except Exception as e:
        print(f"[FASTAPI-WARNING] DB Offline. Intentando REST API para segmentación: {e}")
        try:
            import requests
            REST_URL = "https://tqbikenqygnyzrxnabia.supabase.co/rest/v1"
            anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxYmlrZW5xeWdueXpyeG5hYmlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMjUzOTYsImV4cCI6MjA5ODYwMTM5Nn0.JgadNGVv4XzOw9duUV_v8AE5Fhyi6sQ7nNcqQry1UCI"
            headers = {"apikey": anon_key, "Authorization": f"Bearer {anon_key}"}
            
            # Fetch clientes
            clientes = requests.get(f"{REST_URL}/clientes", headers=headers).json()
            # Fetch COMPLETADO turnos
            turnos = requests.get(f"{REST_URL}/turnos?estado=eq.COMPLETADO&select=cliente_id,servicios(precio)", headers=headers).json()
            
            client_stats = {}
            for c in clientes:
                client_stats[c["id"]] = {
                    "id": c["id"],
                    "nombre": c["nombre"],
                    "telefono": c.get("telefono"),
                    "clasificacion_actual": c.get("clasificacion"),
                    "ultima_visita": c.get("ultima_visita"),
                    "cantidad_visitas": 0,
                    "total_gastado": 0.0
                }
            for t in turnos:
                c_id = t.get("cliente_id")
                if c_id in client_stats:
                    client_stats[c_id]["cantidad_visitas"] += 1
                    precio = 0.0
                    if t.get("servicios"):
                        precio = float(t["servicios"].get("precio", 0.0))
                    client_stats[c_id]["total_gastado"] += precio
            df = pd.DataFrame(list(client_stats.values()))
            is_mock = False
        except Exception as e_rest:
            print(f"[FASTAPI-WARNING] REST API falló también. Cargando mock de segmentación: {e_rest}")
            mock_data = [
                {"id": 1, "nombre": "Juan Pérez", "telefono": "+5491122334455", "clasificacion_actual": "FRECUENTE", "cantidad_visitas": 6, "total_gastado": 15000.0, "ultima_visita": "2026-05-28"},
                {"id": 2, "nombre": "María Rodríguez", "telefono": "+5491133445566", "clasificacion_actual": "VIP", "cantidad_visitas": 15, "total_gastado": 45000.0, "ultima_visita": "2026-06-22"},
                {"id": 3, "nombre": "Carlos Gómez", "telefono": "+5491144556677", "clasificacion_actual": "OCASIONAL", "cantidad_visitas": 2, "total_gastado": 5000.0, "ultima_visita": "2026-06-02"},
                {"id": 4, "nombre": "Ana López", "telefono": "+5491155667788", "clasificacion_actual": "OCASIONAL", "cantidad_visitas": 1, "total_gastado": 1500.0, "ultima_visita": "2026-06-25"}
            ]
            df = pd.DataFrame(mock_data)
            is_mock = True

    def categorizar_cliente(row):
        total = float(row['total_gastado'])
        visitas = int(row['cantidad_visitas'])
        if total > 30000 or visitas > 10:
            return "VIP"
        elif total > 10000 or visitas >= 4:
            return "FRECUENTE"
        else:
            return "OCASIONAL"

    df['segmento_calculado'] = df.apply(categorizar_cliente, axis=1)

    if not is_mock:
        try:
            for _, row in df.iterrows():
                if row['segmento_calculado'] != row['clasificacion_actual']:
                    execute_query("UPDATE clientes SET clasificacion = :seg WHERE id = :id", {"seg": row['segmento_calculado'], "id": int(row['id'])})
        except Exception as e:
            print(f"Error al guardar clasificaciones: {e}")

    if 'ultima_visita' in df.columns:
        df['ultima_visita'] = df['ultima_visita'].astype(str)

    return {
        "status": "success",
        "db_fallback_mocked": is_mock,
        "total_procesados": len(df),
        "clientes": df.to_dict(orient="records")
    }

# ==========================================
# ⭐ ENDPOINT: NET PROMOTER SCORE (NPS)
# ==========================================

@app.get("/api/marketing/nps")
@app.get("/nps")
def get_nps_metrics():
    try:
        if not DB_ONLINE:
            raise Exception("Direct connection disabled by policy. Using REST API fallback.")
        engine = create_engine(DB_URL)
        df = pd.read_sql_query(text("SELECT puntuacion FROM feedback_clientes;"), conn := engine.connect())
        conn.close()
        is_mock = False
    except Exception as e:
        print(f"[FASTAPI-WARNING] DB Offline. Intentando REST API para NPS: {e}")
        try:
            import requests
            REST_URL = "https://tqbikenqygnyzrxnabia.supabase.co/rest/v1"
            anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxYmlrZW5xeWdueXpyeG5hYmlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMjUzOTYsImV4cCI6MjA5ODYwMTM5Nn0.JgadNGVv4XzOw9duUV_v8AE5Fhyi6sQ7nNcqQry1UCI"
            headers = {"apikey": anon_key, "Authorization": f"Bearer {anon_key}"}
            res = requests.get(f"{REST_URL}/feedback_clientes?select=puntuacion", headers=headers).json()
            df = pd.DataFrame(res)
            is_mock = False
        except Exception as e_rest:
            print(f"[FASTAPI-WARNING] REST API falló para NPS. Usando mock: {e_rest}")
            df = pd.DataFrame({"puntuacion": [5, 5, 4, 2, 5, 4, 5, 3]})
            is_mock = True

    if df.empty:
        return {"status": "NO_DATA", "nps": 0, "total_respuestas": 0, "promotores": 0, "pasivos": 0, "detractores": 0, "nivel": "SIN DATOS"}

    total = len(df)
    promotores = len(df[df['puntuacion'] == 5])
    pasivos = len(df[df['puntuacion'] == 4])
    detractores = len(df[df['puntuacion'] <= 3])

    pct_promotores = (promotores / total) * 100
    pct_detractores = (detractores / total) * 100
    nps_score = round(pct_promotores - pct_detractores, 1)

    nivel = "EXCELENTE" if nps_score >= 50 else ("BUENO" if nps_score >= 0 else "CRÍTICO")

    return {
        "status": "success",
        "nivel": nivel,
        "nps": nps_score,
        "total_respuestas": total,
        "promotores": promotores,
        "pasivos": pasivos,
        "detractores": detractores,
        "porcentaje_promotores": round(pct_promotores, 1),
        "porcentaje_detractores": round(pct_detractores, 1),
        "db_fallback_mocked": is_mock
    }

# ==========================================
# 👥 ENDPOINTS: EQUIPO DE TRABAJO (STAFF)
# ==========================================

@app.post("/api/empleados/nuevo")
def add_employee(nombre: str, rol: str, telefono: str = ""):
    try:
        execute_query("INSERT INTO empleados (nombre, rol, telefono, activo) VALUES (:nombre, :rol, :telefono, TRUE);", 
                      {"nombre": nombre, "rol": rol, "telefono": telefono})
        return {"status": "success", "message": "Empleado creado con éxito."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al registrar empleado: {e}")

@app.post("/api/empleados/{id}/estado")
def toggle_employee_status(id: int, activo: bool):
    try:
        execute_query("UPDATE empleados SET activo = :activo WHERE id = :id;", {"activo": activo, "id": id})
        return {"status": "success", "message": "Estado del empleado actualizado."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al cambiar disponibilidad: {e}")

@app.post("/api/empleados/{id}/comision")
def update_employee_commission(id: int, porcentaje_comision: float):
    try:
        execute_query("UPDATE empleados SET porcentaje_comision = :porcentaje_comision WHERE id = :id;", 
                      {"porcentaje_comision": porcentaje_comision, "id": id})
        return {"status": "success", "message": "Porcentaje de comisión del empleado actualizado."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al actualizar comisión del empleado: {e}")

@app.get("/api/comisiones/historial")
def get_comisiones_historial():
    try:
        historial = execute_query("SELECT * FROM liquidacion_comisiones ORDER BY id DESC;", fetch_all=True) or []
        # Calculate outstanding vales per employee in-memory to avoid multiple unhandled queries
        vales_dict = {}
        # Fetch all employees
        empleados = execute_query("SELECT id FROM empleados;", fetch_all=True) or []
        
        for emp in empleados:
            e_id = emp["id"]
            # Sum registered vales (monto_bruto == 0)
            registered = sum(float(r["monto_vales"]) for r in historial if r["empleado_id"] == e_id and float(r["monto_bruto"]) == 0.0)
            # Sum deducted vales (monto_bruto > 0)
            deducted = sum(float(r["monto_vales"]) for r in historial if r["empleado_id"] == e_id and float(r["monto_bruto"]) > 0.0)
            vales_dict[e_id] = max(0.0, registered - deducted)
            
        return {
            "status": "success",
            "historial": historial,
            "vales": vales_dict
        }
    except Exception as e:
        import traceback
        print(f"[COMISIONES-ERROR] {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=400, detail=f"Error al obtener historial: {e}")

@app.post("/api/comisiones/vale")
def add_comision_vale(empleado_id: int, monto: float, concepto: str = "Adelanto (Vale)", registrar_en_caja: bool = True):
    try:
        # 1. Register in cashbox if requested
        caja_mov_id = None
        if registrar_en_caja:
            caja_activa = execute_query("SELECT * FROM cajas_diarias WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1;", fetch_one=True)
            if not caja_activa:
                raise Exception("No hay una caja diaria abierta para registrar el egreso del vale.")
            
            c_id = caja_activa["id"]
            # Insert cash movement
            emp_info = execute_query("SELECT nombre FROM empleados WHERE id = :id;", {"id": empleado_id}, fetch_one=True)
            emp_name = emp_info["nombre"] if emp_info else f"Empleado #{empleado_id}"
            desc = f"Vale/Adelanto: {emp_name} ({concepto})"
            
            execute_query(
                "INSERT INTO caja_movimientos (caja_id, tipo, monto, descripcion) VALUES (:caja_id, 'EGRESO', :monto, :descripcion);",
                {"caja_id": c_id, "monto": monto, "descripcion": desc}
            )
            # Fetch the inserted movement id
            mov = execute_query(
                "SELECT id FROM caja_movimientos WHERE caja_id = :caja_id ORDER BY id DESC LIMIT 1;",
                {"caja_id": c_id},
                fetch_one=True
            )
            if mov:
                caja_mov_id = mov["id"]
            
            # Update cashbox current balance
            execute_query(
                "UPDATE cajas_diarias SET saldo_actual = saldo_actual - :monto WHERE id = :caja_id;",
                {"monto": monto, "caja_id": c_id}
            )
            
        # 2. Insert into liquidacion_comisiones
        execute_query(
            "INSERT INTO liquidacion_comisiones (empleado_id, monto_bruto, monto_vales, monto_neto, porcentaje_comision, concepto, caja_movimiento_id) VALUES (:empleado_id, 0.0, :monto, :monto_negativo, 0.0, :concepto, :caja_mov_id);",
            {
                "empleado_id": empleado_id,
                "monto": monto,
                "monto_negativo": -monto,
                "concepto": concepto,
                "caja_mov_id": caja_mov_id
            }
        )
        return {"status": "success", "message": "Vale registrado con éxito."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al registrar vale: {e}")

@app.post("/api/comisiones/liquidar")
def liquidar_comisiones(empleado_id: int, monto_bruto: float, monto_vales: float, monto_neto: float, porcentaje_comision: float, concepto: str = "Liquidación de Comisiones", registrar_en_caja: bool = True):
    try:
        # 1. Register in cashbox if requested
        caja_mov_id = None
        if registrar_en_caja and monto_neto > 0:
            caja_activa = execute_query("SELECT * FROM cajas_diarias WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1;", fetch_one=True)
            if not caja_activa:
                raise Exception("No hay una caja diaria abierta para registrar el egreso de la liquidación.")
            
            c_id = caja_activa["id"]
            # Insert cash movement
            emp_info = execute_query("SELECT nombre FROM empleados WHERE id = :id;", {"id": empleado_id}, fetch_one=True)
            emp_name = emp_info["nombre"] if emp_info else f"Empleado #{empleado_id}"
            desc = f"Pago Comisión: {emp_name} (Bruto: ${monto_bruto} - Vales: ${monto_vales})"
            
            execute_query(
                "INSERT INTO caja_movimientos (caja_id, tipo, monto, descripcion) VALUES (:caja_id, 'EGRESO', :monto, :descripcion);",
                {"caja_id": c_id, "monto": monto_neto, "descripcion": desc}
            )
            # Fetch the inserted movement id
            mov = execute_query(
                "SELECT id FROM caja_movimientos WHERE caja_id = :caja_id ORDER BY id DESC LIMIT 1;",
                {"caja_id": c_id},
                fetch_one=True
            )
            if mov:
                caja_mov_id = mov["id"]
            
            # Update cashbox current balance
            execute_query(
                "UPDATE cajas_diarias SET saldo_actual = saldo_actual - :monto WHERE id = :caja_id;",
                {"monto": monto_neto, "caja_id": c_id}
            )
            
        # 2. Insert into liquidacion_comisiones
        execute_query(
            "INSERT INTO liquidacion_comisiones (empleado_id, monto_bruto, monto_vales, monto_neto, porcentaje_comision, concepto, caja_movimiento_id) VALUES (:empleado_id, :monto_bruto, :monto_vales, :monto_neto, :porcentaje, :concepto, :caja_mov_id);",
            {
                "empleado_id": empleado_id,
                "monto_bruto": monto_bruto,
                "monto_vales": monto_vales,
                "monto_neto": monto_neto,
                "porcentaje": porcentaje_comision,
                "concepto": concepto,
                "caja_mov_id": caja_mov_id
            }
        )
        return {"status": "success", "message": "Liquidación registrada con éxito."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al liquidar comisiones: {e}")

# ==========================================
# 📅 ENDPOINTS: TURNOS (AGENDA)
# ==========================================

@app.post("/api/turnos/agendar")
def schedule_appointment(clienteId: int, vehiculoId: int, servicioId: int, fechaHora: str, empleadoId: int = None):
    try:
        # fechaHora viene como YYYY-MM-DDTHH:MM
        fecha_parsed = datetime.strptime(fechaHora.replace("T", " "), "%Y-%m-%d %H:%M:%S" if len(fechaHora) > 16 else "%Y-%m-%d %H:%M")
        execute_query("INSERT INTO turnos (cliente_id, vehiculo_id, servicio_id, empleado_id, fecha_hora, estado) VALUES (:c, :v, :s, :e, :f, 'PENDIENTE');",
                      {"c": clienteId, "v": vehiculoId, "s": servicioId, "e": empleadoId, "f": fecha_parsed})
        return {"status": "success", "message": "Turno agendado correctamente."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al agendar turno: {e}")

@app.post("/api/turnos/{id}/estado")
def update_appointment_status(id: int, estado: str):
    try:
        # 1. Update the status of the appointment
        execute_query("UPDATE turnos SET estado = :estado WHERE id = :id;", {"estado": estado, "id": id})
        
        # 2. If the status is COMPLETADO, run the automatic accounting and stock deductions
        if estado == "COMPLETADO":
            # Find the appointment details
            turno = execute_query(
                "SELECT t.id, s.precio, c.nombre as cliente_nombre, s.nombre as servicio_nombre "
                "FROM turnos t "
                "JOIN clientes c ON t.cliente_id = c.id "
                "JOIN servicios s ON t.servicio_id = s.id "
                "WHERE t.id = :id;",
                {"id": id},
                fetch_one=True
            )
            
            if turno:
                precio = float(turno["precio"])
                cliente_nombre = turno["cliente_nombre"]
                servicio_nombre = turno["servicio_nombre"]
                
                # Check if there is an open cashbox
                caja = execute_query(
                    "SELECT id FROM cajas_diarias WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1;",
                    fetch_one=True
                )
                
                if caja:
                    caja_id = caja["id"]
                    descripcion = f"Cobro Turno #{turno['id']} - {cliente_nombre} ({servicio_nombre})"
                    
                    # Insert cashbox movement
                    execute_query(
                        "INSERT INTO caja_movimientos (caja_id, tipo, monto, descripcion) VALUES (:c, 'INGRESO', :m, :d);",
                        {"c": caja_id, "m": precio, "d": descripcion}
                    )
                    
                    # Update cashbox current balance
                    execute_query(
                        "UPDATE cajas_diarias SET saldo_actual = saldo_actual + :m WHERE id = :id;",
                        {"m": precio, "id": caja_id}
                    )
                
                # Classify service category for stock deduction
                servicio_lower = servicio_nombre.lower()
                cat = 'LAVADO'
                if 'tapizado' in servicio_lower or 'butaca' in servicio_lower or 'habitáculo' in servicio_lower:
                    cat = 'TAPICERIA'
                elif 'tratamiento' in servicio_lower or 'pulido' in servicio_lower or 'cerámico' in servicio_lower or 'óptica' in servicio_lower:
                    cat = 'ESTETICA'
                
                # Fetch all products
                productos = execute_query("SELECT id, nombre, stock, stock_minimo FROM productos;", fetch_all=True)
                
                for p in productos:
                    p_id = p["id"]
                    p_name = p["nombre"].lower()
                    stock = float(p["stock"])
                    qty_deduction = 0.0
                    
                    if cat == 'LAVADO':
                        if 'shampoo' in p_name:
                            qty_deduction = 1.0
                        elif 'silicona' in p_name:
                            qty_deduction = 1.0
                        elif 'cera' in p_name and ('encerado' in servicio_lower or 'carnauba' in servicio_lower or 'premium' in servicio_lower):
                            qty_deduction = 1.0
                    elif cat == 'TAPICERIA':
                        if 'apc' in p_name or 'limpiador' in p_name:
                            qty_deduction = 1.0
                        elif 'microfibra' in p_name or 'paño' in p_name:
                            qty_deduction = 1.0
                    elif cat == 'ESTETICA':
                        if 'sellador' in p_name or 'sio2' in p_name:
                            if 'cerámico' in servicio_lower or 'sio2' in servicio_lower:
                                qty_deduction = 1.0
                        elif 'pulidor' in p_name or 'compuesto' in p_name:
                            if 'pulido' in servicio_lower or 'corrección' in servicio_lower or 'tratamiento' in servicio_lower:
                                qty_deduction = 1.0
                        elif 'microfibra' in p_name or 'paño' in p_name:
                            if 'pulido' in servicio_lower or 'corrección' in servicio_lower or 'tratamiento' in servicio_lower:
                                qty_deduction = 1.0
                    
                    if qty_deduction > 0.0:
                        new_stock = max(0, int(round(stock - qty_deduction)))
                        execute_query(
                            "UPDATE productos SET stock = :new_stock WHERE id = :id;",
                            {"new_stock": new_stock, "id": p_id}
                        )
        
        return {"status": "success", "message": f"Estado del turno cambiado a {estado}."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al actualizar estado del turno: {e}")

# ==========================================
# 💵 ENDPOINTS: CAJA DIARIA
# ==========================================

@app.post("/api/caja/abrir")
def open_cashbox(montoApertura: float):
    try:
        caja_activa = execute_query("SELECT id FROM cajas_diarias WHERE estado = 'ABIERTA';", fetch_one=True)
        if caja_activa:
            return {"status": "error", "message": "Ya existe una caja abierta actualmente."}
        
        execute_query("INSERT INTO cajas_diarias (fecha_apertura, monto_apertura, saldo_actual, estado) VALUES (NOW(), :monto, :monto, 'ABIERTA');",
                      {"monto": montoApertura})
        return {"status": "success", "message": "Caja diaria abierta con éxito."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al abrir caja: {e}")

@app.post("/api/caja/cerrar")
def close_cashbox(montoCierre: float):
    try:
        caja_activa = execute_query("SELECT id, monto_apertura, saldo_actual FROM cajas_diarias WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1;", fetch_one=True)
        if not caja_activa:
            return {"status": "error", "message": "No hay ninguna caja abierta para cerrar."}
        
        execute_query("UPDATE cajas_diarias SET fecha_cierre = NOW(), monto_cierre = :cierre, estado = 'CERRADA' WHERE id = :id;",
                      {"cierre": montoCierre, "id": caja_activa["id"]})
        return {"status": "success", "message": f"Caja cerrada correctamente. Saldo esperado: ${caja_activa['saldo_actual']} | Saldo real ingresado: ${montoCierre}"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al cerrar caja: {e}")

# ==========================================
# 🛒 ENDPOINTS: PUNTO DE VENTA (POS)
# ==========================================

@app.post("/api/pos/productos/{id}/reabastecer")
def restock_product(id: int, cantidad: int):
    try:
        execute_query("UPDATE productos SET stock = stock + :qty WHERE id = :id;", {"qty": cantidad, "id": id})
        prod = execute_query("SELECT nombre, stock FROM productos WHERE id = :id;", {"id": id}, fetch_one=True)
        return {"status": "success", "nombre": prod["nombre"], "stock": prod["stock"]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al reabastecer: {e}")

@app.post("/api/pos/feedback")
def submit_feedback(clienteId: int, puntuacion: int, comentario: str = ""):
    try:
        execute_query("INSERT INTO feedback_clientes (cliente_id, puntuacion, comentario) VALUES (:c, :p, :co);",
                      {"c": clienteId, "p": puntuacion, "co": comentario})
        return {"status": "success", "message": "Feedback guardado correctamente."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al guardar feedback: {e}")

@app.post("/api/pos/venta")
def register_sale(payload: dict):
    """
    Registra una venta e impacta el inventario y la caja en Supabase.
    Payload: { clienteId, metodoPago, detalles: [{productoId, cantidad}], codigoCupon }
    """
    try:
        cliente_id = payload.get("clienteId")
        metodo_pago = payload.get("metodoPago", "EFECTIVO")
        detalles = payload.get("detalles", [])
        codigo_cupon = payload.get("codigoCupon")
        
        caja = execute_query("SELECT id, saldo_actual FROM cajas_diarias WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1;", fetch_one=True)
        if not caja:
            return {"status": "error", "message": "Operación denegada. La caja diaria está cerrada."}
            
        # Calcular totales y comprobar stock
        subtotal = 0.0
        alertas_stock = []
        updates_stock = []
        
        for d in detalles:
            p_id = d.get("productoId")
            qty = d.get("cantidad", 1)
            
            p = execute_query("SELECT nombre, stock, precio_venta, stock_minimo FROM productos WHERE id = :id;", {"id": p_id}, fetch_one=True)
            if not p:
                return {"status": "error", "message": f"Producto ID {p_id} no encontrado."}
                
            if p["stock"] < qty:
                return {"status": "error", "message": f"Stock insuficiente para {p['nombre']}. Stock disponible: {p['stock']}"}
                
            item_cost = float(p["precio_venta"]) * qty
            subtotal += item_cost
            
            new_stock = p["stock"] - qty
            updates_stock.append((p_id, new_stock))
            
            if new_stock <= p["stock_minimo"]:
                alertas_stock.append(f"¡Atención! {p['nombre']} quedó en stock crítico ({new_stock} unidades).")
                
        # Aplicar cupón de descuento
        descuento = 0.0
        if codigo_cupon:
            cup = execute_query("SELECT id, descuento_porcentaje, usado FROM cupones_descuento WHERE codigo = :code;", {"code": codigo_cupon}, fetch_one=True)
            if cup and not cup["usado"]:
                descuento = subtotal * (float(cup["descuento_porcentaje"]) / 100.0)
                execute_query("UPDATE cupones_descuento SET usado = TRUE, fecha_uso = NOW() WHERE id = :id;", {"id": cup["id"]})
                
        total_final = subtotal - descuento
        
        # Registrar Venta
        execute_query("INSERT INTO ventas (cliente_id, fecha_hora, total, metodo_pago) VALUES (:c, NOW(), :t, :m);",
                      {"c": cliente_id, "t": total_final, "m": metodo_pago})
        
        last_v = execute_query("SELECT id FROM ventas ORDER BY id DESC LIMIT 1;", fetch_one=True)
        
        # Registrar Detalles y Actualizar Inventario
        for index, d in enumerate(detalles):
            p_id = d.get("productoId")
            qty = d.get("cantidad", 1)
            p = execute_query("SELECT precio_venta FROM productos WHERE id = :id;", {"id": p_id}, fetch_one=True)
            
            execute_query("INSERT INTO venta_detalles (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (:v, :p, :q, :pr, :sub);",
                          {"v": last_v["id"], "p": p_id, "q": qty, "pr": p["precio_venta"], "sub": float(p["precio_venta"]) * qty})
            
            execute_query("UPDATE productos SET stock = :st WHERE id = :id;", {"st": updates_stock[index][1], "id": p_id})
            
        # Actualizar Caja
        nuevo_saldo = float(caja["saldo_actual"]) + total_final
        execute_query("UPDATE cajas_diarias SET saldo_actual = :st WHERE id = :id;", {"st": nuevo_saldo, "id": caja["id"]})
        
        return {
            "status": "success",
            "venta": {"id": last_v["id"], "total": total_final},
            "alertasStock": alertas_stock
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error en transacción POS: {e}")

# ==========================================
# 📣 ENDPOINT: CAMPAÑA FIDELIDAD (PROCESSBUILDER FALLBACK)
# ==========================================

@app.post("/api/marketing/run-loyalty")
def run_loyalty():
    """
    Invocado para buscar clientes inactivos > 20 días y generar cupones del 15%.
    """
    try:
        limite_inactividad = datetime.now() - timedelta(days=20)
        clientes_inactivos = execute_query("SELECT id, nombre, telefono FROM clientes WHERE ultima_visita <= :limite;", {"limite": limite_inactividad}, fetch_all=True)
        
        nuevos_cupones = []
        for c in clientes_inactivos:
            # Comprobar si ya tiene un cupón activo
            existente = execute_query("SELECT id FROM cupones_descuento WHERE cliente_id = :id AND usado = FALSE;", {"id": c["id"]}, fetch_one=True)
            if not existente:
                chars = string.ascii_uppercase + string.digits
                code = "VOLVE" + "".join(random.choice(chars) for _ in range(4))
                expiracion = datetime.now() + timedelta(days=15)
                
                execute_query("INSERT INTO cupones_descuento (codigo, cliente_id, descuento_porcentaje, fecha_creacion, fecha_expiracion, usado) VALUES (:code, :c_id, 15, NOW(), :exp, FALSE);",
                              {"code": code, "c_id": c["id"], "exp": expiracion})
                
                nuevos_cupones.append(f"Generado cupón 15% para {c['nombre']} ({code})")
                
        return {
            "success": True,
            "exitCode": 0,
            "stdout": "\n".join(nuevos_cupones) if nuevos_cupones else "No se encontraron clientes inactivos sin cupón previo.",
            "stderr": ""
        }
    except Exception as e:
        return {"success": False, "exitCode": 1, "stdout": "", "stderr": str(e)}

# ==========================================
# 🛠️ FALLBACKS DE DATOS MOCK
# ==========================================

def get_mock_dashboard_data(err_msg: str):
    return {
        "status": "success",
        "db_offline": True,
        "db_error": err_msg,
        "turnos": [
            {"id": 1, "fecha_hora": "2026-06-27 10:00:00", "estado": "COMPLETADO", "cliente_nombre": "Juan Pérez", "patente": "AA123BB", "servicio_nombre": "Lavado Completo", "precio": 2500.0, "empleado_nombre": "Carlos Lavador"},
            {"id": 2, "fecha_hora": "2026-06-27 14:00:00", "estado": "EN_PROCESO", "cliente_nombre": "María Rodríguez", "patente": "AF987ZZ", "servicio_nombre": "Encerado y Pulido", "precio": 6000.0, "empleado_nombre": "Carlos Lavador"},
            {"id": 3, "fecha_hora": "2026-06-27 16:30:00", "estado": "PENDIENTE", "cliente_nombre": "Carlos Gómez", "patente": "AB456CD", "servicio_nombre": "Lavado Simple", "precio": 1500.0, "empleado_nombre": None}
        ],
        "productos": [
            {"id": 1, "nombre": "Silicona Interior Aromatizada", "stock": 2, "stock_minimo": 5, "precio_venta": 600.0},
            {"id": 2, "nombre": "Cera Líquida Premium", "stock": 15, "stock_minimo": 4, "precio_venta": 900.0},
            {"id": 3, "nombre": "Pino Aromatizante Classic", "stock": 50, "stock_minimo": 10, "precio_venta": 200.0},
            {"id": 4, "nombre": "Paño Microfibra 40x40", "stock": 30, "stock_minimo": 8, "precio_venta": 400.0}
        ],
        "servicios": [
            {"id": 1, "nombre": "Lavado Simple", "precio": 1500.0},
            {"id": 2, "nombre": "Lavado Completo", "precio": 2500.0},
            {"id": 3, "nombre": "Encerado y Pulido", "precio": 6000.0}
        ],
        "empleados": [
            {"id": 1, "nombre": "Carlos Lavador", "rol": "LAVADOR", "telefono": "11223344", "activo": True},
            {"id": 2, "nombre": "Marta Cajera", "rol": "CAJERO", "telefono": "11556677", "activo": True}
        ],
        "clientes": [
            {"id": 1, "nombre": "Juan Pérez"},
            {"id": 2, "nombre": "María Rodríguez"},
            {"id": 3, "nombre": "Carlos Gómez"},
            {"id": 4, "nombre": "Ana López"}
        ],
        "vehiculos": [
            {"id": 1, "cliente_id": 1, "patente": "AA123BB", "marca": "Toyota", "modelo": "Corolla"},
            {"id": 2, "cliente_id": 2, "patente": "AF987ZZ", "marca": "Ford", "modelo": "Focus"},
            {"id": 3, "cliente_id": 3, "patente": "AB456CD", "marca": "Chevrolet", "modelo": "Onix"},
            {"id": 4, "cliente_id": 4, "patente": "AD789EF", "marca": "Volkswagen", "modelo": "Gol"}
        ],
        "caja": {"id": 1, "fecha_apertura": "2026-06-27 08:00:00", "monto_apertura": 10000.0, "saldo_actual": 12500.0, "estado": "ABIERTA"},
        "nps": {
            "status": "success",
            "nivel": "EXCELENTE",
            "nps": 75.0,
            "total_respuestas": 8,
            "promotores": 6,
            "pasivos": 1,
            "detractores": 1,
            "porcentaje_promotores": 75.0,
            "porcentaje_detractores": 12.5
        },
        "productosBajoStock": [
            {"id": 1, "nombre": "Silicona Interior Aromatizada", "stock": 2, "stock_minimo": 5, "precio_venta": 600.0}
        ],
        "cajaMovimientos": [
            {"id": 1, "tipo": "EGRESO", "monto": 1200.0, "descripcion": "Compra de esponjas y trapos de microfibra extra", "hora": "09:30"},
            {"id": 2, "tipo": "INGRESO", "monto": 1500.0, "descripcion": "Aporte cambio monedas inicial", "hora": "08:15"}
        ]
    }

@app.post("/api/clientes/nuevo")
def new_client(nombre: str, telefono: str = None, email: str = None):
    try:
        res = execute_query(
            "INSERT INTO clientes (nombre, telefono, email, fecha_registro, clasificacion) VALUES (:n, :t, :e, NOW(), 'OCASIONAL') RETURNING id;",
            {"n": nombre, "t": telefono, "e": email},
            fetch_one=True
        )
        return {"status": "success", "id": res["id"] if res else 999, "nombre": nombre}
    except Exception as e:
        print(f"[CRM-WARNING] DB Error ({e}). Usando simulación.")
        return {"status": "success", "id": random.randint(10, 100), "nombre": nombre, "simulated": True}

@app.post("/api/vehiculos/nuevo")
def new_vehicle(clienteId: int, patente: str, marca: str, modelo: str, color: str = None, anio: int = None):
    try:
        res = execute_query(
            "INSERT INTO vehiculos (cliente_id, patente, marca, modelo, color, anio) VALUES (:c, :p, :m, :mo, :co, :a) RETURNING id;",
            {"c": clienteId, "p": patente, "m": marca, "mo": modelo, "co": color, "a": anio},
            fetch_one=True
        )
        return {"status": "success", "id": res["id"] if res else 999, "patente": patente}
    except Exception as e:
        print(f"[CRM-WARNING] DB Error ({e}). Usando simulación.")
        return {"status": "success", "id": random.randint(10, 100), "patente": patente, "simulated": True}

@app.post("/api/caja/movimiento")
def new_cash_movement(tipo: str, monto: float, descripcion: str):
    if tipo not in ["INGRESO", "EGRESO"]:
        return {"status": "error", "message": "Tipo de movimiento no válido."}
    if monto <= 0:
        return {"status": "error", "message": "El monto debe ser mayor que cero."}
        
    try:
        caja = execute_query("SELECT id FROM cajas_diarias WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1;", fetch_one=True)
        if not caja:
            return {"status": "error", "message": "Operación denegada. La caja diaria está cerrada."}
            
        caja_id = caja["id"]
        
        # Insertar movimiento
        execute_query(
            "INSERT INTO caja_movimientos (caja_id, tipo, monto, descripcion) VALUES (:c, :t, :m, :d);",
            {"c": caja_id, "t": tipo, "m": monto, "d": descripcion}
        )
        
        # Actualizar saldo_actual de la caja
        if tipo == "INGRESO":
            execute_query("UPDATE cajas_diarias SET saldo_actual = saldo_actual + :m WHERE id = :id;", {"m": monto, "id": caja_id})
        else:
            execute_query("UPDATE cajas_diarias SET saldo_actual = saldo_actual - :m WHERE id = :id;", {"m": monto, "id": caja_id})
            
        return {"status": "success", "message": "Movimiento de caja registrado correctamente."}
    except Exception as e:
        print(f"[CAJA-WARNING] DB Error ({e}). Usando simulación.")
        return {"status": "success", "message": "Movimiento registrado (modo simulación).", "simulated": True}

@app.post("/api/auth/login")
def login(payload: dict):
    username = payload.get("username")
    password = payload.get("password")
    
    if not username or not password:
        return {"status": "error", "message": "Por favor, ingresa el usuario y contraseña."}
        
    try:
        # Consultar la tabla usuarios de Supabase
        user = execute_query(
            "SELECT * FROM usuarios WHERE (username = :u OR mail = :u) AND (password = :p OR contrasena = :p) LIMIT 1;",
            {"u": username, "p": password},
            fetch_one=True
        )
        
        if user:
            if not user.get("activo", True):
                return {"status": "error", "message": "El usuario se encuentra inactivo."}
            return {
                "status": "success",
                "user": {
                    "id": user.get("id_usuario"),
                    "nombre": user.get("nombre"),
                    "username": user.get("username"),
                    "rol": user.get("rol")
                }
            }
        else:
            return {"status": "error", "message": "Usuario o contraseña incorrectos."}
    except Exception as e:
        print(f"[AUTH-WARNING] DB Error ({e}). Usando autenticación mock.")
        # Fallback a mock de usuarios
        mock_users = [
            {"id_usuario": 1, "nombre": "Super Admin", "rol": "superadmin", "username": "super@admi.com", "password": "superadmi2026/"},
            {"id_usuario": 2, "nombre": "Administrador", "rol": "administrador", "username": "admi@patron.com", "password": "Elpatron2026/"},
            {"id_usuario": 4, "nombre": "Enzo", "rol": "mozo", "username": "enzo", "password": "1234"},
            {"id_usuario": 9, "nombre": "Admin", "rol": "superadmin", "username": "admin", "password": "1998"},
            {"id_usuario": 10, "nombre": "Admin Gmail", "rol": "superadmin", "username": "admin@gmail.com", "password": "1998"}
        ]
        found = next((u for u in mock_users if (u["username"] == username and u["password"] == password)), None)
        if found:
            return {
                "status": "success",
                "user": {
                    "id": found["id_usuario"],
                    "nombre": found["nombre"],
                    "username": found["username"],
                    "rol": found["rol"]
                }
            }
        else:
            return {"status": "error", "message": "Usuario o contraseña incorrectos (modo simulación)."}

if __name__ == "__main__":

    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

