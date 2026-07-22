import os
import random
import string
import hmac
import base64
import binascii
import hashlib
import json
import re
import time
import uuid
import sys
from pathlib import Path
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import pandas as pd
import requests
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, status, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import create_engine, text

# Permite ejecutar este módulo directamente en pruebas y también desde api/index.py.
AUTOMATION_ROOT = str(Path(__file__).resolve().parents[1])
if AUTOMATION_ROOT not in sys.path:
    sys.path.insert(0, AUTOMATION_ROOT)

from api.arca_client import (
    ArcaConfig,
    ArcaError,
    ArcaTransportError,
    WsmtxcaClient,
    build_qr_url,
)
from api.fiscal_service import (
    FiscalServiceConfig,
    FiscalValidationError,
    issue_invoice_c as issue_invoice_c_service,
)

IS_PRODUCTION = os.getenv("VERCEL_ENV", "").lower() == "production"

app = FastAPI(
    title="Lavadero Car Wash - API Serverless de Gestión",
    description="Microservicio Python para gestión y analítica de datos conectado a Supabase PostgreSQL.",
    version="2.1.0",
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)

SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", "28800"))
APP_SESSION_SECRET = os.getenv("APP_SESSION_SECRET", "").strip()
MAX_REQUEST_BYTES = int(os.getenv("MAX_REQUEST_BYTES", "1048576"))
LOGIN_WINDOW_SECONDS = int(os.getenv("LOGIN_WINDOW_SECONDS", "900"))
LOGIN_MAX_ATTEMPTS = int(os.getenv("LOGIN_MAX_ATTEMPTS", "5"))
SESSION_ALLOWED_ROLES = {"superadmin", "administrador", "admin", "cajero", "operario", "lavador"}
_login_attempts: dict[str, list[float]] = {}


def _apply_security_headers(response, request_id: str, path: str):
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
    if IS_PRODUCTION:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    if path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


def _secure_json_response(status_code: int, content: dict, request_id: str, path: str):
    return _apply_security_headers(
        JSONResponse(status_code=status_code, content=content), request_id, path
    )


def _login_client_key(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
    return forwarded_for or (request.client.host if request.client else "unknown")


def _login_retry_after(client_key: str, now: float | None = None) -> int:
    current_time = now if now is not None else time.time()
    valid_attempts = [
        timestamp
        for timestamp in _login_attempts.get(client_key, [])
        if current_time - timestamp < LOGIN_WINDOW_SECONDS
    ]
    _login_attempts[client_key] = valid_attempts
    if len(valid_attempts) < LOGIN_MAX_ATTEMPTS:
        return 0
    return max(1, int(LOGIN_WINDOW_SECONDS - (current_time - valid_attempts[0])))


def _record_login_failure(client_key: str):
    _login_attempts.setdefault(client_key, []).append(time.time())


def _clear_login_failures(client_key: str):
    _login_attempts.pop(client_key, None)


def _b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def create_session_token(user: dict) -> tuple[str, int]:
    if len(APP_SESSION_SECRET) < 32:
        raise RuntimeError("APP_SESSION_SECRET debe tener al menos 32 caracteres.")

    subject = str(user.get("id_usuario") or user.get("id") or "").strip()
    role = str(user.get("rol") or "").lower().strip()
    if not subject or role not in SESSION_ALLOWED_ROLES:
        raise ValueError("El usuario no tiene un perfil de sesión válido.")

    expires_at = int(time.time()) + SESSION_TTL_SECONDS
    payload = {
        "sub": subject,
        "name": str(user.get("nombre") or "Usuario"),
        "role": role,
        "exp": expires_at,
        "iat": int(time.time()),
    }
    encoded_payload = _b64url_encode(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    signature = hmac.new(
        APP_SESSION_SECRET.encode("utf-8"),
        encoded_payload.encode("ascii"),
        hashlib.sha256,
    ).digest()
    return f"{encoded_payload}.{_b64url_encode(signature)}", expires_at


def verify_session_token(token: str) -> dict:
    if len(APP_SESSION_SECRET) < 32:
        raise ValueError("El servicio de sesiones no está configurado.")
    if not token or len(token) > 4096:
        raise ValueError("Sesión inválida.")

    try:
        encoded_payload, encoded_signature = token.split(".", 1)
        expected_signature = hmac.new(
            APP_SESSION_SECRET.encode("utf-8"),
            encoded_payload.encode("ascii"),
            hashlib.sha256,
        ).digest()
        provided_signature = _b64url_decode(encoded_signature)
        if not hmac.compare_digest(expected_signature, provided_signature):
            raise ValueError("Firma inválida.")
        payload = json.loads(_b64url_decode(encoded_payload))
        now = int(time.time())
        if int(payload.get("exp", 0)) <= now:
            raise ValueError("Sesión vencida.")
        if int(payload.get("iat", 0)) > now + 60:
            raise ValueError("Fecha de sesión inválida.")
        if not str(payload.get("sub") or "").strip():
            raise ValueError("Sujeto de sesión inválido.")
        if str(payload.get("role") or "").lower() not in SESSION_ALLOWED_ROLES:
            raise ValueError("Rol de sesión inválido.")
        return payload
    except (ValueError, TypeError, json.JSONDecodeError) as exc:
        raise ValueError("Sesión inválida o vencida.") from exc


@app.middleware("http")
async def secure_internal_api(request: Request, call_next):
    path = request.url.path
    public_paths = {"/api/auth/login", "/api/health"}
    request_id = str(uuid.uuid4())
    started_at = time.perf_counter()

    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_REQUEST_BYTES:
                return _secure_json_response(
                    status.HTTP_413_CONTENT_TOO_LARGE,
                    {"status": "error", "message": "La solicitud supera el tamaño permitido."},
                    request_id,
                    path,
                )
        except ValueError:
            return _secure_json_response(
                status.HTTP_400_BAD_REQUEST,
                {"status": "error", "message": "Content-Length no válido."},
                request_id,
                path,
            )

    if path.startswith("/api/") and path not in public_paths and request.method != "OPTIONS":
        authorization = request.headers.get("authorization", "")
        if not authorization.startswith("Bearer "):
            return _secure_json_response(
                status.HTTP_401_UNAUTHORIZED,
                {"status": "error", "message": "Sesión requerida."},
                request_id,
                path,
            )

        try:
            claims = verify_session_token(authorization[7:].strip())
        except ValueError:
            return _secure_json_response(
                status.HTTP_401_UNAUTHORIZED,
                {"status": "error", "message": "La sesión venció o no es válida."},
                request_id,
                path,
            )

        request.state.session = claims
        role = str(claims.get("role", "")).lower()
        manager_roles = {"superadmin", "administrador", "admin"}
        financial_roles = manager_roles | {"cajero"}
        operational_roles = financial_roles | {"operario"}

        if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            if path.startswith(("/api/empleados", "/api/comisiones", "/api/marketing/run-loyalty", "/api/inventario")) and role not in manager_roles:
                return _secure_json_response(
                    status.HTTP_403_FORBIDDEN,
                    {"status": "error", "message": "No tenés permisos para esta operación."},
                    request_id,
                    path,
                )
            if path.startswith(("/api/caja", "/api/pos", "/api/facturacion")) and role not in financial_roles:
                return _secure_json_response(
                    status.HTTP_403_FORBIDDEN,
                    {"status": "error", "message": "La operación requiere permisos de caja."},
                    request_id,
                    path,
                )
            manages_schedule_or_customers = (
                path == "/api/turnos"
                or path.startswith(("/api/clientes", "/api/vehiculos"))
                or path.endswith("/reprogramaciones")
                or "legacy-disabled" in path
            )
            if manages_schedule_or_customers and role not in operational_roles:
                return _secure_json_response(
                    status.HTTP_403_FORBIDDEN,
                    {"status": "error", "message": "La operación requiere permisos de recepción."},
                    request_id,
                    path,
                )

    response = await call_next(request)
    duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
    if request.method in {"POST", "PUT", "PATCH", "DELETE"} and path.startswith("/api/"):
        session = getattr(request.state, "session", {})
        print(json.dumps({
            "event": "api_mutation",
            "request_id": request_id,
            "user_id": session.get("sub"),
            "role": session.get("role"),
            "method": request.method,
            "path": path,
            "status": response.status_code,
            "duration_ms": duration_ms,
        }, ensure_ascii=False))
    return _apply_security_headers(response, request_id, path)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "lavadero-api"}


@app.get("/api/readiness")
def readiness_check():
    """Estado operativo sin exponer valores de configuración ni secretos."""
    checks = {
        "sessionSecret": len(APP_SESSION_SECRET) >= 32,
        "supabasePublic": bool(SUPABASE_URL and SUPABASE_ANON_KEY),
        "supabasePrivate": bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY),
        "transactionalMigrations": bool(SUPABASE_SERVICE_ROLE_KEY),
        "fiscalConnector": False,
    }
    try:
        checks["fiscalConnector"] = bool(_arca_configuration_status()["ready"])
    except NameError:
        checks["fiscalConnector"] = False
    return {
        "status": "ready" if all(checks.values()) else "degraded",
        "checks": checks,
    }

