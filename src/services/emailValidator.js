const dns = require('dns').promises;

// Известные disposable / temp email домены
const DISPOSABLE_DOMAINS = new Set([
  '10minutemail.com', '10minutemail.net', '20minutemail.com',
  'mailinator.com', 'mailinator.net', 'mailinator2.com',
  'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamail.info',
  'tempmail.com', 'tempmail.net', 'temp-mail.org', 'temp-mail.io',
  'throwaway.email', 'throwawaymail.com',
  'yopmail.com', 'yopmail.net', 'yopmail.fr',
  'maildrop.cc', 'mailnesia.com', 'mintemail.com',
  'getairmail.com', 'emailondeck.com', 'sharklasers.com',
  'trashmail.com', 'trashmail.net', 'trash-mail.com',
  'dispostable.com', 'tempinbox.com', 'mailcatch.com',
  'mohmal.com', 'spamdecoy.net', 'mvrht.com', 'spam4.me',
  'nada.email', 'tafmail.com', 'e4ward.com', 'safetymail.info',
  'fakeinbox.com', 'fake-mail.net', 'mt2014.com', 'mt2015.com',
  'inboxbear.com', 'mailpoof.com', 'disposablemail.com',
  'wegwerfemail.de', 'jetable.org', 'getnada.com', 'inboxkitten.com',
  'mailcatcher.com', 'mailtothis.com', 'mailtrash.net',
  'spambog.com', 'spamfree24.org', 'tempr.email',
]);

// Простая regex-проверка формата (RFC 5321 совместимая, без edge-кейсов)
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Проверка наличия MX-записей у домена (домен принимает почту)
const hasMxRecords = async (domain) => {
  try {
    const records = await dns.resolveMx(domain);
    return records && records.length > 0;
  } catch {
    // ENOTFOUND, ENODATA и т.п. — домен не существует или не настроен на email
    return false;
  }
};

/**
 * Проверяет email на «настоящесть»:
 *  - корректный формат
 *  - не disposable (mailinator и т.п.)
 *  - домен принимает почту (есть MX-записи)
 *
 * @returns {{ valid: boolean, reason?: string }}
 */
const validateEmail = async (email) => {
  if (!email || typeof email !== 'string') {
    return { valid: false, reason: 'Email обязателен' };
  }

  const normalized = email.toLowerCase().trim();

  if (!EMAIL_REGEX.test(normalized)) {
    return { valid: false, reason: 'Неверный формат email' };
  }

  const domain = normalized.split('@')[1];

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { valid: false, reason: 'Временные email-адреса не разрешены' };
  }

  const mxOk = await hasMxRecords(domain);
  if (!mxOk) {
    return { valid: false, reason: 'Домен не принимает почту. Проверьте email.' };
  }

  return { valid: true };
};

module.exports = { validateEmail };
