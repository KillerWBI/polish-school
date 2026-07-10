const sequelize = require('../config/database');
const { QueryTypes } = require('sequelize');
const { Student, VocabItem, StudentLessonLog } = require('../models');
const { getStudentIdsForUser } = require('../utils/students');
// FK = список 6 таблиц, где лежит ученик (см. studentFkRegistry.js). Каждый элемент —
// объект { table:'Attendances', column:'studentId', uniqueWith:[...] }. Это и есть «где искать ученика».
const FK = require('../utils/studentFkRegistry');

// POST /students/:id/merge — перенести заглушку (source) на реального ученика (target).
// Все записи заглушки перепривязываются на target по реестру FK (в транзакции),
// конфликты unique разрешаются «keep-target, skip-source» (дубль заглушки удаляется),
// затем заглушка удаляется. Каскад НЕ используется (5 FK = NO ACTION на delete) —
// чистим/перепривязываем явно по studentFkRegistry.
const merge = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const sourceId = req.params.id;
    const { targetStudentId } = req.body;

    if (sourceId === targetStudentId) {
      return res.status(400).json({ error: 'Нельзя перенести запись саму в себя' });
    }

    // source — моя заглушка (без аккаунта)
    const source = await Student.findOne({ where: { id: sourceId, teacherId } });
    if (!source) return res.status(404).json({ error: 'Заглушка не найдена' });
    if (source.userId !== null) {
      return res.status(400).json({ error: 'Переносить можно только заглушку (без аккаунта)' });
    }

    // target — мой реальный ученик (с аккаунтом)
    const target = await Student.findOne({ where: { id: targetStudentId, teacherId } });
    if (!target) return res.status(404).json({ error: 'Целевой ученик не найден' });
    if (target.userId === null) {
      return res.status(400).json({ error: 'Переносить можно только на реального ученика (с аккаунтом)' });
    }

    let moved = 0, skipped = 0;
    // Транзакция = «всё или ничего»: если что-то упадёт посреди переноса — откатится целиком.
    await sequelize.transaction(async (t) => {
      // q — короткий помощник «выполнить SQL внутри транзакции».
      // :source / :target — это «дырки» под значения; Sequelize безопасно подставит туда
      // id заглушки и id реального ученика (вместо склейки строк руками).
      const q = (sql) => sequelize.query(sql, {
        transaction: t,
        replacements: { source: sourceId, target: targetStudentId },
      });

      // Идём по 6 таблицам и из каждой достаём 3 поля: имя таблицы, колонку, ключи уникальности.
      for (const { table, column, uniqueWith } of FK) {
        // ── ШАГ 1. Убрать дубли, иначе перенос упадёт ──
        // Пример: Вася(заглушка) и Артём(реальный) ОБА отмечены на уроке L1.
        // Если просто заменить Вася→Артём — будет две строки «L1+Артём», а база запрещает
        // (правило: один ученик = одна отметка на урок). Поэтому строку Васи на L1 сначала удаляем.
        // uniqueWith — по каким колонкам сверять «уже есть» (у посещаемости это lessonId / individualLessonId).
        for (const key of uniqueWith) {
          // cond собирает текст условия, напр.:  tgt."lessonId" = src."lessonId"
          const cond = key.map((c) => `tgt."${c}" = src."${c}"`).join(' AND ');
          // src и tgt — два ПРОЗВИЩА одной и той же таблицы: src = строки Васи, tgt = строки Артёма.
          // Смысл: «удали строки Васи, у которых у Артёма уже есть строка на том же уроке».
          const del = await q(
            `DELETE FROM "${table}" src
             WHERE src."${column}" = :source
               AND EXISTS (SELECT 1 FROM "${table}" tgt
                           WHERE tgt."${column}" = :target AND ${cond})`
          );
          skipped += del?.[1]?.rowCount ?? 0; // сколько дублей удалили
        }
        // ── ШАГ 2. Перенести остальное ──  «у всех оставшихся строк Васи поставить владельцем Артёма».
        const upd = await q(`UPDATE "${table}" SET "${column}" = :target WHERE "${column}" = :source`);
        moved += upd?.[1]?.rowCount ?? 0; // сколько строк перенесли
      }

      // Всё перевешено на Артёма → у заглушки детей не осталось, удаляем её саму.
      await Student.destroy({ where: { id: sourceId }, transaction: t });
    });

    res.json({ data: { merged: true, moved, skipped } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка переноса' });
  }
};

