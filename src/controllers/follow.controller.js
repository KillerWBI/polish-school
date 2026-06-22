const { Follow, User } = require('../models');

// POST /users/:id/follow — подписаться. Идемпотентно (повтор не дублирует).
const follow = async (req, res) => {
  try {
    const followingId = req.params.id;
    const followerId = req.user.id;

    if (followingId === followerId) {
      return res.status(400).json({ error: 'Нельзя подписаться на себя' });
    }

    const target = await User.findByPk(followingId, { attributes: ['id'] });
    if (!target) return res.status(404).json({ error: 'Пользователь не найден' });

    // findOrCreate + unique-индекс (followerId, followingId) → дубля не будет
    await Follow.findOrCreate({ where: { followerId, followingId } });
    res.status(201).json({ data: { message: 'Подписка оформлена' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка подписки' });
  }
};

// DELETE /users/:id/follow — отписаться.
const unfollow = async (req, res) => {
  try {
    await Follow.destroy({
      where: { followerId: req.user.id, followingId: req.params.id },
    });
    res.json({ data: { message: 'Отписка выполнена' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка отписки' });
  }
};

module.exports = { follow, unfollow };
