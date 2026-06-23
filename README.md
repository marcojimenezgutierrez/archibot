# Ariel

> Repositorio: `archibot`. El agente y el estudio se denominan **Ariel**; el repositorio
> conserva el nombre histórico `archibot`.

**Ariel** es un proyecto orientado al diseño, desarrollo y evaluación de un agente virtual
corporizado (AVC) basado en *Retrieval-Augmented Generation* (RAG). Su propósito es analizar
cómo la apariencia visual y el *embodiment* de un agente virtual influyen en la confianza, la
naturalidad y la usabilidad percibidas durante la interacción con información documental,
frente a una interfaz puramente textual.

## Objetivo del proyecto

Desarrollar un prototipo de agente virtual inteligente que permita consultar información
documental mediante técnicas RAG y evaluar si presentar las respuestas a través de un agente
corporizado mejora la experiencia del usuario frente a interfaces textuales tradicionales.

El estudio se organiza en torno a tres preguntas de investigación:

- **RQ1:** Confianza percibida en la respuesta factual del sistema, comparando el AVC frente a
  una interfaz puramente textual.
- **RQ2:** Naturalidad e inteligencia percibidas del agente en tareas de síntesis documental.
- **RQ3:** Retención de información y usabilidad general percibida (SUS).

## Enlaces de la entrega

- 🎥 **Video de demostración (~5 min, YouTube no listado):** `[‹Video›](https://youtu.be/O4vrTsIRgmk)`
- 📄 **Artículo (PDF, formato IEEE):** [`docs/Entregable 3/Ariel_Paper_LaTeX/main.pdf`](docs/Entregable%203/Ariel_Paper_LaTeX/main.pdf)
- 📊 **Presentación:** [`docs/Entregable 3/Ariel_Presentacion.pptx`](docs/Entregable%203/Ariel_Presentacion.pptx)
- 📺 **URL de Agente:**  `https://ariel-cva.web.app/?type=CVA` `https://ariel-cva.web.app/?type=TEXT`



## Estructura del repositorio

```text
archibot/
├── demo/         Aplicación web del agente (avatar 3D, voz, chat, condiciones A/B del estudio).
├── server/       Backend Node/Express con el RAG real (consulta al LLM sobre los documentos).
├── functions/    Cloud Functions de Firebase que expone la misma API del RAG en producción.
├── firebase.json Configuración de Firebase Hosting + Functions para el despliegue.
└── docs/         Documentación del proyecto: diseño, metodología, instrumentos y resultados.
```

## Tecnologías empleadas

- **Frontend de renderizado:** Three.js + `@pixiv/three-vrm` (en el navegador, sin motor externo).
- **Pipeline RAG:** **Node/Express** (local) o **Firebase Cloud Functions** (producción) +
  **OpenAI `gpt-4.1-nano`** por defecto (con soporte opcional de Azure OpenAI) para recuperación
  semántica y generación sobre el contexto documental.
- **Síntesis de voz (TTS):** Web Speech API, con *lip sync* simulado vía eventos de
  `SpeechSynthesisUtterance`.
- **Reconocimiento de voz (STT):** Web Speech API.
- **Despliegue:** Firebase Hosting (frontend) + Firebase Cloud Functions (backend RAG).

## Requisitos del sistema

- **Node.js 18+** y **npm**.
- Una **clave de OpenAI** (`OPENAI_API_KEY`) para el RAG real. *No* es necesaria para el demo con
  respuestas simuladas.
- **Navegador Chrome o Edge** recomendado: el reconocimiento de voz (STT) usa la Web Speech API,
  disponible en esos navegadores. El avatar y la lectura por voz (TTS) funcionan en cualquier navegador.
- **Conexión a internet** la primera vez (las dependencias 3D y PDF.js se cargan vía CDN).
- *(Opcional)* **Python 3 + `pdfplumber`** si se desea regenerar el contexto a partir de los PDFs.

## Instalación y ejecución

### Opción 1 — RAG real (recomendada)

Levanta el backend Node/Express, que además sirve el front-end del agente:

```bash
cd server
cp .env.example .env        # coloca tu OPENAI_API_KEY en el archivo .env
npm install
npm start                   # disponible en http://localhost:3000
```

Si cambias los documentos en `demo/pdfs/`, regenera el contexto del RAG:

```bash
npm run extract-context     # requiere Python + pdfplumber (pip install pdfplumber)
```

### Opción 2 — Solo demo (RAG simulado, sin backend ni clave)

Sirve la carpeta `demo/` por HTTP (no funciona abriendo el archivo con `file://`):

```bash
cd demo
npx serve .                 # o:  python -m http.server 8080
```

Luego abre la URL indicada (p. ej. `http://localhost:8080`). En este modo las respuestas del
RAG están **simuladas** localmente.

### Opción 3 — Producción (Firebase)

El despliegue usa Firebase Hosting (frontend) + Cloud Functions (API del RAG). Con la
[CLI de Firebase](https://firebase.google.com/docs/cli) configurada y la variable
`OPENAI_API_KEY` definida en las *Functions*:

```bash
firebase deploy
```

> **Seguridad:** la API key vive **solo en el servidor** (variables de entorno) y nunca llega al
> navegador. No subas claves ni credenciales al repositorio.

## Condiciones del estudio

Un *toggle* "Modo Conversacional" conmuta entre las dos condiciones experimentales sin recargar:

- **Condición A — AVC:** avatar 3D visible, respuestas leídas en voz alta (TTS) con sincronización
  labial y expresiones, entrada por voz (STT).
- **Condición B — Textual:** sin avatar, interacción solo por teclado y texto.

El motor RAG y el LLM son **idénticos** en ambas condiciones, de modo que cualquier diferencia
observada se atribuye al *embodiment* y a la modalidad comunicativa.

## Estado del proyecto

Prototipo funcional desplegado sobre Firebase Hosting y Cloud Functions. Estudio piloto con
expertos completado (N = 8); resultados y análisis en [`docs/`](docs/) y en el artículo final.

## Licencia

Por definir.
