// Fire-and-forget Telegram notifications (e.g. "new order placed"). Never
// throws into the caller — a Telegram outage should never break checkout.
async function notifyTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log(`[TELEGRAM] Not configured, skipping notification:\n${text}`);
    return;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    if (res.ok) {
      console.log('[TELEGRAM] Notification sent.');
    } else {
      console.error(`[TELEGRAM] Failed to send (${res.status}):`, await res.text());
    }
  } catch (err) {
    console.error('[TELEGRAM] Error sending notification:', err.message);
  }
}

module.exports = { notifyTelegram };
