package com.lavadero.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Service
public class PythonIntegrationService {

    private static final Logger logger = LoggerFactory.getLogger(PythonIntegrationService.class);

    @Value("${python.executable}")
    private String pythonExecutable;

    @Value("${python.scripts-path}")
    private String scriptsPath;

    public record PythonScriptResult(int exitCode, String stdout, String stderr) {
        public boolean isSuccess() {
            return exitCode == 0;
        }
    }

    /**
     * Ejecuta un script de Python de forma asíncrona o síncrona usando ProcessBuilder.
     *
     * @param scriptName Nombre del archivo del script (ej. "customer_loyalty.py")
     * @param arguments  Lista de argumentos posicionales para el script
     * @return Objeto PythonScriptResult con los flujos de salida y el código de retorno
     */
    public PythonScriptResult executeScript(String scriptName, List<String> arguments) {
        String scriptFullPath = scriptsPath + File.separator + scriptName;
        logger.info("Iniciando ejecución del script Python: {}", scriptFullPath);

        List<String> command = new ArrayList<>();
        command.add(pythonExecutable);
        command.add(scriptFullPath);
        if (arguments != null) {
            command.addAll(arguments);
        }

        StringBuilder stdout = new StringBuilder();
        StringBuilder stderr = new StringBuilder();
        int exitCode = -1;

        try {
            ProcessBuilder processBuilder = new ProcessBuilder(command);
            // Configurar directorio de trabajo en la raíz de scripts para resolución de imports locales
            processBuilder.directory(new File(scriptsPath));
            
            // Iniciar proceso
            Process process = processBuilder.start();

            // Leer flujo de salida estándar (stdout)
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    stdout.append(line).append("\n");
                    logger.debug("[Python STDOUT] {}", line);
                }
            }

            // Leer flujo de errores (stderr)
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getErrorStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    stderr.append(line).append("\n");
                    logger.warn("[Python STDERR] {}", line);
                }
            }

            // Esperar que termine el proceso con un límite de tiempo (e.g. 60 segundos)
            boolean finished = process.waitFor(60, TimeUnit.SECONDS);
            if (finished) {
                exitCode = process.exitValue();
                logger.info("Script finalizado. Código de salida: {}", exitCode);
            } else {
                logger.error("El script Python excedió el tiempo de espera (timeout) y será finalizado forzosamente.");
                process.destroyForcibly();
                exitCode = 143; // Código estándar para proceso abortado
                stderr.append("Process killed due to timeout (60s).");
            }

        } catch (Exception e) {
            logger.error("Error al ejecutar el script de Python: {}", e.getMessage(), e);
            stderr.append("Exception occurred: ").append(e.getMessage());
            exitCode = -1;
        }

        return new PythonScriptResult(exitCode, stdout.toString().trim(), stderr.toString().trim());
    }
}
