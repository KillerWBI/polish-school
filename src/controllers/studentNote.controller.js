const { StudentNote } = require('../models');

// GET /notes — заметки ученика (фильтр ?lessonId= / ?individualLessonId=)
const list = async (req, res) => {
  try {
    const where = { userId: req.user.id };
    if (req.query.lessonId) where.lessonId = req.query.lessonId;
    if (req.query.individualLessonId) where.individualLessonId = req.query.individualLessonId;

    const rows = await StudentNote.findAll({ where, order: [['updatedAt', 'DESC']] });
    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения заметок' });
  }
};

// POST /notes — создать заметку
const create = async (req, res) => {
  try {
    const { lessonId, individualLessonId, title, text } = req.body;
    const note = await StudentNote.create({
      userId: req.user.id,
      lessonId: lessonId || null,
      individualLessonId: individualLessonId || null,
      title: title || null,
      text,
    });
    res.status(201).json({ data: note });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания заметки' });
  }
};

// PUT /notes/:id — редактировать (только свою)
const update = async (req, res) => {
  try {
    const note = await StudentNote.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!note) return res.status(404).json({ error: 'Заметка не найдена' });
    const { title, text } = req.body;
    await note.update({
      ...(title !== undefined && { title }),
      ...(text !== undefined && { text }),
    });
    res.json({ data: note });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления заметки' });
  }
};

// DELETE /notes/:id
const remove = async (req, res) => {
  try {
    const note = await StudentNote.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!note) return res.status(404).json({ error: 'Заметка не найдена' });
    await note.destroy();
    res.json({ data: { id: note.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления заметки' });
  }
};

module.exports = { list, create, update, remove };
