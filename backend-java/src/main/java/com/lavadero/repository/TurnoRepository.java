package com.lavadero.repository;

import com.lavadero.model.Turno;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface TurnoRepository extends JpaRepository<Turno, Integer> {
    List<Turno> findByFechaHoraBetween(LocalDateTime start, LocalDateTime end);
}
