# K.A.R.E.N — Email Automation Dashboard

**K.A.R.E.N** is a local automation dashboard that lets you send emails, schedule them for later, and filter your inbox — all from a sleek browser UI backed by a small Node.js server running on your own computer.

This guide teaches you how to build it from scratch. Every step is explained so you understand *why* you're doing it, not just *what* to type.

---

## What You'll Build

A local web dashboard that can:

- Send emails from your Gmail account with one click
- Schedule emails to send at a future date and time
- Show your inbox filtered to only show emails from people you trust (whitelist)
- Log every action your bot takes

---

## How It Works (The Big Picture)

Before writing any code, understand this mental model:

```
[ dashboard.html ]  →  fetch()  →  [ Node.js server ]  →  Gmail API  →  Google's servers
   (what you see)                   (runs on your PC)
```

Your browser cannot talk directly to Gmail — Google blocks that for security reasons. So you need two pieces:

1. **The frontend** — `dashboard.html`, the page you open in your browser. It has buttons and forms, and it sends requests to your local server.
2. **The backend** — `index.js`, a small server running on your computer. It holds your secret keys and is the only thing that talks to Google.

Think of the dashboard as a remote control, and the Node.js server as the device it controls.

---

## What You Need Before Starting

- A computer with internet access
- A Gmail account
- A code editor — [VS Code](https://code.visualstudio.com/) is recommended and free
- A terminal (Command Prompt or PowerShell on Windows, Terminal on Mac)

---

## Part 1 — Setting Up Node.js

Node.js is the engine that runs your backend server. It lets you run JavaScript outside of the browser.

### Step 1: Install Node.js

Go to [nodejs.org](https://nodejs.org) and download the **LTS** version (the one labeled "Recommended For Most Users"). Install it like any normal program.

To confirm it installed correctly, open your terminal and run:

```bash
node -v
npm -v
```

You should see version numbers like `v20.11.0` and `10.2.4`. If you see those, you're good.

> **What is npm?** npm is Node's package manager. It lets you install code libraries (called "packages") that other people wrote so you don't have to build everything from scratch.

---

## Part 2 — Creating Your Project

### Step 2: Create the project folder

In your terminal, run these three commands one by one:

```bash
mkdir bot-dashboard
cd bot-dashboard
npm init -y
```

**What just happened?**
- `mkdir bot-dashboard` — creates a new folder called `bot-dashboard`
- `cd bot-dashboard` — moves your terminal inside that folder
- `npm init -y` — creates a `package.json` file, which is your project's ID card. It tracks the name of your project and what packages it depends on.

### Step 3: Install the packages you need

```bash
npm install express cors dotenv googleapis node-cron
```

This downloads five packages into a folder called `node_modules`. Here's what each one does:

| Package | What it does |
|---|---|
| `express` | Creates your web server and handles incoming requests |
| `cors` | Lets your HTML file talk to your server without the browser blocking it |
| `dotenv` | Loads secret keys from a file so you never hardcode them |
| `googleapis` | Google's official library for talking to Gmail, Drive, etc. |
| `node-cron` | Lets you run code on a timer (for scheduling emails) |

Your folder should now look like this:

```
bot-dashboard/
├── node_modules/     ← installed packages (don't touch this)
└── package.json      ← your project's ID card
```

---

## Part 3 — Getting Google API Credentials

This is the most important setup step. You need to tell Google that your app exists and get a key that proves it's allowed to access Gmail.

### Step 4: Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Sign in with your Gmail account
3. Click the project dropdown at the top left → **New Project**
4. Name it something like `KAREN-Bot` and click **Create**
5. Make sure the new project is selected in the dropdown

### Step 5: Enable the Gmail API

1. In the left sidebar, go to **APIs & Services → Library**
2. Search for **Gmail API**
3. Click it and press **Enable**

### Step 6: Configure the OAuth Consent Screen

This is the screen users see when they log in with Google. Even for a personal project, you have to set it up.

1. Go to **APIs & Services → OAuth consent screen**
2. Choose **External** as the user type and click **Create**
3. Fill in:
   - **App name**: K.A.R.E.N Bot
   - **User support email**: your Gmail address
   - **Developer contact**: your Gmail address
4. Click **Save and Continue** through the Scopes screen (don't add any scopes here)
5. On the **Test users** screen — this is critical — click **Add Users** and enter your own Gmail address. If you skip this, Google will reject your login.
6. Click **Save and Continue** until done

### Step 7: Create OAuth Credentials

1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials** → **OAuth client ID**
3. Set **Application type** to **Desktop app**
4. Give it a name like `KAREN Desktop Client`
5. Click **Create**
6. A popup appears with your Client ID and Client Secret — click **Download JSON**
7. Move the downloaded file into your `bot-dashboard` folder
8. **Rename it to exactly `credentials.json`**

> **Why Desktop app?** Desktop app credentials allow you to run the OAuth login flow locally, which is what we need since this server runs on your computer, not a public website.

---

## Part 4 — Writing the Backend Server

Create a new file in your `bot-dashboard` folder called `index.js`. This is your entire backend. Copy the code below exactly.

### Understanding the structure first

Your `index.js` does five things:

1. Loads packages and sets up the server
2. Defines a helper to load your credentials
3. Defines a helper to send emails (reused by both send and schedule routes)
4. Defines routes — URLs your dashboard can call
5. Starts the server listening on port 3000

### The complete `index.js`

```js
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

// These are the Gmail permissions we're requesting
// gmail.send  = allowed to send email as you
// gmail.readonly = allowed to read your inbox
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
];

const TOKEN_PATH       = path.join(__dirname, 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

// ── Helper: loads credentials.json and creates an auth client ──
// Think of this as the "key" that proves your app is registered with Google
function getOAuth2Client() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error('Missing credentials.json! Download it from Google Cloud Console.');
  }
  const content    = fs.readFileSync(CREDENTIALS_PATH);
  const keys       = JSON.parse(content);
  const clientType = keys.installed || keys.web;
  return new google.auth.OAuth2(
    clientType.client_id,
    clientType.client_secret,
    clientType.redirect_uris[0]
  );
}

// ── Helper: builds and sends an email ──
// Both /api/gmail/send and /api/gmail/schedule use this
// so we write it once here instead of repeating ourselves
async function sendEmail(to, subject, messageText) {
  const oAuth2Client = getOAuth2Client();

  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error('Not authenticated. Click Open Google Login in the dashboard first.');
  }

  // Load the saved login token and attach it to the auth client
  const tokenContent = fs.readFileSync(TOKEN_PATH);
  oAuth2Client.setCredentials(JSON.parse(tokenContent));

  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

  // Gmail requires emails in a specific format called RFC 2822
  // then encoded as base64url
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
    userId: 'me', // 'me' means the logged-in user
    requestBody: { raw },
  });

  return response.data.id;
}

// ════════════════════════════════
//  ROUTES
//  A route = a URL your dashboard can call
//  app.get  = dashboard is reading data
//  app.post = dashboard is sending data
// ════════════════════════════════

// Route 1: Health check — dashboard calls this to see if server is alive
app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong! your server is alive' });
});

// Route 2: Returns the Google login URL
// Dashboard opens this URL in a new tab so you can log in
app.get('/api/auth/url', (req, res) => {
  try {
    const oAuth2Client = getOAuth2Client();
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline', // offline = we get a refresh token so we don't have to log in every time
      scope: SCOPES,
    });
    res.json({ url: authUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route 3: OAuth callback — Google redirects here after you log in
// It gives us a "code" which we exchange for a real token
app.get('/', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.send('Backend server is running.');
  }
  try {
    const oAuth2Client  = getOAuth2Client();
    const { tokens }    = await oAuth2Client.getToken(code);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    res.send('<h1>Authentication successful!</h1><p>You can close this tab. Your token.json has been saved.</p>');
  } catch (error) {
    res.status(500).send(`Auth failed: ${error.message}`);
  }
});

// Route 4: Send email immediately
app.post('/api/gmail/send', async (req, res) => {
  const { to, subject, messageText } = req.body;
  if (!to || !subject || !messageText) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, messageText' });
  }
  try {
    const messageId = await sendEmail(to, subject, messageText);
    res.json({ success: true, messageId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route 5: Schedule email for later
// setTimeout is like a countdown timer — it waits X milliseconds then runs the function
app.post('/api/gmail/schedule', async (req, res) => {
  const { to, subject, messageText, sendAt } = req.body;
  if (!to || !subject || !messageText || !sendAt) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const sendTime = new Date(sendAt);
  const delay    = sendTime - new Date(); // milliseconds from now until send time

  if (delay <= 0) {
    return res.status(400).json({ error: 'Scheduled time must be in the future' });
  }

  // Respond to the dashboard immediately — don't make the browser wait
  res.json({ success: true, message: `Email scheduled for ${sendTime.toLocaleString()}` });

  // This runs silently in the background after we've already responded
  setTimeout(async () => {
    try {
      await sendEmail(to, subject, messageText);
      console.log(`Scheduled email to ${to} sent at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      console.error(`Scheduled send failed:`, err.message);
    }
  }, delay);
});

