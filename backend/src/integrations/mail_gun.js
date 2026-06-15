const TAG = 'mail_gun';
const logger = require('../util/logger');
const formData = require('form-data');
const Mailgun = require('mailgun.js');
const mailgun = new Mailgun(formData);

const getDefaultClient = () => {
    return mailgun.client({
        username: 'api',
        key: process.env.MAILGUN_API_KEY
    });
};

exports.mail_gun_send_email = async ({
    to,
    subject,
    text,
    html,
    attachment
}) => {
    const client = getDefaultClient();

    if (process.env.NODE_ENV === 'development') {
        to = process.env.TEST_EMAIL;
    }

    const bcc = [
        process.env.TEST_ADMIN_EMAIL,
        process.env.BCC_EMAIL,
    ].filter(Boolean);

    const messageData = {
        from: process.env.MAILGUN_FROM_EMAIL,
        to,
        bcc,
        subject,
        text,
        html,
    };

    if (attachment) {
        messageData.attachment = attachment;
    }

    try {
        const msg = await client.messages.create(process.env.MAILGUN_DOMAIN, messageData);
        logger.tagged(TAG).info('Email sent successfully', { to, messageId: msg.id });
        return msg;
    } catch (err) {
        logger.tagged(TAG).error('Email send failed', { to, error: err.message });
        throw err;
    }
};