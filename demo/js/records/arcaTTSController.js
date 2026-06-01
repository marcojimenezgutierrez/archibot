/*
 * arcaTTSController.js
 *
 * This module defines a singleton text‑to‑speech controller designed to be
 * embedded into web applications.  It leverages the Web Speech API to
 * synthesise speech from text and provides a small, elegant user interface
 * that can either be docked into a specified container or displayed as a
 * floating, draggable window.  All primary functionality is accessed
 * through a global factory exposed as `arcaTTSController.create()`.
 *
 * Features:
 *  - Speak arbitrary text or extract and speak the innerText from a DOM
 *    element via `speakFrom(selector)`.
 *  - Configurable speech parameters: language, voice, rate, pitch and volume.
 *  - Persists user preferences (language, voice, rate, pitch, volume,
 *    theme and floating window position) to localStorage.
 *  - Supports light and dark themes with easily customisable CSS variables.
 *  - Offers an optional advanced panel to adjust all speech parameters
 *    interactively.
 *  - Falls back to a floating window if docking to the target container
 *    is not possible.
 *  - Enforces a single instance per page. Calling `create()` multiple
 *    times returns the same controller.
 *
 * Usage example:
 *   <script src="path/to/arcaTTSController.js"></script>
 *   <link rel="stylesheet" href="path/to/arcaTTSController.css">
 *   <script>
 *     const tts = arcaTTSController.create({ target: '#dock' });
 *     document.querySelector('#readBtn').onclick = () => {
 *       tts.show();
 *       tts.speakFrom('#textToRead');
 *     };
 *   </script>
 */

