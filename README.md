# 🤖 K.A.R.E.N. Automation Control Panel

A beautiful, high-fidelity automated communication engine and smart email management dashboard built with Node.js, Express, and the official Google APIs client. This app features real-time immediate delivery, an asynchronous background scheduler, and a custom security-first email inbox whitelisting filter.

---

## ⚡ Features

* **Liquid Glass UI:** Sleek, high-polish dark mode dashboard with backdrop blurs, a dynamic smooth cursor-following glow, and curated typography.
* **Granular OAuth2 Lifecycle:** Local authentication workflow managing multi-scope API access parameters (`gmail.send` and `gmail.readonly`).
* **Non-Blocking Background Scheduler:** Offloads time-delayed execution blocks without forcing the client-side UI to wait for a response.
* **Persistent Sender Whitelisting:** Local, lightweight storage parameters (`whitelist.json`) allowing you to securely isolate and view only specified email streams.

---

## 📦 File Architecture

Ensure your workspace directory tree matches the layout below:

```text
bot-dashboard/
├── index.js
├── dashboard.html
├── credentials.json  (Downloaded from Google Cloud Console)
├── token.json        (Auto-generated upon first authentication)
└── whitelist.json    (Auto-generated upon updating whitelist profiles)

🚀 Step-by-Step Installation & Setup
1. Initialize the Workspace
Open a terminal in your project directory and configure your package environment:

Bash
mkdir bot-dashboard
cd bot-dashboard
npm init -y
2. Install Dependencies
Install the required core packages using npm:

Bash
npm install express cors googleapis node-cron
3. Create the Backend Server File
Create an index.js file in your root folder and paste the complete Node.js code provided in your original configuration.

🔑 Google Cloud Setup Guide
To get your credentials.json file and grant the application permissions to interact securely with your Gmail account, follow these configuration steps:

1. Enable Gmail API
Navigate directly to the Google Cloud Console.

Create a brand new project (e.g., KAREN-Automation-Bot).

Search for the Gmail API inside the API Library page and click Enable.

2. Configure OAuth Consent Screen
Go to the OAuth Consent Screen panel via the sidebar navigation.

Under User Type, select External, and fill out the basic required fields (App Name, User support email).

Set the application publishing status step to Testing.

CRITICAL STEP: Go to the Test Users panel block, click Add Users, and enter your personal Gmail address. If this user account isn't explicitly listed, Google will completely reject your authentication flow.

3. Generate Desktop App Credentials
Head over to the Credentials tab on the left-hand menu panel.

Click + Create Credentials at the top of the viewport and choose OAuth client ID.

Under the Application type dropdown menu, explicitly select Desktop Application.

Name your credential block, click Create, and then click the Download JSON button on the configuration pop-up screen.

Move the downloaded asset folder file into your root development project path and rename it exactly to: credentials.json.

🎯 Running & Initializing the Application
Spin up your local server runtime process via the terminal terminal:

Bash
node index.js
Open dashboard.html inside your favorite modern browser window.

Click the Open Google Auth Protocol Setup secondary button at the bottom of the card block.

If a secure interstitial screen states "Google hasn't verified this app", click Advanced followed by Go to Local Bot Dashboard (unsafe).

Check both permission checkboxes (Send email on your behalf and View your email messages and settings) then click Continue.

The app will redirect you to a broken localhost page window. Do not panic. Copy the entire URL string out of the browser address bar (it will look like http://localhost/?code=4/0Af...).

Paste it into an empty string editor or directly back into your browser header bar, insert the port parameter :3000 right after localhost, changing the URL format to http://localhost:3000/?code=4/0Af..., and hit enter.

The server console output will register the access token block and instantly generate your permanent local authentication credentials file (token.json).

🔒 Security Practices (.gitignore)
To ensure your private Google client structures, session logins, or temporary variables never get committed to public source control networks, configure a .gitignore file in your directory root:

Plaintext
# Local Node runtime dependencies
node_modules/

# Private API security infrastructure and dynamic profile parameters
credentials.json
token.json

# Local disk persistence structures
whitelist.json

# Environment tracking arrays
.DS_Store
*.log
🎨 Dashboard Design & Frontend Source
Place the user interface source tracking configuration layout below into your local project environment folder as your standalone dashboard.html asset module.

HTML
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>K.A.R.E.N Dashboard</title>
  <link href="[https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap](https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap)" rel="stylesheet">
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

    /* ── Whitelist & Inbox Lists ── */
    .whitelist-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 15px; }
    .whitelist-pill {
      display: flex; align-items: center; gap: 8px;
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
      padding: 6px 14px; border-radius: 99px; font-size: 0.8rem;
    }
    .whitelist-remove {
      background: transparent; border: none; color: var(--muted);
      cursor: pointer; font-size: 0.9rem; transition: color 0.2s;
    }
    .whitelist-remove:hover { color: var(--error); }

    .message-list { display: flex; flex-direction: column; gap: 10px; margin-top: 15px; }
    .message-item {
      background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06);
      padding: 16px; border-radius: 12px; transition: transform 0.2s, border-color 0.2s;
    }
    .message-item:hover {
      transform: translateY(-1px); border-color: rgba(255,255,255,0.12);
    }
    .msg-header { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.8rem; }
    .msg-from { font-weight: 600; color: var(--accent); }
    .msg-date { color: var(--muted); }
    .msg-subject { font-size: 0.9rem; font-weight: 500; margin-bottom: 4px; }
    .msg-snippet { font-size: 0.8rem; color: var(--muted); line-height: 1.4; }

    .empty-state {
      text-align: center; padding: 40px 20px; color: var(--muted); font-size: 0.85rem;
    }
    .log-terminal {
      background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.06);
      font-family: 'JetBrains Mono', monospace; font-size: 0.78rem;
      padding: 16px; border-radius: 12px; min-height: 200px; max-height: 300px;
      overflow-y: auto; color: rgba(255,255,255,0.7);
    }
    .log-line { margin-bottom: 6px; line-height: 1.4; }
    .log-time { color: var(--muted); margin-right: 8px; }
  </style>
</head>
<body>

  <div id="blob"></div>

  <div id="app">
    <nav>
      <div class="nav-pill liquid-glass">
        <div class="nav-logo">k.a.r.e.n</div>
        <div class="nav-tabs">
          <button class="nav-tab active" onclick="switchPage('compose')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            Compose
          </button>
          <button class="nav-tab" onclick="switchPage('inbox')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            Inbox
          </button>
          <button class="nav-tab" onclick="switchPage('whitelist')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>
            Whitelist
          </button>
          <button class="nav-tab" onclick="switchPage('logs')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="4 17 10 11 15 16 22 9"/><polyline points="17 9 22 9 22 14"/></svg>
            Logs
          </button>
        </div>
        <div class="status-pill">
          <div id="statusDot" class="status-dot"></div>
          <span id="statusText">Checking Connection</span>
        </div>
      </div>
    </nav>

    <div id="page-compose" class="page active">
      <h1 class="page-heading">Dispatch Engine</h1>
      <p class="page-sub">Send automated email distributions instantly or assign background execution timers.</p>
      
      <div class="card liquid-glass">
        <div class="tabs">
          <button id="tab-now" class="tab active" onclick="switchMode('now')">Execute Immediate</button>
          <button id="tab-schedule" class="tab" onclick="switchMode('schedule')">Time Delay Schedule</button>
        </div>

        <div class="form-group">
          <label>Recipient Address</label>
          <input type="email" id="toEmail" placeholder="target@example.com">
        </div>
        <div class="form-group">
          <label>Subject Line</label>
          <input type="text" id="subject" placeholder="System transmission thread">
        </div>
        <div class="form-group">
          <label>Message Content Payload (HTML Supported)</label>
          <textarea id="message" placeholder="Type transactional context message body..."></textarea>
        </div>

        <div id="scheduleFields" class="form-group schedule-fields">
          <label>Future Execution Dispatch Timestamp</label>
          <input type="datetime-local" id="sendAt">
        </div>

        <button id="actionBtn" class="btn btn-primary" onclick="handleSend()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          Execute Automation
        </button>
        <button class="btn btn-ghost" style="margin-top: 8px;" onclick="triggerLogin()">
          Open Google Auth Protocol Setup
        </button>

        <div id="statusBar" class="status-bar">
          <div class="status-icon"></div>
          <span id="statusMessage"></span>
        </div>
      </div>
    </div>

    <div id="page-inbox" class="page">
      <h1 class="page-heading">Secured Inbox Matrix</h1>
      <p class="page-sub">Displaying stream profiles filtered from authorized whitelisted identities exclusively.</p>
      <div class="card liquid-glass">
        <div class="inbox-toolbar">
          <button class="btn btn-ghost btn-sm" onclick="fetchInbox()">Sync Secure Feed</button>
          <span class="inbox-count" id="inboxCount">0 Messages Sorted</span>
        </div>
        <div class="message-list" id="inboxContainer">
          <div class="empty-state">No context threads loaded. Trigger synchronization stream.</div>
        </div>
      </div>
    </div>

    <div id="page-whitelist" class="page">
      <h1 class="page-heading">Verification Parameters</h1>
      <p class="page-sub">Add or filter target identities allowed to pipe threads onto your dashboard feed.</p>
      <div class="card liquid-glass">
        <div class="row">
          <div class="form-group">
            <label>Authorize Sender Address</label>
            <input type="email" id="whitelistInput" placeholder="identity@domain.com">
          </div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="addWhitelist()">Register Identity Space</button>
        <div class="whitelist-grid" id="whitelistContainer"></div>
      </div>
    </div>

    <div id="page-logs" class="page">
      <h1 class="page-heading">Audit Terminal Logs</h1>
      <p class="page-sub">Real-time asynchronous execution logs reporting internal server transactions.</p>
      <div class="card liquid-glass">
        <div class="log-terminal" id="logTerminal">
          <div class="log-line"><span class="log-time">[00:00:00]</span>System tracing initialized core modules successfully.</div>
        </div>
      </div>
    </div>
  </div>

  <script>
    let currentMode = 'now';

    // Blob mouse movement mapping
    const blob = document.getElementById('blob');
    window.addEventListener('mousemove', (e) => {
      blob.style.left = e.clientX + 'px';
      blob.style.top = e.clientY + 'px';
    });

    // Navigation state routing
    function switchPage(pageId) {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      
      document.getElementById(`page-${pageId}`).classList.add('active');
      event.currentTarget.classList.add('active');

      if(pageId === 'whitelist') fetchWhitelist();
      if(pageId === 'inbox') fetchInbox();
    }

    // Compose mode shifting
    function switchMode(mode) {
      currentMode = mode;
      document.getElementById('tab-now').classList.toggle('active', mode === 'now');
      document.getElementById('tab-schedule').classList.toggle('active', mode === 'schedule');
      document.getElementById('scheduleFields').classList.toggle('visible', mode === 'schedule');
    }

    // Logger operations mapping
    function logEvent(text) {
      const term = document.getElementById('logTerminal');
      const time = new Date().toLocaleTimeString();
      term.innerHTML += `<div class="log-line"><span class="log-time">[${time}]</span>${text}</div>`;
      term.scrollTop = term.scrollHeight;
    }

    // Health-check monitoring links
    async function checkHealth() {
      try {
        const res = await fetch('http://localhost:3000/api/ping');
        if (res.ok) {
          document.getElementById('statusDot').className = 'status-dot live';
          document.getElementById('statusText').textContent = 'Server Live';
        }
      } catch {
        document.getElementById('statusDot').className = 'status-dot';
        document.getElementById('statusText').textContent = 'Server Offline';
      }
    }

    // Handshake initialization vectors
    async function triggerLogin() {
      try {
        const res = await fetch('http://localhost:3000/api/auth/url');
        const data = await res.json();
        if(data.url) {
          window.open(data.url, '_blank');
          logEvent('Authentication process URL requested.');
        }
      } catch {
        logEvent('Error linking down target server authentication path variables.');
      }
    }

    // Core transmission mappings
    async function handleSend() {
      const bar = document.getElementById('statusBar');
      const msg = document.getElementById('statusMessage');
      
      const payload = {
        to: document.getElementById('toEmail').value,
        subject: document.getElementById('subject').value,
        messageText: document.getElementById('message').value
      };

      bar.className = 'status-bar show loading';
      msg.textContent = 'Processing request pipeline details...';

      let endpoint = 'http://localhost:3000/api/gmail/send';
      if (currentMode === 'schedule') {
        endpoint = 'http://localhost:3000/api/gmail/schedule';
        payload.sendAt = document.getElementById('sendAt').value;
      }

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok) {
          bar.className = `status-bar show ${currentMode === 'schedule' ? 'scheduled' : 'success'}`;
          msg.textContent = currentMode === 'schedule' ? `Target queued: ${data.message}` : `Success! Transaction message ID: ${data.messageId}`;
          logEvent(`Dispatched request target block directly towards ${payload.to}`);
        } else {
          bar.className = 'status-bar show error';
          msg.textContent = `Error details: ${data.error}`;
        }
      } catch {
        bar.className = 'status-bar show error';
        msg.textContent = 'Network communication failure hitting target API profiles.';
      }
    }

    // Whitelist API connection matrices
    async function fetchWhitelist() {
      try {
        const res = await fetch('http://localhost:3000/api/whitelist');
        const data = await res.json();
        const container = document.getElementById('whitelistContainer');
        container.innerHTML = '';
        data.whitelist.forEach(email => {
          container.innerHTML += `
            <div class="whitelist-pill">
              <span>${email}</span>
              <button class="whitelist-remove" onclick="removeWhitelist('${encodeURIComponent(email)}')">✕</button>
            </div>`;
        });
      } catch { logEvent('Failed tracking whitelist configuration properties.'); }
    }

    async function addWhitelist() {
      const email = document.getElementById('whitelistInput').value;
      if(!email) return;
      try {
        const res = await fetch('http://localhost:3000/api/whitelist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        if(res.ok) {
          document.getElementById('whitelistInput').value = '';
          fetchWhitelist();
          logEvent(`Registered identity validation rule criteria: ${email}`);
        }
      } catch { logEvent('Error saving unique user access matrix arrays.'); }
    }

    async function removeWhitelist(email) {
      try {
        const res = await fetch(`http://localhost:3000/api/whitelist/${email}`, { method: 'DELETE' });
        if(res.ok) {
          fetchWhitelist();
          logEvent(`Revoked tracking validation identity indices: ${decodeURIComponent(email)}`);
        }
      } catch { logEvent('Error resolving structural deletion arrays.'); }
    }

    // Inbox feed stream mapping
    async function fetchInbox() {
      const container = document.getElementById('inboxContainer');
      container.innerHTML = '<div class="empty-state">Syncing data stream properties...</div>';
      try {
        const res = await fetch('http://localhost:3000/api/gmail/inbox');
        const data = await res.json();
        
        if (data.note) {
          container.innerHTML = `<div class="empty-state">${data.note}</div>`;
          return;
        }

        document.getElementById('inboxCount').textContent = `${data.messages.length} Matrix Matches`;
        container.innerHTML = '';
        
        if(data.messages.length === 0) {
          container.innerHTML = '<div class="empty-state">No matched criteria messages found inside active streams.</div>';
          return;
        }

        data.messages.forEach(msg => {
          container.innerHTML += `
            <div class="message-item">
              <div class="msg-header">
                <span class="msg-from">${escapeHtml(msg.from)}</span>
                <span class="msg-date">${escapeHtml(msg.date)}</span>
              </div>
              <div class="msg-subject">${escapeHtml(msg.subject || '(No Subject Line)')}</div>
              <div class="msg-snippet">${escapeHtml(msg.snippet || '')}</div>
            </div>`;
        });
      } catch {
        container.innerHTML = '<div class="empty-state" style="color: var(--error);">Error communicating with data feed streams.</div>';
      }
    }

    function escapeHtml(str) {
      if(!str) return '';
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    // Continuous operational polling loops
    checkHealth();
    setInterval(checkHealth, 10000);
  </script>
</body>
</html>