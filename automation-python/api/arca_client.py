"""Cliente mínimo y auditable para WSAA + WSMTXCA (CAE).

No persiste secretos, no genera autorizaciones ficticias y diferencia fallas
previas al envío de resultados inciertos posteriores al envío.
"""

from __future__ import annotations

import base64
import json
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any
from xml.etree import ElementTree as ET

import requests
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.serialization import pkcs7


SOAP_NS = "http://schemas.xmlsoap.org/soap/envelope/"
WSMTXCA_NS = "http://impl.service.wsmtxca.afip.gov.ar/service/"
WSAA_LOGIN_NS = "http://wsaa.view.sua.dvadac.desein.afip.gov"
QR_BASE_URL = "https://www.arca.gob.ar/fe/qr/?p="

ENDPOINTS = {
    "homologacion": {
        "wsaa": "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
        "wsmtxca": "https://fwshomo.afip.gov.ar/wsmtxca/services/MTXCAService",
    },
    "produccion": {
        "wsaa": "https://wsaa.afip.gov.ar/ws/services/LoginCms",
        "wsmtxca": "https://serviciosjava.afip.gob.ar/wsmtxca/services/MTXCAService",
    },
}


class ArcaError(RuntimeError):
    pass


class ArcaTransportError(ArcaError):
    def __init__(self, message: str, *, uncertain: bool = False):
        super().__init__(message)
        self.uncertain = uncertain


@dataclass(frozen=True)
class ArcaConfig:
    environment: str
    cuit: str
    point_of_sale: int
    certificate_b64: str
    private_key_b64: str
    request_timeout: int = 25

    def validate(self) -> None:
        if self.environment not in ENDPOINTS:
            raise ArcaError("Ambiente ARCA inválido.")
        if len(self.cuit) != 11 or not self.cuit.isdigit():
            raise ArcaError("CUIT emisor inválido.")
        if not 1 <= self.point_of_sale <= 99998:
            raise ArcaError("Punto de venta inválido.")
        if not self.certificate_b64 or not self.private_key_b64:
            raise ArcaError("Certificado y clave privada son obligatorios.")


@dataclass
class AccessTicket:
    token: str
    sign: str
    expires_at: datetime


_ticket_cache: dict[tuple[str, str], AccessTicket] = {}
_ticket_lock = threading.Lock()


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _find_text(root: ET.Element, name: str) -> str | None:
    for element in root.iter():
        if _local_name(element.tag) == name:
            return element.text
    return None


def _money(value: Any) -> Decimal:
    try:
        result = Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except Exception as exc:
        raise ArcaError("Importe decimal inválido.") from exc
    if result < 0:
        raise ArcaError("Los importes no pueden ser negativos.")
    return result


def build_tra(service: str = "wsmtxca", now: datetime | None = None) -> bytes:
    current = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    root = ET.Element("loginTicketRequest", {"version": "1.0"})
    header = ET.SubElement(root, "header")
    ET.SubElement(header, "uniqueId").text = str(int(current.timestamp()))
    ET.SubElement(header, "generationTime").text = (current - timedelta(minutes=10)).isoformat(timespec="seconds")
    ET.SubElement(header, "expirationTime").text = (current + timedelta(minutes=10)).isoformat(timespec="seconds")
    ET.SubElement(root, "service").text = service
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def _load_certificate(raw: bytes) -> x509.Certificate:
    try:
        return x509.load_pem_x509_certificate(raw)
    except ValueError:
        return x509.load_der_x509_certificate(raw)


def _load_private_key(raw: bytes):
    try:
        return serialization.load_pem_private_key(raw, password=None)
    except ValueError:
        return serialization.load_der_private_key(raw, password=None)


def sign_tra(tra: bytes, certificate_b64: str, private_key_b64: str) -> str:
    certificate = _load_certificate(base64.b64decode(certificate_b64, validate=True))
    private_key = _load_private_key(base64.b64decode(private_key_b64, validate=True))
    cms = (
        pkcs7.PKCS7SignatureBuilder()
        .set_data(tra)
        .add_signer(certificate, private_key, hashes.SHA256())
        .sign(serialization.Encoding.DER, [pkcs7.PKCS7Options.Binary])
    )
    return base64.b64encode(cms).decode("ascii")


def _soap_envelope(body_element: ET.Element) -> bytes:
    envelope = ET.Element(ET.QName(SOAP_NS, "Envelope"))
    ET.SubElement(envelope, ET.QName(SOAP_NS, "Header"))
    body = ET.SubElement(envelope, ET.QName(SOAP_NS, "Body"))
    body.append(body_element)
    return ET.tostring(envelope, encoding="utf-8", xml_declaration=True)


