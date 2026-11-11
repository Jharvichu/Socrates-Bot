// Modulo de interfaz de voz accesible para Socrates Bot
// - Normaliza la transcripcion (tildes, puntuacion, numeros) antes de interpretar
// - Interpreta intenciones con sinonimos y patrones flexibles
// - Dictado de Python en lenguaje natural con insercion en el cursor y sangria
// - Reinicio automatico del microfono y pausa mientras el bot habla

const SCREEN_NAMES = {
  "screen-p1": "calibración",
  "screen-p2": "mapa de habilidades",
  "screen-p3": "laboratorio de código",
  "screen-p4": "santuario de la mascota",
  "screen-p5": "sala colaborativa",
  "screen-p6": "panel docente"
};

const SCREEN_KEYWORDS = [
  { screen: "screen-p1", re: /\b(calibracion|calibrar|configuracion|configurar|bienvenida|inicio)\b/, say: "Abriendo la calibración" },
  { screen: "screen-p2", re: /\b(mapa|habilidades|temas|lista de ejercicios)\b/, say: "Navegando al mapa de habilidades" },
  { screen: "screen-p3", re: /\b(laboratorio|lab|editor)\b/, say: "Abriendo el laboratorio de código" },
  { screen: "screen-p4", re: /\b(mascota|santuario|pinguino|pinguinos)\b/, say: "Mostrando el santuario de tu mascota" },
  { screen: "screen-p5", re: /\b(sala|salas|colaborativa|companeros|grupo)\b/, say: "Conectando a la sala colaborativa" },
  { screen: "screen-p6", re: /\b(dashboard|panel|docente|profesor|estadisticas)\b/, say: "Mostrando el panel docente" }
];

const NAV_VERBS = /\b(ir|ve|vamos|vete|abre|abrir|abreme|muestra|mostrar|muestrame|ver|quiero|llevame|lleva|entra|entrar|pasa|pasar|cambia|cambiar|navega|navegar)\b/;

const TTS_SPEEDS = ["0.85", "1.0", "1.25"];

const NUM_UNITS = {
  cero: 0, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23,
  veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
  cien: 100, mil: 1000
};
const NUM_TENS = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 };

const PY_RESERVED = new Set(["True", "False", "None", "and", "or", "not", "in", "is"]);

class VoiceInterface {
  constructor() {
    this.recognition = null;
    this.synthesis = window.speechSynthesis || null;
    this.isListening = false;     // el reconocedor esta activo ahora mismo
    this.wantListening = false;   // el usuario quiere el microfono encendido
    this.isSpeaking = false;      // el bot esta hablando (microfono en pausa)
    this.speechToken = 0;
    this.restartFailures = 0;
    this.dictationMode = false;
    this.pendingDedent = 0;
    this.undoStack = [];
    this.lastSpoken = "";
    this.ttsSpeed = 1.0;
    this.audioCtx = null;
    this.initAudioContext();
    this.initSpeechRecognition();
    this.commands = this.buildCommands();
    this.dictationSafeCommands = this.buildDictationSafeCommands();
  }

  get app() {
    return window.socratesApp;
  }

  // ---------------------------------------------------------------------------
  // Audio: earcons
  // ---------------------------------------------------------------------------

