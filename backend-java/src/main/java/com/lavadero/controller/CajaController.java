package com.lavadero.controller;

import com.lavadero.model.CajaDiaria;
import com.lavadero.service.CajaService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/caja")
public class CajaController {

    private final CajaService cajaService;

    @Autowired
    public CajaController(CajaService cajaService) {
        this.cajaService = cajaService;
    }

    /**
     * Obtiene la caja abierta actual.
     */
    @GetMapping("/abierta")
    public ResponseEntity<?> getCajaAbierta() {
        return cajaService.obtenerCajaAbierta()
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> {
                    Map<String, String> response = new HashMap<>();
                    response.put("status", "error");
                    response.put("message", "No hay ninguna caja abierta en el sistema.");
                    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
                });
    }

    /**
     * Abre la caja diaria.
     */
    @PostMapping("/abrir")
    public ResponseEntity<?> abrirCaja(
            @RequestParam BigDecimal montoApertura,
            @RequestParam(required = false) String observaciones) {
        try {
            CajaDiaria caja = cajaService.abrirCaja(montoApertura, observaciones);
            return ResponseEntity.ok(caja);
        } catch (IllegalStateException e) {
            Map<String, String> response = new HashMap<>();
            response.put("status", "error");
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }
    }

    /**
     * Registra un egreso de efectivo.
     */
    @PostMapping("/egreso")
    public ResponseEntity<?> registrarEgreso(
            @RequestParam BigDecimal monto,
            @RequestParam String descripcion) {
        try {
            CajaDiaria caja = cajaService.registrarEgreso(monto, descripcion);
            return ResponseEntity.ok(caja);
        } catch (IllegalStateException e) {
            Map<String, String> response = new HashMap<>();
            response.put("status", "error");
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }
    }

    /**
     * Cierra la caja diaria calculando el monto final.
     */
    @PostMapping("/cerrar")
    public ResponseEntity<?> cerrarCaja(
            @RequestParam(required = false) String observaciones) {
        try {
            CajaDiaria caja = cajaService.cerrarCaja(observaciones);
            return ResponseEntity.ok(caja);
        } catch (IllegalStateException e) {
            Map<String, String> response = new HashMap<>();
            response.put("status", "error");
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }
    }
}
