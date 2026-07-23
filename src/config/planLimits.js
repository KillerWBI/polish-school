// Лимиты тарифов по роли (анти-абуз + монетизация). Ключи тарифов: free/pro/school
// (отображаются как Бесплатный / Стандартный $3.99 / Максимальный $7.99; ≈15/30 zł по курсу; реальная валюта — в Paddle).
// aiPerDay — дневной лимит ИИ-запросов (роадмап/тест/карточки/оценка/источники) — главный ресурс (стоит денег).
const LIMITS = {
  teacher: {
    free:   { groups: 3,   students: 25,   courses: 8,   aiPerDay: 30   },
    pro:    { groups: 15,  students: 150,  courses: 40,  aiPerDay: 150  },
    school: { groups: 200, students: 3000, courses: 500, aiPerDay: 1000 },
  },
  student: {
    free:   { tracks: 3,   vocab: 100,   notes: 30,   aiPerDay: 20  },
    pro:    { tracks: 20,  vocab: 1000,  notes: 500,  aiPerDay: 100 },
    school: { tracks: 200, vocab: 10000, notes: 5000, aiPerDay: 500 },
  },
};

const LABEL = {
  groups: 'групп', students: 'учеников', courses: 'индивидуальных курсов',
  tracks: 'учебных треков', vocab: 'слов в словаре', notes: 'заметок',
};

const limitsFor = (role, plan) =>
  (LIMITS[role] && LIMITS[role][plan]) || LIMITS[role]?.free || LIMITS.student.free;
const limitFor  = (role, plan, resource) => limitsFor(role, plan)[resource];

// Если достигнут лимит по количеству — отправляет 403 и возвращает true (вызывающий делает `return`).
const overLimit = (res, role, plan, resource, used) => {
  const max = limitFor(role, plan, resource);
  if (used >= max) {
    res.status(403).json({
      error: `Достигнут лимит тарифа: ${max} ${LABEL[resource] || resource}. Перейдите на тариф выше, чтобы снять ограничение.`,
      code: 'PLAN_LIMIT', resource, max,
    });
    return true;
  }
  return false;
};

module.exports = { LIMITS, limitsFor, limitFor, overLimit };
