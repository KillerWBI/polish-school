const { scoreQuiz } = require('../src/utils/quizScore');

// Формат: вопрос { answer: [индексы] }, ответы ученика { "0": 2, "1": [0,1] }
const single = [
  { question: 'q1', answer: [0] },
  { question: 'q2', answer: [2] },
  { question: 'q3', answer: [1] },
];

describe('Серверный подсчёт результата теста', () => {
  test('считает только реально верные ответы', () => {
    expect(scoreQuiz(single, { 0: 0, 1: 2, 2: 3 }, 'single')).toEqual({ score: 2, total: 3 });
  });

  test('пустые ответы дают 0', () => {
    expect(scoreQuiz(single, {}, 'single')).toEqual({ score: 0, total: 3 });
  });

  test('все верные дают полный балл', () => {
    expect(scoreQuiz(single, { 0: 0, 1: 2, 2: 1 }, 'single')).toEqual({ score: 3, total: 3 });
  });

  test('multiple: балл только при полном совпадении набора', () => {
    const qs = [{ answer: [0, 2] }, { answer: [1] }];
    expect(scoreQuiz(qs, { 0: [2, 0], 1: [1] }, 'multiple')).toEqual({ score: 2, total: 2 });
    expect(scoreQuiz(qs, { 0: [0], 1: [1] }, 'multiple')).toEqual({ score: 1, total: 2 }); // неполный набор
  });

  test('open — объективной проверки нет (оценивает ИИ)', () => {
    expect(scoreQuiz([{ answer: [] }], { 0: 'текст' }, 'open')).toEqual({ score: null, total: null });
  });
});
