package com.lavadero.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "empleados")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Empleado {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 100)
    private String nombre;

    @Column(nullable = false, length = 50)
    private String rol; // 'ADMINISTRADOR', 'CAJERO', 'LAVADOR'

    @Column(length = 20)
    private String telefono;

    private Boolean activo = true;

    @Column(name = "fecha_contratacion", insertable = false, updatable = false)
    private LocalDateTime fechaContratacion;
}
