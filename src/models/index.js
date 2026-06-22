const User = require('./User');
const Group = require('./Group');
const GroupStudent = require('./GroupStudent');
const Lesson = require('./Lesson');
const IndividualCourse = require('./IndividualCourse');
const IndividualLesson = require('./IndividualLesson');
const Homework = require('./Homework');
const HomeworkSubmission = require('./HomeworkSubmission');
const Attendance = require('./Attendance');
const Follow = require('./Follow');
const LessonRequest = require('./LessonRequest');
const TeacherStudent = require('./TeacherStudent');
const PaymentRecord = require('./PaymentRecord');

// Group ↔ User (teacher)
Group.belongsTo(User, { foreignKey: 'teacherId', as: 'teacher' });
User.hasMany(Group, { foreignKey: 'teacherId', as: 'teacherGroups' });

// Group ↔ User (students) через GroupStudent
Group.belongsToMany(User, { through: GroupStudent, foreignKey: 'groupId', as: 'students', onDelete: 'CASCADE' });
User.belongsToMany(Group, { through: GroupStudent, foreignKey: 'studentId', as: 'groups' });

// Lesson ↔ Group
Lesson.belongsTo(Group, { foreignKey: 'groupId', onDelete: 'CASCADE' });
Group.hasMany(Lesson, { foreignKey: 'groupId', onDelete: 'CASCADE' });

// IndividualLesson ↔ User
IndividualLesson.belongsTo(User, { foreignKey: 'teacherId', as: 'teacher' });
IndividualLesson.belongsTo(User, { foreignKey: 'studentId', as: 'student' });

// IndividualCourse ↔ User (teacher + student)
IndividualCourse.belongsTo(User, { foreignKey: 'teacherId', as: 'teacher' });
IndividualCourse.belongsTo(User, { foreignKey: 'studentId', as: 'student' });

// IndividualCourse ↔ IndividualLesson (1 → many, nullable)
IndividualCourse.hasMany(IndividualLesson, { foreignKey: 'individualCourseId' });
IndividualLesson.belongsTo(IndividualCourse, { foreignKey: 'individualCourseId' });

// Homework ↔ Lesson / IndividualLesson
Homework.belongsTo(Lesson, { foreignKey: 'lessonId' });
Homework.belongsTo(IndividualLesson, { foreignKey: 'individualLessonId' });
Lesson.hasMany(Homework, { foreignKey: 'lessonId' });
IndividualLesson.hasMany(Homework, { foreignKey: 'individualLessonId' });

// HomeworkSubmission ↔ Homework, User
HomeworkSubmission.belongsTo(Homework, { foreignKey: 'homeworkId' });
HomeworkSubmission.belongsTo(User, { foreignKey: 'studentId', as: 'student' });
Homework.hasMany(HomeworkSubmission, { foreignKey: 'homeworkId' });

// Attendance ↔ Lesson / IndividualLesson, User
Attendance.belongsTo(Lesson, { foreignKey: 'lessonId' });
Attendance.belongsTo(IndividualLesson, { foreignKey: 'individualLessonId' });
Attendance.belongsTo(User, { foreignKey: 'studentId', as: 'student' });

// Follow ↔ User (подписка: follower → following)
Follow.belongsTo(User, { foreignKey: 'followerId',  as: 'follower' });
Follow.belongsTo(User, { foreignKey: 'followingId', as: 'following' });

// LessonRequest ↔ User (студент-заявитель + учитель-получатель)
LessonRequest.belongsTo(User, { foreignKey: 'studentId', as: 'student' });
LessonRequest.belongsTo(User, { foreignKey: 'teacherId', as: 'teacher' });

// TeacherStudent ↔ User (отношение «мой ученик»)
TeacherStudent.belongsTo(User, { foreignKey: 'studentId', as: 'student' });
TeacherStudent.belongsTo(User, { foreignKey: 'teacherId', as: 'teacher' });

// PaymentRecord ↔ User (платёж: от ученика — учителю)
PaymentRecord.belongsTo(User, { foreignKey: 'studentId', as: 'student' });
PaymentRecord.belongsTo(User, { foreignKey: 'teacherId', as: 'teacher' });

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
  Follow,
  LessonRequest,
  TeacherStudent,
  PaymentRecord,
};
