package com.lavadero.controller;

import com.lavadero.service.VentaService;
import com.lavadero.model.Producto;
import com.lavadero.model.Cliente;
import com.lavadero.model.FeedbackCliente;
import com.lavadero.repository.ProductoRepository;
import com.lavadero.repository.ClienteRepository;
import com.lavadero.repository.FeedbackClienteRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/pos")
public class POSController {

    private final VentaService ventaService;
    private final ProductoRepository productoRepository;
    private final ClienteRepository clienteRepository;
    private final FeedbackClienteRepository feedbackRepository;

    public record VentaRequest(
            Integer clienteId,
            String metodoPago,
            List<VentaService.DetalleRequest> detalles,
            String codigoCupon
    ) {}

    @Autowired
    public POSController(VentaService ventaService, 
                         ProductoRepository productoRepository,
                         ClienteRepository clienteRepository,
                         FeedbackClienteRepository feedbackRepository) {
        this.ventaService = ventaService;
        this.productoRepository = productoRepository;
        this.clienteRepository = clienteRepository;
        this.feedbackRepository = feedbackRepository;
    }

    /**
     * Endpoint principal para procesar ventas (POS).
     * Permite vender productos, servicios, aplicar cupones de fidelización y decrementar stock.
     */
    @PostMapping("/venta")
    public ResponseEntity<?> registrarVenta(@RequestBody VentaRequest request) {
        try {
            if (request.detalles() == null || request.detalles().isEmpty()) {
                throw new IllegalArgumentException("La venta debe incluir al menos un producto o servicio.");
            }

            VentaService.VentaResponse response = ventaService.registrarVenta(
                    request.clienteId(),
                    request.metodoPago(),
                    request.detalles(),
                    request.codigoCupon()
            );

            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException | IllegalStateException e) {
            Map<String, Object> response = new HashMap<>();
            response.put("status", "error");
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("status", "error");
            response.put("message", "Ocurrió un error inesperado al procesar la venta: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    /**
     * Endpoint para reabastecer el stock de un producto.
     */
    @PostMapping("/productos/{id}/reabastecer")
    public ResponseEntity<?> reabastecerProducto(
            @PathVariable Integer id,
            @RequestParam Integer cantidad) {
        try {
            Producto producto = productoRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Producto no encontrado con ID: " + id));
            producto.setStock(producto.getStock() + cantidad);
            Producto guardado = productoRepository.save(producto);
            return ResponseEntity.ok(guardado);
        } catch (IllegalArgumentException e) {
            Map<String, Object> response = new HashMap<>();
            response.put("status", "error");
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }
    }

    /**
     * Endpoint para registrar el feedback del cliente (NPS).
     */
    @PostMapping("/feedback")
    public ResponseEntity<?> registrarFeedback(
            @RequestParam Integer clienteId,
            @RequestParam Integer puntuacion,
            @RequestParam(required = false) String comentario) {
        try {
            if (puntuacion < 1 || puntuacion > 5) {
                throw new IllegalArgumentException("La puntuacion debe estar entre 1 y 5 estrellas.");
            }
            Cliente cliente = clienteRepository.findById(clienteId)
                    .orElseThrow(() -> new IllegalArgumentException("Cliente no encontrado con ID: " + clienteId));

            FeedbackCliente fb = new FeedbackCliente();
            fb.setCliente(cliente);
            fb.setPuntuacion(puntuacion);
            fb.setComentario(comentario);

            return ResponseEntity.ok(feedbackRepository.save(fb));
        } catch (IllegalArgumentException e) {
            Map<String, Object> response = new HashMap<>();
            response.put("status", "error");
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }
    }
}
