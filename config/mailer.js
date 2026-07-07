const nodemailer = require('nodemailer');

const mailHost = process.env.MAIL_HOST || 'smtp.gmail.com';
const mailPort = parseInt(process.env.MAIL_PORT || '465', 10);
const mailSecure = process.env.MAIL_SECURE !== 'false'; // default is true
const mailUser = process.env.MAIL_USER;
const mailPass = process.env.MAIL_PASS;
const mailFrom = process.env.MAIL_FROM;

const transporter = nodemailer.createTransport({
    host: mailHost,
    port: mailPort,
    secure: mailSecure,
    auth: {
        user: mailUser,
        pass: mailPass
    }
});

// Тексты письма по назначению кода
const templates = {
    verify: {
        subject: 'Подтверждение почты',
        title: 'Подтверждение регистрации',
        note: 'Введите его в профиле, чтобы подтвердить почту.'
    },
    delete: {
        subject: 'Удаление аккаунта',
        title: 'Запрос на удаление аккаунта',
        note: 'Введите этот код, чтобы подтвердить удаление аккаунта. Если это были не вы — просто проигнорируйте письмо.'
    },
    reset: {
        subject: 'Сброс пароля',
        title: 'Запрос на сброс пароля',
        note: 'Введите этот код, чтобы подтвердить сброс пароля. Если это были не вы — просто проигнорируйте письмо.'
    }
};

/**
 * Отправляет код подтверждения на почту
 * @param {string} to - Email получателя (расшифрованный!)
 * @param {string} code - 6-значный код
 * @param {'verify'|'delete'|'reset'} [purpose='verify'] - назначение кода (определяет текст письма)
 */
const sendVerificationCode = async (to, code, purpose = 'verify') => {
    const t = templates[purpose] || templates.verify;
    const mailOptions = {
        from: mailFrom,
        to,
        subject: t.subject,
        text: `${t.title}. Ваш код подтверждения: ${code}`,
        html: `<h2>${t.title}</h2><p>Ваш код подтверждения: <b>${code}</b></p><p>${t.note}</p>`
    };

    await transporter.sendMail(mailOptions);
};

module.exports = { sendVerificationCode };
