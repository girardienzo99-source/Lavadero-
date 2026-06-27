import sys
import os

# Añadir la carpeta de analíticas al path de ejecución de Python
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "automation-python"))

# Exponer la instancia de FastAPI a Vercel
from api.main import app
