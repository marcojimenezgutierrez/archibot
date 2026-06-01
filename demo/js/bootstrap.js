/**
 * bootstrap.js — Arranque del DEMO standalone (sin backend).
 *
 * Provee todo lo que en producción aporta el app de la compañía (Arca.Xplore):
 *  - stub de kendo.htmlEncode
 *  - variables globales dummy (ARCA_DEV_ID / ARCA_TOKEN)
 *  - setupDocHost(): renderiza un PDF de ejemplo con PDF.js
 *  - dhLoadBase64(): salto de página en el visor
 *  - intercepción de $.ajax para simular el RAG (respuesta de ejemplo en Markdown)
 *
 * NO contiene nada propietario: el agente conversacional 3D, el RAG UI, STT y TTS
 * son la contribución académica (PF-3311); aquí solo se "alimenta" con datos simulados.
 */
(function () {
    'use strict';

    const $ = window.jQuery;
    const PDF_URL = '/pdfs/horas_estudiante_asistente_posgrado.pdf';

    // ---- 1. Dependencias mínimas que el código espera del host ----
    window.kendo = window.kendo || {
        htmlEncode: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]))
    };
    window.ARCA_DEV_ID = '00000000-0000-0000-0000-000000000000';
    window.ARCA_TOKEN = 'demo';

    // ---- 2. Visor de PDF con PDF.js (reemplaza el setupDocHost de la compañía) ----
    let _pdfDoc = null;
    const _pageCanvases = {};

    async function renderPdf(hostSelector) {
        const host = document.querySelector(hostSelector);
        if (!host || !window.pdfjsLib) return;
        host.innerHTML = '';
        try {
            _pdfDoc = await window.pdfjsLib.getDocument(PDF_URL).promise;
            const width = host.clientWidth || 600;
            for (let n = 1; n <= _pdfDoc.numPages; n++) {
                const page = await _pdfDoc.getPage(n);
                const unscaled = page.getViewport({ scale: 1 });
                const scale = Math.max(0.4, (width - 24) / unscaled.width);
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
            host.innerHTML = '<div class="demo-pdf-error">No se pudo cargar el PDF de ejemplo.</div>';
            console.error('[demo] PDF render error:', e);
        }
    }

    // El panel llama a setupDocHost({ hostSelector:'#pdfViewer', ... }) al montarse.
    window.setupDocHost = function (cfg) {
        const sel = (cfg && cfg.hostSelector) || '#pdfViewer';
        // Esperar a que el contenedor tenga ancho (layout aplicado)
        setTimeout(() => renderPdf(sel), 100);
        return {};
    };

    // Salto de página al hacer clic en una referencia del RAG.
    window.dhLoadBase64 = function () {
        const num = parseInt((document.getElementById('tbPgNumber') || {}).value, 10);
        const target = _pageCanvases[num] || _pageCanvases[1];
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // ---- 3. Mock del RAG (respuesta de ejemplo en Markdown) ----
    // Ejercita el render seguro de Markdown (_mdToSafeHtml) y la limpieza para voz
    // (_stripForVoice): negritas, lista y marcadores de cita (1)(2).
    function ragAnswerFor(question) {
        return {
            answer:
                `Según el documento **Horas de Estudiante Asistente de Posgrado**, esto es lo relevante:\n\n` +
                `- La asistencia de posgrado contempla un **máximo de horas semanales** definido por el reglamento (1).\n` +
                `- Las horas deben **registrarse y ser avaladas** por la persona docente responsable (2).\n` +
                `- El nombramiento está sujeto a la **condición de estudiante activo** del programa.\n\n` +
                `En resumen, *sí* existe un tope de horas y un procedimiento de aprobación documentado. ` +
                `¿Quieres que profundice en algún punto específico?`,
            referenceLinks: [
                { displayText: 'Ver pág. 1', documentId: 'demo', page: 1 },
                { displayText: 'Ver pág. 2', documentId: 'demo', page: 2 }
            ]
        };
    }

    const _origAjax = $.ajax.bind($);
    $.ajax = function (opts) {
        const url = (opts && opts.url) || '';
        let data = null;
        let delay = 250;

        if (url.indexOf('/api/XPLORErag') !== -1) {
            let q = '';
            try { q = JSON.parse(opts.data || '{}').question || ''; } catch (_) { }
            data = { response: ragAnswerFor(q) };
            delay = 700; // simular "pensando"
        } else if (url.indexOf('XPLOREPageByDocumentId') !== -1) {
            data = { data: '' };
        } else {
            return _origAjax(opts); // cualquier otra cosa: comportamiento normal (no debería ocurrir)
        }

        return new Promise((resolve) => {
            setTimeout(() => {
                if (typeof opts.success === 'function') { try { opts.success(data); } catch (_) { } }
                resolve(data);
            }, delay);
        });
    };

    // ---- 4. Arranque del panel ----
    function launch() {
        // Pre-seleccionar Condición A (AVC) para que el avatar se vea de inmediato.
        try { localStorage.setItem('archibot_conversacional', 'true'); } catch (_) { }

        if (typeof window.arcangelRAGLoader !== 'function') {
            console.error('[demo] arcangelRAGLoader no está cargado.');
            return;
        }
        window.arcangelRAGLoader(window.jQuery, window.kendo);
        window.ArcangelRAG.showArcangelRAG('', { pkRecordId: 'demo', title: 'Documento de ejemplo' }, 'record');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', launch);
    } else {
        launch();
    }
})();
