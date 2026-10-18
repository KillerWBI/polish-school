// Пересчёт результата теста НА СЕРВЕРЕ. Клиенту доверять нельзя: присланный score
// напрямую влияет на обладание темой (EMA) и на оценки, которые видит учитель.
// Формат вопроса: { answer: [индексы правильных вариантов] }; ответ ученика: число | число[].
// Смешанный тест: тип у вопроса (q.kind = 'single' | 'exact'); у старых вопросов kind нет —
// считаем по типу теста. Точный ответ: { accepted: ['25%', '25'] } — засчитывается любая форма.

const sameSet = (a = [], b = []) =>
  a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');

// Ответы приходят объектом { "0": 2, "1": [0,3] } — индекс вопроса в ключе.
const answerFor = (answers, i) => (answers && typeof answers === 'object' ? answers[i] : undefined);

// Нормализация точного ответа. ⚠️ Копия на фронте — pages/quiz/answerMatch.js: правила должны совпадать,
// иначе подсветка «верно» у ученика разойдётся с баллом, который засчитает сервер.
const normAnswer = (s) => String(s ?? '')
  .toLowerCase()
  .normalize('NFD').replace(/́/g, '').normalize('NFC') // знак ударения: «ньюто́н» → «ньютон»
  .replace(/ё/g, 'е')
  .replace(/(\d)\s+(?=\d)/g, '$1')        // «1 000» → «1000»
  .replace(/(\d),(\d)/g, '$1.$2')         // «0,25» → «0.25»
  .replace(/(\d)\s+(?=[^\d\s])/g, '$1')    // «30 Н» → «30н», «25 %» → «25%»
  .replace(/^["'«»\s]+|["'«».!?;:,\s]+$/g, '') // кавычки по краям и концевая пунктуация
  .replace(/\s+/g, ' ')
  .trim();

const NUMBER = /^-?\d+(\.\d+)?$/;
const sameAnswer = (a, b) => (NUMBER.test(a) && NUMBER.test(b) ? Number(a) === Number(b) : a === b);

const exactMatch = (given, accepted) => {
  if (typeof given !== 'string') return false;
  const g = normAnswer(given);
  return !!g && (Array.isArray(accepted) ? accepted : []).some((a) => sameAnswer(g, normAnswer(a)));
};

const isCorrect = (q, given, kind) => {
  if (kind === 'exact') return exactMatch(given, q?.accepted);
  const correct = Array.isArray(q?.answer) ? q.answer : [];
  if (kind === 'multiple') return sameSet(Array.isArray(given) ? given : [], correct);
  return given === correct[0];
};

// { score, total } по вопросам и ответам. Для открытых вопросов (type='open')
// объективной проверки нет — их оценивает ИИ отдельно, здесь вернём null.
const scoreQuiz = (questions, answers, type) => {
  const list = Array.isArray(questions) ? questions : [];
  if (type === 'open') return { score: null, total: null };

  const score = list.reduce((n, q, i) => n + (isCorrect(q, answerFor(answers, i), q?.kind || type) ? 1 : 0), 0);
  return { score, total: list.length };
};

module.exports = { scoreQuiz, normAnswer, exactMatch };
