/**
 * ArcaSTTCapture
 * -------------
 * A reusable, framework‑agnostic wrapper around the Web Speech API to perform
 * speech‑to‑text (STT) directly in the browser. This class exposes a simple
 * API for starting and stopping voice recognition, receiving interim and final
 * transcripts, handling errors, and configuring languages and recognition
 * behavior. It is designed to work in browsers that implement either
 * `SpeechRecognition` or `webkitSpeechRecognition`.
 *
 * IMPORTANT USAGE NOTES:
 * - Not all browsers implement the Web Speech API. Before creating a
 *   ArcaSTTCapture instance you should check for support using the static or
 *   instance `isSupported()` method. Unsupported browsers will return false.
 * - Speech recognition requires a secure context (HTTPS) and must be initiated
 *   by a user gesture (e.g. a button click). Browsers will block microphone
 *   access otherwise.
 * - Recognition results are produced by the browser's underlying speech
 *   service (often cloud‑based) and require network connectivity unless the
 *   browser supports on‑device recognition.
 *
 * Example usage:
 *
 * ```js
 * import ArcaSTTCapture from './ArcaSTTCapture.js';
 *
 * const capture = new ArcaSTTCapture();
 * if (capture.isSupported()) {
 *   // register callbacks
 *   capture.onResult((text, isFinal, meta) => {
 *     if (isFinal) {
 *       console.log('Final transcript:', text);
 *     } else {
 *       console.log('Interim transcript:', text);
 *     }
 *   });
 *   capture.onError((code, message) => {
 *     console.error('Speech error:', code, message);
 *   });
 *   capture.onEnd(() => {
 *     console.log('Recognition session ended');
 *   });
 *
 *   // start listening on button click
 *   document.getElementById('micButton').addEventListener('click', () => {
 *     capture.startListening(); // uses default options
 *   });
 * }
 * ```
 */

/* eslint-disable no-unused-vars */
// Determine which SpeechRecognition implementation is available. In Safari
// implementations the class is exposed as webkitSpeechRecognition while in
// Chrome and Chromium it is SpeechRecognition. If neither exists, SR will be
// undefined and `isSupported()` will return false.
const SR = (typeof window !== 'undefined')
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

/**
 * Default configuration for recognition sessions. The defaults favour a
 * push‑to‑talk model with interim results enabled and a primary locale of
 * Spanish (Costa Rica).
 *
 * @type {Object}
 * @property {string} language The BCP‑47 language code used for recognition.
 * @property {boolean} interimResults Whether interim (partial) results are returned.
 * @property {boolean} continuous Whether recognition continues after a final result.
 * @property {number} maxAlternatives The maximum number of alternative transcripts.
 */
const DEFAULT_OPTIONS = {
  language: 'es-CR',
  interimResults: true,
  continuous: false,
  maxAlternatives: 1
};

/**
 * Mapping of error codes to human‑readable messages. When an error occurs,
 * ArcaSTTCapture will look up the code in this table and provide the message to
 * registered error callbacks. Unknown codes fall back to the `SpeechRecognition`
 * API's default message.
 *
 * @type {Object.<string,string>}
 */
const ERROR_MESSAGES = {
  aborted: 'Speech recognition aborted.',
  'audio-capture': 'Microphone is not available or audio capture failed.',
  'not-allowed': 'Microphone access was denied.',
  'service-not-allowed': 'Speech recognition service is not allowed.',
  network: 'A network error occurred while performing speech recognition.',
  'no-speech': 'No speech was detected.',
  'language-not-supported': 'The specified recognition language is not supported.',
  nomatch: 'Speech was not recognized.',
  'not-supported': 'Speech recognition is not supported in this browser.',
  'already-started': 'Speech recognition has already been started.',
  'start-failed': 'Failed to start speech recognition.'
};

/**
 * ArcaSTTCapture class definition. Provides methods to control speech recognition
 * sessions and register event callbacks. See the examples above for typical
 * usage patterns.
 */
