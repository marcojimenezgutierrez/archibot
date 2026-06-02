# archibot

**archibot** es un proyecto orientado al diseño, desarrollo y evaluación de un agente virtual inteligente basado en *Retrieval-Augmented Generation* (RAG). Su propósito es analizar cómo la apariencia visual y el embodiment de persona en un agente virtual corporizado pueden influir en la confianza, empatía y preferencia del usuario durante la interacción con información documental.

## Objetivo del proyecto

Desarrollar un prototipo de agente virtual inteligente que permita consultar información documental mediante técnicas RAG y evaluar si la presentación de las respuestas a través de un agente corporizado mejora la experiencia del usuario frente a interfaces textuales tradicionales.

El proyecto se enfoca en estudiar principalmente:

- **RQ1:** Confianza percibida en la respuesta factual del sistema, comparando el Agente Virtual Corporizado (AVC) frente a una interfaz puramente textual.
- **RQ2:** Naturalidad percibida e inteligencia percibida del agente en tareas de síntesis documental extendida.
- **RQ3:** Nivel de retención de información por parte del usuario y usabilidad general percibida (SUS).

## Estructura del repositorio

```text
archibot/
├── demo/
│   └── Demostración de la funcionalidad del sistema (ejecutable tipo Mago de Oz).
│
├── src/
│   └── Código fuente del prototipo frontend web y backend RAG, es privado.
│
└── docs/
    └── Documentación del proyecto, diseño, metodología, instrumentos y resultados.
```

## Carpetas principales

### `demo/`

Se puede correr esta carpeta para demostrar la funcionalidad interactiva del agente en un formato de simulación tipo "Mago de Oz".

### `src/`

El código del RAG es privado no se publicará acá, solamente la interación del VRM

### `docs/`

Contendrá la documentación académica y técnica del proyecto, incluyendo la descripción del problema, objetivos, preguntas de investigación, arquitectura técnica, metodología de evaluación, instrumentos de recolección de datos y resultados del estudio.

## Tecnologías empleadas

- **Frontend de renderizado:** Three.js + `@pixiv/three-vrm` (integrado en navegador web, eliminando dependencias de Unity).
- **Pipeline RAG backend:** ASP.NET + Vector Store (Postgres + PGVector) + OpenAI GPT-4o para recuperación semántica y generación.
- **Síntesis de voz (TTS):** Web Speech API (con *lip sync* simulado vía eventos de `SpeechSynthesisUtterance`).
- **Reconocimiento de voz (STT):** Captura nativa web (ArcaSTTCapture).
- **Integración:** Sistema empaquetado como módulo de la plataforma Arca.Xplore.

## Estado del proyecto

Prototipo funcional actualmente en operación. En preparación para estudio piloto con usuarios expertos.

## Licencia

Por definir.
