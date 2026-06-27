const { z } = require('zod');

// POST /posts — создание поста. text обязателен; media — массив URL картинок (фаза 2).
const createPost = z.object({
  text:  z.string().trim().min(1, 'Текст поста не может быть пустым').max(5000, 'Слишком длинный пост'),
  media: z.array(z.url('Неверный URL медиа')).max(10, 'Не более 10 изображений').optional(),
});

module.exports = { createPost };