def _post_soap(url: str, action: str, payload: bytes, timeout: int, *, uncertain_on_timeout: bool) -> ET.Element:
    try:
        response = requests.post(
            url,
            data=payload,
            headers={"Content-Type": "text/xml; charset=utf-8", "SOAPAction": action},
            timeout=timeout,
        )
        response.raise_for_status()
    except requests.Timeout as exc:
        raise ArcaTransportError("ARCA no respondió dentro del tiempo esperado.", uncertain=uncertain_on_timeout) from exc
    except requests.RequestException as exc:
        raise ArcaTransportError("No se pudo comunicar con ARCA.", uncertain=uncertain_on_timeout) from exc
    try:
        root = ET.fromstring(response.content)
    except ET.ParseError as exc:
        raise ArcaTransportError("ARCA devolvió XML inválido.", uncertain=uncertain_on_timeout) from exc
    fault = next((item for item in root.iter() if _local_name(item.tag) == "Fault"), None)
    if fault is not None:
        description = _find_text(fault, "faultstring") or "ARCA devolvió un SOAP Fault."
        raise ArcaError(description)
    return root


def login_wsaa(config: ArcaConfig) -> AccessTicket:
    config.validate()
    cache_key = (config.environment, config.cuit)
    with _ticket_lock:
        cached = _ticket_cache.get(cache_key)
        if cached and cached.expires_at > datetime.now(timezone.utc) + timedelta(minutes=2):
            return cached

        cms = sign_tra(build_tra(), config.certificate_b64, config.private_key_b64)
        login = ET.Element(ET.QName(WSAA_LOGIN_NS, "loginCms"))
        ET.SubElement(login, "in0").text = cms
        root = _post_soap(
            ENDPOINTS[config.environment]["wsaa"], "", _soap_envelope(login),
            config.request_timeout, uncertain_on_timeout=False,
        )
        encoded_ticket = _find_text(root, "loginCmsReturn")
        if not encoded_ticket:
            raise ArcaError("WSAA no devolvió el ticket de acceso.")
        ticket_xml = ET.fromstring(encoded_ticket)
        token = _find_text(ticket_xml, "token")
        sign = _find_text(ticket_xml, "sign")
        expiration = _find_text(ticket_xml, "expirationTime")
        if not token or not sign or not expiration:
            raise ArcaError("El ticket de WSAA está incompleto.")
        expires_at = datetime.fromisoformat(expiration.replace("Z", "+00:00")).astimezone(timezone.utc)
        ticket = AccessTicket(token=token, sign=sign, expires_at=expires_at)
        _ticket_cache[cache_key] = ticket
        return ticket


def _auth(parent: ET.Element, ticket: AccessTicket, cuit: str) -> None:
    auth = ET.SubElement(parent, "authRequest")
    ET.SubElement(auth, "token").text = ticket.token
    ET.SubElement(auth, "sign").text = ticket.sign
    ET.SubElement(auth, "cuitRepresentada").text = cuit