class ArcaSTTCapture {
  /**
   * Create a new ArcaSTTCapture instance. You may pass an object containing
   * default option overrides. These settings are applied to all subsequent
   * recognition sessions unless overridden in `startListening`.
   *
   * @param {Object} [options] Optional default configuration.
   * @param {string} [options.language] Default recognition language (BCP‑47).
   * @param {boolean} [options.interimResults] Whether to emit interim results by default.
   * @param {boolean} [options.continuous] Whether to keep recognition active after final result by default.
   * @param {number} [options.maxAlternatives] Maximum number of alternative transcripts.
   */
  constructor(options = {}) {
    // Initialize default options by merging provided overrides with the
    // predefined defaults. These values are used whenever startListening is
    // called without explicit options.
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Array of registered result callbacks. Each callback is invoked with
    // (text, isFinal, meta) whenever speech is recognized.
    this._onResult = [];
    // Array of registered error callbacks. Each callback is invoked with
    // (code, message) when an error occurs.
    this._onError = [];
    // Array of registered end callbacks. Each callback is invoked with no
    // arguments when a recognition session ends.
    this._onEnd = [];

    // The current SpeechRecognition instance, created when startListening
    // begins a new session. Cleared when the session ends.
    this.recognition = null;

    // Tracks the internal state of the recognizer. One of: 'idle',
    // 'listening', 'stopping', or 'aborted'. This helps avoid invalid
    // transitions such as calling start while already listening.
    this.state = 'idle';

    // The options used for the current session. These are set in
    // startListening and referenced in event handlers (e.g. onspeechend).
    this.sessionOptions = null;
  }

  /**
   * Static convenience method to check if the current browser environment
   * supports the Web Speech API. This method does not instantiate the class.
   *
   * @returns {boolean} True if speech recognition is available, otherwise false.
   */
  static isSupported() {
    return !!SR;
  }

  /**
   * Instance method variant of isSupported. Calls the static method and
   * returns its result. This allows checking support on an instance.
   *
   * @returns {boolean} True if speech recognition is available.
   */
  isSupported() {
    return ArcaSTTCapture.isSupported();
  }

  /**
   * Set the default language for subsequent recognition sessions. The language
   * must be a valid BCP‑47 code. Changing the language does not affect an
   * ongoing session.
   *
   * @param {string} lang The desired language code (e.g., 'es-CR', 'en-US').
   * @returns {ArcaSTTCapture} Returns the current instance for chaining.
   */
  setLanguage(lang) {
    if (typeof lang === 'string' && lang.trim() !== '') {
      this.options.language = lang;
    }
    return this;
  }

  /**
   * Enable or disable interim result reporting by default. When enabled,
   * the recognizer will emit partial transcripts as the user speaks. When
   * disabled, only the final transcript will be emitted.
   *
   * @param {boolean} flag True to enable interim results, false to disable.
   * @returns {ArcaSTTCapture} Returns the current instance for chaining.
   */
  enableInterimResults(flag) {
    this.options.interimResults = !!flag;
    return this;
  }

  /**
   * Enable or disable continuous recognition by default. In continuous mode
   * the recognizer will remain active and produce multiple final results
   * separated by pauses. In non‑continuous mode (the default), the
   * recognizer stops automatically after the first final result.
   *
   * @param {boolean} flag True to enable continuous mode, false to disable.
   * @returns {ArcaSTTCapture} Returns the current instance for chaining.
   */
  setContinuous(flag) {
    this.options.continuous = !!flag;
    return this;
  }

  /**
   * Register a callback to be invoked whenever speech recognition returns a
   * result. The callback receives the recognized text, a boolean indicating
   * whether the result is final, and a meta object containing a confidence
   * score (if provided by the API).
   *
   * @param {(text: string, isFinal: boolean, meta: { confidence?: number }) => void} callback
   *        The function to be invoked on recognition results.
   * @returns {ArcaSTTCapture} Returns the current instance for chaining.
   */
  onResult(callback) {
    if (typeof callback === 'function') {
      this._onResult.push(callback);
    }
    return this;
  }

  /**
   * Deregister a previously added result callback. If the callback has been
   * registered multiple times, all instances will be removed. If the callback
   * was not registered, nothing happens.
   *
   * @param {(text: string, isFinal: boolean, meta: { confidence?: number }) => void} callback
   *        The function to remove.
   * @returns {ArcaSTTCapture} Returns the current instance for chaining.
   */
  offResult(callback) {
    this._onResult = this._onResult.filter(fn => fn !== callback);
    return this;
  }

  /**
   * Register a callback to be invoked when an error occurs during recognition.
   * The callback receives an error code and a descriptive message. Recognized
   * error codes include: 'not-allowed', 'audio-capture', 'no-speech',
   * 'network', 'aborted', 'language-not-supported', 'nomatch',
   * 'not-supported', 'already-started' and others. Unknown codes are passed
   * through with the API's default message.
   *
   * @param {(code: string, message?: string) => void} callback
   *        The function to be invoked on errors.
   * @returns {ArcaSTTCapture} Returns the current instance for chaining.
   */
  onError(callback) {
    if (typeof callback === 'function') {
      this._onError.push(callback);
    }
    return this;
  }

  /**
   * Deregister a previously added error callback. If the callback has been
   * registered multiple times, all instances will be removed. If the callback
   * was not registered, nothing happens.
   *
   * @param {(code: string, message?: string) => void} callback
   *        The function to remove.
   * @returns {ArcaSTTCapture} Returns the current instance for chaining.
   */
  offError(callback) {
    this._onError = this._onError.filter(fn => fn !== callback);
    return this;
  }

