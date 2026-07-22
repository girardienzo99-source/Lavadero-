import os
import random
import string
import json
from datetime import datetime, timedelta

DB_URL = os.getenv("DATABASE_URL", "").strip()

def generate_coupon_code(length=6):
    """Genera un código alfanumérico aleatorio para el cupón."""
    chars = string.ascii_uppercase + string.digits
    return "VOLVE" + "".join(random.choice(chars) for _ in range(length))

def run_loyalty_campaign():
    print("[LOYALTY] Buscando clientes inactivos hace más de 20 días...")
    if not DB_URL:
        raise RuntimeError("DATABASE_URL no está configurada.")
    
    # 20 días de inactividad
    limite_inactividad = datetime.now() - timedelta(days=20)
    
    # Intentar conectar a PostgreSQL usando psycopg2
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        
        # Parsear la URL de conexión (formato jdbc:postgresql:// o postgresql://)
        # Para psycopg2, necesitamos adaptarla a formato DSN o keywords
        conn_str = DB_URL
        if conn_str.startswith("jdbc:"):
            conn_str = conn_str.replace("jdbc:", "")
            
        conn = psycopg2.connect(conn_str, cursor_factory=RealDictCursor)
        cursor = conn.cursor()
        
        # Buscar clientes que no nos visitan hace más de 20 días y no tengan un cupón activo generado recientemente
        # (para no duplicar cupones)
        query = """
            SELECT id, nombre, telefono, email, ultima_visita 
            FROM clientes 
            WHERE ultima_visita < %s 
              AND id NOT IN (
                  SELECT cliente_id 
                  FROM cupones_descuento 
                  WHERE usado = FALSE AND fecha_expiracion > NOW()
              );
        """
        cursor.execute(query, (limite_inactividad,))
        clientes_inactivos = cursor.fetchall()
        
        campana_resultados = []
        
        if not clientes_inactivos:
            print("[LOYALTY] No se encontraron clientes inactivos elegibles para cupones.")
        else:
            print(f"[LOYALTY] Se encontraron {len(clientes_inactivos)} clientes inactivos. Generando cupones...")
            
            for cliente in clientes_inactivos:
                codigo = generate_coupon_code()
                descuento = 15 # 15% de descuento para incentivar el retorno
                fecha_expiracion = datetime.now() + timedelta(days=15) # Expira en 15 días
                
                # Insertar el cupón de descuento en la DB
                insert_query = """
                    INSERT INTO cupones_descuento (codigo, cliente_id, descuento_porcentaje, fecha_expiracion)
                    VALUES (%s, %s, %s, %s);
                """
                cursor.execute(insert_query, (codigo, cliente['id'], descuento, fecha_expiracion))
                
                campana_resultados.append({
                    "cliente_id": cliente['id'],
                    "nombre": cliente['nombre'],
                    "telefono": cliente['telefono'],
                    "ultimo_lavado": str(cliente['ultima_visita']),
                    "codigo_cupon": codigo,
                    "descuento": f"{descuento}%",
                    "valido_hasta": fecha_expiracion.strftime("%Y-%m-%d")
                })
                print(f"  -> Cupón {codigo} ({descuento}%) creado para {cliente['nombre']}.")
                
            conn.commit()
            
        cursor.close()
        conn.close()
        
        # Imprimir resultado formateado en JSON para que el backend Java pueda consumirlo fácilmente
        print(json.dumps({
            "status": "COMPLETED",
            "modo": "DATABASE",
            "clientes_contactados": len(campana_resultados),
            "campana": campana_resultados
        }, indent=2))
        
    except Exception as e:
        print(json.dumps({
            "status": "ERROR",
            "message": "No se pudo ejecutar la campaña con datos reales."
        }, indent=2))
        raise RuntimeError("Falló la campaña de fidelización.") from e

if __name__ == "__main__":
    run_loyalty_campaign()
