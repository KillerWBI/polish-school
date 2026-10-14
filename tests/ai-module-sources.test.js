const { suggestSourcesForSteps } = require('../src/services/aiQuiz');

// ИИ размечает источники НОМЕРОМ подтемы (с 1, как в списке промпта) — сервер переводит номер в подтему.
const steps = [{ id: 's-a', title: 'Доли' }, { id: 's-b', title: 'Проценты' }];

const aiReplies = (content) => vi.stubGlobal('fetch', vi.fn(async () => ({
  ok: true, status: 200,
  json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }),
})));

describe('Источники на модуль: разбор ответа ИИ', () => {
  beforeEach(() => { process.env.AI_API_KEY = 'test-key'; });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.AI_API_KEY; });

  test('номер подтемы с 1 → своя подтема', async () => {
    aiReplies({ items: [
      { step: 2, books: [{ title: 'Книга', author: 'А' }], links: [] },
      { step: 1, books: [], links: [{ title: 'Сайт', url: 'https://example.com' }] },
    ] });
    const r = await suggestSourcesForSteps({ topic: 'Математика', moduleTitle: 'Основы', steps });
    expect(r.map((it) => it.step.id)).toEqual(['s-b', 's-a']);
    expect(r[0].books).toHaveLength(1);
    expect(r[1].links).toHaveLength(1);
  });

  test('номер вне списка, 0 и мусор отбрасываются', async () => {
    aiReplies({ items: [{ step: 0 }, { step: 3 }, { step: 'x' }, null, { step: '1' }] });
    const r = await suggestSourcesForSteps({ topic: 'Математика', moduleTitle: 'Основы', steps });
    expect(r.map((it) => it.step.id)).toEqual(['s-a']);
    expect(r[0]).toEqual({ step: steps[0], books: [], links: [] });
  });

  test('ответ без items → пусто, без падения', async () => {
    aiReplies({ sources: [] });
    expect(await suggestSourcesForSteps({ topic: 'М', moduleTitle: 'О', steps })).toEqual([]);
  });
});
