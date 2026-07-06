import os
import json
import pandas as pd

DB_URL = os.getenv("DATABASE_URL", f"postgresql://postgres.txpryiflqkxukeldgisc:{os.getenv('SUPABASE_DB_PASSWORD', 'Enzo37108100.')}@aws-1-us-west-1.pooler.supabase.com:5432/postgres")

def calculate_nps():
    print("[NPS] Buscando valoraciones de clientes en la base de datos...")
    
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        
        conn_str = DB_URL
        if conn_str.startswith("jdbc:"):
            conn_str = conn_str.replace("jdbc:", "")
            
        conn = psycopg2.connect(conn_str, cursor_factory=RealDictCursor)
        cursor = conn.cursor()
        
        # Consultar puntuaciones
        cursor.execute("SELECT puntuacion FROM feedback_clientes;")
        rows = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        if not rows:
            return {
                "status": "NO_DATA",
                "nps": 0,
                "total_respuestas": 0,
                "promotores": 0,
                "pasivos": 0,
                "detractores": 0
            }
            
        # Convertir a DataFrame de Pandas para análisis
        df = pd.DataFrame(rows)
        return process_nps_df(df, is_mock=False)
        
    except Exception as e:
        print(f"[NPS-WARNING] Error al conectar a la DB ({e}). Generando reporte simulado.")
        # Fallback a datos simulados
        mock_scores = {"puntuacion": [5, 5, 4, 2, 5, 4, 5, 3]} # 5 promotores (5), 2 pasivos (4), 2 detractores (2,3)
        df = pd.DataFrame(mock_scores)
        return process_nps_df(df, is_mock=True)

def process_nps_df(df, is_mock):
    total = len(df)
    
    # Clasificación en base a estrellas de 1 a 5:
    # 5 estrellas -> Promotores
    # 4 estrellas -> Pasivos
    # 1 a 3 estrellas -> Detractores
    promotores = len(df[df['puntuacion'] == 5])
    pasivos = len(df[df['puntuacion'] == 4])
    detractores = len(df[df['puntuacion'] <= 3])
    
    # Calcular porcentajes
    pct_promotores = (promotores / total) * 100
    pct_detractores = (detractores / total) * 100
    
    # NPS = % Promotores - % Detractores
    nps_score = round(pct_promotores - pct_detractores, 1)
    
    # Nivel de satisfacción
    status = "EXCELENTE"
    if nps_score < 0:
        status = "CRÍTICO (MEJORAR URGENTE)"
    elif nps_score < 50:
        status = "BUENO / ACEPTABLE"
    
    return {
        "status": status,
        "nps": nps_score,
        "total_respuestas": total,
        "promotores": promotores,
        "pasivos": pasivos,
        "detractores": detractores,
        "porcentaje_promotores": round(pct_promotores, 1),
        "porcentaje_detractores": round(pct_detractores, 1),
        "modo_simulacion": is_mock
    }

if __name__ == "__main__":
    result = calculate_nps()
    print(json.dumps(result, indent=2))
