# Walkthrough de la Implementación: Satisfacción del Cliente (NPS)

Hemos implementado un sistema integrado para **medir la satisfacción de los clientes (NPS)** utilizando la combinación híbrida de Java y Python.

---

## 📈 Componentes de Satisfacción e NPS Creados

### 1. Base de Datos PostgreSQL
* Modificado [schema.sql](file:///c:/Lavadero/database/schema.sql) para crear la tabla `feedback_clientes` (id, cliente_id, puntuacion de 1 a 5 estrellas, comentario, fecha) y añadir valoraciones de prueba para el cálculo inicial.

### 2. Backend en Java (JPA + REST)
* [FeedbackCliente.java](file:///c:/Lavadero/backend-java/src/main/java/com/lavadero/model/FeedbackCliente.java): Mapea la tabla de satisfacción.
* [FeedbackClienteRepository.java](file:///c:/Lavadero/backend-java/src/main/java/com/lavadero/repository/FeedbackClienteRepository.java): Operaciones de base de datos.
* [POSController.java](file:///c:/Lavadero/backend-java/src/main/java/com/lavadero/controller/POSController.java): Añadido el endpoint `POST /api/pos/feedback` para registrar calificaciones directamente tras realizar el cobro.

### 3. Analítica y APIs en Python
* [feedback_nps_analyzer.py](file:///c:/Lavadero/automation-python/scripts/feedback_nps_analyzer.py): Script que clasifica las valoraciones en Promotores (5★), Pasivos (4★) y Detractores (1-3★), calcula el NPS consolidado (`% Promotores - % Detractores`) y entrega el resultado estructurado en JSON.
* [main.py](file:///c:/Lavadero/automation-python/api/main.py): Añadido el endpoint `/nps` a FastAPI para servir las métricas en tiempo real usando Pandas, con fallback a simulación local si PostgreSQL no está conectado.

### 4. Controlador de la UI y Panel Dashboard
* En [DashboardController.java](file:///c:/Lavadero/backend-java/src/main/java/com/lavadero/controller/DashboardController.java), se consume la API `/nps` para cargar las métricas en el modelo (con fallback seguro en modo offline).
* En [dashboard.html](file:///c:/Lavadero/backend-java/src/main/resources/templates/dashboard.html), se integró el widget **"⭐ Satisfacción del Cliente (NPS)"** en la columna de marketing:
  * Muestra el puntaje NPS destacado (ej. `+75 NPS`) y el nivel de satisfacción general.
  * Muestra la distribución de Promotores, Pasivos y Detractores.
  * Incorpora un formulario AJAX de valoración rápida para registrar encuestas al instante sin recargar la página.

---

## 🧪 Pruebas y Validación Realizadas

* El script de analítica se ejecutó con éxito en modo de simulación y arrojó el resultado JSON correcto:
  ```json
  {
    "status": "BUENO / ACEPTABLE",
    "nps": 25.0,
    "total_respuestas": 8,
    "promotores": 4,
    "pasivos": 2,
    "detractores": 2
  }
  ```
