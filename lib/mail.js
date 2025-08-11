import nodemailer from 'nodemailer';
const transporter = nodemailer.createTransport({
8
host: process.env.SMTP_HOST,
port: Number(process.env.SMTP_PORT || 587),
secure: false,
auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});
export async function sendMail({ to, subject, html }) {
if (!to) return;
await transporter.sendMail({ from: process.env.SUPPORT_EMAIL, to, subject,
html });
}
