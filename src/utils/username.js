const crypto = require('crypto');
const { User } = require('../models');

// Транслит кириллицы для slug-генерации
const CYR_MAP = {
  а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'i',
  к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
  х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',
};

// Превращает «Иван Петров» → «ivan_petrov»
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

/**
 * Генерирует уникальный username из имени. До 10 попыток с суффиксом.
 * @param {string} name
 * @returns {Promise<string>}
 */
const generateUsername = async (name) => {
  const base = slugify(name);
  for (let i = 0; i < 10; i++) {
    const candidate = i === 0 ? base : `${base}_${randomSuffix()}`;
    const exists = await User.findOne({ where: { username: candidate }, attributes: ['id'] });
    if (!exists) return candidate;
  }
  // Крайне маловероятно — fallback с длинным случайным суффиксом
  return `${base}_${crypto.randomBytes(4).toString('hex')}`;
};

module.exports = { generateUsername, slugify };
