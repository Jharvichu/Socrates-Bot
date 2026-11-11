import json
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from config import STATIC_DIR, TEMPLATES_DIR, DATA_DIR, APP_HOST, APP_PORT
from app.socratic_tutor import SocraticRouter
from app.code_sandbox import execute_python_code
from app.user_profile import UserProfileManager
from app.rooms_manager import RoomManager
from app.pet_manager import VirtualPet

# Inicializacion de la aplicacion FastAPI
app = FastAPI(title="Socrates Bot", version="0.7.0")

# Montaje de archivos estaticos y plantillas
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

# Servicios de logica de negocio
socratic_router = SocraticRouter()
profile_manager = UserProfileManager()
room_manager = RoomManager()

# Modelos para recepcion de peticiones
class ExecuteRequest(BaseModel):
    exercise_id: str
    code: str
    user_id: str = "default_user"

class SocraticHintRequest(BaseModel):
    exercise_id: str
    exercise_title: str
    exercise_prompt: str
    user_code: str
    execution_output: str
    consecutive_errors: int = 0
    user_emotion: str = "curioso"

class AccessibilityUpdateRequest(BaseModel):
    user_id: str = "default_user"
    profile_type: str
    settings: dict

# Ruta principal de la interfaz web PWA
@app.get("/", response_class=HTMLResponse)
async def serve_index(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")

# Ruta para el icono de favoritos del navegador
@app.get("/favicon.ico")
async def favicon():
    from fastapi.responses import FileResponse
    icon_path = STATIC_DIR / "img" / "mascota" / "aprendiz.png"
    if icon_path.exists():
        return FileResponse(icon_path)
    return JSONResponse(status_code=204, content={})

# Obtiene la lista de retos de programacion
@app.get("/api/exercises")
async def get_exercises():
    data_file = DATA_DIR / "simulated_data.json"
    if data_file.exists():
        with open(data_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            return JSONResponse(content={"exercises": data.get("exercises", [])})
    return JSONResponse(content={"exercises": []})

# Obtiene el perfil persistente del estudiante
@app.get("/api/profile")
async def get_profile(user_id: str = "default_user"):
    profile = profile_manager.load_profile(user_id)
    return JSONResponse(content=profile)

# Actualiza las preferencias de accesibilidad
@app.post("/api/accessibility")
async def update_accessibility(payload: AccessibilityUpdateRequest):
    updated = profile_manager.update_accessibility(
        payload.user_id, payload.profile_type, payload.settings
    )
    return JSONResponse(content=updated)

# Ejecuta codigo en el sandbox con timeout estricto de 2 segundos
@app.post("/api/execute")
async def run_code(payload: ExecuteRequest):
    result = execute_python_code(payload.code)

    # Identificar tema del ejercicio
    topic = "variables"
    data_file = DATA_DIR / "simulated_data.json"
    if data_file.exists():
        with open(data_file, "r", encoding="utf-8") as f:
            exercises = json.load(f).get("exercises", [])
            for ex in exercises:
                if ex.get("id") == payload.exercise_id:
                    topic = ex.get("topic", "variables")
                    break

    # Registro de actividad y actualizacion de la mascota
    activity_update = profile_manager.record_activity(
        payload.user_id,
        payload.exercise_id,
        topic,
        result["success"]
    )

    result["profile"] = activity_update["profile"]
    result["pet_state"] = activity_update["pet_state"]
    return JSONResponse(content=result)

# Consulta socrática mediante Groq o fallback local
@app.post("/api/socratic-hint")
async def socratic_hint(payload: SocraticHintRequest):
    guidance = socratic_router.get_guidance(
        exercise_title=payload.exercise_title,
        exercise_prompt=payload.exercise_prompt,
        user_code=payload.user_code,
        execution_output=payload.execution_output,
        error_count=payload.consecutive_errors,
        user_emotion=payload.user_emotion
    )
    return JSONResponse(content=guidance)

# Datos analiticos para el Dashboard Docente
@app.get("/api/dashboard-analytics")
async def dashboard_analytics():
    data_file = DATA_DIR / "simulated_data.json"
    if data_file.exists():
        with open(data_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            return JSONResponse(content=data.get("classroom_analytics", {}))
    return JSONResponse(content={})

# Endpoint WebSocket para salas colaborativas en tiempo real
@app.websocket("/ws/room/{room_id}")
async def room_websocket(websocket: WebSocket, room_id: str, pet_stage: str = "huevo"):
    # La fase de la mascota llega desde el perfil del cliente (?pet_stage=...); el nombre lo asigna el servidor
    member = await room_manager.connect(room_id, websocket, pet_stage)
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "code_change":
                new_code = data.get("code", "")
                room_manager.update_code(room_id, new_code)
                await room_manager.broadcast(room_id, {
                    "type": "code_update",
                    "code": new_code
                }, exclude=member["id"])
    except WebSocketDisconnect:
        await room_manager.disconnect(room_id, member["id"])

# Ejecucion directa del servidor
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=APP_HOST, port=APP_PORT, reload=True)
