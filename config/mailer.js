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

/**
 * Отправляет код подтверждения на почту
 * @param {string} to - Email получателя
 * @param {string} code - 6-значный код
 */
const sendVerificationCode = async (to, code) => {
    const mailOptions = {
        from: mailFrom,
        to,
        subject: 'Подтверждение почты',
        text: `Ваш код подтверждения: ${code}`,
        html: `<h2>Подтверждение регистрации</h2><p>Ваш код подтверждения: <b>${code}</b></p><p>Введите его в профиле, чтобы подтвердить почту.</p>`
    };

    await transporter.sendMail(mailOptions);
};

module.exports = { sendVerificationCode };