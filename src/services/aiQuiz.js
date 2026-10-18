// Генерация учебного теста через OpenAI-СОВМЕСТИМЫЙ API.
// По умолчанию — Groq (бесплатно, быстро). Провайдер настраивается в .env:
//   AI_API_KEY  — ключ (без него → code='NO_AI_KEY' → контроллер отдаёт 503)
//   AI_BASE_URL — базовый URL (по умолчанию Groq)
//   AI_MODEL    — модель (по умолчанию openai/gpt-oss-120b на Groq; пробуется первой)
// Сменить провайдера (Gemini/OpenRouter/Together/локальный Ollama) = поменять эти 3 строки в .env.
const { normAnswer } = require('../utils/quizScore');

const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';
// ⚠️ 2026-10: Groq снял llama-3.3-70b-versatile — все ИИ-функции падали с «model does not exist».
// Поэтому модели теперь цепочкой: если провайдер ответил «модели нет», берём следующую,
// а не роняем запрос. AI_MODEL из .env (если задан) пробуется первым.
const DEFAULT_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'];
const AI_TIMEOUT_MS = 60000;

// Модель, которая последней ответила успешно, — чтобы не стучаться в снятую на каждом запросе.
let workingModel = null;

const modelChain = () => {
  const fromEnv = process.env.AI_MODEL ? [process.env.AI_MODEL] : [];
  const chain = [...new Set([...fromEnv, ...DEFAULT_MODELS])];
  return workingModel ? [workingModel, ...chain.filter((m) => m !== workingModel)] : chain;
};

const isModelGone = (status, json) => {
  const code = json?.error?.code || '';
  const msg = json?.error?.message || '';
  return status === 404 || code === 'model_not_found' || code === 'model_decommissioned'
    || /does not exist|decommissioned|not found/i.test(msg);
};

// gpt-oss — «думающие» модели: рассуждение расходует max_tokens. Держим его коротким
// и добавляем запас, иначе JSON обрезается на середине.
const isReasoningModel = (model) => /gpt-oss/i.test(model);
// Сколько токенов добавить на рассуждение — чем выше effort, тем длиннее модель думает.
// medium на тест из 6 вопросов тратил ~1 450 токенов ответа вместе с рассуждением. Запас не раздуваем:
// провайдер может резервировать весь max_tokens из минутного лимита ключа (8 000 у бесплатного Groq).
const REASONING_BUDGET = { low: 1500, medium: 2500 };

// answer — ТЕКСТ правильного варианта, а не индекс: с индексом модель путала счёт с 0 и с 1
// («20%» — второй вариант → писала 2 → у нас это третий, 25%). Индекс находит сервер (normalizeQuestions).
const TYPE_HINT = {
  single:    'ровно 4 разных варианта, один правильный; answer — массив с ТЕКСТОМ правильного варианта, дословно как в options',
  multiple:  '4–5 разных вариантов, несколько правильных; answer — ТЕКСТЫ всех правильных вариантов, дословно как в options',
  truefalse: 'варианты строго ["Верно","Неверно"]; answer — ["Верно"] или ["Неверно"]',
  open:      'без вариантов (options: []), answer: []; добавь поле sampleAnswer с образцом ответа',
  mixed:     `смешанный тест, у каждого вопроса поле kind:
  • kind "single" — ровно 4 разных варианта, один правильный; answer — массив с ТЕКСТОМ правильного варианта, дословно как в options;
  • kind "exact" — вопрос «впишите ответ» без вариантов (options: []): ответ короткий и ОДНОЗНАЧНЫЙ — число, термин, имя, дата, формула;
    accepted — ВСЕ допустимые формы записи этого ответа (например ["25%","25","25 процентов"]);
    если ответ — число с единицей, в accepted обязательно и само число без единицы ("30 Н" → ["30 Н","30"]).
    Не задавай как exact вопросы, ответ на которые можно сформулировать по-разному или длиннее 3–4 слов`,
};

// Доля вопросов «впишите ответ» в смешанном тесте: на сложном их больше — угадать нельзя.
const EXACT_SHARE = { easy: 'примерно треть', medium: 'примерно 40%', hard: 'примерно половина' };

// Что значит уровень. Одним словом «hard» модель давала те же вопросы на воспроизведение.
const DIFFICULTY_HINT = {
  easy:   'лёгкая — проверка базовых понятий и определений',
  medium: 'средняя — применение правила к новой ситуации, а не пересказ определения',
  hard:   'сложная — задачи в 2–3 шага рассуждения, сочетание нескольких правил, частные случаи и исключения',
};

