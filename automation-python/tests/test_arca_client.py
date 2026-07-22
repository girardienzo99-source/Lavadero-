import base64
import json
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET


AUTOMATION_ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(AUTOMATION_ROOT))

from api.arca_client import (  # noqa: E402
    ArcaError,
    build_qr_url,
    build_tra,
    parse_authorization_response,
)


class ArcaClientUnitTests(unittest.TestCase):
    def test_tra_uses_utc_window_and_service(self):
        now = datetime(2026, 7, 19, 15, 30, tzinfo=timezone.utc)
        root = ET.fromstring(build_tra(now=now))
        self.assertEqual(root.findtext("service"), "wsmtxca")
        self.assertEqual(root.findtext("header/generationTime"), "2026-07-19T15:20:00+00:00")
        self.assertEqual(root.findtext("header/expirationTime"), "2026-07-19T15:40:00+00:00")

    def test_consult_response_with_authorization_is_authorized(self):
        root = ET.fromstring("""
          <consultarComprobanteResponse>
            <comprobante>
              <numeroComprobante>42</numeroComprobante>
              <codigoTipoAutorizacion>E</codigoTipoAutorizacion>
              <codigoAutorizacion>74123456789012</codigoAutorizacion>
              <fechaVencimiento>2026-07-29</fechaVencimiento>
            </comprobante>
          </consultarComprobanteResponse>
        """)
        result = parse_authorization_response(root)
        self.assertEqual(result["status"], "authorized")
        self.assertEqual(result["invoice_number"], 42)
        self.assertEqual(result["cae"], "74123456789012")

    def test_rejected_response_preserves_errors(self):
        root = ET.fromstring("""
          <autorizarComprobanteResponse>
            <resultado>R</resultado>
            <arrayErrores><codigoDescripcion><codigo>100</codigo><descripcion>Dato inválido</descripcion></codigoDescripcion></arrayErrores>
          </autorizarComprobanteResponse>
        """)
        result = parse_authorization_response(root)
        self.assertEqual(result["status"], "rejected")
        self.assertEqual(result["errors"], ["100: Dato inválido"])

    def test_qr_contains_paired_recipient_and_real_authorization(self):
        url = build_qr_url({
            "ver": 1,
            "fecha": "2026-07-19",
            "cuit": 20123456789,
            "ptoVta": 4,
            "tipoCmp": 11,
            "nroCmp": 42,
            "importe": "12500.00",
            "moneda": "PES",
            "ctz": 1,
            "tipoDocRec": 96,
            "nroDocRec": 30123456,
            "tipoCodAut": "E",
            "codAut": 74123456789012,
        })
        encoded = url.split("?p=", 1)[1]
        decoded = json.loads(base64.b64decode(encoded))
        self.assertEqual(decoded["tipoCmp"], 11)
        self.assertEqual(decoded["codAut"], 74123456789012)
        self.assertEqual(decoded["importe"], 12500.0)

    def test_qr_rejects_partial_recipient(self):
        with self.assertRaises(ArcaError):
            build_qr_url({
                "ver": 1, "fecha": "2026-07-19", "cuit": 20123456789,
                "ptoVta": 4, "tipoCmp": 11, "nroCmp": 42, "importe": 100,
                "moneda": "PES", "ctz": 1, "tipoDocRec": 96,
                "tipoCodAut": "E", "codAut": 74123456789012,
            })


if __name__ == "__main__":
    unittest.main()
