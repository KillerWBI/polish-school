const { normalizeTheory } = require('../src/services/aiQuiz');

// Теория от ИИ хранится навсегда — мусор не должен попасть в базу
describe('Разбор теории от ИИ', () => {
  test('нормальный ответ: строки обрезаны, пустые пункты выброшены', () => {
    const t = normalizeTheory({
      summary: '  Кратко о главном. ',
      sections: [{ title: ' Понятия ', text: 'Абзац.', points: ['ax + b = 0', '  ', 3] }],
      examples: [{ task: 'Решите 2x = 6', solution: 'x = 3' }],
      mistakes: ['Забыли сменить знак', ''],
    });
    expect(t).toEqual({
      summary: 'Кратко о главном.',
      sections: [{ title: 'Понятия', text: 'Абзац.', points: ['ax + b = 0', '3'] }],
      examples: [{ task: 'Решите 2x = 6', solution: 'x = 3' }],
      mistakes: ['Забыли сменить знак'],
    });
  });

  test('разделы без названия или без содержания, примеры без решения — выбрасываются', () => {
    const t = normalizeTheory({
      summary: 'S',
      sections: [{ title: '', text: 'x' }, { title: 'Пусто' }, null, { title: 'Есть', points: ['p'] }],
      examples: [{ task: 'без решения' }, { solution: 'без условия' }],
    });
    expect(t.sections).toEqual([{ title: 'Есть', text: '', points: ['p'] }]);
    expect(t.examples).toEqual([]);
    expect(t.mistakes).toEqual([]);
  });

  test('без единого раздела — null (сохранять нечего)', () => {
    expect(normalizeTheory({ summary: 'Только вступление', sections: [] })).toBeNull();
    expect(normalizeTheory(undefined)).toBeNull();
  });
});
