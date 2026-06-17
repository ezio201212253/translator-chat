// Real-time bilingual chat server
// - Serves static UI from /public
// - WebSocket at /ws for chat
// - POST /api/translate proxies MyMemory (free, no key)
// - Stores room history as JSON files under /data

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { WebSocketServer, WebSocket } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server }); // root path: Render edge passes ws upgrades through

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- translation proxy (MyMemory) ---
app.post('/api/translate', async (req, res) => {
  try {
    const { text, from, to } = req.body || {};
    if (typeof text !== 'string' || !from || !to) {
      return res.status(400).json({ error: 'missing params' });
    }
    if (from === to) return res.json({ translatedText: text });

    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(from)}|${encodeURIComponent(to)}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'translator-chat/1.0' } });
    if (!r.ok) throw new Error('upstream ' + r.status);
    const j = await r.json();
    const translated = (j && j.responseData && j.responseData.translatedText) || text;
    res.json({ translatedText: translated, match: j.responseData && j.responseData.match });
  } catch (e) {
    console.error('translate error:', e.message);
    res.status(500).json({ error: e.message, translatedText: '' });
  }
});

// --- health check (for Render) ---
app.get('/healthz', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// --- room storage ---
const roomFile = (id) => path.join(DATA_DIR, `${id}.json`);
const readRoom = (id) => {
  try {
    const raw = fs.readFileSync(roomFile(id), 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
};
const writeRoom = (id, msgs) => {
  try {
    fs.writeFileSync(roomFile(id), JSON.stringify(msgs, null, 2));
  } catch (e) {
    console.error('writeRoom error:', e.message);
  }
};

// --- WebSocket chat ---
const clients = new Map(); // ws -> { room, name, displayLang, typingLang }

wss.on('connection', (ws) => {
  clients.set(ws, { room: null, name: null, displayLang: 'en', typingLang: 'zh-TW' });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    const c = clients.get(ws);
    if (!c) return;

    if (msg.type === 'join') {
      c.room = String(msg.room || '').toUpperCase();
      c.name = String(msg.name || '匿名').slice(0, 24);
      c.displayLang = ['en', 'id', 'zh-TW'].includes(msg.displayLang) ? msg.displayLang : 'en';
      c.typingLang = ['en', 'id', 'zh-TW'].includes(msg.typingLang) ? msg.typingLang : c.displayLang;

      const history = readRoom(c.room);
      ws.send(JSON.stringify({ type: 'history', messages: history, you: { name: c.name, displayLang: c.displayLang } }));
      broadcast(c.room, { type: 'presence', text: `${c.name} joined`, ts: Date.now() }, ws);
    } else if (msg.type === 'send' && c.room) {
      const original = String(msg.original || '').slice(0, 2000);
      if (!original) return;
      const originalLang = ['en', 'id', 'zh-TW'].includes(msg.originalLang) ? msg.originalLang : 'en';
      const translations = (msg.translations && typeof msg.translations === 'object') ? msg.translations : {};

      const record = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        from: c.name,
        original,
        originalLang,
        translations,
        ts: Date.now()
      };
      const history = readRoom(c.room);
      history.push(record);
      // cap history per room at 1000
      if (history.length > 1000) history.splice(0, history.length - 1000);
      writeRoom(c.room, history);
      broadcast(c.room, { type: 'message', message: record });
    } else if (msg.type === 'setLang' && c.room) {
      c.displayLang = ['en', 'id', 'zh-TW'].includes(msg.displayLang) ? msg.displayLang : c.displayLang;
    }
  });

  ws.on('close', () => {
    const c = clients.get(ws);
    if (c && c.room) broadcast(c.room, { type: 'presence', text: `${c.name} left`, ts: Date.now() });
    clients.delete(ws);
  });
});

function broadcast(room, payload, excludeWs) {
  const data = JSON.stringify(payload);
  for (const [ws, c] of clients) {
    if (c.room === room && ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

server.listen(PORT, () => {
  console.log(`translator-chat listening on :${PORT}`);
});
