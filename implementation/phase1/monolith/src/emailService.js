const axios = require('axios');
async function sendEmail(accessToken, { to, subject, body }) {
  if (!accessToken || !to) return;
  try {
    await axios.post('https://graph.microsoft.com/v1.0/me/sendMail',
      { message: { subject, body: { contentType: 'HTML', content: body },
        toRecipients: [{ emailAddress: { address: to } }] }, saveToSentItems: true },
      { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
    );
    console.log(`[email] Sent to ${to}: ${subject}`);
  } catch (err) {
    console.error(`[email] Failed:`, err.response?.data || err.message);
  }
}
module.exports = { sendEmail };
