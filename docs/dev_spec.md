# Spec Técnico de Desarrollo — Archibot
**Proyecto:** PF-3311 — Agentes Virtuales Inteligentes  
**Fecha:** Mayo 2026  
**Estado:** Pendiente implementación

---

## Contexto

El sistema existente ("Arcángel") opera en producción dentro de Arca.Xplore con avatar 3D, chat RAG, visor PDF, TTS manual (botón por mensaje + Alt+V) y STT. Los cambios descritos en este spec adaptan ese sistema para el estudio experimental comparativo entre **Condición A (AVC)** y **Condición B (Textual)**.

Archivos principales a modificar:
- `wwwroot/js/records/arcangelRAG.js` — UI, lógica del panel RAG, toggle
- `wwwroot/js/records/avatar.js` — AvatarController (Three.js + three-vrm)

---

## Cambio 1 — Toggle "Modo Conversacional"

### Descripción
Botón en la UI que conmuta entre Condición B (textual, default) y Condición A (AVC). El estado se persiste en `localStorage` para que el evaluador pueda configurarlo antes de la sesión.

### Comportamiento

| Acción del toggle | Resultado |
|---|---|
| Desactivado (default) | Condición B activa |
| Activado | Condición A activa |

### Implementación en `arcangelRAG.js`

```javascript
// Estado inicial
const MODE_KEY = 'archibot_conversacional';
let modoConversacional = localStorage.getItem(MODE_KEY) === 'true';

function aplicarModo(activo) {
  modoConversacional = activo;
  localStorage.setItem(MODE_KEY, activo);

  // 1. Layout
  aplicarLayout(activo);

  // 2. Avatar
  document.getElementById('col-avatar').style.display = activo ? '' : 'none';

  // 3. TTS automático
  ttsAutomatico = activo;

  // 4. STT
  if (activo) {
    arcaSTT.enable();
  } else {
    arcaSTT.disable();
  }

  // 5. Chat colapsado/expandido
  if (activo) {
    colapsarChat();
  } else {
    expandirChat();
  }
}

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', () => {
  aplicarModo(modoConversacional);
  document.getElementById('btn-toggle-modo').addEventListener('click', () => {
    aplicarModo(!modoConversacional);
  });
});
```

---

## Cambio 2 — Gestión de Layouts

### Descripción
El layout del panel RAG usa un flex container de tres columnas (`col-pdf`, `col-avatar`, `col-chat`). Los anchos se ajustan con CSS variables o asignación directa de `flex-basis`.

### Especificación de layouts

| Condición | Estado chat | col-pdf | col-avatar | col-chat |
|---|---|---|---|---|
| B — Textual | Siempre visible | 80% | 0% (oculto) | 20% |
| A — AVC | Chat oculto (default) | 65% | 35% | 0% (oculto) |
| A — AVC | Chat desplegado | 55% | 25% | 20% |

### Implementación en `arcangelRAG.js`

```javascript
function aplicarLayout(modoAVC, chatVisible = false) {
  const colPDF    = document.getElementById('col-pdf');
  const colAvatar = document.getElementById('col-avatar');
  const colChat   = document.getElementById('col-chat');

  if (!modoAVC) {
    // Condición B
    colPDF.style.flex    = '0 0 80%';
    colAvatar.style.flex = '0 0 0%';
    colChat.style.flex   = '0 0 20%';
  } else if (!chatVisible) {
    // Condición A — chat oculto
    colPDF.style.flex    = '0 0 65%';
    colAvatar.style.flex = '0 0 35%';
    colChat.style.flex   = '0 0 0%';
  } else {
    // Condición A — chat desplegado
    colPDF.style.flex    = '0 0 55%';
    colAvatar.style.flex = '0 0 25%';
    colChat.style.flex   = '0 0 20%';
  }
}
```

### Chat colapsable en Condición A
El botón de despliegue del chat (icono de chat flotante o chevron) llama a:

```javascript
function toggleChat() {
  chatVisible = !chatVisible;
  document.getElementById('col-chat').style.display = chatVisible ? '' : 'none';
  aplicarLayout(modoConversacional, chatVisible);
}
```

