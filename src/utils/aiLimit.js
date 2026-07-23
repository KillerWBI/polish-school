const { User } = require('../models');
const { limitsFor } = require('../config/planLimits');

const today = () => new Date().toISOString().slice(0, 10);

// Списать 1 ИИ-запрос из дневного лимита пользователя. { ok, limit, used, remaining }.
const consumeAi = async (userId, role) => {
  const user = await User.findByPk(userId, { attributes: ['id', 'plan', 'aiUsageDate', 'aiUsageCount'] });
  if (!user) return { ok: false, limit: 0, used: 0, remaining: 0 };
  const d = today();
  const used = user.aiUsageDate === d ? (user.aiUsageCount || 0) : 0;
  const limit = limitsFor(role, user.plan).aiPerDay;
  if (used >= limit) return { ok: false, limit, used, remaining: 0 };
  await user.update({ aiUsageDate: d, aiUsageCount: used + 1 });
  return { ok: true, limit, used: used + 1, remaining: limit - used - 1 };
};

// Списать и, если лимит исчерпан, отправить 429. Возвращает true, если исчерпан (вызывающий делает return).
const enforceAi = async (res, userId, role) => {
  const r = await consumeAi(userId, role);
  if (!r.ok) {
    res.status(429).json({
      error: `Дневной лимит ИИ-запросов исчерпан (${r.limit} в день). Вернитесь завтра или перейдите на тариф выше.`,
      code: 'AI_LIMIT', limit: r.limit,
    });
    return true;
  }
  return false;
};

// Текущий остаток без списания (для показа на фронте).
const aiUsage = async (userId, role) => {
  const user = await User.findByPk(userId, { attributes: ['plan', 'aiUsageDate', 'aiUsageCount'] });
  const used = user?.aiUsageDate === today() ? (user.aiUsageCount || 0) : 0;
  const limit = limitsFor(role, user?.plan).aiPerDay;
  return { used, limit, remaining: Math.max(0, limit - used) };
};

module.exports = { consumeAi, enforceAi, aiUsage };