# Limitar CORS a los orígenes configurados.
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "https://lavadero-sigma.vercel.app").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuración de base de datos
DB_URL = os.getenv("DATABASE_URL", "").strip()
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = (
    os.getenv("SUPABASE_ANON_KEY", "").strip()
    or os.getenv("SUPABASE_PUBLISHABLE_KEY", "").strip()
)
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
ARCA_ENVIRONMENT = os.getenv("ARCA_ENVIRONMENT", "homologacion").strip().lower()
ARCA_CUIT = re.sub(r"\D", "", os.getenv("ARCA_CUIT", ""))
ARCA_POINT_OF_SALE = os.getenv("ARCA_POINT_OF_SALE", "").strip()
ARCA_CERTIFICATE_B64 = os.getenv("ARCA_CERTIFICATE_B64", "").strip()
ARCA_PRIVATE_KEY_B64 = os.getenv("ARCA_PRIVATE_KEY_B64", "").strip()
ARCA_BUSINESS_NAME = os.getenv("ARCA_BUSINESS_NAME", "").strip()
ARCA_BUSINESS_ADDRESS = os.getenv("ARCA_BUSINESS_ADDRESS", "").strip()
ARCA_GROSS_INCOME = os.getenv("ARCA_GROSS_INCOME", "").strip()
ARCA_ACTIVITY_START_DATE = os.getenv("ARCA_ACTIVITY_START_DATE", "").strip()
ARCA_TAX_CONDITION = os.getenv("ARCA_TAX_CONDITION", "Monotributo").strip()
ARCA_CONNECTOR_ENABLED = os.getenv("ARCA_CONNECTOR_ENABLED", "false").strip().lower() == "true"
ARCA_CONCEPT_CODE = os.getenv("ARCA_CONCEPT_CODE", "").strip()
ARCA_ITEM_VAT_CODE = os.getenv("ARCA_ITEM_VAT_CODE", "").strip()
ARCA_RECIPIENT_VAT_CODE = os.getenv("ARCA_RECIPIENT_VAT_CODE", "").strip()
ARCA_UNIT_CODE = os.getenv("ARCA_UNIT_CODE", "").strip()
ALLOW_LEGACY_AUTH = os.getenv("ALLOW_LEGACY_AUTH", "true").strip().lower() == "true"


def require_supabase_config():
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise RuntimeError(
            "Faltan SUPABASE_URL y SUPABASE_ANON_KEY (o SUPABASE_PUBLISHABLE_KEY)."
        )


def rest_request(method: str, url: str, **kwargs):
    kwargs.setdefault("timeout", 15)
    response = requests.request(method, url, **kwargs)
    response.raise_for_status()
    return response


def require_service_role():
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="La operación requiere configurar la conexión privada de Supabase.",
        )


def service_role_headers(prefer: str | None = None) -> dict:
    require_service_role()
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


def call_service_rpc(name: str, payload: dict) -> object:
    response = rest_request(
        "POST",
        f"{SUPABASE_URL}/rest/v1/rpc/{name}",
        headers=service_role_headers(),
        json=payload,
    )
    return response.json()

# Forzar el modo REST API de manera permanente para evitar fallos del pooler directo de Supabase
DB_ONLINE = False
print("[DATABASE] Direct connection check bypassed. Running in 100% REST API mode for maximum reliability.")

def execute_query_rest(query: str, params: dict = None, fetch_all: bool = False, fetch_one: bool = False):
    import requests
    import string
    import random
    from datetime import datetime
    
    require_supabase_config()
    REST_URL = f"{SUPABASE_URL}/rest/v1"
    backend_key = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY
    headers = {
        "apikey": backend_key,
        "Authorization": f"Bearer {backend_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    q = query.strip().lower()
    params = params or {}
    
    # 1a. Obtener un turno específico por ID con relaciones
    if "select" in q and "turnos" in q and "t.id =" in q:
        t_id = params.get("id")
        url = f"{REST_URL}/turnos?id=eq.{t_id}&select=id,fecha_hora,estado,clientes(nombre),vehiculos(patente),servicios(nombre,precio),empleados(nombre)"
        res = rest_request("GET", url, headers=headers).json()
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
        res = rest_request("GET", url, headers=headers)
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
        res = rest_request("GET", url, headers=headers)
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
                "hora": hora,
                "fecha": r.get("fecha"),
                "metodo_pago": r.get("metodo_pago"),
                "origen": r.get("origen"),
                "turno_id": r.get("turno_id")
            })
        return mapped

    # 3. Clientes (List/Order)
    elif "select" in q and "clientes" in q and "order by nombre" in q:
        url = f"{REST_URL}/clientes?order=nombre"
        res = rest_request("GET", url, headers=headers)
        return res.json() if res.status_code == 200 else []

    # 4. Vehiculos (List/Order)
    elif "select" in q and "vehiculos" in q and "order by patente" in q:
        url = f"{REST_URL}/vehiculos?order=patente"
        res = rest_request("GET", url, headers=headers)
        return res.json() if res.status_code == 200 else []

    # 5. Productos (List/Order)
    elif "select" in q and "productos" in q:
        url = f"{REST_URL}/productos?order=nombre"
        res = rest_request("GET", url, headers=headers)
        return res.json() if res.status_code == 200 else []

    # 6. Servicios (List/Order)
    elif "select" in q and "servicios" in q and "order by nombre" in q:
        url = f"{REST_URL}/servicios?order=nombre"
        res = rest_request("GET", url, headers=headers)
        return res.json() if res.status_code == 200 else []

    # 7. Empleados (List/Order)
    elif "select" in q and "empleados" in q and "order by nombre" in q:
        url = f"{REST_URL}/empleados?order=nombre"
        res = rest_request("GET", url, headers=headers)
        return res.json() if res.status_code == 200 else []

    # 7b. Empleado por nombre, por ID o listado reducido
    elif "select" in q and "empleados" in q:
        if "nombre =" in q:
            url = f"{REST_URL}/empleados?nombre=eq.{params.get('n')}&select=id,nombre"
        elif "where id =" in q:
            url = f"{REST_URL}/empleados?id=eq.{params.get('id')}&select=id,nombre"
        else:
            url = f"{REST_URL}/empleados?select=id,nombre"
        res = rest_request("GET", url, headers=headers).json()
        if fetch_one:
            return res[0] if res else None
        return res

    # 8. Caja activa (Dashboard)
    elif "select" in q and "cajas_diarias" in q and "abierta" in q:
        url = f"{REST_URL}/cajas_diarias?estado=eq.ABIERTA&order=id.desc&limit=1"
        res = rest_request("GET", url, headers=headers).json()
        if fetch_one:
            return res[0] if res else None
        return res

    # 9. Usuarios (Login)
    elif "select" in q and "usuarios" in q:
        u = params.get("u")
        url = f"{REST_URL}/usuarios?or=(username.eq.{u},mail.eq.{u})"
        res = rest_request("GET", url, headers=headers).json()
        p = params.get("p")
        user = None
        for r in res:
            stored_password = str(r.get("password") or r.get("contrasena") or "")
            if stored_password and hmac.compare_digest(stored_password, str(p)):
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
        res = rest_request("POST", f"{REST_URL}/clientes", headers=headers, json=payload).json()
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
        res = rest_request("POST", f"{REST_URL}/vehiculos", headers=headers, json=payload).json()
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
        res = rest_request("POST", f"{REST_URL}/caja_movimientos", headers=headers, json=payload).json()
        return res

    # 13. Abrir Caja (Insert)
    elif "insert" in q and "cajas_diarias" in q:
        payload = {
            "monto_apertura": float(params.get("monto")),
            "saldo_actual": float(params.get("monto")),
            "estado": "ABIERTA"
        }
        res = rest_request("POST", f"{REST_URL}/cajas_diarias", headers=headers, json=payload).json()
        return res

    # 14. Cerrar Caja (Update)
    elif "update" in q and "cajas_diarias" in q and "monto_cierre" in q:
        payload = {
            "fecha_cierre": datetime.now().isoformat(),
            "monto_cierre": float(params.get("cierre")),
            "estado": "CERRADA"
        }
        url = f"{REST_URL}/cajas_diarias?id=eq.{params.get('id')}"
        res = rest_request("PATCH", url, headers=headers, json=payload).json()
        return res

    # 15. Actualizar Saldo Caja (Update)
    elif "update" in q and "cajas_diarias" in q and "saldo_actual" in q:
        caja_id = params.get("id")
        caja = rest_request("GET", f"{REST_URL}/cajas_diarias?id=eq.{caja_id}", headers=headers).json()
        if caja:
            curr_saldo = float(caja[0]["saldo_actual"])
            monto = float(params.get("m"))
            if "+" in q:
                new_saldo = curr_saldo + monto
            else:
                new_saldo = curr_saldo - monto
            rest_request("PATCH", f"{REST_URL}/cajas_diarias?id=eq.{caja_id}", headers=headers, json={"saldo_actual": new_saldo})
        return None

    # 16. Nuevo Empleado (Insert)
    elif "insert" in q and "empleados" in q:
        payload = {
            "nombre": params.get("nombre"),
            "rol": params.get("rol"),
            "telefono": params.get("telefono", ""),
            "activo": True
        }
        res = rest_request("POST", f"{REST_URL}/empleados", headers=headers, json=payload).json()
        return res

    # 17. Cambiar Estado Empleado (Update)
    elif "update" in q and "empleados" in q:
        if "porcentaje_comision" in q:
            payload = {"porcentaje_comision": float(params.get("porcentaje_comision"))}
        else:
            payload = {"activo": params.get("activo")}
        url = f"{REST_URL}/empleados?id=eq.{params.get('id')}"
        res = rest_request("PATCH", url, headers=headers, json=payload).json()
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
        res = rest_request("POST", f"{REST_URL}/turnos", headers=headers, json=payload).json()
        return res

    # 19. Cambiar Estado Turno (Update)
    elif "update" in q and "turnos" in q:
        if "empleado_id" in q and "fecha_hora" in q:
            payload = {
                "empleado_id": int(params.get("e")) if params.get("e") is not None else None,
                "fecha_hora": str(params.get("f")),
            }
        else:
            payload = {"estado": params.get("estado")}
        url = f"{REST_URL}/turnos?id=eq.{params.get('id')}"
        res = rest_request("PATCH", url, headers=headers, json=payload).json()
        return res

    # 20. Reabastecer Producto / Actualizar Stock (Update/Select)
    elif "update" in q and "productos" in q and "stock =" in q:
        p_id = params.get("id")
        if "+ :qty" in q or "+ :quantity" in q or "stock +" in q:
            qty = float(params.get("qty"))
            res = rest_request("GET", f"{REST_URL}/productos?id=eq.{p_id}", headers=headers).json()
            if res:
                curr_stock = float(res[0]["stock"])
                rest_request("PATCH", f"{REST_URL}/productos?id=eq.{p_id}", headers=headers, json={"stock": int(round(curr_stock + qty))})
        else:
            st_val = params.get("st") if params.get("st") is not None else params.get("new_stock")
            rest_request("PATCH", f"{REST_URL}/productos?id=eq.{p_id}", headers=headers, json={"stock": int(round(float(st_val)))})
        return None

    # 21. Select Producto por ID
    elif "select" in q and "productos" in q and "id =" in q:
        p_id = params.get("id")
        res = rest_request("GET", f"{REST_URL}/productos?id=eq.{p_id}", headers=headers).json()
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
        res = rest_request("POST", f"{REST_URL}/feedback_clientes", headers=headers, json=payload).json()
        return res

    # 23. Buscar Cupon
    elif "select" in q and "cupones_descuento" in q and "codigo =" in q:
        code = params.get("code")
        res = rest_request("GET", f"{REST_URL}/cupones_descuento?codigo=eq.{code}", headers=headers).json()
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
        res = rest_request("PATCH", url, headers=headers, json=payload).json()
        return res

    # 25. Registrar Venta (Insert)
    elif "insert" in q and "ventas" in q:
        payload = {
            "cliente_id": int(params.get("c")) if params.get("c") is not None else None,
            "total": float(params.get("t")),
            "metodo_pago": params.get("m")
        }
        res = rest_request("POST", f"{REST_URL}/ventas", headers=headers, json=payload).json()
        return res

    # 26. Obtener Ultima Venta
    elif "select" in q and "ventas" in q and "order by id desc limit 1" in q:
        url = f"{REST_URL}/ventas?select=id&order=id.desc&limit=1"
        res = rest_request("GET", url, headers=headers).json()
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
        res = rest_request("POST", f"{REST_URL}/venta_detalles", headers=headers, json=payload).json()
        return res

    # 28. Clientes Inactivos (Loyalty)
    elif "select" in q and "clientes" in q and "ultima_visita <=" in q:
        limite = str(params.get("limite"))
        url = f"{REST_URL}/clientes?select=id,nombre,telefono&ultima_visita=lte.{limite}"
        res = rest_request("GET", url, headers=headers).json()
        return res

    # 29. Buscar Cupon por Cliente
    elif "select" in q and "cupones_descuento" in q and "cliente_id =" in q:
        c_id = params.get("id")
        url = f"{REST_URL}/cupones_descuento?select=id&cliente_id=eq.{c_id}&usado=eq.false"
        res = rest_request("GET", url, headers=headers).json()
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
        res = rest_request("POST", f"{REST_URL}/cupones_descuento", headers=headers, json=payload).json()
        return res

    # 31. Cambiar Comisión Empleado (Update)
    elif "update" in q and "empleados" in q and "porcentaje_comision" in q:
        payload = {
            "porcentaje_comision": float(params.get("porcentaje_comision"))
        }
        url = f"{REST_URL}/empleados?id=eq.{params.get('id')}"
        res = rest_request("PATCH", url, headers=headers, json=payload).json()
        return res

    # 32. Liquidaciones de Comisiones (Select)
    elif "select" in q and "liquidacion_comisiones" in q:
        url = f"{REST_URL}/liquidacion_comisiones?select=*,empleados(nombre)&order=fecha.desc"
        res = rest_request("GET", url, headers=headers)
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
        res = rest_request("POST", f"{REST_URL}/liquidacion_comisiones", headers=headers, json=payload).json()
        return res

    print(f"[REST-QUERY-ERROR] Unhandled SQL query: {query}")
    raise RuntimeError("La operaciÃ³n solicitada no estÃ¡ implementada por el adaptador REST.")