// ── Whitelist helpers ──
// Whitelist = a list of email addresses whose messages you want to see
// We store it in whitelist.json on your computer

const WHITELIST_PATH = path.join(__dirname, 'whitelist.json');

function loadWhitelist() {
  if (!fs.existsSync(WHITELIST_PATH)) return [];
  return JSON.parse(fs.readFileSync(WHITELIST_PATH));
}

function saveWhitelist(list) {
  fs.writeFileSync(WHITELIST_PATH, JSON.stringify(list, null, 2));
}

// Route 6: Get the current whitelist
app.get('/api/whitelist', (req, res) => {
  res.json({ whitelist: loadWhitelist() });
});

// Route 7: Add an email to the whitelist
app.post('/api/whitelist', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const list = loadWhitelist();
  if (list.includes(email)) return res.status(400).json({ error: 'Already in whitelist' });
  list.push(email);
  saveWhitelist(list);
  res.json({ success: true, whitelist: list });
});

// Route 8: Remove an email from the whitelist
// :email in the URL is a dynamic parameter — like a variable in the URL path
app.delete('/api/whitelist/:email', (req, res) => {
  const email = decodeURIComponent(req.params.email);
  const list  = loadWhitelist().filter(e => e !== email);
  saveWhitelist(list);
  res.json({ success: true, whitelist: list });
});

