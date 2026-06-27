const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Лайк поста: кто (userId) лайкнул какой пост (postId).
// Unique-пара — один пользователь лайкает пост максимум один раз.
const PostLike = sequelize.define('PostLike', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  postId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
}, {
  indexes: [{ unique: true, fields: ['userId', 'postId'] }],
});

module.exports = PostLike;
