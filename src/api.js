/**
 * Тонкий клиент к backend чата (POST /api/chat).
 *
 * Задача слоя — изолировать виджет от деталей транспорта: таймауты,
 * идентификатор сессии для памяти диалога, разбор ошибок. Если backend
 * недоступен, промис отклоняется, а виджет отвечает мок-данными.
 *
 * Публичный API: window.ChatApi.create({url, timeout, sessionId}) -> client
 *   client.ask(message, history) -> Promise<{reply, quickReplies, source, degraded}>
 *   client.health() -> Promise<{ok, gemini, model, mode}>
 */
(function (global) {
  'use strict';

  var DEFAULT_TIMEOUT = 25000;
  var SESSION_KEY = 'ai-chat.sessionId';

  function randomId(prefix) {
    return (prefix || 'id') + '-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  /** Id сессии для памяти диалога на сервере (живёт в пределах вкладки). */
  function readSessionId() {
    try {
      var existing = global.sessionStorage && global.sessionStorage.getItem(SESSION_KEY);
      if (existing) return existing;
      var created = randomId('sess');
      if (global.sessionStorage) global.sessionStorage.setItem(SESSION_KEY, created);
      return created;
    } catch (err) {
      // Приватный режим / file:// — память диалога будет только в рамках страницы.
      return randomId('sess');
    }
  }

  function ApiError(message, status) {
    this.name = 'ApiError';
    this.message = message;
    this.status = status || 0;
  }
  ApiError.prototype = Object.create(Error.prototype);
  ApiError.prototype.constructor = ApiError;

  function ApiClient(options) {
    this.url = (options && options.url) || '/api/chat';
    this.timeout = (options && options.timeout) || DEFAULT_TIMEOUT;
    this.sessionId = (options && options.sessionId) || readSessionId();
  }

  /** fetch с таймаутом и своим сообщением об ошибке. */
  ApiClient.prototype.request = function (url, payload) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (controller) controller.abort();
    }, this.timeout);

    function stopTimer() {
      clearTimeout(timer);
    }

    return fetch(url, {
      method: payload ? 'POST' : 'GET',
      headers: payload ? { 'Content-Type': 'application/json' } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
      signal: controller ? controller.signal : undefined,
    })
      .then(function (response) {
        return response.json().catch(function () {
          return {};
        }).then(function (data) {
          if (!response.ok) {
            throw new ApiError(data && data.message ? data.message : 'Ошибка сервера ' + response.status, response.status);
          }
          return data;
        });
      })
      .catch(function (err) {
        if (err instanceof ApiError) throw err;
        if (err && err.name === 'AbortError') throw new ApiError('Превышено время ожидания ответа', 0);
        throw new ApiError('Backend недоступен: ' + (err && err.message ? err.message : 'network error'), 0);
      })
      .then(
        function (data) {
          stopTimer();
          return data;
        },
        function (err) {
          stopTimer();
          throw err;
        }
      );
  };

  /**
   * Спросить ассистента.
   * @param {string} message вопрос пользователя
   * @param {Array<{author: string, text: string}>} [history] предыдущие сообщения
   * @param {string} [currency] валюта, в которой пользователь смотрит цены (RUB|UZS|USD)
   * @returns {Promise<{reply: string, quickReplies: string[], source: string, degraded: boolean}>}
   */
  ApiClient.prototype.ask = function (message, history, currency) {
    return this.request(this.url, {
      sessionId: this.sessionId,
      message: message,
      history: history || [],
      currency: currency || undefined,
    });
  };

  /** Состояние backend: включён ли Gemini. */
  ApiClient.prototype.health = function () {
    return this.request(this.url.replace(/\/api\/chat\/?$/, '/api/health'));
  };

  global.ChatApi = {
    create: function (options) {
      return new ApiClient(options);
    },
    ApiError: ApiError,
    readSessionId: readSessionId,
  };
})(typeof window !== 'undefined' ? window : globalThis);
