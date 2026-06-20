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
      // 積水 must not become "Sekisui" (random transliteration gibberish)
      { when: 'id', inputHas: '積水', bad: ['Sekisui', 'sekisui'], good: 'genangan air' },
      // 茶水間 = pantry / ruang istirahat, NOT "dapur" (kitchen)
      { when: 'id', inputHas: '茶水間', bad: ['dapur'], good: 'ruang istirahat' },
      // 貨梯 = lift barang (freight elevator), NOT "tangga" (stairs)
      { when: 'id', inputHas: '貨梯', bad: ['tangga pengantaran', 'tangga'], good: 'lift barang' },
      // 磁磚 = ubin (floor tile), NOT "genteng" (roof tile)
      { when: 'id', inputHas: '磁磚', bad: ['Genteng', 'genteng'], good: 'ubin' },
      // 拆箱 = buka kotak (unbox), NOT "unboxing" (English)
      { when: 'id', inputHas: '拆箱', bad: ['Unboxing', 'unboxing'], good: 'buka kotak' },
      // 抽水 = pompa, NOT English "Pump"
      { when: 'id', inputHas: '抽水', bad: [' Pump', 'Pump '], good: 'pompa' },
      // 砂 = pasir, NOT English "sand"
      { when: 'id', inputHas: '砂', bad: [' sand', 'sand '], good: 'pasir' },
      // 掃 = sapu, NOT English "Sweep"
      { when: 'id', inputHas: '掃', bad: [' Sweep', 'Sweep '], good: 'sapu' },
      // 15樓 = lantai 15, NOT English "15F"
      { when: 'id', inputHas: '15樓', bad: ['15F', '15F'], good: 'lantai 15' },
      // 11樓 / 12樓 → same problem as 15F (English abbreviation in MyMemory output)
      { when: 'id', inputHas: '11樓', bad: ['11F', '11/F'], good: 'lantai 11' },
      { when: 'id', inputHas: '12樓', bad: ['12F', '12/F'], good: 'lantai 12' },
      // 1-10樓 + 13-14樓 — MyMemory converts these to "X/F" or "XF" systematically
      { when: 'id', inputHas: '1樓', bad: ['1F', '1/F'], good: 'lantai 1' },
      { when: 'id', inputHas: '2樓', bad: ['2F', '2/F'], good: 'lantai 2' },
      { when: 'id', inputHas: '3樓', bad: ['3F', '3/F'], good: 'lantai 3' },
      { when: 'id', inputHas: '4樓', bad: ['4F', '4/F'], good: 'lantai 4' },
      { when: 'id', inputHas: '5樓', bad: ['5F', '5/F'], good: 'lantai 5' },
      { when: 'id', inputHas: '6樓', bad: ['6F', '6/F'], good: 'lantai 6' },
      { when: 'id', inputHas: '7樓', bad: ['7F', '7/F'], good: 'lantai 7' },
      { when: 'id', inputHas: '8樓', bad: ['8F', '8/F'], good: 'lantai 8' },
      { when: 'id', inputHas: '9樓', bad: ['9F', '9/F'], good: 'lantai 9' },
      { when: 'id', inputHas: '10樓', bad: ['10F', '10/F'], good: 'lantai 10' },
      { when: 'id', inputHas: '13樓', bad: ['13F', '13/F'], good: 'lantai 13' },
      { when: 'id', inputHas: '14樓', bad: ['14F', '14/F'], good: 'lantai 14' },
      // 監工 = mandor (site foreman), NOT English "supervisor"
      { when: 'id', inputHas: '監工', bad: ['Supervisor', 'supervisor'], good: 'mandor' },
      // 鐵屑 = serbuk (metal filings), NOT English "scrap"
      { when: 'id', inputHas: '鐵屑', bad: ['Scrap', 'scrap'], good: 'serbuk' },
      // 走道 = koridor (corridor), NOT English "walkway"
      { when: 'id', inputHas: '走道', bad: ['Walkway', 'walkway'], good: 'koridor' },
      // 水泥 = semen (cement), NOT "beton" (concrete — different material)
      { when: 'id', inputHas: '水泥', bad: ['beton', 'Beton'], good: 'semen' },
      // 防水劑 = agen tahan air (waterproof agent). "penolak air" (water repellent) is wrong — repellent ≠ waterproof
      { when: 'id', inputHas: '防水劑', bad: ['penolak air'], good: 'agen tahan air' },
      // 滿載 = muatan penuh, NOT English "full"
      { when: 'id', inputHas: '滿載', bad: ['full stop', 'full'], good: 'muatan penuh' },
      // 油料桶 = ember (bucket), NOT English "bucket"
      { when: 'id', inputHas: '油料', bad: [' Bucket', 'bucket ', 'Bucket Oli'], good: ' ember' },
      // 粗工 = pekerja kasar (rough/unskilled worker), NOT standalone "kasar" (rough-adjective)
      // MyMemory turns 粗工 into "secara kasar" / "Penanganan Kasar" — adjectives only.
      // Force-insert "pekerja kasar" parenthetical so worker understands they're being addressed.
      { when: 'id', inputHas: '粗工', bad: ['secara kasar', 'secara Kasar'], good: 'pekerja kasar' },
      // 工班 = regu (work team/shift). MyMemory uses English "shift" — replace.
      { when: 'id', inputHas: '工班', bad: ['shift', 'Shift'], good: 'regu' },
      // 泥作師傅 = tukang batu (mason). MyMemory translates as "pembuat tanah liat" (clay maker).
      { when: 'id', inputHas: '泥作', bad: ['pembuat tanah liat', 'tanah liat'], good: 'tukang batu' },
      // 貼磁磚師傅 = tukang pasang ubin (tile layer). MyMemory: "pembuat ubin" or "master penempelan".
      { when: 'id', inputHas: '貼磁磚', bad: ['pembuat ubin'], good: 'tukang pasang ubin' },
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

// --- image upload proxy (litterbox.catbox.moe, 24h auto-expire) ---
const LITTERBOX_URL = 'https://litterbox.catbox.moe/resources/internals/api.php';
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB after client-side resize

app.post('/api/upload', async (req, res) => {
  try {
    const { data, mime, name } = req.body || {};
    if (typeof data !== 'string' || !mime) {
      return res.status(400).json({ error: 'missing data/mime' });
    }
    const buffer = Buffer.from(data, 'base64');
    if (buffer.length > MAX_UPLOAD_BYTES) {
      return res.status(400).json({ error: 'too large', size: buffer.length });
    }
    if (!/^image\/(jpeg|png|webp|gif)$/.test(mime)) {
      return res.status(400).json({ error: 'unsupported mime: ' + mime });
    }
    const filename = (name && /^[\w.\-]{1,64}$/.test(name)) ? name : 'image.jpg';
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('time', '24h');
    form.append('fileToUpload', new Blob([buffer], { type: mime }), filename);
    const r = await fetch(LITTERBOX_URL, { method: 'POST', body: form });
    if (!r.ok) throw new Error('upstream ' + r.status);
    const url = (await r.text()).trim();
    if (!/^https:\/\/litter\.catbox\.moe\//.test(url)) {
      throw new Error('unexpected upstream response: ' + url.slice(0, 120));
    }
    res.json({ url, expiresIn: '24h' });
  } catch (e) {
    console.error('upload error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

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
