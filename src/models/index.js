const User = require('./User');
const Group = require('./Group');
const GroupStudent = require('./GroupStudent');
const Lesson = require('./Lesson');
const IndividualCourse = require('./IndividualCourse');
const IndividualLesson = require('./IndividualLesson');
const Homework = require('./Homework');
const HomeworkSubmission = require('./HomeworkSubmission');
const Attendance = require('./Attendance');
const TeacherStudent = require('./TeacherStudent');
const PaymentRecord = require('./PaymentRecord');
const Student = require('./Student');
const Invitation = require('./Invitation');
const Quiz = require('./Quiz');
const SupportTicket = require('./SupportTicket');
const VocabItem = require('./VocabItem');
const StudentLessonLog = require('./StudentLessonLog');
const StudentNote = require('./StudentNote');
const Notification = require('./Notification');
const Topic = require('./Topic');

// Group ↔ User (teacher)
Group.belongsTo(User, { foreignKey: 'teacherId', as: 'teacher' });
User.hasMany(Group, { foreignKey: 'teacherId', as: 'teacherGroups' });

// Group ↔ Student через GroupStudent (studentId = Student.id после C1)
Group.belongsToMany(Student, { through: GroupStudent, foreignKey: 'groupId', as: 'students', onDelete: 'CASCADE' });
Student.belongsToMany(Group, { through: GroupStudent, foreignKey: 'studentId', as: 'groups' });

// Lesson ↔ Group
Lesson.belongsTo(Group, { foreignKey: 'groupId', onDelete: 'CASCADE' });
Group.hasMany(Lesson, { foreignKey: 'groupId', onDelete: 'CASCADE' });

// IndividualLesson ↔ User (teacher) / Student (student)
IndividualLesson.belongsTo(User, { foreignKey: 'teacherId', as: 'teacher' });
IndividualLesson.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });

// IndividualCourse ↔ User (teacher) / Student (student)
IndividualCourse.belongsTo(User, { foreignKey: 'teacherId', as: 'teacher' });
IndividualCourse.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });

// IndividualCourse ↔ IndividualLesson (1 → many, nullable)
IndividualCourse.hasMany(IndividualLesson, { foreignKey: 'individualCourseId' });
IndividualLesson.belongsTo(IndividualCourse, { foreignKey: 'individualCourseId' });

// Homework ↔ Lesson / IndividualLesson
Homework.belongsTo(Lesson, { foreignKey: 'lessonId' });
Homework.belongsTo(IndividualLesson, { foreignKey: 'individualLessonId' });
Lesson.hasMany(Homework, { foreignKey: 'lessonId' });
IndividualLesson.hasMany(Homework, { foreignKey: 'individualLessonId' });

// HomeworkSubmission ↔ Homework, Student
HomeworkSubmission.belongsTo(Homework, { foreignKey: 'homeworkId' });
HomeworkSubmission.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });
Homework.hasMany(HomeworkSubmission, { foreignKey: 'homeworkId' });

// Attendance ↔ Lesson / IndividualLesson, Student
Attendance.belongsTo(Lesson, { foreignKey: 'lessonId' });
Attendance.belongsTo(IndividualLesson, { foreignKey: 'individualLessonId' });
Attendance.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });

// TeacherStudent ↔ User (отношение «мой ученик»)
TeacherStudent.belongsTo(User, { foreignKey: 'studentId', as: 'student' });
TeacherStudent.belongsTo(User, { foreignKey: 'teacherId', as: 'teacher' });

// PaymentRecord ↔ Student (плательщик) / User (учитель-получатель)
PaymentRecord.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });
PaymentRecord.belongsTo(User, { foreignKey: 'teacherId', as: 'teacher' });

// Student ↔ User (owner = учитель-владелец; account = привязанный аккаунт, nullable).
// studentId в 6 таблицах ссылается на Student.id (C1 фаза 4). Login-данные ученика — через account.
Student.belongsTo(User, { foreignKey: 'teacherId', as: 'owner' });
Student.belongsTo(User, { foreignKey: 'userId', as: 'account' });
User.hasMany(Student, { foreignKey: 'teacherId', as: 'roster' });

// Invitation ↔ User (teacher-отправитель, invitee-получатель) / Group (С3, направление учитель→ученик)
Invitation.belongsTo(User, { foreignKey: 'teacherId', as: 'teacher' });
Invitation.belongsTo(User, { foreignKey: 'inviteeUserId', as: 'invitee' });
Invitation.belongsTo(Group, { foreignKey: 'groupId' });

// Quiz ↔ User (владелец: учитель или ученик — кто создал/прошёл)
Quiz.belongsTo(User, { foreignKey: 'teacherId', as: 'teacher' });
Quiz.belongsTo(User, { foreignKey: 'teacherId', as: 'owner' }); // алиас для читаемости (владелец = проходивший)
User.hasMany(Quiz, { foreignKey: 'teacherId', as: 'quizzes' });

// Homework ↔ Quiz (прикреплённый тест)
Homework.belongsTo(Quiz, { foreignKey: 'quizId', as: 'quiz' });

// SupportTicket ↔ User (автор, nullable — форма публичная)
SupportTicket.belongsTo(User, { foreignKey: 'userId', as: 'author' });

// VocabItem ↔ User (владелец — ученик)
VocabItem.belongsTo(User, { foreignKey: 'userId', as: 'owner' });

// StudentLessonLog ↔ User (владелец — ученик, ведёт личный журнал внешних занятий)
StudentLessonLog.belongsTo(User, { foreignKey: 'userId', as: 'owner' });

// StudentNote ↔ User / Lesson / IndividualLesson (личные заметки ученика)
StudentNote.belongsTo(User, { foreignKey: 'userId', as: 'owner' });
StudentNote.belongsTo(Lesson, { foreignKey: 'lessonId' });
StudentNote.belongsTo(IndividualLesson, { foreignKey: 'individualLessonId' });

// Notification ↔ User (получатель)
Notification.belongsTo(User, { foreignKey: 'userId', as: 'recipient' });

// Topic ↔ User (владелец-ученик) / Quiz (попытки-практики по теме)
Topic.belongsTo(User, { foreignKey: 'userId', as: 'owner' });
Topic.hasMany(Quiz, { foreignKey: 'topicId', as: 'attemptsList' });
Quiz.belongsTo(Topic, { foreignKey: 'topicId', as: 'topicRef' });

module.exports = {
  User,
  Group,
  GroupStudent,
  Lesson,
  IndividualCourse,
  IndividualLesson,
  Homework,
  HomeworkSubmission,
  Attendance,
  TeacherStudent,
  PaymentRecord,
  Student,
  Invitation,
  Quiz,
  SupportTicket,
  VocabItem,
  StudentLessonLog,
  StudentNote,
  Notification,
  Topic,
};
