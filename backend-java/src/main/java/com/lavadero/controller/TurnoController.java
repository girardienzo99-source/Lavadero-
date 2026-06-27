package com.lavadero.controller;

import com.lavadero.model.Cliente;
import com.lavadero.model.Servicio;
import com.lavadero.model.Turno;
import com.lavadero.model.Vehiculo;
import com.lavadero.repository.ClienteRepository;
import com.lavadero.repository.ServicioRepository;
import com.lavadero.repository.TurnoRepository;
import com.lavadero.repository.VehiculoRepository;
import com.lavadero.service.PythonIntegrationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/turnos")
public class TurnoController {

    private final TurnoRepository turnoRepository;
    private final ClienteRepository clienteRepository;
    private final VehiculoRepository vehiculoRepository;
    private final ServicioRepository servicioRepository;
    private final PythonIntegrationService pythonService;

    @Autowired
    public TurnoController(TurnoRepository turnoRepository,
                           ClienteRepository clienteRepository,
                           VehiculoRepository vehiculoRepository,
                           ServicioRepository servicioRepository,
                           PythonIntegrationService pythonService) {
        this.turnoRepository = turnoRepository;
        this.clienteRepository = clienteRepository;
        this.vehiculoRepository = vehiculoRepository;
        this.servicioRepository = servicioRepository;
        this.pythonService = pythonService;
    }

    /**
     * Lista todos los turnos. Opcionalmente permite filtrar por rango de fecha/hora (para alimentar el Calendario).
     */
    @GetMapping
    public ResponseEntity<List<Turno>> listarTurnos(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime inicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fin) {
        
        if (inicio != null && fin != null) {
            return ResponseEntity.ok(turnoRepository.findByFechaHoraBetween(inicio, fin));
        }
        return ResponseEntity.ok(turnoRepository.findAll());
    }

    /**
     * Agenda un nuevo turno de lavado para un vehículo.
     */
    @PostMapping("/agendar")
    public ResponseEntity<?> agendarTurno(
            @RequestParam Integer clienteId,
            @RequestParam Integer vehiculoId,
            @RequestParam Integer servicioId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fechaHora,
            @RequestParam(required = false) String observaciones) {
        
        try {
            Cliente cliente = clienteRepository.findById(clienteId)
                    .orElseThrow(() -> new IllegalArgumentException("Cliente no encontrado con ID: " + clienteId));
            
            Vehiculo vehiculo = vehiculoRepository.findById(vehiculoId)
                    .orElseThrow(() -> new IllegalArgumentException("Vehículo no encontrado con ID: " + vehiculoId));

            if (!vehiculo.getCliente().getId().equals(cliente.getId())) {
                throw new IllegalArgumentException("El vehículo especificado no pertenece al cliente seleccionado.");
            }

            Servicio servicio = servicioRepository.findById(servicioId)
                    .orElseThrow(() -> new IllegalArgumentException("Servicio no encontrado con ID: " + servicioId));

            Turno turno = new Turno();
            turno.setCliente(cliente);
            turno.setVehiculo(vehiculo);
            turno.setServicio(servicio);
            turno.setFechaHora(fechaHora);
            turno.setEstado("PENDIENTE");
            turno.setObservaciones(observaciones);

            return ResponseEntity.ok(turnoRepository.save(turno));

        } catch (IllegalArgumentException e) {
            Map<String, String> response = new HashMap<>();
            response.put("status", "error");
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }
    }

    /**
     * Cambia el estado de un turno (ej. PENDIENTE -> EN_PROGRESO -> COMPLETADO).
     */
    @PostMapping("/{id}/estado")
    public ResponseEntity<?> cambiarEstado(
            @PathVariable Integer id,
            @RequestParam String estado) {
        
        try {
            Turno turno = turnoRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Turno no encontrado con ID: " + id));

            String estadoUpper = estado.toUpperCase();
            if (!List.of("PENDIENTE", "EN_PROGRESO", "COMPLETADO", "CANCELADO").contains(estadoUpper)) {
                throw new IllegalArgumentException("Estado no válido. Valores permitidos: PENDIENTE, EN_PROGRESO, COMPLETADO, CANCELADO");
            }

            String estadoAnterior = turno.getEstado();
            turno.setEstado(estadoUpper);
            Turno guardado = turnoRepository.save(turno);

            // Automatización de WhatsApp al COMPLETAR el lavado
            if ("COMPLETADO".equals(estadoUpper) && !"COMPLETADO".equals(estadoAnterior)) {
                try {
                    Cliente cliente = guardado.getCliente();
                    Vehiculo vehiculo = guardado.getVehiculo();
                    String mensaje = "Hola " + cliente.getNombre() + "! Tu " + vehiculo.getMarca() + " " + vehiculo.getModelo() 
                            + " (Patente: " + vehiculo.getPatente() + ") ya esta listo. Podes pasar a retirarlo de Lavadero Car Wash.";
                    
                    // Ejecutar asíncronamente en segundo plano para no demorar la respuesta de la UI
                    new Thread(() -> {
                        pythonService.executeScript("whatsapp_sender.py", List.of(cliente.getTelefono(), mensaje));
                    }).start();
                } catch (Exception e) {
                    // Silenciar errores de hilo para proteger el flujo principal
                }
            }

            return ResponseEntity.ok(guardado);

        } catch (IllegalArgumentException e) {
            Map<String, String> response = new HashMap<>();
            response.put("status", "error");
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }
    }
}
