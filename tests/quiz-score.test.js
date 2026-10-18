const { scoreQuiz, normAnswer, exactMatch } = require('../src/utils/quizScore');

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

describe('Точный ответ: нормализация', () => {
  test('регистр, ё/е, пробелы, концевая пунктуация', () => {
    expect(normAnswer('  Пётр  I. ')).toBe('петр i');
    expect(exactMatch('москва!', ['Москва'])).toBe(true);
    expect(exactMatch('ньютон', ['ньюто́н'])).toBe(true);
    expect(exactMatch('йод', ['йод'])).toBe(true);
  });
  test('числа: запятая/точка, пробелы в разрядах, 25.0 = 25', () => {
    expect(exactMatch('0,25', ['0.25'])).toBe(true);
    expect(exactMatch('1 000', ['1000'])).toBe(true);
    expect(exactMatch('25.0', ['25'])).toBe(true);
  });
  test('пробел между числом и единицей не важен; число без единицы — не то же, что выражение', () => {
    expect(exactMatch('30Н', ['30 Н'])).toBe(true);
    expect(exactMatch('25 %', ['25%'])).toBe(true);
    expect(exactMatch('2', ['2x'])).toBe(false);
    expect(exactMatch('3', ['3/4'])).toBe(false);
  });
  test('разные числа не совпадают', () => {
    expect(exactMatch('2.5', ['25'])).toBe(false);
    expect(exactMatch('250', ['25'])).toBe(false);
  });
  test('засчитывается любая из допустимых форм', () => {
    expect(exactMatch('25 процентов', ['25%', '25', '25 процентов'])).toBe(true);
  });
  test('пустой ответ и не строка — неверно', () => {
    expect(exactMatch('', ['25'])).toBe(false);
    expect(exactMatch(undefined, ['25'])).toBe(false);
    expect(exactMatch(['25'], ['25'])).toBe(false);
  });
});

describe('Смешанный тест: каждый вопрос по своему kind', () => {
  const qs = [
    { kind: 'single', answer: [1] },
    { kind: 'exact', accepted: ['25%', '25'] },
    { kind: 'exact', accepted: ['Петр I'] },
  ];
  test('варианты и точные ответы считаются вместе', () => {
    expect(scoreQuiz(qs, { 0: 1, 1: '25', 2: 'пётр i' }, 'mixed')).toEqual({ score: 3, total: 3 });
    expect(scoreQuiz(qs, { 0: 0, 1: '2,5', 2: 'Пётр' }, 'mixed')).toEqual({ score: 0, total: 3 });
  });
  test('kind вопроса важнее типа теста (попытка трека шлёт тип по умолчанию)', () => {
    expect(scoreQuiz(qs, { 0: 1, 1: '25%', 2: 'петр i' }, 'single')).toEqual({ score: 3, total: 3 });
  });
});
