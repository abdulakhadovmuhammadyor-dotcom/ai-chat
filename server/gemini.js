/**
 * Вызовы Gemini API — «мозги» ИИ-ассистента на стороне backend.
 *
 * Ключ API живёт только на сервере (env GEMINI_API_KEY) и никогда не попадает
 * в браузер. Если ключа нет или Gemini вернул ошибку, вызывающий код
 * (server/index.js) отвечает мок-данными из src/mock/mockChat.js.
 *
 * Поддерживаются два транспорта (см. GEMINI_TRANSPORT):
 *   - generate-content — POST /v1beta/models/{model}:generateContent (классический);
 *   - interactions     — POST /v1beta/interactions (новый API Gemini).
 * В режиме auto начинаем с generate-content (доступен шире) и один раз
 * откатываемся на interactions, если первый не подошёл. Рабочий транспорт
 * кешируется, поэтому дальше запросы идут сразу по верному пути.
 */
'use strict';

const { RESPONSE_SCHEMA, buildSystemInstruction } = require('./prompt.js');

const API_BASE = (process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 25000);
const THINKING_LEVEL = String(process.env.GEMINI_THINKING_LEVEL || '').trim();

/** Статусы, при которых имеет смысл попробовать второй транспорт (ошибки API, а не запроса). */
const RETRYABLE_STATUS = [400, 403, 404, 405, 429, 500, 501, 502, 503, 504];

const TRANSPORTS = {
  INTERACTIONS: 'interactions',
  GENERATE_CONTENT: 'generate-content',
};

/** Транспорт, который точно работает: определяется при первом успешном ответе. */
let activeTransport = null;

class GeminiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
    this.body = body;
  }
}

/** Настроен ли ключ (без него сервер работает на моках). */
function isConfigured() {
  return Boolean(String(process.env.GEMINI_API_KEY || '').trim());
}

function modelName() {
  return DEFAULT_MODEL;
}

function initialTransport() {
  const fromEnv = String(process.env.GEMINI_TRANSPORT || 'auto').toLowerCase();
  if (fromEnv === TRANSPORTS.INTERACTIONS || fromEnv === TRANSPORTS.GENERATE_CONTENT) return fromEnv;
  return activeTransport || TRANSPORTS.GENERATE_CONTENT;
}

/** Транспорт-«напарник» на случай, если основной не подошёл. */
function otherTransport(transport) {
  return transport === TRANSPORTS.INTERACTIONS ? TRANSPORTS.GENERATE_CONTENT : TRANSPORTS.INTERACTIONS;
}

/** Название транспорта, который реально отвечает (null — ещё не определён). */
function activeTransportName() {
  return activeTransport;
}

/** Короткий безопасный текст ошибки (ключ не логируем). */
function describeError(err) {
  if (err instanceof GeminiError) return `Gemini ${err.status}: ${err.message}`;
  if (err && err.name === 'TimeoutError') return 'Gemini: превышено время ожидания';
  return 'Gemini: ' + (err && err.message ? err.message : String(err));
}

async function postJson(path, body, apiKey, timeoutMs) {
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs || TIMEOUT_MS),
  });

  const raw = await res.text();
  let json = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch (err) {
    /* не-JSON ответ — оставляем как текст ошибки */
  }

  if (!res.ok) {
    const apiMessage = json && json.error && json.error.message ? json.error.message : raw.slice(0, 300);
    throw new GeminiError(apiMessage || res.statusText, res.status, json);
  }
  return json || {};
}

// ---------- Разбор ответов ----------

