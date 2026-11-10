import json
from pathlib import Path
from config import DATA_DIR
from app.pet_manager import VirtualPet

# Manejo persistente del perfil del estudiante y adaptacion continua
PROFILES_FILE = DATA_DIR / "user_profiles.json"

class UserProfileManager:
    def __init__(self):
        self._ensure_storage()

    def _ensure_storage(self):
        if not PROFILES_FILE.parent.exists():
            PROFILES_FILE.parent.mkdir(parents=True, exist_ok=True)
        if not PROFILES_FILE.exists():
            default_data = {
                "default_user": {
                    "user_id": "default_user",
                    "display_name": "Estudiante Explorador",
                    "profile_type": "estandar",
                    "accessibility": {
                        "screen_reader_optimized": False,
                        "hands_free_voice": True,
                        "high_contrast": False,
                        "tts_speed": 1.0,
                        "font_scale": 1.0
                    },
                    "progress": {
                        "points": 0,
                        "exercises_solved": [],
                        "consecutive_errors": 0,
                        "total_attempts": 0,
                        "errors_by_topic": {
                            "variables": 0,
                            "condicionales": 0,
                            "bucles": 0,
                            "funciones": 0
                        }
                    },
                    "affective_state": {
                        "inferred_emotion": "curioso",
                        "frustration_level": 0,
                        "motivation_level": 80
                    },
                    "pet_stage": "huevo"
                }
            }
            with open(PROFILES_FILE, "w", encoding="utf-8") as f:
                json.dump(default_data, f, indent=2)

    def load_profile(self, user_id: str = "default_user") -> dict:
        try:
            with open(PROFILES_FILE, "r", encoding="utf-8") as f:
                profiles = json.load(f)
            if user_id in profiles:
                return profiles[user_id]
        except Exception:
            pass
        return self._get_fallback_profile(user_id)

    def save_profile(self, profile: dict):
        user_id = profile.get("user_id", "default_user")
        try:
            profiles = {}
            if PROFILES_FILE.exists():
                with open(PROFILES_FILE, "r", encoding="utf-8") as f:
                    profiles = json.load(f)
            profiles[user_id] = profile
            with open(PROFILES_FILE, "w", encoding="utf-8") as f:
                json.dump(profiles, f, indent=2)
        except Exception:
            pass

    def record_activity(self, user_id: str, exercise_id: str, topic: str, success: bool, points_awarded: int = 15) -> dict:
        profile = self.load_profile(user_id)
        prog = profile["progress"]
        aff = profile["affective_state"]
        prog["total_attempts"] += 1

        if success:
            if exercise_id not in prog["exercises_solved"]:
                prog["exercises_solved"].append(exercise_id)
                prog["points"] += points_awarded
            prog["consecutive_errors"] = 0
            aff["frustration_level"] = max(0, aff["frustration_level"] - 20)
            aff["motivation_level"] = min(100, aff["motivation_level"] + 15)
            aff["inferred_emotion"] = "entusiasmado"
        else:
            prog["consecutive_errors"] += 1
            if topic in prog["errors_by_topic"]:
                prog["errors_by_topic"][topic] += 1
            aff["frustration_level"] = min(100, aff["frustration_level"] + 25)
            aff["motivation_level"] = max(20, aff["motivation_level"] - 10)
            if prog["consecutive_errors"] >= 3:
                aff["inferred_emotion"] = "frustrado"
            else:
                aff["inferred_emotion"] = "reflexivo"

        # Sincronizacion con la mascota
        pet = VirtualPet(current_stage=profile.get("pet_stage", "huevo"))
        pet_update = pet.update_after_exercise(success, prog["consecutive_errors"], prog["points"])
        profile["pet_stage"] = pet_update["stage_key"]

        self.save_profile(profile)
        return {
            "profile": profile,
            "pet_state": pet_update
        }

    def update_accessibility(self, user_id: str, profile_type: str, settings: dict) -> dict:
        profile = self.load_profile(user_id)
        profile["profile_type"] = profile_type
        for k, v in settings.items():
            if k in profile["accessibility"]:
                profile["accessibility"][k] = v
        self.save_profile(profile)
        return profile

    def _get_fallback_profile(self, user_id: str) -> dict:
        return {
            "user_id": user_id,
            "display_name": "Estudiante",
            "profile_type": "estandar",
            "accessibility": {
                "screen_reader_optimized": False,
                "hands_free_voice": True,
                "high_contrast": False,
                "tts_speed": 1.0,
                "font_scale": 1.0
            },
            "progress": {
                "points": 0,
                "exercises_solved": [],
                "consecutive_errors": 0,
                "total_attempts": 0,
                "errors_by_topic": {"variables": 0, "condicionales": 0, "bucles": 0, "funciones": 0}
            },
            "affective_state": {
                "inferred_emotion": "curioso",
                "frustration_level": 0,
                "motivation_level": 80
            },
            "pet_stage": "huevo"
        }
