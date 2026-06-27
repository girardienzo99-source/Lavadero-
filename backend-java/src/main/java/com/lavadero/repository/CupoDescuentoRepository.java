package com.lavadero.repository;

import com.lavadero.model.CupoDescuento;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface CupoDescuentoRepository extends JpaRepository<CupoDescuento, Integer> {
    Optional<CupoDescuento> findByCodigo(String codigo);
}
