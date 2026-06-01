# Archibot: Evaluación del Efecto de un Agente Virtual Corporizado sobre la Confianza Percibida y la Naturalidad de Interacción en Sistemas de Consulta Documental basados en RAG

**Marco Antonio Jiménez Gutiérrez**  
Escuela de Ciencias de la Computación e Informática  
Universidad de Costa Rica  
San José, Costa Rica  
marjimgu@gmail.com

---

## Abstract

Los sistemas de consulta documental basados en Retrieval-Augmented Generation (RAG) presentan sus respuestas predominantemente en formato textual, lo que limita la naturalidad y la percepción de confianza en la interacción. Este trabajo presenta Archibot, un agente virtual corporizado (AVC) implementado en tecnología web (Three.js + @pixiv/three-vrm) que actúa como interfaz de un sistema RAG para la consulta de expedientes documentales dentro de la plataforma Arca.Xplore. El agente comunica las respuestas generadas mediante voz sintetizada (Web Speech API) y un avatar 3D con animaciones de escucha, habla y espera, señales visuales de latencia, y expresiones emocionales controladas por el modelo de lenguaje. Se presenta el diseño del sistema, la arquitectura técnica y el protocolo de un estudio piloto con expertos que busca comparar el AVC frente a una interfaz textual equivalente, evaluando confianza percibida (TiA), naturalidad de interacción (Godspeed) y usabilidad (SUS). Los resultados preliminares del piloto se reportarán en la versión final del artículo.

**Palabras clave:** agentes virtuales corporizados, RAG, confianza percibida, embodiment, HCI, VRM, consulta documental.

---

## I. Introduction

La gestión de bases de datos documentales, en particular aquellas organizadas mediante técnicas archivísticas, implica la consulta de expedientes que agrupan múltiples documentos relacionados entre sí. La técnica de Retrieval-Augmented Generation (RAG) permite conectar estas colecciones documentales con modelos de lenguaje de gran tamaño (LLM), posibilitando respuestas contextualizadas y fundamentadas en el contenido real del expediente [1]. Sin embargo, la mayoría de las implementaciones RAG existentes presentan sus respuestas en formato textual puro, de manera análoga a un sistema transaccional o a una interfaz de chat tradicional.

Este modo de presentación, si bien funcional, puede resultar limitado cuando el objetivo es lograr una experiencia de consulta percibida como natural, cercana y confiable. Los estudios en interacción humano-computador (HCI) sugieren que la presencia de un agente virtual corporizado (AVC) puede influir positivamente en la confianza percibida, la naturalidad de la interacción y la comprensión de las respuestas [7][8][11]. No obstante, la evidencia específica sobre AVC aplicados a sistemas RAG documentales es escasa.

Este trabajo investiga si la presentación de respuestas RAG a través de un agente virtual corporizado —con voz sintetizada, animaciones y expresiones emocionales— produce diferencias significativas en la confianza percibida y la naturalidad de interacción en comparación con una interfaz textual equivalente. Para ello se presenta Archibot, un AVC integrado en la plataforma Arca.Xplore, y se describe el protocolo de evaluación diseñado para responder las siguientes preguntas de investigación:

- **RQ1:** ¿Qué efecto tiene el uso de un agente virtual corporizado como interfaz de un sistema RAG sobre la confianza percibida en las respuestas generadas, en comparación con una interfaz textual de consulta documental?
- **RQ2:** ¿Qué efecto tiene el uso de un agente virtual corporizado sobre la naturalidad percibida de la interacción y la comprensión de las respuestas en tareas de consulta sobre expedientes documentales, en comparación con una interfaz textual tipo chat?
- **RQ3:** ¿Qué efecto tiene el uso de un agente virtual corporizado sobre la usabilidad percibida y la retención de información en comparación con una interfaz textual?

El resto del artículo se organiza de la siguiente manera: la Sección II presenta los trabajos relacionados; la Sección III describe el diseño e implementación de Archibot; la Sección IV detalla el diseño del estudio de evaluación; la Sección V reporta los resultados; la Sección VI discute los hallazgos; y la Sección VII presenta las conclusiones.

---

## II. Related Work

