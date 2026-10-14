// Одноразовая проверка цен в разных валютах (не часть приложения).
// Запуск: npm run test:currency
const mocks = require('../src/mock/mockChat.js');
const currency = require('../src/currency.js');
const prompt = require('../server/prompt.js');

// ru-RU использует неразрывные пробелы — для сравнения приводим к обычным.
const norm = (value) => String(value).replace(/\u00a0|\u202f/g, ' ');

const cases = [
  ['базовая валюта', mocks.formatMoney(64990), '64 990 ₽'],
  ['узбекские сумы', mocks.formatMoney(64990, 'UZS'), '9 326 000 сум'],
  ['доллары США', mocks.formatMoney(64990, 'USD'), '$734.39'],
  ['округление сум', mocks.formatMoney(12990, 'UZS'), '1 864 000 сум'],
  ['подпись курсов', currency.describeRates(mocks.mockBaseCurrency, mocks.mockExchangeRates, mocks.mockCurrencies), '1 ₽ ≈ 143,5 сум · 1 $ ≈ 88,5 ₽'],
];

let failed = 0;
cases.forEach(([name, actual, expected]) => {
  const ok = norm(actual) === expected;
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} | ${name}: ${norm(actual)}${ok ? '' : ` (ожидалось ${expected})`}`);
});

// Ответ ассистента про валюты собирается из тех же мок-курсов.
const reply = mocks.mockReply('а сколько это будет в узбекских сумах?');
const hasSums = /сум/.test(reply.reply);
const hasUsd = /\$/.test(reply.reply);
console.log(`${hasSums && hasUsd ? 'ok  ' : 'FAIL'} | мок-ответ про сумы: ${reply.reply.slice(0, 120)}…`);
if (!hasSums || !hasUsd) failed += 1;

// Инструкция для Gemini знает про выбранную валюту.
const instruction = prompt.buildSystemInstruction({ currency: 'UZS' });
const knowsCurrency = instruction.includes('узбекских сумах');
console.log(`${knowsCurrency ? 'ok  ' : 'FAIL'} | инструкция Gemini: валюта клиента UZS`);
if (!knowsCurrency) failed += 1;

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
process.exitCode = failed ? 1 : 0;
