package com.lavadero.service;

import com.lavadero.model.*;
import com.lavadero.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

public class BusinessLogicTest {

    @Mock
    private CajaDiariaRepository cajaRepository;
    @Mock
    private VentaRepository ventaRepository;
    @Mock
    private VentaDetalleRepository detalleRepository;
    @Mock
    private ProductoRepository productoRepository;
    @Mock
    private ServicioRepository servicioRepository;
    @Mock
    private ClienteRepository clienteRepository;
    @Mock
    private CupoDescuentoRepository cupoRepository;

    @InjectMocks
    private CajaService cajaService;

    private VentaService ventaService;

    @BeforeEach
    public void setUp() {
        MockitoAnnotations.openMocks(this);
        // Inicializar VentaService pasando CajaService inyectado y los mocks
        ventaService = new VentaService(
                ventaRepository,
                detalleRepository,
                productoRepository,
                servicioRepository,
                clienteRepository,
                cupoRepository,
                cajaService
        );
    }

    @Test
    public void testAbrirCaja_Exito() {
        LocalDate hoy = LocalDate.now();
        when(cajaRepository.findByFecha(hoy)).thenReturn(Optional.empty());
        when(cajaRepository.save(any(CajaDiaria.class))).thenAnswer(invocation -> invocation.getArgument(0));

        CajaDiaria caja = cajaService.abrirCaja(new BigDecimal("1000.00"), "Apertura test");

        assertNotNull(caja);
        assertEquals("ABIERTA", caja.getEstado());
        assertEquals(new BigDecimal("1000.00"), caja.getMontoApertura());
        assertEquals(hoy, caja.getFecha());
    }

    @Test
    public void testAbrirCaja_CajaYaExistente_LanzaExcepcion() {
        LocalDate hoy = LocalDate.now();
        CajaDiaria cajaExistente = new CajaDiaria();
        cajaExistente.setFecha(hoy);
        when(cajaRepository.findByFecha(hoy)).thenReturn(Optional.of(cajaExistente));

        assertThrows(IllegalStateException.class, () -> {
            cajaService.abrirCaja(new BigDecimal("1000.00"), "Apertura test");
        });
    }

