package com.lavadero.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "caja_diaria")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CajaDiaria {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, unique = true)
    private LocalDate fecha = LocalDate.now();

    @Column(name = "monto_apertura", nullable = false, precision = 10, scale = 2)
    private BigDecimal montoApertura;

    @Column(name = "monto_cierre", precision = 10, scale = 2)
    private BigDecimal montoCierre;

    @Column(precision = 10, scale = 2)
    private BigDecimal ingresos = BigDecimal.ZERO;

    @Column(precision = 10, scale = 2)
    private BigDecimal egresos = BigDecimal.ZERO;

    @Column(length = 15)
    private String estado = "ABIERTA"; // 'ABIERTA', 'CERRADA'

    @Column(columnDefinition = "TEXT")
    private String observaciones;
}
