const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Пост ленты: автор (учитель или студент) публикует текст + опционально медиа.
// viewsCount — счётчик просмотров (инкрементится при выдаче в ленте, батчем).
// Лайки считаются отдельно — COUNT по PostLike.
const Post = sequelize.define('Post', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  authorId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  text: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  // Массив URL загруженных в Cloudinary картинок (фаза 2). По умолчанию — пусто.
  media: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  viewsCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
});

module.exports = Post;
