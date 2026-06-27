@echo off
title Orquestador Lavadero Car Wash
echo ==================================================
echo      INICIANDO ECOSISTEMA HIBRIDO CAR WASH
echo ==================================================
echo.

:: 1. Iniciar Servidor Python FastAPI
echo [PYTHON] Configurando entorno virtual...
cd automation-python
if not exist .venv (
    echo [PYTHON] Entorno virtual no encontrado. Creando .venv...
    python -m venv .venv
)

echo [PYTHON] Activando entorno virtual...
call .venv\Scripts\activate.bat

echo [PYTHON] Verificando e instalando dependencias (requirements.txt)...
pip install -r requirements.txt

echo [PYTHON] Levantando microservicio FastAPI en puerto 8000 en segundo plano...
start "FastAPI - Python Analytics" cmd /k "python api/main.py"

cd ..
echo.

:: 2. Iniciar Servidor Java Spring Boot
echo [JAVA] Configurando backend Spring Boot...
cd backend-java

:: Comprobar si maven está instalado
where mvn >nul 2>nul
if %errorlevel% equ 0 (
    echo [JAVA] Maven detectado. Iniciando aplicacion en puerto 8080...
    mvn spring-boot:run
) else (
    echo [JAVA-WARNING] Maven ('mvn') no esta instalado en el PATH de su sistema.
    echo [JAVA-WARNING] Abra la carpeta 'backend-java' en su IDE preferido (IntelliJ, Eclipse o VS Code)
    echo [JAVA-WARNING] y ejecute la clase principal 'com.lavadero.LavaderoApplication' manualmente.
    echo.
    echo El microservicio de Python (FastAPI) ya se esta ejecutando en http://localhost:8000
    echo.
    pause
)

cd ..