### A. Retrieval-Augmented Generation (RAG)

Los sistemas RAG permiten superar una limitación central de los LLM: su dependencia de conocimiento interno, estático y potencialmente desactualizado. Al integrar recuperación de información desde fuentes externas, RAG mejora la pertinencia, actualidad y fundamentación de las respuestas [1][15][16][17]. Un hallazgo relevante es que el agente no debe limitarse a generar respuestas, sino que debe estar conectado a una memoria documental verificable que permita reducir alucinaciones y mejorar la trazabilidad [1][15][16]. Adicionalmente, los enfoques de conversación fundamentada en conocimiento muestran que el sistema debe considerar el contexto local de la conversación para mantener coherencia en diálogos prolongados [17].

PersonaRAG evidencia que los sistemas RAG mejoran cuando incorporan agentes centrados en el usuario, capaces de adaptar la recuperación y generación de respuestas según necesidades y preferencias en tiempo real [2]. Este principio es directamente aplicable a Archibot, donde la efectividad del sistema depende también del ajuste del estilo comunicativo según el perfil y el propósito de la consulta [2][3][5].

### B. Agentes Virtuales Corporizados (AVC) e Interacción

Los estudios en realidad aumentada y realidad virtual muestran que la presencia visual de un agente puede influir en la percepción de inteligencia, confianza, cercanía, utilidad y presencia social [7][8][11][19]. Sin embargo, la representación corporal debe diseñarse con cuidado: un agente demasiado antropomórfico, poco natural o mal sincronizado puede generar incomodidad o pérdida de confianza —efecto del Valle Inquietante— [7][8][19]. Por ello, Archibot adopta un diseño visual sobrio y funcional, coherente con la tarea de consulta documental.

El trabajo de Cassell sobre agentes conversacionales encarnados establece que la combinación de lenguaje natural con señales no verbales —gestos, mirada, expresiones faciales— es fundamental para lograr interacciones percibidas como naturales [4]. En línea con esto, la investigación de Bickmore sobre confianza relacional con agentes muestra que los sistemas conversacionales diseñados para actuar como interfaces explicativas y orientadoras favorecen la confianza percibida [5].

### C. Latencia, Multimodalidad y Lip Sync

La naturalidad conversacional depende de mecanismos de gestión del turno, retroalimentación visual y latencia. Las pausas, expresiones faciales y señales de espera pueden mitigar la percepción negativa de la latencia en agentes potenciados por LLMs [9][13]. Permitir interrupciones verbales mejora la eficiencia percibida y la sensación de conversación dinámica [6]. En sistemas con síntesis de voz del navegador, la sincronización labial (lip sync) mediante análisis de audio en tiempo real —como el implementado en Archibot vía Web Audio API— ha demostrado mejorar la percepción de naturalidad y presencia del agente [8][13].

### D. Evaluación de AVC

La combinación LLM + RAG + agente multimodal ha superado a variantes puramente textuales y guionizadas en métricas de éxito de tarea y naturalidad percibida, especialmente en dominios de alto impacto como salud, educación y servicios institucionales [12]. Los instrumentos más utilizados para evaluar AVC incluyen el Godspeed Questionnaire (naturalidad, antropomorfismo, inteligencia percibida) [—], la Trust in Automation Scale (TiA) [—] y el System Usability Scale (SUS) [—], combinados con tareas de retención de información para medir comprensión efectiva.

---

## III. System Design

### A. Descripción General

Archibot es un agente virtual corporizado integrado en Arca.Xplore, una plataforma de gestión de expedientes documentales. Su función es actuar como interfaz de consulta sobre los documentos del expediente activo, recuperando información relevante mediante RAG y comunicándola al usuario a través de un avatar 3D con voz sintetizada.

El sistema consta de tres componentes principales: (1) el frontend de renderizado del avatar, (2) el backend de consulta RAG, y (3) el módulo de síntesis de voz del navegador.

### B. Frontend: Renderizado del Avatar

El avatar de Archibot se implementa mediante **Three.js** y la librería **@pixiv/three-vrm**, lo que permite cargar y renderizar modelos en formato VRM directamente en el navegador sin dependencias de motor de juego externo. Esta decisión arquitectónica elimina la necesidad de compilar y distribuir un build de Unity, reduciendo la fricción de despliegue y mejorando la reproducibilidad del prototipo en entornos de evaluación.

