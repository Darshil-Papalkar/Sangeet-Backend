require('dotenv').config();
const webpush = require('web-push');

const publicVapidKey = process.env.WEB_PUSH_PUBLIC_KEY;
const privateVapidKey = process.env.WEB_PUSH_PRIVATE_KEY;
const mailId = process.env.WEB_PUSH_MAIL_ID;


const webPush = () => {
    webpush.setVapidDetails(
        `mailto:${mailId}`,
        publicVapidKey,
        privateVapidKey,
    );
};

exports.webPush = webPush;
