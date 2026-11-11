# Gestion de la mascota virtual pingüino y diseno emocional de Norman

PET_STAGES = {
    "huevo": {
        "name": "Huevo de Pingüino",
        "stage_level": 1,
        "image_file": "huevo.png",
        "image_path": "/static/img/mascota/huevo.png",
        "description": "Un huevo con una bufanda azul que reacciona con calor y vibración cada vez que dictas o pruebas código.",
        "required_points": 0,
        "norman_reflection": "Fase de descubrimiento. Estás empezando tu camino en el mundo de la programación.",
        "tts_intro": "Hola, soy tu compañero de viaje. Por ahora soy un huevo con muchas ganas de aprender contigo."
    },
    "aprendiz": {
        "name": "Pingüino Aprendiz",
        "stage_level": 2,
        "image_file": "aprendiz.png",
        "image_path": "/static/img/mascota/aprendiz.png",
        "description": "Un pequeño pingüino bebé con libreta de apuntes que celebra cada variable y condicional resuelto.",
        "required_points": 20,
        "norman_reflection": "Fase de adaptación. Ya entiendes cómo la computadora toma decisiones con condicionales.",
        "tts_intro": "Ya salí del cascarón. Gracias a tus logros ahora puedo caminar y aprender a tu lado."
    },
    "junior": {
        "name": "Pingüino Junior",
        "stage_level": 3,
        "image_file": "junior.png",
        "image_path": "/static/img/mascota/junior.png",
        "description": "Un pingüino ágil con audífonos que nada con destreza entre bucles y secuencias repetitivas.",
        "required_points": 50,
        "norman_reflection": "Fase de consolidación. Has dominado la repetición y el manejo de colecciones de datos.",
        "tts_intro": "Mira cómo crecí. Los bucles y las listas ya no nos detienen."
    },
    "senior": {
        "name": "Pingüino Senior",
        "stage_level": 4,
        "image_file": "senior.png",
        "image_path": "/static/img/mascota/senior.png",
        "description": "Un pingüino elegante con lentes de lectura que domina la definición de funciones y la reutilización de código.",
        "required_points": 90,
        "norman_reflection": "Fase de abstracción. Sabes crear funciones limpias y resolver problemas complejos.",
        "tts_intro": "Nos hemos vuelto un equipo muy eficiente. Tu código ahora es ordenado y modular."
    },
    "sabio": {
        "name": "Pingüino Sabio",
        "stage_level": 5,
        "image_file": "sabio.png",
        "image_path": "/static/img/mascota/sabio.png",
        "description": "Un venerable pingüino con capa de graduado y bastón de hielo que ayuda a otros compañeros en las salas colaborativas.",
        "required_points": 140,
        "norman_reflection": "Fase de maestría. Tienes la base sólida para aprender cualquier otro lenguaje y guiar a otros.",
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
            message = "Tu pingüino salta de alegría y festeja tu solución."
            tts_text = "Bien hecho. Tu solución funcionó correctamente."
        elif consecutive_errors >= 3:
            self.mood = "solidario"
            self.energy = max(30, self.energy - 5)
            message = "Tu pingüino te ofrece un vaso de agua fría y sugiere respirar hondo antes de la siguiente prueba."
            tts_text = "No te preocupes. Respira hondo, analicemos el problema juntos."
        else:
            self.mood = "atento"
            message = "Tu pingüino mira fijamente el editor con curiosidad."
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
