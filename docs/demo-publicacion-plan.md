# Plan — Publicar demo standalone para revisión del profesor (PF-3311)

**Objetivo:** mostrar al profesor SOLO la contribución académica (agente conversacional 3D
+ RAG con Condiciones A/B) sin exponer código propietario de la compañía (backend, API,
auth/SSO, lógica de negocio).

## Decisión tomada
Armar una carpeta/repo **`demo/` autocontenida y ejecutable** que cargue el avatar + un
RAG **simulado** (respuesta de ejemplo, sin backend). El profesor podrá ver y *probar*
el avatar, voz, lip-sync y las Condiciones A/B en su navegador, sin login ni API.

## Archivos que SÍ se publican (verificados: sin URLs/tokens/secretos)
Origen: `C:\bis\arcasuite\Arca.Xplore\`
- `wwwroot/js/records/avatar.js` — motor 3D (Three.js + VRM); limpio, 100% propio.
- `wwwroot/js/records/arcangelRAG.js` — UI RAG: Modo A/B, micrófono, voz por avatar,
  render de Markdown. Solo rutas relativas `/api/...` y vars `window.*` (sin secretos).
- `wwwroot/js/records/arcaSTTCapture.js` — wrapper STT genérico.
- `wwwroot/js/records/arcaTTSController.js` — wrapper TTS genérico.
- `wwwroot/models/ArcaXplore-M.vrm`, `ArcaXplore-F.vrm` (+ `.vroid` como fuente).
- `documentacion/14-agente-virtual-3d-rag.md` — documentación del agente.
- `docs/dev_spec.md` (ya está en archibot) — spec del estudio.

## Lo que NO se incluye (propiedad de la compañía)
- Backend: `Controllers/`, `Program.cs`, `Models/`, `Data/`, clientes NSwag,
  `appsettings*.json`, `OpenAPIs/`, `Connections/`, `.csproj`/`.sln`.
- `documentViewer.js` / `documentViewer.withAudio.js` (contienen `api.bis.co.cr:7007`,
  `arcadbide.bis.co.cr`).
- `arcaRecordsListView.js`, `documents-api.js`, `arcangelSum.js`, resto de `wwwroot`
  (UI de Arca, Kendo) y resto de `documentacion/`.

## Tareas para mañana
1. Crear estructura `demo/` (repo nuevo o carpeta aparte, NO dentro del repo de la compañía):
   ```
   demo/
     index.html          # carga importmap (three + three-vrm), monta el panel RAG
     js/
       avatar.js
       arcangelRAG.js
       arcaSTTCapture.js
       arcaTTSController.js
       mock-rag.js        # responde preguntas con texto de ejemplo (Markdown) sin backend
     models/ ArcaXplore-M.vrm, ArcaXplore-F.vrm
     css/ (extraer las reglas RAG necesarias; el grueso ya está inline en arcangelRAG.js)
     docs/ 14-agente-virtual-3d-rag.md, dev_spec.md
     README.md           # cómo correrlo (servir con un static server por los ES modules)
   ```
2. **Mock del RAG:** stub de `setupDocHost`, `window.dhLoadBase64`, `window.ARCA_DEV_ID/TOKEN`,
   e interceptar el `fetch('/api/XPLORErag')` para devolver una respuesta de ejemplo en
   Markdown (con negritas, lista y citas) que ejercite el render y el TTS.
3. Verificar que corre con un static server (los ES modules requieren http://, no file://):
   p.ej. `npx serve demo` o `python -m http.server`.
4. (Opcional) Redactar/limpiar en `arcangelRAG.js` los nombres de endpoint si se quiere
   ocultar del todo la superficie del API (reemplazar por el mock).
5. README con: qué es el estudio, cómo lanzar el demo, controles (toggle A/B, micrófono,
   selector de avatar).

## Notas
- El harness standalone que se usó para validar en sesiones previas es la base del mock.
- Los ES modules y el importmap de three/three-vrm ya están documentados en
  `14-agente-virtual-3d-rag.md` y en `_Layout.cshtml` (copiar el importmap al index.html).
- Recordatorio técnico: al agregar/renombrar `.vrm` en el proyecto real hace falta
  recompilar (Static Web Assets); en el demo standalone no aplica (se sirven directo).
