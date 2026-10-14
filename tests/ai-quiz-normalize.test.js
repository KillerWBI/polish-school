const { normalizeQuestions } = require('../src/services/aiQuiz');

// ИИ возвращает правильный ответ ТЕКСТОМ варианта, сервер сам находит индекс.
// Раньше ИИ писал индекс и путал счёт с 0 и с 1: «20%» (второй вариант) → answer [2] → показывалось 25%.
const percentQ = {
  question: 'Какой процент составляет 30 от 150?',
  options: ['15%', '20%', '25%', '30%'],
  explanation: '30 ÷ 150 = 0,2 = 20%.',
};

describe('Разбор ответа ИИ при генерации теста', () => {
  test('single: текст ответа превращается в индекс с нуля', () => {
    const [q] = normalizeQuestions([{ ...percentQ, answer: ['20%'] }], 'single');
    expect(q.answer).toEqual([1]);
    expect(q.options[q.answer[0]]).toBe('20%');
  });

  test('сравнение без учёта регистра и пробелов по краям', () => {
    const [q] = normalizeQuestions([{ ...percentQ, answer: [' 20% '] }], 'single');
    expect(q.answer).toEqual([1]);
  });

  test('числовой индекс от ИИ отбрасывается — неизвестно, с 0 он или с 1', () => {
    expect(normalizeQuestions([{ ...percentQ, answer: [2] }], 'single')).toEqual([]);
  });

  test('ответ, которого нет среди вариантов, отбрасывает вопрос', () => {
    expect(normalizeQuestions([{ ...percentQ, answer: ['40%'] }], 'single')).toEqual([]);
  });

  test('single с несколькими ответами отбрасывается', () => {
    expect(normalizeQuestions([{ ...percentQ, answer: ['20%', '25%'] }], 'single')).toEqual([]);
  });

  test('повторяющиеся варианты отбрасывают вопрос — индекс неоднозначен', () => {
    const q = { question: 'q', options: ['a', 'b', 'b', 'c'], answer: ['b'] };
    expect(normalizeQuestions([q], 'single')).toEqual([]);
  });

  test('multiple: все правильные варианты → индексы', () => {
    const q = { question: 'Чётные?', options: ['1', '2', '3', '4'], answer: ['2', '4'] };
    expect(normalizeQuestions([q], 'multiple')[0].answer).toEqual([1, 3]);
  });

  test('truefalse: два варианта', () => {
    const q = { question: '2+2=4', options: ['Верно', 'Неверно'], answer: ['Верно'] };
    expect(normalizeQuestions([q], 'truefalse')[0].answer).toEqual([0]);
  });

  test('open: варианты и ответ пустые, образец сохраняется', () => {
    const q = { question: 'Объясните', options: ['x'], answer: ['x'], sampleAnswer: 'образец' };
    expect(normalizeQuestions([q], 'open')).toEqual([
      { question: 'Объясните', options: [], answer: [], sampleAnswer: 'образец', explanation: '' },
    ]);
  });

  test('битые вопросы выкидываются, хорошие остаются', () => {
    const list = [{ ...percentQ, answer: ['40%'] }, { ...percentQ, answer: ['20%'] }, null, { options: [] }];
    expect(normalizeQuestions(list, 'single')).toHaveLength(1);
  });
});
