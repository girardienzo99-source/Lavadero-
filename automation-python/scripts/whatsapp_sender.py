import sys
import os
import time
import webbrowser
import json

def send_whatsapp_message(phone, message):
    print(f"[WHATSAPP] Preparando envío a {phone}...")
    
    # Formatear el número de teléfono (debe tener código de país, ej. +549...)
    # Limpiar caracteres comunes
    clean_phone = phone.replace("+", "").replace("-", "").replace(" ", "")
    
    # URL de la API de WhatsApp Web
    # https://web.whatsapp.com/send?phone=NUMBER&text=URLECODEDTEXT
    import urllib.parse
    encoded_message = urllib.parse.quote(message)
    whatsapp_url = f"https://web.whatsapp.com/send?phone={clean_phone}&text={encoded_message}"
    
    # Intentar importar PyAutoGUI para automatización de teclado/mouse
    try:
        import pyautogui
        
        # En sistemas operativos de servidor o entornos sin GUI (e.g., Docker, CLI pura sin display), 
        # PyAutoGUI fallará. Manejamos esto para que no rompa el script.
        if os.environ.get('DISPLAY') is None and os.name != 'nt':
            raise Exception("No GUI environment detected (DISPLAY env variable missing).")
            
        print(f"[WHATSAPP] Abriendo navegador con la URL: {whatsapp_url}")
        # Abrir en el navegador predeterminado
        webbrowser.open(whatsapp_url)
        
        # Esperar a que WhatsApp Web cargue (puede demorar dependiendo de la conexión)
        # Se sugiere un delay prudente de 15 segundos para la carga inicial
        print("[WHATSAPP] Esperando 15 segundos a que cargue WhatsApp Web...")
        time.sleep(15)
        
        # Simular presionar la tecla Enter para enviar el mensaje
        print("[WHATSAPP] Presionando ENTER para enviar...")
        pyautogui.press('enter')
        
        # Esperar 2 segundos para asegurar el envío y luego cerrar la pestaña/ventana (opcional)
        time.sleep(2)
        
        return {
            "status": "SENT",
            "phone": phone,
            "message": message,
            "method": "pyautogui_simulation"
        }
        
    except Exception as e:
        # Fallback si no hay interfaz gráfica o falla pyautogui
        print(f"[WHATSAPP-WARNING] No se pudo automatizar con PyAutoGUI ({e}). Ejecutando en Modo de Simulación por Log.")
        print(f"==================================================")
        print(f"ENVIADO A: {phone}")
        print(f"MENSAJE: {message}")
        print(f"==================================================")
        
        return {
            "status": "SIMULATED",
            "phone": phone,
            "message": message,
            "reason": f"Safe simulation mode active: {e}"
        }

if __name__ == "__main__":
    # Validar argumentos desde la línea de comandos
    if len(sys.argv) < 3:
        print(json.dumps({
            "status": "ERROR",
            "message": "Faltan argumentos. Uso: python whatsapp_sender.py <telefono> <mensaje>"
        }, indent=2))
        sys.exit(1)
        
    phone_number = sys.argv[1]
    message_text = sys.argv[2]
    
    result = send_whatsapp_message(phone_number, message_text)
    print(json.dumps(result, indent=2))