  /**
   * Register a callback to be invoked when a recognition session ends. The
   * session ends when the user stops speaking in non‑continuous mode, when
   * stopListening() is called, or when an error aborts recognition. This
   * callback receives no arguments.
   *
   * @param {() => void} callback The function to invoke when recognition ends.
   * @returns {ArcaSTTCapture} Returns the current instance for chaining.
   */
  onEnd(callback) {
    if (typeof callback === 'function') {
      this._onEnd.push(callback);
    }
    return this;
  }

  /**
   * Deregister a previously added end callback. If the callback has been
   * registered multiple times, all instances will be removed.
   *
   * @param {() => void} callback The function to remove.
   * @returns {ArcaSTTCapture} Returns the current instance for chaining.
   */
  offEnd(callback) {
    this._onEnd = this._onEnd.filter(fn => fn !== callback);
    return this;
  }

  /**
   * Start a new voice recognition session. If recognition is already in
   * progress, an 'already-started' error is emitted and no new session
   * begins. The provided options override the instance defaults for this
   * session only.
   *
   * @param {Object} [options] Optional configuration for this session.
   * @param {string} [options.language] Recognition language (BCP‑47).
   * @param {boolean} [options.interimResults] Whether to return interim results.
   * @param {boolean} [options.continuous] Whether to continue recognition after final result.
   * @param {number} [options.maxAlternatives] Maximum number of alternative transcripts.
   * @returns {void}
   */
  startListening(options = {}) {
    // Ensure the API is available before starting recognition.
    if (!this.isSupported()) {
      this.invokeError('not-supported', ERROR_MESSAGES['not-supported']);
      return;
    }

    // Prevent multiple concurrent recognition sessions. If already listening,
    // notify via error callback and do nothing.
    if (this.state === 'listening' || this.state === 'stopping') {
      this.invokeError('already-started', ERROR_MESSAGES['already-started']);
      return;
    }

    // Merge provided options with the instance defaults to form the session
    // configuration. Note: we do not mutate this.options here; sessionOptions
    // is used only for the current session.
    this.sessionOptions = {
      language: options.language !== undefined ? options.language : this.options.language,
      interimResults: options.interimResults !== undefined ? !!options.interimResults : !!this.options.interimResults,
      continuous: options.continuous !== undefined ? !!options.continuous : !!this.options.continuous,
      maxAlternatives: typeof options.maxAlternatives === 'number' ? options.maxAlternatives : this.options.maxAlternatives
    };

    // Create a new SpeechRecognition instance for this session.
    try {
      this.recognition = new SR();
    } catch (err) {
      this.invokeError('not-supported', ERROR_MESSAGES['not-supported']);
      return;
    }

    // Configure the recognition instance according to the session options.
    this.recognition.lang = this.sessionOptions.language;
    this.recognition.interimResults = this.sessionOptions.interimResults;
    this.recognition.continuous = this.sessionOptions.continuous;
    this.recognition.maxAlternatives = this.sessionOptions.maxAlternatives;

    // Bind event handlers. Arrow functions preserve context, but using
    // bind() ensures we can remove handlers if needed in the future.
    this.recognition.onresult = this.handleResult.bind(this);
    this.recognition.onerror = this.handleError.bind(this);
    this.recognition.onend = this.handleEnd.bind(this);
    this.recognition.onnomatch = this.handleNoMatch.bind(this);

    // For non‑continuous sessions, stop recognition when speech ends. In
    // continuous mode, we allow the service to restart on pauses automatically.
    this.recognition.onspeechend = () => {
      // Only stop if still listening and not continuous.
      if (this.sessionOptions && !this.sessionOptions.continuous && this.state === 'listening') {
        this.state = 'stopping';
        try {
          this.recognition.stop();
        } catch (_) {
          // If stop() throws (e.g. recognition already stopped), ignore.
        }
      }
    };

    // Mark state as listening before calling start() to avoid race conditions.
    this.state = 'listening';

    // Start the recognition session. If the call fails (e.g. due to lack of
    // user gesture), catch the exception and notify via error callback.
    try {
      this.recognition.start();
    } catch (err) {
      this.state = 'idle';
      this.invokeError('start-failed', ERROR_MESSAGES['start-failed'] + ` ${err && err.message ? err.message : ''}`);
      this.invokeEnd();
    }
  }

  /**
   * Stop the current recognition session gracefully. If no recognition is
   * active, this method does nothing. Stopping the session triggers a final
   * result (if any speech was recognized) followed by the onEnd callbacks.
   *
   * @returns {void}
   */
  stopListening() {
    if (this.recognition && (this.state === 'listening' || this.state === 'stopping')) {
      this.state = 'stopping';
      try {
        this.recognition.stop();
      } catch (_) {
        // If stop() fails (unlikely), fall back to abort.
        try {
          this.recognition.abort();
        } catch (__) {
          /* ignore */
        }
      }
    }
  }

