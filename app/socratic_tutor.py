import time
import httpx
from config import GROQ_API_KEY, GROQ_MODEL, GROQ_API_URL

# Interfaz base para proveedores de tutoria socratica
class BaseSocraticProvider:
    def generate_hint(self, exercise_title: str, exercise_prompt: str, user_code: str, execution_output: str, error_count: int, user_emotion: str) -> str:
        raise NotImplementedError

# Proveedor remoto utilizando la API de Groq
class GroqSocraticProvider(BaseSocraticProvider):
    def __init__(self, api_key: str = GROQ_API_KEY, model: str = GROQ_MODEL):
        self.api_key = api_key
        self.model = model

    def is_available(self) -> bool:
        return bool(self.api_key and len(self.api_key) > 10)

    def generate_hint(self, exercise_title: str, exercise_prompt: str, user_code: str, execution_output: str, error_count: int, user_emotion: str) -> str:
        system_instruction = (
            "Eres Sócrates Bot, un tutor afectivo y socrático para estudiantes que inician en Python. "
            "Tu tarea es formular preguntas breves y pistas que guíen al estudiante a descubrir la respuesta por sí mismo. "
            "REGLA OBLIGATORIA: Nunca entregues la solución completa en código ni hagas spoilers directos. "
            "Si el usuario tiene errores de sintaxis, hazle notar el símbolo o la sangría que falta. "
            "Si tiene errores de lógica, pregúntale qué valor toma su variable paso a paso. "
            "Si el usuario tiene más de 2 errores seguidos o expresa frustración, sé más empático y dale una pista más específica pero siempre en forma de pregunta. "
            "Escribe en texto plano, sin emojis, con frases cortas y fáciles de narrar por voz. Usa correctamente las tildes y los signos de interrogación del español."
        )

        user_content = (
            f"Ejercicio actual: {exercise_title}\n"
            f"Descripción del reto: {exercise_prompt}\n"
            f"Código escrito por el estudiante:\n{user_code}\n"
            f"Salida o error al ejecutar:\n{execution_output}\n"
            f"Cantidad de intentos fallidos consecutivos: {error_count}\n"
            f"Estado emocional detectado: {user_emotion}\n"
            "Formula tu siguiente pregunta guía o pista socrática:"
        )

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_content}
            ],
            "temperature": 0.4,
            "max_tokens": 180
        }

        with httpx.Client(timeout=4.0) as client:
            response = client.post(GROQ_API_URL, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()

# Proveedor de respaldo local y simulado
class FallbackSocraticProvider(BaseSocraticProvider):
    def generate_hint(self, exercise_title: str, exercise_prompt: str, user_code: str, execution_output: str, error_count: int, user_emotion: str) -> str:
        code_lower = user_code.lower()
        output_lower = execution_output.lower()

        # Deteccion de error de indentacion
        if "indentationerror" in output_lower or "expected an indented block" in output_lower:
            return "Revisa los espacios al inicio de cada línea dentro de tu bloque. Recuerda que en Python cada bloque necesita cuatro espacios de sangría. ¿Qué línea tiene una alineación diferente?"

        # Deteccion de sintaxis de dos puntos o parentesis
        if "syntaxerror" in output_lower:
            if ":" not in user_code and ("if" in code_lower or "for" in code_lower or "while" in code_lower or "def" in code_lower):
                return "Python necesita un símbolo al final de las cabeceras como if, for o def para saber que empieza un bloque. ¿Recuerdas qué signo de puntuación se usa ahí?"
            return "El intérprete detectó un detalle de sintaxis. Fíjate si abriste algún paréntesis o comilla que no hayas cerrado todavía."

        # Deteccion de variables no definidas
        if "nameerror" in output_lower:
            return "Parece que usaste una variable que todavía no existe o cuyo nombre está escrito distinto. ¿Cuál es la variable mencionada en el mensaje de error y dónde la creaste?"

        # Pista progresiva segun numero de fallos
        if error_count >= 3:
            return "Tranquilo, equivocarse es parte natural del aprendizaje. Vamos a dividir el reto en una sola acción: ¿cuál es el primer dato que necesitas pedir o calcular para este problema?"

        if error_count == 2:
            return "Buen intento. Observa lo que imprime tu código frente a lo que pide el reto. ¿Qué diferencia encuentras en el resultado actual?"

        return "Excelente iniciativa al probar tu código. ¿Qué resultado esperabas obtener en este paso y qué te devolvió la ejecución?"

# Enrutador con conmutacion automatica ante fallos
class SocraticRouter:
    def __init__(self):
        self.remote_provider = GroqSocraticProvider()
        self.fallback_provider = FallbackSocraticProvider()

    def get_guidance(self, exercise_title: str, exercise_prompt: str, user_code: str, execution_output: str, error_count: int = 0, user_emotion: str = "neutral") -> dict:
        start_time = time.time()
        provider_used = "fallback_local"
        hint = ""

        # Intento con proveedor remoto Groq si esta configurado
        if self.remote_provider.is_available():
            try:
                hint = self.remote_provider.generate_hint(
                    exercise_title, exercise_prompt, user_code, execution_output, error_count, user_emotion
                )
                provider_used = "groq_api"
            except Exception:
                # Conmutacion automatica si la llamada remota falla
                hint = self.fallback_provider.generate_hint(
                    exercise_title, exercise_prompt, user_code, execution_output, error_count, user_emotion
                )
                provider_used = "fallback_failover"
        else:
            hint = self.fallback_provider.generate_hint(
                exercise_title, exercise_prompt, user_code, execution_output, error_count, user_emotion
            )
            provider_used = "fallback_local"

        latency = round(time.time() - start_time, 2)
        return {
            "hint": hint,
            "provider": provider_used,
            "latency_seconds": latency,
            "model": GROQ_MODEL if provider_used == "groq_api" else "motor_socratico_local"
        }
