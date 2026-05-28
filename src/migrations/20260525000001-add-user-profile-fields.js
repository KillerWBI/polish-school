'use strict';

const { DataTypes, Op } = require('sequelize');
const crypto = require('crypto');

// Минимальная таблица транслитерации кириллицы для backfill username
const CYR_MAP = {
  а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'i',
  к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
  х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',
};

const slugify = (name) => {
  const lower = (name || '').toLowerCase();
  let out = '';
  for (const ch of lower) {
    if (CYR_MAP[ch] !== undefined)        out += CYR_MAP[ch];
    else if (/[a-z0-9]/.test(ch))         out += ch;
    else if (ch === ' ' || ch === '-')    out += '_';
  }
  out = out.replace(/_+/g, '_').replace(/^_|_$/g, '');
  return out.slice(0, 30) || 'user';
};

const randomSuffix = () => crypto.randomBytes(2).toString('hex'); // 4 hex символа

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // 1. Добавляем все новые поля. username сначала nullable — заполним backfill-ом
    await queryInterface.addColumn('Users', 'username',        { type: DataTypes.STRING(40),  allowNull: true });
    await queryInterface.addColumn('Users', 'avatar',          { type: DataTypes.STRING,      allowNull: true });
    await queryInterface.addColumn('Users', 'coverImage',      { type: DataTypes.STRING,      allowNull: true });
    await queryInterface.addColumn('Users', 'bio',             { type: DataTypes.TEXT,        allowNull: true });
    await queryInterface.addColumn('Users', 'socialTelegram',  { type: DataTypes.STRING(64),  allowNull: true });
    await queryInterface.addColumn('Users', 'socialWhatsApp',  { type: DataTypes.STRING(32),  allowNull: true });
    await queryInterface.addColumn('Users', 'socialLinkedIn',  { type: DataTypes.STRING(128), allowNull: true });
    await queryInterface.addColumn('Users', 'languages',       { type: DataTypes.JSONB,       allowNull: false, defaultValue: [] });

    // 2. Backfill: генерим username для всех существующих пользователей
    const [users] = await queryInterface.sequelize.query(
      'SELECT id, name FROM "Users" WHERE username IS NULL'
    );

    const taken = new Set();
    for (const u of users) {
      const base = slugify(u.name);
      let candidate;
      // Пробуем base, потом base_xxxx до коллизии
      for (let i = 0; i < 10; i++) {
        candidate = i === 0 ? base : `${base}_${randomSuffix()}`;
        if (taken.has(candidate)) continue;
        const [exists] = await queryInterface.sequelize.query(
          'SELECT 1 FROM "Users" WHERE username = :u LIMIT 1',
          { replacements: { u: candidate } }
        );
        if (exists.length === 0) break;
      }
      taken.add(candidate);
      await queryInterface.sequelize.query(
        'UPDATE "Users" SET username = :u WHERE id = :id',
        { replacements: { u: candidate, id: u.id } }
      );
    }

    // 3. Закрываем NOT NULL и добавляем уникальный индекс
    await queryInterface.changeColumn('Users', 'username', {
      type: DataTypes.STRING(40),
      allowNull: false,
    });
    await queryInterface.addIndex('Users', ['username'], {
      unique: true,
      name: 'users_username_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Users', 'users_username_unique');
    await queryInterface.removeColumn('Users', 'languages');
    await queryInterface.removeColumn('Users', 'socialLinkedIn');
    await queryInterface.removeColumn('Users', 'socialWhatsApp');
    await queryInterface.removeColumn('Users', 'socialTelegram');
    await queryInterface.removeColumn('Users', 'bio');
    await queryInterface.removeColumn('Users', 'coverImage');
    await queryInterface.removeColumn('Users', 'avatar');
    await queryInterface.removeColumn('Users', 'username');
  },
};