---

## Cambio 3 — TTS Automático en Condición A

### Descripción
En la implementación actual, el TTS se activa manualmente (botón por mensaje + Alt+V). Para Condición A, la síntesis de voz debe dispararse automáticamente al recibir la respuesta del backend.

### Implementación en `arcangelRAG.js`

```javascript
let ttsAutomatico = false; // se activa con el toggle

async function manejarRespuesta(texto, emocion) {
  // 1. Mostrar texto en el chat
  agregarMensajeChat('assistant', texto);

  // 2. Actualizar expresión del avatar
  if (avatarController) {
    avatarController.setExpression(emocion ?? 'neutral');
  }

  // 3. TTS automático (solo Condición A)
  if (ttsAutomatico && avatarController) {
    avatarController.speak(texto);
  }
}
```

---

## Cambio 4 — Lip Sync Simulado via `SpeechSynthesisUtterance`

### Descripción
La Web Speech API no expone stream de audio, por lo que el lip sync real (via `AnalyserNode`) no es posible. Se implementa animación labial procedural usando los eventos del utterance.

### Implementación en `avatar.js`

```javascript
speak(texto) {
  const utterance = new SpeechSynthesisUtterance(texto);
  utterance.lang = 'es-CR';

  utterance.onstart = () => {
    this._lipSyncActivo = true;
    this._animarLabios(); // loop de animación
  };

  utterance.onend = () => {
    this._lipSyncActivo = false;
    this._setBlendShape('Aa', 0);
    this._setBlendShape('Oh', 0);
    this.setAnimation('idle');
  };

  this.setAnimation('talking');
  speechSynthesis.speak(utterance);
}

_animarLabios() {
  if (!this._lipSyncActivo) return;
  const t = performance.now() / 1000;
  // Oscilación procedural simple
  const aa = Math.max(0, Math.sin(t * 8) * 0.5 + 0.3);
  const oh = Math.max(0, Math.cos(t * 5) * 0.3 + 0.1);
  this._setBlendShape('Aa', aa);
  this._setBlendShape('Oh', oh);
  requestAnimationFrame(() => this._animarLabios());
}
```

---

## Cambio 5 — Desactivar STT en Condición B

### Descripción
`ArcaSTTCapture` (STT en español de Costa Rica) solo debe estar activo en Condición A. En Condición B el input es exclusivamente por teclado.

### Implementación en `arcangelRAG.js`

```javascript
// En aplicarModo():
if (activo) {
  arcaSTT.enable();
  document.getElementById('btn-stt').style.display = '';
} else {
  arcaSTT.disable();
  speechSynthesis.cancel(); // cancelar TTS si estaba hablando
  document.getElementById('btn-stt').style.display = 'none';
}
```

---

## Resumen de cambios

| # | Cambio | Archivo | Prioridad |
|---|---|---|---|
| 1 | Toggle "Modo Conversacional" con persistencia en `localStorage` | `arcangelRAG.js` | Alta |
| 2 | Gestión de layouts (80/20, 65/35, 55/25/20) con flex | `arcangelRAG.js` | Alta |
| 3 | TTS automático al recibir respuesta (solo Condición A) | `arcangelRAG.js` | Alta |
| 4 | Lip sync simulado via eventos `SpeechSynthesisUtterance` | `avatar.js` | Alta |
| 5 | Activación/desactivación de STT según condición | `arcangelRAG.js` | Alta |

---

## Notas de implementación

- Los cambios 1–5 son interdependientes y deben implementarse en conjunto.
- El botón toggle debe ser visible pero no prominente; el participante no lo usa durante la sesión.
- Verificar que `speechSynthesis.cancel()` se llame al cambiar de condición para evitar TTS residual.
- El lip sync simulado usa `requestAnimationFrame`: asegurarse de que el loop se detenga correctamente con `_lipSyncActivo = false`.
- Para el piloto, el evaluador activa/desactiva el modo conversacional desde el mismo navegador antes de pasar el equipo al participante.