// Ложные варианты. Без этого правила модель давала заведомо абсурдные варианты — ответ угадывался
// без знания темы (30 от 150: «20%» против «3000%» и «-5%»).
const DISTRACTOR_RULES = `Неправильные варианты — правдоподобные ловушки из ТИПИЧНЫХ ошибок по этой теме
(перепутан порядок действий, не та единица, пропущен шаг, частая путаница понятий).
Они той же формы, длины и точности, что правильный; заведомо абсурдных и «шуточных» вариантов нет.
Правильный вариант не выделяется формулировкой и стоит на случайном месте.
Варианты не равны друг другу в другой записи (−12/5 и −2,4 — один и тот же ответ).`;

const buildPrompt = ({ topic, count, difficulty, type, language, avoid }) => {
  // avoid — тексты недавних вопросов, чтобы ИИ не повторял их (адаптивная практика).
  const avoidBlock = Array.isArray(avoid) && avoid.length
    ? `\nНЕ повторяй и не перефразируй эти уже заданные вопросы (придумай новые по той же теме):\n${avoid.map((q) => `- ${q}`).join('\n')}\n`
    : '';
  const hasOptions = type === 'single' || type === 'multiple' || type === 'mixed';
  const schema = type === 'mixed'
    ? '{"questions":[{"kind":"single","question":"...","options":["..."],"explanation":"...","answer":["текст правильного варианта"]},{"kind":"exact","question":"...","options":[],"explanation":"...","accepted":["ответ","другая форма записи"]}]}'
    : '{"questions":[{"question":"...","options":["..."],"explanation":"...","answer":["текст правильного варианта"],"sampleAnswer":""}]}';
  return `Составь учебный тест для любого предмета.
Тема: "${topic}".
Язык теста: ${language}.
Количество вопросов: ${count}.
Сложность: ${DIFFICULTY_HINT[difficulty] || difficulty}.
Тип вопросов: ${TYPE_HINT[type]}.${type === 'mixed' ? `\nВопросов kind "exact" — ${EXACT_SHARE[difficulty] || EXACT_SHARE.medium}, остальные kind "single"; чередуй их.` : ''}
${hasOptions ? `${DISTRACTOR_RULES}\n` : ''}${avoidBlock}
Верни СТРОГО валидный JSON без markdown, без текста вокруг, по схеме:
${schema}
- Сначала РЕШИ каждый вопрос сам. explanation — это краткое решение (1–2 предложения, с вычислением, если оно есть); answer${type === 'mixed' ? ' и accepted обязаны' : ' обязан'} следовать из этого решения. Убедись, что верный ответ ровно один.
- Формулы и выражения — обычным текстом (x² + 3x = 0, 3/4, √2), без LaTeX и markdown.
- Ничего, кроме JSON, не выводи.`;
};

const norm = (s) => String(s ?? '').trim().toLowerCase();

// Приводим вопросы от ИИ к хранимому формату { answer: [индексы с 0] }. Ответ ИИ — тексты вариантов;
// вопрос отбрасывается, если ответ не находится среди вариантов однозначно (лучше на вопрос
// меньше, чем неверный ключ: от него зависят баллы, обладание темой и оценки у учителя).
// Смешанный тест: у каждого вопроса свой kind — 'exact' (вписать ответ) или 'single' (варианты).
// Любой другой kind от ИИ считаем вопросом с вариантами — он отсеется, если вариантов нет.
const normalizeQuestions = (questions, type) => (Array.isArray(questions) ? questions : [])
  .map((q) => {
    if (type !== 'mixed') return normalizeQuestion(q, type);
    const kind = q?.kind === 'exact' ? 'exact' : 'single';
    const one = normalizeQuestion(q, kind);
    return one && { kind, ...one };
  })
  .filter(Boolean);