// Route 9: Read inbox, only showing emails from whitelisted senders
app.get('/api/gmail/inbox', async (req, res) => {
  const whitelist = loadWhitelist();
  if (whitelist.length === 0) {
    return res.json({ messages: [], note: 'Whitelist is empty — add senders first.' });
  }
  try {
    const oAuth2Client = getOAuth2Client();
    const tokenContent = fs.readFileSync(TOKEN_PATH);
    oAuth2Client.setCredentials(JSON.parse(tokenContent));
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    // Build a Gmail search query like: from:alice@work.com OR from:bob@work.com
    const query = whitelist.map(e => `from:${e}`).join(' OR ');

    const listRes      = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: 20 });
    const messageItems = listRes.data.messages || [];

    // For each message ID, fetch the actual subject/sender/date
    const messages = await Promise.all(
      messageItems.map(async ({ id }) => {
        const msg     = await gmail.users.messages.get({ userId: 'me', id, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date'] });
        const headers = msg.data.payload.headers;
        const get     = name => headers.find(h => h.name === name)?.value || '';
        return { id, from: get('From'), subject: get('Subject'), date: get('Date'), snippet: msg.data.snippet };
      })
    );

    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`K.A.R.E.N server running at http://localhost:${PORT}`);
});
```

---

## Part 5 — Running the Server

### Step 8: Start the server

In your terminal, make sure you're in the `bot-dashboard` folder, then run:

```bash
node index.js
```

You should see:

```
K.A.R.E.N server running at http://localhost:3000
```

To test it's working, open your browser and visit `http://localhost:3000/api/ping`. You should see:

```json
{"message":"pong! your server is alive"}
```

> **Important:** Keep this terminal window open while using the dashboard. Closing it shuts down the server.

---

## Part 6 — Authenticating with Google

This step connects your server to your Gmail account. You only do this once.

### Step 9: Run the login flow

1. Open `dashboard.html` in your browser (double-click it or right-click → Open With → your browser)
2. Click **Open Google Login** in the dashboard
3. A Google tab opens — sign in and click **Continue** through any warnings
4. If you see "Google hasn't verified this app" — click **Advanced** → **Go to K.A.R.E.N Bot (unsafe)**. This is expected for personal projects in Testing mode.
5. Check both permission boxes (Send email, Read email) and click **Continue**
6. You'll land on a broken page that says something like `localhost refused to connect` — **this is normal**
7. Look at the URL in your address bar — it will look like:
   ```
   http://localhost/?code=4/0Af...
   ```
8. Add `:3000` after `localhost` so it becomes:
   ```
   http://localhost:3000/?code=4/0Af...
   ```
9. Press Enter

Your terminal will log the success, and a `token.json` file will appear in your folder. That file is your login session — the server uses it every time it calls Gmail.

> **If you change the SCOPES** (the permissions list) later, you must delete `token.json` and go through this login again. The old token won't have the new permissions.

---

## Part 7 — Your Project Files

When everything is set up, your folder should look like this:

```
bot-dashboard/
├── index.js              ← your backend server
├── dashboard.html        ← your browser dashboard
├── credentials.json      ← downloaded from Google Cloud (keep this secret)
├── token.json            ← auto-created after first login (keep this secret)
├── whitelist.json        ← auto-created when you add whitelist entries
├── package.json          ← project config
└── node_modules/         ← installed packages (don't touch)
```

---

## Part 8 — Security

### Step 10: Create a `.gitignore` file

If you ever upload this project to GitHub, you must make sure your secret files never get included. Create a file called `.gitignore` in your folder with this content:

```
# Installed packages — too large, anyone can reinstall with npm install
node_modules/

# Your Google secret keys — NEVER share these
credentials.json
token.json

# Your personal whitelist data
whitelist.json

# System files
.DS_Store
*.log
```

> **Why does this matter?** If `credentials.json` or `token.json` are ever uploaded to a public GitHub repo, anyone can use them to access your Gmail account. The `.gitignore` file tells Git to ignore these files completely.

---

## Troubleshooting

**"Cannot find module 'express'" or similar**
You're running `node index.js` from the wrong folder. Make sure your terminal is inside `bot-dashboard` and run `npm install` again.

**"Missing credentials.json"**
You haven't downloaded the file from Google Cloud yet, or it's in the wrong folder, or it's named something other than `credentials.json` exactly.

**Inbox shows nothing even though emails exist**
Your `token.json` was probably created before you added `gmail.readonly` to the SCOPES list. Delete `token.json` and go through the login flow again.

**"Server offline" in the dashboard**
The terminal running `node index.js` was closed or crashed. Open a new terminal, `cd` into your folder, and run it again.

**Google says "Access blocked" during login**
You forgot to add your Gmail address to the Test Users list in the OAuth consent screen. Go back to Google Cloud Console → APIs & Services → OAuth consent screen → Test users → Add your address.

---

## What You Learned

By building this you touched on real professional concepts:

- **Client-server architecture** — how a browser and a backend talk to each other
- **REST APIs** — what routes like `GET /api/ping` and `POST /api/gmail/send` actually are
- **OAuth2** — how modern apps log into services on your behalf without storing your password
- **Async/await** — how JavaScript handles operations that take time (like API calls)
- **Persistent storage** — saving data to JSON files on disk so it survives server restarts
- **Environment security** — why secrets live in files that never get committed to version control

---