class WsmtxcaClient:
    def __init__(self, config: ArcaConfig):
        config.validate()
        self.config = config

    def _call(self, method: str, request_element: ET.Element, *, authorizing: bool = False) -> ET.Element:
        return _post_soap(
            ENDPOINTS[self.config.environment]["wsmtxca"],
            f"{WSMTXCA_NS}{method}",
            _soap_envelope(request_element),
            self.config.request_timeout,
            uncertain_on_timeout=authorizing,
        )

    def dummy(self) -> dict[str, str | None]:
        request = ET.Element(ET.QName(WSMTXCA_NS, "dummy"))
        root = self._call("dummy", request)
        return {name: _find_text(root, name) for name in ("appserver", "authserver", "dbserver")}

    def last_authorized(self, invoice_type: int = 11) -> int:
        ticket = login_wsaa(self.config)
        request = ET.Element(ET.QName(WSMTXCA_NS, "consultarUltimoComprobanteAutorizadoRequest"))
        _auth(request, ticket, self.config.cuit)
        query = ET.SubElement(request, "consultaUltimoComprobanteAutorizadoRequest")
        ET.SubElement(query, "codigoTipoComprobante").text = str(invoice_type)
        ET.SubElement(query, "numeroPuntoVenta").text = str(self.config.point_of_sale)
        root = self._call("consultarUltimoComprobanteAutorizado", request)
        errors = parse_codes(root, "arrayErrores")
        if errors:
            raise ArcaError("; ".join(errors))
        value = _find_text(root, "numeroComprobante")
        return int(value or 0)

    def consult(self, number: int, invoice_type: int = 11) -> dict[str, Any] | None:
        ticket = login_wsaa(self.config)
        request = ET.Element(ET.QName(WSMTXCA_NS, "consultarComprobanteRequest"))
        _auth(request, ticket, self.config.cuit)
        query = ET.SubElement(request, "consultaComprobanteRequest")
        ET.SubElement(query, "codigoTipoComprobante").text = str(invoice_type)
        ET.SubElement(query, "numeroPuntoVenta").text = str(self.config.point_of_sale)
        ET.SubElement(query, "numeroComprobante").text = str(number)
        root = self._call("consultarComprobante", request)
        if parse_codes(root, "arrayErrores"):
            return None
        return parse_authorization_response(root)

    def authorize(self, invoice: dict[str, Any]) -> dict[str, Any]:
        ticket = login_wsaa(self.config)
        request = ET.Element(ET.QName(WSMTXCA_NS, "autorizarComprobanteRequest"))
        _auth(request, ticket, self.config.cuit)
        voucher = ET.SubElement(request, "comprobanteCAERequest")
        ordered = (
            ("codigoTipoComprobante", 11),
            ("numeroPuntoVenta", self.config.point_of_sale),
            ("numeroComprobante", invoice["number"]),
            ("fechaEmision", invoice["issue_date"]),
            ("codigoTipoDocumento", invoice["document_type"]),
            ("numeroDocumento", invoice["document_number"]),
            ("condicionIVAReceptor", invoice["recipient_vat_condition"]),
            ("importeSubtotal", _money(invoice["total"])),
            ("importeTotal", _money(invoice["total"])),
            ("codigoMoneda", "PES"),
            ("cotizacionMoneda", "1"),
            ("codigoConcepto", invoice["concept_code"]),
        )
        for name, value in ordered:
            ET.SubElement(voucher, name).text = str(value)
        items_node = ET.SubElement(voucher, "arrayItems")
        for item in invoice["items"]:
            item_node = ET.SubElement(items_node, "item")
            fields = (
                ("codigo", item["internal_code"]),
                ("descripcion", item["description"]),
                ("cantidad", item["quantity"]),
                ("codigoUnidadMedida", item["unit_code"]),
                ("precioUnitario", item["unit_price"]),
                ("codigoCondicionIVA", item["vat_condition_code"]),
                ("importeItem", item["total"]),
            )
            for name, value in fields:
                ET.SubElement(item_node, name).text = str(value)
        root = self._call("autorizarComprobante", request, authorizing=True)
        return parse_authorization_response(root)


def parse_codes(root: ET.Element, container_name: str) -> list[str]:
    results: list[str] = []
    for container in root.iter():
        if _local_name(container.tag) != container_name:
            continue
        for item in list(container):
            code = _find_text(item, "codigo")
            description = _find_text(item, "descripcion")
            if code or description:
                results.append(f"{code or '-'}: {description or 'Sin descripción'}")
    return results


def parse_authorization_response(root: ET.Element) -> dict[str, Any]:
    authorization_code = _find_text(root, "CAE") or _find_text(root, "codigoAutorizacion")
    # consultarComprobante no incluye el campo `resultado`; la presencia de una
    # autorización vigente es la confirmación necesaria para reconciliar.
    result = (_find_text(root, "resultado") or ("A" if authorization_code else "R")).strip().upper()
    status = {"A": "authorized", "O": "observed", "R": "rejected"}.get(result, "rejected")
    return {
        "status": status,
        "result": result,
        "invoice_number": int(_find_text(root, "numeroComprobante") or 0),
        "cae": authorization_code,
        "authorization_type": _find_text(root, "codigoTipoAutorizacion") or "E",
        "cae_expiration": _find_text(root, "fechaVencimientoCAE") or _find_text(root, "fechaVencimiento"),
        "observations": parse_codes(root, "arrayObservaciones"),
        "errors": parse_codes(root, "arrayErrores"),
    }


def build_qr_url(payload: dict[str, Any]) -> str:
    required = {"ver", "fecha", "cuit", "ptoVta", "tipoCmp", "nroCmp", "importe", "moneda", "ctz", "tipoCodAut", "codAut"}
    if not required.issubset(payload):
        raise ArcaError("Faltan campos obligatorios del QR fiscal.")
    if payload.get("tipoCodAut") not in {"E", "A"}:
        raise ArcaError("Tipo de autorización del QR inválido.")
    if len(str(payload.get("codAut"))) != 14:
        raise ArcaError("El código de autorización del QR debe tener 14 dígitos.")
    document_fields = ("tipoDocRec", "nroDocRec")
    if sum(field in payload for field in document_fields) == 1:
        raise ArcaError("Los datos del receptor deben incluirse juntos.")
    normalized = dict(payload)
    normalized["importe"] = float(_money(payload["importe"]))
    compact = json.dumps(normalized, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return QR_BASE_URL + base64.b64encode(compact).decode("ascii")
