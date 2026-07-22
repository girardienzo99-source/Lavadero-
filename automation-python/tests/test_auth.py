import importlib.util
import os
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient
from requests import HTTPError


os.environ["APP_SESSION_SECRET"] = "test-session-secret-with-at-least-32-characters"

MODULE_PATH = Path(__file__).parents[1] / "api" / "main.py"
SPEC = importlib.util.spec_from_file_location("lavadero_api_auth_test", MODULE_PATH)
api = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(api)


class AuthSecurityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(api.app)

    def setUp(self):
        api._login_attempts.clear()

    def test_token_round_trip(self):
        token, expires_at = api.create_session_token(
            {"id_usuario": 7, "nombre": "Operador", "rol": "cajero"}
        )
        claims = api.verify_session_token(token)
        self.assertEqual(claims["sub"], "7")
        self.assertEqual(claims["role"], "cajero")
        self.assertEqual(claims["exp"], expires_at)

    def test_tampered_token_is_rejected(self):
        token, _ = api.create_session_token(
            {"id_usuario": 7, "nombre": "Operador", "rol": "cajero"}
        )
        with self.assertRaises(ValueError):
            api.verify_session_token(token + "changed")

    def test_unknown_role_cannot_receive_session(self):
        with self.assertRaises(ValueError):
            api.create_session_token(
                {"id_usuario": 9, "nombre": "Intruso", "rol": "unknown-role"}
            )

    def test_internal_api_rejects_anonymous_requests(self):
        response = self.client.get("/api/dashboard-data")
        self.assertEqual(response.status_code, 401)
        self.assertTrue(response.headers.get("x-request-id"))
        self.assertEqual(response.headers["x-content-type-options"], "nosniff")

    def test_health_is_public_and_hardened(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["x-content-type-options"], "nosniff")
        self.assertEqual(response.headers["cache-control"], "no-store")

    def test_lavador_cannot_operate_cashbox(self):
        token, _ = api.create_session_token(
            {"id_usuario": 8, "nombre": "Lavador", "rol": "lavador"}
        )
        response = self.client.post(
            "/api/caja/abrir?montoApertura=1000",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(response.status_code, 403)

    def test_fiscal_configuration_never_exposes_secrets(self):
        token, _ = api.create_session_token(
            {"id_usuario": 7, "nombre": "Caja", "rol": "cajero"}
        )
        with (
            patch.object(api, "ARCA_CERTIFICATE_B64", "certificate-secret"),
            patch.object(api, "ARCA_PRIVATE_KEY_B64", "private-key-secret"),
        ):
            response = self.client.get(
                "/api/facturacion/configuracion",
                headers={"Authorization": f"Bearer {token}"},
            )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        serialized = str(body)
        self.assertNotIn("certificate-secret", serialized)
        self.assertNotIn("private-key-secret", serialized)
        self.assertIn("ready", body)

    def test_invoice_c_fails_closed_without_arca_configuration(self):
        token, _ = api.create_session_token(
            {"id_usuario": 7, "nombre": "Caja", "rol": "cajero"}
        )
        response = self.client.post(
            "/api/facturacion/comprobantes-c",
            headers={
                "Authorization": f"Bearer {token}",
                "Idempotency-Key": "809e252a-6499-416b-b2bf-cbe43bb7028c",
            },
            json={
                "total": 1000,
                "recipient": {"condition": "CONSUMIDOR_FINAL"},
                "items": [{"description": "Lavado", "total": 1000}],
            },
        )
        self.assertEqual(response.status_code, 503)

    def test_lavador_cannot_issue_invoice_c(self):
        token, _ = api.create_session_token(
            {"id_usuario": 8, "nombre": "Lavador", "rol": "lavador"}
        )
        response = self.client.post(
            "/api/facturacion/comprobantes-c",
            headers={
                "Authorization": f"Bearer {token}",
                "Idempotency-Key": "49be2fcb-31d7-4da7-9796-0f3404a09cbd",
            },
            json={
                "total": 1000,
                "recipient": {"condition": "CONSUMIDOR_FINAL"},
                "items": [{"description": "Lavado", "total": 1000}],
            },
        )
        self.assertEqual(response.status_code, 403)

    def test_legacy_analytics_routes_are_not_exposed(self):
        self.assertEqual(self.client.get("/segmentacion").status_code, 404)
        self.assertEqual(self.client.get("/nps").status_code, 404)

    def test_client_creation_never_returns_fake_success(self):
        with patch.object(api, "execute_query", side_effect=RuntimeError("db offline")):
            with self.assertRaises(api.HTTPException) as context:
                api.new_client("Cliente Real", "+5492600000000")
        self.assertEqual(context.exception.status_code, 503)

    def test_vehicle_creation_never_returns_fake_success(self):
        with patch.object(api, "execute_query", side_effect=RuntimeError("db offline")):
            with self.assertRaises(api.HTTPException) as context:
                api.new_vehicle(1, "AB123CD", "Toyota", "Corolla")
        self.assertEqual(context.exception.status_code, 503)

    def test_unknown_rest_query_fails_closed(self):
        with self.assertRaises(RuntimeError):
            api.execute_query_rest("DROP TABLE clientes")

    def test_supabase_http_error_is_not_silenced(self):
        response = type(
            "FailedResponse",
            (),
            {"raise_for_status": lambda self: (_ for _ in ()).throw(HTTPError("denied"))},
        )()
        with patch.object(api.requests, "request", return_value=response):
            with self.assertRaises(HTTPError):
                api.rest_request("POST", "https://example.test/rest/v1/clientes")

    def test_invalid_login_uses_http_error_status(self):
        with patch.object(api, "execute_query", return_value=None):
            response = self.client.post(
                "/api/auth/login",
                json={"username": "invalid", "password": "invalid"},
            )
        self.assertEqual(response.status_code, 401)

    def test_login_rejects_postgrest_filter_injection(self):
        with patch.object(api, "execute_query") as execute:
            response = self.client.post(
                "/api/auth/login",
                json={"username": "admin),activo.eq.true", "password": "invalid"},
            )
        self.assertEqual(response.status_code, 422)
        execute.assert_not_called()

    def test_login_rate_limit_blocks_sixth_failure(self):
        with patch.object(api, "execute_query", return_value=None):
            responses = [
                self.client.post(
                    "/api/auth/login",
                    json={"username": "invalid", "password": "invalid"},
                )
                for _ in range(api.LOGIN_MAX_ATTEMPTS + 1)
            ]
        self.assertEqual(responses[-2].status_code, 401)
        self.assertEqual(responses[-1].status_code, 429)
        self.assertTrue(responses[-1].headers.get("retry-after"))

    def test_oversized_request_is_rejected_before_handler(self):
        response = self.client.post(
            "/api/auth/login",
            headers={"Content-Length": str(api.MAX_REQUEST_BYTES + 1)},
            content=b"{}",
        )
        self.assertEqual(response.status_code, 413)
        self.assertTrue(response.headers.get("x-request-id"))

    def test_turno_transition_has_no_financial_side_effects(self):
        with patch.object(
            api,
            "execute_query",
            side_effect=[
                {"id": 12, "estado": "EN_PROCESO"},
                [{"id": 12, "estado": "COMPLETADO"}],
            ],
        ) as execute:
            result = api.update_appointment_status(12, "COMPLETADO")

        self.assertEqual(result["estado"], "COMPLETADO")
        self.assertEqual(execute.call_count, 2)
        executed_sql = " ".join(call.args[0] for call in execute.call_args_list).lower()
        self.assertNotIn("caja_movimientos", executed_sql)
        self.assertNotIn("update productos", executed_sql)

    def test_invalid_turno_transition_is_rejected(self):
        with patch.object(
            api,
            "execute_query",
            return_value={"id": 12, "estado": "PENDIENTE"},
        ) as execute:
            with self.assertRaises(api.HTTPException) as context:
                api.update_appointment_status(12, "ENTREGADO")

        self.assertEqual(context.exception.status_code, 409)
        self.assertEqual(execute.call_count, 1)

    def test_reprogram_rest_adapter_updates_date_and_employee(self):
        response = Mock()
        response.json.return_value = [{"id": 12}]
        with (
            patch.object(api, "SUPABASE_URL", "https://example.test"),
            patch.object(api, "SUPABASE_ANON_KEY", "public-test-key"),
            patch.object(api, "rest_request", return_value=response) as request,
        ):
            result = api.execute_query_rest(
                "UPDATE turnos SET empleado_id = :e, fecha_hora = :f WHERE id = :id;",
                {"e": 4, "f": "2026-08-01 10:30:00", "id": 12},
            )

        self.assertEqual(result[0]["id"], 12)
        self.assertEqual(
            request.call_args.kwargs["json"],
            {"empleado_id": 4, "fecha_hora": "2026-08-01 10:30:00"},
        )

    def test_commission_rest_adapter_does_not_clear_employee_status(self):
        response = Mock()
        response.json.return_value = [{"id": 4, "porcentaje_comision": 25}]
        with (
            patch.object(api, "SUPABASE_URL", "https://example.test"),
            patch.object(api, "SUPABASE_ANON_KEY", "public-test-key"),
            patch.object(api, "rest_request", return_value=response) as request,
        ):
            api.execute_query_rest(
                "UPDATE empleados SET porcentaje_comision = :porcentaje_comision WHERE id = :id;",
                {"porcentaje_comision": 25, "id": 4},
            )

        self.assertEqual(request.call_args.kwargs["json"], {"porcentaje_comision": 25.0})

    def test_pos_fails_closed_without_transactional_credentials(self):
        request = Mock()
        request.headers = {"idempotency-key": "ef77e137-b987-4e44-a782-0408ce3b62d7"}
        payload = {
            "clienteId": None,
            "metodoPago": "EFECTIVO",
            "detalles": [{"productoId": 1, "cantidad": 1}],
            "codigoCupon": None,
        }
        with patch.object(api, "SUPABASE_SERVICE_ROLE_KEY", ""):
            with self.assertRaises(api.HTTPException) as context:
                api.register_sale(payload, request)
        self.assertEqual(context.exception.status_code, 503)

    def test_pos_uses_single_transactional_rpc(self):
        request = Mock()
        request.headers = {"idempotency-key": "ef77e137-b987-4e44-a782-0408ce3b62d7"}
        payload = {
            "clienteId": None,
            "metodoPago": "EFECTIVO",
            "detalles": [{"productoId": 1, "cantidad": 2}],
            "codigoCupon": None,
        }
        response = Mock()
        response.json.return_value = {
            "venta_id": 44,
            "total": "1200.00",
            "idempotent_replay": False,
        }
        with (
            patch.object(api, "SUPABASE_URL", "https://example.test"),
            patch.object(api, "SUPABASE_SERVICE_ROLE_KEY", "service-test-key"),
            patch.object(api, "rest_request", return_value=response) as rpc,
        ):
            result = api.register_sale(payload, request)

        self.assertEqual(result["venta"], {"id": 44, "total": 1200.0})
        self.assertEqual(rpc.call_count, 1)
        self.assertTrue(rpc.call_args.args[1].endswith("/rpc/registrar_venta_pos"))
        self.assertEqual(
            rpc.call_args.kwargs["json"]["p_idempotency_key"],
            "ef77e137-b987-4e44-a782-0408ce3b62d7",
        )

    def test_cash_movement_uses_single_transactional_rpc(self):
        request = Mock()
        request.headers = {"idempotency-key": "058025cc-04d4-4f48-a9ad-5bb95d9dbb5f"}
        response = Mock()
        response.json.return_value = {
            "movimiento_id": 91,
            "monto": "500.00",
            "idempotent_replay": False,
        }
        with (
            patch.object(api, "SUPABASE_URL", "https://example.test"),
            patch.object(api, "SUPABASE_SERVICE_ROLE_KEY", "service-test-key"),
            patch.object(api, "rest_request", return_value=response) as rpc,
        ):
            result = api.new_cash_movement("egreso", 500, "Compra de insumos", request)

        self.assertEqual(result["movimientoId"], 91)
        self.assertEqual(rpc.call_count, 1)
        self.assertTrue(rpc.call_args.args[1].endswith("/rpc/registrar_movimiento_caja"))
        self.assertEqual(rpc.call_args.kwargs["json"]["p_tipo"], "EGRESO")

    def test_lavador_cannot_adjust_inventory(self):
        token, _ = api.create_session_token(
            {"id_usuario": 8, "nombre": "Lavador", "rol": "lavador"}
        )
        response = self.client.post(
            "/api/inventario/movimientos",
            headers={"Authorization": f"Bearer {token}"},
            json={"productId": 1, "delta": 2, "reason": "Compra"},
        )
        self.assertEqual(response.status_code, 403)

    def test_inventory_fails_closed_without_transactional_credentials(self):
        request = Mock()
        request.headers = {"idempotency-key": "0f321a79-4b7c-4739-96a7-77f0d51c6a4f"}
        payload = {
            "productId": 1,
            "delta": 5,
            "reason": "Compra a proveedor",
            "supplier": "Proveedor",
            "unitCost": 100,
            "registerCashExpense": True,
        }
        with patch.object(api, "SUPABASE_SERVICE_ROLE_KEY", ""):
            with self.assertRaises(api.HTTPException) as context:
                api.register_inventory_movement(payload, request)
        self.assertEqual(context.exception.status_code, 503)

    def test_inventory_uses_single_transactional_rpc(self):
        request = Mock()
        request.headers = {"idempotency-key": "0f321a79-4b7c-4739-96a7-77f0d51c6a4f"}
        request.state.session = {"sub": "7"}
        payload = {
            "productId": 3,
            "delta": 5,
            "reason": "Compra a proveedor",
            "supplier": "Proveedor",
            "unitCost": 100,
            "registerCashExpense": True,
        }
        response = Mock()
        response.json.return_value = {
            "movimiento_id": 12,
            "stock": 25,
            "caja_movimiento_id": 92,
            "idempotent_replay": False,
        }
        with (
            patch.object(api, "SUPABASE_URL", "https://example.test"),
            patch.object(api, "SUPABASE_SERVICE_ROLE_KEY", "service-test-key"),
            patch.object(api, "rest_request", return_value=response) as rpc,
        ):
            result = api.register_inventory_movement(payload, request)

        self.assertEqual(result["stock"], 25)
        self.assertEqual(result["cashMovementId"], 92)
        self.assertEqual(rpc.call_count, 1)
        self.assertTrue(
            rpc.call_args.args[1].endswith("/rpc/registrar_movimiento_inventario")
        )
        self.assertEqual(rpc.call_args.kwargs["json"]["p_actor"], "7")

    def test_inventory_rejects_incomplete_rpc_confirmation(self):
        request = Mock()
        request.headers = {"idempotency-key": "e99fb815-0432-4e19-9a2c-a154719a22f6"}
        request.state.session = {"sub": "7"}
        response = Mock()
        response.json.return_value = {"stock": 25}
        with (
            patch.object(api, "SUPABASE_URL", "https://example.test"),
            patch.object(api, "SUPABASE_SERVICE_ROLE_KEY", "service-test-key"),
            patch.object(api, "rest_request", return_value=response),
        ):
            with self.assertRaises(api.HTTPException) as context:
                api.register_inventory_movement(
                    {
                        "productId": 3,
                        "delta": 2,
                        "reason": "Ajuste de conteo",
                        "unitCost": 0,
                        "registerCashExpense": False,
                    },
                    request,
                )
        self.assertEqual(context.exception.status_code, 503)

    def test_secure_schedule_uses_actor_and_transactional_rpc(self):
        token, _ = api.create_session_token(
            {"id_usuario": 15, "nombre": "Recepción", "rol": "operario"}
        )
        with patch.object(
            api,
            "call_service_rpc",
            return_value={"turno_id": 91, "estado": "PENDIENTE"},
        ) as rpc:
            response = self.client.post(
                "/api/turnos",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "clientId": 1,
                    "vehicleId": 2,
                    "serviceId": 3,
                    "employeeId": 4,
                    "scheduledAt": "2026-08-10T09:00:00",
                },
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], 91)
        self.assertEqual(rpc.call_args.args[1]["p_actor"], "15")

    def test_lavador_cannot_create_customers(self):
        token, _ = api.create_session_token(
            {"id_usuario": 8, "nombre": "Lavador", "rol": "lavador"}
        )
        response = self.client.post(
            "/api/clientes-con-vehiculo",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Cliente", "plate": "AB123CD", "model": "Auto"},
        )
        self.assertEqual(response.status_code, 403)

    def test_lavador_can_record_a_valid_workflow_transition(self):
        token, _ = api.create_session_token(
            {"id_usuario": 8, "nombre": "Lavador", "rol": "lavador"}
        )
        with patch.object(
            api,
            "call_service_rpc",
            return_value={"turno_id": 12, "estado": "EN_PROCESO", "unchanged": False},
        ) as rpc:
            response = self.client.post(
                "/api/turnos/12/transiciones",
                headers={"Authorization": f"Bearer {token}"},
                json={"state": "EN_PROCESO"},
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["estado"], "EN_PROCESO")
        self.assertEqual(rpc.call_args.args[1]["p_actor"], "8")

    def test_readiness_reports_booleans_without_secret_values(self):
        token, _ = api.create_session_token(
            {"id_usuario": 1, "nombre": "Admin", "rol": "admin"}
        )
        with patch.object(api, "SUPABASE_SERVICE_ROLE_KEY", "private-service-secret"):
            response = self.client.get(
                "/api/readiness",
                headers={"Authorization": f"Bearer {token}"},
            )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIsInstance(body["checks"]["supabasePrivate"], bool)
        self.assertNotIn("private-service-secret", str(body))

    def test_reception_inspection_uses_auditable_rpc(self):
        request = Mock()
        request.state.session = {"sub": "15"}
        with patch.object(
            api,
            "call_service_rpc",
            return_value={"inspeccion_id": 33, "turno_id": 91},
        ) as rpc:
            result = api.save_reception_inspection(91, {
                "dirtLevel": "MEDIO",
                "damageChecklist": {"capot": True},
                "observations": "Marca leve",
                "inspector": "Recepción",
            }, request)
        self.assertEqual(result["inspectionId"], 33)
        self.assertEqual(rpc.call_args.args[1]["p_actor"], "15")

    def test_photo_upload_fails_closed_without_private_storage_access(self):
        request = Mock()
        request.state.session = {"sub": "15"}
        with patch.object(api, "SUPABASE_SERVICE_ROLE_KEY", ""):
            with self.assertRaises(api.HTTPException) as context:
                api.upload_reception_photo(91, {
                    "inspectionId": 33,
                    "dataUrl": "data:image/jpeg;base64,/9j/",
                }, request)
        self.assertEqual(context.exception.status_code, 503)

    def test_photo_upload_rejects_mismatched_content_type(self):
        request = Mock()
        request.state.session = {"sub": "15"}
        with (
            patch.object(api, "SUPABASE_URL", "https://example.test"),
            patch.object(api, "SUPABASE_SERVICE_ROLE_KEY", "service-test-key"),
        ):
            with self.assertRaises(api.HTTPException) as context:
                api.upload_reception_photo(91, {
                    "inspectionId": 33,
                    "dataUrl": "data:image/png;base64,/9j/",
                }, request)
        self.assertEqual(context.exception.status_code, 422)

    def test_legacy_restock_route_does_not_mutate(self):
        with patch.object(api, "execute_query") as execute:
            with self.assertRaises(api.HTTPException) as context:
                api.restock_product(1, 10)
        self.assertEqual(context.exception.status_code, 410)
        execute.assert_not_called()


if __name__ == "__main__":
    unittest.main()
