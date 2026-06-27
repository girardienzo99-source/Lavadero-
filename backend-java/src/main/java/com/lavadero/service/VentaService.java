package com.lavadero.service;

import com.lavadero.model.*;
import com.lavadero.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class VentaService {

    private static final Logger logger = LoggerFactory.getLogger(VentaService.class);

    private final VentaRepository ventaRepository;
    private final VentaDetalleRepository detalleRepository;
    private final ProductoRepository productoRepository;
    private final ServicioRepository servicioRepository;
    private final ClienteRepository clienteRepository;
    private final CupoDescuentoRepository cupoRepository;
    private final CajaService cajaService;

    public record DetalleRequest(Integer productoId, Integer servicioId, Integer cantidad) {}
    
    public record VentaResponse(Venta venta, List<VentaDetalle> detalles, List<String> alertasStock) {}

    @Autowired
    public VentaService(VentaRepository ventaRepository,
                        VentaDetalleRepository detalleRepository,
                        ProductoRepository productoRepository,
                        ServicioRepository servicioRepository,
                        ClienteRepository clienteRepository,
                        CupoDescuentoRepository cupoRepository,
                        CajaService cajaService) {
        this.ventaRepository = ventaRepository;
        this.detalleRepository = detalleRepository;
        this.productoRepository = productoRepository;
        this.servicioRepository = servicioRepository;
        this.clienteRepository = clienteRepository;
        this.cupoRepository = cupoRepository;
        this.cajaService = cajaService;
    }

    /**
     * Registra una nueva venta de productos y/o servicios en el Punto de Venta (POS).
     */
    @Transactional
    public VentaResponse registrarVenta(Integer clienteId, String metodoPago, List<DetalleRequest> detallesRequest, String codigoCupon) {
        // 1. Validar que la caja esté abierta
        CajaDiaria caja = cajaService.obtenerCajaAbierta()
                .orElseThrow(() -> new IllegalStateException("Debe abrir la caja diaria antes de realizar ventas."));

        // 2. Obtener Cliente (puede ser nulo si es consumidor final sin registrar)
        Cliente cliente = null;
        if (clienteId != null) {
            cliente = clienteRepository.findById(clienteId)
                    .orElseThrow(() -> new IllegalArgumentException("Cliente no encontrado con ID: " + clienteId));
        }

        // Crear la venta
        Venta venta = new Venta();
        venta.setCajaDiaria(caja);
        venta.setCliente(cliente);
        venta.setMetodoPago(metodoPago != null ? metodoPago.toUpperCase() : "EFECTIVO");
        venta.setEstado("COMPLETADA");
        
        // Guardar venta inicial para tener ID
        venta = ventaRepository.save(venta);

        List<VentaDetalle> detallesGuardados = new ArrayList<>();
        List<String> alertasStock = new ArrayList<>();
        BigDecimal totalBruto = BigDecimal.ZERO;

        // 3. Procesar cada detalle de la venta
        for (DetalleRequest req : detallesRequest) {
            VentaDetalle detalle = new VentaDetalle();
            detalle.setVenta(venta);
            detalle.setCantidad(req.cantidad() != null ? req.cantidad() : 1);

            if (req.productoId() != null) {
                // Venta de Producto
                Producto producto = productoRepository.findById(req.productoId())
                        .orElseThrow(() -> new IllegalArgumentException("Producto no encontrado con ID: " + req.productoId()));

                // Validar Stock
                if (producto.getStock() < detalle.getCantidad()) {
                    throw new IllegalArgumentException("Stock insuficiente para el producto '" + producto.getNombre() 
                            + "'. Stock actual: " + producto.getStock() + ", Solicitado: " + detalle.getCantidad());
                }

                // Decrementar Stock
                int nuevoStock = producto.getStock() - detalle.getCantidad();
                producto.setStock(nuevoStock);
                productoRepository.save(producto);

                // Alerta de Stock Mínimo
                if (producto.isBajoStock()) {
                    String alerta = "ALERTA STOCK MÍNIMO: El producto '" + producto.getNombre() 
                            + "' quedó con " + nuevoStock + " unidades en inventario (Límite: " + producto.getStockMinimo() + ").";
                    alertasStock.add(alerta);
                    logger.warn(alerta);
                }

                detalle.setProducto(producto);
                detalle.setPrecioUnitario(producto.getPrecioVenta());
                BigDecimal subtotal = producto.getPrecioVenta().multiply(BigDecimal.valueOf(detalle.getCantidad()));
                detalle.setSubtotal(subtotal);
                totalBruto = totalBruto.add(subtotal);

            } else if (req.servicioId() != null) {
                // Venta de Servicio
                Servicio servicio = servicioRepository.findById(req.servicioId())
                        .orElseThrow(() -> new IllegalArgumentException("Servicio no encontrado con ID: " + req.servicioId()));

                detalle.setServicio(servicio);
                detalle.setPrecioUnitario(servicio.getPrecio());
                BigDecimal subtotal = servicio.getPrecio().multiply(BigDecimal.valueOf(detalle.getCantidad()));
                detalle.setSubtotal(subtotal);
                totalBruto = totalBruto.add(subtotal);
            } else {
                throw new IllegalArgumentException("Cada detalle de venta debe especificar un producto_id o un servicio_id.");
            }

            detallesGuardados.add(detalleRepository.save(detalle));
        }

        // 4. Procesar Cupón de Descuento (Marketing Fidelización)
        BigDecimal totalNeto = totalBruto;
        if (codigoCupon != null && !codigoCupon.trim().isEmpty()) {
            CupoDescuento cupón = cupoRepository.findByCodigo(codigoCupon)
                    .orElseThrow(() -> new IllegalArgumentException("Cupón de descuento no válido o inexistente: " + codigoCupon));

            if (!cupón.isValido()) {
                throw new IllegalArgumentException("El cupón '" + codigoCupon + "' ya ha sido usado o ha expirado.");
            }

            if (cliente == null || !cliente.getId().equals(cupón.getCliente().getId())) {
                throw new IllegalArgumentException("Este cupón pertenece a otro cliente y no puede aplicarse a esta venta.");
            }

            // Aplicar descuento
            double factorDescuento = (100.0 - cupón.getDescuentoPorcentaje()) / 100.0;
            totalNeto = totalBruto.multiply(BigDecimal.valueOf(factorDescuento));

            // Marcar cupón como usado
            cupón.setUsado(true);
            cupón.setFechaUso(LocalDateTime.now());
            cupoRepository.save(cupón);
            
            logger.info("Cupón {} aplicado con éxito. Descuento del {}% aplicado a la venta.", 
                    codigoCupon, cupón.getDescuentoPorcentaje());
        }

        // 5. Actualizar total de la Venta
        venta.setTotal(totalNeto);
        venta = ventaRepository.save(venta);

        // 6. Registrar el ingreso en la Caja Diaria Abierta
        cajaService.registrarIngreso(totalNeto);

        // 7. Actualizar la última visita del cliente (Fidelización)
        if (cliente != null) {
            cliente.setUltimaVisita(LocalDateTime.now());
            clienteRepository.save(cliente);
        }

        return new VentaResponse(venta, detallesGuardados, alertasStock);
    }
}
