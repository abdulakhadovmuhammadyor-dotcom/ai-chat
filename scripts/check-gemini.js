/**
 * Диагностика подключения к Gemini.
 *
 * Показывает, какие настройки видит backend, и пробует получить живой ответ
 * модели. Запуск:
 *     npm run check:gemini
 *     npm run check:gemini -- --transport=generate-content
 *
 * Ключ не печатается — только факт, что он задан.
 */
'use strict';

const path = require('path');

try {
  process.loadEnvFile(path.join(__dirname, '..', '.env'));
} catch (err) {
  // .env отсутствует — смотрим только переменные окружения.
}

const transportArg = process.argv.slice(2).find((arg) => arg.startsWith('--transport='));
if (transportArg) {
  process.env.GEMINI_TRANSPORT = transportArg.split('=')[1];
}

const gemini = require('../server/gemini.js');

async function main() {
  console.log('--- Настройки -------------------------------------------------');
  console.log('GEMINI_API_KEY:      ', gemini.isConfigured() ? 'задан' : 'НЕ задан (чат будет на мок-ответах)');
  console.log('GEMINI_MODEL:        ', gemini.modelName());
  console.log('GEMINI_TRANSPORT:    ', process.env.GEMINI_TRANSPORT || 'auto');
  console.log('GEMINI_THINKING:     ', process.env.GEMINI_THINKING_LEVEL || '(не задан)');
  console.log('GEMINI_API_BASE:     ', process.env.GEMINI_API_BASE || '(по умолчанию)');
  console.log('---------------------------------------------------------------');

  if (!gemini.isConfigured()) {
    console.log('Ключ не найден. Впишите GEMINI_API_KEY в .env и повторите.');
    process.exitCode = 1;
    return;
  }

  const startedAt = Date.now();
  try {
    const answer = await gemini.askGemini({
      message: 'Здравствуйте! Где мой заказ №482913?',
      history: [],
    });
    console.log(`OK · ${Date.now() - startedAt} мс · транспорт ${answer.transport} · модель ${answer.model}`);
    console.log('Ответ модели:', answer.reply);
    console.log('Быстрые ответы:', JSON.stringify(answer.quickReplies));
  } catch (err) {
    console.error(`ОШИБКА · ${Date.now() - startedAt} мс ·`, gemini.describeError(err));
    process.exitCode = 1;
  }
}

main();
