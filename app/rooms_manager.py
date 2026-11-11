import itertools
from typing import Dict, List
from fastapi import WebSocket

from app.pet_manager import PET_STAGES

# Administrador de salas colaborativas en tiempo real para estudiantes
class RoomManager:
    def __init__(self):
        # Conexiones activas por sala: lista de (id de miembro, websocket)
        self.active_rooms: Dict[str, List[tuple]] = {}
        # Estado compartido de codigo por sala
        self.room_code: Dict[str, str] = {
            "sala-1": "# Sala de estudio colaborativa 1\n# Puedes escribir o dictar código aquí junto a tus compañeros\n",
            "sala-2": "# Sala de estudio colaborativa 2\n"
        }
        # Registro de participantes y mascotas por sala
        self.room_members: Dict[str, List[dict]] = {
            "sala-1": [
                {"id": "bot", "name": "Compañero Bot", "pet_stage": "aprendiz", "role": "par"}
            ],
            "sala-2": []
        }
        # Contadores para asignar nombres unicos ("Estudiante 1", "Estudiante 2", ...)
        self._member_ids = itertools.count(1)
        self._name_counters: Dict[str, itertools.count] = {}

    async def connect(self, room_id: str, websocket: WebSocket, pet_stage: str) -> dict:
        await websocket.accept()
        # setdefault: no borra el codigo inicial ni los participantes de ejemplo de la sala
        self.active_rooms.setdefault(room_id, [])
        self.room_code.setdefault(room_id, "# Sala de estudio colaborativa\n")
        self.room_members.setdefault(room_id, [])
        counter = self._name_counters.setdefault(room_id, itertools.count(1))

        member = {
            "id": f"m{next(self._member_ids)}",
            "name": f"Estudiante {next(counter)}",
            "pet_stage": pet_stage if pet_stage in PET_STAGES else "huevo",
            "role": "estudiante"
        }
        self.active_rooms[room_id].append((member["id"], websocket))
        self.room_members[room_id].append(member)

        # Bienvenida solo para quien entra: su identidad, el codigo actual y los participantes
        await websocket.send_json({
            "type": "welcome",
            "member": member,
            "code": self.room_code[room_id],
            "members": self.room_members[room_id]
        })
        # Aviso al resto de la sala
        await self.broadcast(room_id, {
            "type": "member_joined",
            "member": member,
            "members": self.room_members[room_id]
        }, exclude=member["id"])
        return member

    async def disconnect(self, room_id: str, member_id: str):
        # Quita solo la conexion y el participante de quien salio
        self.active_rooms[room_id] = [
            (mid, ws) for mid, ws in self.active_rooms.get(room_id, []) if mid != member_id
        ]
        left = next((m for m in self.room_members.get(room_id, []) if m["id"] == member_id), None)
        self.room_members[room_id] = [
            m for m in self.room_members.get(room_id, []) if m["id"] != member_id
        ]
        if left:
            await self.broadcast(room_id, {
                "type": "member_left",
                "member": left,
                "members": self.room_members[room_id]
            })

    async def broadcast(self, room_id: str, message: dict, exclude: str = None):
        dead = []
        for mid, connection in list(self.active_rooms.get(room_id, [])):
            if mid == exclude:
                continue
            try:
                await connection.send_json(message)
            except Exception:
                dead.append(mid)
        # Limpieza de conexiones caidas
        for mid in dead:
            await self.disconnect(room_id, mid)

    def update_code(self, room_id: str, new_code: str):
        self.room_code[room_id] = new_code

    def get_room_state(self, room_id: str) -> dict:
        return {
            "room_id": room_id,
            "code": self.room_code.get(room_id, ""),
            "active_connections": len(self.active_rooms.get(room_id, [])),
            "members": self.room_members.get(room_id, [])
        }
