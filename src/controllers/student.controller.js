const sequelize = require('../config/database');
const { Student } = require('../models');
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

module.exports = { merge, remove };
