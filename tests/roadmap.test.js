const { buildRoadmap, stepTitleForAi, MAX_STEPS } = require('../src/utils/roadmap');

describe('Сборка плана трека из модулей ИИ', () => {
  test('модули раскладываются в плоский список подтем с подписью модуля', () => {
    const steps = buildRoadmap([
      { title: 'Основы', steps: ['Доли', 'Проценты'] },
      { title: 'Финансы', steps: ['Вклады'] },
    ]);
    expect(steps.map((s) => [s.title, s.moduleTitle, s.order])).toEqual([
      ['Доли', 'Основы', 0], ['Проценты', 'Основы', 1], ['Вклады', 'Финансы', 2],
    ]);
    expect(steps[0].moduleId).toBe(steps[1].moduleId);
    expect(steps[0].moduleId).not.toBe(steps[2].moduleId);
    expect(steps[0]).toMatchObject({ mastery: 0, attempts: 0 });
    expect(new Set(steps.map((s) => s.id)).size).toBe(3);
  });

  test(`не больше ${MAX_STEPS} подтем`, () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ title: `М${i}`, steps: ['a', 'b', 'c', 'd', 'e'] }));
    expect(buildRoadmap(many)).toHaveLength(MAX_STEPS);
  });

  test('мусор от ИИ отбрасывается: модули без названия или без подтем, пустые строки', () => {
    const steps = buildRoadmap([
      null, { title: '', steps: ['x'] }, { title: 'Пусто', steps: [] },
      { title: 'Норм', steps: ['  ', 'Подтема', 42] },
    ]);
    expect(steps.map((s) => s.title)).toEqual(['Подтема', '42']);
  });

  test('не массив → пустой план (контроллер подставит запасной шаг)', () => {
    expect(buildRoadmap(undefined)).toEqual([]);
    expect(buildRoadmap('modules')).toEqual([]);
  });
});

describe('Заголовок подтемы для ИИ', () => {
  test('тема — модуль — подтема', () => {
    expect(stepTitleForAi('Математика', { title: 'Вклады', moduleTitle: 'Финансы' })).toBe('Математика — Финансы — Вклады');
  });
  test('старый трек без модуля и шаг, совпадающий с темой', () => {
    expect(stepTitleForAi('Дроби', { title: 'Сложение' })).toBe('Дроби — Сложение');
    expect(stepTitleForAi('Дроби', { title: 'Дроби' })).toBe('Дроби');
  });
});
