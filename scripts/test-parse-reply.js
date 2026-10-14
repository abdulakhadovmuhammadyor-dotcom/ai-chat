// Одноразовая проверка разбора ответов Gemini (не часть приложения).
const { parseReply } = require('../server/gemini.js');

const cases = {
  'обычный JSON': '{"reply":"Здравствуйте!","quickReplies":["Где заказ?","Оплата"]}',
  'обрезанный JSON (MAX_TOKENS)': '{"reply":"Здравствуйте! Я Макс, ассистент магазина «АвтоПлюс». Могу помочь с подбором колодок',
  'JSON с хвостовым текстом': 'Вот ответ: {"reply":"Готово.","quickReplies":["Ещё вопрос"]} Спасибо!',
  'JSON в ```-блоке': '```json\n{"reply":"Ок","quickReplies":["А"]}\n```',
  'обрезанный с чипами': '{"reply":"Сейчас проверю заказ.","quickReplies":["Детали заказа","Изменить',
  'просто текст': 'Сейчас действует скидка 30%.',
  'JSON с экранированием': '{"reply":"Строка 1\\nСтрока 2 «кавычки»","quickReplies":[]}',
};

// Пустой ввод — корректно даёт пустой ответ, отдельная проверка ниже.
const empty = parseReply('   ');
console.log(empty.reply === '' ? 'ok   | пустая строка → пустой ответ' : 'FAIL | пустая строка');

let failed = 0;
Object.keys(cases).forEach((name) => {
  const result = parseReply(cases[name]);
  const looksLikeJson = result.reply.trim().startsWith('{') || result.reply.trim().startsWith('```');
  if (looksLikeJson || !result.reply) failed += 1;
  console.log(`${looksLikeJson || !result.reply ? 'FAIL' : 'ok  '} | ${name}`);
  console.log(`       reply: ${JSON.stringify(result.reply)}`);
  console.log(`       chips: ${JSON.stringify(result.quickReplies)}`);
});

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
process.exitCode = failed || empty.reply !== '' ? 1 : 0;
