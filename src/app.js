/**
 * Инициализация демонстрационной страницы и чат-виджета.
 * Все данные берутся из мок-модулей src/mock/*.js.
 * Цены показываем в рублях, узбекских сумах и долларах (переключатель в каталоге).
 * TODO: заменить на реальные данные / API.
 */
(function () {
  'use strict';

  var CURRENCY_KEY = 'ai-chat.currency';

  var widget = null;
  var mocks = window.ChatMocks;
  var money = window.ChatCurrency;
  var currency = {
    base: mocks.mockBaseCurrency,
    rates: mocks.mockExchangeRates,
    list: mocks.mockCurrencies,
    current: readSavedCurrency(),
  };

  /** Выбранную валюту запоминаем между визитами. */
  function readSavedCurrency() {
    var fallback = mocks.mockBaseCurrency;
    try {
      var saved = window.localStorage && window.localStorage.getItem(CURRENCY_KEY);
      if (!saved) return fallback;
      // Список валют берём из мок-модуля: объект currency ещё не собран.
      return money.findCurrency(mocks.mockCurrencies, saved) ? saved.toUpperCase() : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function saveCurrency(code) {
    try {
      if (window.localStorage) window.localStorage.setItem(CURRENCY_KEY, code);
    } catch (err) {
      /* приватный режим — выбор просто не сохранится */
    }
  }

  function el(tag, className, html) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (html != null) node.innerHTML = html;
    return node;
  }

  /** Цена в выбранной валюте (суммы заданы в базовой валюте — mockBaseCurrency). */
  function formatPrice(value, code) {
    return money.formatMoney(value, code || currency.current, {
      currencies: currency.list,
      rates: currency.rates,
    });
  }

  function renderNav() {
    var nav = document.getElementById('site-nav');
    if (!nav) return;
    mocks.mockNav.forEach(function (item) {
      var a = el('a', null, item.label);
      a.href = item.href;
      nav.appendChild(a);
    });
  }

  function renderStats() {
    var root = document.getElementById('stats');
    if (!root) return;
    mocks.mockStats.forEach(function (stat) {
      root.appendChild(
        el('div', 'stat',
          '<div class="stat-value">' + stat.value + '</div>' +
          '<div class="stat-label">' + stat.label + '</div>')
      );
    });
  }

  function renderFeatures() {
    var root = document.getElementById('features');
    if (!root) return;
    mocks.mockFeatures.forEach(function (f) {
      root.appendChild(
        el('div', 'feature',
          '<div class="feature-icon">' + f.icon + '</div>' +
          '<h3>' + f.title + '</h3>' +
          '<p>' + f.text + '</p>')
      );
    });
  }

  // ---------- Валюты ----------

  function renderCurrencySwitch() {
    var root = document.getElementById('currency-switch');
    if (!root) return;

    root.innerHTML = '';
    currency.list.forEach(function (item) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'currency-btn' + (item.code === currency.current ? ' is-active' : '');
      btn.setAttribute('data-currency', item.code);
      btn.setAttribute('aria-pressed', item.code === currency.current ? 'true' : 'false');
      btn.title = item.title || item.label;
      btn.textContent = item.symbol;
      root.appendChild(btn);
    });
  }

  function renderRatesNote() {
    var note = document.getElementById('rates-note');
    if (!note) return;
    var rates = money.describeRates(currency.base, currency.rates, currency.list);
    var updated = mocks.mockRates && mocks.mockRates.updatedAt ? new Date(mocks.mockRates.updatedAt) : null;
    var stamp = updated && !isNaN(updated.getTime())
      ? updated.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';
    note.innerHTML =
      'Курсы: ' + rates + (stamp ? ' · обновлено ' + stamp : '') +
      ' · <span class="rates-source">' + ((mocks.mockRates && mocks.mockRates.source) || 'демо-данные') + '</span>';
  }

  function selectCurrency(code) {
    if (!money.findCurrency(currency.list, code)) return;
    currency.current = String(code).toUpperCase();
    saveCurrency(currency.current);
    renderCurrencySwitch();
    renderProductCards();
    // Ассистент отвечает про цены в той же валюте, что выбрана на витрине.
    if (widget && widget.setCurrency) widget.setCurrency(currency.current);
  }

  // ---------- Витрина ----------

  function renderProductCards() {
    var root = document.getElementById('product-grid');
    if (!root) return;

    root.innerHTML = '';
    mocks.mockProducts.forEach(function (p) {
      // Когда выбрана не базовая валюта, показываем исходную цену для сверки.
      var baseHint = currency.current === currency.base
        ? ''
        : '<div class="price-base">в базовой валюте: ' + formatPrice(p.price, currency.base) + '</div>';

      var card = el('article', 'product',
        '<div class="product-media">' + p.emoji +
        '<span class="product-badge">' + p.badge + '</span></div>' +
        '<div class="product-body">' +
        '<div class="product-category">' + p.category + '</div>' +
        '<h3 class="product-name">' + p.name + '</h3>' +
        '<div class="product-price">' +
        '<span class="price-now">' + formatPrice(p.price) + '</span>' +
        '<span class="price-old">' + formatPrice(p.oldPrice) + '</span>' +
        '</div>' +
        baseHint +
        '<div class="product-rating">★ ' + p.rating + ' · в наличии</div>' +
        '<div class="product-actions">' +
        '<button class="btn btn-primary" type="button" data-ask="' + p.name + '">Спросить в чате</button>' +
        '</div>' +
        '</div>');
      root.appendChild(card);
    });
  }

  function initProducts() {
    var root = document.getElementById('product-grid');
    if (!root) return;

    // Кнопка «Спросить в чате» задаёт вопрос ассистенту (обработчик — один на контейнер).
    root.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-ask]');
      if (btn && widget) widget.send('Расскажи про ' + btn.getAttribute('data-ask'));
    });

    renderProductCards();
  }

  function initCurrency() {
    var root = document.getElementById('currency-switch');
    if (root) {
      root.addEventListener('click', function (event) {
        var btn = event.target.closest('[data-currency]');
        if (btn) selectCurrency(btn.getAttribute('data-currency'));
      });
    }
    renderCurrencySwitch();
    renderRatesNote();
  }

  // ---------- Контакты ----------

  /**
   * Телефон автомастерской на странице берём из мок-данных, чтобы кнопка в шапке,
   * блок поддержки и футер не разъезжались с ответами ассистента.
   */
  function renderContacts() {
    var workshop = mocks.mockWorkshop;
    var title = workshop.fullName + ': ' + workshop.hours;

    var header = document.getElementById('header-phone');
    if (header) {
      header.textContent = workshop.phone;
      header.setAttribute('href', workshop.phoneHref);
      header.setAttribute('title', title);
    }

    var support = document.getElementById('support-phone');
    if (support) {
      support.textContent = workshop.phone;
      support.setAttribute('title', title);
    }

    var footer = document.getElementById('footer-phone');
    if (footer) {
      footer.textContent = workshop.phone;
      footer.setAttribute('href', workshop.phoneHref);
      footer.setAttribute('title', title);
    }
  }

  // ---------- Чат ----------

  function initWidget() {
    widget = window.AIChatWidget.init({
      agent: mocks.mockAgent,
      welcome: mocks.mockMessages,
      quickReplies: mocks.mockQuickReplies,
      knowledgeBase: mocks.mockKnowledgeBase,
      fallback: mocks.mockFallback,
      emojis: mocks.mockEmojis,
      brand: mocks.mockShop.name,
      currency: currency.current,
      // Ответы ассистента генерирует backend (server/index.js → Gemini API).
      // Если backend недоступен, виджет сам откатится на мок-ответы.
      apiUrl: window.CHAT_API_URL || '/api/chat',
      autoOpen: true,
      autoOpenDelay: 9000,
    });

    // Подписываем в виджете движок, который реально отвечает.
    widget.checkBackend();

    ['open-chat-top', 'open-chat-hero', 'open-chat-support'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', function () { widget.open(); });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderNav();
    renderStats();
    renderFeatures();
    renderContacts();
    initProducts();
    initCurrency();
    initWidget();
  });
})();
