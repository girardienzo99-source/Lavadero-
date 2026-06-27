package com.lavadero.repository;

import com.lavadero.model.Servicio;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface ServicioRepository extends JpaRepository<Servicio, Integer> {
    Optional<Servicio> findByNombre(String nombre);
}
