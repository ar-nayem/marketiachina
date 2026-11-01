const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveEnvironmentSender } = require('../src/lib/mailer');

test('uses the configured Gmail SMTP account as the sender when credentials are complete', () => {
  const sender = resolveEnvironmentSender({
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: '465',
    SMTP_USER: 'nayem3622@gmail.com',
    SMTP_PASS: 'app-password',
    MAIL_FROM_NAME: 'Marketia China',
  });

  assert.deepEqual(sender, {
    auth_mode: 'smtp',
    gmail_address: 'nayem3622@gmail.com',
    sender_name: 'Marketia China',
    reply_to: null,
    smtp_host: 'smtp.gmail.com',
    smtp_port: 465,
    smtp_password: 'app-password',
  });
});

test('does not claim an environment sender when the Gmail password is missing', () => {
  assert.equal(resolveEnvironmentSender({ SMTP_USER: 'nayem3622@gmail.com' }), null);
});
