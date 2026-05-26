# Tarea #10: Diseño del Protocolo de Evaluación y Matriz de Consistencia

**Estudiante:** Marco Antonio Jiménez Gutiérrez  
**Carnet:** A42781

## Apartado A: Definición de Condiciones

* **Condición Experimental (Condición A - Agente Virtual Corporizado):** El usuario interactuará con un sistema implementado en WebGL que presenta un avatar 3D con animaciones básicas de escucha, espera y habla. Este agente utilizará la síntesis de voz del navegador (Web Speech API) para comunicar de forma oral las respuestas generadas mediante la técnica RAG. Además, incorporará señales visuales de espera para gestionar la latencia del sistema.
* **Condición de Control o Baseline (Condición B - Interfaz Textual):** El usuario interactuará con una interfaz de consulta documental en formato puramente textual, similar a un sistema transaccional o a una interfaz de chat tradicional. Esta interfaz utilizará el mismo sistema subyacente RAG y modelo de lenguaje para la recuperación de información, pero sin la representación corporal, la voz ni las animaciones.
* **Justificación:** Esta comparación resulta fundamental para aislar y medir el efecto específico de la comunicación corporizada y audible. Dado que el motor de recuperación y generación de respuestas (LLM + RAG) es idéntico en ambos casos, cualquier diferencia en la confianza o naturalidad percibida se deberá a la capacidad del agente de actuar como una interfaz explicativa, orientadora y socialmente natural, y no a la calidad de los datos recuperados.

## Apartado B: Matriz de Consistencia Metodológica

| Preguntas de Investigación (RQ) | Variable o Constructo | Instrumento Validado (Sugerido) | Tarea Asociada (Guion del Escenario) |
| :--- | :--- | :--- | :--- |
| **RQ 1:** ¿Qué efecto tiene el uso de un agente virtual corporizado como interfaz de un sistema RAG sobre la confianza percibida en las respuestas generadas, en comparación con una interfaz textual de consulta documental? | Confianza en el sistema | Trust in Automated Systems Questionnaire (Jian et al.) o Trust in Automation (TiA) | Realizar una consulta específica sobre un expediente documental y evaluar la fiabilidad de la respuesta proporcionada por la interfaz. |
| **RQ 2:** ¿Qué efecto tiene el uso de un agente virtual corporizado sobre la naturalidad percibida de la interacción y la comprensión de las respuestas en tareas de consulta sobre expedientes documentales, en comparación con una interfaz textual tipo chat? | Naturalidad percibida | Godspeed Questionnaire (Subescala: *Perceived Intelligence* y *Anthropomorphism*) | Mantener una interacción de consulta donde el sistema debe procesar la información y el usuario debe interpretar la respuesta (texto vs. voz/animación). |
| **RQ 2 (Complemento):** ¿Qué efecto tiene el uso de un agente virtual corporizado sobre la [...] comprensión de las respuestas en tareas de consulta...? | Comprensión y Usabilidad | System Usability Scale (SUS) + Cuestionario ad-hoc de retención de información. | Escuchar/leer la respuesta final del sistema RAG y responder a una pregunta de control sobre el contenido del expediente documental. |

## Apartado D: Justificación Teórica en HCI

* **Soporte no verbal y Embodiment (Justine Cassell / Multimodalidad):** La inclusión de animaciones de escucha, espera y habla en el avatar 3D responde a la necesidad de interacción multimodal evidenciada en la literatura. Particularmente en sistemas potenciados por LLMs y RAG, el uso de pausas, expresiones faciales y retroalimentación visual (como señales de espera) son fundamentales para mitigar la percepción negativa de la latencia, evitando que la demora en el procesamiento afecte la sensación de fluidez en la interacción.
* **Diseño del soporte relacional y lazos afectivos (Timothy Bickmore / Confianza):** El agente virtual corporizado ha sido diseñado no solo para presentar datos, sino para actuar como una "interfaz explicativa y orientadora". Al comunicar la información de manera clara, contextualizada y cercana, el agente busca establecer un puente conversacional que favorezca la confianza percibida por el usuario. Esto se alinea con la premisa de que los sistemas RAG mejoran significativamente cuando incorporan agentes centrados en el usuario.
* **Diseño Visual y Efecto Proteus (Nick Yee y Jeremy Bailenson):** La teoría advierte que un agente mal sincronizado o excesivamente antropomórfico puede generar pérdida de confianza o incomodidad (Valle Inquietante). Por ello, se ha optado por un diseño visual sobrio y funcional, coherente con la tarea de consulta de expedientes documentales. Se espera que esta representación profesional induzca al usuario a tratar el sistema con la seriedad que requiere una base de datos documental, manteniendo al mismo tiempo una experiencia más humana.
