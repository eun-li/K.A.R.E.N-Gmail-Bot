const express = require('express');
const cors = require('cors');
const fs = require('fs');
const cron = require('node-cron');
const path = require('path');
const { google } = require('googleapis');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
];
const TOKEN_PATH = path.join(__dirname, 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

// ── Helper: builds the OAuth2 client from your credentials.json ──
function getOAuth2Client() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error('Missing credentials.json! Download it from Google Cloud Console.');
  }
  const content = fs.readFileSync(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const clientType = keys.installed || keys.web;
  return new google.auth.OAuth2(
    clientType.client_id,
    clientType.client_secret,
    clientType.redirect_uris[0]
  );
}

// ── Helper: builds + sends an email (reused by both routes below) ──
async function sendEmail(to, subject, messageText) {
  const oAuth2Client = getOAuth2Client();

  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error('Not authenticated. Click "Open Google Login" in the dashboard first.');
  }

  const tokenContent = fs.readFileSync(TOKEN_PATH);
  oAuth2Client.setCredentials(JSON.parse(tokenContent));

  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

  const utf8EncodedMail = [
    `To: ${to}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    messageText,
  ].join('\r\n');

  const raw = Buffer.from(utf8EncodedMail)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });

  return response.data.id;
}

// ── Route 1: Health check ──
app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong! your server is alive' });
});

// ── Route 2: Generate the Google login URL ──
app.get('/api/auth/url', (req, res) => {
  try {
    const oAuth2Client = getOAuth2Client();
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });
    res.json({ url: authUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Route 3: OAuth callback — Google redirects here with the auth code ──
app.get('/', async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.send('Backend server is running.');
  }

  try {
    const oAuth2Client = getOAuth2Client();
    const { tokens } = await oAuth2Client.getToken(code);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    res.send('<h1>Authentication successful!</h1><p>You can close this tab. Your token.json file has been saved.</p>');
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).send(`Auth failed: ${error.message}`);
  }
});

// ── Route 4: Send email immediately ──
app.post('/api/gmail/send', async (req, res) => {
  const { to, subject, messageText } = req.body;

  if (!to || !subject || !messageText) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, messageText' });
  }

  try {
    const messageId = await sendEmail(to, subject, messageText);
    res.json({ success: true, messageId });
  } catch (error) {
    console.error('Send failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ── Route 5: Schedule email for later ──
app.post('/api/gmail/schedule', async (req, res) => {
  const { to, subject, messageText, sendAt } = req.body;

  if (!to || !subject || !messageText || !sendAt) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, messageText, sendAt' });
  }

  const sendTime = new Date(sendAt);
  const delay = sendTime - new Date();

  if (delay <= 0) {
    return res.status(400).json({ error: 'Scheduled time must be in the future' });
  }

  // Respond to the dashboard immediately — don't make it wait
  res.json({ success: true, message: `Email scheduled for ${sendTime.toLocaleString()}` });

  // setTimeout runs independently in the background after the response is sent
  setTimeout(async () => {
    try {
      await sendEmail(to, subject, messageText);
      console.log(`✅ Scheduled email to ${to} sent at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      console.error(`❌ Scheduled send to ${to} failed:`, err.message);
    }
  }, delay);
});

const WHITELIST_PATH = path.join(__dirname, 'whitelist.json');

// ── Helper: load whitelist from disk ──
function loadWhitelist() {
  if (!fs.existsSync(WHITELIST_PATH)) return [];
  return JSON.parse(fs.readFileSync(WHITELIST_PATH));
}

// ── Helper: save whitelist to disk ──
function saveWhitelist(list) {
  fs.writeFileSync(WHITELIST_PATH, JSON.stringify(list, null, 2));
}

// ── Route 6: Get whitelist ──
app.get('/api/whitelist', (req, res) => {
  res.json({ whitelist: loadWhitelist() });
});

// ── Route 7: Add email to whitelist ──
app.post('/api/whitelist', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const list = loadWhitelist();
  if (list.includes(email))
    return res.status(400).json({ error: 'Email already in whitelist' });

  list.push(email);
  saveWhitelist(list);
  res.json({ success: true, whitelist: list });
});

// ── Route 8: Remove email from whitelist ──
app.delete('/api/whitelist/:email', (req, res) => {
  const email = decodeURIComponent(req.params.email);
  const list = loadWhitelist().filter(e => e !== email);
  saveWhitelist(list);
  res.json({ success: true, whitelist: list });
});

// ── Route 9: Fetch inbox (whitelisted senders only) ──
app.get('/api/gmail/inbox', async (req, res) => {
  const whitelist = loadWhitelist();
  if (whitelist.length === 0)
    return res.json({ messages: [], note: 'Whitelist is empty — add senders first.' });

  try {
    const oAuth2Client = getOAuth2Client();
    const tokenContent = fs.readFileSync(TOKEN_PATH);
    oAuth2Client.setCredentials(JSON.parse(tokenContent));
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    // Build query: "from:alice@work.com OR from:bob@work.com"
    const query = whitelist.map(e => `from:${e}`).join(' OR ');

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 20,
    });

    const messageItems = listRes.data.messages || [];

    // Fetch subject + sender for each message
    const messages = await Promise.all(
      messageItems.map(async ({ id }) => {
        const msg = await gmail.users.messages.get({
          userId: 'me', id, format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        });
        const headers = msg.data.payload.headers;
        const get = name => headers.find(h => h.name === name)?.value || '';
        return {
          id,
          from:    get('From'),
          subject: get('Subject'),
          date:    get('Date'),
          snippet: msg.data.snippet,
        };
      })
    );

    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ── Start the server ──
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});