El módulo `AvatarController` gestiona:

- **Carga dinámica de modelos VRM**: El avatar se carga desde una URL configurable, con soporte para intercambio en tiempo de ejecución (*runtime model swapping*), lo que permite comparar diferentes representaciones visuales del agente.
- **Pose natural en reposo**: Los modelos VRM cargan por defecto en T-pose. El sistema aplica una pose de descanso que rota los brazos hacia abajo y orienta la cabeza hacia la cámara, resultando en una postura natural para la interacción.
- **Animaciones idle**: Respiración (movimiento sutil del spine), parpadeo aleatorio con intervalos naturales (2–6 segundos) y cabeceo suave, generados proceduralmente mediante funciones sinusoidales.
- **Lip sync simulado**: La Web Speech API (`SpeechSynthesis`) no expone el stream de audio del navegador, por lo que no es posible análisis espectral en tiempo real. En su lugar, el sistema implementa animación labial procedural: los eventos `onstart`, `onboundary` y `onend` de `SpeechSynthesisUtterance` controlan los blend shapes `Aa` y `Oh` del avatar mientras dura la locución, produciendo movimiento labial sincronizado con la habla. Esta limitación del prototipo se documenta como decisión de diseño y se considera aceptable para la evaluación piloto.
- **Expresiones emocionales**: El LLM puede invocar acciones que mapean emociones (`happy`, `sad`, `neutral`, `surprised`, `relaxed`, `angry`) a las expresiones VRM correspondientes, con transición suave mediante interpolación.

La cámara se posiciona automáticamente para encuadrar la parte superior del cuerpo del avatar en vista de tres cuartos, con iluminación compuesta de luz clave cálida, luz de relleno fría y luz de borde púrpura, estética coherente con un asistente corporativo digital.

### C. Backend: Pipeline RAG

El backend actúa como intermediario seguro entre el cliente web y los servicios de OpenAI, evitando la exposición de credenciales en el navegador. El pipeline procesa cada consulta del usuario en tres etapas:

1. **Recuperación**: La consulta es procesada mediante búsqueda semántica sobre el almacén vectorial del expediente activo en Arca.Xplore, recuperando los fragmentos documentales más relevantes.
2. **Generación**: Los fragmentos recuperados se integran como contexto en el prompt enviado al LLM (OpenAI GPT-4o), junto con instrucciones de comportamiento del agente (tono, extensión, acciones de emoción).
3. **Respuesta**: El texto generado se devuelve al cliente con metadatos de acción (emoción sugerida), que el `AvatarController` interpreta para actualizar la expresión del avatar.

### D. Síntesis de Voz

La narración audible se realiza mediante la **Web Speech API** (`SpeechSynthesis`), disponible de forma nativa en los navegadores modernos. Esta decisión elimina la dependencia de servicios externos de TTS (descartados por restricciones de disponibilidad en esta fase), reduce la latencia de respuesta y evita costos adicionales. La síntesis de voz se activa automáticamente al recibir una respuesta del backend en la Condición A (AVC), y se desactiva completamente en la Condición B (textual). Señales visuales de espera (animación del avatar en estado *thinking*) gestionan la latencia de recuperación y generación, siguiendo las recomendaciones de [9][13].

### E. Modo Conversacional y Layouts

La interfaz implementa un toggle **"Modo Conversacional"** que configura el sistema en una de dos condiciones experimentales sin recargar la página. El toggle controla simultáneamente: la visibilidad de la columna del avatar, la distribución del grid, la activación del TTS automático, y la activación del STT.

Los layouts resultantes son:

**Condición B — Textual (toggle desactivado, default):**
```
| PDF (80%) | Chat (20%) |
```

**Condición A — AVC, chat oculto (toggle activado, default conversacional):**
```
| PDF (65%) | Avatar (35%) |
```

**Condición A — AVC, chat desplegado:**
```
| PDF (55%) | Avatar (25%) | Chat (20%) |
```

