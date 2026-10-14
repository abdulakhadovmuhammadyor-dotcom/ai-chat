/**
 * Мок-данные о валютах и курсах для витрины и ассистента.
 *
 * Цены товаров в src/mock/mockChat.js заданы в базовой валюте (mockBaseCurrency).
 * Курсы ниже — демонстрационные, для показа цен в рублях, сумах и долларах.
 * TODO: заменить на реальные данные (API ЦБ или биржевой курс).
 *
 * Модуль универсальный: подключается и в браузере, и в Node (см. mockChat.js).
 */
(function (global) {
  'use strict';

  /** Валюта, в которой заданы цены товаров. */
  var mockBaseCurrency = 'RUB';

  /** Курсы валют к базовой: 1 USD ≈ 88,50 ₽, 1 ₽ ≈ 143,50 сум. */
  var mockExchangeRates = {
    RUB: 1,
    UZS: 143.5,
    USD: 0.0113,
  };

  /**
   * Валюты, доступные в переключателе цен.
   * step — шаг округления (сум не показывают с копейками),
   * prefix — символ ставится перед числом ($1 234.56) или после него.
   */
  var mockCurrencies = [
    {
      code: 'RUB',
      symbol: '₽',
      label: 'Рубль',
      title: 'Российский рубль',
      locale: 'ru-RU',
      decimals: 0,
      step: 1,
      prefix: false,
    },
    {
      code: 'UZS',
      symbol: 'сум',
      label: 'Сум',
      title: 'Узбекский сум',
      locale: 'ru-RU',
      decimals: 0,
      step: 1000,
      prefix: false,
    },
    {
      code: 'USD',
      symbol: '$',
      label: 'Доллар',
      title: 'Доллар США',
      locale: 'en-US',
      decimals: 2,
      step: 0.01,
      prefix: true,
    },
  ];

  /** Сводка о курсах — показывается на странице и в ответах ассистента. */
  var mockRates = {
    base: mockBaseCurrency,
    rates: mockExchangeRates,
    updatedAt: '2026-10-14T09:00:00+05:00',
    source: 'мок-курс для демо',
  };

  var api = {
    mockBaseCurrency: mockBaseCurrency,
    mockExchangeRates: mockExchangeRates,
    mockCurrencies: mockCurrencies,
    mockRates: mockRates,
  };

  global.ChatCurrencyMocks = api;

  // Экспорт для Node (server/ и mockChat.js) — браузер эту ветку не выполняет.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