def execute_query(query: str, params: dict = None, fetch_all: bool = False, fetch_one: bool = False):
    """
    Función helper para ejecutar consultas en la base de datos Supabase con fallback a REST API.
    """
    global DB_ONLINE
    if DB_ONLINE and DB_URL:
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
                "SELECT id, tipo, monto, descripcion, fecha, TO_CHAR(fecha, 'HH24:MI') as hora, metodo_pago, origen, turno_id FROM caja_movimientos WHERE caja_id = :id ORDER BY id DESC;",
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
        print(f"[DASHBOARD-ERROR] No se pudo cargar información real: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No se pudo sincronizar el tablero con la base de datos."
        )

# ==========================================
# 📈 ENDPOINT: SEGMENTACIÓN DE CLIENTES (PANDAS)
# ==========================================

@app.get("/api/marketing/segmentacion")
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
            require_supabase_config()
            REST_URL = f"{SUPABASE_URL}/rest/v1"
            anon_key = SUPABASE_ANON_KEY
            headers = {"apikey": anon_key, "Authorization": f"Bearer {anon_key}"}
            
            # Fetch clientes
            clientes = rest_request("GET", f"{REST_URL}/clientes", headers=headers).json()
            # Fetch COMPLETADO turnos
            turnos = rest_request("GET", f"{REST_URL}/turnos?estado=eq.COMPLETADO&select=cliente_id,servicios(precio)", headers=headers).json()
            
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
            print(f"[FASTAPI-ERROR] No se pudo calcular la segmentación real: {e_rest}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="No se pudo calcular la segmentación con datos reales."
            )

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

    if 'ultima_visita' in df.columns:
        df['ultima_visita'] = df['ultima_visita'].astype(str)

    return {
        "status": "success",
        "source": "database",
        "total_procesados": len(df),
        "clientes": df.to_dict(orient="records")
    }

# ==========================================
# ⭐ ENDPOINT: NET PROMOTER SCORE (NPS)
# ==========================================

@app.get("/api/marketing/nps")
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
            require_supabase_config()
            REST_URL = f"{SUPABASE_URL}/rest/v1"
            anon_key = SUPABASE_ANON_KEY
            headers = {"apikey": anon_key, "Authorization": f"Bearer {anon_key}"}
            res = rest_request("GET", f"{REST_URL}/feedback_clientes?select=puntuacion", headers=headers).json()
            df = pd.DataFrame(res)
            is_mock = False
        except Exception as e_rest:
            print(f"[FASTAPI-ERROR] No se pudo calcular NPS real: {e_rest}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="No se pudo calcular NPS con datos reales."
            )

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
        "source": "database"
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

@app.post("/api/turnos")
def schedule_appointment_secure(payload: dict, request: Request):
    client_id = payload.get("clientId")
    vehicle_id = payload.get("vehicleId")
    service_id = payload.get("serviceId")
    employee_id = payload.get("employeeId")
    scheduled_at = str(payload.get("scheduledAt") or "").strip()
    observations = str(payload.get("observations") or "").strip()
    if not all(isinstance(value, int) and value > 0 for value in (client_id, vehicle_id, service_id)):
        raise HTTPException(status_code=422, detail="Cliente, vehículo y servicio son obligatorios.")
    if employee_id is not None and (not isinstance(employee_id, int) or employee_id <= 0):
        raise HTTPException(status_code=422, detail="Responsable inválido.")
    try:
        datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=422, detail="Fecha y hora inválidas.")
    session = getattr(request.state, "session", {})
    try:
        result = call_service_rpc("agendar_turno_seguro", {
            "p_cliente_id": client_id,
            "p_vehiculo_id": vehicle_id,
            "p_servicio_id": service_id,
            "p_empleado_id": employee_id,
            "p_fecha_hora": scheduled_at,
            "p_observaciones": observations or None,
            "p_actor": str(session.get("sub") or "sistema"),
        })
        if not isinstance(result, dict) or result.get("turno_id") is None:
            raise RuntimeError("Respuesta de agenda incompleta.")
        return {"status": "success", "id": result["turno_id"], "estado": result["estado"]}
    except HTTPException:
        raise
    except requests.HTTPError as exc:
        response_status = exc.response.status_code if exc.response is not None else None
        raise HTTPException(
            status_code=409 if response_status == 400 else 503,
            detail="El horario no está disponible o el turno no pudo confirmarse.",
        )
    except (RuntimeError, TypeError, ValueError):
        raise HTTPException(status_code=503, detail="No se confirmó el turno.")


