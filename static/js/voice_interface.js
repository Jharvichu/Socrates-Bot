// Modulo de interfaz de voz accesible para Socrates Bot

class VoiceInterface {
  constructor() {
    this.recognition = null;
    this.synthesis = window.speechSynthesis;
    this.isListening = false;
    this.ttsSpeed = 1.0;
    this.audioCtx = null;
    this.initAudioContext();
    this.initSpeechRecognition();
  }

  // Inicializa contexto de audio para earcons sonoros
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

  // Configuracion del reconocedor del navegador
  initSpeechRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      console.warn("Reconocimiento de voz no soportado en este navegador");
      return;
    }

    this.recognition = new SpeechRec();
    this.recognition.lang = "es-ES";
    this.recognition.continuous = true;
    this.recognition.interimResults = false;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.updateStatusBadge("Escuchando...", true);
      this.playEarcon("listening");
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.updateStatusBadge("Voz en espera", false);
    };

    this.recognition.onerror = (event) => {
      console.warn("Error en reconocimiento de voz:", event.error);
      this.isListening = false;
      this.updateStatusBadge("Micrófono pausado", false);
    };

    this.recognition.onresult = (event) => {
      const lastIndex = event.results.length - 1;
      const transcript = event.results[lastIndex][0].transcript.trim().toLowerCase();
      this.handleVoiceInput(transcript);
    };
  }

  // Iniciar o detener captura de voz
  toggleListening() {
    if (!this.recognition) {
      this.speak("El reconocimiento de voz no esta disponible en este navegador");
      return;
    }

    if (this.isListening) {
      this.recognition.stop();
      this.speak("Microfono desactivado");
    } else {
      try {
        this.recognition.start();
        this.speak("Microfono activado. Puedes dar comandos de voz");
      } catch (e) {
        console.warn("No se pudo iniciar reconocimiento:", e);
      }
    }
  }

  // Procesa comandos por voz para navegacion y edicion
  handleVoiceInput(text) {
    console.log("Comando recibido por voz:", text);
    this.announceAria("Comando recibido: " + text);

    // Navegacion entre pantallas
    if (text.includes("ir al mapa") || text.includes("abrir mapa")) {
      window.socratesApp.navigateTo("screen-p2");
      this.speak("Navegando al mapa de habilidades");
      this.playEarcon("success");
      return;
    }
    if (text.includes("ir al laboratorio") || text.includes("abrir editor") || text.includes("laboratorio")) {
      window.socratesApp.navigateTo("screen-p3");
      this.speak("Abriendo el laboratorio de codigo");
      this.playEarcon("success");
      return;
    }
    if (text.includes("ver mascota") || text.includes("santuario")) {
      window.socratesApp.navigateTo("screen-p4");
      this.speak("Mostrando el santuario de tu mascota");
      this.playEarcon("success");
      return;
    }
    if (text.includes("sala colaborativa") || text.includes("abrir sala")) {
      window.socratesApp.navigateTo("screen-p5");
      this.speak("Conectando a la sala colaborativa");
      this.playEarcon("success");
      return;
    }
    if (text.includes("dashboard") || text.includes("panel docente")) {
      window.socratesApp.navigateTo("screen-p6");
      this.speak("Mostrando el panel docente");
      this.playEarcon("success");
      return;
    }

    // Acciones dentro del laboratorio
    if (text.includes("ejecutar codigo") || text.includes("probar codigo") || text.includes("correr programa")) {
      window.socratesApp.runCode();
      this.speak("Ejecutando tu codigo");
      return;
    }
    if (text.includes("dame pista") || text.includes("ayuda socrates") || text.includes("pedir pista")) {
      window.socratesApp.requestSocraticHint();
      return;
    }

    // Dictado asistido de sintaxis Python
    if (text.includes("escribir") || text.includes("dictar")) {
      this.dictatePythonSyntax(text);
      return;
    }

    // Comando no reconocido
    this.playEarcon("error");
  }

  // Traductor basico de lenguaje hablado a sintaxis Python
  dictatePythonSyntax(text) {
    const editor = document.getElementById("code-editor");
    if (!editor) return;

    let clean = text.replace("escribir", "").replace("dictar", "").trim();
    let pythonCode = clean;

    if (clean.includes("imprimir")) {
      const param = clean.replace("imprimir", "").trim();
      pythonCode = `print("${param}")\n`;
    } else if (clean.includes("definir funcion")) {
      const name = clean.replace("definir funcion", "").trim().replace(/\s+/g, "_");
      pythonCode = `def ${name}():\n    pass\n`;
    } else if (clean.includes("condicional si")) {
      pythonCode = "if condicion:\n    pass\n";
    }

    editor.value += pythonCode;
    this.speak("Codigo anadido al editor");
    this.playEarcon("success");
  }

  // Sintesis de voz con velocidad regulable
  speak(text) {
    if (!this.synthesis) return;
    this.synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-ES";
    utterance.rate = this.ttsSpeed || 1.0;

    this.announceAria(text);
    this.synthesis.speak(utterance);
  }

  // Actualiza la region WAI-ARIA para lectores de pantalla (NVDA, JAWS)
  announceAria(message) {
    const liveRegion = document.getElementById("aria-live-announcer");
    if (liveRegion) {
      liveRegion.textContent = message;
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
