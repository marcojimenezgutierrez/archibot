# archibot

**archibot** es un proyecto orientado al diseño, desarrollo y evaluación de un agente virtual inteligente basado en *Retrieval-Augmented Generation* (RAG). Su propósito es analizar cómo la apariencia visual y el embodiment de persona en un agente virtual corporizado pueden influir en la confianza, empatía y preferencia del usuario durante la interacción con información documental.

## Objetivo del proyecto

Desarrollar un prototipo de agente virtual inteligente que permita consultar información documental mediante técnicas RAG y evaluar si la presentación de las respuestas a través de un agente corporizado mejora la experiencia del usuario frente a interfaces textuales tradicionales.

El proyecto se enfoca en estudiar principalmente:

- **RQ1:** Confianza percibida en la respuesta factual del sistema, comparando el Agente Virtual Conversacional (AVC) frente a una interfaz puramente textual.
- **RQ2:** Naturalidad percibida e inteligencia percibida del agente en tareas de síntesis documental extendida.
- **RQ3:** Nivel de retención de información por parte del usuario y usabilidad general percibida (SUS).

## Estructura del repositorio

```text
archibot/
├── demo/        Aplicación web del agente (avatar 3D, voz, chat, condiciones A/B del estudio).
├── server/      Backend Node/Express con el RAG real (consulta al LLM sobre los documentos).
├── functions/   Cloud Functions de Firebase que expone la misma API del RAG para el despliegue en producción.
├── firebase.json  Configuración de Firebase Hosting + Functions para el despliegue.
└── docs/        Documentación del proyecto: diseño, metodología, instrumentos y resultados del estudio.
```

## Carpetas principales

### `demo/`

Aplicación web autocontenida del agente conversacional 3D. Permite ver y probar el agente (avatar 3D, lectura de respuestas por voz, reconocimiento de voz) en sus dos condiciones de estudio:

- **Condición A — AVC:** avatar 3D visible, respuestas leídas en voz alta (TTS) con sincronización labial y expresiones, entrada por voz (STT).
- **Condición B — Textual:** sin avatar, interacción solo por teclado y texto.

Ver [demo/README.md](demo/README.md) para instrucciones de ejecución.

### `server/`

Backend Node/Express que conecta el demo a un LLM real (OpenAI, con soporte opcional de Azure OpenAI) para resolver preguntas sobre los documentos del estudio. Ver [server/README.md](server/README.md) para detalles de configuración y despliegue.

### `functions/`

Cloud Functions de Firebase que reimplementa la API del RAG (`/api/rag`) para el despliegue en producción vía Firebase Hosting.

### `docs/`

Documentación académica y técnica del proyecto: descripción del problema, objetivos, preguntas de investigación, metodología de evaluación, instrumentos de recolección de datos y resultados del estudio.

## Tecnologías empleadas

- **Frontend de renderizado:** Three.js + `@pixiv/three-vrm` (integrado en navegador web).
- **Pipeline RAG:** Node/Express (local) o Firebase Cloud Functions (producción) + OpenAI (GPT-4.1-nano por defecto, con soporte opcional de Azure OpenAI) para recuperación semántica y generación sobre contexto documental.
- **Síntesis de voz (TTS):** Web Speech API (con *lip sync* simulado vía eventos de `SpeechSynthesisUtterance`).
- **Reconocimiento de voz (STT):** Web Speech API.
- **Despliegue:** Firebase Hosting (frontend) + Firebase Cloud Functions (backend RAG).

## Estado del proyecto

Prototipo funcional en operación, desplegado sobre Firebase Hosting y Cloud Functions. En etapa de estudio piloto con usuarios.

## Licencia

Por definir.
