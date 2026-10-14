/**
 * Плавающий чат-виджет ИИ-агента (в стиле Jivo).
 *
 * Ванильный JS без зависимостей и сборки. Работает при открытии index.html
 * напрямую (file://), поэтому используется обычный <script>, а не ES-модули.
 *
 * Публичный API: window.AIChatWidget.init(options) -> instance
 *   instance.open() / close() / toggle() / send(text)
 *
 * Логика ответов: если задан options.apiUrl и подключён src/api.js, вопрос уходит
 * на backend (POST /api/chat → Gemini, см. server/). Если backend недоступен или
 * отвечает ошибкой, виджет отвечает мок-логикой по ключевым словам из базы знаний —
 * чат остаётся рабочим в любом случае.
 * TODO: заменить мок-ответы на реальные данные / ответы реального API чата.
 */
(function (global) {
  'use strict';

  var ICONS = {
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    minimize: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/></svg>',
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
  };

  function uid(prefix) {
    return (prefix || 'id') + '-' + Math.random().toString(36).slice(2, 9);
  }

  function nowTime() {
    var d = new Date();
    var h = String(d.getHours()).padStart(2, '0');
    var m = String(d.getMinutes()).padStart(2, '0');
    return h + ':' + m;
  }

  function initialsOf(name) {
    if (!name) return '?';
    var parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function fileIcon(kind) {
    if (kind === 'image') return '🖼️';
    if (kind === 'pdf') return '📄';
    return '📎';
  }

  function AIChatWidget() {
    this.options = {};
    this.state = {
      open: false,
      collapsed: false,
      sound: true,
      unread: 0,
      typing: false,
      rendered: false,
      wantScroll: false,
    };
    this.messages = [];
  }

  AIChatWidget.prototype.init = function (options) {
    var opts = options || {};
    this.options = {
      container: opts.container || document.body,
      agent: opts.agent || { name: 'Ассистент', role: 'ИИ-ассистент', initials: 'AI', statusText: 'Онлайн' },
      welcome: opts.welcome || [],
      quickReplies: opts.quickReplies || [],
      knowledgeBase: opts.knowledgeBase || [],
      fallback: opts.fallback || { answer: 'Не совсем понял вопрос. Уточните, пожалуйста.', quickReplies: [] },
      emojis: opts.emojis || [],
      validate: opts.validate,
      brand: opts.brand || 'Neyra',
      apiUrl: opts.apiUrl === undefined ? '' : opts.apiUrl,
      apiTimeout: opts.apiTimeout || 25000,
      // Валюта, в которой пользователь смотрит цены: ассистент отвечает в ней же.
      currency: opts.currency || '',
      autoOpen: !!opts.autoOpen,
      autoOpenDelay: opts.autoOpenDelay || 12000,
    };

    this.mount();
    this.bind();

    // Backend-канал к Gemini. Нет скрипта api.js — работаем только на моках.
    this.api = null;
    if (this.options.apiUrl && global.ChatApi) {
      this.api = global.ChatApi.create({
        url: this.options.apiUrl,
        timeout: this.options.apiTimeout,
      });
    }

    // Автооткрытие по таймеру (как «приглашение» в Jivo).
    if (this.options.autoOpen) {
      var self = this;
      setTimeout(function () {
        if (!self.state.open && !self.state.rendered) {
          self.bumpUnread();
        }
      }, this.options.autoOpenDelay);
    }

    return this;
  };

  AIChatWidget.prototype.mount = function () {
    var root = document.createElement('div');
    root.className = 'aiw-root';
    root.setAttribute('data-open', 'false');
    root.setAttribute('data-collapsed', 'false');

    root.innerHTML =
      '<button class="aiw-launcher" type="button" aria-label="Открыть чат с ИИ-ассистентом">' +
      '<span class="aiw-ping"></span>' +
      '<span class="aiw-launcher-open">' + ICONS.chat + '</span>' +
      '<span class="aiw-launcher-close">' + ICONS.close + '</span>' +
      '<span class="aiw-badge" hidden>0</span>' +
      '</button>' +
      '<section class="aiw-window" role="dialog" aria-label="Чат с ИИ-ассистентом">' +
      '<header class="aiw-header">' +
      '<div class="aiw-agent">' +
      '<span class="aiw-avatar"><span data-role="agent-initials">AI</span><span class="aiw-presence"></span></span>' +
      '<span class="aiw-agent-meta">' +
      '<span class="aiw-agent-name" data-role="agent-name">Ассистент</span>' +
      '<span class="aiw-agent-role" data-role="agent-role">Онлайн</span>' +
      '</span>' +
      '</div>' +
      '<div class="aiw-header-actions">' +
      '<button class="aiw-icon-btn" type="button" data-action="sound" aria-pressed="true" title="Звук уведомлений">' + ICONS.sound + '</button>' +
      '<button class="aiw-icon-btn" type="button" data-action="minimize" title="Свернуть">' + ICONS.minimize + '</button>' +
      '<button class="aiw-icon-btn" type="button" data-action="close" title="Закрыть">' + ICONS.close + '</button>' +
      '</div>' +
      '</header>' +
      '<div class="aiw-body" data-role="body" role="log" aria-live="polite"></div>' +
      '<div class="aiw-quick" data-role="quick"></div>' +
      '<footer class="aiw-composer">' +
      '<div class="aiw-composer-row">' +
      '<div class="aiw-tools">' +
      '<button class="aiw-tool" type="button" data-action="emoji" title="Эмодзи">😊</button>' +
      '<button class="aiw-tool" type="button" data-action="attach" title="Прикрепить файл">📎</button>' +
      '</div>' +
      '<textarea class="aiw-textarea" data-role="input" rows="1" placeholder="Напишите сообщение…" aria-label="Сообщение"></textarea>' +
      '<button class="aiw-send" type="button" data-action="send" disabled aria-label="Отправить">' + ICONS.send + '</button>' +
      '</div>' +
      '<div class="aiw-powered" data-role="powered">Работает на <strong>' + this.options.brand + '</strong> · ИИ-ассистент</div>' +
      '<div class="aiw-emoji-panel" data-role="emoji-panel" hidden></div>' +
      '<input type="file" data-role="file" hidden />' +
      '</footer>' +
      '</section>';

    this.options.container.appendChild(root);
    this.el = {
      root: root,
      launcher: root.querySelector('.aiw-launcher'),
      badge: root.querySelector('.aiw-badge'),
      body: root.querySelector('[data-role="body"]'),
      quick: root.querySelector('[data-role="quick"]'),
      input: root.querySelector('[data-role="input"]'),
      send: root.querySelector('[data-action="send"]'),
      sound: root.querySelector('[data-action="sound"]'),
      emojiPanel: root.querySelector('[data-role="emoji-panel"]'),
      file: root.querySelector('[data-role="file"]'),
      agentInitials: root.querySelector('[data-role="agent-initials"]'),
      agentName: root.querySelector('[data-role="agent-name"]'),
      agentRole: root.querySelector('[data-role="agent-role"]'),
      powered: root.querySelector('[data-role="powered"]'),
    };

    this.el.agentInitials.textContent = this.options.agent.initials || initialsOf(this.options.agent.name);
    this.el.agentName.textContent = this.options.agent.name;
    this.el.agentRole.textContent = this.options.agent.statusText || this.options.agent.role;

    this.buildEmojiPanel();
  };

  AIChatWidget.prototype.buildEmojiPanel = function () {
    var self = this;
    var panel = this.el.emojiPanel;
    panel.innerHTML = '';
    this.options.emojis.forEach(function (emoji) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'aiw-emoji-btn';
      b.textContent = emoji;
      b.addEventListener('click', function () {
        self.el.input.value += emoji;
        self.onInput();
        self.el.input.focus();
      });
      panel.appendChild(b);
    });
  };

  AIChatWidget.prototype.bind = function () {
    var self = this;
    var root = this.el.root;

    this.el.launcher.addEventListener('click', function () {
      self.toggle();
    });

    root.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-action]');
      if (!btn || !root.contains(btn)) return;
      var action = btn.getAttribute('data-action');

      if (action === 'close') {
        self.close();
      } else if (action === 'minimize') {
        self.toggleCollapse();
      } else if (action === 'sound') {
        self.toggleSound();
      } else if (action === 'send') {
        self.submit();
      } else if (action === 'emoji') {
        self.el.emojiPanel.hidden = !self.el.emojiPanel.hidden;
      } else if (action === 'attach') {
        self.el.file.click();
      }
    });

    // Делегированный клик по чипам быстрых ответов.
    this.el.quick.addEventListener('click', function (event) {
      var chip = event.target.closest('.aiw-chip');
      if (chip) self.send(chip.textContent);
    });

    this.el.input.addEventListener('input', function () {
      self.onInput();
    });

    this.el.input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        self.submit();
      }
    });

    this.el.file.addEventListener('change', function () {
      var file = self.el.file.files && self.el.file.files[0];
      if (file) {
        self.sendFile({ name: file.name, size: self.humanSize(file.size), kind: self.kindOf(file.name) });
      }
      self.el.file.value = '';
    });

    // Скрывать панель эмодзи по клику вне неё.
    document.addEventListener('click', function (event) {
      if (!self.el.emojiPanel.hidden && !event.target.closest('.aiw-composer')) {
        self.el.emojiPanel.hidden = true;
      }
    });
  };

  AIChatWidget.prototype.onInput = function () {
    var el = this.el.input;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    this.el.send.disabled = !el.value.trim();
  };

  AIChatWidget.prototype.humanSize = function (bytes) {
    if (!bytes) return '0 Б';
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
  };

  AIChatWidget.prototype.kindOf = function (name) {
    var ext = String(name).split('.').pop().toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].indexOf(ext) !== -1) return 'image';
    if (ext === 'pdf') return 'pdf';
    return 'file';
  };

  // ---------- Открытие / закрытие ----------

  AIChatWidget.prototype.toggle = function () {
    if (this.state.open) this.close();
    else this.open();
  };

  AIChatWidget.prototype.open = function () {
    this.state.open = true;
    this.state.collapsed = false;
    this.el.root.setAttribute('data-open', 'true');
    this.el.root.setAttribute('data-collapsed', 'false');
    this.clearUnread();

    if (!this.state.rendered) {
      this.state.rendered = true;
      this.renderWelcome();
    }

    var self = this;
    setTimeout(function () {
      self.scrollToBottom();
      self.el.input.focus();
    }, 260);
  };

  AIChatWidget.prototype.close = function () {
    this.state.open = false;
    this.el.root.setAttribute('data-open', 'false');
    this.el.emojiPanel.hidden = true;
  };

  AIChatWidget.prototype.toggleCollapse = function () {
    this.state.collapsed = !this.state.collapsed;
    this.el.root.setAttribute('data-collapsed', this.state.collapsed ? 'true' : 'false');
    if (!this.state.collapsed) this.scrollToBottom();
  };

  AIChatWidget.prototype.toggleSound = function () {
    this.state.sound = !this.state.sound;
    this.el.sound.setAttribute('aria-pressed', this.state.sound ? 'true' : 'false');
    this.el.sound.innerHTML = this.state.sound ? ICONS.sound : ICONS.mute;
  };

  // ---------- Непрочитанные ----------

  AIChatWidget.prototype.bumpUnread = function () {
    this.state.unread += 1;
    this.el.badge.hidden = false;
    this.el.badge.textContent = this.state.unread > 9 ? '9+' : String(this.state.unread);
  };

  AIChatWidget.prototype.clearUnread = function () {
    this.state.unread = 0;
    this.el.badge.hidden = true;
    this.el.badge.textContent = '0';
  };

  // ---------- Рендер сообщений ----------

  AIChatWidget.prototype.renderWelcome = function () {
    this.appendDivider('Сегодня');
    var self = this;
    this.options.welcome.forEach(function (msg) {
      self.appendMessage(msg, true);
    });
    var last = this.options.welcome[this.options.welcome.length - 1];
    this.setQuickReplies((last && last.quickReplies) || this.options.quickReplies);
  };

  AIChatWidget.prototype.appendDivider = function (label) {
    var div = document.createElement('div');
    div.className = 'aiw-divider';
    div.innerHTML = '<span>' + label + '</span>';
    this.el.body.appendChild(div);
  };

  AIChatWidget.prototype.appendMessage = function (msg, silent) {
    var author = msg.author || 'agent';
    var wrap = document.createElement('div');
    wrap.className = 'aiw-msg aiw-msg--' + (author === 'user' ? 'user' : 'agent');
    wrap.setAttribute('data-id', msg.id || uid('m'));

    var avatar = document.createElement('span');
    avatar.className = 'aiw-msg-avatar';
    avatar.textContent = author === 'user' ? 'Вы' : (this.options.agent.initials || initialsOf(this.options.agent.name));

    var bubbleWrap = document.createElement('div');
    bubbleWrap.className = 'aiw-bubble-wrap';

    var bubble = document.createElement('div');
    bubble.className = 'aiw-bubble';
    bubble.textContent = msg.text || '';
    bubbleWrap.appendChild(bubble);

    if (msg.attachment) {
      var att = document.createElement('div');
      att.className = 'aiw-attach';
      att.innerHTML =
        '<span class="aiw-attach-icon">' + fileIcon(msg.attachment.kind) + '</span>' +
        '<span><span class="aiw-attach-name">' + msg.attachment.name + '</span><br>' +
        '<span class="aiw-attach-size">' + (msg.attachment.size || '') + '</span></span>';
      wrap.appendChild(avatar);
      bubbleWrap.appendChild(att);
    } else {
      wrap.appendChild(avatar);
    }

    var meta = document.createElement('div');
    meta.className = 'aiw-meta';
    if (author === 'user') {
      meta.innerHTML = '<span class="aiw-ticks" data-status="sent">✓</span><span>' + (msg.time || nowTime()) + '</span>';
    } else {
      meta.innerHTML = '<span>' + (msg.time || nowTime()) + '</span>';
    }
    bubbleWrap.appendChild(meta);

    wrap.appendChild(bubbleWrap);
    this.el.body.appendChild(wrap);

    if (!silent) this.scrollToBottom();
    return wrap;
  };

  AIChatWidget.prototype.setQuickReplies = function (list) {
    // Клик обрабатывается делегированно в bind(), поэтому обработчики не дублируем.
    this.el.quick.innerHTML = '';
    (list || []).forEach(function (label) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'aiw-chip';
      chip.textContent = label;
      this.el.quick.appendChild(chip);
    }, this);
  };

  AIChatWidget.prototype.scrollToBottom = function () {
    var body = this.el.body;
    body.scrollTop = body.scrollHeight;
  };

  // ---------- Набор текста ----------

  AIChatWidget.prototype.showTyping = function () {
    if (this.state.typing) return;
    this.state.typing = true;
    var wrap = document.createElement('div');
    wrap.className = 'aiw-msg aiw-msg--agent';
    wrap.setAttribute('data-role', 'typing');
    wrap.innerHTML =
      '<span class="aiw-msg-avatar">' + (this.options.agent.initials || 'AI') + '</span>' +
      '<div class="aiw-bubble-wrap"><div class="aiw-typing-bubble"><span></span><span></span><span></span></div></div>';
    this.el.body.appendChild(wrap);
    this.scrollToBottom();
  };

  AIChatWidget.prototype.hideTyping = function () {
    this.state.typing = false;
    var el = this.el.body.querySelector('[data-role="typing"]');
    if (el) el.remove();
  };

  // ---------- Отправка ----------

  AIChatWidget.prototype.submit = function () {
    var text = this.el.input.value.trim();
    if (!text) return;
    this.el.input.value = '';
    this.onInput();
    this.send(text);
  };

  AIChatWidget.prototype.send = function (text) {
    if (!this.state.rendered) {
      this.state.rendered = true;
      this.renderWelcome();
    }
    if (!this.state.open) this.open();

    text = String(text).trim();
    if (!text) return;

    var userMsg = { id: uid('user'), author: 'user', text: text, time: nowTime(), status: 'sent' };
    var el = this.appendMessage(userMsg);
    this.messages.push(userMsg);
    this.setQuickReplies([]);
    this.progressStatus(el);
    this.replyTo(text);
  };

  AIChatWidget.prototype.sendFile = function (file) {
    if (!this.state.rendered) {
      this.state.rendered = true;
      this.renderWelcome();
    }
    if (!this.state.open) this.open();
    var userMsg = { id: uid('user'), author: 'user', text: 'Прикрепил файл:', attachment: file, time: nowTime() };
    var el = this.appendMessage(userMsg);
    this.messages.push(userMsg);
    this.progressStatus(el);
    this.replyTo('файл ' + file.name);
  };

  AIChatWidget.prototype.progressStatus = function (msgEl) {
    var ticks = msgEl.querySelector('.aiw-ticks');
    if (!ticks) return;
    setTimeout(function () {
      ticks.textContent = '✓✓';
      ticks.setAttribute('data-status', 'delivered');
    }, 400);
    setTimeout(function () {
      ticks.setAttribute('data-status', 'read');
    }, 1400);
  };

  // ---------- Логика ответа ассистента: Gemini → мок-fallback ----------

  AIChatWidget.prototype.matchIntent = function (text) {
    // Общий матчер из мок-модуля — один источник правил для клиента и сервера.
    if (global.ChatMocks && typeof global.ChatMocks.matchIntent === 'function') {
      return global.ChatMocks.matchIntent(text);
    }
    var query = String(text).toLowerCase();
    var best = null;
    var bestScore = 0;
    this.options.knowledgeBase.forEach(function (item) {
      var score = 0;
      item.keywords.forEach(function (kw) {
        if (query.indexOf(kw.toLowerCase()) !== -1) score += 1;
      });
      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    });
    return best || this.options.fallback;
  };

  /** Локальный мок-ответ — используется, когда backend недоступен. */
  AIChatWidget.prototype.localReply = function (text) {
    if (global.ChatMocks && typeof global.ChatMocks.mockReply === 'function') {
      var result = global.ChatMocks.mockReply(text);
      return { text: result.reply, quickReplies: result.quickReplies, source: 'mock' };
    }
    var intent = this.matchIntent(text);
    return { text: intent.answer, quickReplies: intent.quickReplies || [], source: 'mock' };
  };

  /** История диалога для backend (без текущего вопроса — он уходит отдельно). */
  AIChatWidget.prototype.historyForApi = function () {
    var items = [];
    this.messages.forEach(function (msg) {
      if (!msg || !msg.text) return;
      items.push({ author: msg.author === 'user' ? 'user' : 'agent', text: msg.text });
    });
    while (items.length && items[items.length - 1].author === 'user') items.pop();
    return items;
  };

  /** Показать готовый ответ: сообщение, чипы, счётчик, звук. */
  AIChatWidget.prototype.deliver = function (payload) {
    this.hideTyping();

    var reply = {
      id: uid('agent'),
      author: 'agent',
      text: payload.text || '',
      time: nowTime(),
      source: payload.source || 'mock',
    };
    var el = this.appendMessage(reply);

    // Помечаем источник ответа: видно, отвечает Gemini или мок-логика.
    if (el) {
      el.setAttribute('data-source', reply.source);
      var bubble = el.querySelector('.aiw-bubble');
      if (bubble) {
        bubble.title = reply.source === 'gemini'
          ? 'Ответ сгенерирован Gemini'
          : 'Мок-ответ: Gemini недоступен';
      }
    }

    this.messages.push(reply);
    this.setQuickReplies(payload.quickReplies || []);
    if (!this.state.open) this.bumpUnread();
    if (this.state.sound) this.beep();
  };

  /**
   * Ответ на вопрос пользователя.
   *
   * 1) Есть backend → спрашиваем /api/chat (Gemini как «мозги»).
   * 2) Backend выключен или ответил ошибкой → отвечаем мок-логикой.
   * В обоих случаях сначала показываем «печатает…».
   */
  AIChatWidget.prototype.replyTo = function (text) {
    var self = this;
    var minDelay = new Promise(function (resolve) {
      setTimeout(resolve, 450);
    });

    this.showTyping();

    if (!this.api) {
      // Backend отключён: имитируем «раздумья» ИИ и отвечаем мок-данными.
      var mock = this.localReply(text);
      var delay = Math.min(2200, 500 + String(mock.text).length * 10);
      setTimeout(function () {
        self.deliver(mock);
      }, delay);
      return;
    }

    this.api
      .ask(text, this.historyForApi(), this.options.currency)
      .then(function (answer) {
        var fallback = self.localReply(text);
        return minDelay.then(function () {
          self.deliver({
            text: answer.reply || fallback.text,
            quickReplies: (answer.quickReplies && answer.quickReplies.length) ? answer.quickReplies : fallback.quickReplies,
            source: answer.source === 'gemini' ? 'gemini' : 'mock',
          });
        });
      })
      .catch(function (err) {
        // Backend недоступен — чат продолжает работать на мок-данных.
        if (global.console) global.console.warn('[ai-chat] backend недоступен, мок-ответ:', err && err.message);
        return minDelay.then(function () {
          self.deliver(self.localReply(text));
        });
      });
  };

  /** Подпись движка под полем ввода (например, «Gemini» или «мок-ответы»). */
  AIChatWidget.prototype.setEngine = function (html) {
    if (!this.el || !this.el.powered || !html) return;
    this.el.powered.innerHTML = html;
  };

  /**
   * Сменить валюту цен, в которой ассистент отвечает про стоимость.
   * Вызывается со страницы при переключении валюты на витрине.
   */
  AIChatWidget.prototype.setCurrency = function (code) {
    this.options.currency = String(code || '').toUpperCase();
    return this.options.currency;
  };

  /** Состояние backend: включён ли Gemini. */
  AIChatWidget.prototype.checkBackend = function () {
    var self = this;
    if (!this.api || typeof this.api.health !== 'function') return Promise.resolve(null);
    return this.api
      .health()
      .then(function (state) {
        if (state && state.gemini) {
          self.setEngine('Работает на <strong>Gemini</strong> · ' + (state.model || 'модель') + '');
        } else {
          self.setEngine('Работает на <strong>мок-данных</strong> · Gemini отключён');
        }
        return state;
      })
      .catch(function () {
        self.setEngine('Backend недоступен · <strong>мок-ответы</strong>');
        return null;
      });
  };

  AIChatWidget.prototype.beep = function () {
    try {
      var Ctx = global.AudioContext || global.webkitAudioContext;
      if (!Ctx) return;
      this.audioCtx = this.audioCtx || new Ctx();
      var ctx = this.audioCtx;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.04;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (err) {
      /* звук не критичен */
    }
  };

  global.AIChatWidget = {
    init: function (options) {
      var instance = new AIChatWidget();
      return instance.init(options);
    },
    create: function () {
      return new AIChatWidget();
    },
  };
})(window);