/** Текст ответа из ответа Interactions API. */
function extractInteractionText(data) {
  if (data && typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text;

  const steps = Array.isArray(data && data.steps) ? data.steps : [];
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const content = steps[i] && steps[i].content;
    if (!Array.isArray(content)) continue;
    const text = content
      .filter((part) => part && part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('');
    if (text.trim()) return text;
  }
  return '';
}

/** Текст ответа из классического generateContent (части «раздумий» отбрасываем). */
function extractGenerateContentText(data) {
  const candidate = data && Array.isArray(data.candidates) ? data.candidates[0] : null;
  if (!candidate) {
    const reason = data && data.promptFeedback && data.promptFeedback.blockReason;
    throw new GeminiError(reason ? `запрос заблокирован (${reason})` : 'пустой ответ модели', 502, data);
  }
  const parts = candidate.content && Array.isArray(candidate.content.parts) ? candidate.content.parts : [];
  return parts
    .filter((part) => part && !part.thought && typeof part.text === 'string')
    .map((part) => part.text)
    .join('');
}

/** Снимает экранирование JSON-строки: \n, \" и т.п. */
function unescapeJsonString(value) {
  try {
    return JSON.parse('"' + value + '"');
  } catch (err) {
    return value;
  }
}

/** Чипы быстрых ответов: не больше четырёх коротких строк. */
function normalizeQuickReplies(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string' && item.trim())
    .map((item) => item.trim().slice(0, 60))
    .slice(0, 4);
}

/** Вырезает JSON-объект из ответа модели (в т.ч. обрезанный по лимиту токенов). */
function extractJsonObject(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;
  const end = text.lastIndexOf('}');
  return end > start ? text.slice(start, end + 1) : text.slice(start);
}

/**
 * Спасает поля из обрезанного JSON: `{"reply":"половина отве` .
 * Такое случается, когда модель не уложилась в лимит токенов.
 */
function salvageFields(text) {
  const key = text.match(/"reply"\s*:\s*"/);
  if (!key) return null;

  const rest = text.slice(key.index + key[0].length);
  let raw = '';
  for (let i = 0; i < rest.length; i += 1) {
    const char = rest[i];
    if (char === '\\') {
      raw += char + (rest[i + 1] || '');
      i += 1;
      continue;
    }
    if (char === '"') break;
    raw += char;
  }

  const reply = unescapeJsonString(raw).trim();
  if (!reply) return null;

  // Чипы берём из остатка текста: он может быть обрезан, это не критично.
  const chipsBlock = text.match(/"quickReplies"\s*:\s*\[([\s\S]*?)(?:\]|$)/);
  const chips = chipsBlock ? chipsBlock[1].match(/"((?:[^"\\]|\\.)*)"/g) || [] : [];

  return {
    reply,
    quickReplies: normalizeQuickReplies(chips.map((item) => unescapeJsonString(item.slice(1, -1)))),
  };
}

/** Убирает JSON-обёртку, если модель ответила текстом с фигурными скобками. */
function stripEnvelope(text) {
  const trimmed = text.trim();
  const withoutKey = trimmed.replace(/^\{\s*"reply"\s*:\s*"?/, '').replace(/"\s*,?\s*\}?$/, '');
  return (withoutKey || trimmed).trim();
}

/**
 * Приводит ответ модели к контракту API: { reply, quickReplies }.
 *
 * Модель отвечает JSON по схеме, но ответ может прийти обрезанным,
 * в ```-блоке или с лишним текстом вокруг. Разбираем по шагам:
 * полный JSON → спасение полей из обрезанного JSON → текст без обёртки.
 * Ошибка разбора не должна утекать пользователю сырым JSON.
 */
function parseReply(rawText) {
  let text = String(rawText || '').trim();
  if (!text) return { reply: '', quickReplies: [] };

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();

  const candidate = extractJsonObject(text);
  if (candidate) {
    try {
      const parsed = JSON.parse(candidate);
      const reply = typeof parsed.reply === 'string' ? parsed.reply.trim() : '';
      if (reply) return { reply, quickReplies: normalizeQuickReplies(parsed.quickReplies) };
    } catch (err) {
      const salvaged = salvageFields(candidate);
      if (salvaged) return salvaged;
    }
  }

  return { reply: stripEnvelope(text), quickReplies: [] };
}

// ---------- Транспорты ----------

/**
 * Шаги диалога для Interactions API (только когда нет серверной сессии).
 */
function toInteractionSteps(history, message) {
  const steps = [];
  (history || []).forEach((item) => {
    const text = String((item && item.text) || '').trim();
    if (!text) return;
    steps.push({
      type: item.author === 'user' ? 'user_input' : 'model_output',
      content: [{ type: 'text', text }],
    });
  });
  steps.push({ type: 'user_input', content: [{ type: 'text', text: message }] });
  return steps;
}

