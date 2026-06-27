package com.lavadero.service;

import com.lavadero.model.CajaDiaria;
import com.lavadero.repository.CajaDiariaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

@Service
public class CajaService {

    private final CajaDiariaRepository cajaRepository;

    @Autowired
    public CajaService(CajaDiariaRepository cajaRepository) {
        this.cajaRepository = cajaRepository;
    }

    /**
     * Obtiene la caja abierta actual. Si no hay una caja abierta para hoy,
     * busca cualquier caja que haya quedado abierta.
     */
    public Optional<CajaDiaria> obtenerCajaAbierta() {
        // En un lavadero real, buscamos la caja abierta más reciente
        return cajaRepository.findAll().stream()
                .filter(c -> "ABIERTA".equals(c.getEstado()))
                .findFirst();
    }

    /**
     * Abre la caja para el día de hoy con un monto inicial.
     */
    @Transactional
    public CajaDiaria abrirCaja(BigDecimal montoApertura, String observaciones) {
        LocalDate hoy = LocalDate.now();
        Optional<CajaDiaria> cajaExistente = cajaRepository.findByFecha(hoy);
        
        if (cajaExistente.isPresent()) {
            throw new IllegalStateException("Ya existe un registro de caja para el día de hoy: " + hoy);
        }

        Optional<CajaDiaria> cajaAbiertaAnterior = obtenerCajaAbierta();
        if (cajaAbiertaAnterior.isPresent()) {
            throw new IllegalStateException("Hay una caja de un día anterior que aún no ha sido cerrada (Fecha: " 
                    + cajaAbiertaAnterior.get().getFecha() + "). Debe cerrarla primero.");
        }

        CajaDiaria nuevaCaja = new CajaDiaria();
        nuevaCaja.setFecha(hoy);
        nuevaCaja.setMontoApertura(montoApertura);
        nuevaCaja.setIngresos(BigDecimal.ZERO);
        nuevaCaja.setEgresos(BigDecimal.ZERO);
        nuevaCaja.setEstado("ABIERTA");
        nuevaCaja.setObservaciones(observaciones);

        return cajaRepository.save(nuevaCaja);
    }

    /**
     * Suma un ingreso a la caja abierta actual.
     */
    @Transactional
    public CajaDiaria registrarIngreso(BigDecimal monto) {
        CajaDiaria caja = obtenerCajaAbierta()
                .orElseThrow(() -> new IllegalStateException("No hay ninguna caja abierta para registrar el ingreso."));
        
        caja.setIngresos(caja.getIngresos().add(monto));
        return cajaRepository.save(caja);
    }

    /**
     * Registra un egreso (pago a proveedores, insumos, etc.) en la caja abierta actual.
     */
    @Transactional
    public CajaDiaria registrarEgreso(BigDecimal monto, String descripcion) {
        CajaDiaria caja = obtenerCajaAbierta()
                .orElseThrow(() -> new IllegalStateException("No hay ninguna caja abierta para registrar el egreso."));

        caja.setEgresos(caja.getEgresos().add(monto));
        if (descripcion != null && !descripcion.isEmpty()) {
            String obs = caja.getObservaciones() != null ? caja.getObservaciones() : "";
            caja.setObservaciones(obs + "\n[EGRESO] -" + monto + ": " + descripcion);
        }
        return cajaRepository.save(caja);
    }

    /**
     * Cierra la caja abierta actual calculando el balance final.
     */
    @Transactional
    public CajaDiaria cerrarCaja(String observacionesAdicionales) {
        CajaDiaria caja = obtenerCajaAbierta()
                .orElseThrow(() -> new IllegalStateException("No hay ninguna caja abierta activa para cerrar."));

        // Balance de Cierre = Monto Apertura + Ingresos - Egresos
        BigDecimal montoCierre = caja.getMontoApertura()
                .add(caja.getIngresos())
                .subtract(caja.getEgresos());

        caja.setMontoCierre(montoCierre);
        caja.setEstado("CERRADA");
        
        String obs = caja.getObservaciones() != null ? caja.getObservaciones() : "";
        caja.setObservaciones(obs + "\n[CIERRE] Caja cerrada. " + (observacionesAdicionales != null ? observacionesAdicionales : ""));

        return cajaRepository.save(caja);
    }
}
