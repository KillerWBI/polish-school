const crypto = require('crypto');

// План трека хранится ПЛОСКИМ списком подтем (Topic.roadmap): подтема — единица практики,
// её id — stepId во всех местах (попытки, карточки, источники, слабые места, сессия).
// Модуль — подпись у подтемы (moduleId + moduleTitle), а не уровень вложенности: так все
// потребители roadmap работают без правок, а миграция не нужна (JSONB).
// У старых треков moduleId нет — фронт показывает их одним модулем.
const MAX_STEPS = 30; // больше — трек превращается в список, который никто не пройдёт

// Модули от ИИ [{ title, steps: ['подтема', ...] }] → плоский roadmap.
const buildRoadmap = (modules) => {
  const steps = [];
  for (const m of Array.isArray(modules) ? modules : []) {
    const moduleTitle = String(m?.title ?? '').trim();
    const titles = (Array.isArray(m?.steps) ? m.steps : []).map((s) => String(s).trim()).filter(Boolean);
    if (!moduleTitle || !titles.length) continue;
    const moduleId = crypto.randomUUID();
    for (const title of titles) {
      if (steps.length === MAX_STEPS) return steps;
      steps.push({ id: crypto.randomUUID(), title, order: steps.length, mastery: 0, attempts: 0, moduleId, moduleTitle });
    }
  }
  return steps;
};

// Заголовок подтемы для промптов ИИ: «Тема — Модуль — Подтема» — без контекста модуля
// подтема вроде «Основные понятия» неоднозначна.
const stepTitleForAi = (topicTitle, step) => {
  if (step.title === topicTitle) return topicTitle;
  return [topicTitle, step.moduleTitle, step.title].filter(Boolean).join(' — ');
};

module.exports = { buildRoadmap, stepTitleForAi, MAX_STEPS };
