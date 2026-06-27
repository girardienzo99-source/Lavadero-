package com.lavadero.controller;

import com.lavadero.model.Empleado;
import com.lavadero.repository.EmpleadoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/empleados")
public class EmpleadoController {

    private final EmpleadoRepository empleadoRepository;

    @Autowired
    public EmpleadoController(EmpleadoRepository empleadoRepository) {
        this.empleadoRepository = empleadoRepository;
    }

    /**
     * Lista todos los empleados.
     */
    @GetMapping
    public ResponseEntity<List<Empleado>> listarEmpleados() {
        return ResponseEntity.ok(empleadoRepository.findAll());
    }

    /**
     * Registra un nuevo empleado.
     */
    @PostMapping("/nuevo")
    public ResponseEntity<?> registrarEmpleado(
            @RequestParam String nombre,
            @RequestParam String rol,
            @RequestParam(required = false) String telefono) {
        try {
            if (nombre == null || nombre.trim().isEmpty()) {
                throw new IllegalArgumentException("El nombre del empleado es obligatorio.");
            }
            if (rol == null || rol.trim().isEmpty()) {
                throw new IllegalArgumentException("El rol del empleado es obligatorio.");
            }

            String rolUpper = rol.toUpperCase();
            if (!List.of("ADMINISTRADOR", "CAJERO", "LAVADOR").contains(rolUpper)) {
                throw new IllegalArgumentException("Rol no válido. Permitidos: ADMINISTRADOR, CAJERO, LAVADOR");
            }

            Empleado empleado = new Empleado();
            empleado.setNombre(nombre);
            empleado.setRol(rolUpper);
            empleado.setTelefono(telefono);
            empleado.setActivo(true);

            return ResponseEntity.ok(empleadoRepository.save(empleado));

        } catch (IllegalArgumentException e) {
            Map<String, String> response = new HashMap<>();
            response.put("status", "error");
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }
    }

    /**
     * Alterna la disponibilidad o estado activo del empleado.
     */
    @PostMapping("/{id}/estado")
    public ResponseEntity<?> cambiarEstado(
            @PathVariable Integer id,
            @RequestParam Boolean activo) {
        try {
            Empleado empleado = empleadoRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Empleado no encontrado con ID: " + id));

            empleado.setActivo(activo);
            return ResponseEntity.ok(empleadoRepository.save(empleado));

        } catch (IllegalArgumentException e) {
            Map<String, String> response = new HashMap<>();
            response.put("status", "error");
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }
    }
}
