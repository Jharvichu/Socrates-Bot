// Controlador principal de la aplicacion Socrates Bot

// Etiquetas legibles para los estados del dashboard docente
const STATUS_LABELS = {
  avanzando: "Avanzando",
  en_riesgo: "En riesgo",
  destacado: "Destacado"
};

class SocratesApp {
  constructor() {
    this.currentScreen = "screen-p1";
    this.currentExercise = null;
    this.exercisesList = [];
    this.consecutiveErrors = 0;
    this.userProfile = null;
    this.socket = null;
    this.screenHistory = [];
    this.init();
  }

  async init() {
    this.bindNavigationEvents();
    this.bindAccessibilityControls();
    await this.loadUserProfile();
    await this.loadExercises();
    this.renderTopicsTree();
    this.initPWA();
  }

  // Registro del Service Worker para funcionamiento PWA
  initPWA() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/static/sw.js").catch((err) => {
        console.warn("Fallo al registrar service worker:", err);
      });
    }
  }

  // Carga el perfil de usuario persistente
  async loadUserProfile() {
    try {
      const res = await fetch("/api/profile");
      if (res.ok) {
        this.userProfile = await res.json();
        this.applyProfileSettings();
        this.updatePetUI(this.userProfile.pet_stage);
      }
    } catch (e) {
      console.warn("Error cargando perfil:", e);
    }
  }

  // Aplica preferencias de accesibilidad guardadas
  applyProfileSettings() {
    if (!this.userProfile) return;
    const acc = this.userProfile.accessibility || {};
    if (acc.high_contrast) {
      document.body.classList.add("high-contrast");
    }
    if (window.voiceInterface) {
      window.voiceInterface.ttsSpeed = acc.tts_speed || 1.0;
    }
  }

  // Carga lista de retos desde el backend
  async loadExercises() {
    try {
      const res = await fetch("/api/exercises");
      if (res.ok) {
        const data = await res.json();
        this.exercisesList = data.exercises || [];
        if (this.exercisesList.length > 0) {
          this.selectExercise(this.exercisesList[0].id);
        }
      }
    } catch (e) {
      console.warn("Error cargando ejercicios:", e);
    }
  }

  // Navegacion entre pantallas P1 a P6
  navigateTo(screenId, options = {}) {
    const target = document.getElementById(screenId);
    if (!target) return;

    // Historial para el comando de voz "volver"
    if (!options.fromHistory && screenId !== this.currentScreen) {
      this.screenHistory.push(this.currentScreen);
      if (this.screenHistory.length > 20) this.screenHistory.shift();
    }

    document.querySelectorAll(".screen-view").forEach((view) => {
      view.classList.remove("active");
    });
    target.classList.add("active");
    this.currentScreen = screenId;

    // Actualiza botones de navegacion activos
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      if (btn.dataset.target === screenId) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    if (screenId === "screen-p5") {
      this.connectCollaborativeRoom(options.roomId || "sala-1");
    }

    if (screenId === "screen-p6") {
      this.loadDashboardData();
    }
  }

  // Regresa a la pantalla anterior; devuelve false si no hay historial
  goBack() {
    const previous = this.screenHistory.pop();
    if (!previous) return false;
    this.navigateTo(previous, { fromHistory: true });
    return true;
  }

  bindNavigationEvents() {
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.navigateTo(btn.dataset.target);
      });
    });

    const micBtn = document.getElementById("toggle-mic-btn");
    if (micBtn) {
      micBtn.addEventListener("click", () => {
        if (window.voiceInterface) {
          window.voiceInterface.toggleListening();
        }
      });
    }
  }

  bindAccessibilityControls() {
    const contrastBtn = document.getElementById("toggle-contrast-btn");
    if (contrastBtn) {
      contrastBtn.addEventListener("click", () => {
        document.body.classList.toggle("high-contrast");
        const active = document.body.classList.contains("high-contrast");
        if (window.voiceInterface) {
          window.voiceInterface.speak(active ? "Modo alto contraste activado" : "Modo normal activado");
        }
      });
    }

    const fontBtn = document.getElementById("toggle-font-btn");
    if (fontBtn) {
      fontBtn.addEventListener("click", () => {
        document.body.classList.toggle("large-font");
      });
    }

    const ttsSpeedSelect = document.getElementById("tts-speed-select");
    if (ttsSpeedSelect) {
      ttsSpeedSelect.addEventListener("change", (e) => {
        const speed = parseFloat(e.target.value);
        if (window.voiceInterface) {
          window.voiceInterface.ttsSpeed = speed;
          window.voiceInterface.speak(`Velocidad de voz ajustada a ${speed} equis`);
        }
      });
    }

    const saveCalibBtn = document.getElementById("save-calibration-btn");
    if (saveCalibBtn) {
      saveCalibBtn.addEventListener("click", async () => {
        const pType = document.getElementById("calib-profile-type").value;
        const speed = parseFloat(document.getElementById("tts-speed-select").value);
        const highCont = document.body.classList.contains("high-contrast");

        try {
          await fetch("/api/accessibility", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              profile_type: pType,
              settings: {
                tts_speed: speed,
                high_contrast: highCont,
                hands_free_voice: true
              }
            })
          });
          if (window.voiceInterface) {
            window.voiceInterface.speak("Calibración guardada correctamente. Vamos al mapa.");
          }
          this.navigateTo("screen-p2");
        } catch (e) {
          console.warn("Fallo guardando calibracion:", e);
        }
      });
    }
  }

  // Renderiza el arbol de habilidades (P2)
  renderTopicsTree() {
    const container = document.getElementById("topics-tree-container");
    if (!container) return;
    container.innerHTML = "";

    this.exercisesList.forEach((ex) => {
      const card = document.createElement("div");
      card.className = "topic-node";
      if (this.currentExercise && this.currentExercise.id === ex.id) {
        card.classList.add("active");
      }
      card.innerHTML = `
        <div style="font-weight:700; margin-bottom:0.25rem;">Ejercicio ${ex.number}: ${ex.title}</div>
        <div style="font-size:0.85rem; color:var(--text-muted);">Tema: ${ex.topic} | Puntos: ${ex.points}</div>
        <p style="font-size:0.9rem; margin-top:0.5rem;">${ex.prompt}</p>
        <button class="btn btn-secondary" style="margin-top:0.75rem; width:100%;" onclick="window.socratesApp.selectExercise('${ex.id}'); window.socratesApp.navigateTo('screen-p3');">
          Resolver en Laboratorio
        </button>
      `;
      container.appendChild(card);
    });
  }

  // Selecciona un ejercicio para el laboratorio (P3)
  selectExercise(exerciseId) {
    const ex = this.exercisesList.find((e) => e.id === exerciseId);
    if (!ex) return;
    this.currentExercise = ex;

    const titleEl = document.getElementById("current-exercise-title");
    const promptEl = document.getElementById("current-exercise-prompt");
    if (titleEl) titleEl.textContent = `Ejercicio ${ex.number}: ${ex.title}`;
    if (promptEl) promptEl.textContent = ex.prompt;

    if (window.codeEditorHelper) {
      window.codeEditorHelper.setCode(ex.initial_code || "");
    }
    this.consecutiveErrors = 0;
  }

  // Ejecuta codigo en el Sandbox del backend
  async runCode() {
    if (!this.currentExercise) return;
    const code = window.codeEditorHelper ? window.codeEditorHelper.getCode() : "";
    const consoleEl = document.getElementById("console-output");
    consoleEl.textContent = "Ejecutando en sandbox seguro...";

    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exercise_id: this.currentExercise.id,
          code: code
        })
      });

      const data = await res.json();
      let outputText = "";

      if (data.success) {
        outputText = `Ejecución exitosa (${data.execution_time}s):\n${data.stdout || "(Sin salida de texto)"}`;
        consoleEl.textContent = outputText;
        this.consecutiveErrors = 0;
        if (window.voiceInterface) {
          window.voiceInterface.playEarcon("success");
          window.voiceInterface.speak("Código ejecutado con éxito.");
        }
      } else {
        outputText = `Error al ejecutar (${data.execution_time}s):\n${data.stderr || data.stdout}`;
        consoleEl.textContent = outputText;
        this.consecutiveErrors += 1;
        if (window.voiceInterface) {
          window.voiceInterface.playEarcon("error");
          window.voiceInterface.speak("Se detectó un error. Puedes decir: dame una pista.");
        }
      }

      // Actualizacion de mascota y perfil
      if (data.pet_state) {
        this.updatePetUI(data.pet_state.stage_key, data.pet_state);
      }

      // Autointervencion socratica tras 3 fallos consecutivos
      if (this.consecutiveErrors >= 3) {
        this.requestSocraticHint();
      }

    } catch (e) {
      consoleEl.textContent = "Error de conexión con el sandbox: " + e.message;
    }
  }

  // Solicita pista al Tutor Socratico (Groq o fallback)
  async requestSocraticHint() {
    if (!this.currentExercise) return;
    const code = window.codeEditorHelper ? window.codeEditorHelper.getCode() : "";
    const consoleEl = document.getElementById("console-output");
    const lastOutput = consoleEl.textContent;

    const chatBox = document.getElementById("socratic-chat");
    const thinkingBubble = document.createElement("div");
    thinkingBubble.className = "chat-bubble socrates";
    thinkingBubble.textContent = "Sócrates está analizando tu código...";
    chatBox.appendChild(thinkingBubble);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
      const res = await fetch("/api/socratic-hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exercise_id: this.currentExercise.id,
          exercise_title: this.currentExercise.title,
          exercise_prompt: this.currentExercise.prompt,
          user_code: code,
          execution_output: lastOutput,
          consecutive_errors: this.consecutiveErrors,
          user_emotion: this.consecutiveErrors >= 3 ? "frustrado" : "curioso"
        })
      });

      const data = await res.json();
      thinkingBubble.textContent = data.hint;

      // Lectura por voz de la pista
      if (window.voiceInterface) {
        window.voiceInterface.speak(data.hint);
      }
    } catch (e) {
      thinkingBubble.textContent = "Revisa los últimos cambios de tu código paso a paso. ¿Recuerdas qué operación necesitabas realizar primero?";
    }
  }

  // Actualiza la tarjeta visual del pinguino en el Workspace y Santuario
  updatePetUI(stageKey, petData = null) {
    const petImg = document.getElementById("workspace-pet-img");
    const petStageText = document.getElementById("workspace-pet-stage");
    const petMoodText = document.getElementById("workspace-pet-mood");
    const petDescText = document.getElementById("workspace-pet-desc");

    const stageNames = {
      "huevo": "Huevo de Pingüino",
      "aprendiz": "Pingüino Aprendiz",
      "junior": "Pingüino Junior",
      "senior": "Pingüino Senior",
      "sabio": "Pingüino Sabio"
    };

    const imgPath = `/static/img/mascota/${stageKey}.png`;
    if (petImg) {
      petImg.src = imgPath;
      petImg.alt = `Mascota virtual en fase ${stageNames[stageKey] || stageKey}`;
    }
    if (petStageText) {
      petStageText.textContent = stageNames[stageKey] || stageKey;
    }
    if (petData) {
      if (petMoodText) petMoodText.textContent = `Estado de ánimo: ${this.capitalize(petData.mood)}`;
      if (petDescText) petDescText.textContent = petData.norman_reflection || petData.description;
    }

    // Actualizar galeria en Santuario (P4)
    document.querySelectorAll(".stage-card").forEach((card) => {
      if (card.dataset.stage === stageKey) {
        card.classList.add("current");
      } else {
        card.classList.remove("current");
      }
    });
  }

  // Conexion WebSocket para salas multiusuario (P5)
  connectCollaborativeRoom(roomId) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const petStage = (this.userProfile && this.userProfile.pet_stage) || "huevo";
    const wsUrl = `${protocol}//${window.location.host}/ws/room/${roomId}?pet_stage=${encodeURIComponent(petStage)}`;
    const roomNumber = roomId.replace("sala-", "");

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log("Conectado a la sala colaborativa WebSocket");
      };

      this.socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const sharedEditor = document.getElementById("shared-code-editor");
        if (data.type === "welcome") {
          // Al entrar se recibe el codigo actual de la sala y la lista de participantes
          this.roomMemberId = data.member.id;
          if (sharedEditor) sharedEditor.value = data.code || "";
          this.renderRoomMembers(data.members || []);
          if (window.voiceInterface) {
            window.voiceInterface.speak(`Entraste a la sala ${roomNumber} como ${data.member.name}`);
          }
        } else if (data.type === "code_update") {
          if (sharedEditor && sharedEditor.value !== data.code) {
            sharedEditor.value = data.code;
          }
        } else if (data.type === "member_joined") {
          this.renderRoomMembers(data.members || []);
          if (window.voiceInterface) {
            window.voiceInterface.speak(`${data.member.name} se unió a la sala`);
          }
        } else if (data.type === "member_left") {
          this.renderRoomMembers(data.members || []);
          if (window.voiceInterface) {
            window.voiceInterface.speak(`${data.member.name} salió de la sala`);
          }
        }
      };

      const sharedEditor = document.getElementById("shared-code-editor");
      if (sharedEditor) {
        sharedEditor.oninput = () => {
          if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
              type: "code_change",
              code: sharedEditor.value
            }));
          }
        };
      }
    } catch (e) {
      console.warn("WebSocket no disponible, operando en modo local:", e);
    }
  }

  renderRoomMembers(members) {
    const listEl = document.getElementById("room-members-list");
    if (!listEl) return;
    listEl.innerHTML = "";
    members.forEach((m) => {
      const li = document.createElement("li");
      li.className = "participant-item";
      const isMe = m.id && m.id === this.roomMemberId;

      const who = document.createElement("span");
      const name = document.createElement("strong");
      name.textContent = isMe ? `${m.name} (tú)` : m.name;
      who.append(name, ` (${m.role})`);

      const pet = document.createElement("span");
      pet.style.cssText = "font-size:0.85rem; background:#e2e8f0; padding:0.2rem 0.5rem; border-radius:3px;";
      pet.textContent = `Pingüino ${this.capitalize(m.pet_stage)}`;

      li.append(who, pet);
      listEl.appendChild(li);
    });
  }

  capitalize(text) {
    return text ? String(text).charAt(0).toUpperCase() + String(text).slice(1) : "";
  }

  // Carga datos simulados del Dashboard Docente (P6)
  async loadDashboardData() {
    try {
      const res = await fetch("/api/dashboard-analytics");
      if (res.ok) {
        const data = await res.json();
        const tableBody = document.getElementById("dashboard-students-body");
        if (tableBody) {
          tableBody.innerHTML = "";
          data.students.forEach((s) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
              <td>${s.name}</td>
              <td>${s.completed_count}</td>
              <td>${s.points}</td>
              <td>Pingüino ${this.capitalize(s.pet_stage)}</td>
              <td>${this.capitalize(s.recent_emotion)}</td>
              <td><strong>${STATUS_LABELS[s.status] || s.status}</strong></td>
            `;
            tableBody.appendChild(tr);
          });
        }
      }
    } catch (e) {
      console.warn("Fallo cargando dashboard docente:", e);
    }
  }
}

window.socratesApp = null;
document.addEventListener("DOMContentLoaded", () => {
  window.socratesApp = new SocratesApp();
});
