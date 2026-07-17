// Интервальное повторение (spaced repetition).
// Верно  → следующий показ через 2^streak дней (1,2,4,8,16…), streak++, 5 подряд → 'known'.
// Неверно → показать через 1 час, streak сброшен, статус 'learning'.
// Та же формула, что в словаре (vocab.controller) — вынесена для переиспользования.
const KNOWN_THRESHOLD = 5;

const computeSr = (correctStreak, correct) => {
  const next = new Date();
  if (correct) {
    const intervalDays = Math.pow(2, correctStreak); // 1,2,4,8,16…
    next.setDate(next.getDate() + intervalDays);
    const streak = correctStreak + 1;
    return {
      correctStreak: streak,
      status: streak >= KNOWN_THRESHOLD ? 'known' : 'learning',
      nextReviewAt: next,
    };
  }
  next.setHours(next.getHours() + 1);
  return { correctStreak: 0, status: 'learning', nextReviewAt: next };
};

module.exports = { computeSr, KNOWN_THRESHOLD };