  /**
   * Abort the current recognition session immediately. Any partial results
   * are discarded and no final result is provided. If recognition is not
   * active, this method does nothing.
   *
   * @returns {void}
   */
  abortListening() {
    if (this.recognition && (this.state === 'listening' || this.state === 'stopping')) {
      // Set state to aborted before calling abort() so that handleEnd knows
      // the difference between a natural stop and a forced abort.
      this.state = 'aborted';
      try {
        this.recognition.abort();
      } catch (_) {
        /* ignore */
      }
    }
  }

  /**
   * Internal handler for recognition result events. Extracts the transcript,
   * confidence score and finality from the SpeechRecognitionEvent and invokes
   * all registered result callbacks. Each result may contain multiple
   * alternatives; we only use the first alternative.
   *
   * @param {SpeechRecognitionEvent} event The result event.
   * @private
   */
  handleResult(event) {
    // Iterate over results starting from resultIndex to handle both
    // incremental and final results.
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const alternative = result[0];
      const transcript = alternative && alternative.transcript ? alternative.transcript.trim() : '';
      const confidence = alternative && typeof alternative.confidence === 'number' ? alternative.confidence : undefined;
      const isFinal = !!result.isFinal;

      this.invokeResult(transcript, isFinal, confidence);
    }
  }

  /**
   * Internal handler for recognition error events. Maps the error code to a
   * human‑readable message and invokes registered error callbacks. After an
   * error, the recognizer is cleaned up and the session ends.
   *
   * @param {SpeechRecognitionErrorEvent} event The error event.
   * @private
   */
  handleError(event) {
    const code = event && event.error ? event.error : 'error';
    // Look up a friendly message, falling back to the event's message.
    const message = ERROR_MESSAGES[code] || event.message || 'An error occurred during speech recognition.';

    // Transition state to idle; note that onEnd will also run, but we avoid
    // resetting state twice by doing so here.
    this.state = 'idle';

    // Invoke error callbacks.
    this.invokeError(code, message);
    // No need to manually end session here; onend will fire afterwards and
    // handle the onEnd callbacks.
  }

  /**
   * Internal handler for the recognition onend event. Clears the current
   * recognition instance and invokes registered onEnd callbacks. The onEnd
   * event fires after stop() or abort(), or when recognition terminates
   * naturally.
   *
   * @private
   */
  handleEnd() {
    // Capture current recognition reference before clearing to avoid race.
    const current = this.recognition;
    // Clear the recognition instance to allow new sessions to start.
    this.recognition = null;

    // Reset state to idle unless already aborted; aborted state resets here.
    this.state = 'idle';

    // Reset sessionOptions for next call.
    this.sessionOptions = null;

    // Invoke end callbacks.
    this.invokeEnd();
  }

  /**
   * Internal handler for no-match events. This event occurs when speech is
   * detected but not understood well enough to produce a transcript. It is
   * treated as a soft error and forwarded to error callbacks with a 'nomatch'
   * code.
   *
   * @private
   */
  handleNoMatch() {
    // We do not change state here; recognition continues to listen.
    this.invokeError('nomatch', ERROR_MESSAGES.nomatch);
  }

  /**
   * Invoke all registered result callbacks with the provided parameters.
   *
   * @param {string} text The recognized transcript.
   * @param {boolean} isFinal Whether the result is final.
   * @param {number|undefined} confidence The confidence score provided by the API.
   * @private
   */
  invokeResult(text, isFinal, confidence) {
    for (const cb of this._onResult) {
      try {
        cb(text, isFinal, { confidence });
      } catch (_) {
        // Swallow exceptions in user callbacks to avoid breaking recognition.
      }
    }
  }

  /**
   * Invoke all registered error callbacks with the provided error code and message.
   *
   * @param {string} code The error code.
   * @param {string} message A descriptive message for the error.
   * @private
   */
  invokeError(code, message) {
    for (const cb of this._onError) {
      try {
        cb(code, message);
      } catch (_) {
        // Swallow exceptions in user callbacks.
      }
    }
  }

  /**
   * Invoke all registered end callbacks. Used internally after a session
   * terminates either naturally, via stopListening or abortListening, or due
   * to an error.
   *
   * @private
   */
  invokeEnd() {
    for (const cb of this._onEnd) {
      try {
        cb();
      } catch (_) {
        // Ignore exceptions in user callbacks.
      }
    }
  }
}


if (typeof window !== 'undefined') {
      window.ArcaSTTCapture = ArcaSTTCapture;
}