// Real-time bilingual chat server
// - Serves static UI from /public
// - WebSocket at /ws for chat
// - POST /api/translate proxies MyMemory (free, no key)
// - Storage: Upstash Redis (persistent) if env vars set, else local /data (ephemeral)
// - Glossary: pre-replaces technical zh-TW terms with their id equivalents before MyMemory,
//             so 批土 → dempul (not 'kotoran' = dirt), 放樣 → penandaan, 止水墩 → tanggul air kecil

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

// --- glossary loader ---
// Strategy: POST-FIX, not pre-replace. MyMemory confuses Indonesian terms
// embedded in Chinese (e.g. 油漆→cat, then "cat" gets translated to kucing=cat animal).
// So we send raw text to MyMemory, then fix only the known-bad Indonesian outputs.
let GLOSSARY_ID_BAD2GOOD = []; // [[badSubstring, goodSubstring], ...] longest-first
function loadGlossary() {
  const fp = path.join(__dirname, 'glossary.json');
  try {
    const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
    // For zh-TW → id: post-fix when MyMemory produces a known-bad Indonesian term
    // that doesn't match the source term. We compare to a curated bad→good list.
    // Pattern: a sentence containing term X should NOT contain bad-word Y.
    const fixes = [
      // [mustAppearInInput, badInOutput, goodInOutput, whenTargetIs='id']
      { when: 'id', inputHas: '批土', bad: ['kotoran', 'dengan kotoran', 'kebersihan dulu'], good: 'dempul' },
      { when: 'id', inputHas: '放樣', bad: ['ditempatkan', 'ditempat di', 'penempatan'], good: 'penandaan' },
      { when: 'id', inputHas: '止水墩', bad: ['pemberhentian air', 'penghentian air'], good: 'tanggul air kecil' },
      // 怪手 = excavator (not "strange hand")
      { when: 'id', inputHas: '怪手', bad: ['tangan aneh', 'tangan yang aneh'], good: 'excavator' },
      // 拆除 = bongkar (not "hapus" = delete) — caught in 200-instruction test
      { when: 'id', inputHas: '拆除', bad: ['menghapus', 'menghapusnya', 'menghilangkan'], good: 'bongkar' },
      // 消防栓 must not say "tak terhentikan" (unstoppable = reverse meaning)
      { when: 'id', inputHas: '消防栓', bad: ['tak terhentikan', 'tidak terhentikan', 'yang terhenti'], good: 'tidak boleh dihalangi' },
      // 棟: MyMemory often turns 棟 into verb "Membangun" (to build) or drops the A/B letter.
      // Force "Gedung A/B" or "Bangunan A/B" to appear so worker knows which building.
      { when: 'id', inputHas: 'A棟', bad: ['Membangun', 'membangun'], good: 'Gedung A' },
      { when: 'id', inputHas: 'B棟', bad: ['Membangun', 'membangun'], good: 'Gedung B' },
      // 水電 = utilitas (plumbing+electrical), NOT "pembangkit listrik tenaga air" (hydroelectric plant)
      { when: 'id', inputHas: '水電', bad: ['pembangkit listrik tenaga air', 'listrik dan air'], good: 'utilitas' },
      // 樓梯踏步 = stair tread (anak tangga), NOT "Treadmill" (exercise machine)
      { when: 'id', inputHas: '樓梯踏步', bad: ['Treadmill', 'treadmill'], good: 'anak tangga' },
      // 鷹架 keep (perancah is right)
      // 模板 keep (bekisting is right)
    ];
    GLOSSARY_ID_BAD2GOOD = fixes;
    // also keep a zh→id map for the OPT-IN ?glossary=1 flag (used by client debug)
    const map = new Map();
    for (const [section, entries] of Object.entries(raw)) {
      if (section.startsWith('_') || typeof entries !== 'object' || !entries) continue;
      for (const [zh, id] of Object.entries(entries)) {
        if (typeof zh === 'string' && typeof id === 'string') map.set(zh, id);
      }
    }
    GLOSSARY_ZH2ID = new Map([...map.entries()].sort((a, b) => b[0].length - a[0].length));
    console.log(`glossary: ${GLOSSARY_ZH2ID.size} terms loaded, ${GLOSSARY_ID_BAD2GOOD.length} post-fixes active`);
  } catch (e) {
    console.log('glossary: not found, translation unchanged');
  }
}
loadGlossary();

