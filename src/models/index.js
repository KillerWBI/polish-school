const User = require('./User');
const Group = require('./Group');
const GroupStudent = require('./GroupStudent');
const Lesson = require('./Lesson');
const IndividualLesson = require('./IndividualLesson');
const Homework = require('./Homework');
const HomeworkSubmission = require('./HomeworkSubmission');
const Attendance = require('./Attendance');
const Payment = require('./Payment');

// Group ↔ User (teacher)
Group.belongsTo(User, { foreignKey: 'teacherId', as: 'teacher' });
User.hasMany(Group, { foreignKey: 'teacherId', as: 'teacherGroups' });

// Group ↔ User (students) через GroupStudent
Group.belongsToMany(User, { through: GroupStudent, foreignKey: 'groupId', as: 'students' });
User.belongsToMany(Group, { through: GroupStudent, foreignKey: 'studentId', as: 'groups' });

// Lesson ↔ Group
Lesson.belongsTo(Group, { foreignKey: 'groupId' });
Group.hasMany(Lesson, { foreignKey: 'groupId' });

// IndividualLesson ↔ User
IndividualLesson.belongsTo(User, { foreignKey: 'teacherId', as: 'teacher' });
IndividualLesson.belongsTo(User, { foreignKey: 'studentId', as: 'student' });

// Homework ↔ Lesson / IndividualLesson
Homework.belongsTo(Lesson, { foreignKey: 'lessonId' });
Homework.belongsTo(IndividualLesson, { foreignKey: 'individualLessonId' });

// HomeworkSubmission ↔ Homework, User
HomeworkSubmission.belongsTo(Homework, { foreignKey: 'homeworkId' });
HomeworkSubmission.belongsTo(User, { foreignKey: 'studentId', as: 'student' });
Homework.hasMany(HomeworkSubmission, { foreignKey: 'homeworkId' });

// Attendance ↔ Lesson / IndividualLesson, User
Attendance.belongsTo(Lesson, { foreignKey: 'lessonId' });
Attendance.belongsTo(IndividualLesson, { foreignKey: 'individualLessonId' });
Attendance.belongsTo(User, { foreignKey: 'studentId', as: 'student' });

// Payment ↔ User
Payment.belongsTo(User, { foreignKey: 'studentId', as: 'student' });
User.hasMany(Payment, { foreignKey: 'studentId' });

module.exports = {
  User,
  Group,
  GroupStudent,
  Lesson,
  IndividualLesson,
  Homework,
  HomeworkSubmission,
  Attendance,
  Payment,
};
