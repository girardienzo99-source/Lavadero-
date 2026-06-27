package com.lavadero.repository;

import com.lavadero.model.FeedbackCliente;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface FeedbackClienteRepository extends JpaRepository<FeedbackCliente, Integer> {
}
