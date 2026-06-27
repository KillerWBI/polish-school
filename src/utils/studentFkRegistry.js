// Единый реестр FK на Student (C2 фаза 0). Источник правды для merge (§2.1.3) и
// полного удаления заглушки: любой код, перепривязывающий/чистящий ученика, ОБЯЗАН
// пройти ровно по этому списку — забыл таблицу = сироты или потеря истории.
//
// Должен совпадать с FK-констрейнтами из миграции 20260625000001-switch-student-fk
// (все 6 → Students.id ON DELETE CASCADE).
//
// uniqueWith — наборы «прочих» колонок, образующих уникальность вместе со studentId.
// Используется merge'ом для разрешения конфликтов: если у target уже есть строка с теми
// же значениями этих колонок, строку source НЕ перепривязываем, а удаляем (keep-target).
module.exports = [
  { table: 'GroupStudents',       column: 'studentId', uniqueWith: [['groupId']] },
  { table: 'IndividualCourses',   column: 'studentId', uniqueWith: [] },
  { table: 'IndividualLessons',   column: 'studentId', uniqueWith: [] },
  { table: 'Attendances',         column: 'studentId', uniqueWith: [['lessonId'], ['individualLessonId']] },
  { table: 'PaymentRecords',      column: 'studentId', uniqueWith: [] },
  { table: 'HomeworkSubmissions', column: 'studentId', uniqueWith: [['homeworkId']] },
];
