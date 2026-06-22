const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Подписка: кто (follower) подписался на кого (following).
// Мгновенное действие без подтверждения — нужна только для ленты.
// timestamps оставляем (createdAt = «подписан с такого-то»).
const Follow = sequelize.define('Follow', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  followerId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  followingId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
}, {
  // Нельзя подписаться на одного человека дважды
  indexes: [{ unique: true, fields: ['followerId', 'followingId'] }],
});

module.exports = Follow;