Para el estudio piloto, el evaluador configura el modo antes de entregar el sistema al participante; el participante no cambia de modo durante la sesión.

### F. Arquitectura de Despliegue

```
[Usuario] ──► [Arca.Xplore Web App]
                    │
                    ├── [Toggle "Modo Conversacional"]
                    │         ├── Layout grid (CSS flex %)
                    │         ├── AvatarController (visible/oculto)
                    │         ├── TTS automático (on/off)
                    │         └── STT — ArcaSTTCapture (on/off)
                    │
                    ├── [AvatarController] ◄── Three.js + @pixiv/three-vrm
                    │         │
                    │    [Web Speech API] ──► Lip Sync Simulado
                    │    (SpeechSynthesisUtterance events)  ──► VRM Blend Shapes (Aa, Oh)
                    │
                    └── [HTTP Request] ──► [ASP.NET XPLOREragController]
                                                │
                                    ┌───────────┴───────────┐
                              [Vector Store]         [OpenAI GPT-4o]
                              (Expediente RAG)        (Generación + Emoción)
```

---

## IV. Study Design

### A. Objetivo del Estudio

El estudio busca comparar el efecto de dos modos de presentación de respuestas RAG —agente virtual corporizado (Condición A) vs. interfaz textual (Condición B)— sobre la confianza percibida, la naturalidad de la interacción, la usabilidad y la retención de información, en tareas de consulta sobre expedientes documentales.

Dado que la evaluación con usuarios reales requiere autorización del Comité Ético Científico (CEC) de la UCR, el estudio se realizará con **expertos** (investigadores y profesionales con experiencia en HCI o sistemas documentales), en modalidad de piloto.

### B. Condiciones Experimentales

**Condición A — Agente Virtual Corporizado (AVC):** El participante interactúa con Archibot: avatar 3D con animaciones de escucha, espera y habla; respuestas comunicadas mediante síntesis de voz (Web Speech API) con lip sync simulado; input por voz (STT); y señales visuales de latencia. El chat es colapsable (oculto por defecto). El layout por defecto es `| PDF (65%) | Avatar (35%) |`; al desplegar el chat se redistribuye a `| PDF (55%) | Avatar (25%) | Chat (20%) |`.

**Condición B — Interfaz Textual (Baseline):** El participante interactúa con una interfaz de chat tradicional que utiliza el mismo sistema RAG y LLM subyacente, presentando las respuestas únicamente en formato texto, sin representación corporal ni voz. El TTS y el STT están desactivados. El layout es fijo: `| PDF (80%) | Chat (20%) |`.

Ambas condiciones se activan mediante un toggle **"Modo Conversacional"** en la interfaz; para el piloto, el evaluador configura el modo antes de la sesión y el participante no lo modifica. La justificación del diseño comparativo es aislar el efecto del *embodiment* y la comunicación multimodal: dado que el motor de recuperación y generación es idéntico en ambas condiciones, cualquier diferencia observada se atribuirá a la presencia del agente corporizado y su modalidad comunicativa.

### C. Expediente de Prueba

El expediente utilizado en el estudio está compuesto por tres reglamentos oficiales del Consejo Universitario de la Universidad de Costa Rica, disponibles públicamente: (1) Reglamento de Horas Estudiante, Horas Asistente y Horas Asistente de Posgrado; (2) Reglamento de Régimen Académico Estudiantil; y (3) Reglamento del Trabajo Comunal Universitario. Este conjunto documental fue seleccionado por tres razones: su naturaleza normativa y formal es representativa del tipo de expedientes gestionados en Arca.Xplore; sus contenidos son desconocidos en detalle para la mayoría de participantes, lo que evita sesgos por conocimiento previo; y sus artículos contienen datos específicos y verificables que permiten diseñar preguntas de retención con respuesta objetiva.

### D. Tareas del Escenario

Cada participante realizará las siguientes tareas sobre el expediente de prueba:

| Tarea | Consulta al sistema | RQ asociada |
|---|---|---|
| T1 | *"Soy estudiante de posgrado activo. ¿Puedo ser designado en horas asistente de posgrado si tengo una nota de Incompleto (IN) en un curso de investigación? ¿Cuál es el promedio mínimo que necesito?"* | RQ1 |
| T2 | *"Soy estudiante de bachillerato y quiero hacer horas asistente al mismo tiempo que realizo mi TCU. ¿Puedo hacerlo? ¿Hay algún límite de horas combinadas que deba respetar? ¿Cuántas horas de TCU debo cumplir en total?"* | RQ2 |
| T3 | *"¿Cuánto gana por hora una persona en horas asistente de posgrado en comparación con una en horas estudiante? ¿Cuál es la nota mínima para aprobar un curso en la UCR? ¿Cuántos estudiantes debe tener como mínimo un proyecto de TCU?"* | RQ3 |

**Justificación del diseño de tareas:** T1 es una consulta de verificación sobre requisitos específicos, con respuesta factual directa (Art. 5 del Reglamento de Horas), apropiada para evaluar confianza. T2 es una consulta de síntesis que requiere integrar información de dos reglamentos distintos (Art. 12 de Horas y Art. 20 de TCU), apropiada para evaluar naturalidad y comprensión en una interacción extendida. T3 contiene tres preguntas de dato puntual (triple del valor de hora estudiante; nota mínima 7,0; mínimo 8 estudiantes) cuyas respuestas son objetivamente verificables, lo que permite construir el cuestionario de retención.

### D. Instrumentos de Recolección de Datos

| Constructo | Instrumento | Aplicación |
|---|---|---|
| Confianza percibida | Trust in Automation (TiA) — Jian et al. | Post-tarea T1 |
| Naturalidad percibida | Godspeed Questionnaire (subescalas *Perceived Intelligence* y *Anthropomorphism*) | Post-tarea T2 |
| Usabilidad | System Usability Scale (SUS) | Post-sesión |
| Retención de información | Cuestionario ad-hoc de retención (3 ítems de opción múltiple basados en T3) | Post-tarea T3 |
| Observación | Notas del evaluador sobre comportamiento, dudas y comentarios espontáneos | Durante la sesión |

### E. Procedimiento

1. Consentimiento informado y explicación del objetivo del estudio (sin revelar la hipótesis).
2. Práctica breve con la interfaz asignada (5 minutos).
3. Ejecución de las tareas T1, T2 y T3 siguiendo el guión del escenario.
4. Aplicación de los cuestionarios post-tarea.
5. Entrevista corta de cierre (3–5 preguntas abiertas sobre la experiencia).

El diseño es entre-sujetos (*between-subjects*): cada participante experimenta únicamente una de las dos condiciones, para evitar el efecto de aprendizaje y el sesgo de comparación directa.

### F. Análisis

Dado el tamaño de muestra reducido del piloto con expertos, el análisis será descriptivo (medias, desviaciones estándar) con comparación de tendencias entre condiciones. Se reportarán adicionalmente los comentarios cualitativos de la entrevista de cierre como evidencia complementaria. Este diseño piloto no pretende establecer significancia estadística, sino informar el refinamiento del protocolo para un estudio posterior con usuarios reales.

---

## V. Results

> *Esta sección será completada con los datos del piloto con expertos. Se reportarán las puntuaciones promedio de TiA, Godspeed y SUS por condición, los resultados del cuestionario de retención, y los hallazgos cualitativos de las entrevistas.*

---

## VI. Discussion

> *Esta sección interpretará los resultados en relación con las tres RQs, discutirá las implicaciones para el diseño de AVC en sistemas RAG documentales, señalará las limitaciones del estudio piloto y propondrá líneas de trabajo futuro.*

---

## VII. Conclusions

> *Esta sección sintetizará las contribuciones del trabajo: el diseño e implementación de Archibot como AVC web-nativo (Three.js + VRM), el protocolo de evaluación comparativa, y los hallazgos preliminares sobre el efecto del embodiment en la confianza percibida y la naturalidad de la interacción en sistemas RAG documentales.*

---

## References

[1] W. Fan et al., "A Survey on RAG Meeting LLMs: Towards Retrieval-Augmented Large Language Models," in *Proc. 30th ACM SIGKDD*, 2024. https://doi.org/10.1145/3637528.3671470

