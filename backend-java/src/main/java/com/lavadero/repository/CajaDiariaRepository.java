package com.lavadero.repository;

import com.lavadero.model.CajaDiaria;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface CajaDiariaRepository extends JpaRepository<CajaDiaria, Integer> {
    Optional<CajaDiaria> findByFecha(LocalDate fecha);
}