(() => {
    // Prevent redefining the factory if this script is loaded multiple times.
    if (window.arcaTTSController && window.arcaTTSController.create) return;

    /**
     * Default cultures presented in the language selector.  The labels are
     * human friendly and grouped by the primary language code.  You can
     * customise this list to suit your application; it does not depend
     * on the available voices and therefore remains stable across
     * different browsers.
     */
    const CULTURES = [
        { label: 'Español (Costa Rica)', value: 'es-CR' },
        { label: 'Español (México)', value: 'es-MX' },
        { label: 'Español (España)', value: 'es-ES' },
        { label: 'Español (Argentina)', value: 'es-AR' },
        { label: 'English (United States)', value: 'en-US' },
        { label: 'English (United Kingdom)', value: 'en-GB' },
        { label: 'Português (Brasil)', value: 'pt-BR' },
        { label: 'Português (Portugal)', value: 'pt-PT' },
        { label: 'Français (France)', value: 'fr-FR' },
        { label: 'Deutsch (Deutschland)', value: 'de-DE' }
    ];

    /** Local storage key used to persist controller state. */
    const STORAGE_KEY = 'arcaTTSController:v1';

    /** Helper: group cultures by their base language (prefix before dash). */
    function groupCultures(list) {
        const groups = {};
        list.forEach(item => {
            const base = item.value.split('-')[0];
            if (!groups[base]) groups[base] = [];
            groups[base].push(item);
        });
        return groups;
    }

    /**
     * Persist an object to localStorage.  We wrap in try/catch because
     * certain environments (incognito, sandboxed) may disallow localStorage.
     */
    function saveToStorage(obj) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
        } catch (err) {
            // Fails silently if storage is unavailable.
        }
    }

    /** Retrieve persisted state from localStorage, or an empty object. */
    function loadFromStorage() {
        try {
            const text = localStorage.getItem(STORAGE_KEY);
            if (text) return JSON.parse(text);
        } catch (err) { }
        return {};
    }

    /**
     * The Controller class encapsulates all logic for speaking text and
     * managing the user interface.  Instances are created through the
     * factory returned by arcaTTSController.create().  Only one instance
     * may exist at a time; repeated calls to create() will return the
     * existing instance.
     */
    class Controller {
        constructor(options) {
            // Merge defaults with user options and persisted state.
            const persisted = loadFromStorage();
            this.opts = Object.assign({
                target: null,
                floating: false,
                advancedControls: 'auto',
                defaultLang: 'es-CR',
                defaultRate: 1.0,
                defaultPitch: 1.0,
                defaultVolume: 1.0,
                theme: persisted.theme || 'dark',
                persist: true,
                zIndex: 9999,
                onReady: null,
                onStart: null,
                onEnd: null,
                onError: null,
                onVoicesReady: null,
                /**
                 * If true, the UI is automatically shown when speak() or
                 * speakFrom() is invoked.  This helps ensure that controls are
                 * visible to the user on the first use.  Developers can set
                 * this to false to require explicit calls to show().
                 */
                autoShowOnSpeak: true,
                /**
                 * Global highlight settings.  May be a boolean (true/false) or
                 * an object with `enabled` and `color` fields.  When enabled,
                 * speakFrom() will highlight the current word within the
                 * element being read.  The default highlight colour is a
                 * pastel yellow (#fff3a6).
                 */
                highlight: { enabled: true, color: '#fff3a6' },
            }, options || {});

            // Internal state variables.
            this.voices = [];
            this.voiceByName = new Map();
            this.lang = persisted.lang || this.opts.defaultLang;
            this.voiceName = persisted.voiceName || null;
            this.rate = typeof persisted.rate === 'number' ? persisted.rate : this.opts.defaultRate;
            this.pitch = typeof persisted.pitch === 'number' ? persisted.pitch : this.opts.defaultPitch;
            this.volume = typeof persisted.volume === 'number' ? persisted.volume : this.opts.defaultVolume;
            this.theme = persisted.theme || this.opts.theme;
            this.position = persisted.position || null;
            this.isSpeakingFlag = false;
            this.queue = [];
            this.currentUtterance = null;
            this.dragging = false;

            // Initialise highlight configuration.  Persisted values take
            // precedence over options; otherwise fall back to options or
            // defaults.  Accept boolean or object for highlight in options.
            const optHighlight = this.opts.highlight;
            let defaultHighlightEnabled = true;
            let defaultHighlightColor = '#fff3a6';
            if (typeof optHighlight === 'boolean') {
                defaultHighlightEnabled = optHighlight;
            } else if (typeof optHighlight === 'object' && optHighlight) {
                if (typeof optHighlight.enabled === 'boolean') {
                    defaultHighlightEnabled = optHighlight.enabled;
                }
                if (typeof optHighlight.color === 'string') {
                    defaultHighlightColor = optHighlight.color;
                }
            }
            this.highlight = {
                enabled: (persisted.highlightEnabled !== undefined ? persisted.highlightEnabled : defaultHighlightEnabled),
                color: (persisted.highlightColor || defaultHighlightColor)
            };

            this._buildUI();
            this._initVoices();
            this._restorePreferences();
        }

        /**
         * Build the user interface and insert it into the DOM.  If the target
         * container exists and floating mode is not forced, the UI will be
         * appended there; otherwise it will be created as a floating window.
         */
        _buildUI() {
            // Create root element for the control.  We apply a unique class to
            // avoid conflicts with host page styles.  Additional classes are
            // added to reflect theme and floating state.
            this.root = document.createElement('div');
            this.root.className = 'arca-tts';
            this.root.setAttribute('data-theme', this.theme === 'light' ? 'light' : 'dark');
            // Set highlight colour as a CSS variable.  This is updated later
            // through setHighlight() and persisted preferences.
            if (this.highlight) {
                this.root.style.setProperty('--tts-highlight-color', this.highlight.color);
            }

            // Build header (play/pause, stop, voice name, advanced toggle).
            const header = document.createElement('div');
            header.className = 'arca-tts-header';
            this.root.appendChild(header);

            // Play/Pause button.
            this.btnPlayPause = document.createElement('button');
            this.btnPlayPause.type = 'button';
            this.btnPlayPause.className = 'arca-tts-btn arca-tts-play';
            this.btnPlayPause.title = 'Reproducir/Pausar';
            this.btnPlayPause.textContent = '▶';
            header.appendChild(this.btnPlayPause);

            // Stop button.
            this.btnStop = document.createElement('button');
            this.btnStop.type = 'button';
            this.btnStop.className = 'arca-tts-btn arca-tts-stop';
            this.btnStop.title = 'Detener';
            this.btnStop.textContent = '■';
            header.appendChild(this.btnStop);

            // Display name of current voice/language.
            this.voiceLabel = document.createElement('span');
            this.voiceLabel.className = 'arca-tts-voice-label';
            this.voiceLabel.textContent = '';
            header.appendChild(this.voiceLabel);

            // Advanced controls toggle.
            this.btnAdvToggle = document.createElement('button');
            this.btnAdvToggle.type = 'button';
            this.btnAdvToggle.className = 'arca-tts-btn arca-tts-adv-toggle';
            this.btnAdvToggle.title = 'Controles avanzados';
            this.btnAdvToggle.textContent = '⋯';
            header.appendChild(this.btnAdvToggle);

            // Advanced controls toggle.
            this.btnAdvClose = document.createElement('button');
            this.btnAdvClose.type = 'button';
            this.btnAdvClose.className = 'arca-tts-btn arca-tts-adv-close';
            this.btnAdvClose.title = 'Cerrar';
            this.btnAdvClose.textContent = 'X';
            header.appendChild(this.btnAdvClose);

            // Advanced panel (hidden by default).
            this.advPanel = document.createElement('div');
            this.advPanel.className = 'arca-tts-adv';
            this.advPanel.style.display = 'none';
            this.root.appendChild(this.advPanel);

            // Build advanced controls: language select, voice select, rate, pitch, volume, theme.
            // Language selector (cultures grouped).
            const langGroup = document.createElement('div');
            langGroup.className = 'arca-tts-field';
            const langLabel = document.createElement('label');
            langLabel.textContent = 'Idioma';
            langGroup.appendChild(langLabel);
            this.selectLang = document.createElement('select');
            this.selectLang.className = 'arca-tts-select';
            langGroup.appendChild(this.selectLang);
            this.advPanel.appendChild(langGroup);

            // Voice selector (populated once voices are loaded).
            const voiceGroup = document.createElement('div');
            voiceGroup.className = 'arca-tts-field';
            const voiceLabel = document.createElement('label');
            voiceLabel.textContent = 'Voz';
            voiceGroup.appendChild(voiceLabel);
            this.selectVoice = document.createElement('select');
            this.selectVoice.className = 'arca-tts-select';
            voiceGroup.appendChild(this.selectVoice);
            this.advPanel.appendChild(voiceGroup);

            // Rate slider.
            const rateGroup = document.createElement('div');
            rateGroup.className = 'arca-tts-field';
            const rateLabel = document.createElement('label');
            rateLabel.textContent = 'Velocidad';
            rateGroup.appendChild(rateLabel);
            this.rangeRate = document.createElement('input');
            this.rangeRate.type = 'range';
            this.rangeRate.min = '0.5';
            this.rangeRate.max = '2';
            this.rangeRate.step = '0.1';
            this.rangeRate.value = String(this.rate);
            this.rangeRate.className = 'arca-tts-range';
            rateGroup.appendChild(this.rangeRate);
            this.advPanel.appendChild(rateGroup);

            // Pitch slider.
            const pitchGroup = document.createElement('div');
            pitchGroup.className = 'arca-tts-field';
            const pitchLabel = document.createElement('label');
            pitchLabel.textContent = 'Tono';
            pitchGroup.appendChild(pitchLabel);
            this.rangePitch = document.createElement('input');
            this.rangePitch.type = 'range';
            this.rangePitch.min = '0';
            this.rangePitch.max = '2';
            this.rangePitch.step = '0.1';
            this.rangePitch.value = String(this.pitch);
            this.rangePitch.className = 'arca-tts-range';
            pitchGroup.appendChild(this.rangePitch);
            this.advPanel.appendChild(pitchGroup);

            // Volume slider.
            const volumeGroup = document.createElement('div');
            volumeGroup.className = 'arca-tts-field';
            const volumeLabel = document.createElement('label');
            volumeLabel.textContent = 'Volumen';
            volumeGroup.appendChild(volumeLabel);
            this.rangeVolume = document.createElement('input');
            this.rangeVolume.type = 'range';
            this.rangeVolume.min = '0';
            this.rangeVolume.max = '1';
            this.rangeVolume.step = '0.1';
            this.rangeVolume.value = String(this.volume);
            this.rangeVolume.className = 'arca-tts-range';
            volumeGroup.appendChild(this.rangeVolume);
            this.advPanel.appendChild(volumeGroup);

            // Theme selector.
            const themeGroup = document.createElement('div');
            themeGroup.className = 'arca-tts-field';
            const themeLabel = document.createElement('label');
            themeLabel.textContent = 'Tema';
            themeGroup.appendChild(themeLabel);
            this.selectTheme = document.createElement('select');
            this.selectTheme.className = 'arca-tts-select';
            const optDark = document.createElement('option');
            optDark.value = 'dark';
            optDark.textContent = 'Oscuro';
            this.selectTheme.appendChild(optDark);
            const optLight = document.createElement('option');
            optLight.value = 'light';
            optLight.textContent = 'Claro';
            this.selectTheme.appendChild(optLight);
            this.selectTheme.value = this.theme;
            themeGroup.appendChild(this.selectTheme);
            this.advPanel.appendChild(themeGroup);

            // Determine where to attach the root element: docked or floating.
            let dock = null;
            if (!this.opts.floating && this.opts.target) {
                const container = typeof this.opts.target === 'string'
                    ? document.querySelector(this.opts.target)
                    : this.opts.target;
                if (container) dock = container;
            }
            if (dock) {
                dock.appendChild(this.root);
                this.root.classList.add('arca-tts-docked');
            } else {
                // Floating: position fixed; allow dragging; restore previous position if any.
                this.root.classList.add('arca-tts-float');
                this.root.style.position = 'fixed';
                this.root.style.zIndex = String(this.opts.zIndex);
                if (this.position) {
                    this.root.style.left = this.position.x + 'px';
                    this.root.style.top = this.position.y + 'px';
                } else {
                    this.root.style.right = '20px';
                    this.root.style.top = '20px';
                }
                document.body.appendChild(this.root);
                // Attach drag listeners to header.
                this._enableDrag(header);
            }

            // Attach event listeners for UI controls.
            this.btnPlayPause.addEventListener('click', () => this._handlePlayPause());
            this.btnStop.addEventListener('click', () => this.stop());
            this.btnAdvToggle.addEventListener('click', () => this.toggleAdvanced());
            this.btnAdvClose.addEventListener('click', () => this.toggleClose());

            this.rangeRate.addEventListener('input', () => {
                this.rate = parseFloat(this.rangeRate.value);
                this._persist();
            });
            this.rangePitch.addEventListener('input', () => {
                this.pitch = parseFloat(this.rangePitch.value);
                this._persist();
            });
            this.rangeVolume.addEventListener('input', () => {
                this.volume = parseFloat(this.rangeVolume.value);
                this._persist();
            });
            this.selectTheme.addEventListener('change', () => {
                this.theme = this.selectTheme.value;
                this.root.setAttribute('data-theme', this.theme);
                this._persist();
            });
            this.selectLang.addEventListener('change', () => {
                this.setLang(this.selectLang.value);
            });
            this.selectVoice.addEventListener('change', () => {
                this.setVoiceByName(this.selectVoice.value);
            });

            // Hide UI initially; user must call show().
            this.root.style.display = 'none';
        }

        /**
         * Enable dragging of the floating window by clicking on the header.
         * Only applies when the controller is floating.
         */
        _enableDrag(handle) {
            let offsetX = 0;
            let offsetY = 0;
            const onMouseDown = (e) => {
                if (e.button !== 0) return;
                this.dragging = true;
                const rect = this.root.getBoundingClientRect();
                // offset from the top-left corner where the user clicked
                offsetX = e.clientX - rect.left;
                offsetY = e.clientY - rect.top;
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            };
            const onMouseMove = (e) => {
                if (!this.dragging) return;
                e.preventDefault();
                const x = e.clientX - offsetX;
                const y = e.clientY - offsetY;
                this.root.style.left = x + 'px';
                this.root.style.top = y + 'px';
            };
            const onMouseUp = () => {
                if (this.dragging) {
                    this.dragging = false;
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    // Persist position
                    const rect = this.root.getBoundingClientRect();
                    this.position = { x: rect.left, y: rect.top };
                    this._persist();
                }
            };
            handle.style.cursor = 'move';
            handle.addEventListener('mousedown', onMouseDown);
        }

        /**
         * Initialise voices from the speechSynthesis API.  Voices load
         * asynchronously; this method will poll for them and resolve once
         * available, or after a timeout.  Once voices are loaded the
         * language/voice selectors and labels are populated.
         */
        _initVoices() {
            const synth = window.speechSynthesis;
            if (!synth) {
                this._notifyError({ code: 'no-speech-synthesis' });
                return;
            }
            const populate = () => {
                this.voices = synth.getVoices();
                if (this.voices.length === 0) return false;
                this.voiceByName.clear();
                this.voices.forEach(v => this.voiceByName.set(v.name, v));
                this._populateLangSelect();
                this._populateVoiceSelect();
                this._updateVoiceLabel();
                if (typeof this.opts.onVoicesReady === 'function') {
                    this.opts.onVoicesReady(this.voices.slice());
                }
                if (typeof this.opts.onReady === 'function') {
                    this.opts.onReady();
                }
                return true;
            };
            // Immediately try to populate voices; voices may already be loaded.
            if (populate()) return;
            // If not loaded, wait for voiceschanged event.
            synth.onvoiceschanged = () => {
                populate();
            };
            // Also poll for voices in case voiceschanged doesn't fire (Firefox).
            let attempts = 0;
            const timer = setInterval(() => {
                if (populate() || attempts++ > 20) clearInterval(timer);
            }, 200);
        }

        /** Populate the language selector with groups derived from the
         * predefined cultures list.  Select the current language.
         */
        _populateLangSelect() {
            this.selectLang.innerHTML = '';
            const groups = groupCultures(CULTURES);
            Object.keys(groups).forEach(base => {
                const optgroup = document.createElement('optgroup');
                // Use a friendly label for the language if possible.
                const languageNames = {
                    es: 'Español',
                    en: 'English',
                    pt: 'Português',
                    fr: 'Français',
                    de: 'Deutsch'
                };
                optgroup.label = languageNames[base] || base;
                groups[base].forEach(item => {
                    const option = document.createElement('option');
                    option.value = item.value;
                    option.textContent = item.label + ' — ' + item.value;
                    optgroup.appendChild(option);
                });
                this.selectLang.appendChild(optgroup);
            });
            this.selectLang.value = this.lang;
        }

        /** Populate the voice selector with voices filtered by the current
         * language.  If no voices match the selected language, show all voices.
         */
        _populateVoiceSelect() {
            const langPrefix = this.lang.toLowerCase();
            this.selectVoice.innerHTML = '';
            let matching = this.voices.filter(v => v.lang && v.lang.toLowerCase().startsWith(langPrefix));
            if (matching.length === 0) matching = this.voices.slice();
            matching.forEach(v => {
                const option = document.createElement('option');
                option.value = v.name;
                option.textContent = `${v.name} — ${v.lang}`;
                this.selectVoice.appendChild(option);
            });
            if (this.voiceName) {
                this.selectVoice.value = this.voiceName;
            } else if (matching.length > 0) {
                this.voiceName = matching[0].name;
                this.selectVoice.value = this.voiceName;
            }
        }

        /** Update the label in the header to reflect the current voice and language. */
        _updateVoiceLabel() {
            const voice = this.voiceByName.get(this.voiceName);
            const name = voice ? voice.name : '';
            const lang = this.lang;
            this.voiceLabel.textContent = name ? `${name} (${lang})` : lang;
        }

        /** Persist the current configuration to localStorage if persistence is enabled. */
        _persist() {
            if (!this.opts.persist) return;
            const data = {
                lang: this.lang,
                voiceName: this.voiceName,
                rate: this.rate,
                pitch: this.pitch,
                volume: this.volume,
                theme: this.theme,
                position: this.position
            };
            // Include highlight settings in persisted data.
            if (this.highlight) {
                data.highlightEnabled = this.highlight.enabled;
                data.highlightColor = this.highlight.color;
            }
            saveToStorage(data);
        }

        /** Restore persisted preferences into the UI controls. */
        _restorePreferences() {
            this.selectTheme.value = this.theme;
            this.root.setAttribute('data-theme', this.theme);
            // Apply highlight colour to CSS variable on the root element.
            if (this.highlight && this.root) {
                this.root.style.setProperty('--tts-highlight-color', this.highlight.color);
            }
        }

        /**
         * Return true if there is any speech currently ongoing.
         */
        isSpeaking() {
            return this.isSpeakingFlag;
        }

        /**
         * Speak the provided text.  Options may override language, voice,
         * rate, pitch, volume and whether to interrupt the current speech.
         *
         * @param {string} text - The text to speak.
         * @param {Object} [opts] - Optional speech overrides.
         */
        speak(text, opts = {}) {
            // Show the UI automatically if configured.
            if (this.opts.autoShowOnSpeak) {
                this.show();
            }
            if (!window.speechSynthesis) {
                this._notifyError({ code: 'no-speech-synthesis' });
                return Promise.resolve();
            }
            // Merge global settings with overrides.
            const settings = {
                lang: opts.lang || this.lang,
                voiceName: opts.voiceName || this.voiceName,
                rate: typeof opts.rate === 'number' ? opts.rate : this.rate,
                pitch: typeof opts.pitch === 'number' ? opts.pitch : this.pitch,
                volume: typeof opts.volume === 'number' ? opts.volume : this.volume,
                interrupt: opts.interrupt !== false // default true
            };
            // Cancel current speech if interrupting.
            if (settings.interrupt) {
                this.stop();
            }
            // Split long text into chunks to avoid timeouts in some browsers.
            const chunks = this._chunkText(text);
            const synth = window.speechSynthesis;
            return new Promise((resolve) => {
                const speakChunk = (index) => {
                    if (index >= chunks.length) {
                        this.isSpeakingFlag = false;
                        if (typeof this.opts.onEnd === 'function') this.opts.onEnd();
                        return resolve();
                    }
                    const utter = new SpeechSynthesisUtterance(chunks[index]);
                    this.currentUtterance = utter;
                    // Apply settings.
                    utter.lang = settings.lang;
                    const voice = this.voiceByName.get(settings.voiceName);
                    if (voice) utter.voice = voice;
                    utter.rate = settings.rate;
                    utter.pitch = settings.pitch;
                    utter.volume = settings.volume;
                    utter.onstart = () => {
                        this.isSpeakingFlag = true;
                        this.btnPlayPause.textContent = '⏸';
                        if (typeof this.opts.onStart === 'function') this.opts.onStart();
                    };
                    utter.onend = () => {
                        // Delay to allow event queue to flush before starting next.
                        this.isSpeakingFlag = false;
                        this.btnPlayPause.textContent = '▶';
                        speakChunk(index + 1);
                    };
                    utter.onerror = (e) => {
                        this.isSpeakingFlag = false;
                        this._notifyError({ code: 'synthesis-error', detail: e });
                        this.btnPlayPause.textContent = '▶';
                        speakChunk(index + 1);
                    };
                    synth.speak(utter);
                };
                speakChunk(0);
            });
        }

        /**
         * Break text into smaller pieces.  This implementation splits on
         * sentences and paragraphs while preserving punctuation.  It helps
         * prevent truncated utterances in some browsers.
         */
        _chunkText(text) {
            // Trim and collapse whitespace.
            const cleaned = text.replace(/\s+/g, ' ').trim();
            if (cleaned.length < 200) return [cleaned];
            const sentences = cleaned.match(/[^.!?]+[.!?]?/g) || [cleaned];
            const chunks = [];
            let current = '';
            sentences.forEach(sent => {
                if ((current + sent).length > 200) {
                    if (current) {
                        chunks.push(current.trim());
                        current = '';
                    }
                }
                current += sent + ' ';
            });
            if (current.trim()) chunks.push(current.trim());
            return chunks;
        }

        /**
         * Speak the innerText content of a DOM element specified by a selector.
         * This method supports per-call overrides and highlight settings.
         * If autoShowOnSpeak is true, the UI will be displayed when this
         * method is invoked.
         *
         * @param {string} selector - A CSS selector targeting the element.
         * @param {Object} [opts] - Optional speech overrides.
         */
        speakFrom(selector, opts = {}) {
            // Ensure the UI is visible if configured to do so.
            if (this.opts.autoShowOnSpeak) {
                this.show();
            }
            const el = document.querySelector(selector);
            if (!el) {
                this._notifyError({ code: 'source-not-found', detail: selector });
                return;
            }
            const text = el.innerText || el.textContent || '';
            if (!text.trim()) {
                this._notifyError({ code: 'source-not-found', detail: selector });
                return;
            }
            // Determine highlight configuration for this invocation.  The
            // options passed to speakFrom() override the global highlight
            // settings.  Accept boolean or object.
            let localHighlight = { enabled: this.highlight.enabled, color: this.highlight.color };
            if (opts && Object.prototype.hasOwnProperty.call(opts, 'highlight')) {
                const h = opts.highlight;
                if (typeof h === 'boolean') {
                    localHighlight.enabled = h;
                } else if (typeof h === 'object' && h) {
                    if (typeof h.enabled === 'boolean') localHighlight.enabled = h.enabled;
                    if (typeof h.color === 'string') localHighlight.color = h.color;
                }
            }
            // Build settings from opts and defaults.
            const settings = {
                lang: opts.lang || this.lang,
                voiceName: opts.voiceName || this.voiceName,
                rate: typeof opts.rate === 'number' ? opts.rate : this.rate,
                pitch: typeof opts.pitch === 'number' ? opts.pitch : this.pitch,
                volume: typeof opts.volume === 'number' ? opts.volume : this.volume,
                interrupt: opts.interrupt !== false // default true
            };
            // If highlight is enabled, perform specialised speaking to
            // support highlighting the current word.
            if (localHighlight.enabled) {
                // Interrupt current speech if requested.
                if (settings.interrupt) this.stop();
                // Prepare highlight data.
                this._prepareHighlight(el, text, localHighlight.color);
                // Speak the entire text in a single utterance so that
                // charIndex corresponds to the full text.
                const utter = new SpeechSynthesisUtterance(text);
                utter.lang = settings.lang;
                const voice = this.voiceByName.get(settings.voiceName);
                if (voice) utter.voice = voice;
                utter.rate = settings.rate;
                utter.pitch = settings.pitch;
                utter.volume = settings.volume;
                utter.onstart = () => {
                    this.isSpeakingFlag = true;
                    this.btnPlayPause.textContent = '⏸';
                    this._renderHighlightAt(0);
                    if (typeof this.opts.onStart === 'function') this.opts.onStart();
                };
                utter.onboundary = (event) => {
                    const idx = event && typeof event.charIndex === 'number' ? event.charIndex : 0;
                    this._renderHighlightAt(idx);
                };
                utter.onend = () => {
                    this.isSpeakingFlag = false;
                    this.btnPlayPause.textContent = '▶';
                    this._clearHighlight();
                    if (typeof this.opts.onEnd === 'function') this.opts.onEnd();
                };
                utter.onerror = (e) => {
                    this.isSpeakingFlag = false;
                    this.btnPlayPause.textContent = '▶';
                    this._clearHighlight();
                    this._notifyError({ code: 'synthesis-error', detail: e });
                };
                // Speak it.
                window.speechSynthesis.speak(utter);
                return;
            }
            // Otherwise use the regular speak() implementation.
            return this.speak(text, opts);
        }

        /** Pause speech if currently speaking. */
        pause() {
            if (window.speechSynthesis && window.speechSynthesis.speaking) {
                window.speechSynthesis.pause();
                this.btnPlayPause.textContent = '▶';
            }
        }

        /** Resume paused speech. */
        resume() {
            if (window.speechSynthesis && window.speechSynthesis.paused) {
                window.speechSynthesis.resume();
                this.btnPlayPause.textContent = '⏸';
            }
        }

        /** Stop any ongoing speech and clear the queue. */
        stop() {
            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
                this.isSpeakingFlag = false;
                this.btnPlayPause.textContent = '▶';
            }
        }

        /** Show the controller UI. */
        show() {
            this.root.style.display = '';
        }

        /** Hide the controller UI. */
        hide() {
            this.root.style.display = 'none';
        }

        /** Toggle the controller UI visibility. */
        toggle() {
            const hidden = this.root.style.display === 'none' || this.root.style.display === '' && this.root.hasAttribute('hidden');
            this.root.style.display = hidden ? '' : 'none';
        }

        /** Show the advanced controls panel. */
        openAdvanced() {
            this.advPanel.style.display = '';
        }

        /** Hide the advanced controls panel. */
        closeAdvanced() {
            this.advPanel.style.display = 'none';
        }

        /** Toggle advanced panel based on current visibility and configuration. */
        toggleAdvanced() {
            const isVisible = this.advPanel.style.display !== 'none';
            if (isVisible) {
                this.closeAdvanced();
            } else {
                this.openAdvanced();
            }
        }

        /** close the controler **/
        toggleClose() {
            this.root.style.display = 'none';
            this.stop();
        }

        /** Update the selected language and repopulate the voice list. */
        setLang(code) {
            this.lang = code;
            this.selectLang.value = code;
            this._populateVoiceSelect();
            this._updateVoiceLabel();
            this._persist();
        }

        /** Select a voice by its name.  Returns true if the voice exists. */
        setVoiceByName(name) {
            if (this.voiceByName.has(name)) {
                this.voiceName = name;
                this.selectVoice.value = name;
                this._updateVoiceLabel();
                this._persist();
                return true;
            }
            return false;
        }

        /** Set speech rate. */
        setRate(value) {
            this.rate = value;
            this.rangeRate.value = String(value);
            this._persist();
        }

        /** Set pitch. */
        setPitch(value) {
            this.pitch = value;
            this.rangePitch.value = String(value);
            this._persist();
        }

        /** Set volume. */
        setVolume(value) {
            this.volume = value;
            this.rangeVolume.value = String(value);
            this._persist();
        }

        /** Retrieve all available voices. */
        getVoices() {
            return this.voices.slice();
        }

        /** Notify an error through callback and console for debugging. */
        _notifyError(info) {
            if (typeof this.opts.onError === 'function') {
                this.opts.onError(info);
            }
            // Console log for development; silent in production if desired.
            console.warn('arcaTTSController error:', info);
        }

        /** Destroy this controller: remove DOM elements and listeners. */
        destroy() {
            this.stop();
            if (this.root && this.root.parentNode) {
                this.root.parentNode.removeChild(this.root);
            }
            // Remove global instance.
            if (window.arcaTTSController._instance === this) {
                window.arcaTTSController._instance = null;
            }
        }

        /**
         * Update highlight configuration at runtime.  Accepts a boolean or an
         * object with enabled and/or color properties.  Setting a new colour
         * updates the CSS variable on the root element.
         *
         * @param {boolean|Object} h - New highlight settings.
         */
        setHighlight(h) {
            if (typeof h === 'boolean') {
                this.highlight.enabled = h;
            } else if (typeof h === 'object' && h) {
                if (typeof h.enabled === 'boolean') this.highlight.enabled = h.enabled;
                if (typeof h.color === 'string') this.highlight.color = h.color;
            }
            // Reflect the highlight colour in CSS.
            if (this.root && this.highlight.color) {
                this.root.style.setProperty('--tts-highlight-color', this.highlight.color);
            }
            this._persist();
        }

        /**
         * Compute an array of word boundaries for highlighting.  Each entry
         * has properties {start, end}.  Words are sequences of non-space
         * characters.  Used to map charIndex to the current word.
         *
         * @param {string} text - Plain text to analyse.
         * @returns {Array<{start:number,end:number}>}
         */
        _buildWordMap(text) {
            const map = [];
            const re = /\S+/g;
            let m;
            while ((m = re.exec(text)) !== null) {
                map.push({ start: m.index, end: m.index + m[0].length });
            }
            return map;
        }

        /**
         * Prepare the highlighting state for a given element and text.  This
         * stores the original HTML, the plain text, the word map and the
         * desired highlight colour.
         *
         * @param {HTMLElement} el
         * @param {string} text
         * @param {string} colour
         */
        _prepareHighlight(el, text, colour) {
            this._highlight = {
                el: el,
                originalHTML: el.innerHTML,
                text: text,
                map: this._buildWordMap(text),
                colour: colour || this.highlight.color
            };
        }

        /**
         * Render highlight at the given character index.  If the index
         * exceeds the text length, highlight the last word.  The HTML
         * structure of the element is replaced with escaped text and
         * a span around the current word.  Colour is taken from the
         * stored highlight data.
         *
         * @param {number} charIndex
         */
        _renderHighlightAt(charIndex) {
            const hd = this._highlight;
            if (!hd || !hd.el) return;
            const idx = Math.max(0, Math.min(charIndex, hd.text.length));
            // Find the word containing the index.
            let target = hd.map.length ? hd.map.length - 1 : 0;
            for (let i = 0; i < hd.map.length; i++) {
                const w = hd.map[i];
                if (idx >= w.start && idx < w.end) { target = i; break; }
                if (idx < w.start) { target = i; break; }
            }
            const w = hd.map[target] || { start: 0, end: hd.text.length };
            const before = hd.text.slice(0, w.start);
            const word = hd.text.slice(w.start, w.end);
            const after = hd.text.slice(w.end);
            // Escape HTML special characters.
            const esc = (s) => s.replace(/[&<>"']/g, c => {
                const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
                return map[c] || c;
            });
            const html = esc(before) + '<span class="tts-current" style="background:' + hd.colour + ';">' + esc(word) + '</span>' + esc(after);
            hd.el.innerHTML = html;
        }

        /**
         * Clear the current highlight, restoring the element's original
         * innerHTML and clearing the highlight state.
         */
        _clearHighlight() {
            const hd = this._highlight;
            if (hd && hd.el) {
                hd.el.innerHTML = hd.originalHTML;
            }
            this._highlight = null;
        }

        /** Handle play/pause button behaviour: resume if paused, otherwise
         * toggle between starting a new speech (which requires separate
         * invocation of speak or speakFrom) and pausing an ongoing speech.
         */
        _handlePlayPause() {
            const synth = window.speechSynthesis;
            if (!synth) {
                this._notifyError({ code: 'no-speech-synthesis' });
                return;
            }
            if (synth.speaking) {
                if (synth.paused) {
                    this.resume();
                } else {
                    this.pause();
                }
            } else {
                // No text queued; in practise this button does not know what to read.
                // Developers should call speak() or speakFrom() explicitly.
            }
        }
    }

    /**
     * Factory function exposed as arcaTTSController.create().  Ensures
     * singleton semantics: repeated calls will return the same instance.
     */
    function createController(opts) {
        if (createController._instance) return createController._instance;
        const ctrl = new Controller(opts);
        createController._instance = ctrl;
        return ctrl;
    }
    createController._instance = null;

    // Expose the factory globally.
    window.arcaTTSController = {
        create: createController
    };
})();