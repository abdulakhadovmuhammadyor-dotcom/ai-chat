/**
 * Backend чата ИИ-агента «Нейра».
 *
 * Что делает:
 *   - отдаёт статику демо-страницы (index.html, styles/, src/);
 *   - POST /api/chat  — вопрос пользователя → ответ Gemini (+ память диалога);
 *   - GET  /api/health — состояние сервера и наличие ключа Gemini.
 *
 * Ключ Gemini хранится только здесь, в .env (GEMINI_API_KEY).
 * Если ключа нет или Gemini недоступен, сервер отвечает мок-данными
 * из src/mock/mockChat.js — интерфейс остаётся рабочим end-to-end.
 *
 * Запуск: npm start  (или node server/index.js)
 */
'use strict';

const path = require('path');

// .env читаем до подключения модулей, которые читают process.env на старте.
try {
  process.loadEnvFile(path.join(__dirname, '..', '.env'));
} catch (err) {
  // Файла .env нет — работаем на переменных окружения / в мок-режиме.
}

const express = require('express');
const gemini = require('./gemini.js');
const mocks = require('../src/mock/mockChat.js');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT || 5173);
const MAX_MESSAGE_LENGTH = 2000;

// Память диалога: sessionId → id прошлого interaction в Gemini.
// TODO: заменить на реальное хранилище (Redis/БД) при выходе в прод.
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_SESSIONS = 500;
const sessions = new Map();

function getSession(sessionId) {
  const key = String(sessionId || '').trim() || 'anonymous';
  const existing = sessions.get(key);
  if (existing) {
    existing.updatedAt = Date.now();
    return existing;
  }
  const created = { interactionId: null, updatedAt: Date.now() };
  sessions.set(key, created);
  if (sessions.size > MAX_SESSIONS) {
    const oldestKey = sessions.keys().next().value;
    sessions.delete(oldestKey);
  }
  return created;
}

function cleanupSessions() {
  const now = Date.now();
  sessions.forEach((session, key) => {
    if (now - session.updatedAt > SESSION_TTL_MS) sessions.delete(key);
  });
}

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

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));

// Простой лог запросов к API — удобно видеть, отвечает Gemini или мок.
app.use(function (req, res, next) {
  if (!req.path.startsWith('/api/')) return next();
  const startedAt = Date.now();
  res.on('finish', function () {
    console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - startedAt} мс)`);
  });
  next();
});

// CORS: страница может открываться с другого порта или по file://.
app.use('/api', function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/api/health', function (req, res) {
  res.json({
    ok: true,
    gemini: gemini.isConfigured(),
    model: gemini.modelName(),
    transport: gemini.activeTransportName(),
    mode: gemini.isConfigured() ? 'gemini' : 'mock',
  });
});

app.post('/api/chat', async function (req, res) {
  const body = req.body || {};
  const message = String(body.message || '').trim().slice(0, MAX_MESSAGE_LENGTH);
  const history = normalizeHistory(body.history);
  const currency = normalizeCurrency(body.currency);

  if (!message) {
    return res.status(400).json({ error: 'empty_message', message: 'Поле message обязательно' });
  }

  // Ключа нет — отвечаем мок-данными (см. AGENTS.md: мок-режим должен работать).
  if (!gemini.isConfigured()) {
    const mock = mocks.mockReply(message);
    return res.json({
      reply: mock.reply,
      quickReplies: mock.quickReplies,
      source: 'mock',
      reason: 'no-api-key',
      model: null,
      degraded: true,
    });
  }

  const session = getSession(body.sessionId);

  try {
    const answer = await gemini.askGemini({
      message: message,
      history: history,
      previousInteractionId: session.interactionId,
      currency: currency,
    });
    session.interactionId = answer.interactionId || session.interactionId;

    return res.json({
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
    const mock = mocks.mockReply(message);
    return res.json({
      reply: mock.reply,
      quickReplies: mock.quickReplies,
      source: 'mock',
      reason: 'gemini-error',
      detail: gemini.describeError(err),
      model: gemini.modelName(),
      degraded: true,
    });
  }
});

app.use('/api', function (req, res) {
  res.status(404).json({ error: 'not_found', message: 'Неизвестный эндпоинт' });
});

// Статика демо-страницы. Отдаём только публичные каталоги: исходники backend
// (server/), package.json и .env наружу не выставляем.
app.use('/styles', express.static(path.join(ROOT, 'styles')));
app.use('/src', express.static(path.join(ROOT, 'src')));
app.get('/', function (req, res) {
  res.sendFile(path.join(ROOT, 'index.html'));
});
app.use(function (req, res) {
  res.status(404).type('text/plain; charset=utf-8').send('404 — страница не найдена');
});

const server = app.listen(PORT, function () {
  const mode = gemini.isConfigured()
    ? `Gemini (${gemini.modelName()})`
    : 'мок-ответы — задайте GEMINI_API_KEY в .env, чтобы включить Gemini';
  console.log('');
  console.log('  Чат ИИ-агента «Нейра» запущен');
  console.log(`  Страница:  http://localhost:${PORT}/`);
  console.log(`  API:       http://localhost:${PORT}/api/chat`);
  console.log(`  Режим:     ${mode}`);
  console.log('');
});

const cleanupTimer = setInterval(cleanupSessions, 5 * 60 * 1000);
cleanupTimer.unref();

// Корректное завершение (Ctrl+C) — чтобы не держать порт при перезапуске.
['SIGINT', 'SIGTERM'].forEach(function (signal) {
  process.on(signal, function () {
    server.close(function () {
      process.exit(0);
    });
  });
});

module.exports = app;
