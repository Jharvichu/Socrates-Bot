import sys
import time
import subprocess
from config import SANDBOX_TIMEOUT_SECONDS

# Lista de palabras o modulos no permitidos para seguridad del entorno
BLOCKED_MODULES = [
    "os.", "sys.", "subprocess", "shutil", "socket", "urllib", "requests",
    "pathlib", "open(", "eval(", "exec(", "__import__", "builtins"
]

# Ejecuta el codigo de prueba en un proceso independiente con limite de tiempo
def execute_python_code(code: str, timeout_seconds: float = SANDBOX_TIMEOUT_SECONDS) -> dict:
    start_time = time.time()

    # Filtro preventivo de seguridad basica para novatos
    for blocked in BLOCKED_MODULES:
        if blocked in code:
            return {
                "success": False,
                "stdout": "",
                "stderr": f"Aviso de seguridad: la operacion '{blocked}' no esta permitida en el laboratorio inicial.",
                "execution_time": 0.01,
                "timed_out": False,
                "security_blocked": True
            }

    # Ejecucion mediante subproceso aislado
    try:
        process = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            timeout=timeout_seconds
        )
        elapsed = round(time.time() - start_time, 3)

        success = (process.returncode == 0)
        return {
            "success": success,
            "stdout": process.stdout,
            "stderr": process.stderr,
            "execution_time": elapsed,
            "timed_out": False,
            "security_blocked": False
        }

    except subprocess.TimeoutExpired:
        elapsed = round(time.time() - start_time, 3)
        return {
            "success": False,
            "stdout": "",
            "stderr": f"Tiempo limite excedido ({timeout_seconds} s). Es probable que tu bucle nunca termine.",
            "execution_time": elapsed,
            "timed_out": True,
            "security_blocked": False
        }
    except Exception as ex:
        elapsed = round(time.time() - start_time, 3)
        return {
            "success": False,
            "stdout": "",
            "stderr": f"Error inesperado al ejecutar: {str(ex)}",
            "execution_time": elapsed,
            "timed_out": False,
            "security_blocked": False
        }
