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

const generateQuiz = async (params) => {
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
      max_tokens: 3000,
      temperature: 0.7,
      messages: [
        { role: 'system', content: 'Ты — помощник преподавателя. Отвечай только валидным JSON.' },
        { role: 'user', content: buildPrompt(params) },
      ],
    }),
  });

  const json = await resp.json();
  if (!resp.ok) throw new Error(json?.error?.message || 'Ошибка AI-провайдера');

  const text = json.choices?.[0]?.message?.content ?? '';
  const parsed = extractJson(text);
  if (!Array.isArray(parsed.questions) || !parsed.questions.length) {
    throw new Error('AI вернул некорректную структуру теста');
  }
  return parsed.questions;
};

module.exports = { generateQuiz };
