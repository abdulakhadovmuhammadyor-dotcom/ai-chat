// Проверка правила «агент отвечает только про товары для автомобилей,
// остальные вопросы — на телефон автомастерской».
// Запуск: npm run test:agent
const mocks = require('../src/mock/mockChat.js');
const prompt = require('../server/prompt.js');

const phone = mocks.mockWorkshop.phone;
const digits = phone.replace(/\D/g, '');

let failed = 0;
function check(name, cond, extra) {
  if (!cond) failed += 1;
  console.log(`${cond ? 'ok  ' : 'FAIL'} | ${name}${cond ? '' : ' → ' + JSON.stringify(extra)}`);
}

// 1. Вопросы про товары — отвечаем сами (без перенаправления).
const productQuestions = [
  'Есть ли колодки на Camry 2019?',
  'Сколько стоит масло 5W-30?',
  'Подберите аккумулятор 60 Ач',
  'Какие шины есть на R16?',
  'Подойдёт ли этот фильтр по VIN?',
  'Сколько стоит доставка и можно ли вернуть товар?',
];
productQuestions.forEach((question) => {
  const answer = mocks.mockReply(question);
  check(`товарный вопрос отвечаем сами: «${question}»`, answer.redirect === false, { intent: answer.intentId, redirect: answer.redirect });
});

// 2. Вопросы не про товары — только телефон автомастерской.
const offTopicQuestions = [
  'Поменяйте ремень ГРМ, когда можно приехать?',
  'Сделайте диагностику двигателя',
  'Где у вас СТО и как записаться?',
  'Установите эти колодки на машину',
  'Какая сегодня погода в Москве?',
  'Посоветуйте фильм на вечер',
];
offTopicQuestions.forEach((question) => {
  const answer = mocks.mockReply(question);
  const hasPhone = answer.reply.indexOf(phone) !== -1;
  check(
    `не про товары → телефон автомастерской: «${question}»`,
    answer.redirect === true && hasPhone,
    { intent: answer.intentId, redirect: answer.redirect, hasPhone, reply: answer.reply.slice(0, 120) }
  );
});

// 3. Приветствие и благодарность — не перенаправление.
['Здравствуйте!', 'Спасибо, выручили'].forEach((text) => {
  const answer = mocks.mockReply(text);
  check(`вежливость без перенаправления: «${text}»`, answer.redirect === false, answer.intentId);
});

// 4. Инструкция для Gemini: тема ограничена товарами, телефон автомастерской есть.
const instruction = prompt.buildSystemInstruction({ currency: 'UZS' });
check('инструкция: «ТОЛЬКО» про товары', /ТОЛЬКО на вопросы про товары для автомобилей/.test(instruction));
check('инструкция: телефон автомастерской указан', instruction.indexOf(phone) !== -1);
check('инструкция: ремонт и диагностика — в перенаправлении', /диагностик/.test(instruction) && /автомастерск/i.test(instruction));
check('инструкция: каталог автозапчастей', /Колодки тормозные/.test(instruction) && /артикул/.test(instruction));
check('инструкция: имя агента из мок-данных', instruction.indexOf(mocks.mockAgent.name) !== -1, mocks.mockAgent.name);

// 5. Контакты мок-данных совпадают со страницей (шапка/блок поддержки).
check('телефон в tel-ссылке корректный', mocks.mockWorkshop.phoneHref === 'tel:+7' + digits.slice(1), mocks.mockWorkshop.phoneHref);
check('магазин и автомастерская — АвтоПлюс', /АвтоПлюс/.test(mocks.mockShop.name) && /АвтоПлюс/.test(mocks.mockWorkshop.name));

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
process.exitCode = failed ? 1 : 0;
