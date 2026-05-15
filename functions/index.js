const { initializeApp } = require('firebase-admin/app');
const { Timestamp } = require('firebase-admin/firestore');
const { defineSecret, defineString } = require('firebase-functions/params');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const logger = require('firebase-functions/logger');
const nodemailer = require('nodemailer');

initializeApp();

const notificationEmail = defineString('ACCOUNT_NOTIFICATION_EMAIL', {
  default: 'truebitforgenorth@gmail.com'
});
const smtpHost = defineString('SMTP_HOST');
const smtpPort = defineString('SMTP_PORT', {
  default: '587'
});
const smtpSecure = defineString('SMTP_SECURE', {
  default: 'false'
});
const smtpUser = defineString('SMTP_USER');
const smtpFrom = defineString('SMTP_FROM');
const smtpPass = defineSecret('SMTP_PASS');

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toIsoDate(value) {
  if (!value) return 'Not available';
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Not available' : parsed.toISOString();
}

function buildTransport() {
  const port = Number(smtpPort.value() || 587);
  const secure = String(smtpSecure.value() || 'false').toLowerCase() === 'true' || port === 465;
  const host = String(smtpHost.value() || '').trim();
  const user = String(smtpUser.value() || '').trim();
  const from = String(smtpFrom.value() || '').trim();

  if (!host || !user || !from) {
    throw new Error('Missing SMTP_HOST, SMTP_USER, or SMTP_FROM function parameters.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass: smtpPass.value()
    }
  });
}

exports.emailOnNewClientAccount = onDocumentCreated(
  {
    document: 'clients/{uid}',
    region: 'us-central1',
    secrets: [smtpPass]
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      logger.warn('Client account trigger fired without a document snapshot.');
      return;
    }

    const client = snapshot.data() || {};
    const uid = event.params.uid;
    const email = String(client.email || '').trim();
    const displayName = String(client.displayName || '').trim();
    const companyName = String(client.companyName || '').trim();
    const createdAt = toIsoDate(client.createdAt);
    const recipient = String(notificationEmail.value() || '').trim();

    if (!recipient) {
      logger.warn('ACCOUNT_NOTIFICATION_EMAIL is blank. Skipping new-account email.', { uid, email });
      return;
    }

    const transporter = buildTransport();
    const subjectLabel = companyName || displayName || email || uid;
    const details = [
      ['UID', uid],
      ['Email', email || 'Not provided'],
      ['Display name', displayName || 'Not provided'],
      ['Company', companyName || 'Not provided'],
      ['Created at', createdAt]
    ];

    await transporter.sendMail({
      from: smtpFrom.value(),
      to: recipient,
      replyTo: email || undefined,
      subject: `New client account created: ${subjectLabel}`,
      text: [
        'A new client portal account was created for TrueBit Forge North.',
        '',
        ...details.map(([label, value]) => `${label}: ${value}`)
      ].join('\n'),
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
          <h2 style="margin: 0 0 12px;">New client portal account created</h2>
          <p style="margin: 0 0 16px;">
            A new client signed up through the TrueBit Forge North portal.
          </p>
          <table style="border-collapse: collapse;">
            ${details
              .map(([label, value]) => {
                return `
                  <tr>
                    <td style="padding: 6px 12px 6px 0; font-weight: 700;">${escapeHtml(label)}</td>
                    <td style="padding: 6px 0;">${escapeHtml(value)}</td>
                  </tr>
                `;
              })
              .join('')}
          </table>
        </div>
      `
    });

    logger.info('Sent new client account email notification.', {
      uid,
      recipient,
      email
    });
  }
);
