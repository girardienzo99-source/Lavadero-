package com.lavadero.controller;

import com.lavadero.service.PythonIntegrationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/marketing")
public class MarketingController {

    private final PythonIntegrationService pythonService;
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${python.fastapi-url}")
    private String fastApiUrl;

    @Autowired
    public MarketingController(PythonIntegrationService pythonService) {
        this.pythonService = pythonService;
    }

    /**
     * Dispara el script de fidelización de clientes (inactivos > 20 días).
     * Ejecuta: python customer_loyalty.py
     */
    @PostMapping("/run-loyalty")
    public ResponseEntity<Map<String, Object>> runLoyaltyScript() {
        Map<String, Object> response = new HashMap<>();
        try {
            PythonIntegrationService.PythonScriptResult result = 
                    pythonService.executeScript("customer_loyalty.py", null);

            response.put("exitCode", result.exitCode());
            response.put("success", result.isSuccess());
            response.put("stdout", result.stdout());
            response.put("stderr", result.stderr());

            if (result.isSuccess()) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
            }
        } catch (Exception e) {
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    /**
     * Dispara el script de WhatsApp para enviar un mensaje recordatorio o promoción.
     * Ejecuta: python whatsapp_sender.py <phone> <message>
     */
    @PostMapping("/send-whatsapp")
    public ResponseEntity<Map<String, Object>> sendWhatsApp(
            @RequestParam String telefono,
            @RequestParam String mensaje) {
        
        Map<String, Object> response = new HashMap<>();
        try {
            List<String> args = List.of(telefono, mensaje);
            PythonIntegrationService.PythonScriptResult result = 
                    pythonService.executeScript("whatsapp_sender.py", args);

            response.put("exitCode", result.exitCode());
            response.put("success", result.isSuccess());
            response.put("stdout", result.stdout());
            response.put("stderr", result.stderr());

            if (result.isSuccess()) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
            }
        } catch (Exception e) {
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    /**
     * Consulta el microservicio de Python (FastAPI) para obtener la segmentación de clientes en tiempo real.
     * Hace un GET a http://localhost:8000/segmentacion
     */
    @GetMapping("/segmentacion")
    public ResponseEntity<?> getClientSegmentation() {
        Map<String, Object> response = new HashMap<>();
        try {
            String endpoint = fastApiUrl + "/segmentacion";
            // Intentar contactar a la API de FastAPI
            ResponseEntity<List> fastApiResponse = restTemplate.getForEntity(endpoint, List.class);
            return ResponseEntity.ok(fastApiResponse.getBody());
        } catch (Exception e) {
            response.put("success", false);
            response.put("message", "No se pudo conectar con el microservicio FastAPI en " + fastApiUrl);
            response.put("error", e.getMessage());
            // Devolver estado 503 (Servicio no disponible) pero detallado
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(response);
        }
    }
}
