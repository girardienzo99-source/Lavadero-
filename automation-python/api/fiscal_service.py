"""Orquestación persistente e idempotente de Factura C por CAE."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import re
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

import requests

from api.arca_client import ArcaConfig, ArcaError, ArcaTransportError, WsmtxcaClient, build_qr_url


@dataclass(frozen=True)
class FiscalServiceConfig:
    supabase_url: str
    service_role_key: str
    arca: ArcaConfig
    concept_code: int
    item_vat_code: int
    recipient_vat_code: int
    unit_code: int


class FiscalValidationError(RuntimeError):
    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code


def _headers(config: FiscalServiceConfig, prefer: str | None = None) -> dict[str, str]:
    headers = {
        "apikey": config.service_role_key,
        "Authorization": f"Bearer {config.service_role_key}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


def _request(config: FiscalServiceConfig, method: str, path: str, **kwargs) -> requests.Response:
    kwargs.setdefault("timeout", 20)
    kwargs.setdefault("headers", _headers(config))
    response = requests.request(method, f"{config.supabase_url}/rest/v1/{path}", **kwargs)
    response.raise_for_status()
    return response


def _rpc(config: FiscalServiceConfig, name: str, payload: dict) -> object:
    return _request(config, "POST", f"rpc/{name}", json=payload).json()


def _patch(config: FiscalServiceConfig, invoice_id: int, changes: dict) -> None:
    _request(
        config,
        "PATCH",
        f"facturas_electronicas?id=eq.{invoice_id}",
        headers=_headers(config, "return=minimal"),
        json={**changes, "actualizada_en": datetime.now(timezone.utc).isoformat()},
    )


def _decimal(value: Any, places: str) -> Decimal:
    try:
        raw = Decimal(str(value))
        normalized = raw.quantize(Decimal(places), rounding=ROUND_HALF_UP)
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise FiscalValidationError(422, "Hay cantidades o importes inválidos.") from exc
    if raw != normalized:
        raise FiscalValidationError(422, "Los importes tienen más decimales que los permitidos.")
    return normalized


def _result_response(
    config: FiscalServiceConfig,
    result: dict,
    total: Decimal,
    issue_date: str,
    document_type: int,
    document_number: str,
) -> dict:
    cae = str(result.get("cae") or "")
    number = int(result.get("invoice_number") or 0)
    qr = {
        "ver": 1,
        "fecha": issue_date,
        "cuit": int(config.arca.cuit),
        "ptoVta": config.arca.point_of_sale,
        "tipoCmp": 11,
        "nroCmp": number,
        "importe": str(total),
        "moneda": "PES",
        "ctz": 1,
        "tipoCodAut": "E",
        "codAut": int(cae),
    }
    if document_type != 99 and document_number != "0":
        qr["tipoDocRec"] = document_type
        qr["nroDocRec"] = int(document_number)
    return {
        "status": result["status"],
        "invoiceNumber": number,
        "pointOfSale": config.arca.point_of_sale,
        "cae": cae,
        "caeExpiration": result.get("cae_expiration"),
        "issueDate": issue_date,
        "qrUrl": build_qr_url(qr),
        "observations": result.get("observations") or [],
        "errors": result.get("errors") or [],
    }


def issue_invoice_c(
    config: FiscalServiceConfig,
    payload: dict,
    idempotency_key: str,
    actor: str,
) -> tuple[int, dict]:
    try:
        normalized_key = str(UUID(idempotency_key))
    except (ValueError, AttributeError) as exc:
        raise FiscalValidationError(422, "Idempotency-Key inválida o ausente.") from exc

    raw_transaction_id = payload.get("transactionId")
    if not isinstance(raw_transaction_id, (int, str)) or not str(raw_transaction_id).isdigit():
        raise FiscalValidationError(422, "El cobro confirmado es obligatorio.")
    transaction_id = int(raw_transaction_id)

    recipient = payload.get("recipient")
    items = payload.get("items")
    if not isinstance(recipient, dict):
        raise FiscalValidationError(422, "Los datos del receptor son obligatorios.")
    if not isinstance(items, list) or not 1 <= len(items) <= 100:
        raise FiscalValidationError(422, "La factura debe contener entre 1 y 100 ítems.")

    document_type = recipient.get("documentType")
    document_number = re.sub(r"\D", "", str(recipient.get("documentNumber") or ""))
    recipient_name = str(recipient.get("name") or "").strip()
    if document_type not in {80, 96, 99}:
        raise FiscalValidationError(422, "Tipo de documento receptor no permitido.")
    if document_type == 99:
        document_number, recipient_name = "0", "CONSUMIDOR FINAL"
    elif not 7 <= len(document_number) <= 11 or len(recipient_name) < 2:
        raise FiscalValidationError(422, "Documento o nombre del receptor inválidos.")

    try:
        movements = _request(
            config,
            "GET",
            f"caja_movimientos?id=eq.{transaction_id}&tipo=eq.INGRESO&select=id,monto,turno_id",
        ).json()
    except requests.RequestException as exc:
        raise FiscalValidationError(503, "No se pudo validar el cobro antes de facturar.") from exc
    if not isinstance(movements, list) or len(movements) != 1:
        raise FiscalValidationError(409, "El cobro no existe o no está confirmado.")
    total = _decimal(movements[0].get("monto"), "0.01")
    if total <= 0:
        raise FiscalValidationError(409, "El cobro confirmado tiene un importe inválido.")

    normalized_items: list[dict[str, Any]] = []
    item_total = Decimal("0")
    for item in items:
        if not isinstance(item, dict) or len(str(item.get("description") or "").strip()) < 3:
            raise FiscalValidationError(422, "Hay un ítem fiscal incompleto.")
        quantity = _decimal(item.get("quantity"), "0.0001")
        unit_price = _decimal(item.get("unitPrice"), "0.0001")
        line_total = _decimal(item.get("total"), "0.01")
        if quantity <= 0 or unit_price < 0 or line_total <= 0:
            raise FiscalValidationError(422, "Hay un importe de ítem inválido.")
        if (quantity * unit_price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) != line_total:
            raise FiscalValidationError(422, "Cantidad, precio e importe del ítem no coinciden.")
        item_total += line_total
        normalized_items.append({
            "internalCode": str(item.get("internalCode") or f"TX-{transaction_id}")[:30],
            "description": str(item["description"]).strip()[:200],
            "quantity": str(quantity),
            "unitCode": config.unit_code,
            "unitPrice": str(unit_price),
            "total": str(line_total),
        })
    if item_total != total:
        raise FiscalValidationError(422, "La suma de ítems no coincide con el cobro confirmado.")

    issue_date = datetime.now(ZoneInfo("America/Argentina/Buenos_Aires")).date().isoformat()
    try:
        draft = _rpc(config, "crear_borrador_factura_c", {
            "p_idempotency_key": normalized_key,
            "p_transaccion_id": str(transaction_id),
            "p_punto_venta": config.arca.point_of_sale,
            "p_ambiente": config.arca.environment,
            "p_fecha_emision": issue_date,
            "p_receptor_tipo_documento": document_type,
            "p_receptor_numero_documento": document_number,
            "p_receptor_nombre": recipient_name,
            "p_importe_total": str(total),
            "p_items": normalized_items,
            "p_actor": actor,
        })
    except requests.HTTPError as exc:
        code = exc.response.status_code if exc.response is not None else 0
        raise FiscalValidationError(
            409 if code == 400 else 503,
            "Existe otra emisión en curso o la migración fiscal no está aplicada.",
        ) from exc
    if not isinstance(draft, dict) or draft.get("factura_id") is None:
        raise FiscalValidationError(503, "No se creó el registro fiscal auditable.")

    invoice_id = int(draft["factura_id"])
    if draft.get("idempotent_replay"):
        state = draft.get("estado")
        replay_issue_date = str(draft.get("fecha_emision") or issue_date)
        if state in {"authorized", "observed"} and draft.get("cae"):
            return 200, _result_response(config, {
                "status": state,
                "invoice_number": draft.get("numero_comprobante"),
                "cae": draft.get("cae"),
                "cae_expiration": draft.get("cae_vencimiento"),
                "observations": draft.get("observaciones") or [],
                "errors": draft.get("errores") or [],
            }, total, replay_issue_date, document_type, document_number)
        return (202 if state == "uncertain" else 409), {
            "status": state,
            "message": "La operación ya fue procesada; no se reenviará a ARCA.",
        }

    client = WsmtxcaClient(config.arca)
    number = 0
    try:
        number = client.last_authorized(11) + 1
        request_snapshot = {
            "number": number,
            "issue_date": issue_date,
            "document_type": document_type,
            "document_number": document_number,
            "recipient_vat_condition": config.recipient_vat_code,
            "concept_code": config.concept_code,
            "total": str(total),
            "items": [{
                "internal_code": item["internalCode"],
                "description": item["description"],
                "quantity": item["quantity"],
                "unit_code": item["unitCode"],
                "unit_price": item["unitPrice"],
                "vat_condition_code": config.item_vat_code,
                "total": item["total"],
            } for item in normalized_items],
        }
        _patch(config, invoice_id, {"numero_comprobante": number, "solicitud_arca": request_snapshot})
        result = client.authorize(request_snapshot)
    except ArcaTransportError as exc:
        if exc.uncertain and number:
            try:
                result = client.consult(number)
            except ArcaError:
                result = None
            if not result or not result.get("cae"):
                _patch(config, invoice_id, {
                    "estado": "uncertain",
                    "errores": ["Resultado incierto: reconciliar con consultarComprobante."],
                })
                return 202, {
                    "status": "uncertain",
                    "invoiceNumber": number,
                    "pointOfSale": config.arca.point_of_sale,
                    "errors": ["ARCA no confirmó el resultado. No reintentes esta operación."],
                }
        else:
            _patch(config, invoice_id, {"estado": "rejected", "errores": [str(exc)]})
            raise FiscalValidationError(503, "No se pudo conectar con ARCA antes de autorizar.") from exc
    except ArcaError as exc:
        _patch(config, invoice_id, {"estado": "rejected", "errores": [str(exc)]})
        raise FiscalValidationError(502, f"ARCA rechazó la solicitud: {exc}") from exc

    state = result.get("status") if isinstance(result, dict) else "rejected"
    _patch(config, invoice_id, {
        "estado": state,
        "resultado_arca": result.get("result") if isinstance(result, dict) else "R",
        "cae": result.get("cae") if isinstance(result, dict) else None,
        "cae_vencimiento": result.get("cae_expiration") if isinstance(result, dict) else None,
        "observaciones": result.get("observations") if isinstance(result, dict) else [],
        "errores": result.get("errors") if isinstance(result, dict) else ["Respuesta ARCA inválida"],
        "respuesta_arca": result if isinstance(result, dict) else {},
    })
    if state in {"authorized", "observed"} and result.get("cae"):
        return 200, _result_response(config, result, total, issue_date, document_type, document_number)
    return 422, {
        "status": "rejected",
        "invoiceNumber": number,
        "pointOfSale": config.arca.point_of_sale,
        "observations": result.get("observations") or [],
        "errors": result.get("errors") or ["ARCA no autorizó el comprobante."],
    }
