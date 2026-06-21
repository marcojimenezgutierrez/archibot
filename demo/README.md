# Demo — Agente Virtual Conversacional 3D (PF-3311)

Demo **autocontenido y ejecutable** del agente conversacional 3D desarrollado para el
proyecto **PF-3311 — Agentes Virtuales Inteligentes**. Permite ver y probar el agente
(avatar 3D, voz, lectura de respuestas y las dos condiciones del estudio) **sin backend**:
las respuestas del RAG están **simuladas** localmente.

> Este demo contiene únicamente la contribución académica (front-end del agente). No incluye
> el backend, la API, la autenticación ni la lógica de negocio de la plataforma sobre la que
> se integró. El RAG real se reemplaza por una respuesta de ejemplo.

## El estudio (resumen)

El agente se evalúa en un estudio comparativo entre dos condiciones:

- **Condición A — AVC (Agente Virtual Conversacional):** avatar 3D visible, respuestas
  leídas en voz alta (TTS) con sincronización labial y expresiones, entrada por voz (STT).
- **Condición B — Textual:** sin avatar, interacción solo por teclado y texto.

Un *toggle* "Modo Conversacional" conmuta entre ambas (persiste en `localStorage`).

## Cómo ejecutarlo

Hay que **servirlo por HTTP** (los ES Modules, `fetch` y el reconocimiento de voz no
funcionan abriendo el archivo con `file://`). Desde esta carpeta:

```bash
# Opción 1 (Node)
npx serve .

# Opción 2 (Python)
python -m http.server 8080
```

Luego abrir el navegador en la URL que indique (p. ej. `http://localhost:8080`).

> **Recomendado: Chrome o Edge.** El reconocimiento de voz (STT) usa la Web Speech API,
> disponible en Chrome/Edge. El avatar y la lectura por voz (TTS) funcionan en cualquier navegador.

## Qué probar

1. Al cargar, el demo inicia en **Condición A**: documento de ejemplo a la izquierda,
   avatar 3D al centro y el chat.
2. **Conversar:** abre el chat ("💬 Conversar por texto"), escribe una pregunta y envía.
   La respuesta de ejemplo se muestra con formato (negritas/listas) y se **lee en voz alta**;
   el avatar mueve los labios y cambia de expresión.
3. **Micrófono:** pulsa el botón de micrófono para hablar (indicador "Escuchando…" parpadeante).
4. **Cambiar avatar:** selector arriba a la derecha del avatar (Masculino / Femenino) — cada
   uno usa una voz acorde.
5. **Cambiar de condición:** botón **"Modo: Conversacional / Textual"** (arriba a la derecha).
   En modo Textual desaparece el avatar y el micrófono (solo teclado).

## Estructura

```
index.html              Página principal (importmap + carga de scripts)
css/
  demo.css              Estilos del panel (versión limpia, sin dependencias de la plataforma)
  arcaTTSController.css  Estilos del control de voz (TTS)
js/
  records/
    avatar.js           Motor 3D del avatar (Three.js + @pixiv/three-vrm)
    arielrag.js      UI del RAG conversacional (condiciones A/B, voz, render de Markdown)
    arcaSTTCapture.js   Reconocimiento de voz (STT)
    arcaTTSController.js Síntesis de voz (TTS)
  bootstrap.js          Arranque del demo + RAG simulado (sin backend)
models/                 Avatares VRM (Masculino / Femenino)
pdfs/                   Documento de ejemplo (no confidencial)
docs/                   Documentación técnica del agente
```

## Notas técnicas

- Avatares en formato **VRM 1.0** (VRoid Studio); el motor también soporta VRM 0.x.
- Las dependencias 3D (Three.js / three-vrm) y jQuery / PDF.js se cargan vía CDN, por lo que
  el demo requiere **conexión a internet** la primera vez.
- El reconocimiento de voz requiere **contexto seguro** (`http://localhost` o HTTPS).
