import asyncio
from typing import Dict, List
from fastapi import WebSocket

# Administrador de salas colaborativas en tiempo real para estudiantes
class RoomManager:
    def __init__(self):
        # Diccionario de conexiones por sala
        self.active_rooms: Dict[str, List[WebSocket]] = {}
        # Estado compartido de codigo por sala
        self.room_code: Dict[str, str] = {
            "sala-1": "# Sala de estudio colaborativa 1\n# Puedes escribir o dictar codigo aqui junto a tus companeros\n",
            "sala-2": "# Sala de estudio colaborativa 2\n"
        }
        # Registro de participantes y mascotas por sala
        self.room_members: Dict[str, List[dict]] = {
            "sala-1": [
                {"name": "Companero Bot", "pet_stage": "aprendiz", "role": "par"}
            ],
            "sala-2": []
        }

    async def connect(self, room_id: str, websocket: WebSocket, student_name: str, pet_stage: str):
        await websocket.accept()
        if room_id not in self.active_rooms:
            self.active_rooms[room_id] = []
            self.room_code[room_id] = "# Sala de estudio colaborativa\n"
            self.room_members[room_id] = []

        self.active_rooms[room_id].append(websocket)
        self.room_members[room_id].append({
            "name": student_name,
            "pet_stage": pet_stage,
            "role": "estudiante"
        })

        # Notificar a la sala de la nueva incorporacion
        await self.broadcast(room_id, {
            "type": "member_joined",
            "student_name": student_name,
            "pet_stage": pet_stage,
            "code": self.room_code.get(room_id, ""),
            "members": self.room_members.get(room_id, [])
        })

    def disconnect(self, room_id: str, websocket: WebSocket, student_name: str = ""):
        if room_id in self.active_rooms and websocket in self.active_rooms[room_id]:
            self.active_rooms[room_id].remove(websocket)
            if student_name:
                self.room_members[room_id] = [
                    m for m in self.room_members.get(room_id, [])
                    if m.get("name") != student_name
                ]

    async def broadcast(self, room_id: str, message: dict):
        if room_id in self.active_rooms:
            dead_connections = []
            for connection in self.active_rooms[room_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    dead_connections.append(connection)
            for dead in dead_connections:
                if dead in self.active_rooms[room_id]:
                    self.active_rooms[room_id].remove(dead)

    def update_code(self, room_id: str, new_code: str):
        self.room_code[room_id] = new_code

    def get_room_state(self, room_id: str) -> dict:
        return {
            "room_id": room_id,
            "code": self.room_code.get(room_id, ""),
            "active_connections": len(self.active_rooms.get(room_id, [])),
            "members": self.room_members.get(room_id, [])
        }
