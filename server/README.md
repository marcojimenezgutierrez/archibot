# Backend del demo Archibot — RAG con LLM

Proxy mínimo (Node/Express) que convierte el demo en un **RAG real**: sirve la carpeta
[`../demo`](../demo) y expone `POST /api/rag`, que arma el contexto con el texto de
los tres reglamentos del expediente y consulta el **LLM**.

Por defecto usa **OpenAI** (`gpt-4.1-nano`); opcionalmente, Azure OpenAI.
La API key vive **solo en el servidor** (variables de entorno); nunca llega al navegador.

## Cómo lo usa el front-end

El front-end ([demo/js/bootstrap.js](../demo/js/bootstrap.js)) detecta el modo automáticamente:

| Despliegue | `/api/health` | Modo | LLM |
|---|---|---|---|
| App Service / `npm start` local | responde | **live** | LLM real |
| GitHub Pages (estático, sin backend) | 404 | **mock** | respuestas guionizadas |

Se puede forzar con `?rag=live` o `?rag=mock` en la URL.

> **Por qué GitHub Pages usa el mock:** es hosting estático, no hay dónde ocultar la API key.
> Para LLM real se necesita un backend (App Service o local), que es lo que provee este server.

## Correr en local

```bash
cd server
cp .env.example .env        # y pon tu OPENAI_API_KEY
npm install
npm start                   # http://localhost:3000
```

Si cambias los PDFs en `demo/pdfs/`, regenera el contexto:

```bash
npm run extract-context     # requiere Python + pdfplumber (pip install pdfplumber)
```

## Variables de entorno

**OpenAI (por defecto):**

| Variable | Ejemplo | Notas |
|---|---|---|
| `OPENAI_API_KEY` | `sk-...` | **secreto**, nunca en el repo ni en el navegador |
| `OPENAI_MODEL` | `gpt-4.1-nano` | por defecto `gpt-4.1-nano` |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | opcional (proxies/compatibles) |
| `PORT` | `3000` | el host lo define en producción |
| `ALLOWED_ORIGIN` | `https://usuario.github.io` | opcional; CORS si el front-end está en otro origen |

**Azure OpenAI (alternativa, `LLM_PROVIDER=azure`):** `AZURE_OPENAI_ENDPOINT`,
`AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION`, `AZURE_OPENAI_API_KEY`.

## Desplegar en un App Service

1. App Service con runtime **Node 18+**.
2. En **Configuration → Application settings**, agrega `OPENAI_API_KEY` (y `OPENAI_MODEL` si quieres).
3. Despliega `server/` + `demo/`. El server sirve la web y la API en el mismo origen (sin CORS).
4. Startup command: `node server/server.js` (o `npm start` dentro de `server/`).

## Contrato de la API

`POST /api/rag` → body `{ "question": "..." }`
Respuesta (igual que el mock, para no tocar el front-end):

```json
{ "response": { "answer": "<markdown>", "referenceLinks": [ { "documentId": "horas", "page": 2, "displayText": "…" } ] } }
```
