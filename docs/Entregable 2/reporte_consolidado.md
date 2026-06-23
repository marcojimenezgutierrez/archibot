# Reporte Consolidado — Archibot / PF-3311
**Estudiante:** Marco Antonio Jiménez Gutiérrez — A42781  
**Fecha:** Mayo 2026  
**Estado:** En revisión antes de actualizar artículo y spec técnico

---

## 1. Contexto del Proyecto

**Plataforma base:** Sistema de gestión de expedientes documentales.

**Sistema existente :** Panel RAG conversacional que ya opera en producción con:
- Visor de PDF (pdf.js)
- Agente virtual 3D (Three.js + @pixiv/three-vrm, modelos VRM)
- Chat conversacional con LLM remoto
- STT via `ArcaSTTCapture` (es-CR)
- TTS via Web Speech API (manual: botón por mensaje + Alt+V)
- Expresiones emocionales del avatar por análisis de palabras clave
- Backend ASP.NET → `XPLOREragController` → NSwag → Arca API (RAG externo)

**Objetivo del estudio:** Incorporar un Agente Virtual Corporizado (AVC) dentro de Arca.Xplore y evaluar si mejora la experiencia de consulta documental frente a una interfaz textual equivalente.

---

## 2. Preguntas de Investigación

| # | Pregunta | Instrumento |
|---|---|---|
| RQ1 | ¿Qué efecto tiene el AVC sobre la **confianza percibida** en las respuestas RAG vs. interfaz textual? | Trust in Automation (TiA) — Jian et al. |
| RQ2 | ¿Qué efecto tiene el AVC sobre la **naturalidad percibida** y comprensión de respuestas vs. interfaz textual? | Godspeed Questionnaire (Perceived Intelligence + Anthropomorphism) |
| RQ3 | ¿Qué efecto tiene el AVC sobre la **usabilidad** y **retención de información** vs. interfaz textual? | SUS + Cuestionario ad-hoc de retención (3 ítems) |

---

## 3. Diseño del Estudio

### Condiciones

| | Condición A — AVC | Condición B — Texto |
|---|---|---|
| **Descripción** | Agente virtual corporizado con voz automática | Interfaz de chat textual pura |
| **PDF Viewer** | ✅ Presente | ✅ Presente |
| **Avatar 3D** | ✅ Activo, animaciones, expresiones | ❌ Ausente |
| **TTS** | ✅ Automático al recibir respuesta | ❌ Desactivado |
| **STT** | ✅ Input por voz (ArcaSTTCapture) | ❌ Desactivado |
| **Chat** | ✅ Colapsable (oculto por defecto) | ✅ Visible siempre |
| **Lip Sync** | ✅ Simulado (eventos SpeechSynthesisUtterance) | N/A |

### Layouts

**Condición B — Texto (default del sistema):**
```
| PDF (80%) | Chat (20%) |
```

**Condición A — AVC, chat oculto (default del modo conversacional):**
```
| PDF (65%) | Avatar (35%) |
```

**Condición A — AVC, chat desplegado:**
```
| PDF (55%) | Avatar (25%) | Chat (20%) |
```

### Activación de condiciones
Un botón **"Modo Conversacional"** en la interfaz actúa como toggle:
- **Desactivado** → Condición B (layout PDF + Chat, sin avatar)
- **Activado** → Condición A (layout PDF + Avatar, chat colapsable, TTS automático)

Para el piloto, el evaluador configura el modo antes de entregar el sistema al participante. El participante no cambia de modo durante la sesión.

### Tipo de estudio
- Diseño entre-sujetos (*between-subjects*): cada participante experimenta solo una condición.
- Participantes: expertos en HCI o sistemas documentales (piloto, no usuarios reales — restricción CEC/UCR).

---

## 4. Expediente de Prueba

Tres reglamentos oficiales del Consejo Universitario de la UCR:

| Archivo | Documento |
|---|---|
| `horas_estudiante_asistente_posgrado.pdf` | Reglamento de Horas Estudiante, Horas Asistente y Horas Asistente de Posgrado |
| `regimen_academico_estudiantil.pdf` | Reglamento de Régimen Académico Estudiantil |
| `trabajo_comunal.pdf` | Reglamento del Trabajo Comunal Universitario |

---

## 5. Tareas del Escenario

