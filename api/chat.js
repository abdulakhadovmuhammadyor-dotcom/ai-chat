/**
 * Vercel serverless-функция: POST /api/chat.
 *
 * Логика та же, что и в server/index.js (локальный Express-сервер), но в виде
 * хендлера Vercel Node Runtime. Ответ генерирует Gemini; если ключа нет или
 * Gemini недоступен — отвечаем мок-данными из src/mock/mockChat.js
 * (см. AGENTS.md: мок-режим должен работать всегда).
 *
 * Функция stateless: память диалога передаётся клиентом в поле history.
 * Тот же контракт, что и у локального сервера:
 *   { sessionId, message, history, currency } → { reply, quickReplies, source, ... }
 *
 * TODO: заменить на реальные данные / другой backend при выходе в прод.
 */
'use strict';

const gemini = require('../server/gemini.js');
const mocks = require('../src/mock/mockChat.js');

const MAX_MESSAGE_LENGTH = 2000;

function normalizeHistory(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item.text === 'string' && item.text.trim())
    .map((item) => ({
      author: item.author === 'user' ? 'user' : 'agent',
      text: String(item.text).trim().slice(0, MAX_MESSAGE_LENGTH),
    }))
    .slice(-20);
}

/** Валюта цен, выбранная пользователем на витрине (RUB|UZS|USD). */
function normalizeCurrency(value) {
  const code = String(value || '').trim().toUpperCase();
  return mocks.mockCurrencies.some((item) => item.code === code) ? code : '';
}

/** Тело запроса: Vercel обычно уже распарсил JSON, но подстрахуемся. */
function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body) {
    try {
      return JSON.parse(req.body);
    } catch (err) {
      return {};
    }
  }
  return {};
}

function sendMock(res, message, reason, detail) {
  const mock = mocks.mockReply(message);
  return res.status(200).json({
    reply: mock.reply,
    quickReplies: mock.quickReplies,
    source: 'mock',
    reason: reason,
    detail: detail,
    model: gemini.modelName(),
    degraded: true,
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const body = readBody(req);
  const message = String(body.message || '').trim().slice(0, MAX_MESSAGE_LENGTH);
  const history = normalizeHistory(body.history);
  const currency = normalizeCurrency(body.currency);

  if (!message) {
    return res.status(400).json({ error: 'empty_message', message: 'Поле message обязательно' });
  }

  // Ключа нет — отвечаем мок-данными.
  if (!gemini.isConfigured()) {
    return sendMock(res, message, 'no-api-key');
  }

  try {
    const answer = await gemini.askGemini({ message: message, history: history, currency: currency });
    return res.status(200).json({
      reply: answer.reply,
      quickReplies: answer.quickReplies,
      source: 'gemini',
      model: answer.model,
      transport: answer.transport,
      degraded: false,
    });
  } catch (err) {
    // Gemini недоступен — не ломаем чат, отдаём мок-ответ.
    console.warn('[api/chat] ' + gemini.describeError(err));
    return sendMock(res, message, 'gemini-error', gemini.describeError(err));
  }
};