// DELETE /students/:id — полностью удалить заглушку из ростера вместе с её историей.
// Только свою заглушку (userId=null); реального ученика так удалить нельзя.
// Каскада на delete нет → удаляем детей явно по реестру FK, потом саму заглушку.
const remove = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const studentId = req.params.id;

    const student = await Student.findOne({ where: { id: studentId, teacherId } });
    if (!student) return res.status(404).json({ error: 'Запись не найдена' });
    if (student.userId !== null) {
      return res.status(403).json({ error: 'Удалять можно только заглушку (реального ученика — нельзя)' });
    }

    await sequelize.transaction(async (t) => {
      // Пройти по всем 6 таблицам и снести строки этой заглушки
      for (const { table, column } of FK) {
        await sequelize.query(`DELETE FROM "${table}" WHERE "${column}" = :id`, {
          transaction: t, replacements: { id: studentId },
        });
      }
      await Student.destroy({ where: { id: studentId }, transaction: t });
    });

    res.json({ data: { message: 'Заглушка удалена' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления' });
  }
};

// GET /students/me/progress — прогресс-центр ученика:
// streak (дней активности подряд), активность по дням (heatmap), словарь-статы, внешние занятия.
// Активность = день, когда был на уроке / сдал ДЗ / трогал словарь / записал внешнее занятие.
const getMyProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const studentIds = await getStudentIdsForUser(userId);

    // Собираем даты активности за последние 180 дней из 4 источников.
    let activityRows = [];
    if (studentIds.length) {
      activityRows = await sequelize.query(`
        SELECT day, COUNT(*)::int AS count FROM (
          SELECT l.date AS day
            FROM "Attendances" a JOIN "Lessons" l ON l.id = a."lessonId"
            WHERE a."studentId" IN (:studentIds) AND a.present = true
          UNION ALL
          SELECT il.date AS day
            FROM "Attendances" a JOIN "IndividualLessons" il ON il.id = a."individualLessonId"
            WHERE a."studentId" IN (:studentIds) AND a.present = true
          UNION ALL
          SELECT (hs."createdAt")::date AS day
            FROM "HomeworkSubmissions" hs WHERE hs."studentId" IN (:studentIds)
          UNION ALL
          SELECT (v."updatedAt")::date AS day
            FROM "VocabItems" v WHERE v."userId" = :userId
          UNION ALL
          SELECT sl.date AS day
            FROM "StudentLessonLogs" sl WHERE sl."userId" = :userId
        ) src
        WHERE day >= (NOW() - INTERVAL '180 days')::date
        GROUP BY day ORDER BY day;
      `, { type: QueryTypes.SELECT, replacements: { studentIds, userId } });
    } else {
      // Нет Student-записей (не привязан к учителю) — только личные источники
      activityRows = await sequelize.query(`
        SELECT day, COUNT(*)::int AS count FROM (
          SELECT (v."updatedAt")::date AS day FROM "VocabItems" v WHERE v."userId" = :userId
          UNION ALL
          SELECT sl.date AS day FROM "StudentLessonLogs" sl WHERE sl."userId" = :userId
        ) src
        WHERE day >= (NOW() - INTERVAL '180 days')::date
        GROUP BY day ORDER BY day;
      `, { type: QueryTypes.SELECT, replacements: { userId } });
    }

    // Нормализуем ключи в 'YYYY-MM-DD'
    const activeDays = new Set();
    const activityByDay = activityRows.map((r) => {
      const key = (r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day).slice(0, 10));
      activeDays.add(key);
      return { date: key, count: r.count };
    });

    // Streak — сколько дней подряд активности заканчивая сегодня/вчера
    const dayKey = (d) => d.toISOString().slice(0, 10);
    let streak = 0;
    const cursor = new Date();
    // если сегодня активности нет — стрик может считаться от вчера
    if (!activeDays.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (activeDays.has(dayKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    // Словарь-статы
    const vocab = await VocabItem.findAll({ where: { userId }, attributes: ['status'] });
    const vocabCounts = { new: 0, learning: 0, known: 0 };
    for (const v of vocab) vocabCounts[v.status] = (vocabCounts[v.status] ?? 0) + 1;

    // Внешние занятия — часы и число
    const ext = await StudentLessonLog.findAll({ where: { userId }, attributes: ['durationMin'] });
    const extMinutes = ext.reduce((s, r) => s + (r.durationMin || 0), 0);

    res.json({
      data: {
        streak,
        activityByDay,
        vocab: { ...vocabCounts, total: vocab.length },
        external: { lessons: ext.length, hours: Math.round(extMinutes / 6) / 10 },
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения прогресса' });
  }
};

module.exports = { merge, remove, getMyProgress };
