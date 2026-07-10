const { Attendance, Lesson, Group, IndividualLesson, Student, User } = require('../models');
const { Op } = require('sequelize');
const { isHwOwner } = require('../utils/ownership');
const { getStudentIdsForUser, getTeacherStudentIds } = require('../utils/students');
const { notifyMany } = require('../utils/notify');

// ── Авто-подтверждение: если студент не ответил за 3 дня — засчитываем как учитель ──
const autoConfirmExpired = async () => {
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  await Attendance.sequelize.query(`
    UPDATE "Attendances" a
    SET "studentMarked" = "teacherMarked",
        "status"        = 'confirmed',
        "present"       = "teacherMarked",
        "updatedAt"     = NOW()
    FROM "Lessons" l
    WHERE a."lessonId" = l.id
      AND a."status" = 'pending_student'
      AND l."date" < :cutoff
  `, { replacements: { cutoff } });

  await Attendance.sequelize.query(`
    UPDATE "Attendances" a
    SET "studentMarked" = "teacherMarked",
        "status"        = 'confirmed',
        "present"       = "teacherMarked",
        "updatedAt"     = NOW()
    FROM "IndividualLessons" il
    WHERE a."individualLessonId" = il.id
      AND a."status" = 'pending_student'
      AND il."date" < :cutoff
  `, { replacements: { cutoff } });
};