@app.post("/api/turnos/agendar-legacy-disabled", include_in_schema=False)
def schedule_appointment(clienteId: int, vehiculoId: int, servicioId: int, fechaHora: str, empleadoId: int = None):
    if min(clienteId, vehiculoId, servicioId) <= 0 or (empleadoId is not None and empleadoId <= 0):
        raise HTTPException(status_code=422, detail="Los identificadores del turno no son validos.")
    try:
        # fechaHora viene como YYYY-MM-DDTHH:MM
        fecha_parsed = datetime.strptime(fechaHora.replace("T", " "), "%Y-%m-%d %H:%M:%S" if len(fechaHora) > 16 else "%Y-%m-%d %H:%M")
        created = execute_query("INSERT INTO turnos (cliente_id, vehiculo_id, servicio_id, empleado_id, fecha_hora, estado) VALUES (:c, :v, :s, :e, :f, 'PENDIENTE');",
                                {"c": clienteId, "v": vehiculoId, "s": servicioId, "e": empleadoId, "f": fecha_parsed})
        if not created:
            raise RuntimeError("Supabase no confirmo el alta del turno.")
        record = created[0] if isinstance(created, list) else created
        return {"status": "success", "id": record.get("id"), "message": "Turno agendado correctamente."}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[TURNOS-ERROR] No se pudo agendar el turno: {e}")
        raise HTTPException(status_code=503, detail="No se pudo agendar el turno.")

@app.post("/api/turnos/{id}/estado-legacy-disabled", include_in_schema=False)
def update_appointment_status(id: int, estado: str):
    try:
        requested_state = estado.strip().upper()
        allowed_transitions = {
            "PENDIENTE": {"EN_PROCESO"},
            "EN_PROCESO": {"PENDIENTE", "COMPLETADO"},
            "COMPLETADO": {"EN_PROCESO", "ENTREGADO"},
            "ENTREGADO": {"COMPLETADO"},
        }
        if requested_state not in allowed_transitions:
            raise HTTPException(status_code=422, detail="Estado de turno no valido.")

        current = execute_query(
            "SELECT t.id, t.estado, s.precio, c.nombre as cliente_nombre, s.nombre as servicio_nombre "
            "FROM turnos t "
            "JOIN clientes c ON t.cliente_id = c.id "
            "JOIN servicios s ON t.servicio_id = s.id "
            "WHERE t.id = :id;",
            {"id": id},
            fetch_one=True,
        )
        if not current:
            raise HTTPException(status_code=404, detail="Turno no encontrado.")

        current_state = str(current.get("estado") or "").upper()
        if requested_state == current_state:
            return {
                "status": "success",
                "unchanged": True,
                "message": f"El turno ya se encuentra en {requested_state}.",
            }
        if requested_state not in allowed_transitions.get(current_state, set()):
            raise HTTPException(
                status_code=409,
                detail=f"Transicion no permitida: {current_state} -> {requested_state}.",
            )

        # 1. Update the status of the appointment
        updated = execute_query(
            "UPDATE turnos SET estado = :estado WHERE id = :id;",
            {"estado": requested_state, "id": id},
        )
        if not updated:
            raise RuntimeError("Supabase no confirmo el cambio de estado.")
        return {
            "status": "success",
            "estado": requested_state,
            "message": f"Estado del turno cambiado a {requested_state}.",
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[TURNOS-ERROR] No se pudo cambiar el estado: {e}")
        raise HTTPException(status_code=503, detail="No se pudo cambiar el estado del turno.")


@app.post("/api/turnos/{id}/transiciones")
def transition_appointment(id: int, payload: dict, request: Request):
    """Cambio de estado auditable y atómico mediante RPC de servidor."""
    requested_state = str(payload.get("state") or "").strip().upper()
    observation = str(payload.get("observation") or "").strip()
    if requested_state not in {"PENDIENTE", "EN_PROCESO", "COMPLETADO", "ENTREGADO", "CANCELADO"}:
        raise HTTPException(status_code=422, detail="Estado de turno no válido.")
    session = getattr(request.state, "session", {})
    try:
        result = call_service_rpc(
            "cambiar_estado_turno",
            {
                "p_turno_id": id,
                "p_estado": requested_state,
                "p_actor": str(session.get("sub") or "sistema"),
                "p_observacion": observation or None,
            },
        )
        if not isinstance(result, dict) or result.get("turno_id") is None:
            raise RuntimeError("Respuesta transaccional incompleta.")
        return {
            "status": "success",
            "turnoId": result["turno_id"],
            "estado": result["estado"],
            "unchanged": bool(result.get("unchanged")),
        }
    except HTTPException:
        raise
    except requests.HTTPError as exc:
        response_status = exc.response.status_code if exc.response is not None else None
        raise HTTPException(
            status_code=409 if response_status == 400 else 503,
            detail="La transición no fue confirmada. Revisá el estado actual del turno.",
        )
    except (RuntimeError, TypeError, ValueError):
        raise HTTPException(status_code=503, detail="No se confirmó el cambio de estado.")

@app.post("/api/turnos/{id}/reprogramar-legacy-disabled", include_in_schema=False)
def reprogramar_turno(id: int, lavador: str, fechaHora: str):
    try:
        current = execute_query(
            "SELECT t.id, t.estado, s.precio, c.nombre as cliente_nombre, s.nombre as servicio_nombre "
            "FROM turnos t "
            "JOIN clientes c ON t.cliente_id = c.id "
            "JOIN servicios s ON t.servicio_id = s.id "
            "WHERE t.id = :id;",
            {"id": id},
            fetch_one=True,
        )
        if not current:
            raise HTTPException(status_code=404, detail="Turno no encontrado.")
        if str(current.get("estado") or "").upper() not in {"PENDIENTE", "EN_PROCESO"}:
            raise HTTPException(status_code=409, detail="Solo se pueden reprogramar turnos pendientes o en proceso.")

        # fechaHora viene como YYYY-MM-DDTHH:MM
        fecha_parsed = datetime.strptime(fechaHora.replace("T", " "), "%Y-%m-%d %H:%M:%S" if len(fechaHora) > 16 else "%Y-%m-%d %H:%M")
        
        # Buscar empleado por nombre
        emp_res = execute_query("SELECT id FROM empleados WHERE nombre = :n LIMIT 1;", {"n": lavador}, fetch_one=True)
        empleado_id = None
        if emp_res:
            empleado_id = emp_res["id"]
        elif lavador and "sin asignar" not in lavador.lower():
            raise HTTPException(status_code=404, detail="Empleado no encontrado.")
            
        # Actualizar turno
        updated = execute_query(
            "UPDATE turnos SET empleado_id = :e, fecha_hora = :f WHERE id = :id;",
            {"e": empleado_id, "f": fecha_parsed, "id": id}
        )
        if not updated:
            raise RuntimeError("Supabase no confirmo la reprogramacion.")
        return {"status": "success", "message": "Turno reprogramado correctamente."}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[TURNOS-ERROR] No se pudo reprogramar el turno: {e}")
        raise HTTPException(status_code=503, detail="No se pudo reprogramar el turno.")


@app.post("/api/turnos/{id}/reprogramaciones")
def reprogram_appointment_secure(id: int, payload: dict, request: Request):
    employee_id = payload.get("employeeId")
    scheduled_at = str(payload.get("scheduledAt") or "").strip()
    if employee_id is not None and (not isinstance(employee_id, int) or employee_id <= 0):
        raise HTTPException(status_code=422, detail="Responsable inválido.")
    try:
        datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=422, detail="Fecha y hora inválidas.")
    session = getattr(request.state, "session", {})
    try:
        result = call_service_rpc("reprogramar_turno_seguro", {
            "p_turno_id": id,
            "p_empleado_id": employee_id,
            "p_fecha_hora": scheduled_at,
            "p_actor": str(session.get("sub") or "sistema"),
        })
        if not isinstance(result, dict) or result.get("turno_id") is None:
            raise RuntimeError("Respuesta de reprogramación incompleta.")
        return {
            "status": "success",
            "turnoId": result["turno_id"],
            "estado": result.get("estado"),
            "scheduledAt": result.get("fecha_hora"),
        }
    except requests.HTTPError as exc:
        response_status = exc.response.status_code if exc.response is not None else None
        raise HTTPException(
            status_code=409 if response_status == 400 else 503,
            detail="El horario no está disponible o la reprogramación no pudo confirmarse.",
        )
    except (RuntimeError, TypeError, ValueError):
        raise HTTPException(status_code=503, detail="No se confirmó la reprogramación.")

# ==========================================
# 🚘 ENDPOINTS: INSPECCION DE DAÑOS
# ==========================================