## Dashboard Source Code

Save the following as `dashboard.html` in your `bot-dashboard` folder.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>K.A.R.E.N Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --accent:      #6c8aff;
      --accent-glow: rgba(108,138,255,0.25);
      --success:     #3ecf8e;
      --error:       #f87171;
      --warn:        #fbbf24;
      --text:        #ffffff;
      --muted:       rgba(255,255,255,0.40);
      --radius:      20px;
    }

    html, body {
      min-height: 100vh;
      background: #000;
      color: var(--text);
      font-family: 'Inter', sans-serif;
      overflow-x: hidden;
    }

    /* ── Cursor blob ── */
    #blob {
      position: fixed;
      width: 520px; height: 520px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(108,138,255,0.16) 0%, rgba(167,139,250,0.09) 45%, transparent 70%);
      pointer-events: none;
      transform: translate(-50%, -50%);
      transition: left 0.1s ease, top 0.1s ease;
      z-index: 0;
      filter: blur(48px);
    }

    /* ── Liquid glass ── */
    .liquid-glass {
      background: rgba(255,255,255,0.04);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: none;
      box-shadow: inset 0 1px 1px rgba(255,255,255,0.1);
      position: relative;
      overflow: hidden;
    }
    .liquid-glass::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      padding: 1.2px;
      background: linear-gradient(
        180deg,
        rgba(255,255,255,0.38) 0%,
        rgba(255,255,255,0.10) 20%,
        rgba(255,255,255,0)    40%,
        rgba(255,255,255,0)    60%,
        rgba(255,255,255,0.10) 80%,
        rgba(255,255,255,0.38) 100%
      );
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
      z-index: 1;
    }

    /* ── Layout ── */
    #app {
      position: relative; z-index: 1;
      display: flex; flex-direction: column; align-items: center;
      min-height: 100vh; padding: 0 20px 80px;
    }

    /* ── Navbar ── */
    nav {
      width: 100%; max-width: 780px;
      padding: 24px 0 20px;
      display: flex; justify-content: center;
      position: sticky; top: 0; z-index: 100;
    }
    .nav-pill {
      display: flex; align-items: center; justify-content: space-between;
      width: 100%; border-radius: 999px;
      padding: 8px 8px 8px 22px;
    }
    .nav-logo {
      font-size: 0.95rem; font-weight: 700;
      letter-spacing: 0.08em; color: #fff;
      font-family: 'Instrument Serif', serif;
      font-style: italic;
    }
    .nav-tabs {
      display: flex; gap: 2px;
      background: rgba(255,255,255,0.05);
      border-radius: 999px; padding: 4px;
    }
    .nav-tab {
      padding: 8px 16px;
      font-size: 0.8rem; font-weight: 500;
      border-radius: 999px; border: none;
      background: transparent; color: rgba(255,255,255,0.45);
      cursor: pointer; transition: all 0.2s;
      display: flex; align-items: center; gap: 7px;
      font-family: 'Inter', sans-serif;
    }
    .nav-tab svg { opacity: 0.6; transition: opacity 0.2s; flex-shrink: 0; }
    .nav-tab:hover { color: rgba(255,255,255,0.85); }
    .nav-tab:hover svg { opacity: 0.9; }
    .nav-tab.active {
      background: rgba(255,255,255,0.11);
      color: #fff;
      box-shadow: inset 0 1px 1px rgba(255,255,255,0.14);
    }
    .nav-tab.active svg { opacity: 1; }
    .status-pill {
      display: flex; align-items: center; gap: 6px;
      padding: 7px 16px; border-radius: 999px;
      font-size: 0.74rem; font-weight: 500;
      color: rgba(255,255,255,0.45);
    }
    .status-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: rgba(255,255,255,0.25);
      transition: background 0.3s, box-shadow 0.3s;
    }
    .status-dot.live { background: var(--success); box-shadow: 0 0 7px var(--success); }

    /* ── Pages ── */
    .page { display: none; width: 100%; max-width: 680px; flex-direction: column; gap: 14px; }
    .page.active { display: flex; animation: fadeUp 0.32s ease; }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Page heading ── */
    .page-heading {
      font-family: 'Instrument Serif', serif;
      font-size: 2.8rem; font-style: italic;
      color: rgba(255,255,255,0.88);
      letter-spacing: -0.02em; line-height: 1.1;
      margin-bottom: 4px;
    }
    .page-sub { font-size: 0.8rem; color: var(--muted); margin-bottom: 6px; }

    /* ── Card ── */
    .card { border-radius: var(--radius); padding: 24px; }
    .card-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
    .card-icon {
      width: 38px; height: 38px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 12px;
      display: grid; place-items: center;
    }
    .card-title { font-size: 0.93rem; font-weight: 600; }
    .card-sub   { font-size: 0.76rem; color: var(--muted); margin-top: 2px; }

    /* ── Inner tabs ── */
    .tabs {
      display: flex; gap: 3px;
      background: rgba(255,255,255,0.04);
      border-radius: 12px; padding: 4px; margin-bottom: 20px;
    }
    .tab {
      flex: 1; padding: 8px;
      font-size: 0.8rem; font-weight: 500; text-align: center;
      cursor: pointer; border-radius: 9px; border: none;
      background: transparent; color: var(--muted);
      transition: all 0.18s; font-family: 'Inter', sans-serif;
      display: flex; align-items: center; justify-content: center; gap: 7px;
    }
    .tab svg { opacity: 0.55; transition: opacity 0.18s; }
    .tab:hover { color: rgba(255,255,255,0.8); }
    .tab:hover svg { opacity: 0.85; }
    .tab.active {
      background: rgba(255,255,255,0.09);
      color: #fff;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.14);
    }
    .tab.active svg { opacity: 1; }

    /* ── Form ── */
    .form-group { margin-bottom: 14px; }
    label {
      display: block; font-size: 0.7rem; font-weight: 500;
      letter-spacing: 0.07em; text-transform: uppercase;
      color: var(--muted); margin-bottom: 7px;
    }
    input, textarea {
      width: 100%;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px; color: #fff;
      font-family: 'Inter', sans-serif; font-size: 0.9rem;
      padding: 11px 15px; outline: none;
      transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
    }
    input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.2); }
    input:focus, textarea:focus {
      border-color: rgba(108,138,255,0.45);
      background: rgba(108,138,255,0.04);
      box-shadow: 0 0 0 3px rgba(108,138,255,0.10);
    }
    textarea { resize: vertical; min-height: 100px; }
    .row { display: flex; gap: 12px; }
    .row .form-group { flex: 1; }
    .schedule-fields { display: none; }
    .schedule-fields.visible { display: block; }

    /* ── Buttons ── */
    .btn {
      width: 100%; padding: 12px;
      font-family: 'Inter', sans-serif; font-size: 0.87rem; font-weight: 600;
      border: none; border-radius: 12px; cursor: pointer;
      transition: all 0.2s;
      display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .btn svg { flex-shrink: 0; }
    .btn:active { transform: scale(0.97); }
    .btn:disabled { opacity: 0.32; cursor: not-allowed; transform: none; }
    .btn-primary {
      background: linear-gradient(135deg, #6c8aff, #a78bfa);
      color: #fff;
      box-shadow: 0 4px 22px rgba(108,138,255,0.28);
    }
    .btn-primary:hover:not(:disabled) {
      box-shadow: 0 6px 30px rgba(108,138,255,0.42);
      transform: translateY(-1px);
    }
    .btn-ghost {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.09);
      color: rgba(255,255,255,0.75);
    }
    .btn-ghost:hover:not(:disabled) {
      background: rgba(255,255,255,0.09);
      color: #fff; border-color: rgba(255,255,255,0.16);
    }
    .btn-sm { width: auto; padding: 7px 16px; font-size: 0.76rem; border-radius: 99px; }

    /* ── Status bar ── */
    .status-bar {
      display: none; align-items: center; gap: 10px;
      padding: 11px 15px; border-radius: 11px;
      margin-top: 12px; font-size: 0.82rem; font-weight: 500; border: 1px solid;
    }
    .status-bar.show { display: flex; animation: fadeUp 0.22s ease; }
    .status-icon {
      width: 18px; height: 18px; border-radius: 50%;
      display: grid; place-items: center; flex-shrink: 0;
    }
    .status-bar.success   { background: rgba(62,207,142,0.06);  border-color: rgba(62,207,142,0.18);  color: var(--success); }
    .status-bar.error     { background: rgba(248,113,113,0.06); border-color: rgba(248,113,113,0.18); color: var(--error); }
    .status-bar.loading   { background: rgba(108,138,255,0.06); border-color: rgba(108,138,255,0.18); color: var(--accent); }
    .status-bar.scheduled { background: rgba(251,191,36,0.06);  border-color: rgba(251,191,36,0.18);  color: var(--warn); }

    /* ── Inbox ── */
    .inbox-toolbar {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 14px;
    }
    .inbox-count { font-size: 0.76rem; color: var(--muted); }
    .message-list { display: flex; flex-direction: column; gap: 8px; }
    .message-item {
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 14px; padding: 14px 16px;
      cursor: pointer; transition: all 0.2s;
    }
    .message-item:hover {
      background: rgba(255,255,255,0.05);
      border-color: rgba(108,138,255,0.28);
      transform: translateY(-1px);
    }
    .msg-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
    .msg-from { font-size: 0.84rem; font-weight: 600; }
    .msg-date { font-size: 0.71rem; color: var(--muted); font-family: 'JetBrains Mono', monospace; }
    .msg-subject { font-size: 0.81rem; color: rgba(255,255,255,0.75); margin-bottom: 4px; }
    .msg-snippet { font-size: 0.75rem; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* ── Empty states (no emoji) ── */
    .empty-state { text-align: center; padding: 44px 0; color: var(--muted); font-size: 0.84rem; }
    .empty-icon {
      width: 40px; height: 40px; border-radius: 12px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.07);
      display: grid; place-items: center;
      margin: 0 auto 12px;
    }

    /* ── Whitelist ── */
    .whitelist-add { display: flex; gap: 8px; margin-bottom: 16px; }
    .whitelist-add input { flex: 1; }
    .whitelist-add .btn { width: auto; padding: 11px 20px; border-radius: 12px; }
    .whitelist-list { display: flex; flex-direction: column; gap: 8px; }
    .whitelist-item {
      display: flex; align-items: center; justify-content: space-between;
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 12px; padding: 12px 16px; transition: all 0.2s;
    }
    .whitelist-item:hover { background: rgba(255,255,255,0.04); }
    .whitelist-email {
      font-size: 0.84rem; font-family: 'JetBrains Mono', monospace;
      color: rgba(255,255,255,0.82);
    }
    .whitelist-badge {
      font-size: 0.67rem; font-weight: 600; letter-spacing: 0.05em;
      background: rgba(108,138,255,0.10);
      border: 1px solid rgba(108,138,255,0.22);
      color: var(--accent); border-radius: 99px; padding: 2px 9px; margin-left: 10px;
    }
    .remove-btn {
      background: none; border: none; cursor: pointer;
      color: rgba(255,255,255,0.2);
      width: 28px; height: 28px; border-radius: 8px;
      display: grid; place-items: center; transition: all 0.15s;
    }
    .remove-btn:hover { color: var(--error); background: rgba(248,113,113,0.08); }

    /* ── Log ── */
    .log-list { list-style: none; display: flex; flex-direction: column; gap: 6px; }
    .log-item {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 10px 14px;
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.05);
      border-radius: 10px; font-size: 0.81rem; transition: background 0.15s;
    }
    .log-item:hover { background: rgba(255,255,255,0.04); }
    .log-dot { width: 7px; height: 7px; border-radius: 50%; margin-top: 4px; flex-shrink: 0; }
    .log-dot.s { background: var(--success); box-shadow: 0 0 5px var(--success); }
    .log-dot.e { background: var(--error);   box-shadow: 0 0 5px var(--error); }
    .log-dot.w { background: var(--warn);    box-shadow: 0 0 5px var(--warn); }
    .log-time { color: var(--muted); font-family: 'JetBrains Mono', monospace; flex-shrink: 0; font-size: 0.74rem; }
    .log-text { color: rgba(255,255,255,0.7); }
    .empty-log { color: var(--muted); font-size: 0.8rem; text-align: center; padding: 24px 0; }
  </style>
