const { User } = require('../models');

const getAll = async (req, res) => {
  try {
    const users = await User.findAll({
      where: { role: 'student' },
      attributes: ['id', 'name', 'email', 'role'],
    });
    res.json({ data: users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения пользователей' });
  }
};

const getOne = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: ['id', 'name', 'email', 'role'],
    });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    // студент может смотреть только себя
    if (req.user.role === 'student' && req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    res.json({ data: user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения пользователя' });
  }
};

const update = async (req, res) => {
  try {
    // студент может изменять только себя
    if (req.user.role === 'student' && req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const { name, email } = req.body;
    await user.update({ name, email });

    res.json({ data: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления пользователя' });
  }
};

module.exports = { getAll, getOne, update };
