/**
 * bootstrap.js — Arranque del DEMO standalone (sin backend).
 *
 * Provee todo lo que en producción aporta el app de la compañía (Arca.Xplore):
 *  - stub de kendo.htmlEncode
 *  - variables globales dummy (ARCA_DEV_ID / ARCA_TOKEN)
 *  - setupDocHost(): renderiza un PDF con PDF.js (soporta varios documentos)
 *  - dhLoadBase64(): cambia de documento y/o salta de página en el visor
 *  - intercepción de $.ajax para simular el RAG (Mago de Oz)
 *
 * RAG SIMULADO (Mago de Oz) — PF-3311, Entregable 2
 * --------------------------------------------------
 * El mock guioniza las TRES tareas del protocolo de evaluación (T1, T2, T3),
 * cada una con respuestas FUNDAMENTADAS en los tres reglamentos reales del
 * expediente de prueba y con referencias (documento + página) verificables:
 *   - Reglamento de Horas Estudiante, Horas Asistente y Horas Asistente de Posgrado
 *   - Reglamento de Régimen Académico Estudiantil
 *   - Reglamento del Trabajo Comunal Universitario (TCU)
 *
 * NOTA SOBRE T1 (ver README/respuesta): el Art. 5 del Reglamento de Horas indica
 * que un IN en un curso de investigación NO impide la designación. La respuesta
 * guionizada refleja el texto real del reglamento. Si el protocolo requiere la
 * variante alterna, edite SCRIPTED_ANSWERS.T1.
 *
 * NO contiene nada propietario: el agente conversacional 3D, el RAG UI, STT y TTS
 * son la contribución académica (PF-3311); aquí solo se "alimenta" con datos simulados.
 */