@app.get("/api/turnos/{id}/inspeccion")
def get_inspeccion_danos(id: int):
    try:
        # Fetch all damage pins for the specified turno
        res = execute_query(
            "SELECT id, componente, tipo_danio, gravedad, coordenada_x, coordenada_y, detalles, fecha_registro FROM inspeccion_danos WHERE turno_id = :id ORDER BY id ASC;",
            {"id": id},
            fetch_all=True
        )
        return {"status": "success", "danos": res or []}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al obtener inspección de daños: {e}")

@app.post("/api/turnos/{id}/inspeccion")
def add_inspeccion_danio(id: int, payload: dict):
    try:
        componente = payload.get("componente", "General")
        tipo_danio = payload.get("tipo_danio", "Rayón")
        gravedad = payload.get("gravedad", "Leve")
        coordenada_x = float(payload.get("coordenada_x", 0.0))
        coordenada_y = float(payload.get("coordenada_y", 0.0))
        detalles = payload.get("detalles", "")
        
        execute_query(
            """INSERT INTO inspeccion_danos (turno_id, componente, tipo_danio, gravedad, coordenada_x, coordenada_y, detalles)
               VALUES (:t_id, :comp, :tipo, :grav, :cx, :cy, :det);""",
            {
                "t_id": id,
                "comp": componente,
                "tipo": tipo_danio,
                "grav": gravedad,
                "cx": coordenada_x,
                "cy": coordenada_y,
                "det": detalles
            }
        )
        return {"status": "success", "message": "Daño registrado con éxito en la inspección."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al registrar daño de inspección: {e}")


@app.post("/api/turnos/{id}/recepcion")
def save_reception_inspection(id: int, payload: dict, request: Request):
    level = str(payload.get("dirtLevel") or "").strip().upper()
    checklist = payload.get("damageChecklist")
    inspector = str(payload.get("inspector") or "").strip()
    observations = str(payload.get("observations") or "").strip()
    if level not in {"BAJO", "MEDIO", "ALTO", "EXTREMO"}:
        raise HTTPException(status_code=422, detail="Nivel de suciedad inválido.")
    if not isinstance(checklist, dict) or len(inspector) < 2:
        raise HTTPException(status_code=422, detail="Checklist e inspector son obligatorios.")
    session = getattr(request.state, "session", {})
    try:
        result = call_service_rpc("guardar_inspeccion_recepcion", {
            "p_turno_id": id,
            "p_nivel_suciedad": level,
            "p_checklist_danos": checklist,
            "p_observaciones": observations or None,
            "p_inspector": inspector,
            "p_actor": str(session.get("sub") or "sistema"),
        })
        if not isinstance(result, dict) or result.get("inspeccion_id") is None:
            raise RuntimeError("Respuesta de inspección incompleta.")
        return {"status": "success", "inspectionId": result["inspeccion_id"], "appointmentId": id}
    except requests.HTTPError as exc:
        response_status = exc.response.status_code if exc.response is not None else None
        raise HTTPException(
            status_code=409 if response_status == 400 else 503,
            detail="La inspección no pudo guardarse.",
        )
    except (RuntimeError, TypeError, ValueError):
        raise HTTPException(status_code=503, detail="No se confirmó la inspección.")


@app.post("/api/turnos/{id}/recepcion/fotos")
def upload_reception_photo(id: int, payload: dict, request: Request):
    require_service_role()
    inspection_id = payload.get("inspectionId")
    data_url = str(payload.get("dataUrl") or "")
    sector = str(payload.get("sector") or "Vista general").strip()[:80]
    description = str(payload.get("description") or "Foto de recepción").strip()[:200]
    if not isinstance(inspection_id, int) or inspection_id <= 0:
        raise HTTPException(status_code=422, detail="Inspección inválida.")
    match = re.fullmatch(r"data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)", data_url)
    if not match:
        raise HTTPException(status_code=422, detail="Formato de imagen no permitido.")
    mime_type, encoded = match.groups()
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error):
        raise HTTPException(status_code=422, detail="La imagen está dañada.")
    if not 1 <= len(raw) <= 700000:
        raise HTTPException(status_code=413, detail="La imagen debe pesar menos de 700 KB.")
    signatures = {
        "image/jpeg": raw.startswith(b"\xff\xd8\xff"),
        "image/png": raw.startswith(b"\x89PNG\r\n\x1a\n"),
        "image/webp": raw.startswith(b"RIFF") and raw[8:12] == b"WEBP",
    }
    if not signatures.get(mime_type):
        raise HTTPException(status_code=422, detail="El contenido no coincide con el tipo de imagen.")

    try:
        verification = rest_request(
            "GET",
            f"{SUPABASE_URL}/rest/v1/turno_inspecciones?id=eq.{inspection_id}&turno_id=eq.{id}&select=id",
            headers=service_role_headers(),
        ).json()
    except requests.RequestException:
        raise HTTPException(status_code=503, detail="No se pudo validar la inspección.")
    if not isinstance(verification, list) or len(verification) != 1:
        raise HTTPException(status_code=404, detail="La inspección no existe para este turno.")

    extension = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[mime_type]
    object_path = f"turnos/{id}/{uuid.uuid4()}.{extension}"
    storage_url = f"{SUPABASE_URL}/storage/v1/object/inspecciones/{object_path}"
    upload_headers = service_role_headers()
    upload_headers.update({"Content-Type": mime_type, "x-upsert": "false"})
    try:
        rest_request("POST", storage_url, headers=upload_headers, data=raw)
        session = getattr(request.state, "session", {})
        response = rest_request(
            "POST",
            f"{SUPABASE_URL}/rest/v1/inspeccion_fotos",
            headers=service_role_headers("return=representation"),
            json={
                "inspeccion_id": inspection_id,
                "storage_path": object_path,
                "sector": sector or "Vista general",
                "descripcion": description or None,
                "mime_type": mime_type,
                "tamano_bytes": len(raw),
                "actor": str(session.get("sub") or "sistema"),
            },
        )
        records = response.json()
        if not isinstance(records, list) or not records or records[0].get("id") is None:
            raise RuntimeError("No se registró la foto.")
        return {"status": "success", "photoId": records[0]["id"]}
    except (requests.RequestException, RuntimeError):
        try:
            rest_request("DELETE", storage_url, headers=service_role_headers())
        except requests.RequestException:
            pass
        raise HTTPException(status_code=503, detail="La foto no pudo guardarse de forma completa.")

