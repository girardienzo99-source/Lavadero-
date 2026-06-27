import os
import pandas as pd
from fastapi import FastAPI
from sqlalchemy import create_engine, text

app = FastAPI(
    title="Lavadero Car Wash - API de Analítica de Marketing",
    description="Microservicio Python para segmentación y analítica de clientes utilizando Pandas y SQLAlchemy.",
    version="1.0.0"
)

# Configuración de base de datos
DB_URL = os.getenv("DATABASE_URL", f"postgresql://postgres:{os.getenv('SUPABASE_DB_PASSWORD', 'postgres')}@db.sqczmyaoqplrmrgyczjy.supabase.co:5432/postgres")

def get_customer_data_from_db():
    """
    Intenta obtener los clientes y sus consumos consolidados desde la base de datos PostgreSQL.
    Si la base de datos no está disponible, devuelve un DataFrame con datos simulados y un indicador de fallback.
    """
    try:
        engine = create_engine(DB_URL)
        query = """
            SELECT 
                c.id, 
                c.nombre, 
                c.telefono, 
                c.email, 
                c.clasificacion as clasificacion_actual, 
                c.fecha_registro,
                COALESCE(SUM(v.total), 0) as total_gastado,
                COUNT(v.id) as cantidad_visitas,
                c.ultima_visita
            FROM clientes c
            LEFT JOIN ventas v ON c.id = v.cliente_id AND v.estado = 'COMPLETADA'
            GROUP BY c.id;
        """
        # Cargar datos directo a un DataFrame de Pandas
        with engine.connect() as connection:
            df = pd.read_sql_query(text(query), connection)
        return df, False
    except Exception as e:
        # Fallback a datos simulados para permitir la ejecución/demostración inicial sin DB configurada
        mock_data = {
            "id": [1, 2, 3, 4],
            "nombre": ["Juan Pérez", "María Rodríguez", "Carlos Gómez", "Ana López"],
            "telefono": ["+5491122334455", "+5491133445566", "+5491144556677", "+5491155667788"],
            "email": ["juan.perez@email.com", "maria.rod@email.com", "carlos@email.com", "ana.lopez@email.com"],
            "clasificacion_actual": ["FRECUENTE", "VIP", "OCASIONAL", "OCASIONAL"],
            "fecha_registro": ["2026-05-28", "2026-06-22", "2026-05-13", "2026-06-25"],
            "total_gastado": [15000.0, 45000.0, 2500.0, 5000.0],
            "cantidad_visitas": [6, 15, 1, 2],
            "ultima_visita": ["2026-05-28", "2026-06-22", "2026-06-02", "2026-06-25"]
        }
        df = pd.DataFrame(mock_data)
        # Convertir fechas de texto a datetime
        df['ultima_visita'] = pd.to_datetime(df['ultima_visita'])
        return df, True

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Car Wash Analytics Service",
        "endpoints": {
            "/segmentacion": "Calcula y actualiza la segmentación de clientes VIP/Frecuentes/Ocasionales"
        }
    }

@app.get("/segmentacion")
def calculate_segmentation():
    df, is_mock = get_customer_data_from_db()
    
    # 1. Definir reglas de Growth Marketing basadas en gasto acumulado y visitas
    # VIP: Gasto > $30,000 ARS o más de 10 visitas
    # FRECUENTE: Gasto entre $10,000 y $30,000 ARS, o entre 4 y 10 visitas
    # OCASIONAL: Menos de $10,000 ARS y menos de 4 visitas
    def categorizar_cliente(row):
        gasto = float(row['total_gastado'])
        visitas = int(row['cantidad_visitas'])
        if gasto > 30000 or visitas > 10:
            return "VIP"
        elif gasto >= 10000 or visitas >= 4:
            return "FRECUENTE"
        else:
            return "OCASIONAL"

    # Aplicar la función de segmentación
    df['segmento_calculado'] = df.apply(categorizar_cliente, axis=1)

    # 2. Si no es un mock, actualizar la base de datos con la nueva clasificación
    actualizaciones_exitosas = 0
    if not is_mock:
        try:
            engine = create_engine(DB_URL)
            with engine.begin() as conn:
                for _, row in df.iterrows():
                    # Solo actualizar si cambió la clasificación para evitar escrituras redundantes
                    if row['segmento_calculado'] != row['clasificacion_actual']:
                        update_query = text("UPDATE clientes SET clasificacion = :seg WHERE id = :id")
                        conn.execute(update_query, {"seg": row['segmento_calculado'], "id": int(row['id'])})
                        actualizaciones_exitosas += 1
        except Exception as e:
            # Manejo de error silencioso en la actualización para no romper el GET
            print(f"Error al actualizar clasificación en DB: {e}")

    # Formatear fechas para la respuesta JSON
    if 'ultima_visita' in df.columns:
        df['ultima_visita'] = df['ultima_visita'].dt.strftime('%Y-%m-%d %H:%M:%S')

    result = df.to_dict(orient="records")

    return {
        "status": "success",
        "db_fallback_mocked": is_mock,
        "total_procesados": len(result),
        "actualizaciones_realizadas": actualizaciones_exitosas,
        "clientes": result
    }

@app.get("/nps")
def get_nps_metrics():
    """
    Calcula el Net Promoter Score (NPS) consultando la tabla feedback_clientes.
    """
    try:
        engine = create_engine(DB_URL)
        query = "SELECT puntuacion FROM feedback_clientes;"
        with engine.connect() as connection:
            df = pd.read_sql_query(text(query), connection)
        
        is_mock = False
    except Exception as e:
        # Fallback a datos simulados si la base de datos no está disponible
        print(f"Error de conexion, usando mock NPS: {e}")
        df = pd.DataFrame({"puntuacion": [5, 5, 4, 2, 5, 4, 5, 3]})
        is_mock = True

    if df.empty:
        return {
            "status": "NO_DATA",
            "nps": 0,
            "total_respuestas": 0,
            "promotores": 0,
            "pasivos": 0,
            "detractores": 0,
            "db_fallback_mocked": is_mock
        }

    total = len(df)
    promotores = len(df[df['puntuacion'] == 5])
    pasivos = len(df[df['puntuacion'] == 4])
    detractores = len(df[df['puntuacion'] <= 3])

    pct_promotores = (promotores / total) * 100
    pct_detractores = (detractores / total) * 100
    nps_score = round(pct_promotores - pct_detractores, 1)

    # Clasificar nivel
    if nps_score >= 50:
        nivel = "EXCELENTE"
    elif nps_score >= 0:
        nivel = "BUENO"
    else:
        nivel = "CRÍTICO"

    return {
        "status": "success",
        "nivel": nivel,
        "nps": nps_score,
        "total_respuestas": total,
        "promotores": promotores,
        "pasivos": pasivos,
        "detractores": detractores,
        "porcentaje_promotores": round(pct_promotores, 1),
        "porcentaje_detractores": round(pct_detractores, 1),
        "db_fallback_mocked": is_mock
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