function postFix(text, from, to, originalInput) {
  if (from !== 'zh-TW' || to !== 'id') return text;
  let out = text;
  for (const fix of GLOSSARY_ID_BAD2GOOD) {
    if (!originalInput || originalInput.indexOf(fix.inputHas) === -1) continue;
    // Step 1: replace any known-bad Indonesian phrase with the correct term
    for (const bad of fix.bad) {
      const re = new RegExp(bad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      out = out.replace(re, fix.good);
    }
    // Step 2: if correct term still missing, force-insert as parenthetical
    // so the worker at least sees the right word, even if sentence is awkward
    if (out.toLowerCase().indexOf(fix.good.toLowerCase()) === -1) {
      out = out + ' (' + fix.good + ')';
    }
  }
  return out;
}

app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- translation proxy (MyMemory) with glossary post-fix ---
app.post('/api/translate', async (req, res) => {
  try {
    const { text, from, to } = req.body || {};
    if (typeof text !== 'string' || !from || !to) {
      return res.status(400).json({ error: 'missing params' });
    }
    if (from === to) return res.json({ translatedText: text });

    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(from)}|${encodeURIComponent(to)}&de=translator-chat@ezio.tw`;
    const r = await fetch(url, { headers: { 'User-Agent': 'translator-chat/1.0' } });
    if (!r.ok) throw new Error('upstream ' + r.status);
    const j = await r.json();
    let translated = (j && j.responseData && j.responseData.translatedText) || text;
    translated = postFix(translated, from, to, text);
    res.json({
      translatedText: translated,
      match: j.responseData && j.responseData.match,
      glossaryApplied: translated !== (j.responseData && j.responseData.translatedText)
    });
  } catch (e) {
    console.error('translate error:', e.message);
    res.status(500).json({ error: e.message, translatedText: '' });
  }
});

// --- health check (for Render) ---
app.get('/healthz', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// --- storage: Upstash Redis (persistent) + local file (ephemeral fallback) ---
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const USE_REDIS = !!(UPSTASH_URL && UPSTASH_TOKEN);

const roomFile = (id) => path.join(DATA_DIR, `${id}.json`);

async function redisExec(...args) {
  if (!USE_REDIS) return null;
  try {
    const r = await fetch(UPSTASH_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(5000)
    });
    if (!r.ok) {
      console.error('upstash http', r.status, (await r.text().catch(() => '')).slice(0, 200));
      return null;
    }
    const j = await r.json();
    return j.result;
  } catch (e) {
    console.error('upstash err', e.message);
    return null;
  }
}

async function readRoom(id) {
  if (USE_REDIS) {
    const v = await redisExec('GET', `chat:room:${id}`);
    if (typeof v === 'string' && v.length) {
      try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch { return []; }
    }
    return []; // key missing OR redis unavailable
  }
  // local file fallback
  try {
    const raw = fs.readFileSync(roomFile(id), 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function writeRoom(id, msgs) {
  let redisOk = false;
  if (USE_REDIS) {
    const r = await redisExec('SET', `chat:room:${id}`, JSON.stringify(msgs));
    if (r === 'OK') redisOk = true;
  }
  // always mirror to local file as backup
  try {
    fs.writeFileSync(roomFile(id), JSON.stringify(msgs, null, 2));
  } catch (e) { /* ignore local write errors */ }
  return redisOk || !USE_REDIS;
}

// Debug: which storage mode are we in?
app.get('/api/storage', (_req, res) => {
  res.json({
    mode: USE_REDIS ? 'redis (persistent)' : 'local (ephemeral on Render free tier)',
    persistent: USE_REDIS,
    hasUrl: !!UPSTASH_URL,
    hasToken: !!UPSTASH_TOKEN
  });
});

// --- WebSocket chat ---
const clients = new Map(); // ws -> { room, name, displayLang, typingLang }

wss.on('connection', (ws) => {
  clients.set(ws, { room: null, name: null, displayLang: 'en', typingLang: 'zh-TW' });

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    const c = clients.get(ws);
    if (!c) return;

    if (msg.type === 'join') {
      c.room = String(msg.room || '').toUpperCase();
      c.name = String(msg.name || '匿名').slice(0, 24);
      c.displayLang = ['en', 'id', 'zh-TW'].includes(msg.displayLang) ? msg.displayLang : 'en';
      c.typingLang = ['en', 'id', 'zh-TW'].includes(msg.typingLang) ? msg.typingLang : c.displayLang;

      const history = await readRoom(c.room);
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
      const history = await readRoom(c.room);
      history.push(record);
      // cap history per room at 1000
      if (history.length > 1000) history.splice(0, history.length - 1000);
      await writeRoom(c.room, history);
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
  console.log(`storage mode: ${USE_REDIS ? 'REDIS (persistent)' : 'LOCAL FILE (ephemeral on free Render!)'}`);
});