async function callInteractions(params) {
  const body = {
    model: params.model,
    input: toInteractionSteps(params.history, params.message),
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: RESPONSE_SCHEMA,
    },
  };

  if (THINKING_LEVEL) body.generation_config = { thinking_level: THINKING_LEVEL };

  if (params.previousInteractionId) {
    // Продолжаем диалог на стороне Google — инструкцию повторно не передаём.
    body.previous_interaction_id = params.previousInteractionId;
    body.input = params.message;
  } else {
    // Валюта клиента уходит в инструкцию только на первом шаге: при продолжении
    // диалога Google держит инструкцию у себя (смена валюты не подхватится).
    body.system_instruction = buildSystemInstruction({ currency: params.currency });
  }

  const data = await postJson('/interactions', body, params.apiKey, params.timeoutMs);
  return {
    text: extractInteractionText(data),
    interactionId: data && data.id ? data.id : null,
  };
}

async function callGenerateContent(params) {
  const contents = (params.history || [])
    .filter((item) => item && String(item.text || '').trim())
    .map((item) => ({
      role: item.author === 'user' ? 'user' : 'model',
      parts: [{ text: String(item.text) }],
    }));
  contents.push({ role: 'user', parts: [{ text: params.message }] });

  const body = {
    systemInstruction: { parts: [{ text: buildSystemInstruction({ currency: params.currency }) }] },
    contents,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      // Запас с учётом «раздумий» модели: слишком маленький лимит обрезает JSON.
      maxOutputTokens: 2048,
      // TODO: при необходимости добавить thinkingConfig (см. docs Gemini «Thinking»).
    },
  };

  const data = await postJson(
    `/models/${encodeURIComponent(params.model)}:generateContent`,
    body,
    params.apiKey,
    params.timeoutMs
  );

  const candidate = data && Array.isArray(data.candidates) ? data.candidates[0] : null;
  if (candidate && candidate.finishReason === 'MAX_TOKENS') {
    console.warn('[gemini] ответ обрезан по лимиту токенов (MAX_TOKENS)');
  }

  return { text: extractGenerateContentText(data), interactionId: null };
}

/**
 * Главная функция: получить ответ ассистента от Gemini.
 *
 * @param {object} params
 * @param {string} params.message            вопрос пользователя
 * @param {Array}  [params.history]          предыдущие сообщения [{author, text}]
 * @param {string} [params.previousInteractionId] id прошлого interaction (память диалога)
 * @param {string} [params.currency]         валюта, выбранная пользователем на сайте (RUB|UZS|USD)
 * @returns {Promise<{reply: string, quickReplies: string[], interactionId: string|null, model: string, transport: string}>}
 */
async function askGemini(params) {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) throw new GeminiError('GEMINI_API_KEY не задан', 0, null);

  const request = {
    apiKey,
    model: DEFAULT_MODEL,
    message: String(params.message || '').trim(),
    history: Array.isArray(params.history) ? params.history.slice(-20) : [],
    previousInteractionId: params.previousInteractionId || null,
    currency: typeof params.currency === 'string' ? params.currency.toUpperCase() : '',
    timeoutMs: TIMEOUT_MS,
  };

  const preferred = activeTransport || initialTransport();
  const order = activeTransport ? [activeTransport, otherTransport(activeTransport)] : [preferred, otherTransport(preferred)];

  // Общий бюджет времени на запрос: если первый транспорт «съел» его часть,
  // второму остаётся только остаток (клиент ждёт не больше общего бюджета).
  const deadline = Date.now() + TIMEOUT_MS;

  let lastError = null;

  for (let i = 0; i < order.length; i += 1) {
    const transport = order[i];
    request.timeoutMs = Math.max(3000, deadline - Date.now());
    try {
      const result = transport === TRANSPORTS.INTERACTIONS ? await callInteractions(request) : await callGenerateContent(request);

      if (!result.text || !result.text.trim()) throw new GeminiError('пустой ответ модели', 502, null);

      activeTransport = transport;
      const parsed = parseReply(result.text);
      return {
        reply: parsed.reply,
        quickReplies: parsed.quickReplies,
        interactionId: result.interactionId,
        model: request.model,
        transport,
      };
    } catch (err) {
      lastError = err;
      const canFallback = i < order.length - 1 && err instanceof GeminiError && RETRYABLE_STATUS.includes(err.status);
      if (!canFallback) break;
      console.warn(`[gemini] транспорт ${transport} недоступен (${describeError(err)}), пробую ${order[i + 1]}`);
    }
  }

  throw lastError || new GeminiError('неизвестная ошибка Gemini', 0, null);
}

module.exports = {
  askGemini,
  isConfigured,
  modelName,
  activeTransportName,
  describeError,
  parseReply,
  GeminiError,
  TRANSPORTS,
};
