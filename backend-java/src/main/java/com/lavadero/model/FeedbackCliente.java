package com.lavadero.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "feedback_clientes")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FeedbackCliente {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "cliente_id", nullable = false)
    private Cliente cliente;

    @Column(nullable = false)
    private Integer puntuacion; // 1 a 5 estrellas

    @Column(columnDefinition = "TEXT")
    private String comentario;

    @Column(insertable = false, updatable = false)
    private LocalDateTime fecha;
}
