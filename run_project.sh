#!/bin/bash

echo "=================================================="
echo "     INICIANDO ECOSISTEMA HIBRIDO CAR WASH"
echo "=================================================="
echo ""

# 1. Iniciar Servidor Python FastAPI
echo "[PYTHON] Configurando entorno virtual..."
cd automation-python
if [ ! -d ".venv" ]; then
    echo "[PYTHON] Entorno virtual no encontrado. Creando .venv..."
    python3 -m venv .venv
fi

echo "[PYTHON] Activando entorno virtual..."
source .venv/bin/activate

echo "[PYTHON] Verificando e instalando dependencias..."
pip install -r requirements.txt

echo "[PYTHON] Levantando microservicio FastAPI en puerto 8000 en segundo plano..."
python api/main.py > /dev/null 2>&1 &
PYTHON_PID=$!
echo "[PYTHON] FastAPI iniciado con PID: $PYTHON_PID"

cd ..
echo ""

# 2. Iniciar Servidor Java Spring Boot
echo "[JAVA] Configurando backend Spring Boot..."
cd backend-java

# Comprobar si maven está instalado
if command -v mvn &> /dev/null; then
    echo "[JAVA] Maven detectado. Iniciando aplicacion en puerto 8080..."
    mvn spring-boot:run
else
    echo "[JAVA-WARNING] Maven ('mvn') no esta instalado en su PATH."
    echo "[JAVA-WARNING] Abra la carpeta 'backend-java' en su IDE preferido (IntelliJ, VS Code, etc.)"
    echo "[JAVA-WARNING] y ejecute la clase principal 'com.lavadero.LavaderoApplication' manualmente."
    echo ""
    echo "El microservicio de Python (FastAPI) ya se esta ejecutando en segundo plano en http://localhost:8000 (PID: $PYTHON_PID)"
    echo "Puede detenerlo ejecutando: kill $PYTHON_PID"
    echo ""
    read -p "Presione [Enter] para salir..."
fi

cd ..
