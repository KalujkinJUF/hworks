const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: 'dmitriyjari@gmail.com',
        pass: 'lsuw zdzx jpob khat'
    }
});

/**
 * Отправляет код подтверждения на почту
 * @param {string} to - Email получателя
 * @param {string} code - 6-значный код
 */
const sendVerificationCode = async (to, code) => {
    const mailOptions = {
        from: '"Сайт" <dmitriyjari@gmail.com>',
        to,
        subject: 'Подтверждение почты',
        text: `Ваш код подтверждения: ${code}`,
        html: `<h2>Подтверждение регистрации</h2><p>Ваш код подтверждения: <b>${code}</b></p><p>Введите его в профиле, чтобы подтвердить почту.</p>`
    };

    await transporter.sendMail(mailOptions);
};

module.exports = { sendVerificationCode };