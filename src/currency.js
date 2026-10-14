/**
 * Пересчёт и форматирование цен по курсам валют.
 *
 * Логика отделена от мок-данных: курсы и список валют передаются аргументами
 * (см. src/mock/mockCurrency.js). Модуль универсальный — работает в браузере
 * и в Node, поэтому сервер может форматировать те же суммы, что и витрина.
 *
 * Публичный API: window.ChatCurrency
 *   convert(amountInBase, code, rates)         — пересчёт суммы
 *   formatMoney(amountInBase, code, options)   — готовая строка с символом валюты
 *   findCurrency(currencies, code)             — описание валюты
 */
(function (global) {
  'use strict';

  /** Описание валюты по коду (по умолчанию — первая в списке). */
  function findCurrency(currencies, code) {
    var list = Array.isArray(currencies) ? currencies : [];
    var wanted = String(code || '').toUpperCase();
    for (var i = 0; i < list.length; i += 1) {
      if (list[i] && String(list[i].code).toUpperCase() === wanted) return list[i];
    }
    return list[0] || null;
  }

  /** Пересчёт суммы из базовой валюты в целевую. */
  function convert(amountInBase, code, rates) {
    var value = Number(amountInBase);
    if (!isFinite(value)) return 0;
    var rate = rates && rates[String(code || '').toUpperCase()];
    if (!rate) return value;
    return value * rate;
  }

  /** Округление до шага валюты (сум не показывают с копейками). */
  function roundTo(value, step) {
    var size = Number(step);
    if (!size) return value;
    return Math.round(value / size) * size;
  }

  /**
   * Сумма в базовой валюте → строка в нужной валюте.
   * @param {number} amountInBase сумма в базовой валюте (в mockChat — рубли)
   * @param {string} code код валюты: RUB | UZS | USD
   * @param {{currencies?: Array, rates?: Object}} [options]
   * @returns {string} например «64 990 ₽», «9 326 000 сум», «$734.39»
   */
  function formatMoney(amountInBase, code, options) {
    var config = options || {};
    var currency = findCurrency(config.currencies, code);
    if (!currency) return String(amountInBase);

    var value = roundTo(convert(amountInBase, currency.code, config.rates), currency.step);

    var formatted;
    try {
      formatted = value.toLocaleString(currency.locale, {
        minimumFractionDigits: currency.decimals || 0,
        maximumFractionDigits: currency.decimals || 0,
      });
    } catch (err) {
      formatted = String(value);
    }

    if (!formatted || formatted === '0') formatted = '0';
    return currency.prefix ? currency.symbol + formatted : formatted + ' ' + currency.symbol;
  }

  /** Число курса в привычном виде: 143,5 · 88,50. */
  function formatRate(value) {
    var rounded = Math.round(value * 100) / 100;
    return String(rounded).replace('.', ',');
  }

  /** Краткая подпись курсов: «1 ₽ ≈ 143,5 сум · 1 $ ≈ 88,5 ₽». */
  function describeRates(base, rates, currencies) {
    var list = Array.isArray(currencies) ? currencies : [];
    var baseInfo = findCurrency(currencies, base) || { symbol: base };
    var parts = [];
    for (var i = 0; i < list.length; i += 1) {
      var currency = list[i];
      if (!currency || currency.code === base) continue;
      var rate = rates && rates[currency.code];
      if (!rate) continue;
      parts.push(
        rate >= 1
          ? '1 ' + baseInfo.symbol + ' ≈ ' + formatRate(rate) + ' ' + currency.symbol
          : '1 ' + currency.symbol + ' ≈ ' + formatRate(1 / rate) + ' ' + baseInfo.symbol
      );
    }
    return parts.join(' · ');
  }

  var api = {
    convert: convert,
    formatMoney: formatMoney,
    findCurrency: findCurrency,
    roundTo: roundTo,
    describeRates: describeRates,
  };

  global.ChatCurrency = api;

  // Экспорт для Node (server/, mockChat.js).
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
