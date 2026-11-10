# Socrates Bot

Asistente web interactivo con interfaz de voz y mascota virtual para el aprendizaje guiado de programacion en Python.

Proyecto desarrollado para el curso de Interaccion Humano-Computador (CC451).

## Integrantes del Grupo 1
1. Luis Alanya Campos
2. Jharvy Cadillo Tarazona
3. Pedro Vargas Alfaro

## Descripcion general
Socrates Bot es una Aplicacion Web Progresiva (PWA) pensada para estudiantes que inician en la programacion en Python, facilitando ademas el acceso a personas con discapacidad motora o visual.

En lugar de entregar el codigo resuelto, el sistema plantea un metodo socratico guiado por voz: hace preguntas de orientacion para que el alumno descubra la solucion por su cuenta, relacionando el avance con el cuidado y evolucion de una mascota virtual (un pinguino).

## Estado actual del proyecto (Avance al 70% - PC03)
El proyecto se encuentra en la etapa de prototipo funcional al 70%, con codigo modular implementado y probado:

* Interfaz de voz manos libres y lectura en voz alta (TTS) mediante Web Speech API.
* Capa de abstraccion de inteligencia artificial con soporte para la API de Groq (Llama 3.3) y conmutacion automatica a modo local heuristico.
* Mascota virtual evolutiva (Pinguino) en 5 etapas: Huevo, Aprendiz, Junior, Senior y Sabio, con diseno emocional de Norman.
* Laboratorio socratico con editor de codigo Python y sandbox de ejecucion aislada con limite de 2.0 segundos.
* Perfil de usuario persistente con adaptacion continua segun ritmo, errores e inferencia de estado afectivo.
* Salas colaborativas multiusuario mediante WebSockets en tiempo real.
* Plataforma PWA adaptable a pantallas de computadoras y telefonos moviles.

## Estructura del proyecto
* app/socratic_tutor.py: Capa de abstraccion LLM para Groq API y conmutador local.
* app/code_sandbox.py: Entorno seguro de ejecucion de codigo con timeout de 2.0 s.
* app/pet_manager.py: Motor de evolucion y diseno emocional del pinguino.
* app/user_profile.py: Motor de personalizacion continua del estudiante.
* app/rooms_manager.py: Administrador de salas colaborativas con WebSockets.
* static/img/mascota/: Carpeta con las imagenes de las 5 fases del pinguino (huevo.png, aprendiz.png, junior.png, senior.png, sabio.png).
* templates/index.html: Interfaz web accesible con las 6 pantallas del flujo (P1 a P6).
* data/simulated_data.json: Retos de Python y datos simulados para analitica docente.
* docs/Reporte_Avance_PC03_SocratesBot.docx: Reporte formal de avance de la PC03 en formato Word.

## Instrucciones de instalacion y ejecucion

### 1. Clonar el repositorio y entrar a la carpeta
```bash
git clone https://github.com/Jharvichu/Socrates-Bot
cd Socrates-Bot
```

### 2. Instalar dependencias
```bash
pip install -r requirements.txt
```

### 3. Configurar la clave de Groq API (Opcional)
Copia el archivo de ejemplo y agrega tu clave obtenida en console.groq.com/keys:
```bash
cp .env.example .env
```
Edita el archivo .env con tu editor favorito:
```text
GROQ_API_KEY=tu_clave_de_groq_aqui
```
Si no configuras la clave, Socrates Bot funcionara automaticamente con su motor socratico local de respaldo.

### 4. Iniciar el servidor
```bash
python3 main.py
```
O usando uvicorn directamente:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 5. Abrir en el navegador
Ingresa a:
```text
http://localhost:8000
```

## Licencia
Este proyecto cuenta con licencia abierta MIT. Para mas informacion, revisar el archivo LICENSE en la raiz del repositorio.
