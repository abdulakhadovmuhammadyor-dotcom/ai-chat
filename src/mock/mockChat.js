/**
 * Мок-данные для чата ИИ-агента и демонстрационной страницы.
 *
 * Тема проекта: интернет-магазин автозапчастей «АвтоПлюс».
 * ИИ-агент Макс отвечает ТОЛЬКО на вопросы про товары для автомобилей
 * (подбор, характеристики, наличие, цена, доставка, оплата, возврат, гарантия).
 * Любой другой вопрос — перенаправление в автомастерскую «АвтоПлюс Сервис»
 * по телефону (mockWorkshop.phone).
 *
 * Это временные (моковые) данные для разработки интерфейса без бэкенда.
 * TODO: заменить на реальные данные / ответы реального API чата.
 *
 * Модуль универсальный: подключается и в браузере (<script>, window.ChatMocks),
 * и в Node (require() из server/), чтобы backend мог использовать тот же
 * мок-ответ, когда Gemini недоступен. Один источник моков — одно место правки.
 */
(function (global) {
  'use strict';

  // Валюты: данные о курсах + хелперы форматирования.
  // В браузере модули уже подключены скриптами, в Node — подключаем через require.
  var isNode = typeof module !== 'undefined' && !!module.exports;
  var currencyMocks = isNode ? require('./mockCurrency.js') : global.ChatCurrencyMocks;
  var currencyLib = isNode ? require('../currency.js') : global.ChatCurrency;

  /** Сумма в базовой валюте → строка в нужной валюте (например, «9 326 000 сум»). */
  function money(amount, code) {
    return currencyLib.formatMoney(amount, code || currencyMocks.mockBaseCurrency, {
      currencies: currencyMocks.mockCurrencies,
      rates: currencyMocks.mockExchangeRates,
    });
  }

  /** Магазин автозапчастей — о нём говорит агент. */
  var mockShop = {
    id: 'shop-autoplus',
    name: 'АвтоПлюс',
    tagline: 'запчасти и аксессуары для автомобилей',
    pickupHours: 'Пункт выдачи: ежедневно 9:00–20:00',
    phone: '8 800 700-24-24',
    phoneHref: 'tel:+78007002424',
  };

  /**
   * Автомастерская — сюда уходят все вопросы не про товары.
   * TODO: заменить на реальные данные автомастерской (телефон, адрес, часы).
   */
  var mockWorkshop = {
    id: 'workshop-01',
    name: 'АвтоПлюс Сервис',
    fullName: 'автомастерская «АвтоПлюс Сервис»',
    phone: mockShop.phone,
    phoneHref: mockShop.phoneHref,
    hours: 'ежедневно 9:00–20:00',
    address: 'Москва, ул. Автозаводская, 14',
    services: [
      'ремонт двигателя, ходовой и тормозной системы',
      'компьютерная диагностика',
      'замена масла и фильтров',
      'шиномонтаж и развал-схождение',
      'установка аксессуаров и автоэлектроники',
    ],
  };

  /** Профиль ИИ-агента, который ведёт диалог. */
  var mockAgent = {
    id: 'agent-ai-01',
    name: 'Макс',
    role: 'ИИ-ассистент по автозапчастям',
    initials: 'М',
    status: 'online',
    statusText: 'Онлайн · отвечаю мгновенно',
  };

  /**
   * Формулировка перенаправления: вопрос не про товары → телефон автомастерской.
   * @param {string} [lead] уточняющая фраза в начале ответа
   */
  function redirectToWorkshop(lead) {
    return (lead ? lead + ' ' : '') +
      'Это не про товары, поэтому подскажет ' + mockWorkshop.fullName + ': ' + mockWorkshop.phone +
      ' (' + mockWorkshop.hours + '). Я консультирую только по товарам — подбор, наличие, цена, доставка и возврат.';
  }

  /** Быстрые ответы (кнопки-подсказки под лентой сообщений) — только про товары. */
  var mockQuickReplies = [
    'Что есть в наличии?',
    'Подобрать масло',
    'Колодки на Camry 2019',
    'Условия возврата',
  ];

  /** Приветственная лента сообщений при открытии чата. */
  var mockMessages = [
    {
      id: 'm-welcome-1',
      author: 'agent',
      text: 'Здравствуйте! 👋 Меня зовут ' + mockAgent.name + ', я ИИ-ассистент магазина автозапчастей «' + mockShop.name + '».',
      time: '10:00',
    },
    {
      id: 'm-welcome-2',
      author: 'agent',
      text:
        'Подбираю запчасти и расходники по марке, модели и VIN, подсказываю наличие, цену, доставку и возврат товара.' +
        ' Вопросы про ремонт, диагностику и установку — не ко мне: с ними поможет ' +
        mockWorkshop.fullName + ' по номеру ' + mockWorkshop.phone + '.',
      time: '10:01',
      quickReplies: mockQuickReplies,
    },
  ];

  /**
   * Товары для автомобилей (витрина демонстрационной страницы).
   * Цены заданы в базовой валюте (mockBaseCurrency в mockCurrency.js);
   * агент пересчитывает их в сумы и доллары там же, где и витрина.
   * TODO: заменить на реальный каталог с артикулами и остатками.
   */
  var mockProducts = [
    { id: 'p1', sku: 'BRE-P83044', name: 'Колодки тормозные передние Brembo, Camry 2018–2022', category: 'Тормозная система', price: 3490, oldPrice: 4290, rating: 4.8, badge: 'Оригинал и аналоги', emoji: '🛑' },
    { id: 'p2', sku: 'MOT-8100-5W30', name: 'Моторное масло Motul 8100 5W-30, 4 л', category: 'Масла и жидкости', price: 4990, oldPrice: 5990, rating: 4.9, badge: 'Хит продаж', emoji: '🛢️' },
    { id: 'p3', sku: 'MAN-W914-2', name: 'Масляный фильтр Mann W 914/2', category: 'Фильтры', price: 890, oldPrice: 1190, rating: 4.8, badge: 'Хит продаж', emoji: '🧰' },
    { id: 'p4', sku: 'VAR-BD60', name: 'Аккумулятор Varta Blue Dynamic 60 Ач', category: 'Аккумуляторы', price: 12990, oldPrice: 14990, rating: 4.7, badge: '−13%', emoji: '🔋' },
    { id: 'p5', sku: 'TYR-205-55-R16', name: 'Шины летние 205/55 R16, комплект 4 шт.', category: 'Шины и диски', price: 32990, oldPrice: 38990, rating: 4.6, badge: 'Комплект', emoji: '🛞' },
    { id: 'p6', sku: '70M-A800S', name: 'Видеорегистратор 70mai A800S с GPS', category: 'Автоэлектроника', price: 9990, oldPrice: 12990, rating: 4.7, badge: 'Новинка', emoji: '📹' },
  ];

  /** Главный товар для примеров в ответах агента. */
  var featuredProduct = mockProducts[1];

  /**
   * База знаний агента: сопоставление ключевых слов с ответом.
   * Используется примитивный подбор по ключевым словам (мок-логика чата).
   *
   * Правило мок-логики: отвечаем только про товары (флаг redirect не задан),
   * всё остальное уводим в автомастерскую (redirect: true).
   */
  var mockKnowledgeBase = [
    {
      id: 'kb-greeting',
      keywords: ['привет', 'здравств', 'добрый день', 'добрый вечер', 'доброе утро', 'хай'],
      answer:
        'Здравствуйте! Я ' + mockAgent.name + ', ассистент магазина автозапчастей «' + mockShop.name + '».' +
        ' Отвечаю на вопросы про товары: подбор, характеристики, наличие, цена, доставка и возврат.' +
        ' Назовите марку, модель и год автомобиля — подберу совместимые детали.',
      quickReplies: mockQuickReplies,
    },
    {
      // Редирект идёт первым: при равном совпадении ключевых слов уводим в мастерскую.
      // Ключевые слова намеренно узкие: всё непонятое и так уходит в автомастерскую
      // через mockFallback, а ложные срабатывания перехватывали бы товарные вопросы.
      id: 'kb-workshop',
      redirect: true,
      keywords: ['ремонт', 'ремонтир', 'диагностик', 'сервис', 'автосервис', 'техцентр', '=сто', 'запис', 'установк', 'установит', 'монтаж', 'развал', 'электрик', 'неисправн', 'поломк', 'течет', 'стучит', 'троит', 'поменять', 'замен'],
      answer: redirectToWorkshop('Ремонт, диагностика, установка и замена — это работа автомастерской.'),
      quickReplies: ['Что есть в наличии?', 'Колодки на Camry 2019'],
    },
    {
      id: 'kb-catalog',
      keywords: ['каталог', 'наличи', 'есть ли', 'что есть', 'ассортимент', 'товар', 'запчаст', 'аксессуар', 'подобрать', 'подбер'],
      answer:
        'В наличии тормозные колодки, масла и фильтры, аккумуляторы, шины и автоэлектроника.' +
        ' Например, ' + featuredProduct.name + ' — ' + money(featuredProduct.price) + ' (' + featuredProduct.sku + ').' +
        ' Скажите марку, модель и год авто — подберу подходящие варианты.',
      quickReplies: ['Подобрать масло', 'Есть ли шины R16?', 'Аккумулятор 60 Ач'],
    },
    {
      id: 'kb-brakes',
      keywords: ['колодк', 'тормозн', 'суппорт', 'abs', 'диск'],
      answer:
        'Колодки на Camry 2018–2022 есть: оригинал и аналоги от ' + money(3490) + ' за передний комплект, артикул ' + mockProducts[0].sku + '.' +
        ' Гарантия на деталь 12 месяцев. Скажите VIN или год выпуска — сверю точную совместимость.',
      quickReplies: ['Есть ли задние?', 'Условия гарантии', 'Сколько стоит доставка?'],
    },
    {
      id: 'kb-oil',
      keywords: ['масл', 'вязкост', '5w', '0w', '10w', 'допуск', 'синтетик', 'полусинтет', 'антифриз', 'жидкост'],
      answer:
        'Масло подбираем по допуску производителя и климату: чаще всего это 5W-30 или 0W-20, синтетика API SN/SP.' +
        ' Есть ' + featuredProduct.name + ' за ' + money(featuredProduct.price) + ' — 4 литра, вязкость 5W-30.' +
        ' Назовите марку, модель и объём двигателя, чтобы точно сверить допуск.',
      quickReplies: ['Есть ли 0W-20?', 'Подобрать фильтр', 'Сколько стоит доставка?'],
    },
    {
      id: 'kb-filters',
      keywords: ['фильтр', 'воздушн', 'салонн', 'маслян'],
      answer:
        'Фильтры есть масляные, воздушные и салонные на большинство моделей. Масляный Mann W 914/2 — ' + money(890) + '.' +
        ' Назовите марку, модель и год — подберу нужные артикулы и скажу, что есть на складе.',
      quickReplies: ['Что есть в наличии?', 'Подобрать масло', 'Наличие на складе'],
    },
    {
      id: 'kb-battery',
      keywords: ['аккумулятор', 'акб', 'ампераж', 'емкост', '60 ач', 'пусковой ток', 'клемм'],
      answer:
        'Аккумулятор выбираем по ёмкости и пусковому току: для большинства седанов подходит 60 Ач с током 540–580 А.' +
        ' В наличии Varta Blue Dynamic 60 Ач — ' + money(12990) + '. Проверьте габариты и сторону плюсовой клеммы — помогу сверить по фото.',
      quickReplies: ['Показать характеристики', 'Есть ли 70 Ач?', 'Условия гарантии'],
    },
    {
      id: 'kb-tires',
      keywords: ['шины', 'шину', 'покрышк', 'резина', 'резину', 'диски', 'литые', 'r15', 'r16', 'r17', 'размер', 'сезон'],
      answer:
        'Шины есть на 15–17 дюймов, летние и зимние. Комплект летних 205/55 R16 (4 шт.) — ' + money(32990) + '.' +
        ' Назовите размер из техпаспорта — уточню наличие и стоимость комплекта.',
      quickReplies: ['Есть ли 195/65 R15?', 'Зимние шины', 'Сколько стоит доставка?'],
    },
    {
      id: 'kb-parts-match',
      keywords: ['подойд', 'подход', 'совместим', 'vin', 'артикул', 'оригинал', 'аналог', 'каталожн', 'номер детал'],
      answer:
        'Совместимость проверяю по марке, модели, году выпуска и VIN. Пришлите VIN или фото старой детали с артикулом — подберу оригинал или аналог и сверю цену.',
      quickReplies: ['Оставить VIN', 'Оригинал или аналог?', 'Наличие на складе'],
    },
    {
      id: 'kb-delivery',
      keywords: ['доставк', 'курьер', 'самовывоз', 'срок', 'привез', 'отправ'],
      answer:
        'Доставка товара по городу — курьером в день заказа, по стране — от 2 дней. Самовывоз со склада бесплатный: ' +
        mockShop.pickupHours + '. Скажите город и нужную деталь — назову точный срок и стоимость.',
      quickReplies: ['Сколько стоит доставка?', 'Самовывоз', 'Наличие на складе'],
    },
    {
      id: 'kb-price',
      keywords: ['цена', 'стоим', 'сколько стоит', 'скидк', 'дешевл', 'акци', 'распродаж'],
      answer:
        'На колодки, масла и фильтры действует скидка до 25%. Например, ' + featuredProduct.name + ' — ' +
        money(featuredProduct.price) + ' вместо ' + money(featuredProduct.oldPrice) +
        ' (≈ ' + money(featuredProduct.price, 'UZS') + ' или ≈ ' + money(featuredProduct.price, 'USD') + ').' +
        ' Промокод AVTO10 даёт ещё −10% на первый заказ.',
      quickReplies: ['Показать акции', 'Цены в сумах', 'Наличие на складе'],
    },
    {
      id: 'kb-currency',
      keywords: ['сумах', 'в сомах', 'uzs', 'доллар', 'usd', 'валют', 'курс', 'пересчит', 'в другой валюте'],
      answer:
        'Цены на сайте можно смотреть в рублях, узбекских сумах и долларах — переключатель валют есть над каталогом.' +
        ' Курс демонстрационный: ' + currencyLib.describeRates(
          currencyMocks.mockBaseCurrency,
          currencyMocks.mockExchangeRates,
          currencyMocks.mockCurrencies
        ) + '.' +
        ' Например, ' + featuredProduct.name + ' — ' + money(featuredProduct.price) +
        ' ≈ ' + money(featuredProduct.price, 'UZS') + ' ≈ ' + money(featuredProduct.price, 'USD') + '.',
      quickReplies: ['Показать каталог', 'Способы оплаты', 'Наличие на складе'],
    },
    {
      id: 'kb-payment',
      keywords: ['оплат', 'карт', 'наличн', 'рассрочк', 'чек', 'плат', 'перевод', 'счет'],
      answer:
        'Товар можно оплатить картой, переводом или наличными при получении; для крупных заказов есть оплата частями без процентов. Чек приходит на почту сразу после оплаты.',
      quickReplies: ['Оплата частями', 'Чек на почту', 'Сколько стоит доставка?'],
    },
    {
      id: 'kb-return',
      keywords: ['возврат', 'обмен', 'вернуть', 'не подош', 'брак', 'гаранти'],
      answer:
        'Товар можно вернуть или обменять в течение 14 дней, если он не был установлен, сохранены упаковка и чек. Гарантия на детали — 12 месяцев. Установку и связанный с ней брак разбирает автомастерская, я помогу только с товаром.',
      quickReplies: ['Оформить возврат', 'Условия гарантии', 'Наличие на складе'],
    },
    {
      id: 'kb-human',
      keywords: ['оператор', 'человек', 'менеджер', 'живой', 'специалист', 'позови', 'позвонить'],
      answer:
        'Живой специалист есть в автомастерской: ' + mockWorkshop.fullName + ', ' + mockWorkshop.phone +
        ' (' + mockWorkshop.hours + '). По товарам я отвечу сам — напишите, какая деталь нужна.',
      quickReplies: ['Что есть в наличии?', 'Подобрать масло'],
    },
    {
      id: 'kb-thanks',
      keywords: ['спасибо', 'благодар', 'круто', 'отлично', 'супер', 'помогл'],
      answer: 'Всегда рад помочь! 🔧 Если понадобится деталь или расходник — просто напишите.',
      quickReplies: mockQuickReplies,
    },
    {
      id: 'kb-bye',
      keywords: ['пока', 'до свидан', 'бай', 'выход'],
      answer: 'До встречи! Возвращайтесь, когда понадобятся запчасти — я всегда на связи 👋',
      quickReplies: ['Задать новый вопрос'],
    },
  ];

  /**
   * Ответ, когда ни одно ключевое слово не совпало: вопрос не про товары →
   * телефон автомастерской (см. требование «только товары для автомобилей»).
   */
  var mockFallback = {
    id: 'kb-fallback',
    redirect: true,
    answer: redirectToWorkshop('Про это я не консультирую — моя тема только товары для автомобилей.'),
    quickReplies: mockQuickReplies,
  };

  /** Набор эмодзи для панели выбора. */
  var mockEmojis = [
    '🙂', '😊', '👍', '🙏', '👋', '✅', '❌', '❓',
    '🚗', '🛞', '🔋', '🛢️', '🧰', '🛑', '📹', '🔧',
    '📦', '🚚', '💳', '📞', '⏰', '⭐', '🧾', '🔍',
  ];

  /** Файлы, которые можно «прикрепить» в демо-режиме. */
  var mockAttachments = [
    { id: 'file-1', name: 'Фото_старой_детали.jpg', size: '1,2 МБ', kind: 'image' },
    { id: 'file-2', name: 'VIN_автомобиля.txt', size: '1 КБ', kind: 'file' },
    { id: 'file-3', name: 'Чек_заказ_482913.pdf', size: '184 КБ', kind: 'pdf' },
  ];

  /** Преимущества магазина для демонстрационной страницы. */
  var mockFeatures = [
    { icon: '🔍', title: 'Подбор по VIN', text: 'Назовите марку, модель и год — ассистент подберёт совместимые детали.' },
    { icon: '🚚', title: 'Доставка товара за 1 день', text: 'По городу — курьером в день заказа, по стране — от 2 дней. Есть самовывоз.' },
    { icon: '🛡️', title: 'Гарантия на товар 12 месяцев', text: 'Возврат 14 дней, если деталь не устанавливали. Чек приходит на почту.' },
    { icon: '🔧', title: 'Монтаж и ремонт', text: 'Установку и ремонт выполняет ' + mockWorkshop.fullName + ': ' + mockWorkshop.phone + '.' },
  ];

  /** Цифры для блока статистики на демонстрационной странице. */
  var mockStats = [
    { value: '18 400', label: 'артикулов в наличии' },
    { value: '4,8 из 5', label: 'оценка покупателей' },
    { value: '1 день', label: 'доставка товара по городу' },
    { value: '45 сек', label: 'средний ответ ассистента' },
  ];

  /** Пункты навигации демонстрационной страницы. */
  var mockNav = [
    { label: 'Каталог', href: '#catalog' },
    { label: 'Доставка', href: '#features' },
    { label: 'Ассистент', href: '#support' },
    { label: 'Контакты', href: '#footer' },
  ];

  /**
   * Примитивный подбор ответа по ключевым словам (мок-«мозги» ассистента).
   * Используется как оффлайн-fallback и на клиенте, и на сервере.
   *
   * Ключевое слово — подстрока вопроса. Если оно начинается с «=», ищем
   * отдельное слово: так «=сто» ловит аббревиатуру СТО, но не «стоит».
   *
   * TODO: заменить на реальный вызов Gemini/бэкенда (см. server/gemini.js).
   */
  function matchIntent(text) {
    var query = String(text == null ? '' : text).toLowerCase();
    var words = query.split(/[^0-9a-zа-яё]+/).filter(Boolean);
    var best = null;
    var bestScore = 0;
    mockKnowledgeBase.forEach(function (item) {
      var score = 0;
      item.keywords.forEach(function (kw) {
        var needle = String(kw).toLowerCase();
        var hit = needle.charAt(0) === '='
          ? words.indexOf(needle.slice(1)) !== -1
          : query.indexOf(needle) !== -1;
        if (hit) score += 1;
      });
      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    });
    return best || mockFallback;
  }

  /**
   * Мок-ответ ассистента в том же формате, что отдаёт POST /api/chat.
   * `redirect: true` означает, что вопрос не про товары и клиент отправлен
   * в автомастерскую по телефону.
   *
   * @param {string} text вопрос пользователя
   * @returns {{reply: string, quickReplies: string[], intentId: string, redirect: boolean, source: string}}
   */
  function mockReply(text) {
    var intent = matchIntent(text);
    return {
      reply: intent.answer,
      quickReplies: intent.quickReplies || mockQuickReplies,
      intentId: intent.id || 'kb-fallback',
      redirect: !!intent.redirect,
      source: 'mock',
    };
  }

  var ChatMocks = {
    mockShop: mockShop,
    mockWorkshop: mockWorkshop,
    mockAgent: mockAgent,
    mockQuickReplies: mockQuickReplies,
    mockMessages: mockMessages,
    mockKnowledgeBase: mockKnowledgeBase,
    mockFallback: mockFallback,
    mockEmojis: mockEmojis,
    mockAttachments: mockAttachments,
    mockProducts: mockProducts,
    featuredProduct: featuredProduct,
    mockFeatures: mockFeatures,
    mockStats: mockStats,
    mockNav: mockNav,
    matchIntent: matchIntent,
    mockReply: mockReply,
    redirectToWorkshop: redirectToWorkshop,
    // Валюты: цены показываем в рублях, сумах и долларах.
    mockBaseCurrency: currencyMocks.mockBaseCurrency,
    mockCurrencies: currencyMocks.mockCurrencies,
    mockExchangeRates: currencyMocks.mockExchangeRates,
    mockRates: currencyMocks.mockRates,
    formatMoney: money,
  };

  global.ChatMocks = ChatMocks;

  // Экспорт для Node (server/) — браузер эту ветку не выполняет.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatMocks;
  }
})(typeof window !== 'undefined' ? window : globalThis);
