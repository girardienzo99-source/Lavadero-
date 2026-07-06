import os
import psycopg2
import sys

def setup_database():
    print("=== Configuración de Base de Datos Supabase ===")
    
    # Intentar obtener la contraseña de la variable de entorno
    password = os.getenv("SUPABASE_DB_PASSWORD")
    
    if not password:
        print("La variable de entorno SUPABASE_DB_PASSWORD no está definida.")
        password = input("Por favor, ingresa la contraseña de tu base de datos de Supabase: ").strip()
        
    if not password:
        print("[ERROR] Se requiere una contraseña para conectar a Supabase.")
        sys.exit(1)
        
    host = "aws-1-us-west-1.pooler.supabase.com"
    port = 5432
    dbname = "postgres"
    user = "postgres.txpryiflqkxukeldgisc"
    
    print(f"\nConectando a {host}:{port}/{dbname} como {user}...")
    
    try:
        conn = psycopg2.connect(
            host=host,
            port=port,
            dbname=dbname,
            user=user,
            password=password,
            connect_timeout=10
        )
        conn.autocommit = True
        cursor = conn.cursor()
        print("¡Conexión establecida con éxito!")
        
        # Leer el archivo schema.sql
        schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
        if not os.path.exists(schema_path):
            schema_path = "schema.sql"
            
        print(f"Leyendo consultas SQL desde {schema_path}...")
        with open(schema_path, "r", encoding="utf-8") as f:
            sql_script = f.read()
            
        # Ejecutar script SQL
        print("Creando tablas e insertando datos semilla en Supabase... (Por favor, espera)")
        cursor.execute(sql_script)
        print("¡Todas las tablas e índices han sido creados y poblados con éxito en Supabase!")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"\n[ERROR] No se pudo completar la configuración de la base de datos: {e}")
        sys.exit(1)

if __name__ == "__main__":
    setup_database()