@app.post("/api/turnos/inspeccion/{pin_id}/eliminar")
def delete_inspeccion_danio(pin_id: int):
    try:
        execute_query("DELETE FROM inspeccion_danos WHERE id = :id;", {"id": pin_id})
        return {"status": "success", "message": "Pin de daño eliminado."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al eliminar pin de daño: {e}")

# ==========================================
# 💵 ENDPOINTS: CAJA DIARIA
# ==========================================

@app.post("/api/caja/abrir-legacy-disabled", include_in_schema=False)
def open_cashbox(montoApertura: float):
    try:
        caja_activa = execute_query("SELECT id FROM cajas_diarias WHERE estado = 'ABIERTA';", fetch_one=True)
        if caja_activa:
            return JSONResponse(status_code=409, content={"status": "error", "message": "Ya existe una caja abierta actualmente."})
        
        execute_query("INSERT INTO cajas_diarias (fecha_apertura, monto_apertura, saldo_actual, estado) VALUES (NOW(), :monto, :monto, 'ABIERTA');",
                      {"monto": montoApertura})
        return {"status": "success", "message": "Caja diaria abierta con éxito."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al abrir caja: {e}")


@app.post("/api/caja/abrir-segura")
def open_cashbox_secure(payload: dict, request: Request):
    amount = payload.get("openingAmount")
    if not isinstance(amount, (int, float)) or amount < 0:
        raise HTTPException(status_code=422, detail="Monto de apertura inválido.")
    session = getattr(request.state, "session", {})
    try:
        result = call_service_rpc("abrir_caja_segura", {
            "p_monto_apertura": round(float(amount), 2),
            "p_actor": str(session.get("sub") or "sistema"),
        })
        if not isinstance(result, dict) or result.get("caja_id") is None:
            raise RuntimeError("Respuesta de apertura incompleta.")
        return {
            "status": "success",
            "cashboxId": result["caja_id"],
            "balance": float(result.get("saldo_actual") or 0),
        }
    except requests.HTTPError as exc:
        response_status = exc.response.status_code if exc.response is not None else None
        raise HTTPException(
            status_code=409 if response_status == 400 else 503,
            detail="La apertura no fue confirmada.",
        )
    except (RuntimeError, TypeError, ValueError):
        raise HTTPException(status_code=503, detail="No se confirmó la apertura de caja.")

@app.post("/api/caja/cerrar-legacy-disabled", include_in_schema=False)
def close_cashbox(montoCierre: float):
    try:
        caja_activa = execute_query("SELECT id, monto_apertura, saldo_actual FROM cajas_diarias WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1;", fetch_one=True)
        if not caja_activa:
            return JSONResponse(status_code=409, content={"status": "error", "message": "No hay ninguna caja abierta para cerrar."})
        
        execute_query("UPDATE cajas_diarias SET fecha_cierre = NOW(), monto_cierre = :cierre, estado = 'CERRADA' WHERE id = :id;",
                      {"cierre": montoCierre, "id": caja_activa["id"]})
        return {"status": "success", "message": f"Caja cerrada correctamente. Saldo esperado: ${caja_activa['saldo_actual']} | Saldo real ingresado: ${montoCierre}"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al cerrar caja: {e}")


@app.post("/api/caja/cerrar-segura")
def close_cashbox_secure(payload: dict, request: Request):
    amount = payload.get("declaredAmount")
    observation = str(payload.get("observation") or "").strip()
    if not isinstance(amount, (int, float)) or amount < 0:
        raise HTTPException(status_code=422, detail="Monto declarado inválido.")
    session = getattr(request.state, "session", {})
    try:
        result = call_service_rpc(
            "cerrar_caja_segura",
            {
                "p_monto_declarado": round(float(amount), 2),
                "p_actor": str(session.get("sub") or "sistema"),
                "p_observacion": observation or None,
            },
        )
        if not isinstance(result, dict) or result.get("caja_id") is None:
            raise RuntimeError("Respuesta de cierre incompleta.")
        return {
            "status": "success",
            "cashboxId": result["caja_id"],
            "expectedAmount": float(result["monto_esperado"]),
            "declaredAmount": float(result["monto_declarado"]),
            "difference": float(result["diferencia"]),
        }
    except HTTPException:
        raise
    except requests.HTTPError as exc:
        response_status = exc.response.status_code if exc.response is not None else None
        raise HTTPException(
            status_code=409 if response_status == 400 else 503,
            detail="El cierre no fue confirmado. La caja permanece abierta.",
        )
    except (RuntimeError, TypeError, ValueError):
        raise HTTPException(status_code=503, detail="No se confirmó el cierre de caja.")


@app.post("/api/caja/cobrar-turno")
def charge_appointment(payload: dict, request: Request):
    appointment_id = payload.get("appointmentId")
    payment_method = str(payload.get("paymentMethod") or "").strip().upper()
    if not isinstance(appointment_id, int) or appointment_id <= 0:
        raise HTTPException(status_code=422, detail="Turno inválido.")
    if payment_method not in {"EFECTIVO", "TRANSFERENCIA", "DEBITO", "CREDITO"}:
        raise HTTPException(status_code=422, detail="Medio de pago inválido.")
    try:
        idempotency_key = str(uuid.UUID(request.headers.get("idempotency-key", "").strip()))
    except (ValueError, AttributeError):
        raise HTTPException(status_code=422, detail="Idempotency-Key inválida o ausente.")
    session = getattr(request.state, "session", {})
    try:
        result = call_service_rpc(
            "cobrar_turno",
            {
                "p_turno_id": appointment_id,
                "p_metodo_pago": payment_method,
                "p_idempotency_key": idempotency_key,
                "p_actor": str(session.get("sub") or "sistema"),
            },
        )
        if not isinstance(result, dict) or result.get("movimiento_id") is None:
            raise RuntimeError("Respuesta de cobro incompleta.")
        return {
            "status": "success",
            "movementId": result["movimiento_id"],
            "amount": float(result.get("monto") or 0),
            "paymentMethod": result.get("metodo_pago") or payment_method,
            "idempotentReplay": bool(result.get("idempotent_replay")),
        }
    except HTTPException:
        raise
    except requests.HTTPError as exc:
        response_status = exc.response.status_code if exc.response is not None else None
        raise HTTPException(
            status_code=409 if response_status == 400 else 503,
            detail="El cobro no fue confirmado. No se registraron cambios parciales.",
        )
    except (RuntimeError, TypeError, ValueError):
        raise HTTPException(status_code=503, detail="No se confirmó el cobro.")

# ==========================================
# 🛒 ENDPOINTS: PUNTO DE VENTA (POS)
# ==========================================

@app.post("/api/pos/productos/{id}/reabastecer")
def restock_product(id: int, cantidad: int):
    raise HTTPException(
        status_code=410,
        detail="El reabastecimiento directo fue retirado. Use el movimiento de inventario auditable.",
    )


@app.post("/api/inventario/movimientos")
def register_inventory_movement(payload: dict, request: Request):
    """Registra un cambio de stock y su egreso opcional en una unica RPC."""
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=503,
            detail="El inventario atomico requiere aplicar la migracion transaccional y configurar service_role.",
        )

    raw_idempotency_key = request.headers.get("idempotency-key", "").strip()
    try:
        idempotency_key = str(uuid.UUID(raw_idempotency_key))
    except (ValueError, AttributeError):
        raise HTTPException(status_code=422, detail="Idempotency-Key invalida o ausente.")

    product_id = payload.get("productId")
    delta = payload.get("delta")
    reason = str(payload.get("reason") or "").strip()
    supplier = str(payload.get("supplier") or "").strip()
    unit_cost = payload.get("unitCost", 0)
    register_cash_expense = payload.get("registerCashExpense", False)

    if not isinstance(product_id, int) or product_id <= 0:
        raise HTTPException(status_code=422, detail="Producto no valido.")
    if not isinstance(delta, int) or delta == 0 or abs(delta) > 100000:
        raise HTTPException(status_code=422, detail="Variacion de stock no valida.")
    if len(reason) < 3 or len(reason) > 200:
        raise HTTPException(status_code=422, detail="Motivo no valido.")
    if len(supplier) > 100:
        raise HTTPException(status_code=422, detail="Proveedor no valido.")
    if isinstance(unit_cost, bool) or not isinstance(unit_cost, (int, float)) or unit_cost < 0:
        raise HTTPException(status_code=422, detail="Costo unitario no valido.")
    if not isinstance(register_cash_expense, bool):
        raise HTTPException(status_code=422, detail="Indicador de egreso no valido.")
    if register_cash_expense and (delta <= 0 or unit_cost <= 0):
        raise HTTPException(status_code=422, detail="El egreso requiere una entrada con costo positivo.")

    session = getattr(request.state, "session", {})
    actor = str(session.get("sub") or "").strip()
    rpc_headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    rpc_payload = {
        "p_producto_id": product_id,
        "p_variacion": delta,
        "p_motivo": reason,
        "p_proveedor": supplier or None,
        "p_precio_unitario": round(float(unit_cost), 2),
        "p_registrar_egreso": register_cash_expense,
        "p_idempotency_key": idempotency_key,
        "p_actor": actor,
    }

    try:
        rpc_response = rest_request(
            "POST",
            f"{SUPABASE_URL}/rest/v1/rpc/registrar_movimiento_inventario",
            headers=rpc_headers,
            json=rpc_payload,
        )
        result = rpc_response.json()
        if not isinstance(result, dict) or result.get("movimiento_id") is None or result.get("stock") is None:
            raise RuntimeError("Supabase devolvio un movimiento incompleto.")
        return {
            "status": "success",
            "movementId": result.get("movimiento_id"),
            "stock": int(result.get("stock")),
            "cashMovementId": result.get("caja_movimiento_id"),
            "idempotentReplay": bool(result.get("idempotent_replay")),
        }
    except requests.HTTPError as exc:
        response_status = exc.response.status_code if exc.response is not None else None
        print(f"[INVENTORY-ERROR] RPC transaccional rechazada. status={response_status}")
        raise HTTPException(
            status_code=409 if response_status == 400 else 503,
            detail="El movimiento no fue confirmado. No se aplicaron cambios parciales.",
        )
    except (TypeError, ValueError, RuntimeError):
        raise HTTPException(
            status_code=503,
            detail="Supabase no devolvio una confirmacion valida del movimiento.",
        )

@app.post("/api/pos/feedback")
def submit_feedback(clienteId: int, puntuacion: int, comentario: str = ""):
    try:
        execute_query("INSERT INTO feedback_clientes (cliente_id, puntuacion, comentario) VALUES (:c, :p, :co);",
                      {"c": clienteId, "p": puntuacion, "co": comentario})
        return {"status": "success", "message": "Feedback guardado correctamente."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al guardar feedback: {e}")

@app.post("/api/pos/venta")
def register_sale(payload: dict, request: Request):
    """
    Registra una venta e impacta el inventario y la caja en Supabase.
    Payload: { clienteId, metodoPago, detalles: [{productoId, cantidad}], codigoCupon }
    """
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=503,
            detail="La venta POS atomica requiere completar la migracion transaccional de Supabase.",
        )

    raw_idempotency_key = request.headers.get("idempotency-key", "").strip()
    try:
        idempotency_key = str(uuid.UUID(raw_idempotency_key))
    except (ValueError, AttributeError):
        raise HTTPException(status_code=422, detail="Idempotency-Key invalida o ausente.")

    cliente_id = payload.get("clienteId")
    metodo_pago = str(payload.get("metodoPago") or "").upper()
    detalles = payload.get("detalles")
    codigo_cupon = payload.get("codigoCupon")
    if cliente_id is not None and (not isinstance(cliente_id, int) or cliente_id <= 0):
        raise HTTPException(status_code=422, detail="Cliente no valido.")
    if metodo_pago not in {"EFECTIVO", "TRANSFERENCIA", "DEBITO", "CREDITO"}:
        raise HTTPException(status_code=422, detail="Metodo de pago no valido.")
    if not isinstance(detalles, list) or not detalles:
        raise HTTPException(status_code=422, detail="La venta debe incluir al menos un producto.")
    for detail in detalles:
        if (
            not isinstance(detail, dict)
            or not isinstance(detail.get("productoId"), int)
            or not isinstance(detail.get("cantidad"), int)
            or detail["productoId"] <= 0
            or detail["cantidad"] <= 0
        ):
            raise HTTPException(status_code=422, detail="Detalle de venta no valido.")

    rpc_headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    rpc_payload = {
        "p_cliente_id": cliente_id,
        "p_metodo_pago": metodo_pago,
        "p_detalles": detalles,
        "p_codigo_cupon": codigo_cupon,
        "p_idempotency_key": idempotency_key,
    }
    try:
        rpc_response = rest_request(
            "POST",
            f"{SUPABASE_URL}/rest/v1/rpc/registrar_venta_pos",
            headers=rpc_headers,
            json=rpc_payload,
        )
        rpc_result = rpc_response.json()
        return {
            "status": "success",
            "venta": {
                "id": rpc_result.get("venta_id"),
                "total": float(rpc_result.get("total", 0)),
            },
            "idempotentReplay": bool(rpc_result.get("idempotent_replay")),
            "alertasStock": [],
        }
    except requests.HTTPError as exc:
        response_status = exc.response.status_code if exc.response is not None else None
        print(f"[POS-ERROR] RPC transaccional rechazada. status={response_status}")
        raise HTTPException(
            status_code=409 if response_status == 400 else 503,
            detail="La venta no fue confirmada. No se aplicaron cambios parciales.",
        )

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
        print(f"[LOYALTY-ERROR] No se pudo ejecutar la campaña: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No se pudo ejecutar la campaña de fidelización."
        )

@app.post("/api/clientes/nuevo")
def new_client(nombre: str, telefono: str = None, email: str = None):
    nombre = nombre.strip()
    if len(nombre) < 2:
        raise HTTPException(status_code=422, detail="El nombre del cliente no es válido.")
    try:
        res = execute_query(
            "INSERT INTO clientes (nombre, telefono, email, fecha_registro, clasificacion) VALUES (:n, :t, :e, NOW(), 'OCASIONAL') RETURNING id;",
            {"n": nombre, "t": telefono, "e": email},
            fetch_one=True
        )
        if not res or not res.get("id"):
            raise RuntimeError("Supabase no confirmó el alta del cliente.")
        return {"status": "success", "id": res["id"], "nombre": nombre}
    except Exception as e:
        print(f"[CRM-ERROR] No se pudo crear el cliente: {e}")
        raise HTTPException(status_code=503, detail="No se pudo registrar el cliente.")

@app.post("/api/vehiculos/nuevo")
def new_vehicle(clienteId: int, patente: str, marca: str, modelo: str, color: str = None, anio: int = None):
    patente = patente.strip().upper()
    if len(patente) < 6 or len(patente) > 9:
        raise HTTPException(status_code=422, detail="La patente no tiene un formato válido.")
    try:
        res = execute_query(
            "INSERT INTO vehiculos (cliente_id, patente, marca, modelo, color, anio) VALUES (:c, :p, :m, :mo, :co, :a) RETURNING id;",
            {"c": clienteId, "p": patente, "m": marca, "mo": modelo, "co": color, "a": anio},
            fetch_one=True
        )
        if not res or not res.get("id"):
            raise RuntimeError("Supabase no confirmó el alta del vehículo.")
        return {"status": "success", "id": res["id"], "patente": patente}
    except Exception as e:
        print(f"[CRM-ERROR] No se pudo crear el vehículo: {e}")
        raise HTTPException(status_code=503, detail="No se pudo registrar el vehículo.")

@app.post("/api/clientes-con-vehiculo")
def new_customer_with_vehicle(payload: dict):
    name = str(payload.get("name") or "").strip()
    phone = str(payload.get("phone") or "").strip()
    email = str(payload.get("email") or "").strip()
    plate = re.sub(r"\s+", "", str(payload.get("plate") or "").upper())
    make = str(payload.get("make") or "Auto").strip()
    model = str(payload.get("model") or "Vehículo sin modelo").strip()
    color = str(payload.get("color") or "").strip()
    year = payload.get("year")
    if len(name) < 2 or not re.fullmatch(r"[A-Z0-9]{6,9}", plate):
        raise HTTPException(status_code=422, detail="Nombre o patente inválidos.")
    if year is not None and (not isinstance(year, int) or year < 1900 or year > datetime.now().year + 1):
        raise HTTPException(status_code=422, detail="Año del vehículo inválido.")
    try:
        result = call_service_rpc(
            "registrar_cliente_vehiculo",
            {
                "p_nombre": name,
                "p_telefono": phone or None,
                "p_email": email or None,
                "p_patente": plate,
                "p_marca": make or None,
                "p_modelo": model or None,
                "p_color": color or None,
                "p_anio": year,
            },
        )
        if not isinstance(result, dict) or result.get("status") not in {"created", "duplicate"}:
            raise RuntimeError("Respuesta de alta incompleta.")
        return {
            "status": "success",
            "outcome": result["status"],
            "clientId": result.get("cliente_id"),
            "vehicleId": result.get("vehiculo_id"),
            "plate": result.get("patente", plate),
        }
    except HTTPException:
        raise
    except requests.HTTPError as exc:
        response_status = exc.response.status_code if exc.response is not None else None
        raise HTTPException(
            status_code=409 if response_status == 400 else 503,
            detail="No se pudo registrar cliente y vehículo en una sola operación.",
        )
    except (RuntimeError, TypeError, ValueError):
        raise HTTPException(status_code=503, detail="Supabase no confirmó el alta.")


@app.post("/api/vehiculos")
def add_vehicle_to_customer(payload: dict):
    client_id = payload.get("clientId")
    plate = re.sub(r"\s+", "", str(payload.get("plate") or "").upper())
    if not isinstance(client_id, int) or client_id <= 0 or not re.fullmatch(r"[A-Z0-9]{6,9}", plate):
        raise HTTPException(status_code=422, detail="Cliente o patente inválidos.")
    try:
        result = call_service_rpc("registrar_vehiculo_cliente", {
            "p_cliente_id": client_id,
            "p_patente": plate,
            "p_marca": str(payload.get("make") or "Auto")[:50],
            "p_modelo": str(payload.get("model") or "Vehículo sin modelo")[:50],
            "p_color": str(payload.get("color") or "")[:30] or None,
            "p_anio": payload.get("year"),
        })
        if not isinstance(result, dict) or result.get("vehiculo_id") is None:
            raise RuntimeError("Respuesta de vehículo incompleta.")
        return {
            "status": "success", "outcome": result.get("status"),
            "vehicleId": result["vehiculo_id"], "plate": result.get("patente", plate),
        }
    except HTTPException:
        raise
    except requests.HTTPError as exc:
        response_status = exc.response.status_code if exc.response is not None else None
        raise HTTPException(
            status_code=409 if response_status == 400 else 503,
            detail="No se pudo asociar el vehículo al cliente.",
        )
    except (RuntimeError, TypeError, ValueError):
        raise HTTPException(status_code=503, detail="No se confirmó el vehículo.")


@app.post("/api/caja/movimiento")
def new_cash_movement(tipo: str, monto: float, descripcion: str, request: Request):
    tipo = tipo.strip().upper()
    if tipo not in ["INGRESO", "EGRESO"]:
        raise HTTPException(status_code=422, detail="Tipo de movimiento no válido.")
    if monto <= 0:
        raise HTTPException(status_code=422, detail="El monto debe ser mayor que cero.")
    if len(descripcion.strip()) < 3:
        raise HTTPException(status_code=422, detail="La descripción es obligatoria.")

    if not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=503,
            detail="El movimiento atomico requiere completar la migracion transaccional de Supabase.",
        )

    raw_idempotency_key = request.headers.get("idempotency-key", "").strip()
    try:
        idempotency_key = str(uuid.UUID(raw_idempotency_key))
    except (ValueError, AttributeError):
        raise HTTPException(status_code=422, detail="Idempotency-Key invalida o ausente.")

    rpc_headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    try:
        rpc_response = rest_request(
            "POST",
            f"{SUPABASE_URL}/rest/v1/rpc/registrar_movimiento_caja",
            headers=rpc_headers,
            json={
                "p_tipo": tipo,
                "p_monto": round(monto, 2),
                "p_descripcion": descripcion.strip(),
                "p_idempotency_key": idempotency_key,
            },
        )
        rpc_result = rpc_response.json()
        return {
            "status": "success",
            "movimientoId": rpc_result.get("movimiento_id"),
            "idempotentReplay": bool(rpc_result.get("idempotent_replay")),
            "message": "Movimiento de caja registrado correctamente.",
        }
    except requests.HTTPError as exc:
        response_status = exc.response.status_code if exc.response is not None else None
        print(f"[CAJA-ERROR] RPC transaccional rechazada. status={response_status}")
        raise HTTPException(
            status_code=409 if response_status == 400 else 503,
            detail="El movimiento no fue confirmado. No se aplicaron cambios parciales.",
        )
        
    try:
        caja = execute_query("SELECT id FROM cajas_diarias WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1;", fetch_one=True)
        if not caja:
            raise HTTPException(status_code=409, detail="Operación denegada. La caja diaria está cerrada.")
            
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
    except HTTPException:
        raise
    except Exception as e:
        print(f"[CAJA-ERROR] No se pudo registrar el movimiento: {e}")
        raise HTTPException(status_code=503, detail="No se pudo registrar el movimiento de caja.")

def _arca_configuration_status() -> dict:
    missing = []
    if ARCA_ENVIRONMENT not in {"homologacion", "produccion"}:
        missing.append("ARCA_ENVIRONMENT debe ser homologacion o produccion")
    if len(ARCA_CUIT) != 11:
        missing.append("CUIT emisor de 11 dígitos")
    try:
        point_of_sale = int(ARCA_POINT_OF_SALE)
        if point_of_sale < 1 or point_of_sale > 99998:
            raise ValueError
    except ValueError:
        point_of_sale = None
        missing.append("punto de venta Web Services")
    if not ARCA_CERTIFICATE_B64 or not ARCA_PRIVATE_KEY_B64:
        missing.append("certificado y clave privada de ARCA")
    if not ARCA_BUSINESS_NAME or not ARCA_BUSINESS_ADDRESS:
        missing.append("razón social y domicilio del emisor")
    if not ARCA_GROSS_INCOME:
        missing.append("número de Ingresos Brutos")
    try:
        datetime.strptime(ARCA_ACTIVITY_START_DATE, "%Y-%m-%d")
    except ValueError:
        missing.append("fecha de inicio de actividades (AAAA-MM-DD)")
    fiscal_codes = {
        "concepto fiscal": ARCA_CONCEPT_CODE,
        "condición IVA de ítems": ARCA_ITEM_VAT_CODE,
        "condición IVA del receptor": ARCA_RECIPIENT_VAT_CODE,
        "unidad de medida": ARCA_UNIT_CODE,
    }
    for label, raw_value in fiscal_codes.items():
        try:
            if int(raw_value) <= 0:
                raise ValueError
        except (TypeError, ValueError):
            missing.append(f"código ARCA verificado para {label}")
    if not SUPABASE_SERVICE_ROLE_KEY:
        missing.append("SUPABASE_SERVICE_ROLE_KEY y migración fiscal")
    if not ARCA_CONNECTOR_ENABLED:
        missing.append("conector WSMTXCA habilitado después de homologación")
    return {
        "ready": len(missing) == 0,
        "environment": ARCA_ENVIRONMENT if ARCA_ENVIRONMENT in {"homologacion", "produccion"} else "homologacion",
        "invoiceType": "C",
        "pointOfSaleConfigured": point_of_sale is not None,
        "certificateConfigured": bool(ARCA_CERTIFICATE_B64 and ARCA_PRIVATE_KEY_B64),
        "issuerConfigured": bool(
            len(ARCA_CUIT) == 11 and ARCA_BUSINESS_NAME and ARCA_BUSINESS_ADDRESS
            and ARCA_GROSS_INCOME and ARCA_ACTIVITY_START_DATE
        ),
        "connectorEnabled": ARCA_CONNECTOR_ENABLED,
        "missing": missing,
    }


@app.get("/api/facturacion/configuracion")
def get_fiscal_configuration():
    """Devuelve indicadores; nunca expone certificado, clave, token ni firma."""
    return _arca_configuration_status()


@app.post("/api/facturacion/comprobantes-c-legacy-disabled", include_in_schema=False)
def issue_invoice_c_legacy_disabled(payload: dict, request: Request):
    """Contrato seguro para factura C. No fabrica CAE ni autoriza sin conector real."""
    configuration = _arca_configuration_status()
    if not configuration["ready"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="La factura C requiere completar configuración, migración y homologación ARCA.",
        )

    raw_idempotency_key = request.headers.get("idempotency-key", "").strip()
    try:
        str(uuid.UUID(raw_idempotency_key))
    except (ValueError, AttributeError):
        raise HTTPException(status_code=422, detail="Idempotency-Key inválida o ausente.")

    total = payload.get("total")
    items = payload.get("items")
    recipient = payload.get("recipient")
    try:
        raw_total_decimal = Decimal(str(total))
        total_decimal = raw_total_decimal.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        total_is_valid = raw_total_decimal == total_decimal
    except (InvalidOperation, TypeError, ValueError):
        total_decimal = Decimal("0")
        total_is_valid = False
    if total_decimal <= 0 or not total_is_valid:
        raise HTTPException(status_code=422, detail="El total fiscal no es válido.")
    if not isinstance(items, list) or not items or len(items) > 100:
        raise HTTPException(status_code=422, detail="La factura debe contener entre 1 y 100 ítems.")
    if not isinstance(recipient, dict):
        raise HTTPException(status_code=422, detail="Los datos del receptor son obligatorios.")
    item_total = Decimal("0")
    for item in items:
        if not isinstance(item, dict) or len(str(item.get("description") or "").strip()) < 3:
            raise HTTPException(status_code=422, detail="Hay un ítem fiscal incompleto.")
        value = item.get("total")
        try:
            raw_value_decimal = Decimal(str(value))
            value_decimal = raw_value_decimal.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            value_is_valid = raw_value_decimal == value_decimal
        except (InvalidOperation, TypeError, ValueError):
            value_decimal = Decimal("0")
            value_is_valid = False
        if value_decimal <= 0 or not value_is_valid:
            raise HTTPException(status_code=422, detail="Hay un importe de ítem inválido.")
        item_total += value_decimal
    if item_total != total_decimal:
        raise HTTPException(status_code=422, detail="La suma de ítems no coincide con el total.")

    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="El conector ARCA debe validarse en homologación antes de habilitar emisiones reales.",
    )


