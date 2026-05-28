const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM       = process.env.EMAIL_FROM    || 'onboarding@resend.dev';
const CLIENT_URL = process.env.CLIENT_URL    || 'http://localhost:5173';

// Шаблон письма верификации
const verificationTemplate = (name, verifyUrl) => `
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>Подтвердите email — LinguaFlow</title>
</head>
<body style="margin:0; padding:0; background:#0F1629; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0F1629;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520" style="max-width:520px; background:#141D35; border-radius:16px; overflow:hidden; border:1px solid rgba(255,255,255,0.08);">
          <tr>
            <td style="padding:32px 32px 24px; text-align:center;">
              <div style="display:inline-block; width:48px; height:48px; border-radius:12px; background:linear-gradient(135deg,#6366f1,#ec4899); line-height:48px; color:white; font-size:18px; font-weight:700;">L</div>
              <h1 style="color:white; font-size:24px; font-weight:600; margin:16px 0 8px;">Подтвердите ваш email</h1>
              <p style="color:#94a3b8; font-size:14px; line-height:1.6; margin:0;">
                Привет, ${name}!<br/>
                Спасибо за регистрацию в LinguaFlow. Подтвердите email чтобы получить полный доступ.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px; text-align:center;">
              <a href="${verifyUrl}" style="display:inline-block; padding:14px 32px; background:#6366f1; color:white; font-size:15px; font-weight:600; text-decoration:none; border-radius:12px;">
                Подтвердить email
              </a>
              <p style="color:#64748b; font-size:12px; margin:24px 0 0; line-height:1.5;">
                Ссылка действует 24 часа. Если кнопка не работает, скопируйте URL:<br/>
                <span style="color:#6366f1; word-break:break-all;">${verifyUrl}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px; background:rgba(255,255,255,0.02); border-top:1px solid rgba(255,255,255,0.06); text-align:center;">
              <p style="color:#475569; font-size:11px; margin:0;">
                Если вы не регистрировались в LinguaFlow, просто проигнорируйте это письмо.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// Отправка письма подтверждения email
const sendVerificationEmail = async (to, name, token) => {
  const verifyUrl = `${CLIENT_URL}/verify-email?token=${token}`;

  if (!resend) {
    // DEV режим — печатаем ссылку прямо в консоль, чтобы можно было кликнуть
    console.log('\n┌─────────────────────────────────────────────────────────────────');
    console.log('│ 📧 EMAIL DEV MODE — RESEND_API_KEY не задан в .env');
    console.log('│ ');
    console.log(`│ Получатель: ${to}`);
    console.log(`│ Имя:        ${name}`);
    console.log('│ ');
    console.log('│ Ссылка для подтверждения (скопируй в браузер):');
    console.log(`│ ${verifyUrl}`);
    console.log('└─────────────────────────────────────────────────────────────────\n');
    return { id: 'dev-mode', dev: true };
  }

  console.log(`📨 Отправляю письмо на ${to} от ${FROM}...`);

  // Resend v3+ возвращает { data, error } — НЕ бросает на ошибках API
  const result = await resend.emails.send({
    from: FROM,
    to,
    subject: 'Подтвердите email — LinguaFlow',
    html: verificationTemplate(name, verifyUrl),
  });

  if (result.error) {
    console.error('❌ Resend отклонил отправку:');
    console.error('   name:    ', result.error.name);
    console.error('   message: ', result.error.message);
    console.error('   from:    ', FROM);
    console.error('   to:      ', to);
    console.error('');
    console.error('   Возможные причины:');
    console.error('   1. EMAIL_FROM использует домен, который не верифицирован в Resend');
    console.error('   2. С onboarding@resend.dev можно отправлять только на email,');
    console.error('      на который зарегистрирован Resend-аккаунт (test mode)');
    console.error('   3. Неверный RESEND_API_KEY');
    throw new Error(`Resend: ${result.error.message}`);
  }

  console.log(`✅ Письмо отправлено. ID: ${result.data?.id}`);
  return result.data;
};

module.exports = { sendVerificationEmail };
