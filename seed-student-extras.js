/**
 * Добавляет ученику anna_k@linguaflow.demo данные новых фич:
 * словарь (VocabItem), внешние занятия (StudentLessonLog),
 * заметки (StudentNote), уведомления (Notification).
 * Запуск: node seed-student-extras.js
 */
const { User, VocabItem, StudentLessonLog, StudentNote, Notification } = require('./src/models');

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const dateStr = (n) => daysAgo(n).toISOString().slice(0, 10);

async function run() {
  const student = await User.findOne({ where: { email: 'anna_k@linguaflow.demo' } });
  if (!student) { console.error('❌ Ученик anna_k не найден. Сначала запусти seed-demo.js'); process.exit(1); }
  const userId = student.id;

  // Чистим прежние extras этого ученика (идемпотентность)
  await Promise.all([
    VocabItem.destroy({ where: { userId } }),
    StudentLessonLog.destroy({ where: { userId } }),
    StudentNote.destroy({ where: { userId } }),
    Notification.destroy({ where: { userId } }),
  ]);

  // ── Словарь: разные статусы ──
  console.log('📚 Словарь…');
  const vocab = [
    ['dziękuję', 'спасибо', 'Dziękuję bardzo!', 'known', 6, 30],
    ['proszę', 'пожалуйста', 'Proszę bardzo', 'known', 5, 20],
    ['przepraszam', 'извините', 'Przepraszam za spóźnienie', 'learning', 2, 1],
    ['jutro', 'завтра', 'Do jutra!', 'learning', 1, 0],
    ['książka', 'книга', 'Czytam książkę', 'learning', 3, 2],
    ['woda', 'вода', null, 'new', 0, 0],
    ['chleb', 'хлеб', 'Kupuję chleb', 'new', 0, 0],
    ['dom', 'дом', 'Mój dom', 'new', 0, 0],
    ['kot', 'кот', 'Mam kota', 'new', 0, 0],
    ['pies', 'собака', 'Duży pies', 'learning', 1, 0],
  ];
  for (const [word, tr, ex, status, streak, nextInDays] of vocab) {
    await VocabItem.create({
      userId, word, translation: tr, example: ex,
      status, correctStreak: streak,
      nextReviewAt: daysAgo(-nextInDays), // отрицательное = в будущем
    });
  }

  // ── Внешние занятия ──
  console.log('📓 Внешние занятия…');
  const lessons = [
    ['Пан Войтек', 'польский', dateStr(10), '18:00', 60, 'Прошедшее время', 'Разобрали спряжения', 80, true, 'external'],
    ['Пан Войтек', 'польский', dateStr(3),  '18:00', 60, 'Падежи', 'Дательный падеж', 80, false, 'external'],
    ['Пан Войтек', 'польский', dateStr(1),  '18:00', 90, 'Разговорная практика', null, 120, false, 'external'],
    ['Italki — Marta', 'польский', dateStr(7), '20:00', 45, 'Произношение', 'ś, ć, ź', 50, true, 'external'],
    [null, 'польский', dateStr(2), null, 40, 'Самоподготовка: словарь', 'Повторил 30 слов', 0, false, 'self_study'],
    [null, 'польский', dateStr(0), null, 30, 'Аудирование подкаста', 'Podcast "Polski daily" ep.12', 0, false, 'self_study'],
  ];
  for (const [tl, subj, date, time, dur, topic, notes, price, paid, type] of lessons) {
    await StudentLessonLog.create({
      userId, teacherLabel: tl, subject: subj, date, time,
      durationMin: dur, topic, notes, pricePerLesson: price,
      isPaid: paid, paidAt: paid ? daysAgo(1) : null, type,
    });
  }

  // ── Заметки ──
  console.log('📝 Заметки…');
  const notes = [
    ['Польские падежи', '7 падежей. Особое внимание — Narzędnik (творительный) с "z".\nМужской род -em, женский -ą.'],
    ['Сложные звуки', 'ś ć ź dź — мягкие. rz = ж. sz = ш. cz = ч.\nСлушать forvo для примеров.'],
    ['Слова на повторение', 'przepraszam, jutro, książka — путаю окончания.'],
    [null, 'Спросить учителя про разницу między "iść" и "chodzić".'],
  ];
  for (const [title, text] of notes) await StudentNote.create({ userId, title, text });

  // ── Уведомления ──
  console.log('🔔 Уведомления…');
  const notifs = [
    ['homework_graded', 'Ваше ДЗ оценили', 'Оценка: 85', '/homework', null],
    ['homework_assigned', 'Новое домашнее задание', 'Упражнения по теме урока: слова + грамматика', '/homework', null],
    ['attendance_pending', 'Подтвердите посещение', 'Учитель отметил вас на уроке', '/attendance', null],
    ['payment_recorded', 'Оплата зафиксирована', 'Внесено 120 zł', '/payments', daysAgo(2)],
    ['invitation_received', 'Приглашение в группу', '«Разговорный клуб»', '/groups', daysAgo(5)],
  ];
  for (const [type, title, body, link, readAt] of notifs) {
    await Notification.create({ userId, type, title, body, link, readAt });
  }

  console.log(`\n✅ Готово для ${student.name} (${student.email})`);
  console.log('   Словарь: 10 слов | Внешние занятия: 6 | Заметки: 4 | Уведомления: 5 (3 непрочитанных)');
  process.exit(0);
}

run().catch(e => { console.error('ERR', e.message); process.exit(1); });
