// Генерация учебного теста через OpenAI-СОВМЕСТИМЫЙ API.
// По умолчанию — Groq (бесплатно, быстро). Провайдер настраивается в .env:
//   AI_API_KEY  — ключ (без него → code='NO_AI_KEY' → контроллер отдаёт 503)
//   AI_BASE_URL — базовый URL (по умолчанию Groq)
//   AI_MODEL    — модель (по умолчанию Llama 3.3 70B на Groq)
// Сменить провайдера (Gemini/OpenRouter/Together/локальный Ollama) = поменять эти 3 строки в .env.
const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

const TYPE_HINT = {
  single:    'ровно 4 варианта, один правильный; поле answer — массив с одним индексом',
  multiple:  '4–5 вариантов, несколько правильных; answer — индексы всех правильных',
  truefalse: 'варианты строго ["Верно","Неверно"]; answer — [0] или [1]',
  open:      'без вариантов (options: []), answer: []; добавь поле sampleAnswer с образцом ответа',
};

const buildPrompt = ({ topic, count, difficulty, type, language, avoid }) => {
  // avoid — тексты недавних вопросов, чтобы ИИ не повторял их (адаптивная практика).
  const avoidBlock = Array.isArray(avoid) && avoid.length
    ? `\nНЕ повторяй и не перефразируй эти уже заданные вопросы (придумай новые по той же теме):\n${avoid.map((q) => `- ${q}`).join('\n')}\n`
    : '';
  return `Составь учебный тест для любого предмета.
Тема: "${topic}".
Язык теста: ${language}.
Количество вопросов: ${count}.
Сложность: ${difficulty}.
Тип вопросов: ${TYPE_HINT[type]}.
${avoidBlock}
Верни СТРОГО валидный JSON без markdown, без текста вокруг, по схеме:
{"questions":[{"question":"...","options":["..."],"answer":[0],"sampleAnswer":"","explanation":"..."}]}
- explanation — краткое пояснение правильного ответа (1–2 предложения).
- Ничего, кроме JSON, не выводи.`;
};

// Достаём JSON даже если модель обернула его в ```json ... ``` или добавила текст.
const extractJson = (text) => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('AI вернул неразборчивый ответ');
  return JSON.parse(text.slice(start, end + 1));
};

// Один запрос к AI-провайдеру с ожиданием JSON в ответе. Возвращает распарсенный объект.
const chatJSON = async ({ user, maxTokens = 3000, temperature = 0.7 }) => {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    const err = new Error('AI не настроен');
    err.code = 'NO_AI_KEY';
    throw err;
  }
  const baseUrl = process.env.AI_BASE_URL || DEFAULT_BASE_URL;
  const model = process.env.AI_MODEL || DEFAULT_MODEL;

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: 'system', content: 'Ты — помощник преподавателя. Отвечай только валидным JSON.' },
        { role: 'user', content: user },
      ],
    }),
  });

  const json = await resp.json();
  if (!resp.ok) throw new Error(json?.error?.message || 'Ошибка AI-провайдера');

  const text = json.choices?.[0]?.message?.content ?? '';
  return extractJson(text);
};

const generateQuiz = async (params) => {
  const parsed = await chatJSON({ user: buildPrompt(params) });
  if (!Array.isArray(parsed.questions) || !parsed.questions.length) {
    throw new Error('AI вернул некорректную структуру теста');
  }
  return parsed.questions;
};

// Разбить тему на 4–8 подтем (роадмап от базового к продвинутому) + учебную цель.
// Возвращает { goal, steps: ['...', ...] }.
const generateRoadmap = async ({ title, subject, language = 'русский' }) => {
  const prompt = `Составь учебный роадмап для самостоятельного изучения темы.
Тема: "${title}".${subject ? `\nПредмет: ${subject}.` : ''}
Язык ответа: ${language}.
Разбей тему на 4–8 подтем (шагов) от базовых к продвинутым — логичная последовательность изучения.
Также сформулируй краткую учебную цель темы (1 предложение).
Верни СТРОГО валидный JSON без markdown, без текста вокруг, по схеме:
{"goal":"...","steps":["подтема 1","подтема 2","..."]}
Ничего, кроме JSON, не выводи.`;
  const parsed = await chatJSON({ user: prompt, maxTokens: 1000, temperature: 0.5 });
  const steps = Array.isArray(parsed.steps)
    ? parsed.steps.map((s) => String(s).trim()).filter(Boolean)
    : [];
  if (!steps.length) throw new Error('AI вернул пустой роадмап');
  return { goal: typeof parsed.goal === 'string' ? parsed.goal.trim() : null, steps };
};

