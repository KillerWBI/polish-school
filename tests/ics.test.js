const { buildCalendar } = require('../src/utils/ics');

// Генератор .ics — чистая функция, БД не нужна.
// Тесты держат три правила RFC 5545, нарушение которых ломает импорт молча.

const one = (event, name = 'Test') => buildCalendar({ name, events: [event] });

describe('buildCalendar', () => {
  it('переводы строк — CRLF: с обычным \\n часть клиентов не импортирует', () => {
    const ics = one({ uid: 'a@d', date: '2026-08-15', time: '16:00', title: 'Урок' });
    expect(ics.includes('\r\n')).toBe(true);
    expect(/[^\r]\n/.test(ics)).toBe(false); // ни одного \n без \r перед ним
  });

  it('время плавающее — без Z и без TZID', () => {
    const ics = one({ uid: 'a@d', date: '2026-08-15', time: '16:00', title: 'Урок' });
    expect(ics).toContain('DTSTART:20260815T160000');
    expect(ics).not.toContain('DTSTART:20260815T160000Z'); // Z означал бы UTC — пояса мы не знаем
    expect(ics).not.toContain('TZID');
  });

  it('без времени — событие на весь день, конец следующим днём', () => {
    const ics = one({ uid: 'a@d', date: '2026-08-15', title: 'Занятие' });
    expect(ics).toContain('DTSTART;VALUE=DATE:20260815');
    expect(ics).toContain('DTEND;VALUE=DATE:20260816'); // конец не включается
  });

  it('экранирует запятую, точку с запятой, слэш и перенос строки', () => {
    const ics = one({
      uid: 'a@d', date: '2026-08-15', time: '10:00',
      title: 'Урок, второй; часть',
      description: 'ул. Хмельная 12\nкод 1234\\вход',
    });
    expect(ics).toContain('SUMMARY:Урок\\, второй\\; часть');
    expect(ics).toContain('код 1234\\\\вход');
    expect(ics).toContain('\\n'); // перенос стал escape-последовательностью, а не реальным переносом
  });

  it('длинную строку сворачивает, продолжение — с пробела', () => {
    const long = 'Очень длинное название урока, '.repeat(6);
    const ics = one({ uid: 'a@d', date: '2026-08-15', time: '10:00', title: long });
    const lines = ics.split('\r\n');
    // Ни одна строка не длиннее 75 октетов — кириллица весит по 2 байта на символ
    for (const line of lines) expect(Buffer.from(line, 'utf8').length).toBeLessThanOrEqual(75);
    expect(lines.some(l => l.startsWith(' '))).toBe(true); // есть склейка
  });

  it('свёртка не рвёт многобайтовый символ пополам', () => {
    const ics = one({ uid: 'a@d', date: '2026-08-15', time: '10:00', title: 'я'.repeat(120) });
    // Развернём обратно и убедимся, что символы целы: битый UTF-8 дал бы «замену» U+FFFD
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded).toContain('я'.repeat(120));
    expect(unfolded).not.toContain('�');
  });

  it('uid стабильный — календарь обновит событие, а не создаст дубль', () => {
    const a = one({ uid: 'lesson-42@diklario', date: '2026-08-15', time: '10:00', title: 'Урок' });
    const b = one({ uid: 'lesson-42@diklario', date: '2026-08-15', time: '11:00', title: 'Урок' });
    expect(a).toContain('UID:lesson-42@diklario');
    expect(b).toContain('UID:lesson-42@diklario');
  });

  it('каркас календаря на месте', () => {
    const ics = buildCalendar({ name: 'Diklario — Анна', events: [] });
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('X-WR-CALNAME:Diklario — Анна'); // имя календаря у подписчика
    expect(ics).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT1H');
  });
});