</head>
<body>

  <div id="blob"></div>

  <div id="app">

    <!-- ── Navbar ── -->
    <nav>
      <div class="nav-pill liquid-glass">

        <div class="nav-logo">K.A.R.E.N</div>

        <div class="nav-tabs">
          <button class="nav-tab active" onclick="showPage('compose',this)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            Compose
          </button>
          <button class="nav-tab" onclick="showPage('inbox',this)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
            Inbox
          </button>
          <button class="nav-tab" onclick="showPage('whitelist',this)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Whitelist
          </button>
          <button class="nav-tab" onclick="showPage('log',this)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Log
          </button>
        </div>

        <div class="status-pill liquid-glass">
          <div class="status-dot" id="serverDot"></div>
          <span id="serverLabel">Checking…</span>
        </div>
      </div>
    </nav>

    <!-- ══════════════ COMPOSE ══════════════ -->
    <div class="page active" id="page-compose">
      <div>
        <div class="page-heading">Send a <em>message.</em></div>
        <div class="page-sub">Automate your Gmail — send now or schedule for later</div>
      </div>

      <div class="card liquid-glass">
        <div class="card-header">
          <div class="card-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          </div>
          <div>
            <div class="card-title">Gmail Automation</div>
            <div class="card-sub">Compose and deliver</div>
          </div>
        </div>

        <div class="tabs">
          <button class="tab active" id="tabNow" onclick="switchTab('now')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Send Now
          </button>
          <button class="tab" id="tabSched" onclick="switchTab('schedule')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Schedule
          </button>
        </div>

        <div class="form-group">
          <label>Recipient</label>
          <input type="email" id="toEmail" placeholder="friend@example.com">
        </div>
        <div class="form-group">
          <label>Subject</label>
          <input type="text" id="subject" placeholder="Hello from K.A.R.E.N!">
        </div>
        <div class="form-group">
          <label>Message</label>
          <textarea id="message" placeholder="Type your email content here…"></textarea>
        </div>

        <div class="schedule-fields" id="scheduleFields">
          <div class="row">
            <div class="form-group">
              <label>Date</label>
              <input type="date" id="sendDate">
            </div>
            <div class="form-group">
              <label>Time</label>
              <input type="time" id="sendTime">
            </div>
          </div>
        </div>

        <button class="btn btn-primary" id="sendEmailBtn" onclick="handleEmail()">
          <svg id="btnIcon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          <span id="btnText">Send Email</span>
        </button>
        <div class="status-bar" id="emailStatus"></div>
      </div>

      <div class="card liquid-glass">
        <div class="card-header">
          <div class="card-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <div>
            <div class="card-title">Google Authentication</div>
            <div class="card-sub">Authorize once to enable Gmail access</div>
          </div>
        </div>
        <button class="btn btn-ghost" onclick="handleAuth()">
          Open Google Login
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
      </div>
    </div>

    <!-- ══════════════ INBOX ══════════════ -->
    <div class="page" id="page-inbox">
      <div>
        <div class="page-heading">Your <em>inbox.</em></div>
        <div class="page-sub">Messages from whitelisted senders only</div>
      </div>

      <div class="card liquid-glass">
        <div class="inbox-toolbar">
          <span class="inbox-count" id="inboxCount">— messages</span>
          <button class="btn btn-ghost btn-sm" onclick="loadInbox()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Refresh
          </button>
        </div>
        <div class="message-list" id="messageList">
          <div class="empty-state">
            <div class="empty-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
            </div>
            Click Refresh to load your inbox.
          </div>
        </div>
      </div>
    </div>

    <!-- ══════════════ WHITELIST ══════════════ -->
    <div class="page" id="page-whitelist">
      <div>
        <div class="page-heading">Sender <em>whitelist.</em></div>
        <div class="page-sub">Only these addresses will appear in your inbox</div>
      </div>

      <div class="card liquid-glass">
        <div class="card-header">
          <div class="card-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div>
            <div class="card-title">Allowed Senders</div>
            <div class="card-sub">Add addresses to filter your inbox</div>
          </div>
        </div>

        <div class="whitelist-add">
          <input type="email" id="newWhitelistEmail" placeholder="boss@company.com" onkeydown="if(event.key==='Enter')addToWhitelist()">
          <button class="btn btn-primary" onclick="addToWhitelist()">+ Add</button>
        </div>

        <div class="whitelist-list" id="whitelistItems">
          <div class="empty-state">
            <div class="empty-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            No senders whitelisted yet.
          </div>
        </div>

        <div class="status-bar" id="whitelistStatus" style="margin-top:14px;"></div>
      </div>
    </div>

    <!-- ══════════════ LOG ══════════════ -->
    <div class="page" id="page-log">
      <div>
        <div class="page-heading">Activity <em>log.</em></div>
        <div class="page-sub">Everything K.A.R.E.N has done this session</div>
      </div>

      <div class="card liquid-glass">
        <ul class="log-list" id="logList">
          <li class="empty-log">No activity yet.</li>
        </ul>
      </div>
    </div>

  </div>

  <script>
    // SVGs for send/schedule button swap
    const SVG_SEND     = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
    const SVG_SCHEDULE = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

    // ── Cursor blob ──
    const blob = document.getElementById('blob');
    document.addEventListener('mousemove', e => {
      blob.style.left = e.clientX + 'px';
      blob.style.top  = e.clientY + 'px';
    });

    // ── Navigation ──
    function showPage(name, btn) {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.getElementById('page-' + name).classList.add('active');
      btn.classList.add('active');
      if (name === 'inbox')     loadInbox();
      if (name === 'whitelist') loadWhitelist();
    }

    // ── Compose tabs ──
    let currentTab = 'now';
    function switchTab(tab) {
      currentTab = tab;
      document.getElementById('tabNow').classList.toggle('active', tab === 'now');
      document.getElementById('tabSched').classList.toggle('active', tab === 'schedule');
      document.getElementById('scheduleFields').classList.toggle('visible', tab === 'schedule');
      document.getElementById('btnIcon').outerHTML = (tab === 'now' ? SVG_SEND : SVG_SCHEDULE).replace('<svg', '<svg id="btnIcon"');
      document.getElementById('btnText').textContent = tab === 'now' ? 'Send Email' : 'Schedule Email';
    }

    // ── Log ──
    function addLog(type, text) {
      const list = document.getElementById('logList');
      list.querySelector('.empty-log')?.remove();
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const li = document.createElement('li');
      li.className = 'log-item';
      li.innerHTML = `<div class="log-dot ${type}"></div><div class="log-time">${now}</div><div class="log-text">${text}</div>`;
      list.prepend(li);
    }

    // ── Status bar ──
    const STATUS_SVG = {
      success:   `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
      error:     `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
      loading:   `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-4.49"/></svg>`,
      scheduled: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    };
    function setStatus(id, type, msg) {
      const bar = document.getElementById(id);
      bar.className = `status-bar show ${type}`;
      bar.innerHTML = `<span class="status-icon">${STATUS_SVG[type]||''}</span><span>${msg}</span>`;
    }

    // ── Helpers ──
    function escapeHtml(s) {
      return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function formatDate(d) {
      if (!d) return '';
      try {
        const date = new Date(d), today = new Date();
        return date.toDateString() === today.toDateString()
          ? date.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
          : date.toLocaleDateString([], { month:'short', day:'numeric' });
      } catch { return d; }
    }

    // ── Server health ──
    async function checkServer() {
      try {
        await fetch('http://localhost:3000/api/ping');
        document.getElementById('serverDot').classList.add('live');
        document.getElementById('serverLabel').textContent = 'Live';
        addLog('s', 'Server connected — K.A.R.E.N is ready.');
      } catch {
        document.getElementById('serverLabel').textContent = 'Offline';
        addLog('e', 'Server offline. Run: node index.js');
      }
    }

    // ── Auth ──
    async function handleAuth() {
      try {
        const res  = await fetch('http://localhost:3000/api/auth/url');
        const data = await res.json();
        window.open(data.url, '_blank');
        addLog('w', 'Google auth window opened.');
      } catch { addLog('e', 'Could not fetch auth URL. Is the server running?'); }
    }

    // ── Send / Schedule ──
    async function handleEmail() {
      const btn = document.getElementById('sendEmailBtn');
      const payload = {
        to:          document.getElementById('toEmail').value.trim(),
        subject:     document.getElementById('subject').value.trim(),
        messageText: document.getElementById('message').value.trim(),
      };
      if (!payload.to || !payload.subject || !payload.messageText) {
        setStatus('emailStatus','error','Fill in all fields before sending.'); return;
      }
      if (currentTab === 'schedule') {
        const date = document.getElementById('sendDate').value;
        const time = document.getElementById('sendTime').value;
        if (!date || !time) { setStatus('emailStatus','error','Pick a date and time.'); return; }
        payload.sendAt = `${date}T${time}`;
      }
      btn.disabled = true;
      setStatus('emailStatus','loading', currentTab==='now' ? 'Sending…' : 'Scheduling…');
      const endpoint = currentTab==='now'
        ? 'http://localhost:3000/api/gmail/send'
        : 'http://localhost:3000/api/gmail/schedule';
      try {
        const res  = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
        const data = await res.json();
        if (res.ok) {
          currentTab==='now'
            ? (setStatus('emailStatus','success',`Sent — ID: ${data.messageId}`), addLog('s',`Email sent to ${payload.to}`))
            : (setStatus('emailStatus','scheduled',data.message), addLog('w',`Scheduled to ${payload.to} at ${payload.sendAt}`));
        } else {
          setStatus('emailStatus','error', data.error||'Something went wrong.');
          addLog('e', `Failed: ${data.error}`);
        }
      } catch {
        setStatus('emailStatus','error','Network error — is the server running?');
        addLog('e','Network error.');
      }
      btn.disabled = false;
    }

    // ── Whitelist ──
    async function loadWhitelist() {
      try {
        const res  = await fetch('http://localhost:3000/api/whitelist');
        const data = await res.json();
        renderWhitelist(data.whitelist);
      } catch { addLog('e','Could not load whitelist.'); }
    }

    function renderWhitelist(list) {
      const c = document.getElementById('whitelistItems');
      if (!list || !list.length) {
        c.innerHTML = `<div class="empty-state"><div class="empty-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>No senders whitelisted yet.</div>`;
        return;
      }
      c.innerHTML = list.map(email => `
        <div class="whitelist-item">
          <div style="display:flex;align-items:center;">
            <span class="whitelist-email">${escapeHtml(email)}</span>
            <span class="whitelist-badge">Allowed</span>
          </div>
          <button class="remove-btn" onclick="removeFromWhitelist('${escapeHtml(email)}')" title="Remove">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>`).join('');
    }

    async function addToWhitelist() {
      const input = document.getElementById('newWhitelistEmail');
      const email = input.value.trim();
      if (!email) { setStatus('whitelistStatus','error','Enter an email address first.'); return; }
      try {
        const res  = await fetch('http://localhost:3000/api/whitelist', {
          method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ email })
        });
        const data = await res.json();
        if (res.ok) {
          renderWhitelist(data.whitelist); input.value = '';
          setStatus('whitelistStatus','success',`${email} added.`);
          addLog('s',`Whitelisted: ${email}`);
        } else { setStatus('whitelistStatus','error', data.error); }
      } catch { setStatus('whitelistStatus','error','Network error.'); }
    }

    async function removeFromWhitelist(email) {
      try {
        const res  = await fetch(`http://localhost:3000/api/whitelist/${encodeURIComponent(email)}`, { method:'DELETE' });
        const data = await res.json();
        if (res.ok) {
          renderWhitelist(data.whitelist);
          setStatus('whitelistStatus','success',`${email} removed.`);
          addLog('w',`Removed from whitelist: ${email}`);
        }
      } catch { setStatus('whitelistStatus','error','Network error.'); }
    }

    // ── Inbox ──
    const EMPTY_SVG = {
      inbox:  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,
      shield: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
      error:  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
      loading:`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    };

    async function loadInbox() {
      const list = document.getElementById('messageList');
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">${EMPTY_SVG.loading}</div>Loading messages…</div>`;
      try {
        const res  = await fetch('http://localhost:3000/api/gmail/inbox');
        const data = await res.json();
        if (data.note) {
          list.innerHTML = `<div class="empty-state"><div class="empty-icon">${EMPTY_SVG.shield}</div>${data.note}<br><small style="color:var(--accent);display:block;margin-top:6px;">Go to Whitelist to add senders.</small></div>`;
          document.getElementById('inboxCount').textContent = '0 messages';
          return;
        }
        if (!data.messages?.length) {
          list.innerHTML = `<div class="empty-state"><div class="empty-icon">${EMPTY_SVG.inbox}</div>No messages from whitelisted senders.</div>`;
          document.getElementById('inboxCount').textContent = '0 messages';
          return;
        }
        document.getElementById('inboxCount').textContent = `${data.messages.length} message${data.messages.length!==1?'s':''}`;
        list.innerHTML = data.messages.map(msg => `
          <div class="message-item">
            <div class="msg-top">
              <span class="msg-from">${escapeHtml(msg.from)}</span>
              <span class="msg-date">${formatDate(msg.date)}</span>
            </div>
            <div class="msg-subject">${escapeHtml(msg.subject||'(no subject)')}</div>
            <div class="msg-snippet">${escapeHtml(msg.snippet||'')}</div>
          </div>`).join('');
        addLog('s',`Inbox loaded — ${data.messages.length} message(s).`);
      } catch(err) {
        list.innerHTML = `<div class="empty-state"><div class="empty-icon">${EMPTY_SVG.error}</div>Failed to load inbox. Is the server authenticated?</div>`;
        addLog('e','Inbox load failed: ' + err.message);
      }
    }

    checkServer();
  </script>
</body>
</html>
```