// ── GET /attendance — история для текущего пользователя ──────────────────────────
const getAll = async (req, res) => {
  try {
    // Сначала авто-подтверждаем просроченные pending-записи (ленивая обработка)
    await autoConfirmExpired();

    const where = {};
    if (req.user.role === 'student') {
      where.studentId = await getStudentIdsForUser(req.user.id); // все Student-записи пользователя
    } else {
      // Учитель видит только посещаемость СВОИХ учеников (изоляция арендаторов).
      // Пустой массив → IN (NULL) → ничего не вернёт (защита от чужого studentId/groupId).
      const myStudentIds = await getTeacherStudentIds(req.user.id);
      if (req.query.studentId) {
        where.studentId = myStudentIds.includes(req.query.studentId) ? [req.query.studentId] : [];
      } else {
        where.studentId = myStudentIds;
      }
    }

    if (req.query.lessonId)           where.lessonId           = req.query.lessonId;
    if (req.query.individualLessonId) where.individualLessonId = req.query.individualLessonId;

    // Фильтр по статусу: по умолчанию только 'confirmed'
    if (req.query.status) {
      where.status = req.query.status;
    }

    const lessonInclude = {
      model: Lesson,
      attributes: ['id', 'date', 'time', 'topic', 'groupId'],
      required: false,
      include: [{ model: Group, attributes: ['id', 'name'] }],
    };

    const indivInclude = {
      model: IndividualLesson,
      attributes: ['id', 'date', 'time', 'topic'],
      required: false,
      include: [{ model: Student, as: 'student', attributes: ['id', 'name'] }],
    };

    if (req.query.month || req.query.from || req.query.to) {
      const lessonWhere = {};
      if (req.query.groupId) lessonWhere.groupId = req.query.groupId;
      if (req.query.month) {
        const [y, m] = req.query.month.split('-').map(Number);
        const start = `${y}-${String(m).padStart(2,'0')}-01`;
        const end   = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
        lessonWhere.date = { [Op.between]: [start, end] };
      } else {
        if (req.query.from || req.query.to) {
          lessonWhere.date = {};
          if (req.query.from) lessonWhere.date[Op.gte] = req.query.from;
          if (req.query.to)   lessonWhere.date[Op.lte] = req.query.to;
        }
      }
      lessonInclude.where    = lessonWhere;
      lessonInclude.required = true;
    } else if (req.query.groupId) {
      lessonInclude.where    = { groupId: req.query.groupId };
      lessonInclude.required = true;
    }

    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const { count, rows } = await Attendance.findAndCountAll({
      where,
      include: [lessonInclude, indivInclude],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      subQuery: false,
      distinct: true,
    });

    res.json({ data: rows, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения посещаемости' });
  }
};

// ── GET /attendance/pending — ожидающие подтверждения / спорные ───────────────────
// Студент: свои pending_student записи
// Учитель: pending_student + disputed записи по его урокам
const getPending = async (req, res) => {
  try {
    await autoConfirmExpired();

    let records;

    if (req.user.role === 'student') {
      const myStudentIds = await getStudentIdsForUser(req.user.id);
      records = await Attendance.findAll({
        where: { studentId: myStudentIds, status: { [Op.in]: ['pending_student', 'disputed'] } },
        include: [
          { model: Lesson,         attributes: ['id','date','time','topic'], required: false,
            include: [{ model: Group, attributes: ['id','name'] }] },
          { model: IndividualLesson, attributes: ['id','date','time','topic'], required: false },
        ],
        order: [['createdAt', 'DESC']],
      });
    } else {
      // Учитель: собираем все его уроки
      const groups = await Group.findAll({ where: { teacherId: req.user.id }, attributes: ['id'] });
      const groupIds = groups.map(g => g.id);

      const [lessons, indLessons] = await Promise.all([
        groupIds.length
          ? Lesson.findAll({ where: { groupId: { [Op.in]: groupIds } }, attributes: ['id'] })
          : [],
        IndividualLesson.findAll({ where: { teacherId: req.user.id }, attributes: ['id'] }),
      ]);

      const orConditions = [];
      if (lessons.length)    orConditions.push({ lessonId:           { [Op.in]: lessons.map(l => l.id) } });
      if (indLessons.length) orConditions.push({ individualLessonId: { [Op.in]: indLessons.map(l => l.id) } });

      if (!orConditions.length) return res.json({ data: [] });

      records = await Attendance.findAll({
        where: {
          [Op.or]:  orConditions,
          status:   { [Op.in]: ['pending_student', 'disputed'] },
        },
        include: [
          { model: Lesson,          attributes: ['id','date','time','topic'], required: false,
            include: [{ model: Group, attributes: ['id','name'] }] },
          { model: IndividualLesson, attributes: ['id','date','time','topic'], required: false },
          { model: Student, as: 'student', attributes: ['id','name'],
            include: [{ model: User, as: 'account', attributes: ['email'] }] },
        ],
        order: [['createdAt', 'DESC']],
      });
    }

    res.json({ data: records });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения ожидающих записей' });
  }
};

// ── POST /attendance — учитель отмечает посещаемость (bulk) ─────────────────────
const create = async (req, res) => {
  try {
    const { lessonId, individualLessonId, records } = req.body;
    if (!await isHwOwner({ lessonId, individualLessonId }, req.user.id)) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    const whereClause = lessonId ? { lessonId } : { individualLessonId };

    // Upsert по студенту, НЕ затирая уже полученные подтверждения.
    // Логика на каждого студента из records:
    //  - записи ещё нет        → создаём pending_student (ждём подтверждения);
    //  - отметка учителя та же  → НЕ трогаем (сохраняем confirmed/disputed/pending);
    //  - отметка изменилась     → сбрасываем в pending_student (студент подтверждает заново).
    // Заглушки (Student.userId IS NULL) — подтверждать некому, отметка учителя финальна.
    const placeholderRows = await Student.findAll({
      where: { id: records.map(r => r.studentId), userId: null }, attributes: ['id'],
    });
    const placeholderIds = new Set(placeholderRows.map(p => p.id));

    const result = await Attendance.sequelize.transaction(async (t) => {
      const existing = await Attendance.findAll({ where: whereClause, transaction: t });
      const byStudent = new Map(existing.map(r => [r.studentId, r]));

      const out = [];
      for (const r of records) {
        const newMark = r.present ?? false;
        // Заглушка → сразу confirmed/present; реальный → pending_student (ждёт подтверждения)
        const fields = placeholderIds.has(r.studentId)
          ? { teacherMarked: newMark, studentMarked: newMark, present: newMark, status: 'confirmed' }
          : { teacherMarked: newMark, studentMarked: null,    present: null,    status: 'pending_student' };
        const ex = byStudent.get(r.studentId);

        if (!ex) {
          out.push(await Attendance.create({
            lessonId:           lessonId           ?? null,
            individualLessonId: individualLessonId ?? null,
            studentId:          r.studentId,
            ...fields,
          }, { transaction: t }));
        } else if (ex.teacherMarked !== newMark) {
          out.push(await ex.update(fields, { transaction: t }));
        } else {
          out.push(ex); // отметка не изменилась — статус подтверждения сохраняется
        }
      }
      return out;
    });

    // Уведомляем реальных студентов (не заглушек), у кого запись ждёт подтверждения (fire-and-forget)
    const pendingStudentIds = result
      .filter(r => r.status === 'pending_student')
      .map(r => r.studentId);
    if (pendingStudentIds.length) {
      Student.findAll({ where: { id: pendingStudentIds }, attributes: ['userId'] })
        .then((rows) => notifyMany(rows.map(s => s.userId).filter(Boolean), {
          type: 'attendance_pending',
          title: 'Подтвердите посещение',
          body: 'Учитель отметил вас на уроке',
          link: '/attendance',
        }))
        .catch(() => {});
    }

    res.status(201).json({ data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания посещаемости' });
  }
};

// ── POST /attendance/:id/confirm — студент подтверждает или оспаривает ────────────
const confirmStudent = async (req, res) => {
  try {
    const record = await Attendance.findByPk(req.params.id);
    if (!record) return res.status(404).json({ error: 'Запись не найдена' });
    // record.studentId — Student.id; проверяем, что он среди Student-записей пользователя
    const myStudentIds = await getStudentIdsForUser(req.user.id);
    if (!myStudentIds.includes(record.studentId)) return res.status(403).json({ error: 'Доступ запрещён' });

    const { present } = req.body;
    record.studentMarked = present;

    if (present === record.teacherMarked) {
      record.status  = 'confirmed';
      record.present = record.teacherMarked;
    } else {
      // Ответы разошлись — посещение НЕ засчитывается пока не разрешён спор
      record.status  = 'disputed';
      record.present = false;
    }

    await record.save();
    res.json({ data: record });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка подтверждения' });
  }
};

// ── PUT /attendance/:id — учитель разрешает спор ─────────────────────────────────
// body: { accept: true }  → принять версию студента
// body: { accept: false } → настоять на своей версии
const teacherResolve = async (req, res) => {
  try {
    const record = await Attendance.findByPk(req.params.id);
    if (!record) return res.status(404).json({ error: 'Запись не найдена' });
    if (!await isHwOwner(record, req.user.id)) return res.status(403).json({ error: 'Доступ запрещён' });

    const { accept } = req.body;
    if (typeof accept !== 'boolean') {
      return res.status(400).json({ error: 'accept обязателен (true/false)' });
    }

    if (accept) {
      // Принять позицию студента
      record.teacherMarked = record.studentMarked;
      record.present       = record.studentMarked;
    } else {
      // Настоять на своей позиции
      record.studentMarked = record.teacherMarked;
      record.present       = record.teacherMarked;
    }
    record.status = 'confirmed';
    await record.save();
    res.json({ data: record });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка разрешения спора' });
  }
};

module.exports = { getAll, getPending, create, confirmStudent, teacherResolve };
