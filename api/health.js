/**
 * Vercel serverless-функция: GET /api/health.
 *
 * Возвращает состояние backend: включён ли Gemini и какая модель используется.
 * Контракт совпадает с локальным server/index.js.
 */
'use strict';

const gemini = require('../server/gemini.js');

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();

  return res.status(200).json({
    ok: true,
    gemini: gemini.isConfigured(),
    model: gemini.modelName(),
    transport: gemini.activeTransportName(),
    mode: gemini.isConfigured() ? 'gemini' : 'mock',
  });
};
