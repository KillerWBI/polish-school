// Пересчёт результата теста НА СЕРВЕРЕ. Клиенту доверять нельзя: присланный score
// напрямую влияет на обладание темой (EMA) и на оценки, которые видит учитель.
// Формат вопроса: { answer: [индексы правильных вариантов] }; ответ ученика: число | число[].

const sameSet = (a = [], b = []) =>
  a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');

// Ответы приходят объектом { "0": 2, "1": [0,3] } — индекс вопроса в ключе.
const answerFor = (answers, i) => (answers && typeof answers === 'object' ? answers[i] : undefined);

// { score, total } по вопросам и ответам. Для открытых вопросов (type='open')
// объективной проверки нет — их оценивает ИИ отдельно, здесь вернём null.
const scoreQuiz = (questions, answers, type) => {
  const list = Array.isArray(questions) ? questions : [];
  if (type === 'open') return { score: null, total: null };

  const score = list.reduce((n, q, i) => {
    const correct = Array.isArray(q?.answer) ? q.answer : [];
    const given = answerFor(answers, i);
    if (type === 'multiple') return n + (sameSet(Array.isArray(given) ? given : [], correct) ? 1 : 0);
    return n + (given === correct[0] ? 1 : 0);
  }, 0);

  return { score, total: list.length };
};

module.exports = { scoreQuiz };