[2] S. Zerhoudi and M. Granitzer, "PersonaRAG: Enhancing Retrieval-Augmented Generation Systems with User-Centric Agents," arXiv, 2024. https://doi.org/10.48550/arxiv.2407.09394

[3] A. More, "Interaction via Large Language Models: Advancements in Retrieval-Augmented Intelligent Interfaces," *IJRASET*, 2025. https://doi.org/10.22214/ijraset.2025.70382

[4] N. Alalyani and N. Krishnaswamy, "A Methodology for Evaluating Multimodal Referring Expression Generation for Embodied Virtual Agents," in *Companion Proc. ICMI*, 2023. https://doi.org/10.1145/3610661.3616548

[5] A. Schmitt, T. Wambsganss, and J. Leimeister, "Conversational Agents for Information Retrieval in the Education Domain," *PACMHCI*, vol. 6, 2022. https://doi.org/10.1145/3555587

[6] D. Egelhofer et al., "Effects of Verbal Interruption in Conversations with an Intelligent Virtual Agent in Virtual Reality," in *Proc. ACM SUI*, 2025. https://doi.org/10.1145/3694907.3765918

[7] I. Wang, J. Smith, and J. Ruiz, "Exploring Virtual Agents for Augmented Reality," in *Proc. CHI*, 2019. https://doi.org/10.1145/3290605.3300511

[8] Z. Chang et al., "The Impact of Virtual Agents' Multimodal Communication on Brain Activity and Cognitive Load in Virtual Reality," *Front. Virtual Real.*, vol. 3, 2022. https://doi.org/10.3389/frvir.2022.995090

[9] S. Jolibois, A. Ito, and T. Nose, "The Development of an Emotional Embodied Conversational Agent and the Evaluation of the Effect of Response Delay on User Impression," *Appl. Sci.*, 2025. https://doi.org/10.3390/app15084256

[10] Y. Liang et al., "How Users Interact with Generative Information Retrieval Systems," in *Proc. SIGIR*, 2025. https://doi.org/10.1145/3726302.3729998

[11] H.-K. Yang et al., "An Embodied AR Navigation Agent: Integrating BIM with Retrieval-Augmented Generation for Language Guidance," in *IEEE ISMAR*, 2025. https://doi.org/10.1109/ismar67309.2025.00150

[12] H. Yang, Q. Tian, and X. Gu, "Toward Industry 5.0: Evaluating Multimodal Virtual Human Interaction for Smart Healthcare in Simulated VR Environments," *Internet Technol. Lett.*, 2025. https://doi.org/10.1002/itl2.70190

[13] M. Elfleet and M. Chollet, "Investigating the Impact of Multimodal Feedback on User-Perceived Latency and Immersion with LLM-Powered ECAs in VR," in *Proc. IVA*, 2024. https://doi.org/10.1145/3652988.3673965

[14] Y. Zhu et al., "Retrieval-Augmented Embodied Agents," in *Proc. CVPR*, 2024. https://doi.org/10.1109/cvpr52733.2024.01703

[15] S. Roy et al., "Conversational Text Extraction with Large Language Models Using Retrieval-Augmented Systems," in *Proc. CINE*, 2024. https://doi.org/10.1109/cine63708.2024.10881808

[16] I. C. R. Haque, "Implementation of RAG and LLM for a Document and Tabular-Based Chatbot System," *JOETEX*, 2025. https://doi.org/10.52465/joetex.v3i1.588

[17] Y. Ahn et al., "Retrieval-Augmented Response Generation for Knowledge-Grounded Conversation in the Wild," *IEEE Access*, vol. 10, 2022. https://doi.org/10.1109/access.2022.3228964

[18] H. Shimadzu, T. Utsuro, and D. Kitayama, "Retrieval-Augmented Simulacra: Generative Agents for Up-to-Date and Knowledge-Adaptive Simulations," in *Proc. IEEE GCCE*, 2025. https://doi.org/10.1109/gcce65946.2025.11275306

[19] *(Referencia sobre Uncanny Valley / diseño de avatares — por confirmar en bibliografía)*

[20] *(Referencia sobre agentes compañeros longitudinales — por confirmar en bibliografía)*