// Сгенерировать флеш-карточки (front/back) по подтеме шага трека для интервального повторения.
const generateFlashcards = async ({ title, subject, language = 'русский', count = 8 }) => {
  const prompt = `Составь набор флеш-карточек для запоминания по подтеме.
Подтема: "${title}".${subject ? `\nПредмет: ${subject}.` : ''}
Язык: ${language}.
Количество карточек: ${count}.
Каждая карточка: front — короткий вопрос/термин/понятие; back — краткий ответ/определение (1–2 предложения).
Верни СТРОГО валидный JSON без markdown, без текста вокруг, по схеме:
{"cards":[{"front":"...","back":"..."}]}
Ничего, кроме JSON, не выводи.`;
  const parsed = await chatJSON({ user: prompt, maxTokens: 2000, temperature: 0.5 });
  const cards = (Array.isArray(parsed.cards) ? parsed.cards : [])
    .map((c) => ({ front: String(c.front || '').trim(), back: String(c.back || '').trim() }))
    .filter((c) => c.front && c.back);
  if (!cards.length) throw new Error('AI вернул пустой набор карточек');
  return cards;
};

// Оценить открытые ответы ученика. items — [{ question, sampleAnswer, answer }].
// Возвращает [{ score(0..100), feedback }] в том же порядке.
const gradeOpenAnswers = async ({ topic, language = 'русский', items }) => {
  const list = (Array.isArray(items) ? items : []).map((it, i) =>
    `#${i + 1}\nВопрос: ${it.question}\nОбразец ответа: ${it.sampleAnswer || '(нет)'}\nОтвет ученика: ${it.answer || '(пусто)'}`
  ).join('\n\n');
  const prompt = `Оцени ответы ученика по теме "${topic}". Язык: ${language}.
Для каждого ответа поставь оценку 0–100 (насколько верно и полно) и краткий фидбек (1 предложение: что верно/чего не хватает).
Пустой ответ — оценка 0.
Верни СТРОГО валидный JSON без markdown по схеме (по одному объекту на каждый вопрос, в том же порядке):
{"results":[{"score":0,"feedback":"..."}]}

${list}

Ничего, кроме JSON, не выводи.`;
  const parsed = await chatJSON({ user: prompt, maxTokens: 1500, temperature: 0.2 });
  const results = Array.isArray(parsed.results) ? parsed.results : [];
  // Нормализуем и добиваем до длины items (на случай, если ИИ вернул меньше)
  return items.map((_, i) => {
    const r = results[i] || {};
    let score = Math.round(Number(r.score));
    if (!Number.isFinite(score)) score = 0;
    score = Math.min(100, Math.max(0, score));
    return { score, feedback: String(r.feedback || '').trim() };
  });
};

// Сделать флеш-карточки из произвольного текста (импорт конспекта/материала).
const generateFlashcardsFromText = async ({ text, language = 'русский', count = 10 }) => {
  const clipped = String(text || '').slice(0, 8000); // ограничиваем объём промпта
  const prompt = `На основе ТЕКСТА ниже сделай флеш-карточки для запоминания.
Язык карточек: ${language}. Максимум карточек: ${count}.
front — короткий вопрос/термин по тексту; back — краткий ответ строго из текста (1–2 предложения).
Бери только то, что есть в тексте, не выдумывай.
Верни СТРОГО валидный JSON без markdown: {"cards":[{"front":"...","back":"..."}]}

ТЕКСТ:
"""
${clipped}
"""

Ничего, кроме JSON.`;
  const parsed = await chatJSON({ user: prompt, maxTokens: 2500, temperature: 0.3 });
  const cards = (Array.isArray(parsed.cards) ? parsed.cards : [])
    .map((c) => ({ front: String(c.front || '').trim(), back: String(c.back || '').trim() }))
    .filter((c) => c.front && c.back);
  if (!cards.length) throw new Error('Не удалось извлечь карточки из текста');
  return cards;
};

// Предложить источники (книги + ссылки) для изучения подтемы. Существование проверяется отдельно.
// avoid — уже показанные (названия/URL), чтобы «подобрать ещё» давало НОВЫЕ.
const suggestSources = async ({ title, subject, language = 'русский', avoid = [] }) => {
  const avoidBlock = avoid.length
    ? `\nНЕ предлагай уже показанные (дай ДРУГИЕ):\n${avoid.slice(0, 30).map((a) => `- ${a}`).join('\n')}\n`
    : '';
  const prompt = `Предложи учебные источники по подтеме "${title}"${subject ? ` (предмет: ${subject})` : ''}.
Язык названий: ${language}.
До 4 известных книг (с автором) и до 3 надёжных ссылок (реальные URL на известные ресурсы — Wikipedia, MDN, офиц. документация, крупные учебные сайты).
Предлагай только то, что вероятно существует. Не выдумывай URL — лучше меньше, но реальные.
${avoidBlock}Верни СТРОГО валидный JSON без markdown по схеме:
{"books":[{"title":"...","author":"..."}],"links":[{"title":"...","url":"https://..."}]}
Ничего, кроме JSON.`;
  // Чуть выше температура при «ещё» (есть avoid) — для разнообразия.
  const parsed = await chatJSON({ user: prompt, maxTokens: 1200, temperature: avoid.length ? 0.8 : 0.4 });
  return {
    books: Array.isArray(parsed.books) ? parsed.books : [],
    links: Array.isArray(parsed.links) ? parsed.links : [],
  };
};

module.exports = { generateQuiz, generateRoadmap, generateFlashcards, generateFlashcardsFromText, gradeOpenAnswers, suggestSources };