| Tarea | Consulta | RQ |
|---|---|---|
| T1 | *"Soy estudiante de posgrado activo. ¿Puedo ser designado en horas asistente de posgrado si tengo una nota IN en un curso de investigación? ¿Cuál es el promedio mínimo?"* | RQ1 |
| T2 | *"Soy estudiante de bachillerato y quiero hacer horas asistente al mismo tiempo que realizo mi TCU. ¿Puedo hacerlo? ¿Hay límite de horas combinadas? ¿Cuántas horas de TCU debo cumplir?"* | RQ2 |
| T3 | *"¿Cuánto gana por hora una persona en horas asistente de posgrado vs. horas estudiante? ¿Cuál es la nota mínima para aprobar un curso? ¿Cuántos estudiantes mínimo debe tener un proyecto de TCU?"* | RQ3 |

---

## 6. Cuestionario de Retención (T3)

| Ítem | Pregunta | Respuesta correcta | Fuente |
|---|---|---|---|
| 1 | ¿Cuánto vale la hora asistente de posgrado vs. hora estudiante? | El triple | Art. 20, Reglamento de Horas |
| 2 | ¿Cuál es la nota mínima para aprobar un curso en la UCR? | 7,0 | Art. 25, Reglamento Académico |
| 3 | ¿Cuántos estudiantes mínimo debe tener un proyecto de TCU? | 8 estudiantes | Art. 12, Reglamento TCU |

---

## 7. Arquitectura Técnica Definitiva

### Stack
| Componente | Tecnología |
|---|---|
| Frontend avatar | Three.js + @pixiv/three-vrm (VRM) |
| Lip sync | Simulado via eventos `SpeechSynthesisUtterance` (`onstart`, `onboundary`, `onend`) |
| TTS | Web Speech API — automático en Condición A |
| STT | `ArcaSTTCapture` (es-CR) — activo en Condición A |
| PDF Viewer | pdf.js |
| Backend | ASP.NET → `XPLOREragController` → Arca API (RAG externo) |
| Modelos VRM | Locales (`wwwroot/models/*.vrm`) — sin dependencias externas |
| TTS externo | ❌ Descartado (OpenAI y servicios externos no disponibles en esta fase) |

### Decisión sobre TTS
Se usa Web Speech API nativa del navegador. El lip sync real (via `AnalyserNode`) no es posible con esta API porque no expone stream de audio. Se implementa **lip sync simulado**: la boca del avatar se anima proceduralmente mientras dura el speech, usando los eventos de `SpeechSynthesisUtterance`. Esta limitación se reportará al profesor y se documentará en el artículo como decisión de diseño del prototipo.

### Toggle de modo
El botón "Modo Conversacional" controla:
1. Visibilidad de la columna del avatar
2. Redistribución del grid (50/50 ↔ 65/35 ↔ 45/25/30)
3. Activación/desactivación de TTS automático
4. Activación/desactivación de STT
5. Estado colapsado/expandido del chat

---

## 8. Archivos del Proyecto

| Archivo | Descripción |
|---|---|
| `docs/articulo_wip.md` | Artículo académico WIP (IEEE, Markdown) — pendiente actualizar con arquitectura definitiva |
| `docs/instrumentos_piloto.md` | Guión de tareas + cuestionario de retención completo |
| `docs/reporte_consolidado.md` | Este documento |
| `wwwroot/js/records/arielrag.js` | UI y lógica del panel RAG |
| `wwwroot/js/records/avatar.js` | Controlador 3D (Three.js + three-vrm) |
| `Controllers/XPLOREragController.cs` | Pass-through a la Arca API |

---

## 9. Pendientes

| Pendiente | Prioridad |
|---|---|
| Actualizar sección System Design del artículo con arquitectura definitiva | Alta |
| Actualizar sección Study Design del artículo con layouts y toggle definitivos | Alta |
| Crear spec técnico de desarrollo (cambios al sistema para el estudio) | Alta |
| Implementar toggle "Modo Conversacional" + gestión de layouts | Desarrollo |
| Implementar lip sync simulado via `SpeechSynthesisUtterance` | Desarrollo |
| Implementar TTS automático en Condición A | Desarrollo |
| Confirmar nombre del archivo del artículo (renombrar `articulo_wip.md`) | Menor |
| Confirmar referencias [19] y [20] pendientes en el artículo | Menor |
