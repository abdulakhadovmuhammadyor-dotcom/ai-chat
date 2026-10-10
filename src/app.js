/**
 * Инициализация демонстрационной страницы и чат-виджета.
 * Все данные берутся из мок-модуля src/mock/mockChat.js.
 * TODO: заменить на реальные данные / API.
 */
(function () {
  'use strict';

  function el(tag, className, html) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function formatPrice(value) {
    return value.toLocaleString('ru-RU') + ' ₽';
  }

  function renderNav() {
    var nav = document.getElementById('site-nav');
    if (!nav) return;
    window.ChatMocks.mockNav.forEach(function (item) {
      var a = el('a', null, item.label);
      a.href = item.href;
      nav.appendChild(a);
    });
  }

  function renderStats() {
    var root = document.getElementById('stats');
    if (!root) return;
    window.ChatMocks.mockStats.forEach(function (stat) {
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
    window.ChatMocks.mockFeatures.forEach(function (f) {
      root.appendChild(
        el('div', 'feature',
          '<div class="feature-icon">' + f.icon + '</div>' +
          '<h3>' + f.title + '</h3>' +
          '<p>' + f.text + '</p>')
      );
    });
  }

  function renderProducts() {
    var root = document.getElementById('product-grid');
    if (!root) return;
    window.ChatMocks.mockProducts.forEach(function (p) {
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
        '<div class="product-rating">★ ' + p.rating + ' · в наличии</div>' +
        '<div class="product-actions">' +
        '<button class="btn btn-primary" type="button" data-ask="' + p.name + '">Спросить в чате</button>' +
        '</div>' +
        '</div>');
      root.appendChild(card);
    });

    // Кнопка «Спросить в чате» задаёт вопрос ассистенту.
    root.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-ask]');
      if (btn && widget) widget.send('Расскажи про ' + btn.getAttribute('data-ask'));
    });
  }

  var widget = null;

  function initWidget() {
    widget = window.AIChatWidget.init({
      agent: window.ChatMocks.mockAgent,
      welcome: window.ChatMocks.mockMessages,
      quickReplies: window.ChatMocks.mockQuickReplies,
      knowledgeBase: window.ChatMocks.mockKnowledgeBase,
      fallback: window.ChatMocks.mockFallback,
      emojis: window.ChatMocks.mockEmojis,
      brand: 'Neyra',
      autoOpen: true,
      autoOpenDelay: 9000,
    });

    ['open-chat-top', 'open-chat-hero', 'open-chat-support'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', function () { widget.open(); });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderNav();
    renderStats();
    renderFeatures();
    renderProducts();
    initWidget();
  });
})();