const normalizeQuestion = (q, type) => {
  const question = String(q?.question ?? '').trim();
  if (!question) return null;
  const base = {
    question,
    sampleAnswer: String(q.sampleAnswer ?? ''),
    explanation: String(q.explanation ?? ''),
  };
  if (type === 'open') return { ...base, options: [], answer: [] };

  // Точный ответ: все допустимые формы одного ответа. ИИ иногда кладёт их в answer — берём оттуда.
  if (type === 'exact') {
    const forms = Array.isArray(q.accepted) && q.accepted.length ? q.accepted : q.answer;
    const seen = new Set();
    const accepted = (Array.isArray(forms) ? forms : [])
      .filter((a) => typeof a === 'string' || typeof a === 'number')
      .map((a) => String(a).trim())
      .filter((a) => a && !seen.has(normAnswer(a)) && seen.add(normAnswer(a)));
    return accepted.length ? { ...base, sampleAnswer: '', options: [], answer: [], accepted } : null;
  }

  const options = (Array.isArray(q.options) ? q.options : []).map((o) => String(o).trim());
  const keys = options.map(norm);
  if (options.length < 2 || keys.some((k) => !k) || new Set(keys).size !== keys.length) return null;
  if (type === 'truefalse' && options.length !== 2) return null;

  // Число в answer не принимаем: неизвестно, считала модель с 0 или с 1.
  const given = Array.isArray(q.answer) ? q.answer : [];
  if (!given.length || given.some((a) => typeof a !== 'string')) return null;
  const answer = [...new Set(given.map((a) => keys.indexOf(norm(a))))];
  if (answer.includes(-1)) return null;
  if (type !== 'multiple' && answer.length !== 1) return null;

  return { ...base, options, answer: answer.sort((a, b) => a - b) };
};

// Достаём JSON даже если модель обернула его в ```json ... ``` или добавила текст.
const extractJson = (text) => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('AI вернул неразборчивый ответ');
  return JSON.parse(text.slice(start, end + 1));
};

// Один запрос к AI-провайдеру с ожиданием JSON в ответе. Возвращает распарсенный объект.
const chatJSON = async ({ user, maxTokens = 3000, temperature = 0.7, effort = 'low' }) => {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    const err = new Error('AI не настроен');
    err.code = 'NO_AI_KEY';
    throw err;
  }
  const baseUrl = process.env.AI_BASE_URL || DEFAULT_BASE_URL;

  let lastError = null;
  for (const model of modelChain()) {
    const reasoning = isReasoningModel(model);
    let resp;
    try {
      resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: reasoning ? maxTokens + REASONING_BUDGET[effort] : maxTokens,
          temperature,
          ...(reasoning ? { reasoning_effort: effort } : {}),
          messages: [
            { role: 'system', content: 'Ты — помощник преподавателя. Отвечай только валидным JSON.' },
            { role: 'user', content: user },
          ],
        }),
        signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      });
    } catch (e) {
      lastError = new Error(e.name === 'TimeoutError' ? 'ИИ не ответил вовремя, попробуйте ещё раз' : 'ИИ-сервис недоступен');
      continue;
    }

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      if (isModelGone(resp.status, json)) {
        console.warn(`[ai] модель ${model} недоступна у провайдера, пробуем следующую`);
        if (workingModel === model) workingModel = null;
        lastError = new Error('ИИ временно недоступен');
        continue;
      }
      if (resp.status === 429) throw new Error('ИИ перегружен, попробуйте через минуту');
      console.error(`[ai] ${model}: ${resp.status} ${json?.error?.message}`);
      throw new Error('Ошибка ИИ-сервиса, попробуйте ещё раз');
    }

    workingModel = model;
    const text = json.choices?.[0]?.message?.content ?? '';
    return extractJson(text);
  }
  throw lastError || new Error('ИИ временно недоступен');
};

const generateQuiz = async (params) => {
  // Насколько долго модель думает. На low она ошибалась в самом ключе сложных задач (замер 2026-10-18:
  // «доход 120 000 под 7% за 9 мес.» → отмечено 5 600 вместо 6 300) — неверный ключ хуже лёгкого теста.
  // medium + правило «сначала реши» в промпте: в замерах 18/18 ключей верны, ~2 100 токенов, ~4–13 с.
  // high точнее на многошаговых задачах, но ~9 500 токенов на тест — больше всего минутного лимита
  // бесплатного Groq (8 000 TPM на ключ, общий для всех пользователей): на проде был бы сплошной 429.
  // Перейти на high имеет смысл только на платном тарифе провайдера.
  const parsed = await chatJSON({ user: buildPrompt(params), effort: 'medium' });
  const questions = normalizeQuestions(parsed.questions, params.type);
  if (!questions.length) {
    throw new Error('AI вернул некорректную структуру теста');
  }
  return questions;
};

