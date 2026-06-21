/**
 * server.js — Proxy backend del demo Archibot (PF-3311).
 *
 * - Sirve la carpeta estática `demo/`.
 * - Expone POST /api/rag: arma el contexto con el texto de los 3 reglamentos
 *   (marcadores [doc pN]) y llama al LLM para responder. Devuelve el MISMO contrato
 *   que el mock del front-end: { response: { answer, referenceLinks } }.
 * - La API key NUNCA llega al navegador: vive solo aquí (variables de entorno).
 *
 * Proveedor del LLM (variable LLM_PROVIDER):
 *   - 'openai' (por defecto): api.openai.com — usa OPENAI_API_KEY y OPENAI_MODEL (gpt-4.1-nano).
 *   - 'azure': Azure OpenAI — usa AZURE_OPENAI_ENDPOINT/_DEPLOYMENT/_API_VERSION/_API_KEY.
 *
 * Modo de despliegue:
 *   - App Service / local: este servidor corre → el front-end detecta /api/health y usa el LLM real.
 *   - GitHub Pages (estático, sin backend): no encuentra /api/health → usa el mock guionizado.
 *
 * Variables de entorno (.env local o App Settings):
 *   OPENAI_API_KEY             clave de OpenAI
 *   OPENAI_MODEL               modelo (por defecto gpt-4.1-nano)
 *   PORT                       (host lo define; local: 3000)
 *   ALLOWED_ORIGIN             (opcional) origen permitido para CORS; por defecto '*'
 */
'use strict';

try { require('dotenv').config(); } catch (_) { /* dotenv es opcional */ }

const path = require('path');
const fs = require('fs');
const express = require('express');
const { onRequest } = require('firebase-functions/v2/https');

const app = express();
app.use(express.json({ limit: '1mb' }));

// ---- CORS (la key vive en el server; CORS sólo habilita el origen del navegador) ----
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// ---- Contexto: texto de los reglamentos con marcadores de página ----
const REGS = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'context', 'regulations.json'), 'utf8')
);
const VALID_DOCS = Object.keys(REGS); // ['horas','regimen','tcu']

function buildContext() {
    const blocks = [];
    for (const id of VALID_DOCS) {
        const doc = REGS[id];
        const pages = doc.pages
            .map((t, i) => `[${id} p${i + 1}]\n${t}`)
            .join('\n\n');
        blocks.push(`### ${doc.title} (documentId: ${id})\n${pages}`);
    }
    return blocks.join('\n\n=====\n\n');
}
const CONTEXT = buildContext();

const SYSTEM_PROMPT =
    `Eres "Ariel", un asistente que responde consultas sobre un expediente de reglamentos ` +
    `oficiales de la Universidad de Costa Rica (UCR). Responde ÚNICAMENTE con base en los ` +
    `REGLAMENTOS provistos más abajo. Si la respuesta no está en ellos, dilo con claridad y ` +
    `no inventes datos.\n\n` +
    `Estilo: español de Costa Rica, claro y conciso, en Markdown (usa negritas y listas cuando ayuden).\n\n` +
    `Devuelve EXCLUSIVAMENTE un objeto JSON válido con esta forma exacta:\n` +
    `{\n` +
    `  "answer": "<respuesta en Markdown>",\n` +
    `  "references": [ { "documentId": "horas|regimen|tcu", "page": <entero>, "displayText": "<etiqueta corta>" } ]\n` +
    `}\n` +
    `En "references" incluye las páginas exactas (según los marcadores [doc pN]) donde se verifica ` +
    `la respuesta; máximo 4. Si la consulta es un saludo o no aplica a los reglamentos, deja "references" como [].\n\n` +
    `REGLAMENTOS:\n${CONTEXT}`;

// Proveedor del LLM: 'openai' (api.openai.com, por defecto) o 'azure' (Azure OpenAI).
const PROVIDER = (process.env.LLM_PROVIDER || 'openai').toLowerCase();

function llmConfigured() {
    return PROVIDER === 'azure'
        ? !!(process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_DEPLOYMENT && process.env.AZURE_OPENAI_API_KEY)
        : !!process.env.OPENAI_API_KEY;
}

// ---- Salud (el front-end usa esto para detectar modo 'live') ----
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', mode: 'live', provider: PROVIDER, llmConfigured: llmConfigured() });
});

// ---- Llamada al LLM (OpenAI directo o Azure OpenAI) ----
async function callLLM(question) {
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: question }
    ];
    const common = { messages, temperature: 0.2, max_tokens: 900, response_format: { type: 'json_object' } };

    let url, headers, body;
    if (PROVIDER === 'azure') {
        const endpoint = (process.env.AZURE_OPENAI_ENDPOINT || '').replace(/\/+$/, '');
        const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
        const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-10-21';
        const apiKey = process.env.AZURE_OPENAI_API_KEY;
        if (!endpoint || !deployment || !apiKey) {
            throw new Error('Azure OpenAI no está configurado (faltan variables de entorno).');
        }
        url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
        headers = { 'Content-Type': 'application/json', 'api-key': apiKey };
        body = JSON.stringify(common);
    } else {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error('OPENAI_API_KEY no está configurada.');
        const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
        url = `${base}/chat/completions`;
        headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
        body = JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4.1-nano', ...common });
    }

    const resp = await fetch(url, { method: 'POST', headers, body });
    if (!resp.ok) {
        const detail = await resp.text().catch(() => '');
        throw new Error(`LLM ${resp.status}: ${detail.slice(0, 500)}`);
    }
    const json = await resp.json();
    return json.choices?.[0]?.message?.content || '{}';
}

// Normaliza la salida del modelo al contrato { answer, referenceLinks }.
function toChatMessage(rawJsonString) {
    let parsed = {};
    try { parsed = JSON.parse(rawJsonString); } catch (_) { parsed = { answer: rawJsonString }; }

    const answer = typeof parsed.answer === 'string' && parsed.answer.trim()
        ? parsed.answer.trim()
        : '(Sin respuesta)';

    const refs = Array.isArray(parsed.references) ? parsed.references : [];
    const referenceLinks = refs
        .filter(r => r && VALID_DOCS.includes(r.documentId))
        .map(r => {
            const numPages = REGS[r.documentId].pages.length;
            let page = parseInt(r.page, 10);
            if (!Number.isFinite(page) || page < 1) page = 1;
            if (page > numPages) page = numPages;
            return {
                documentId: r.documentId,
                page,
                displayText: (typeof r.displayText === 'string' && r.displayText.trim())
                    ? r.displayText.trim()
                    : `${REGS[r.documentId].title} (pág. ${page})`
            };
        })
        .slice(0, 4);

    return { answer, referenceLinks };
}

// ---- Endpoint RAG (mismo contrato que el mock del front-end) ----
app.post('/api/rag', async (req, res) => {
    const question = (req.body && req.body.question || '').toString().trim();
    if (!question) {
        return res.status(400).json({ error: 'Falta la pregunta.' });
    }
    try {
        const raw = await callLLM(question);
        res.json({ response: toChatMessage(raw) });
    } catch (err) {
        console.error('[api/rag] error:', err.message);
        res.status(502).json({ error: 'Error consultando el servicio de IA.' });
    }
});

// ---- Estático: eliminado, Firebase Hosting se encarga de servir demo/ ----

// Exporta la aplicación express como una función de Firebase (v2)
exports.api = onRequest(app);