  initAudioContext() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    } catch (e) {
      console.warn("AudioContext no disponible:", e);
    }
  }

  // Reproduce un sonido de confirmacion o advertencia
  playEarcon(type = "success") {
    if (!this.audioCtx) return;
    try {
      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      const now = this.audioCtx.currentTime;
      if (type === "success") {
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === "error") {
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.setValueAtTime(240, now + 0.12);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === "listening") {
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      }
    } catch (err) {
      console.warn("Fallo al reproducir earcon:", err);
    }
  }

  // ---------------------------------------------------------------------------
  // Reconocimiento de voz robusto
  // ---------------------------------------------------------------------------

  pickRecognitionLang() {
    const nav = (navigator.language || "").toLowerCase();
    return nav.startsWith("es") ? navigator.language : "es-PE";
  }

  initSpeechRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      console.warn("Reconocimiento de voz no soportado en este navegador");
      return;
    }

    this.recognition = new SpeechRec();
    this.recognition.lang = this.pickRecognitionLang();
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 3;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.restartFailures = 0;
      this.refreshStatusBadge();
      this.playEarcon("listening");
    };

    // Chrome corta el reconocimiento tras un silencio: lo reanudamos si el usuario no lo apago
    this.recognition.onend = () => {
      this.isListening = false;
      this.refreshStatusBadge();
      if (this.wantListening && !this.isSpeaking) {
        const delay = Math.min(250 * Math.pow(2, this.restartFailures), 4000);
        this.restartFailures += 1;
        setTimeout(() => this.startRecognition(), delay);
      }
    };

    this.recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      console.warn("Error en reconocimiento de voz:", event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        this.wantListening = false;
        this.speak("No tengo permiso para usar el micrófono. Revisa los permisos del navegador.");
      }
    };

    this.recognition.onresult = (event) => {
      if (this.isSpeaking) return; // evita que el bot se escuche a si mismo
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result.isFinal) continue;
        const alternatives = [];
        for (let j = 0; j < result.length; j++) {
          const raw = (result[j].transcript || "").trim();
          if (raw) alternatives.push(raw);
        }
        if (alternatives.length) this.handleVoiceInput(alternatives);
      }
    };
  }

  startRecognition() {
    if (!this.recognition || this.isListening || this.isSpeaking || !this.wantListening) return;
    try {
      this.recognition.start();
    } catch (e) {
      // InvalidStateError: ya estaba iniciado
    }
  }

  stopRecognition() {
    if (!this.recognition) return;
    try {
      this.recognition.abort();
    } catch (e) {
      /* sin efecto */
    }
  }

  // Iniciar o detener captura de voz
  toggleListening() {
    if (!this.recognition) {
      this.speak("El reconocimiento de voz no está disponible en este navegador. Prueba con Chrome o Edge.");
      return;
    }

    if (this.wantListening) {
      this.wantListening = false;
      this.dictationMode = false;
      this.stopRecognition();
      this.speak("Micrófono desactivado");
    } else {
      this.wantListening = true;
      this.speak("Micrófono activado. Di: qué puedo decir, para escuchar los comandos.");
      if (!this.synthesis) this.startRecognition();
    }
    this.refreshStatusBadge();
  }

  // ---------------------------------------------------------------------------
  // Normalizacion de texto
  // ---------------------------------------------------------------------------

  normalize(text) {
    return text
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/(\d)[.,](\d)/g, "$1 punto $2")
      .replace(/\+/g, " mas ")
      .replace(/\*/g, " por ")
      .replace(/\//g, " entre ")
      .replace(/>=/g, " mayor o igual que ")
      .replace(/<=/g, " menor o igual que ")
      .replace(/>/g, " mayor que ")
      .replace(/</g, " menor que ")
      .replace(/=/g, " igual a ")
      .replace(/%/g, " modulo ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  wordsToNumbers(text) {
    const tens = Object.keys(NUM_TENS).join("|");
    const units = Object.keys(NUM_UNITS).join("|");
    return text
      .replace(new RegExp(`\\b(${tens})(?: y (${units}))?\\b`, "g"), (m, t, u) => {
        const unit = u && NUM_UNITS[u] < 10 ? NUM_UNITS[u] : 0;
        return String(NUM_TENS[t] + unit) + (u && NUM_UNITS[u] >= 10 ? ` y ${u}` : "");
      })
      .replace(new RegExp(`\\b(${units})\\b`, "g"), (m) => String(NUM_UNITS[m]))
      .replace(/\b(\d+) punto (\d+)\b/g, "$1.$2");
  }

  // Ultimas n palabras del texto original (conserva tildes y mayusculas para literales)
  rawTail(raw, n) {
    const words = raw.trim().split(/\s+/);
    return words
      .slice(Math.max(0, words.length - n))
      .join(" ")
      .replace(/^["'«]+|[.,;:"'»]+$/g, "");
  }

  wordCount(text) {
    return text ? text.split(" ").length : 0;
  }

  // ---------------------------------------------------------------------------
  // Interpretacion de comandos
  // ---------------------------------------------------------------------------

  handleVoiceInput(alternatives) {
    const list = Array.isArray(alternatives) ? alternatives : [alternatives];
    const candidates = list.map((raw) => ({ raw, t: this.normalize(raw) })).filter((c) => c.t);
    if (!candidates.length) return;

    console.log("Voz recibida:", list);
    this.announceAria("Escuché: " + candidates[0].raw);

    // 1) En modo dictado solo se aceptan unos pocos comandos de control exactos
    if (this.dictationMode) {
      for (const c of candidates) {
        if (this.tryCommands(this.dictationSafeCommands, c)) return;
      }
      this.dictate(candidates);
      return;
    }

    // 2) Dictado con prefijo: "escribe ...", "dicta ...", "agrega ..."
    const prefixRe = /^(escribir|escribe|escribo|escriba|dictar|dicta|agregar|agrega|anadir|anade|insertar|inserta)(?: (.+))?$/;
    const dictationCandidates = [];
    for (const c of candidates) {
      const m = c.t.match(prefixRe);
      if (m) dictationCandidates.push({ raw: c.raw, t: m[2] || "" });
    }
    if (dictationCandidates.length) {
      const withContent = dictationCandidates.filter((c) => c.t);
      if (!withContent.length) {
        this.setDictationMode(true);
      } else {
        this.dictate(withContent);
      }
      return;
    }

    // 3) Comandos generales, probando cada alternativa del reconocedor
    for (const c of candidates) {
      if (this.tryCommands(this.commands, c)) return;
    }

    // 4) No reconocido: feedback util en lugar de solo un pitido
    this.playEarcon("error");
    this.speak(`No entendí: ${candidates[0].raw}. Di: qué puedo decir, para escuchar los comandos.`);
  }

  tryCommands(commands, c) {
    for (const cmd of commands) {
      const m = c.t.match(cmd.re);
      if (!m) continue;
      if (cmd.guard && !cmd.guard(c, m)) continue;
      const handled = cmd.run(c, m);
      if (handled === false) continue;
      return true;
    }
    return false;
  }

  buildDictationSafeCommands() {
    return [
      { re: /^(terminar|termina|fin|fin del|salir del|cerrar|parar|para el|detener) ?dictado$|^(listo|ya esta|termine)$/, run: () => this.setDictationMode(false) },
      { re: /^(silencio|callate|basta|stop)$/, run: () => this.silence() },
      { re: /^(apaga|apagar|desactiva|desactivar) (el )?microfono$/, run: () => this.toggleListening() },
      { re: /^(deshacer|deshaz|undo)$/, run: () => this.undo() },
      { re: /^(borra|borrar|elimina|eliminar) (la )?(ultima )?linea$/, run: () => this.deleteLastLine() },
      { re: /^(ejecutar|ejecuta|correr|corre) (el )?(codigo|programa)$/, run: () => this.runCode() },
      { re: /^(lee|leer|leeme) (mi |el )?codigo$/, run: () => this.readCode() }
    ];
  }

  buildCommands() {
    return [
      // Ayuda
      {
        re: /\b(que puedo decir|que comandos|comandos de voz|lista de comandos|ayuda de voz|ayuda con la voz|como te hablo|que puedes hacer)\b/,
        run: () => this.speakHelp()
      },
      {
        re: /^ayuda$/,
        run: () => (this.app && this.app.currentScreen === "screen-p3" ? this.requestHint() : this.speakHelp())
      },

      // Control de voz
      {
        re: /^(silencio|callate|calla|basta|stop|alto|detente|shh+)$|\b(deja de hablar|para de hablar|no hables)\b/,
        run: () => this.silence()
      },
      {
        re: /\b(apaga|apagar|desactiva|desactivar|cierra|cerrar)\b.*\bmicrofono\b|\bdeja de escuchar\b|^(adios|hasta luego)$/,
        run: () => this.toggleListening()
      },
      {
        re: /\b(modo dictado|empezar dictado|empieza dictado|iniciar dictado|activar dictado|quiero dictar)\b/,
        run: () => this.setDictationMode(true)
      },
      {
        re: /\b(terminar|fin del|salir del|desactivar) dictado\b/,
        run: () => this.setDictationMode(false)
      },

      // Edicion del codigo
      { re: /^(deshacer|deshaz|undo|revertir|revierte)\b/, run: () => this.undo() },
      {
        re: /\b(borra|borrar|limpia|limpiar|elimina|eliminar)\b.*\b(todo|el editor|todo el codigo)\b/,
        run: () => this.clearEditor()
      },
      {
        re: /\b(borra|borrar|elimina|eliminar|quita|quitar)\b.*\blinea\b/,
        run: () => this.deleteLastLine()
      },

      // Seleccion de ejercicios y salas (antes que la navegacion general)
      {
        re: /\b(siguiente|proximo|otro) (ejercicio|reto|problema)\b|\b(ejercicio|reto) siguiente\b/,
        run: () => this.changeExercise(1)
      },
      {
        re: /\b(ejercicio|reto|problema) anterior\b|\banterior (ejercicio|reto)\b/,
        run: () => this.changeExercise(-1)
      },
      {
        re: /\b(ejercicio|reto|problema)(?: numero)? (\w+)\b/,
        run: (c) => {
          const m = this.wordsToNumbers(c.t).match(/\b(?:ejercicio|reto|problema)(?: numero)? (\d+)\b/);
          if (!m) return false;
          return this.openExerciseNumber(parseInt(m[1], 10));
        }
      },
      {
        re: /\bsala(?: numero)? (\w+)\b/,
        run: (c) => {
          const m = this.wordsToNumbers(c.t).match(/\bsala(?: numero)? (\d+)\b/);
          if (!m) return false;
          const n = parseInt(m[1], 10);
          this.app && this.app.navigateTo("screen-p5", { roomId: `sala-${n}` });
          this.confirm(`Entrando a la sala ${n}`);
        }
      },

      // Lectura en voz alta
      {
        re: /\b(lee|leer|leeme|lea|dime|di|repite)\b.*\b(pista|socrates)\b|\bque (dijo|me dijo) socrates\b/,
        run: () => this.readLastHint()
      },
      {
        re: /\b(lee|leer|leeme|lea|dime|repite)\b.*\b(resultado|consola|salida|error)\b|\bque (salio|paso|resulto)\b/,
        run: () => this.readConsole()
      },
      {
        re: /\b(lee|leer|leeme|lea|dime|di|repite)\b.*\b(codigo|programa)\b|\bque (he escrito|escribi|tengo escrito)\b/,
        run: () => this.readCode()
      },
      {
        re: /\b(lee|leer|leeme|lea|dime|repite)\b.*\b(enunciado|ejercicio|reto|problema|consigna|instrucciones)\b|\bde que trata\b|\bque tengo que hacer\b/,
        run: () => this.readExercise()
      },
      {
        re: /^(repite|repitelo|repetir|otra vez|de nuevo|no escuche|no te escuche|como)$/,
        run: () => this.speak(this.lastSpoken || "Aún no he dicho nada")
      },
      {
        re: /\b(donde estoy|en que pantalla|que pantalla)\b/,
        run: () => {
          const name = this.app ? SCREEN_NAMES[this.app.currentScreen] : null;
          this.speak(name ? `Estás en ${name}` : "No sé en qué pantalla estás");
        }
      },

      // Acciones del laboratorio
      {
        re: /\b(ejecut\w*|correr|corre|corra|correlo|run|compil\w*|prueba|probar|pruebalo)\b/,
        run: () => this.runCode()
      },
      {
        re: /\b(pista|ayudame|ayudeme|necesito ayuda|dame ayuda|no entiendo|no se que hacer|estoy atascad[oa]|estoy perdid[oa]|socrates)\b/,
        run: () => this.requestHint()
      },

      // Accesibilidad
      {
        re: /\b(alto contraste|contraste|modo oscuro|modo claro)\b/,
        run: () => this.clickButton("toggle-contrast-btn")
      },
      {
        re: /\b(letra|fuente|texto)\b.*\b(grande|mas grande|tamano|normal|pequena)\b|\b(aumenta|agranda|cambia)\w*\b.*\b(letra|fuente)\b/,
        run: () => {
          this.clickButton("toggle-font-btn");
          const big = document.body.classList.contains("large-font");
          this.confirm(big ? "Letra grande activada" : "Tamaño de letra normal");
        }
      },
      { re: /\bvelocidad normal\b/, run: () => this.setSpeedIndex(1) },
      { re: /\b(mas rapido|acelera|mas veloz|rapido)\b/, run: () => this.changeSpeed(1) },
      { re: /\b(mas lento|mas despacio|despacio|lento|pausado)\b/, run: () => this.changeSpeed(-1) },

      // Navegacion
      {
        re: /^(volver|vuelve|regresa|regresar|atras|ir atras|anterior|pantalla anterior)$|\b(volver|vuelve|regresa\w*|ir) (atras|a la pantalla anterior)\b/,
        run: () => this.goBack()
      },
      {
        re: /.+/,
        run: (c) => this.navigateByKeywords(c)
      }
    ];
  }

  // ---------------------------------------------------------------------------
  // Acciones
  // ---------------------------------------------------------------------------

  confirm(message) {
    this.playEarcon("success");
    if (message) this.speak(message);
  }

  navigateByKeywords(c) {
    const hasVerb = NAV_VERBS.test(c.t);
    if (!hasVerb && this.wordCount(c.t) > 3) return false;
    for (const entry of SCREEN_KEYWORDS) {
      if (entry.re.test(c.t)) {
        if (!this.app) return false;
        this.app.navigateTo(entry.screen);
        this.confirm(entry.say);
        return true;
      }
    }
    return false;
  }

  goBack() {
    if (!this.app || typeof this.app.goBack !== "function" || !this.app.goBack()) {
      this.speak("No hay una pantalla anterior");
      return;
    }
    this.confirm(`Volviste a ${SCREEN_NAMES[this.app.currentScreen] || "la pantalla anterior"}`);
  }

  ensureLab() {
    if (this.app && this.app.currentScreen !== "screen-p3") {
      this.app.navigateTo("screen-p3");
    }
  }

  runCode() {
    if (!this.app) return;
    if (!this.app.currentExercise) {
      this.speak("Primero elige un ejercicio. Por ejemplo, di: ejercicio uno.");
      return;
    }
    this.ensureLab();
    this.speak("Ejecutando tu código");
    this.app.runCode();
  }

  requestHint() {
    if (!this.app) return;
    if (!this.app.currentExercise) {
      this.speak("Primero elige un ejercicio para que Sócrates pueda ayudarte.");
      return;
    }
    this.ensureLab();
    this.speak("Le pregunto a Sócrates");
    this.app.requestSocraticHint();
  }

  openExerciseNumber(n) {
    if (!this.app) return false;
    const ex = this.app.exercisesList.find((e) => Number(e.number) === n);
    if (!ex) {
      this.speak(`No existe el ejercicio ${n}. Hay ${this.app.exercisesList.length} ejercicios.`);
      return true;
    }
    this.app.selectExercise(ex.id);
    this.app.navigateTo("screen-p3");
    this.confirm(`Ejercicio ${ex.number}: ${ex.title}. ${ex.prompt}`);
    return true;
  }

  changeExercise(delta) {
    if (!this.app || !this.app.exercisesList.length) return;
    const list = this.app.exercisesList;
    const idx = this.app.currentExercise ? list.findIndex((e) => e.id === this.app.currentExercise.id) : -1;
    const next = list[idx + delta];
    if (!next) {
      this.speak(delta > 0 ? "Ya estás en el último ejercicio" : "Ya estás en el primer ejercicio");
      return;
    }
    this.openExerciseNumber(Number(next.number));
  }

  readExercise() {
    const ex = this.app && this.app.currentExercise;
    if (!ex) {
      this.speak("No hay un ejercicio seleccionado");
      return;
    }
    this.speak(`Ejercicio ${ex.number}: ${ex.title}. ${ex.prompt}`);
  }

  readConsole() {
    const el = document.getElementById("console-output");
    const text = el ? el.textContent.trim() : "";
    this.speak(text ? `Resultado: ${text}` : "La consola está vacía. Di: ejecutar código.");
  }

  readLastHint() {
    const bubbles = document.querySelectorAll("#socratic-chat .chat-bubble.socrates");
    const last = bubbles.length ? bubbles[bubbles.length - 1].textContent.trim() : "";
    this.speak(last || "Sócrates todavía no te ha dado ninguna pista. Di: dame una pista.");
  }

  readCode() {
    const code = this.getEditorValue();
    const lines = code.split("\n").filter((l) => l.trim());
    if (!lines.length) {
      this.speak("El editor está vacío");
      return;
    }
    const spoken = lines.map((l, i) => `Línea ${i + 1}: ${this.speakableCode(l)}`).join(". ");
    this.speak(spoken);
  }

  speakableCode(line) {
    const indent = line.match(/^\s*/)[0].length;
    const level = Math.floor(indent / 4);
    const body = line
      .trim()
      .replace(/==/g, " igual igual ")
      .replace(/!=/g, " distinto de ")
      .replace(/>=/g, " mayor o igual que ")
      .replace(/<=/g, " menor o igual que ")
      .replace(/\*\*/g, " elevado a ")
      .replace(/\/\//g, " división entera ")
      .replace(/\+=/g, " más igual ")
      .replace(/-=/g, " menos igual ")
      .replace(/>/g, " mayor que ")
      .replace(/</g, " menor que ")
      .replace(/=/g, " igual ")
      .replace(/\(/g, " abre paréntesis ")
      .replace(/\)/g, " cierra paréntesis ")
      .replace(/\[/g, " abre corchete ")
      .replace(/\]/g, " cierra corchete ")
      .replace(/:/g, " dos puntos ")
      .replace(/["']/g, " comillas ")
      .replace(/,/g, " coma ")
      .replace(/\+/g, " más ")
      .replace(/-/g, " menos ")
      .replace(/\*/g, " por ")
      .replace(/\//g, " entre ")
      .replace(/%/g, " módulo ")
      .replace(/#/g, " comentario ")
      .replace(/_/g, " guion bajo ")
      .replace(/\s+/g, " ")
      .trim();
    return level > 0 ? `sangría ${level}, ${body}` : body;
  }

  silence() {
    if (this.synthesis) this.synthesis.cancel();
    this.resumeAfterSpeech(this.speechToken);
  }

  clickButton(id) {
    const btn = document.getElementById(id);
    if (btn) btn.click();
  }

  changeSpeed(delta) {
    const current = TTS_SPEEDS.findIndex((s) => parseFloat(s) === this.ttsSpeed);
    const idx = Math.max(0, Math.min(TTS_SPEEDS.length - 1, (current < 0 ? 1 : current) + delta));
    if (idx === current) {
      this.speak(delta > 0 ? "Ya estoy en la velocidad máxima" : "Ya estoy en la velocidad mínima");
      return;
    }
    this.setSpeedIndex(idx);
  }

  setSpeedIndex(idx) {
    const value = TTS_SPEEDS[idx];
    this.ttsSpeed = parseFloat(value);
    const select = document.getElementById("tts-speed-select");
    if (select) select.value = value;
    this.confirm(`Velocidad de voz ${value} equis`);
  }

  speakHelp() {
    const screen = this.app ? this.app.currentScreen : "";
    const common =
      "Para moverte di: ir al mapa, laboratorio, mascota, sala dos, panel docente, o volver. " +
      "También: más rápido, más lento, alto contraste, letra grande, silencio, o apaga el micrófono.";
    let specific = "";
    if (screen === "screen-p3") {
      specific =
        "En el laboratorio puedes decir: ejecutar código, dame una pista, lee mi código, lee el resultado, " +
        "lee el enunciado, siguiente ejercicio, deshacer, borrar última línea. " +
        "Para dictar di escribe seguido de la instrucción, por ejemplo: escribe variable edad igual a 15, " +
        "escribe si edad mayor que 18, escribe imprimir hola mundo, o di modo dictado.";
    } else if (screen === "screen-p2") {
      specific = "En el mapa puedes decir: ejercicio uno, ejercicio tres, o siguiente ejercicio.";
    }
    this.speak(`${specific} ${common}`.trim());
  }

  // ---------------------------------------------------------------------------
  // Dictado de Python
  // ---------------------------------------------------------------------------

  setDictationMode(active) {
    this.dictationMode = active;
    if (active) this.ensureLab();
    this.refreshStatusBadge();
    this.confirm(
      active
        ? "Modo dictado activado. Todo lo que digas se escribirá como código. Di terminar dictado para salir."
        : "Modo dictado desactivado"
    );
  }

  getEditor() {
    return document.getElementById("code-editor");
  }

  getEditorValue() {
    const editor = this.getEditor();
    return editor ? editor.value : "";
  }

  pushUndo() {
    const editor = this.getEditor();
    if (!editor) return;
    this.undoStack.push(editor.value);
    if (this.undoStack.length > 50) this.undoStack.shift();
  }

  setEditorValue(value, cursor) {
    const editor = this.getEditor();
    if (!editor) return;
    editor.value = value;
    const pos = cursor === undefined ? value.length : cursor;
    editor.selectionStart = editor.selectionEnd = pos;
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }

  undo() {
    if (!this.undoStack.length) {
      this.speak("No hay nada que deshacer");
      return;
    }
    this.setEditorValue(this.undoStack.pop());
    this.confirm("Deshecho");
  }

  clearEditor() {
    this.ensureLab();
    this.pushUndo();
    this.setEditorValue("");
    this.confirm("Editor borrado. Di deshacer si fue un error.");
  }

  deleteLastLine() {
    this.ensureLab();
    const lines = this.getEditorValue().replace(/\s+$/, "").split("\n");
    if (!lines.length || (lines.length === 1 && !lines[0].trim())) {
      this.speak("El editor ya está vacío");
      return;
    }
    this.pushUndo();
    const removed = lines.pop();
    const value = lines.length ? lines.join("\n") + "\n" : "";
    this.setEditorValue(value);
    this.confirm(`Borré: ${this.speakableCode(removed)}`);
  }

  // Elige, entre las alternativas del reconocedor, la que forma una instruccion reconocible.
  // Ej.: prefiere "si edad es mayor a 18" (if) sobre "ciudad es mayor a 18" (expresion suelta).
  pickDictationResult(candidates) {
    const score = (r) => (!r ? -1 : r.command ? 3 : r.fallback ? 0 : 2);
    let best = null;
    for (const c of candidates) {
      const result = this.toPython(c);
      if (!best || score(result) > score(best)) best = result;
      if (score(result) >= 2) break; // la primera alternativa estructurada gana
    }
    return best;
  }

  dictate(candidates) {
    this.ensureLab();
    const editor = this.getEditor();
    if (!editor) return;

    const result = this.pickDictationResult(Array.isArray(candidates) ? candidates : [candidates]);
    if (!result) {
      this.playEarcon("error");
      this.speak("No pude convertir eso en código. Intenta de nuevo.");
      return;
    }

    if (result.command === "newline") {
      this.insertLine("");
      this.confirm("Nueva línea");
      return;
    }
    if (result.command === "dedent") {
      this.pendingDedent += 1;
      this.confirm("La siguiente línea saldrá del bloque");
      return;
    }

    this.insertLine(result.code, result.align);
    this.confirm(`Agregado: ${this.speakableCode(result.code)}`);
  }

  // Inserta una linea de codigo en la posicion del cursor respetando la sangria
  insertLine(code, align) {
    const editor = this.getEditor();
    if (!editor) return;
    this.pushUndo();

    const value = editor.value;
    let pos = typeof editor.selectionStart === "number" ? editor.selectionStart : value.length;
    // Si el cursor esta a mitad de linea, insertamos al final de esa linea
    const lineEnd = value.indexOf("\n", pos);
    if (pos > 0 && value[pos - 1] !== "\n") {
      pos = lineEnd === -1 ? value.length : lineEnd;
    }

    const before = value.slice(0, pos);
    const after = value.slice(pos);
    const indent = this.computeIndent(before, align);

    const prefix = before.length && !before.endsWith("\n") ? "\n" : "";
    const line = (code ? " ".repeat(indent) + code : "") + "\n";
    const newValue = before + prefix + line + after.replace(/^\n/, "");
    this.setEditorValue(newValue, before.length + prefix.length + line.length);
  }

  computeIndent(before, align) {
    const lines = before.split("\n").filter((l) => l.trim());
    const prev = lines.length ? lines[lines.length - 1] : "";
    const prevIndent = prev.match(/^\s*/)[0].length;

    if (align === "else") {
      // else / elif se alinean con el if o elif mas cercano
      for (let i = lines.length - 1; i >= 0; i--) {
        if (/^\s*(if|elif)\b/.test(lines[i])) {
          this.pendingDedent = 0;
          return lines[i].match(/^\s*/)[0].length;
        }
      }
    }

    let indent = prev.trim().endsWith(":") ? prevIndent + 4 : prevIndent;
    indent = Math.max(0, indent - 4 * this.pendingDedent);
    this.pendingDedent = 0;
    return indent;
  }

  toIdentifier(text) {
    const id = this.wordsToNumbers(text)
      .replace(/\b(el|la|los|las|variable|funcion|llamada)\b/g, " ")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
    if (!id) return "";
    return /^\d/.test(id) ? `_${id}` : id;
  }

  variableExists(name) {
    if (!name) return false;
    return new RegExp(`(^|\\n)\\s*(for\\s+)?${name}\\b\\s*(=|in\\b)|def\\s+\\w+\\([^)]*\\b${name}\\b`).test(this.getEditorValue());
  }

  // Convierte una expresion hablada a Python
  toPythonExpr(t, raw, { condition = false } = {}) {
    let text = ` ${this.wordsToNumbers(t)} `;
    let literal = null;

    const strMatch = text.match(/\b(?:texto|cadena|comillas|mensaje) (.+?) $/);
    if (strMatch) {
      const words = strMatch[1].trim();
      literal = JSON.stringify(this.rawTail(raw, this.wordCount(words)));
      text = text.slice(0, strMatch.index) + " __STR__ ";
    }

    const ops = [
      [/\b(numero|entero) (de|desde) (la )?entrada\b|\b(numero|entero) que escriba el usuario\b/g, " __INTINPUT__ "],
      [/\b(la )?entrada\b|\blo que escriba el usuario\b/g, " __INPUT__ "],
      [/\b(es )?igual igual\b/g, " == "],
      [/\b(es )?(distinto|diferente) (de|a)\b/g, " != "],
      [/\b(es )?mayor o igual (que|a)\b/g, " >= "],
      [/\b(es )?menor o igual (que|a)\b/g, " <= "],
      [/\b(es )?mayor (que|a)\b/g, " > "],
      [/\b(es )?menor (que|a)\b/g, " < "],
      [/\b(es )?igual (a|que)\b/g, condition ? " == " : " = "],
      [/\bdivision entera( de| entre)?\b/g, " // "],
      [/\bdividido (entre|por)\b|\bentre\b/g, " / "],
      [/\bmultiplicado por\b|\bpor\b|\bveces\b/g, " * "],
      [/\b(modulo|residuo|resto)( de)?\b/g, " % "],
      [/\belevado (a|al)\b|\bal cuadrado\b/g, (m) => (m.includes("cuadrado") ? " ** 2 " : " ** ")],
      [/\bmas\b/g, " + "],
      [/\bmenos\b/g, " - "],
      [/\babre parentesis\b/g, " ( "],
      [/\bcierra parentesis\b/g, " ) "],
      [/\babre corchete\b/g, " [ "],
      [/\bcierra corchete\b/g, " ] "],
      [/\bcoma\b/g, " , "],
      [/\bverdadero\b/g, " True "],
      [/\bfalso\b/g, " False "],
      [/\b(nada|ninguno)\b/g, " None "],
      [/\by\b/g, " and "],
      [/\bo\b/g, " or "],
      [/\bno\b/g, " not "],
      [/\b(el|la|los|las|valor de|variable|es)\b/g, " "]
    ];
    for (const [re, rep] of ops) {
      text = text.replace(re, rep);
    }

    // Agrupa palabras consecutivas como un solo identificador: "precio total" -> precio_total
    const tokens = text.trim().split(/\s+/).filter(Boolean);
    const out = [];
    let idRun = [];
    const flush = () => {
      if (idRun.length) out.push(idRun.join("_"));
      idRun = [];
    };
    for (const tok of tokens) {
      if (/^[a-z_][a-z0-9_]*$/.test(tok) && !PY_RESERVED.has(tok) && !tok.startsWith("__")) {
        idRun.push(tok);
      } else {
        flush();
        out.push(tok);
      }
    }
    flush();

    return out
      .join(" ")
      .replace(/__STR__/g, literal || '""')
      .replace(/__INTINPUT__/g, "int(input())")
      .replace(/__INPUT__/g, "input()")
      .replace(/\( /g, "(")
      .replace(/ \)/g, ")")
      .replace(/\[ /g, "[")
      .replace(/ \]/g, "]")
      .replace(/ ,/g, ",")
      .trim();
  }

  toPython(c) {
    const t = c.t.trim();
    const raw = c.raw;
    let m;

    if (/^(nueva linea|linea nueva|salto de linea|enter|linea en blanco)$/.test(t)) return { command: "newline" };
    if (/^(salir del bloque|fin del bloque|cerrar bloque|quitar sangria|menos sangria|sin sangria)$/.test(t)) return { command: "dedent" };

    if ((m = t.match(/^comentario (.+)$/))) {
      return { code: `# ${this.rawTail(raw, this.wordCount(m[1]))}` };
    }

    if ((m = t.match(/^(imprimir|imprime|mostrar|muestra|print|mostrar en pantalla)(?: (.*))?$/))) {
      const arg = (m[2] || "").trim();
      if (!arg) return { code: "print()" };
      let am;
      if ((am = arg.match(/^(?:la )?(?:variable|el valor de|valor de|resultado de) (.+)$/))) {
        return { code: `print(${this.toPythonExpr(am[1], raw)})` };
      }
      if ((am = arg.match(/^(?:texto|mensaje|la frase|frase|comillas) (.+)$/))) {
        return { code: `print(${JSON.stringify(this.rawTail(raw, this.wordCount(am[1])))})` };
      }
      // Es expresion si es un numero, una variable existente, o una operacion con numeros/variables existentes
      const numeric = this.wordsToNumbers(arg);
      const hasOp = /\b(mas|menos|por|entre|modulo|elevado)\b/.test(arg);
      const operandIsKnown = numeric
        .split(/\b(?:mas|menos|por|entre|modulo|elevado a|elevado)\b/)
        .some((part) => /\d/.test(part) || this.variableExists(this.toIdentifier(part)));
      const singleVar = this.wordCount(arg) === 1 && this.variableExists(this.toIdentifier(arg));
      if (singleVar || (hasOp && operandIsKnown) || /^\d+(\.\d+)?$/.test(numeric)) {
        return { code: `print(${this.toPythonExpr(arg, raw)})` };
      }
      return { code: `print(${JSON.stringify(this.rawTail(raw, this.wordCount(arg)))})` };
    }

    if ((m = t.match(/^(?:si no si|sino si|o si|y si no) (.+)$/))) {
      return { code: `elif ${this.toPythonExpr(m[1], raw, { condition: true })}:`, align: "else" };
    }
    if (/^(si no|sino|en otro caso|caso contrario|de lo contrario|en caso contrario|else)$/.test(t)) {
      return { code: "else:", align: "else" };
    }
    if ((m = t.match(/^si (.+)$/))) {
      return { code: `if ${this.toPythonExpr(m[1], raw, { condition: true })}:` };
    }
    if ((m = t.match(/^mientras(?: que)? (.+)$/))) {
      return { code: `while ${this.toPythonExpr(m[1], raw, { condition: true })}:` };
    }

    if ((m = t.match(/^para(?: cada)? (\w+) (?:en|desde) (?:el )?(?:rango )?(?:de |desde )?(.+?) hasta (.+)$/))) {
      const v = this.toIdentifier(m[1]);
      return { code: `for ${v} in range(${this.toPythonExpr(m[2], raw)}, ${this.toPythonExpr(m[3], raw)}):` };
    }
    if ((m = t.match(/^para(?: cada)? (\w+) en (?:el )?rango(?: de)? (.+)$/))) {
      const v = this.toIdentifier(m[1]);
      return { code: `for ${v} in range(${this.toPythonExpr(m[2], raw)}):` };
    }
    if ((m = t.match(/^para(?: cada)? (\w+) en (.+)$/))) {
      return { code: `for ${this.toIdentifier(m[1])} in ${this.toPythonExpr(m[2], raw)}:` };
    }

    if ((m = t.match(/^(?:definir|define|crear|crea|nueva) (?:una )?funcion (?:llamada )?(.+?)(?: (?:con|que recibe) (?:los |el )?(?:parametros?|argumentos?)? ?(.+))?$/))) {
      const name = this.toIdentifier(m[1]);
      const params = m[2]
        ? m[2].split(/ y | coma |,/).map((p) => this.toIdentifier(p.trim())).filter(Boolean).join(", ")
        : "";
      return { code: `def ${name}(${params}):` };
    }

    if ((m = t.match(/^(?:retornar|retorna|devolver|devuelve|regresar|regresa|return) (.+)$/))) {
      return { code: `return ${this.toPythonExpr(m[1], raw)}` };
    }
    if (/^(pasar|pass)$/.test(t)) return { code: "pass" };
    if (/^(romper|break|salir del bucle|salir del ciclo)$/.test(t)) return { code: "break" };
    if (/^(continuar|continue|siguiente vuelta)$/.test(t)) return { code: "continue" };

    if ((m = t.match(/^(?:pedir|pide|leer|lee|solicitar|solicita) (?:un )?(numero|entero|texto|dato|nombre|valor)? ?(?:en|para|y guardar en|y guardalo en) (?:la )?(?:variable )?(.+)$/))) {
      const v = this.toIdentifier(m[2]);
      const isNum = m[1] === "numero" || m[1] === "entero";
      return { code: `${v} = ${isNum ? "int(input())" : "input()"}` };
    }

    if ((m = t.match(/^(?:aumentar|aumenta|incrementar|incrementa|sumar a|suma a) (?:la variable )?(.+?) en (.+)$/))) {
      return { code: `${this.toIdentifier(m[1])} += ${this.toPythonExpr(m[2], raw)}` };
    }
    if ((m = t.match(/^(?:disminuir|disminuye|decrementar|decrementa|restar a|resta a) (?:la variable )?(.+?) en (.+)$/))) {
      return { code: `${this.toIdentifier(m[1])} -= ${this.toPythonExpr(m[2], raw)}` };
    }

    if ((m = t.match(/^(?:la )?(?:variable )?(.+?) (?:igual a|es igual a|igual|vale|toma el valor de|toma el valor|guarda) (.+)$/))) {
      const v = this.toIdentifier(m[1]);
      if (v) return { code: `${v} = ${this.toPythonExpr(m[2], raw)}` };
    }

    if ((m = t.match(/^(?:llamar a|llama a|llamar|llama|ejecutar la funcion|usar la funcion) (?:la funcion )?(.+?)(?: con (.+))?$/))) {
      const args = m[2] ? m[2].split(/ y | coma |,/).map((a) => this.toPythonExpr(a.trim(), raw)).join(", ") : "";
      return { code: `${this.toIdentifier(m[1])}(${args})` };
    }

    const expr = this.toPythonExpr(t, raw);
    return expr ? { code: expr, fallback: true } : null;
  }

  // ---------------------------------------------------------------------------
  // Sintesis de voz (pausa el microfono mientras habla)
  // ---------------------------------------------------------------------------

  speak(text) {
    if (!text) return;
    this.lastSpoken = text;
    this.announceAria(text);
    if (!this.synthesis) return;

    this.synthesis.cancel();
    const token = ++this.speechToken;

    if (this.wantListening) {
      this.isSpeaking = true;
      this.stopRecognition();
      this.refreshStatusBadge();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-ES";
    utterance.rate = this.ttsSpeed || 1.0;
    utterance.onend = () => this.resumeAfterSpeech(token);
    utterance.onerror = () => this.resumeAfterSpeech(token);
    this.synthesis.speak(utterance);

    // Respaldo por si el navegador no dispara onend
    const estimateMs = Math.max(2000, (text.length * 90) / (this.ttsSpeed || 1)) + 1500;
    setTimeout(() => this.resumeAfterSpeech(token), estimateMs);
  }

  resumeAfterSpeech(token) {
    if (token !== this.speechToken || !this.isSpeaking) return;
    this.isSpeaking = false;
    this.refreshStatusBadge();
    if (this.wantListening) {
      setTimeout(() => this.startRecognition(), 150);
    }
  }

  // Actualiza la region WAI-ARIA para lectores de pantalla (NVDA, JAWS)
  announceAria(message) {
    const liveRegion = document.getElementById("aria-live-announcer");
    if (liveRegion) {
      liveRegion.textContent = message;
    }
  }

  refreshStatusBadge() {
    if (!this.wantListening) {
      this.updateStatusBadge("Voz en espera", false);
    } else if (this.isSpeaking) {
      this.updateStatusBadge("Hablando...", false);
    } else if (this.dictationMode) {
      this.updateStatusBadge("Modo dictado", true);
    } else {
      this.updateStatusBadge(this.isListening ? "Escuchando..." : "Reconectando micrófono...", this.isListening);
    }
  }

  updateStatusBadge(text, isActive) {
    const badge = document.getElementById("voice-status-badge");
    if (badge) {
      badge.textContent = text;
      if (isActive) {
        badge.classList.add("listening");
      } else {
        badge.classList.remove("listening");
      }
    }
  }
}

window.voiceInterface = new VoiceInterface();
