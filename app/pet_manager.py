# Gestion de la mascota virtual pingüino y diseno emocional de Norman

PET_STAGES = {
    "huevo": {
        "name": "Huevo de Pinguino",
        "stage_level": 1,
        "image_file": "huevo.png",
        "image_path": "/static/img/mascota/huevo.png",
        "description": "Un huevo con una bufanda azul que reacciona con calor y vibracion cada vez que dictas o pruebas codigo.",
        "required_points": 0,
        "norman_reflection": "Fase de descubrimiento. Estas empezando tu camino en el mundo de la programacion.",
        "tts_intro": "Hola, soy tu companero de viaje. Por ahora soy un huevo con muchas ganas de aprender contigo."
    },
    "aprendiz": {
        "name": "Pinguino Aprendiz",
        "stage_level": 2,
        "image_file": "aprendiz.png",
        "image_path": "/static/img/mascota/aprendiz.png",
        "description": "Un pequeno pinguino bebe con libreta de apuntes que celebra cada variable y condicional resuelto.",
        "required_points": 20,
        "norman_reflection": "Fase de adaptacion. Ya entiendes como la computadora toma decisiones con condicionales.",
        "tts_intro": "Ya sali del cascaron. Gracias a tus logros ahora puedo caminar y aprender a tu lado."
    },
    "junior": {
        "name": "Pinguino Junior",
        "stage_level": 3,
        "image_file": "junior.png",
        "image_path": "/static/img/mascota/junior.png",
        "description": "Un pinguino agil con audifonos que nada con destreza entre bucles y secuencias repetitivas.",
        "required_points": 50,
        "norman_reflection": "Fase de consolidacion. Has dominado la repeticion y el manejo de colecciones de datos.",
        "tts_intro": "Mira como creci. Los bucles y las listas ya no nos detienen."
    },
    "senior": {
        "name": "Pinguino Senior",
        "stage_level": 4,
        "image_file": "senior.png",
        "image_path": "/static/img/mascota/senior.png",
        "description": "Un pinguino elegante con lentes de lectura que domina la definicion de funciones y la reutilizacion de codigo.",
        "required_points": 90,
        "norman_reflection": "Fase de abstraccion. Sabes crear funciones limpias y resolver problemas complejos.",
        "tts_intro": "Nos hemos vuelto un equipo muy eficiente. Tu codigo ahora es ordenado y modular."
    },
    "sabio": {
        "name": "Pinguino Sabio",
        "stage_level": 5,
        "image_file": "sabio.png",
        "image_path": "/static/img/mascota/sabio.png",
        "description": "Un venerable pinguino con capa de graduado y baston de hielo que ayuda a otros companeros en las salas colaborativas.",
        "required_points": 140,
        "norman_reflection": "Fase de maestria. Tienes la base solida para aprender cualquier otro lenguaje y guiar a otros.",
        "tts_intro": "Llegamos a la cumbre. Eres capaz de pensar como programador y encontrar soluciones por tu cuenta."
    }
}

class VirtualPet:
    def __init__(self, current_stage: str = "huevo", energy: int = 100, mood: str = "curioso"):
        self.stage = current_stage if current_stage in PET_STAGES else "huevo"
        self.energy = energy
        self.mood = mood

    def calculate_stage(self, points: int) -> str:
        new_stage = "huevo"
        if points >= 140:
            new_stage = "sabio"
        elif points >= 90:
            new_stage = "senior"
        elif points >= 50:
            new_stage = "junior"
        elif points >= 20:
            new_stage = "aprendiz"
        return new_stage

    def update_after_exercise(self, success: bool, consecutive_errors: int, current_points: int) -> dict:
        old_stage = self.stage
        new_stage = self.calculate_stage(current_points)
        has_evolved = (new_stage != old_stage)
        self.stage = new_stage

        # Evaluacion conductual y visceral segun el resultado
        if success:
            self.mood = "entusiasmado"
            self.energy = min(100, self.energy + 10)
            message = "Tu pinguino salta de alegria y festeja tu solucion."
            tts_text = "Bien hecho. Tu solucion funciono correctamente."
        elif consecutive_errors >= 3:
            self.mood = "solidario"
            self.energy = max(30, self.energy - 5)
            message = "Tu pinguino te ofrece un vaso de agua fria y sugiere respirar hondo antes de la siguiente prueba."
            tts_text = "No te preocupes. Respira hondo, analicemos el problema juntos."
        else:
            self.mood = "atento"
            message = "Tu pinguino mira fijamente el editor con curiosidad."
            tts_text = "Sigamos intentando. Estamos muy cerca."

        stage_data = PET_STAGES[self.stage]

        return {
            "stage_key": self.stage,
            "stage_name": stage_data["name"],
            "image_path": stage_data["image_path"],
            "image_file": stage_data["image_file"],
            "description": stage_data["description"],
            "mood": self.mood,
            "energy": self.energy,
            "has_evolved": has_evolved,
            "behavioral_message": message,
            "tts_feedback": tts_text,
            "norman_reflection": stage_data["norman_reflection"]
        }

    def get_state(self) -> dict:
        stage_data = PET_STAGES[self.stage]
        return {
            "stage_key": self.stage,
            "stage_name": stage_data["name"],
            "image_path": stage_data["image_path"],
            "image_file": stage_data["image_file"],
            "description": stage_data["description"],
            "mood": self.mood,
            "energy": self.energy,
            "norman_reflection": stage_data["norman_reflection"],
            "tts_intro": stage_data["tts_intro"]
        }
