import os
from pathlib import Path
from dotenv import load_dotenv

# Carga variables desde el archivo .env si existe
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

# Configuracion de Groq
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

# Parametros del servidor
APP_HOST = os.getenv("APP_HOST", "0.0.0.0")
APP_PORT = int(os.getenv("APP_PORT", "8000"))

# Parametros de ejecucion del sandbox
SANDBOX_TIMEOUT_SECONDS = 2.0

# Rutas base
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"
DATA_DIR = BASE_DIR / "data"
PET_IMG_DIR = STATIC_DIR / "img" / "mascota"
