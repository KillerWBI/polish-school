// Разрешаем хранить только ссылки на НАШ Cloudinary — чтобы в базу не попадали
// произвольные внешние URL (фишинг при клике / мусор). Пустое значение допустимо
// (поля необязательные). Если cloud name не задан — принимаем любой res.cloudinary.com.
const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;

const isAllowedUploadUrl = (url) => {
  if (url === undefined || url === null || url === '') return true;
  if (typeof url !== 'string') return false;
  const prefix = CLOUD
    ? `https://res.cloudinary.com/${CLOUD}/`
    : 'https://res.cloudinary.com/';
  return url.startsWith(prefix);
};

module.exports = { isAllowedUploadUrl };