    @Test
    public void testRegistrarVenta_ConStockYSinCupon_Exito() {
        // Mock Caja Abierta
        CajaDiaria cajaAbierta = new CajaDiaria();
        cajaAbierta.setId(1);
        cajaAbierta.setEstado("ABIERTA");
        cajaAbierta.setMontoApertura(new BigDecimal("1000.00"));
        cajaAbierta.setIngresos(BigDecimal.ZERO);
        cajaAbierta.setEgresos(BigDecimal.ZERO);
        
        // Mock de CajaService.obtenerCajaAbierta
        when(cajaRepository.findAll()).thenReturn(List.of(cajaAbierta));
        when(cajaRepository.save(any(CajaDiaria.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Mock Cliente
        Cliente cliente = new Cliente();
        cliente.setId(1);
        cliente.setNombre("Juan");
        when(clienteRepository.findById(1)).thenReturn(Optional.of(cliente));

        // Mock Producto
        Producto producto = new Producto();
        producto.setId(10);
        producto.setNombre("Shampoo Premium");
        producto.setStock(20);
        producto.setStockMinimo(5);
        producto.setPrecioVenta(new BigDecimal("200.00"));
        when(productoRepository.findById(10)).thenReturn(Optional.of(producto));

        // Mock Venta save
        when(ventaRepository.save(any(Venta.class))).thenAnswer(invocation -> {
            Venta v = invocation.getArgument(0);
            if (v.getId() == null) {
                v.setId(99);
            }
            return v;
        });

        // Mock Detalle save
        when(detalleRepository.save(any(VentaDetalle.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Request: Comprar 2 unidades de Shampoo
        VentaService.DetalleRequest detReq = new VentaService.DetalleRequest(10, null, 2);
        
        // Ejecución
        VentaService.VentaResponse response = ventaService.registrarVenta(
                1, "EFECTIVO", List.of(detReq), null
        );

        // Verificaciones
        assertNotNull(response);
        assertEquals(new BigDecimal("400.00"), response.venta().getTotal());
        assertEquals(18, producto.getStock()); // Stock decrementado
        assertEquals(new BigDecimal("400.00"), cajaAbierta.getIngresos()); // Ingreso registrado en caja
        assertNotNull(cliente.getUltimaVisita()); // Ultima visita actualizada
    }

    @Test
    public void testRegistrarVenta_ConStockInsuficiente_LanzaExcepcion() {
        // Mock Caja Abierta
        CajaDiaria cajaAbierta = new CajaDiaria();
        cajaAbierta.setEstado("ABIERTA");
        when(cajaRepository.findAll()).thenReturn(List.of(cajaAbierta));

        // Mock Producto con stock bajo
        Producto producto = new Producto();
        producto.setId(10);
        producto.setNombre("Silicona");
        producto.setStock(2);
        when(productoRepository.findById(10)).thenReturn(Optional.of(producto));

        // Request para comprar 5 unidades (solo hay 2)
        VentaService.DetalleRequest detReq = new VentaService.DetalleRequest(10, null, 5);

        assertThrows(IllegalArgumentException.class, () -> {
            ventaService.registrarVenta(null, "EFECTIVO", List.of(detReq), null);
        });
    }

    @Test
    public void testRegistrarVenta_ConCuponDescuento_AplicaDescuento() {
        // Mock Caja Abierta
        CajaDiaria cajaAbierta = new CajaDiaria();
        cajaAbierta.setEstado("ABIERTA");
        cajaAbierta.setMontoApertura(new BigDecimal("1000.00"));
        cajaAbierta.setIngresos(BigDecimal.ZERO);
        cajaAbierta.setEgresos(BigDecimal.ZERO);
        when(cajaRepository.findAll()).thenReturn(List.of(cajaAbierta));
        when(cajaRepository.save(any(CajaDiaria.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Mock Cliente
        Cliente cliente = new Cliente();
        cliente.setId(1);
        cliente.setNombre("Juan");
        when(clienteRepository.findById(1)).thenReturn(Optional.of(cliente));

        // Mock Servicio (Lavado Completo = $2500)
        Servicio servicio = new Servicio();
        servicio.setId(5);
        servicio.setNombre("Lavado Completo");
        servicio.setPrecio(new BigDecimal("2500.00"));
        when(servicioRepository.findById(5)).thenReturn(Optional.of(servicio));

        // Mock Cupon de Descuento (15% de Descuento)
        CupoDescuento cupon = new CupoDescuento();
        cupon.setCodigo("VOLVE123");
        cupon.setCliente(cliente);
        cupon.setDescuentoPorcentaje(15);
        cupon.setFechaExpiracion(LocalDateTime.now().plusDays(10));
        cupon.setUsado(false);
        when(cupoRepository.findByCodigo("VOLVE123")).thenReturn(Optional.of(cupon));

        // Mock Saves
        when(ventaRepository.save(any(Venta.class))).thenAnswer(invocation -> {
            Venta v = invocation.getArgument(0);
            v.setId(99);
            return v;
        });
        when(detalleRepository.save(any(VentaDetalle.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Request: Lavado completo con cupón
        VentaService.DetalleRequest detReq = new VentaService.DetalleRequest(null, 5, 1);

        VentaService.VentaResponse response = ventaService.registrarVenta(
                1, "EFECTIVO", List.of(detReq), "VOLVE123"
        );

        // Verificaciones
        assertNotNull(response);
        // Total esperado: 2500 * 0.85 = 2125.00
        assertEquals(new BigDecimal("2125.0000"), response.venta().getTotal());
        assertTrue(cupon.getUsado()); // Cupón marcado como usado
        assertEquals(new BigDecimal("2125.0000"), cajaAbierta.getIngresos()); // Ingreso registrado
    }
}
