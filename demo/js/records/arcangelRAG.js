window.arcangelRAGLoader = (jQuery, kendo) => {
    // Namespace interno del ArcangelRAG
    window.ArcangelRAG = (function ($, kendo) {
        // Estado privado
        let _mounted = false;
        let _pdf = null;               // PDFDocumentProxy
        let _pdfPages = {};            // cache de páginas renderizadas
        let _currentScale = 1.25;
        let _destroying = false;
        let _avatarController = null;

        // ===== Modo Conversacional (estudio A/B PF-3311) =====
        const MODE_KEY = 'archibot_conversacional';
        let _modoConversacional = localStorage.getItem(MODE_KEY) === 'true';
        let _chatVisible = false;        // sólo aplica en Condición A (AVC)
        let _ttsAutomatico = false;      // TTS automático sólo en Condición A
        let _sttHandle = null;           // { enable, disable } devuelto por configureSTT()
        let avatarName = 'Ariel';       // Nombre genérico del avatar para usar en los mensajes iniciales y de error (independiente del modelo 3D seleccionado)
        let _ttsPaused = false;          // Estado de pausa del TTS (controles de voz del avatar)
        let _greetingText = '';          // Saludo aleatorio elegido al montar (para mostrarlo y, en AVC, locutarlo)
        let _greetingSpoken = false;     // Ya se locutó el saludo (no repetir)
        let _greetingPending = false;    // Locución del saludo en curso de confirmación

        // ===== Avatar seleccionado y voz asociada =====
        let _selectedAvatarUrl = '/models/ArcaXplore-F.vrm';
        const AVATAR_VOICES = {
            '/models/ArcaXplore-M.vrm': { gender: 'male',   pitch: 0.9 },
            '/models/ArcaXplore-F.vrm': { gender: 'female', pitch: 1.12 },
        };
        const VOICE_HINTS = {
            female: /sabina|helena|laura|m[oó]nica|paulina|elvira|google espa|female|mujer/i,
            male:   /raul|ra[uú]l|pablo|jorge|diego|miguel|carlos|male|hombre/i,
        };

        // Resuelve (lazy, al momento de hablar) las opciones de voz para el avatar activo.
        // Busca una voz es-* del sistema que matchee el género; si no hay, usa el pitch como diferenciador.
        function _voiceOptsForAvatar(url) {
            const cfg = AVATAR_VOICES[url] || { gender: 'female', pitch: 1.0 };
            const tts = _getTTS();
            // Caché del controlador y, si aún no cargó, la API nativa como respaldo.
            let voices = (tts && tts.getVoices && tts.getVoices()) || [];
            if (!voices.length && window.speechSynthesis) {
                voices = window.speechSynthesis.getVoices() || [];
            }
            let voiceName = null;
            if (voices.length) {
                const es = voices.filter(v => (v.lang || '').toLowerCase().startsWith('es'));
                const pool = es.length ? es : voices;
                const wanted = VOICE_HINTS[cfg.gender];
                const opposite = cfg.gender === 'female' ? VOICE_HINTS.male : VOICE_HINTS.female;
                // 1) voz del género buscado; 2) una que NO sea del género opuesto; 3) la primera disponible.
                const hit = pool.find(v => wanted.test(v.name))
                    || pool.find(v => !opposite.test(v.name))
                    || pool[0];
                voiceName = hit ? hit.name : null;
            }
            const matchedGender = !!voiceName && VOICE_HINTS[cfg.gender].test(voiceName);
            return { lang: 'es-CR', voiceName, pitch: matchedGender ? 1.0 : cfg.pitch };
        }

        // Ejecuta `cb` cuando las voces del sistema están disponibles (carga asíncrona).
        // Llama de inmediato si ya están; si no, espera el evento `voiceschanged` o sondea.
        function _whenVoicesReady(cb) {
            const synth = window.speechSynthesis;
            if (!synth) { cb(); return; }
            if ((synth.getVoices() || []).length) { cb(); return; }
            let done = false, attempts = 0;
            const finish = () => {
                if (done) return;
                done = true;
                clearInterval(timer);
                if (synth.removeEventListener) synth.removeEventListener('voiceschanged', onVC);
                cb();
            };
            const onVC = () => { if ((synth.getVoices() || []).length) finish(); };
            if (synth.addEventListener) synth.addEventListener('voiceschanged', onVC);
            const timer = setInterval(() => {
                if ((synth.getVoices() || []).length || ++attempts > 25) finish();
            }, 120);
        }


        // ===== Saludo inicial de Ariel (3 variantes aleatorias) =====
        function _randomGreeting() {
            const saludos = [
                `¡Hola! Soy ${avatarName}. ¿En qué te puedo ayudar con el expediente de hoy?`,
                `Hola, soy ${avatarName}. Pregúntame lo que necesites sobre el documento de la izquierda.`,
                `¡Qué gusto saludarte! Soy ${avatarName}, tu asistente. ¿Sobre cuál reglamento quieres consultar?`
            ];
            return saludos[Math.floor(Math.random() * saludos.length)];
        }

        // Locuta el saludo (sólo en Condición A). Una sola vez.
        function _speakGreeting() {
            if (_greetingSpoken || _greetingPending || !_greetingText) return;
            const tts = _getTTS();
            const synth = window.speechSynthesis;
            if (!tts || !synth) return;

            _greetingPending = true;
            // Esperar a que las voces carguen para que se elija la voz acorde al género del avatar.
            _whenVoicesReady(() => {
                _setAvatarMicSpeaking(true); // anti-feedback + bloquea micro mientras saluda
                Promise.resolve(
                    tts.speak(_stripForVoice(_greetingText), _voiceOptsForAvatar(_selectedAvatarUrl))
                ).finally(() => _setAvatarMicSpeaking(false));

                // Confirmar que realmente arrancó: el navegador bloquea speechSynthesis
                // sin un gesto previo del usuario. Si no arrancó, dejamos el fallback armado.
                setTimeout(() => {
                    _greetingPending = false;
                    if (synth.speaking || synth.pending) {
                        _greetingSpoken = true;
                    } else {
                        _setAvatarMicSpeaking(false);
                    }
                }, 350);
            });
        }

        // Intenta locutar el saludo de inmediato y, si el autoplay está bloqueado,
        // lo reproduce en la primera interacción del usuario (click/tecla/touch).
        function _armGreetingSpeech() {
            _speakGreeting();
            if (_greetingSpoken) return;

            const events = ['pointerdown', 'keydown', 'touchstart'];
            const cleanup = () => events.forEach(ev => document.removeEventListener(ev, onGesture, true));
            const onGesture = () => {
                _speakGreeting();
                if (_greetingSpoken || _greetingPending) cleanup();
            };
            events.forEach(ev => document.addEventListener(ev, onGesture, true));
        }

        // ===== Utilidades =====
        function _ensurePanelMounted(base64Pdf, title) {
            if ($("#arcangelRagPanel").length) {
                if ($("#arcangelRagPanel").hasClass("arcangel-rag-panel")) {
                    $("#arcangelRagPanel").appendTo(document.body).addClass("arcangel-panel-active");
                    return;
                }
                $("#arcangelRagPanel").remove();
            }

            const host = document.body;

            // Elegir el saludo una sola vez para que el texto mostrado y el locutado coincidan.
            _greetingText = _randomGreeting();
            _greetingSpoken = false;

            const panelHtml = `
                  <style>
                    #arcangelRagPanel .arcangel-grid-3-col {
                        display: grid;
                        /* grid-template-columns lo gestiona aplicarLayout() según la condición A/B */
                        grid-template-columns: 65% 35% 0%;
                        width: 100%;
                        height: 100%;
                    }
                    /* Anclar cada columna a su pista para que ocultar una (display:none)
                       NO desplace a las demás dentro del grid (Condición B/A). */
                    #arcangelRagPanel .doc-wrap   { grid-column: 1; min-width: 0; overflow: hidden; }
                    #arcangelRagPanel #avatar-wrap { grid-column: 2; min-width: 0; overflow: hidden; }
                    #arcangelRagPanel #chat-wrap  { grid-column: 3; min-width: 0; overflow: hidden; }
                    #arcangelRagPanel #btn-toggle-modo {
                        position: absolute;
                        bottom: 56px;          /* Tarea 2: abajo a la derecha, apilado sobre el botón de chat (ya no tapa #avatarSelector) */
                        right: 14px;
                        z-index: 10;
                        background: #111827;
                        color: #cbd5e1;
                        border: 1px solid #4b5563;
                        border-radius: 4px;
                        padding: 4px 10px;
                        font-size: 11px;
                        cursor: pointer;
                        outline: none;
                        opacity: 0.85;
                    }
                    #arcangelRagPanel #btn-toggle-modo.modo-activo {
                        background: #2563eb;
                        color: #fff;
                        border-color: #2563eb;
                    }
                    /* Botón secundario para abrir/cerrar el chat de texto (esquina inferior derecha) */
                    #arcangelRagPanel #btn-toggle-chat {
                        position: absolute;
                        bottom: 16px;
                        right: 14px;
                        z-index: 6;
                        background: rgba(30, 41, 59, 0.9);
                        color: #cbd5e1;
                        border: 1px solid #334155;
                        border-radius: 18px;
                        padding: 6px 12px;
                        cursor: pointer;
                        display: none;            /* aplicarLayout lo muestra en Condición A */
                        align-items: center;
                        justify-content: center;
                        gap: 6px;
                        font-size: 12px;
                        font-weight: 600;
                        white-space: nowrap;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
                    }
                    #arcangelRagPanel #btn-toggle-chat:hover { background: #2563eb; color: #fff; }

                    /* ===== Micrófono del avatar (Condición A): FAB + indicador "escuchando" ===== */
                    #arcangelRagPanel #avatar-mic-dock {
                        position: absolute;
                        bottom: 18px;
                        left: 50%;
                        transform: translateX(-50%);
                        z-index: 6;
                        display: none;            /* aplicarLayout lo muestra en Condición A */
                        flex-direction: column;
                        align-items: center;
                        gap: 6px;
                    }
                    #arcangelRagPanel #btn-avatar-mic {
                        position: relative;
                        width: 62px;
                        height: 62px;
                        border-radius: 50%;
                        border: none;
                        cursor: pointer;
                        background: radial-gradient(circle at 35% 30%, #3b82f6, #1d4ed8);
                        color: #fff;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
                        transition: background 0.2s ease, transform 0.1s ease;
                    }
                    #arcangelRagPanel #btn-avatar-mic:hover { transform: scale(1.05); }
                    #arcangelRagPanel #btn-avatar-mic .mic-ico { width: 26px; height: 26px; }
                    #arcangelRagPanel #btn-avatar-mic .mic-ring {
                        position: absolute;
                        inset: -4px;
                        border-radius: 50%;
                        border: 3px solid #ef4444;
                        opacity: 0;
                        pointer-events: none;
                    }
                    /* Estado escuchando: rojo + anillo parpadeante */
                    #arcangelRagPanel #btn-avatar-mic.listening {
                        background: radial-gradient(circle at 35% 30%, #f87171, #dc2626);
                    }
                    #arcangelRagPanel #btn-avatar-mic.listening .mic-ring {
                        animation: arcangel-mic-pulse 1.2s ease-out infinite;
                    }
                    #arcangelRagPanel #btn-avatar-mic[disabled] { opacity: 0.45; cursor: not-allowed; }
                    @keyframes arcangel-mic-pulse {
                        0%   { transform: scale(1);    opacity: 0.75; }
                        70%  { transform: scale(1.55); opacity: 0;    }
                        100% { transform: scale(1.55); opacity: 0;    }
                    }
                    #arcangelRagPanel #avatar-mic-status {
                        font-size: 12px;
                        font-weight: 600;
                        color: #cbd5e1;
                        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
                    }
                    #arcangelRagPanel #btn-avatar-mic.listening + #avatar-mic-status { color: #fca5a5; }
                    /* Parpadeo del texto mientras escucha */
                    #arcangelRagPanel #avatar-mic-dock.is-listening #avatar-mic-status {
                        animation: arcangel-blink 1s steps(2, start) infinite;
                    }
                    @keyframes arcangel-blink { 50% { opacity: 0.35; } }

                    /* ===== Controles de voz de Ariel (Condición A): pausar / detener — abajo a la izquierda ===== */
                    #arcangelRagPanel #avatar-tts-controls {
                        position: absolute;
                        bottom: 18px;
                        left: 14px;
                        z-index: 6;
                        display: none;            /* aplicarLayout lo muestra en Condición A */
                        align-items: center;
                        gap: 8px;
                    }
                    #arcangelRagPanel .avatar-tts-btn {
                        width: 38px;
                        height: 38px;
                        border-radius: 50%;
                        border: 1px solid #334155;
                        background: rgba(30, 41, 59, 0.9);
                        color: #e2e8f0;
                        font-size: 14px;
                        line-height: 1;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
                        transition: background 0.15s ease, transform 0.1s ease;
                    }
                    #arcangelRagPanel .avatar-tts-btn:hover { background: #2563eb; color: #fff; transform: scale(1.06); }
                    #arcangelRagPanel #btn-avatar-stop:hover { background: #dc2626; border-color: #dc2626; }

                    /* Subtítulo en vivo de la transcripción sobre el avatar */
                    #arcangelRagPanel #avatar-subtitle {
                        position: absolute;
                        bottom: 96px;
                        left: 50%;
                        transform: translateX(-50%);
                        z-index: 6;
                        max-width: 86%;
                        padding: 8px 14px;
                        background: rgba(0, 0, 0, 0.62);
                        color: #fff;
                        border-radius: 12px;
                        font-size: 13px;
                        line-height: 1.35;
                        text-align: center;
                        display: none;
                        backdrop-filter: blur(2px);
                    }
                    #arcangelRagPanel .avatar-wrap {
                        display: flex;
                        flex-direction: column;
                        height: 100%;
                        background: #1a1a2e;
                        border-right: 1px solid #dee2e6;
                        overflow: hidden;
                    }
                    #arcangelRagPanel .avatar-header {
                        background-color: #1e293b;
                        color: white;
                        padding: 10px 16px;
                        font-weight: 600;
                        border-bottom: 1px solid #334155;
                        height: 44px;
                        display: flex;
                        align-items: center;
                        box-sizing: border-box;
                    }
                    #arcangelRagPanel .avatar-body {
                        flex: 1;
                        background: #1a1a2e;
                        position: relative;
                        height: calc(100% - 44px);
                    }
                    /* Render del Markdown del RAG dentro de la burbuja de la IA */
                    #arcangelRagPanel .msg.ai .msg-content > *:first-child { margin-top: 0; }
                    #arcangelRagPanel .msg.ai .msg-content > *:last-child { margin-bottom: 0; }
                    #arcangelRagPanel .msg.ai .msg-content p { margin: 6px 0; }
                    #arcangelRagPanel .msg.ai .msg-content ul { margin: 6px 0; padding-left: 20px; }
                    #arcangelRagPanel .msg.ai .msg-content li { margin: 2px 0; }
                    #arcangelRagPanel .msg.ai .msg-content strong { font-weight: 700; }
                    #arcangelRagPanel .msg.ai .msg-content code {
                        background: rgba(148, 163, 184, 0.18);
                        padding: 1px 5px;
                        border-radius: 4px;
                        font-size: 0.92em;
                    }
                  </style>
                  <div id="arcangelRagPanel" aria-label="RAG del expediente" role="region">
                    <button id="btn-toggle-modo" type="button" title="Conmutar Modo Conversacional (AVC) / Textual">Modo: Textual</button>
                    <div class="arcangel-grid-3-col">

                      <!-- IZQUIERDA: PDF -->
                      <section class="doc-wrap">
                        <div class="doc-canvas">
                          <div id="docLoader" class="k-loading-mask" hidden>
                              <span class="k-loading-text">Cargando…</span>
                              <div class="k-loading-image"></div>
                          </div>
                          <div id="docHost" aria-label="Visor de documento"><div id="pdfViewer"></div></div>
                        </div>
                      </section>

                      <!-- CENTRO: AVATAR 3D -->
                      <section class="avatar-wrap" id="avatar-wrap">
                        <header class="avatar-header" style="display: flex; justify-content: space-between; align-items: center; gap: 8px; width: 100%;">
                          <span>🧑 Agente Virtual Ariel</span>
                          <select id="avatarSelector" title="Elige la versión del avatar" aria-label="Versión del avatar" style="background: #111827; color: white; border: 1px solid #6b7280; border-radius: 4px; padding: 4px 8px; font-size: 12px; cursor: pointer; outline: none; max-width: 170px;">
                            <option value="/models/ArcaXplore-F.vrm" selected>Ariel (Femenino)</option>
                            <option value="/models/ArcaXplore-M.vrm">Ariel (Masculino)</option>
                          </select>
                        </header>
                        <div class="avatar-body">
                          <canvas id="arcangelAvatarCanvas"></canvas>
                          <div id="avatar-subtitle" aria-live="polite"></div>
                          <div id="avatar-mic-dock">
                            <button id="btn-avatar-mic" type="button" title="Pulsa para hablar con el avatar" aria-label="Hablar con el avatar">
                              <span class="mic-ring" aria-hidden="true"></span>
                              <svg class="mic-ico" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                                <path d="M5 3a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0z"></path>
                                <path d="M3.5 6.5A.5.5 0 0 1 4 7v1a4 4 0 0 0 8 0V7a.5.5 0 0 1 1 0v1a5 5 0 0 1-4.5 4.975V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 .5-.5"></path>
                              </svg>
                            </button>
                            <span id="avatar-mic-status">Pulsa para hablar</span>
                          </div>
                          <div id="avatar-tts-controls">
                            <button id="btn-avatar-pause" type="button" class="avatar-tts-btn" title="Pausar la voz" aria-label="Pausar la voz de Ariel">⏸</button>
                            <button id="btn-avatar-stop" type="button" class="avatar-tts-btn" title="Detener la voz" aria-label="Detener la voz de Ariel">■</button>
                          </div>
                          <button id="btn-toggle-chat" type="button" title="Mostrar/ocultar chat" aria-label="Mostrar/ocultar chat"><span id="btn-toggle-chat-label">💬 Conversar por texto</span></button>
                        </div>
                      </section>

                      <!-- DERECHA: CHAT -->
                      <aside class="chat-wrap" id="chat-wrap">
                        <header class="chat-header">
                          <div class="arcangel-chat-title">
                            <span class="arcangel-chat-icon"><i class="bi bi-stars" aria-hidden="true"></i></span>
                            <div>
                              <strong>RAG del expediente</strong>
                              <span id="spanTitleRag">${title}</span>
                            </div>
                          </div>
                        </header>
                        <main class="chat-body" id="chatBody">
                          <div class="msg ai">${_greetingText}</div>
                        </main>
                        <footer class="chat-footer" id="chat-footer">
                          <div class="k-hstack k-gap-2">
                            <input id="txtQuestion" class="k-textbox rag-input" placeholder="Escribe tu pregunta..." autocomplete="off">
                            <button id="btnAsk" class="k-button k-primary rag-btn">
                              <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0l1.6 4.4L14 6 9.6 7.6 8 12 6.4 7.6 2 6l4.4-1.6L8 0z"/><circle cx="13" cy="12" r="1.6"/></svg>
                              Enviar
                            </button>
                            <button id="micBtn" type="button" class="rag-mic-btn" accesskey="m" title="Usar micrófono">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
                                   class="bi bi-mic-fill" viewBox="0 0 16 16">
                                <path d="M5 3a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0z"></path>
                                <path d="M3.5 6.5A.5.5 0 0 1 4 7v1a4 4 0 0 0 8 0V7a.5.5 0 0 1 1 0v1a5 5 0 0 1-4.5 4.975V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 .5-.5"></path>
                              </svg>
                              <span id="status" style="display:none;">Status: Idle</span>
                            </button>
                          </div>
                        </footer>
                      </aside>
                    </div>
                  </div>
                `;

            // Montar dentro del contenedor disponible
            $(host).append(panelHtml);
            $("#arcangelRagPanel").addClass("arcangel-panel-active arcangel-rag-panel");

            // Ensure the chat body can host an absolute overlay
            $('#chat-footer').css('position', 'relative');

            // Add loader overlay (once)
            if (!document.getElementById('chatLoader')) {
                $('#chat-footer').append(`
                    <div id="chatLoader" class="chat-loading" aria-live="polite" aria-busy="true" hidden>
                        <div class="k-loading-mask k-opaque" style="width: 100%; height: 100%; top: 0px; left: 0px;">
                            <span role="alert" aria-live="polite" class="k-loading-text">Loading...</span>
                            <div class="k-loading-image" style="color:#1e293b;"></div>
                            <div class="k-loading-color"></div>
                        </div>
                    </div>
                  `);
            }


            $(document).on('keydown', '#txtQuestion', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault(); // prevent form submit if inside a form
                    $('#btnAsk').trigger('click');
                }
            });
            

            // Wire-up de eventos
            $('#arcangelRagPanel').on('click', '.doc-close', function () {
                destroyDocPanel();
            });

            $('#arcangelRagPanel').on('click', '#btn-toggle-modo', function () {
                aplicarModo(!_modoConversacional);
            });

            $('#arcangelRagPanel').on('click', '#btn-toggle-chat', function () {
                toggleChat();
            });

            // FAB de micrófono del avatar (Condición A): inicia/para la escucha
            $('#arcangelRagPanel').on('click', '#btn-avatar-mic', function () {
                if (_sttHandle) _sttHandle.toggle();
            });

            // Controles de voz de Ariel (Condición A): pausar/reanudar y detener el TTS
            $('#arcangelRagPanel').on('click', '#btn-avatar-pause', function () {
                _togglePauseSpeech();
            });
            $('#arcangelRagPanel').on('click', '#btn-avatar-stop', function () {
                _stopSpeech();
            });

            $('#arcangelRagPanel').on('change', '#avatarSelector', async function () {
                const modelUrl = $(this).val();
                if (_avatarController && modelUrl) {
                    try {
                        console.log(`[RAG] Cambiando avatar a: ${modelUrl}`);
                        await _avatarController.loadModel(modelUrl);
                        _selectedAvatarUrl = modelUrl; // la voz del TTS se asocia a este avatar
                    } catch (e) {
                        console.error('[RAG] Error al cambiar el modelo de avatar:', e);
                        alert('No se pudo cargar el modelo del avatar: ' + e.message);
                    }
                }
            });

            $('#btnAsk').on('click', async function () {
                const q = $('#txtQuestion').val().trim();
                if (!q) return;

                _pushUser(q);
                $('#txtQuestion').val('');

                _showChatLoading(true);

                try {
                    const resp = await sendRagQuestion({
                        developerId: window.ARCA_DEV_ID,
                        token: window.ARCA_TOKEN,
                        element: window.ARCA_ELEMENT,
                        question: q,
                        resumeLevel: 0
                    });
                    renderRagResponse(resp);
                } catch (err) {
                    _pushAI('Ocurrió un error consultando el servicio.');
                    console.error(err);
                } finally {
                    _showChatLoading(false);
                }
            });

            // Inicializa y carga en diferido un base64 (si lo tienes a mano)
            const blankBse64Pdf = `JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlIC9DYXRhbG9nL1BhZ2VzIDIgMCBSCj4+CmVuZG9iagoy
                                   IDAgb2JqCjw8L1R5cGUgL1BhZ2VzL0NvdW50IDEvS2lkcyBbMyAwIFJdCj4+CmVuZG9iagozIDAgb2JqCjw8
                                   L1R5cGUgL1BhZ2UvUGFyZW50IDIgMCBSL1Jlc291cmNlcyA8PC9Gb250IDw8Pj4+Pi9NZWRpYUJveCBbMCAw
                                   IDYxMiA3OTJdL0NvbnRlbnRzIDQgMCBSCj4+CmVuZG9iago0IDAgb2JqCjw8L0xlbmd0aCA1IDAgUgo+Pgpz
                                   dHJlYW0KQlQKL0YxIDI0IFRmCjEwMCA3MDAgVGQKKCkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iago1IDAgb2Jq
                                   CjEyCmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTAgMDAwMDAgbiAKMDAw
                                   MDAwMDA3MCAwMDAwMCBuIAowMDAwMDAwMTY2IDAwMDAwIG4gCjAwMDAwMDAyMzUgMDAwMDAgbiAKMDAwMDAw
                                   MDM2MCAwMDAwMCBuIAowMDAwMDAwNDQ4IDAwMDAwIG4gCnRyYWlsZXIKPDwvUm9vdCAxIDAgUi9TaXplIDY+
                                   PgpzdGFydHhyZWYKNDUxCiUlRU9GCg==`;

            const ctrl = setupDocHost({
                mode: 'pdfjsviewer',
                hostSelector: '#pdfViewer',
                loaderSelector: '#docLoader',
                autofit: true,
                initialBase64: base64Pdf
            });

            _mounted = true;
        }

        function _showChatLoading(on) {
            const el = document.getElementById('chatLoader');
            if (!el) return;
            if (on) el.removeAttribute('hidden');
            else el.setAttribute('hidden', '');
        }

        // ===== Gestión de Layouts (Cambio 2) =====
        // | Condición            | col-pdf | col-avatar | col-chat |
        // | B — Textual          | 80%     | 0% oculto  | 20%      |
        // | A — AVC (chat oculto)| 65%     | 35%        | 0% oculto|
        // | A — AVC (chat visible)| 55%    | 25%        | 20%      |
        function aplicarLayout(modoAVC, chatVisible = false) {
            const grid   = document.querySelector('#arcangelRagPanel .arcangel-grid-3-col');
            const avatar = document.getElementById('avatar-wrap');
            const chat   = document.getElementById('chat-wrap');
            const btnChat = document.getElementById('btn-toggle-chat');
            const micDock = document.getElementById('avatar-mic-dock');
            const ttsCtrls = document.getElementById('avatar-tts-controls');
            if (!grid) return;

            // El micrófono y los controles de voz sólo existen en Condición A
            if (micDock) micDock.style.display = modoAVC ? 'flex' : 'none';
            if (ttsCtrls) ttsCtrls.style.display = modoAVC ? 'flex' : 'none';

            if (!modoAVC) {
                // Condición B — Textual
                grid.style.gridTemplateColumns = '80% 0% 20%';
                if (avatar) avatar.style.display = 'none';
                if (chat) chat.style.display = '';
                if (btnChat) btnChat.style.display = 'none';
            } else if (!chatVisible) {
                // Condición A — chat oculto
                grid.style.gridTemplateColumns = '65% 35% 0%';
                if (avatar) avatar.style.display = '';
                if (chat) chat.style.display = 'none';
                if (btnChat) btnChat.style.display = 'flex';
            } else {
                // Condición A — chat desplegado
                grid.style.gridTemplateColumns = '55% 25% 20%';
                if (avatar) avatar.style.display = '';
                if (chat) chat.style.display = '';
                if (btnChat) btnChat.style.display = 'flex';
            }

            // Etiqueta del botón de chat según su estado (sólo relevante en Condición A)
            const btnChatLabel = document.getElementById('btn-toggle-chat-label');
            if (btnChatLabel) {
                btnChatLabel.textContent = chatVisible ? '✖ Cerrar chat' : '💬 Conversar por texto';
            }
        }

        function toggleChat() {
            _chatVisible = !_chatVisible;
            aplicarLayout(_modoConversacional, _chatVisible);
        }

        // ===== Toggle "Modo Conversacional" (Cambio 1) =====
        function aplicarModo(activo) {
            _modoConversacional = activo;
            localStorage.setItem(MODE_KEY, activo);

            // En Condición A el chat arranca colapsado
            if (activo) _chatVisible = false;

            // 1. Layout
            aplicarLayout(activo, _chatVisible);

            // 2. TTS automático (Cambio 3)
            _ttsAutomatico = activo;

            // 3. STT (Cambio 5)
            if (_sttHandle) {
                if (activo) _sttHandle.enable();
                else _sttHandle.disable();
            }

            // 4. Reflejar estado en el botón
            const btn = document.getElementById('btn-toggle-modo');
            if (btn) {
                btn.textContent = activo ? 'Modo: Conversacional' : 'Modo: Textual';
                btn.classList.toggle('modo-activo', activo);
            }
        }

        // ===== Indicador del micrófono del avatar (Condición A) =====
        // Reacciona a los cambios de estado del STT (idle / listening / interim).
        function _applyAvatarMicState(state) {
            const fab = document.getElementById('btn-avatar-mic');
            const dock = document.getElementById('avatar-mic-dock');
            const statusEl = document.getElementById('avatar-mic-status');
            const subtitle = document.getElementById('avatar-subtitle');
            if (!fab) return;

            if (state.type === 'listening') {
                fab.classList.add('listening');
                if (dock) dock.classList.add('is-listening');
                if (statusEl) statusEl.textContent = '🎙️ Escuchando…';
                if (subtitle) { subtitle.textContent = ''; subtitle.style.display = 'none'; }
                if (_avatarController) _avatarController.setEmotion('relaxed'); // expresión de atención
            } else if (state.type === 'interim') {
                // Subtítulo en vivo de la transcripción sobre el avatar
                if (subtitle) {
                    if (state.text) { subtitle.textContent = state.text; subtitle.style.display = 'block'; }
                    else { subtitle.style.display = 'none'; }
                }
            } else { // idle
                fab.classList.remove('listening');
                if (dock) dock.classList.remove('is-listening');
                if (statusEl) statusEl.textContent = 'Pulsa para hablar';
                if (_avatarController) _avatarController.setEmotion('neutral');
                if (subtitle) {
                    setTimeout(() => {
                        if (!_sttHandle || !_sttHandle.isListening()) {
                            subtitle.style.display = 'none';
                            subtitle.textContent = '';
                        }
                    }, 1500);
                }
            }
        }

        // Bloquea el micrófono mientras el avatar habla (TTS) para evitar realimentación.
        function _setAvatarMicSpeaking(speaking) {
            const fab = document.getElementById('btn-avatar-mic');
            const statusEl = document.getElementById('avatar-mic-status');
            if (!fab) return;
            if (speaking) {
                if (_sttHandle) _sttHandle.stop();
                fab.setAttribute('disabled', 'disabled');
                if (statusEl) statusEl.textContent = '🔊 Hablando…';
                _ttsPaused = false;
                _updatePauseBtn();
            } else {
                fab.removeAttribute('disabled');
                if (statusEl) statusEl.textContent = 'Pulsa para hablar';
                _ttsPaused = false;
                _updatePauseBtn();
            }
        }

        // ===== Controles de voz de Ariel (pausar / reanudar / detener el TTS) =====
        function _updatePauseBtn() {
            const btn = document.getElementById('btn-avatar-pause');
            if (!btn) return;
            btn.textContent = _ttsPaused ? '▶' : '⏸';
            btn.title = _ttsPaused ? 'Reanudar la voz' : 'Pausar la voz';
            btn.setAttribute('aria-label', _ttsPaused ? 'Reanudar la voz de Ariel' : 'Pausar la voz de Ariel');
        }

        function _togglePauseSpeech() {
            const synth = window.speechSynthesis;
            const tts = _getTTS();
            if (!synth || !tts) return;
            if (synth.paused) {
                tts.resume();
                _ttsPaused = false;
            } else if (synth.speaking) {
                tts.pause();
                _ttsPaused = true;
            }
            _updatePauseBtn();
        }

        function _stopSpeech() {
            const tts = _getTTS();
            if (tts) tts.stop();
            _ttsPaused = false;
            _updatePauseBtn();
            // La locución terminó: reactivar el micrófono del avatar.
            _setAvatarMicSpeaking(false);
        }

        function configureSTT() {
            const micBtn = document.getElementById('micBtn');
            const transcriptEl = document.getElementById('txtQuestion');
            const statusEl = document.getElementById('status');
            const btnAsk = document.getElementById('btnAsk');            

            const capture = new window.ArcaSTTCapture({
                language: 'es-CR',
                interimResults: true,
                continuous: false
            });

            if (!capture.isSupported()) {
                statusEl.textContent = 'Your browser does not support Speech Recognition 😞';
                micBtn.disabled = true;
                micBtn.style.opacity = 0.5;
            }

            let listening = false;
            const supported = capture.isSupported();
            const stateListeners = [];   // callbacks(state) → { type: 'idle'|'listening'|'interim', text? }
            const notify = (state) => { stateListeners.forEach(cb => { try { cb(state); } catch (_) {} }); };

            // Handle transcription results
            capture.onResult((text, isFinal, meta) => {
                const clean = (text || '').trim();
                // Mostrar texto interino (para el subtítulo en vivo y el input de texto)
                if (transcriptEl) {
                    if (transcriptEl.nodeName.toLowerCase() === 'input') transcriptEl.value = clean;
                    else transcriptEl.textContent = clean;
                }
                notify({ type: 'interim', text: clean });
                if (isFinal) {
                    btnAsk.click();   // auto-envía la pregunta transcrita
                }
            });

            // Handle errors
            capture.onError((code, message) => {
                statusEl.textContent = `Error: ${message}`;
                console.error('Speech Error:', code, message);
                micBtn.classList.remove('listening');
                listening = false;
                notify({ type: 'idle' });
            });

            // Handle end of session
            capture.onEnd(() => {
                listening = false;
                micBtn.classList.remove('listening');
                statusEl.textContent = 'Status: Idle';
                notify({ type: 'idle' });
            });

            function start() {
                if (listening || !supported) return;
                // Anti-feedback: no escuchar mientras el avatar habla (evita oírse a sí mismo)
                if (window.speechSynthesis && window.speechSynthesis.speaking) {
                    window.speechSynthesis.cancel();
                }
                capture.startListening();
                listening = true;
                micBtn.classList.add('listening');
                $(statusEl).show();
                statusEl.textContent = 'Estado: Escuchando...';
                notify({ type: 'listening' });
            }
            function stop() {
                if (!listening) return;
                capture.stopListening();
                listening = false;
                micBtn.classList.remove('listening');
                $(statusEl).hide();
                statusEl.textContent = 'Estado: Detenido';
                notify({ type: 'idle' });
            }

            // El #micBtn del chat y el FAB del avatar comparten esta lógica
            micBtn.addEventListener('click', () => { listening ? stop() : start(); });

            // Handle según condición A/B (Cambio 5)
            // Nota: records.css define `#arcangelRagPanel #micBtn { display: inline-flex !important }`,
            // por lo que hay que usar setProperty con prioridad 'important' para ocultarlo.
            return {
                supported,
                start,
                stop,
                toggle() { listening ? stop() : start(); },
                isListening() { return listening; },
                onStateChange(cb) { if (typeof cb === 'function') stateListeners.push(cb); },
                enable() {
                    if (micBtn) micBtn.style.removeProperty('display'); // deja actuar al CSS (inline-flex)
                },
                disable() {
                    // Detener cualquier escucha y TTS residual al pasar a Condición B
                    try { capture.abortListening(); } catch (_) { /* ignore */ }
                    if (window.speechSynthesis) window.speechSynthesis.cancel();
                    listening = false;
                    if (micBtn) {
                        micBtn.classList.remove('listening');
                        micBtn.style.setProperty('display', 'none', 'important');
                    }
                    $(statusEl).hide();
                    notify({ type: 'idle' });
                }
            };
        }

        async function _initAvatarCanvas() {
            try {
                const canvas = document.getElementById('arcangelAvatarCanvas');
                if (!canvas) return;

                if (_avatarController) {
                    _avatarController.dispose();
                    _avatarController = null;
                }

                // Importación dinámica nativa de ES Modules con cache-buster para forzar actualización de rotación
                const { default: AvatarController } = await import('/js/records/avatar.js?v=1.0.8');
                _avatarController = new AvatarController();
                _avatarController.init(canvas);

                await _avatarController.loadModel(_selectedAvatarUrl);
                console.log('[RAG] Agente Virtual 3D inicializado con éxito');
            } catch (e) {
                console.error('[RAG] Fallo al inicializar el Avatar 3D:', e);
            }
        }

        function destroyDocPanel() {
            $('#arcangelRagPanel').hide();
            if (_avatarController) {
                _avatarController.dispose();
                _avatarController = null;
            }
        }

        // ===== API PÚBLICA =====
        async function showArcangelRAG(base64Pdf, rowData, type) {
            if (type == 'docs') {
                window.ARCA_ELEMENT = rowData.pkDocumentId;
            }
            else {
                window.ARCA_ELEMENT = rowData.pkRecordId;
            }

            _ensurePanelMounted(base64Pdf, rowData.title);
            
            $('#arcangelRagPanel').show();

            _sttHandle = configureSTT();
            // Conectar el indicador del micrófono del avatar al estado del STT
            _sttHandle.onStateChange(_applyAvatarMicState);
            if (!_sttHandle.supported) {
                const fab = document.getElementById('btn-avatar-mic');
                const st = document.getElementById('avatar-mic-status');
                if (fab) fab.setAttribute('disabled', 'disabled');
                if (st) st.textContent = 'Voz no disponible';
            }

            // Aplicar la condición persistida (B por defecto) ahora que el panel está montado
            aplicarModo(_modoConversacional);

            // Calentar el TTS para que las voces del sistema carguen (asíncronas)
            // antes del primer speak() y la heurística de voz por avatar pueda resolver.
            _getTTS();

            _initAvatarCanvas();

            // En modo Avatar (Condición A), Ariel saluda en voz alta al arrancar.
            if (_modoConversacional) _armGreetingSpeech();
        }

        // ===== Chat RAG básico =====
        function _pushUser(text) {
            $('#chatBody').append(`<div class="msg user"></div>`);
            $('#chatBody .msg.user:last').text(text);
            _scrollChatBottom();
        }

        // ===== Limpieza/render del texto que devuelve el RAG (Markdown de ChatGPT) =====

        // Escapa caracteres HTML para evitar inyección (la respuesta viene de un LLM).
        function _escapeHtml(s) {
            return String(s).replace(/[&<>"']/g, c => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            }[c]));
        }

        // Reemplazos inline sobre texto YA escapado: negrita, cursiva y código.
        function _inlineMd(escaped) {
            let s = escaped;
            s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');   // **negrita**
            s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');       // __negrita__
            s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>'); // *cursiva*
            s = s.replace(/`([^`]+)`/g, '<code>$1</code>');            // `código`
            return s;
        }

        // Convierte un subconjunto seguro de Markdown a HTML (párrafos, listas, encabezados).
        // Los marcadores de cita (1)(2) se conservan tal cual en pantalla.
        function _mdToSafeHtml(text) {
            const escaped = _escapeHtml((text || '').trim());
            const lines = escaped.split(/\r?\n/);
            let html = '';
            let inList = false;
            let paraBuf = [];
            const flushPara = () => {
                if (paraBuf.length) { html += '<p>' + _inlineMd(paraBuf.join('<br>')) + '</p>'; paraBuf = []; }
            };
            const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };

            for (const raw of lines) {
                const line = raw.trim();
                const li = line.match(/^[-*]\s+(.*)$/);
                const h = line.match(/^#{1,6}\s+(.*)$/);
                if (line === '') {
                    flushPara(); closeList();
                } else if (li) {
                    flushPara();
                    if (!inList) { html += '<ul>'; inList = true; }
                    html += '<li>' + _inlineMd(li[1]) + '</li>';
                } else if (h) {
                    flushPara(); closeList();
                    html += '<p><strong>' + _inlineMd(h[1]) + '</strong></p>';
                } else {
                    closeList();
                    paraBuf.push(line);
                }
            }
            flushPara(); closeList();
            return html || _inlineMd(escaped);
        }

        // Limpia el texto para el TTS: quita marcadores Markdown y citas (1)(2)
        // para que la voz no lea símbolos. Evita borrar años como (2026) (limita a 1-2 dígitos).
        function _stripForVoice(text) {
            let s = (text || '');
            s = s.replace(/`{1,3}/g, '');             // backticks de código
            s = s.replace(/[*_]{1,3}/g, '');          // marcadores de negrita/cursiva
            s = s.replace(/^#{1,6}\s*/gm, '');        // encabezados
            s = s.replace(/^\s*[-*]\s+/gm, '');       // viñetas de lista
            s = s.replace(/\(\s*\d{1,2}\s*\)/g, '');  // marcadores de cita (1)(2)
            s = s.replace(/[ \t]{2,}/g, ' ');
            s = s.replace(/\s+([.,;:])/g, '$1');       // quita espacios antes de puntuación (residuo de citas)
            s = s.replace(/\n{3,}/g, '\n\n');
            return s.trim();
        }

        // Devuelve (creando si hace falta) el singleton compartido de TTS.
        function _getTTS() {
            if (!window.arcaTTSController) return null;
            if (!window.tts) {
                window.tts = window.arcaTTSController.create({
                    target: '#summarizerResult',
                    floating: true,
                    theme: 'dark',
                    autoShowOnSpeak: false   // Tarea 1: no mostrar la barra .arca-tts-header al hablar Ariel
                });
            }
            return window.tts;
        }

        function audioClickEvent() {
            const tts = _getTTS();
            if (!tts) return;

            const $btn = $(this);
            const isPressed = $btn.attr("aria-pressed") === "true";

            if (isPressed) {
                // 🔇 Turning OFF
                tts.stop();
                $btn.attr("aria-pressed", "false")
                    .removeClass("listening")
                    .attr("aria-label", "Activar comando por voz");
                return;
            }

            // 🔊 Turning ON
            // Texto limpio para voz: guardado en data-voice al renderizar el mensaje.
            // Fallback: innerText del contenido (sin símbolos Markdown ya renderizados).
            const $aiMsg = $btn.closest("div.msg.ai");
            const msgText = ($aiMsg.attr('data-voice')
                || $aiMsg.find('.msg-content').text()
                || '').trim();

            if (!msgText) {
                // nothing to read; keep visual state unchanged
                return;
            }

            tts.speak(msgText, _voiceOptsForAvatar(_selectedAvatarUrl));

            $btn.attr("aria-pressed", "true")
                .addClass("listening")
                .attr("aria-label", "Desactivar comando por voz");
        }

        let latestVoiceBtn = null;
        let voiceShortcutInstalled = false;

        function installVoiceShortcutOnce() {
            if (voiceShortcutInstalled) return;
            voiceShortcutInstalled = true;

            document.addEventListener('keydown', (e) => {
                // Alt+V only (no Ctrl/Meta; allow Shift if you like)
                if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'v') {
                    // ignore when typing
                    const t = e.target;
                    const tag = t.tagName && t.tagName.toLowerCase();
                    if (tag === 'input' || tag === 'textarea' || t.isContentEditable) return;

                    if (latestVoiceBtn) {
                        e.preventDefault();
                        latestVoiceBtn.focus();
                        latestVoiceBtn.click(); // triggers audioClickEvent on that button
                    }
                }
            }, { capture: true });
        }

        function _pushAI(text, links = null) {
            installVoiceShortcutOnce();

            const $msg = $('<div class="msg ai"></div>');
            // Render del Markdown a un subconjunto seguro de HTML (negritas, listas, citas)
            const $content = $('<div class="msg-content"></div>').html(_mdToSafeHtml(text));
            $msg.append($content);
            // Texto limpio para el TTS (sin asteriscos ni marcadores de cita)
            $msg.attr('data-voice', _stripForVoice(text));

            const $audioButtonWrapper = $(`<div><button class="voice-btn" aria-label="Activar Comando por Voz"
                                           accesskey="v" aria-keyshortcuts="Alt+V" type="button"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M11.536 14.01A8.47 8.47 0 0 0 14.026 8a8.47 8.47 0 0 0-2.49-6.01l-.708.707A7.48 7.48 0 0 1 13.025 8c0 2.071-.84 3.946-2.197 5.303z"/><path d="M10.121 12.596A6.48 6.48 0 0 0 12.025 8a6.48 6.48 0 0 0-1.904-4.596l-.707.707A5.48 5.48 0 0 1 11.025 8a5.48 5.48 0 0 1-1.61 3.89z"/><path d="M8.707 11.182A4.5 4.5 0 0 0 10.025 8a4.5 4.5 0 0 0-1.318-3.182L8 5.525A3.5 3.5 0 0 1 9.025 8 3.5 3.5 0 0 1 8 10.475zM6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06z"/></svg></button></div>`);

            const $btn = $audioButtonWrapper.find('button.voice-btn');
            $btn.on('click', audioClickEvent);

            latestVoiceBtn = $btn[0];

            $msg.append($audioButtonWrapper);
            if (links) $msg.append(links);
            $('#chatBody').append($msg);
            _scrollChatBottom();
        }

        function _scrollChatBottom() {
            const el = document.getElementById('chatBody');
            el.scrollTop = el.scrollHeight;
        }

        async function sendRagQuestion(payload) {
            // payload: { developerId, token, element, question, resumeLevel }
            const resp = await $.ajax({
                url: '/api/XPLORErag',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    developerId: payload.developerId,
                    token: payload.token || '',
                    element: payload.element,
                    question: payload.question,
                    resumeLevel: payload.resumeLevel || 0,
                    answer: '',
                    response: null
                })
            });
            // Devuelve ChatMessageModel en resp.response
            if (!resp || !resp.response) throw new Error('Respuesta inválida del servicio.');
            return resp.response;
        }

        function renderRagResponse(chatMessage) {
            const answer = chatMessage.answer || '(Sin respuesta)';
            
            // Cambiar emoción del avatar de forma inteligente según el análisis del texto
            if (_avatarController) {
                const textLower = answer.toLowerCase();
                if (textLower.includes('error') || textLower.includes('fallo') || textLower.includes('no se pudo') || textLower.includes('lo siento') || textLower.includes('disculpa')) {
                    _avatarController.setEmotion('sad');
                } else if (textLower.includes('alerta') || textLower.includes('peligro') || textLower.includes('atención') || textLower.includes('importante') || textLower.includes('cuidado')) {
                    _avatarController.setEmotion('surprised');
                } else if (textLower.includes('exitoso') || textLower.includes('correcto') || textLower.includes('completado') || textLower.includes('sí') || textLower.includes('gracias') || textLower.includes('perfecto')) {
                    _avatarController.setEmotion('happy');
                } else {
                    _avatarController.setEmotion('neutral');
                }
            }

            let linksHtml = '';

            if (chatMessage.referenceLinks?.length) {
                const $links = $('<div class="ref-links"></div>');
                chatMessage.referenceLinks.forEach(ref => {
                    const $btn = $(`<button class="k-button k-button-sm k-rounded-md k-button-outline">${kendo.htmlEncode(ref.displayText || 'Referencia')}</button>`);
                    $btn.on('click', () => {
                        var pageRequest = {
                            pkDocumentId: ref.documentId,
                            pageNumber: ref.page,
                            entireDocument: true
                        }

                        $.ajax({
                            url: '/api/RecordsByUser/XPLOREPageByDocumentId',
                            contentType: 'application/json',
                            type: 'POST',
                            data: JSON.stringify(pageRequest),
                            success: function (response) {
                                try {
                                    window.dhLoadBase64(response.data);
                                    $("#tbPgNumber").val(ref.page);
                                } catch (e) {
                                    console.error('Error parsing response JSON:', e);
                                    return;
                                }
                            }
                        });
                    });
                    $links.append($btn);
                });
                // pass the actual DOM, not outerHTML
                _pushAI(answer, $links);
            } else {
                _pushAI(answer);
            }

            // TTS automático sólo en Condición A (Cambio 3).
            // El lip-sync del avatar se anima solo observando speechSynthesis.speaking.
            if (_ttsAutomatico) {
                const tts = _getTTS();
                if (tts) {
                    // Anti-feedback: bloquear el micrófono mientras el avatar habla
                    _setAvatarMicSpeaking(true);
                    Promise.resolve(tts.speak(_stripForVoice(answer), _voiceOptsForAvatar(_selectedAvatarUrl))).finally(() => _setAvatarMicSpeaking(false));
                }
            }
        }

        // Exponer API pública
        return {
            showArcangelRAG
        };
    })(jQuery, kendo);
}