@app.post("/api/facturacion/comprobantes-c")
def issue_invoice_c_endpoint(payload: dict, request: Request):
    configuration = _arca_configuration_status()
    if not configuration["ready"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="La factura C requiere configuración, migración y homologación ARCA.",
        )
    try:
        service_config = FiscalServiceConfig(
            supabase_url=SUPABASE_URL,
            service_role_key=SUPABASE_SERVICE_ROLE_KEY,
            arca=ArcaConfig(
                environment=ARCA_ENVIRONMENT,
                cuit=ARCA_CUIT,
                point_of_sale=int(ARCA_POINT_OF_SALE),
                certificate_b64=ARCA_CERTIFICATE_B64,
                private_key_b64=ARCA_PRIVATE_KEY_B64,
            ),
            concept_code=int(ARCA_CONCEPT_CODE),
            item_vat_code=int(ARCA_ITEM_VAT_CODE),
            recipient_vat_code=int(ARCA_RECIPIENT_VAT_CODE),
            unit_code=int(ARCA_UNIT_CODE),
        )
        response_status, result = issue_invoice_c_service(
            service_config,
            payload,
            request.headers.get("idempotency-key", "").strip(),
            str(getattr(request.state, "session", {}).get("sub") or "sistema"),
        )
        result["issuer"] = {
            "businessName": ARCA_BUSINESS_NAME,
            "businessAddress": ARCA_BUSINESS_ADDRESS,
            "cuit": ARCA_CUIT,
            "grossIncome": ARCA_GROSS_INCOME,
            "activityStartDate": ARCA_ACTIVITY_START_DATE,
            "taxCondition": ARCA_TAX_CONDITION,
        }
        if response_status == 200:
            return result
        return JSONResponse(status_code=response_status, content=result)
    except FiscalValidationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc))


