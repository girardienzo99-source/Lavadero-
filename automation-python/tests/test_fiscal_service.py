import sys
import unittest
from pathlib import Path
from unittest.mock import patch


AUTOMATION_ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(AUTOMATION_ROOT))

from api.arca_client import ArcaConfig, ArcaTransportError  # noqa: E402
from api.fiscal_service import (  # noqa: E402
    FiscalServiceConfig,
    FiscalValidationError,
    issue_invoice_c,
)


class JsonResponse:
    def __init__(self, data):
        self.data = data

    def json(self):
        return self.data


class FiscalServiceUnitTests(unittest.TestCase):
    def setUp(self):
        self.config = FiscalServiceConfig(
            supabase_url="https://project.supabase.co",
            service_role_key="server-only-test-key",
            arca=ArcaConfig(
                environment="homologacion",
                cuit="20123456789",
                point_of_sale=4,
                certificate_b64="certificate",
                private_key_b64="private-key",
            ),
            concept_code=2,
            item_vat_code=3,
            recipient_vat_code=5,
            unit_code=7,
        )
        self.payload = {
            "transactionId": 81,
            "recipient": {
                "documentType": 99,
                "documentNumber": "0",
                "name": "CONSUMIDOR FINAL",
            },
            "items": [{
                "internalCode": "LAV-1",
                "description": "Lavado completo",
                "quantity": "1.0000",
                "unitPrice": "12500.0000",
                "total": "12500.00",
            }],
        }
        self.key = "58f3c39a-f716-4cc4-9ed9-3d4b0cb88d70"

    @patch("api.fiscal_service._request")
    def test_total_is_derived_from_confirmed_cash_movement(self, request_mock):
        request_mock.return_value = JsonResponse([{"id": 81, "monto": "13000.00", "turno_id": 7}])
        with self.assertRaises(FiscalValidationError) as context:
            issue_invoice_c(self.config, self.payload, self.key, "operator-1")
        self.assertEqual(context.exception.status_code, 422)
        self.assertIn("cobro confirmado", str(context.exception))

    @patch("api.fiscal_service._patch")
    @patch("api.fiscal_service._rpc")
    @patch("api.fiscal_service._request")
    @patch("api.fiscal_service.WsmtxcaClient")
    def test_authorized_invoice_persists_cae_and_builds_qr(self, client_class, request_mock, rpc_mock, patch_mock):
        request_mock.return_value = JsonResponse([{"id": 81, "monto": "12500.00", "turno_id": 7}])
        rpc_mock.return_value = {"factura_id": 9, "estado": "authorizing", "idempotent_replay": False}
        client = client_class.return_value
        client.last_authorized.return_value = 41
        client.authorize.return_value = {
            "status": "authorized",
            "result": "A",
            "invoice_number": 42,
            "cae": "74123456789012",
            "cae_expiration": "2026-07-29",
            "observations": [],
            "errors": [],
        }

        status_code, result = issue_invoice_c(self.config, self.payload, self.key, "operator-1")

        self.assertEqual(status_code, 200)
        self.assertEqual(result["status"], "authorized")
        self.assertIn("www.arca.gob.ar/fe/qr/", result["qrUrl"])
        self.assertEqual(client.authorize.call_args.args[0]["total"], "12500.00")
        self.assertTrue(any(call.args[2].get("cae") == "74123456789012" for call in patch_mock.mock_calls))

    @patch("api.fiscal_service._patch")
    @patch("api.fiscal_service._rpc")
    @patch("api.fiscal_service._request")
    @patch("api.fiscal_service.WsmtxcaClient")
    def test_uncertain_authorization_is_reconciled_before_returning(self, client_class, request_mock, rpc_mock, patch_mock):
        request_mock.return_value = JsonResponse([{"id": 81, "monto": "12500.00", "turno_id": 7}])
        rpc_mock.return_value = {"factura_id": 9, "estado": "authorizing", "idempotent_replay": False}
        client = client_class.return_value
        client.last_authorized.return_value = 41
        client.authorize.side_effect = ArcaTransportError("timeout", uncertain=True)
        client.consult.return_value = {
            "status": "authorized",
            "result": "A",
            "invoice_number": 42,
            "cae": "74123456789012",
            "cae_expiration": "2026-07-29",
            "observations": [],
            "errors": [],
        }

        status_code, result = issue_invoice_c(self.config, self.payload, self.key, "operator-1")

        self.assertEqual(status_code, 200)
        self.assertEqual(result["invoiceNumber"], 42)
        client.consult.assert_called_once_with(42)
        self.assertFalse(any(call.args[2].get("estado") == "uncertain" for call in patch_mock.mock_calls))


if __name__ == "__main__":
    unittest.main()
