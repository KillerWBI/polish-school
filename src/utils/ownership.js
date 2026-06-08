const { Lesson, Group, IndividualLesson } = require('../models');


const isHwOwner = async (hw, teacherId) => {

  if (hw.lessonId) {
    const lesson = await Lesson.findByPk(hw.lessonId, {
      include: [{ model: Group, attributes: ['teacherId'] }],
    });
    return !!(lesson && lesson.Group && lesson.Group.teacherId === teacherId);

  }
  if (hw.individualLessonId) {
    const il = await IndividualLesson.findByPk(hw.individualLessonId, { attributes: ['teacherId'] });
    return !!(il && il.teacherId === teacherId);
  }
  return false;
};



module.exports = { isHwOwner };