@app.post("/api/auth/login")
def login(payload: dict, request: Request):
    username = str(payload.get("username") or "").strip()
    password = payload.get("password")
    client_key = _login_client_key(request)

    retry_after = _login_retry_after(client_key)
    if retry_after:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos. Esperá antes de volver a intentar.",
            headers={"Retry-After": str(retry_after)},
        )

    if (
        not re.fullmatch(r"[A-Za-z0-9@._+\-]{3,254}", username)
        or not isinstance(password, str)
        or not 1 <= len(password) <= 128
    ):
        _record_login_failure(client_key)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="El formato de las credenciales no es válido.",
        )

    try:
        if SUPABASE_SERVICE_ROLE_KEY:
            result = call_service_rpc(
                "autenticar_usuario",
                {"p_username": username, "p_password": password},
            )
            user = result[0] if isinstance(result, list) and result else result if isinstance(result, dict) else None
        elif ALLOW_LEGACY_AUTH:
            # Compatibilidad temporal hasta aplicar la migración de hashes y RLS.
            # No habilitar este camino después de configurar service_role.
            user = execute_query(
                "SELECT * FROM usuarios WHERE (username = :u OR mail = :u) AND (password = :p OR contrasena = :p) LIMIT 1;",
                {"u": username, "p": password},
                fetch_one=True,
            )
        else:
            raise RuntimeError("La autenticación segura no está configurada.")

        if not user or not user.get("activo", True):
            _record_login_failure(client_key)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuario o contraseña incorrectos.",
            )

        _clear_login_failures(client_key)
        token, expires_at = create_session_token(user)
        return {
            "status": "success",
            "user": {
                "id": user.get("id_usuario"),
                "nombre": user.get("nombre"),
                "username": user.get("username"),
                "rol": user.get("rol"),
                "token": token,
                "expiresAt": expires_at,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[AUTH-ERROR] No se pudo validar el acceso: {type(e).__name__}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="El servicio de autenticación no está disponible. Intentá nuevamente en unos minutos.",
        )

if __name__ == "__main__":

    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