// Разбить тему на модули и подтемы (от базового к продвинутому) + учебную цель.
// Ширину выбирает ИИ: узкая тема — один модуль, широкая — несколько.
// Возвращает { goal, modules: [{ title, steps: ['...'] }] } — в плоский roadmap собирает utils/roadmap.
const generateRoadmap = async ({ title, subject, language = 'русский' }) => {
  const prompt = `Составь учебный план для самостоятельного изучения темы.
Тема: "${title}".${subject ? `\nПредмет: ${subject}.` : ''}
Язык ответа: ${language}.
Оцени ширину темы. Узкая тема — 1 модуль из 4–6 подтем. Широкая — 2–6 модулей по 3–6 подтем.
Модули и подтемы — от базовых к продвинутым, логичная последовательность изучения; всего не больше 30 подтем.
Каждая подтема — конкретная и проверяемая тестом (не «Введение», не «Повторение»).
Если модуль один, назови его так же, как тему.
Также сформулируй краткую учебную цель темы (1 предложение).
Верни СТРОГО валидный JSON без markdown, без текста вокруг, по схеме:
{"goal":"...","modules":[{"title":"модуль","steps":["подтема 1","подтема 2"]}]}
Ничего, кроме JSON, не выводи.`;
  const parsed = await chatJSON({ user: prompt, maxTokens: 2500, temperature: 0.5 });
  const modules = Array.isArray(parsed.modules) ? parsed.modules : [];
  if (!modules.length) throw new Error('AI вернул пустой роадмап');
  return { goal: typeof parsed.goal === 'string' ? parsed.goal.trim() : null, modules };
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

// Какие ссылки просить. Проверку проходит только существующее, а угадать адрес небольшого сайта
// ИИ почти не может (замер 2026-10-14: «ещё» по подтеме давал 7 выдуманных из 7). Статья Википедии
// проходит почти всегда — неточное название verifySources доводит до настоящей статьи поиском.
// Поэтому — статьи о КОНКРЕТНЫХ понятиях подтемы: их много, и «ещё» не упирается в одну статью.
const LINKS_HINT = `Ссылки — прежде всего статьи Википедии на языке названий о КОНКРЕТНЫХ понятиях подтемы
(каждая ссылка — отдельное понятие, термин, закон, личность или событие), затем официальная документация и
крупнейшие учебные ресурсы. Адреса небольших сайтов не угадывай.`;

// Предложить источники (книги + ссылки) для изучения подтемы. Существование проверяется отдельно.
// avoid — уже показанные (названия/URL), чтобы «подобрать ещё» давало НОВЫЕ.
const suggestSources = async ({ title, subject, language = 'русский', avoid = [] }) => {
  const avoidBlock = avoid.length
    ? `\nНЕ предлагай уже показанные (дай ДРУГИЕ):\n${avoid.slice(0, 30).map((a) => `- ${a}`).join('\n')}\n`
    : '';
  const prompt = `Предложи учебные источники по подтеме "${title}"${subject ? ` (предмет: ${subject})` : ''}.
Язык названий: ${language}.
До 3 известных книг (с автором) и до 5 надёжных ссылок.
${LINKS_HINT}
Предлагай только то, что вероятно существует. Не выдумывай книги и URL — лучше меньше, но реальные.
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

// Источники сразу на несколько подтем — один вызов ИИ вместо одного на подтему.
// Модуль целиком (кнопка модуля) или весь трек (стартовые источники при создании).
// steps — подтемы [{ id, title, moduleTitle? }]. ИИ размечает ответ НОМЕРОМ подтемы (с 1, как в
// списке промпта); номер вне списка отбрасываем. Возвращает [{ step, books, links }] — формат,
// который принимает verifySources. perStep — сколько книг и ссылок просить на подтему.
const suggestSourcesForSteps = async ({ topic, moduleTitle, steps, subject, language = 'русский', perStep = 2 }) => {
  // Весь трек: подтемы из разных модулей — модуль в строке, иначе «Основные понятия» неоднозначны
  const list = steps.map((s, i) => `${i + 1}. ${!moduleTitle && s.moduleTitle ? `${s.moduleTitle} — ` : ''}${s.title}`).join('\n');
  const scope = moduleTitle ? `модуля "${moduleTitle}" темы "${topic}"` : `темы "${topic}"`;
  const prompt = `Подбери учебные источники для ${scope}${subject ? ` (предмет: ${subject})` : ''}.
Подтемы:
${list}
Для КАЖДОЙ подтемы: до ${perStep} известных книг (с автором) и до ${perStep} надёжных ссылок.
${LINKS_HINT}
Язык названий: ${language}. Предлагай только то, что вероятно существует. Не выдумывай книги и URL — лучше меньше, но реальные.
Верни СТРОГО валидный JSON без markdown, где step — номер подтемы из списка:
{"items":[{"step":1,"books":[{"title":"...","author":"..."}],"links":[{"title":"...","url":"https://..."}]}]}
Ничего, кроме JSON.`;
  // ~50 токенов на источник: 30 подтем × 2 источника не должны обрезать JSON на середине
  const parsed = await chatJSON({ user: prompt, maxTokens: Math.max(3000, steps.length * perStep * 2 * 60), temperature: 0.4 });
  return (Array.isArray(parsed.items) ? parsed.items : [])
    .map((it) => ({
      step: steps[Number(it?.step) - 1],
      books: Array.isArray(it?.books) ? it.books : [],
      links: Array.isArray(it?.links) ? it.links : [],
    }))
    .filter((it) => it.step);
};

// Подсказка по уровню для промпта: под какой уровень подбирать лексику.
const LEVEL_HINT = {
  beginner:     'начальный уровень (A1–A2): частотные, базовые, повседневные слова',
  intermediate: 'средний уровень (B1–B2): слова средней частотности, полезные в живой речи',
  advanced:     'продвинутый уровень (C1–C2): более редкие, точные, продвинутые слова',
};

// Сгенерировать НАБОР слов для изучения языка.
//   language       — ISO-код изучаемого языка (слова будут на нём), напр. 'pl'
//   nativeLanguage — ISO-код родного (перевод будет на нём), напр. 'ru'
//   topic          — тема набора («еда», «для работы официантом», «школа»…)
//   count          — сколько слов (1..100)
//   level          — beginner|intermediate|advanced
//   avoid          — слова, которые уже есть у ученика (не повторять их)
// Возвращает нормализованный массив [{ word, translation, example }].
const generateVocab = async ({ language, nativeLanguage, topic, count = 20, level = 'beginner', avoid = [] }) => {
  const n = Math.min(100, Math.max(1, Number(count) || 20)); // страхуемся: держим 1..100
  const levelHint = LEVEL_HINT[level] || LEVEL_HINT.beginner;

  // Блок анти-повтора: список уже существующих слов, чтобы ИИ дал НОВЫЕ. Ограничиваем 300 (объём промпта).
  const avoidBlock = Array.isArray(avoid) && avoid.length
    ? `\nЭти слова у ученика УЖЕ ЕСТЬ — не повторяй их, дай другие:\n${avoid.slice(0, 300).join(', ')}\n`
    : '';

  const prompt = `Подбери набор слов для изучения языка.
Язык слов (ISO-код): "${language}" — ВСЕ слова строго на этом языке.
Язык перевода (ISO-код): "${nativeLanguage}" — перевод каждого слова на этот язык.
Тема набора: "${topic}".
Уровень: ${levelHint}.
Количество слов: ровно ${n} (без повторов, разные слова по теме).
Для каждого слова добавь короткий пример-предложение на языке "${language}" (естественное употребление слова).
${avoidBlock}Верни СТРОГО валидный JSON без markdown, без текста вокруг, по схеме:
{"words":[{"word":"...","translation":"...","example":"..."}]}
Ничего, кроме JSON, не выводи.`;

  // maxTokens растёт с числом слов (каждое слово + перевод + пример ≈ 55 токенов).
  // Модель изредка возвращает битый JSON — делаем одну повторную попытку (кроме случая «нет ключа»).
  const opts = { user: prompt, maxTokens: Math.min(8000, 400 + n * 60), temperature: 0.4 };
  let parsed;
  try {
    parsed = await chatJSON(opts);
  } catch (e) {
    if (e.code === 'NO_AI_KEY') throw e; // отсутствие ключа ретраить бессмысленно
    parsed = await chatJSON(opts);       // вторая попытка на случай кривого JSON
  }

  const words = (Array.isArray(parsed.words) ? parsed.words : [])
    .map((w) => ({
      word:        String(w.word || '').trim(),
      translation: String(w.translation || '').trim(),
      example:     String(w.example || '').trim() || null, // пустой пример → null
    }))
    .filter((w) => w.word && w.translation) // выкидываем неполные пары
    .slice(0, n);                           // не больше запрошенного

  if (!words.length) throw new Error('AI вернул пустой набор слов');
  return words;
};

module.exports = { generateQuiz, normalizeQuestions, generateRoadmap, generateFlashcards, generateFlashcardsFromText, gradeOpenAnswers, suggestSources, suggestSourcesForSteps, generateVocab };
