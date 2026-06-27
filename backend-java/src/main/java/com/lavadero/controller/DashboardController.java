package com.lavadero.controller;

import com.lavadero.model.CajaDiaria;
import com.lavadero.model.Producto;
import com.lavadero.model.Servicio;
import com.lavadero.model.Turno;
import com.lavadero.model.Empleado;
import com.lavadero.repository.ClienteRepository;
import com.lavadero.repository.ProductoRepository;
import com.lavadero.repository.ServicioRepository;
import com.lavadero.repository.TurnoRepository;
import com.lavadero.repository.EmpleadoRepository;
import com.lavadero.service.CajaService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@Controller
public class DashboardController {

    private final TurnoRepository turnoRepository;
    private final ProductoRepository productoRepository;
    private final ServicioRepository servicioRepository;
    private final ClienteRepository clienteRepository;
    private final EmpleadoRepository empleadoRepository;
    private final CajaService cajaService;
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${python.fastapi-url}")
    private String fastApiUrl;

    @Autowired
    public DashboardController(TurnoRepository turnoRepository,
                               ProductoRepository productoRepository,
                               ServicioRepository servicioRepository,
                               ClienteRepository clienteRepository,
                               EmpleadoRepository empleadoRepository,
                               CajaService cajaService) {
        this.turnoRepository = turnoRepository;
        this.productoRepository = productoRepository;
        this.servicioRepository = servicioRepository;
        this.clienteRepository = clienteRepository;
        this.empleadoRepository = empleadoRepository;
        this.cajaService = cajaService;
    }

    @GetMapping("/")
    public String viewDashboard(Model model) {
        // 1. Cargar datos básicos de base de datos
        List<Turno> turnos = turnoRepository.findAll();
        List<Producto> productos = productoRepository.findAll();
        List<Servicio> servicios = servicioRepository.findAll();
        List<Empleado> empleados = empleadoRepository.findAll();
        Optional<CajaDiaria> cajaOpt = cajaService.obtenerCajaAbierta();

        model.addAttribute("turnos", turnos);
        model.addAttribute("productos", productos);
        model.addAttribute("servicios", servicios);
        model.addAttribute("empleados", empleados);
        model.addAttribute("cajaAbierta", cajaOpt.isPresent());
        model.addAttribute("caja", cajaOpt.orElse(null));

        // Calcular contadores rápidos
        long turnosPendientes = turnos.stream().filter(t -> "PENDIENTE".equals(t.getEstado())).count();
        long turnosEnProceso = turnos.stream().filter(t -> "EN_PROGRESO".equals(t.getEstado())).count();
        long turnosCompletados = turnos.stream().filter(t -> "COMPLETADO".equals(t.getEstado())).count();
        List<Producto> bajoStockList = productos.stream().filter(Producto::isBajoStock).toList();
        long productosBajoStock = bajoStockList.size();

        model.addAttribute("contPendientes", turnosPendientes);
        model.addAttribute("contEnProceso", turnosEnProceso);
        model.addAttribute("contCompletados", turnosCompletados);
        model.addAttribute("contBajoStock", productosBajoStock);
        model.addAttribute("productosBajoStock", bajoStockList);
        model.addAttribute("fechaHoy", LocalDate.now().toString());

        // 2. Cargar segmentación de clientes desde FastAPI (Python)
        boolean pythonOffline = false;
        List<Map<String, Object>> clientesSegmentados = new ArrayList<>();
        try {
            String endpoint = fastApiUrl + "/segmentacion";
            ResponseEntity<Map> response = restTemplate.getForEntity(endpoint, Map.class);
            if (response.getBody() != null && "success".equals(response.getBody().get("status"))) {
                clientesSegmentados = (List<Map<String, Object>>) response.getBody().get("clientes");
            }
        } catch (Exception e) {
            pythonOffline = true;
            // Fallback a simulación de segmentación (para demostración robusta sin FastAPI iniciado)
            clientesSegmentados = obtenerSegmentacionSimulada();
        }

        model.addAttribute("pythonOffline", pythonOffline);
        model.addAttribute("clientesSegmentados", clientesSegmentados);

        // 3. Cargar NPS y métricas de satisfacción desde FastAPI (Python)
        Map<String, Object> npsData = new HashMap<>();
        try {
            String endpoint = fastApiUrl + "/nps";
            ResponseEntity<Map> response = restTemplate.getForEntity(endpoint, Map.class);
            if (response.getBody() != null && "success".equals(response.getBody().get("status"))) {
                npsData = (Map<String, Object>) response.getBody();
            }
        } catch (Exception e) {
            // Fallback a simulación de NPS (para demostración robusta sin FastAPI iniciado)
            npsData.put("status", "success");
            npsData.put("nivel", "EXCELENTE");
            npsData.put("nps", 75.0); // NPS Excelente
            npsData.put("total_respuestas", 8);
            npsData.put("promotores", 6);
            npsData.put("pasivos", 1);
            npsData.put("detractores", 1);
            npsData.put("porcentaje_promotores", 75.0);
            npsData.put("porcentaje_detractores", 12.5);
            npsData.put("db_fallback_mocked", true);
        }
        model.addAttribute("nps", npsData);

        return "dashboard";
    }

    private List<Map<String, Object>> obtenerSegmentacionSimulada() {
        List<Map<String, Object>> mockList = new ArrayList<>();
        
        mockList.add(crearMockCliente(1, "Juan Pérez", "+5491122334455", "FRECUENTE", 15000.0, 6, "2026-05-28"));
        mockList.add(crearMockCliente(2, "María Rodríguez", "+5491133445566", "VIP", 45000.0, 15, "2026-06-22"));
        mockList.add(crearMockCliente(3, "Carlos Gómez", "+5491144556677", "OCASIONAL", 2500.0, 1, "2026-06-02"));
        mockList.add(crearMockCliente(4, "Ana López", "+5491155667788", "OCASIONAL", 5000.0, 2, "2026-06-25"));

        return mockList;
    }

    private Map<String, Object> crearMockCliente(int id, String nombre, String tel, String segmento, double total, int visitas, String ultimaVisita) {
        Map<String, Object> c = new HashMap<>();
        c.put("id", id);
        c.put("nombre", nombre);
        c.put("telefono", tel);
        c.put("segmento_calculado", segmento);
        c.put("total_gastado", total);
        c.put("cantidad_visitas", visitas);
        c.put("ultima_visita", ultimaVisita);
        return c;
    }
}
