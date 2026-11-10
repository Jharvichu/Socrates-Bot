// Modulo de soporte para el editor de codigo Python

class CodeEditorHelper {
  constructor(textareaId) {
    this.textarea = document.getElementById(textareaId);
    this.bindEvents();
  }

  bindEvents() {
    if (!this.textarea) return;

    // Manejo de la tecla Tab para indentar con 4 espacios
    this.textarea.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const value = this.textarea.value;

        this.textarea.value = value.substring(0, start) + "    " + value.substring(end);
        this.textarea.selectionStart = this.textarea.selectionEnd = start + 4;
      }
    });
  }

  setCode(code) {
    if (this.textarea) {
      this.textarea.value = code;
    }
  }

  getCode() {
    return this.textarea ? this.textarea.value : "";
  }

  clear() {
    if (this.textarea) {
      this.textarea.value = "";
    }
  }
}

window.codeEditorHelper = null;
document.addEventListener("DOMContentLoaded", () => {
  window.codeEditorHelper = new CodeEditorHelper("code-editor");
});