(function () {
    'use strict';

    const $ = window.jQuery;

    // ---- 0. Registro del expediente de prueba (3 reglamentos UCR) ----
    const DOCS = {
        horas: {
            id: 'horas',
            title: 'Reglamento de Horas Estudiante, Asistente y Asistente de Posgrado',
            url: '/pdfs/horas_estudiante_asistente_posgrado.pdf'
        },
        regimen: {
            id: 'regimen',
            title: 'Reglamento de Régimen Académico Estudiantil',
            url: '/pdfs/regimen_academico_estudiantil.pdf'
        },
        tcu: {
            id: 'tcu',
            title: 'Reglamento del Trabajo Comunal Universitario',
            url: '/pdfs/trabajo_comunal.pdf'
        }
    };
    const DEFAULT_DOC = 'horas';   // documento visible al abrir el panel

    // ---- 1. Dependencias mínimas que el código espera del host ----
    window.kendo = window.kendo || {
        htmlEncode: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]))
    };
    window.ARCA_DEV_ID = '00000000-0000-0000-0000-000000000000';
    window.ARCA_TOKEN = 'demo';

    // ---- 2. Visor de PDF multi-documento con PDF.js ----
    let _pdfDoc = null;
    let _currentDocId = null;
    let _pageCanvases = {};
    let _hostSelector = '#pdfViewer';
    let _renderToken = 0;          // invalida renders en curso al cambiar de documento

    async function renderPdf(docId) {
        const doc = DOCS[docId] || DOCS[DEFAULT_DOC];
        const host = document.querySelector(_hostSelector);
        if (!host || !window.pdfjsLib) return;

        const myToken = ++_renderToken;
        _currentDocId = doc.id;
        _pageCanvases = {};
        host.innerHTML = '';
        try {
            _pdfDoc = await window.pdfjsLib.getDocument(doc.url).promise;
            if (myToken !== _renderToken) return; // se pidió otro documento mientras tanto
            const width = host.clientWidth || 600;
            for (let n = 1; n <= _pdfDoc.numPages; n++) {
                const page = await _pdfDoc.getPage(n);
                if (myToken !== _renderToken) return;
                const unscaled = page.getViewport({ scale: 1 });
                // Descontar el padding del visor (16px a cada lado) para llenar el ancho sin desbordar.
                const scale = Math.max(0.4, (width - 32) / unscaled.width);
                const viewport = page.getViewport({ scale });
                const canvas = document.createElement('canvas');
                canvas.className = 'demo-pdf-page';
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                host.appendChild(canvas);
                _pageCanvases[n] = canvas;
                await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
            }
        } catch (e) {
            host.innerHTML = '<div class="demo-pdf-error">No se pudo cargar el documento «' + doc.title + '».</div>';
            console.error('[demo] PDF render error:', e);
        }
    }

    function scrollToPage(num) {
        const target = _pageCanvases[num] || _pageCanvases[1];
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // El panel llama a setupDocHost({ hostSelector:'#pdfViewer', ... }) al montarse.
    window.setupDocHost = function (cfg) {
        _hostSelector = (cfg && cfg.hostSelector) || '#pdfViewer';
        // Esperar a que el contenedor tenga ancho (layout aplicado)
        setTimeout(() => renderPdf(DEFAULT_DOC), 100);
        return {};
    };

    // Salto de referencia del RAG. En el demo, `payload` describe documento y página
    // (lo entrega el mock de XPLOREPageByDocumentId). Cambia de PDF si hace falta.
    window.dhLoadBase64 = async function (payload) {
        let docId = _currentDocId;
        let page = parseInt((document.getElementById('tbPgNumber') || {}).value, 10) || 1;

        if (payload && typeof payload === 'object') {
            if (payload.docId) docId = payload.docId;
            if (payload.page) page = payload.page;
        }

        if (docId && docId !== _currentDocId) {
            await renderPdf(docId);       // cambia de reglamento
        }
        scrollToPage(page);
    };

    // ===================================================================
    // ---- 3. RAG simulado (Mago de Oz): respuestas guionizadas T1–T3 ----
    // ===================================================================

    // Normaliza para emparejar sin tildes ni mayúsculas (entrada por teclado o STT).
    function _norm(s) {
        return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    }

    // Respuestas guionizadas. Cada `links[].documentId` apunta a un reglamento del
    // expediente y `page` a la página donde el dato es verificable.
    const SCRIPTED_ANSWERS = {
        // T1 — Verificación de Requisitos (Reglamento de Horas, Art. 5). RQ1.
        T1: {
            answer:
                `Según el **Reglamento de Horas Estudiante, Horas Asistente y Horas Asistente de Posgrado** (Artículo 5):\n\n` +
                `- **Sí puede ser designado**, aun con una nota de **Incompleto (IN)** en un curso de investigación: el Art. 5, inciso a), establece que estas personas *"podrán ser designadas mientras mantengan esa condición"* (1).\n` +
                `- El **promedio ponderado mínimo** es de **8,5** en el ciclo lectivo anterior (Art. 5, inciso d). A quienes ingresan en su primer ciclo al posgrado **no** se les toma en cuenta el promedio (2).\n\n` +
                `En resumen: el **IN** en un curso de investigación **no impide** la designación, y el promedio mínimo requerido es **8,5**.`,
            referenceLinks: [
                { displayText: 'Reglamento de Horas — Art. 5 (pág. 2)', documentId: 'horas', page: 2 },
                { displayText: 'Requisitos de promedio (pág. 2)', documentId: 'horas', page: 2 }
            ]
        },

        // T2 — Síntesis Normativa Cruzada (Horas Art. 12 + TCU). RQ2.
        T2: {
            answer:
                `Esta consulta combina **dos reglamentos**:\n\n` +
                `- **Límite de horas (Reglamento de Horas, Art. 12):** el máximo semanal es de **12 horas** para *horas estudiante* y de **20 horas** para *horas asistente* y *horas asistente de posgrado*. Cuando hay **designaciones combinadas**, la sumatoria (incluidas las ad honorem) **no puede sobrepasar las 20 horas** semanales (1).\n` +
                `- **Simultaneidad:** los reglamentos **no la prohíben**; un nombramiento de horas y el TCU pueden coexistir siempre que se respete ese tope semanal.\n` +
                `- **Total de horas de TCU (Reglamento de TCU):** en **grado** (bachillerato/licenciatura) son **300 horas**; en pregrado, 150 horas (2).\n\n` +
                `En resumen: **sí** es posible simultanear, respetando el límite de **20 horas semanales** combinadas, y el TCU de un bachillerato requiere **300 horas** en total.`,
            referenceLinks: [
                { displayText: 'Reglamento de Horas — Art. 12 (pág. 4)', documentId: 'horas', page: 4 },
                { displayText: 'Reglamento de TCU — horas requeridas (pág. 7)', documentId: 'tcu', page: 7 }
            ]
        },

        // T3 — Datos Puntuales y Retención (tres reglamentos). RQ2/RQ3.
        T3: {
            answer:
                `Tres datos puntuales, cada uno en su reglamento:\n\n` +
                `- **Relación salarial (Reglamento de Horas):** las categorías de *horas asistente* y *horas asistente de posgrado* reciben un **reconocimiento económico mayor** que el de *horas estudiante*, por exigir más conocimiento y responsabilidad (1). *(El monto exacto por hora lo fija la escala salarial institucional, no el reglamento.)*\n` +
                `- **Nota mínima de aprobación (Régimen Académico Estudiantil):** la calificación final de **7,0** es la mínima para aprobar un curso (2).\n` +
                `- **Mínimo de estudiantes por proyecto de TCU (Reglamento de TCU, Art. 12):** por cada proyecto debe haber **mínimo 8 estudiantes** matriculados (3).`,
            referenceLinks: [
                { displayText: 'Reglamento de Horas — reconocimiento económico (pág. 3)', documentId: 'horas', page: 3 },
                { displayText: 'Régimen Académico — nota mínima 7,0 (pág. 13)', documentId: 'regimen', page: 13 },
                { displayText: 'Reglamento de TCU — Art. 12 (pág. 3)', documentId: 'tcu', page: 3 }
            ]
        },

        // Respuesta por defecto (pregunta libre / fase de práctica).
        DEFAULT: {
            answer:
                `Puedo ayudarte a consultar el **expediente de reglamentos UCR** (Horas, Régimen Académico y TCU). ` +
                `Por ejemplo, pregúntame sobre designación en horas asistente de posgrado, sobre realizar horas asistente junto con el TCU, ` +
                `o sobre datos puntuales como la nota mínima de aprobación o el mínimo de estudiantes por proyecto de TCU.`,
            referenceLinks: []
        }
    };

    // Empareja la pregunta con una tarea del protocolo mediante puntuación por señales.
    function _matchTask(question) {
        const q = _norm(question);
        const has = (kw) => q.indexOf(kw) !== -1;
        const score = { T1: 0, T2: 0, T3: 0 };

        // T1: IN / incompleto + promedio + designación en posgrado
        if (has('incompleto') || has('(in)') || /\bin\b/.test(q)) score.T1 += 3;
        if (has('promedio')) score.T1 += 2;
        if (has('designad') || has('asistente de posgrado')) score.T1 += 1;

        // T2: TCU + simultaneidad / combinación / límite de horas
        if (has('tcu') || has('trabajo comunal')) score.T2 += 2;
        if (has('simultane') || has('mismo tiempo') || has('a la vez')) score.T2 += 3;
        if (has('combinad') || has('limite de horas') || has('limite')) score.T2 += 2;

        // T3: salario / nota mínima / cantidad de estudiantes
        if (has('gana') || has('salario') || has('por hora')) score.T3 += 3;
        if (has('nota minima') || has('minima para aprobar') || has('aprobar un curso')) score.T3 += 3;
        if ((has('cuantos') || has('minimo')) && has('estudiantes')) score.T3 += 3;

        let best = null, bestScore = 0;
        for (const k of ['T1', 'T2', 'T3']) {
            if (score[k] > bestScore) { bestScore = score[k]; best = k; }
        }
        return best ? SCRIPTED_ANSWERS[best] : SCRIPTED_ANSWERS.DEFAULT;
    }

    function ragAnswerFor(question) {
        const a = _matchTask(question);
        // Copia defensiva para no mutar el guion entre preguntas.
        return { answer: a.answer, referenceLinks: a.referenceLinks.map(r => ({ ...r })) };
    }

    const _origAjax = $.ajax.bind($);

    // Modo del RAG: 'live' (backend Azure OpenAI) o 'mock' (respuestas guionizadas).
    // Se autodetecta probando /api/health; se puede forzar con ?rag=live|mock.
    const _forcedMode = (new URLSearchParams(window.location.search).get('rag') || '').toLowerCase();
    const _ragModePromise =
        _forcedMode === 'mock' ? Promise.resolve('mock') :
        _forcedMode === 'live' ? Promise.resolve('live') :
        (window.fetch
            ? fetch('/api/health', { method: 'GET' }).then(r => (r.ok ? 'live' : 'mock')).catch(() => 'mock')
            : Promise.resolve('mock'));
    _ragModePromise.then(m => console.log('[demo] RAG mode:', m));

    // Resuelve con la respuesta simulada (mock), respetando el callback success de jQuery.
    function _mockResolve(data, delay, opts) {
        return new Promise((resolve) => {
            setTimeout(() => {
                if (typeof opts.success === 'function') { try { opts.success(data); } catch (_) { } }
                resolve(data);
            }, delay);
        });
    }

    $.ajax = function (opts) {
        const url = (opts && opts.url) || '';

        if (url.indexOf('/api/XPLORErag') !== -1) {
            // En modo 'live' dejamos pasar la petición al backend real (mismo contrato de respuesta).
            // En modo 'mock' devolvemos la respuesta guionizada.
            return _ragModePromise.then((mode) => {
                if (mode === 'live') return _origAjax(opts);
                let q = '';
                try { q = JSON.parse(opts.data || '{}').question || ''; } catch (_) { }
                return _mockResolve({ response: ragAnswerFor(q) }, 700, opts);
            });
        } else if (url.indexOf('XPLOREPageByDocumentId') !== -1) {
            // La navegación de páginas del PDF es client-side en AMBOS modos:
            // devolvemos { docId, page } para que dhLoadBase64 cambie de PDF.
            let req = {};
            try { req = JSON.parse(opts.data || '{}'); } catch (_) { }
            return _mockResolve({ data: { docId: req.pkDocumentId, page: req.pageNumber } }, 120, opts);
        }

        return _origAjax(opts); // cualquier otra cosa: comportamiento normal
    };

    // ---- 4. Arranque del panel ----
    // Condición inicial según ?type= en el query string:
    //   ?type=TEXT        → Condición B (interfaz textual por defecto)
    //   ?type=CVA | AVC   → Condición A (avatar visible)
    //   (ausente / otro)  → Condición A (avatar), comportamiento por defecto del demo
    function _modoDesdeQueryString() {
        const type = (new URLSearchParams(window.location.search).get('type') || '').trim().toUpperCase();
        if (type === 'TEXT') return false;          // textual
        if (type === 'CVA' || type === 'AVC') return true; // avatar
        return true;                                // por defecto: avatar
    }

    function launch() {
        // El modo se lee de localStorage al cargar arcangelRAGLoader; lo fijamos antes según el query string.
        try { localStorage.setItem('archibot_conversacional', _modoDesdeQueryString() ? 'true' : 'false'); } catch (_) { }

        if (typeof window.arcangelRAGLoader !== 'function') {
            console.error('[demo] arcangelRAGLoader no está cargado.');
            return;
        }
        window.arcangelRAGLoader(window.jQuery, window.kendo);
        window.ArcangelRAG.showArcangelRAG(
            '',
            { pkRecordId: 'expediente-ucr', title: 'Expediente: Reglamentos UCR (PF-3311)' },
            'record'
        );
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', launch);
    } else {
        launch();
    }
})();
