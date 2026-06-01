# Integración del Agente Virtual 3D en el RAG de Arca.Xplore

Este documento detalla la arquitectura, el diseño y las configuraciones del **Agente Virtual 3D animado** integrado en el panel del RAG conversacional de `Arca.Xplore`.

---

## 📐 Diseño Visual (Layout de 3 Columnas)
El panel del RAG se organiza en un grid premium de tres columnas en pantalla completa:
1. **Visor de PDF (45%):** Muestra el documento activo del expediente con soporte para navegación directa a páginas referenciadas.
2. **Agente Virtual (25%):** Canvas WebGL que renderiza el avatar en 3D (`default_avatar.vrm`) utilizando **Three.js** y **@pixiv/three-vrm**.
3. **Chat Conversacional (30%):** Panel de conversación con el LLM, que incluye entrada de texto, control de micrófono (STT) y comandos de síntesis de voz (TTS).

---

## 🤖 Poses y Rotaciones del Avatar

### 1. Orientación y Ángulo (Cámara en 3/4)
Por defecto, los modelos VRM se orientan hacia el eje Z positivo. El motor rota automáticamente el modelo en el eje Y por `Math.PI` más un pequeño desfase de `0.25` radianes ($\approx 15$ grados).
Esto posiciona el cuerpo en una pose diagonal de tres cuartos (sumamente estética para diseño de modas y renders 3D), mientras que los huesos del cuello y la cabeza contrarrestan la rotación girando en sentido opuesto (`neck` a `-0.15` y `head` a `-0.1`) para mantener la mirada fija en el usuario.

### 2. Poses de Descanso (Brazos Abajo)
Para evitar la pose en T rígida por defecto, el controlador aplica una pose relajada y natural (`_setRestPose`):
* **Brazos:** Rotación en el eje Z de `1.4` (derecho) y `-1.4` (izquierdo) radianes para dejarlos caer naturalmente al costado del cuerpo.
* **Antebrazos:** Rotación de `-0.08` (derecho) y `0.08` (izquierdo) para una flexión de codo sutil.
* **Manos y Muñecas:** Rotaciones leves en X y Z para relajar los dedos y la muñeca.

---

## 🎭 Animaciones y Comportamiento Dinámico

* **Respiración:** El hueso de la columna (`spine`) oscila sutilmente en el eje X con una onda sinusoidal de baja frecuencia (`Math.sin(elapsed * 1.6) * 0.008`) simulando la inhalación y exhalación de aire.
* **Pestañeo:** Se activa en intervalos aleatorios entre 2 y 6 segundos, aplicando un parpadeo rápido (0.1 segundos) usando el preset `Blink` del motor de expresiones del VRM.
* **Sincronización Labial (Lip Sync):** 
  * Monitorea la reproducción de audio nativo mediante `window.speechSynthesis.speaking` (síntesis de voz del navegador).
  * De forma dinámica, modula los presets de vocales `Aa` (amplitud hasta `0.7`) y `Oh` (amplitud hasta `0.2`) utilizando ondas senoidales rápidas durante la locución de voz para dar un efecto labial sumamente orgánico.
* **Análisis de Expresiones / Emociones:**
  El controlador analiza semánticamente las respuestas del RAG y cambia la cara del avatar automáticamente:
  * **Feliz (`happy`):** Cuando la respuesta tiene palabras como *"correcto"*, *"gracias"*, *"completado"*, *"perfecto"*, *"exitoso"*.
  * **Triste (`sad`):** Al detectar *"error"*, *"fallo"*, *"lo siento"*, *"disculpa"*, *"no se pudo"*.
  * **Sorprendido (`surprised`):** En textos de *"alerta"*, *"peligro"*, *"atención"*, *"importante"*.
  * **Neutral (`neutral`):** Para respuestas informativas o explicativas generales.

---

## 🎨 Selección de Diseños del Avatar (Soporte Multi-Modelo)

El visor cuenta con un menú desplegable de selección de modelos (`#avatarSelector`) en su encabezado. Esto permite cambiar el diseño en caliente cargando otros archivos `.vrm`:
* **Cómo añadir nuevos modelos:**
  1. Descarga o crea tu personaje en formato `.vrm` (compatible con la especificación VRM 1.0).
  2. Coloca el archivo en la carpeta física `wwwroot/models/` de tu proyecto (ej. `wwwroot/models/mi_avatar.vrm`).
  3. En `arcangelRAG.js`, añade una nueva opción en la etiqueta `<select id="avatarSelector">`:
     ```html
     <option value="/models/mi_avatar.vrm">Mi Nuevo Avatar</option>
     ```
  4. ¡Listo! El motor se encargará de realizar el desecho deep del modelo anterior, cargar el nuevo canvas WebGL, posicionarlo en el encuadre óptimo y aplicar las animaciones de respiración, parpadeo y poses de forma transparente.

---

## 📂 Archivos Involucrados

1. **`wwwroot/js/records/avatar.js`**: Controlador WebGL del avatar. Gestiona la escena de Three.js, cámaras, iluminación de tres puntos, carga del VRM, animación de huesos e hilos de renderizado.
2. **`wwwroot/js/records/arcangelRAG.js`**: Lógica UI de RAG. Genera el layout de 3 columnas, conecta el analizador de voz, gatilla el TTS e interpreta semánticamente las emociones para enviarlas al controlador de avatar.
3. **`Views/Shared/_Layout.cshtml`**: Inyección del `importmap` del navegador utilizando `@Html.Raw` para posibilitar la carga limpia de módulos de ES6 de manera ultra rápida.
4. **`wwwroot/models/default_avatar.vrm`**: Archivo de malla y rigging 3D del avatar por defecto (Alicia).
