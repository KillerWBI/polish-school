/**
 * Сборка календаря в формате iCalendar (RFC 5545) — того самого .ics,
 * на который подписываются Google Calendar, Apple Calendar и Outlook.
 *
 * Формат текстовый и на вид простой, но у него есть три правила, нарушение
 * которых ломает импорт молча — календарь просто не покажет события:
 *   1) переводы строк только CRLF (\r\n), даже на Linux;
 *   2) строка длиннее 75 октетов должна быть «свёрнута» — продолжение с пробела;
 *   3) спецсимволы в тексте экранируются, иначе запятая рвёт поле на два.
 */

// Экранирование текстового значения (RFC 5545 §3.3.11).
// Порядок важен: обратный слэш экранируем ПЕРВЫМ, иначе испортим то,
// что добавим следом.
const esc = (s) => String(s ?? '')
  .replace(/\\/g, '\\\\')
  .replace(/;/g, '\\;')
  .replace(/,/g, '\\,')
  .replace(/\r?\n/g, '\\n');

/**
 * Свёртка длинных строк. Считаем именно ОКТЕТЫ, а не символы: кириллица в UTF-8
 * занимает два байта, и строка из 70 русских букв — это 140 октетов. Разрежь её
 * по символам — получишь строку вдвое длиннее лимита.
 * Продолжение строки начинается с пробела — так парсер понимает, что это склейка.
 */
const fold = (line) => {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;

  const parts = [];
  let start = 0;
  while (start < bytes.length) {
    // Первая строка 75 октетов, продолжения — 74 (один занимает ведущий пробел)
    let end = Math.min(start + (parts.length ? 74 : 75), bytes.length);
    // Не режем посередине многобайтового символа: 10xxxxxx — продолжение UTF-8
    while (end > start && end < bytes.length && (bytes[end] & 0b11000000) === 0b10000000) end--;
    parts.push(bytes.slice(start, end).toString('utf8'));
    start = end;
  }
  return parts.join('\r\n ');
};

// Метка времени в UTC для DTSTAMP: 20260815T160000Z
const utcStamp = (d = new Date()) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/**
 * Время события «плавающее» (RFC 5545 form 1: DATE WITH LOCAL TIME) —
 * без Z и без TZID: 20260815T160000.
 *
 * Это не упрощение, а единственный честный вариант для наших данных: у урока
 * хранятся дата и 'HH:MM' без часового пояса. Поставить Z значило бы выдумать
 * пояс, которого мы не знаем, и урок уехал бы на пару часов у половины
 * пользователей. Плавающее время календарь покажет как местное — ровно тот
 * смысл, который вкладывает преподаватель, когда пишет «в 16:00».
 */
const floatingStart = (date, time) => `${date.replace(/-/g, '')}T${(time || '00:00').replace(':', '')}00`;

// Событие на весь день (у своих занятий ученика время не обязательно).
// DTEND у all-day — СЛЕДУЮЩИЙ день: конец в этом формате не включается.
const allDay = (date) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return { start: date.replace(/-/g, ''), end: d.toISOString().slice(0, 10).replace(/-/g, '') };
};

/**
 * Одно событие.
 * uid обязан быть стабильным между выгрузками: календарь по нему понимает, что
 * это то же самое событие, и обновляет его вместо создания дубля. Поэтому берём
 * id урока из базы, а не случайное значение.
 */
const event = ({ uid, date, time, durationMin, title, description, location, url }) => {
  const lines = ['BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${utcStamp()}`];

  if (time) {
    const start = floatingStart(date, time);
    lines.push(`DTSTART:${start}`);
    // Длительность вместо конца: DURATION не зависит от перехода на летнее время
    lines.push(`DURATION:PT${Math.max(15, durationMin || 60)}M`);
  } else {
    const { start, end } = allDay(date);
    lines.push(`DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${end}`);
  }

  lines.push(`SUMMARY:${esc(title)}`);
  if (description) lines.push(`DESCRIPTION:${esc(description)}`);
  if (location)    lines.push(`LOCATION:${esc(location)}`);
  if (url)         lines.push(`URL:${esc(url)}`);
  lines.push('END:VEVENT');
  return lines;
};

/**
 * Готовый календарь.
 * X-WR-CALNAME задаёт имя календаря в интерфейсе подписчика — без него Google
 * покажет сырой URL. REFRESH-INTERVAL и X-PUBLISHED-TTL — просьба перечитывать
 * раз в час; клиент вправе её проигнорировать, но обычно уважает.
 */
const buildCalendar = ({ name, events }) => {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Diklario//Lessons//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(name)}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    ...events.flatMap(event),
    'END:VCALENDAR',
  ];
  // CRLF обязателен по стандарту — с обычным \n часть клиентов молча не импортирует
  return lines.map(fold).join('\r\n') + '\r\n';
};

module.exports = { buildCalendar };
