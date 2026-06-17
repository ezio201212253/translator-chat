// E2E test: 2 clients in same room, each pre-translating before send (like real client.js does)
const WebSocket = require('ws');

const PORT = 3000;
const LANG_HINTS = { 'zh-TW': ['的','是','我','你','了','在','有'], en: ['the','is','i','you','and'], id: ['saya','anda','yang','tidak','untuk'] };
function autoDetect(text) {
  if (/[一-鿿]/.test(text)) return 'zh-TW';
  let best = 'en', bestScore = 0;
  const lower = text.toLowerCase();
  for (const [lang, words] of Object.entries(LANG_HINTS)) {
    let s = 0;
    for (const w of words) { const m = lower.match(new RegExp('\\b' + w + '\\b', 'gi')); if (m) s += m.length; }
    if (s > bestScore) { bestScore = s; best = lang; }
  }
  return best;
}

async function callTranslate(text, from, to) {
  if (from === to) return text;
  const r = await fetch('http://localhost:' + PORT + '/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, from, to })
  });
  const j = await r.json();
  return j.translatedText || text;
}

async function translateToAll(text, from) {
  const out = { [from]: text };
  await Promise.all(['en', 'id', 'zh-TW'].filter(l => l !== from).map(async to => {
    out[to] = await callTranslate(text, from, to);
  }));
  return out;
}

function client(name, displayLang, typingLang, msgs) {
  return new Promise(async (resolve, reject) => {
    const ws = new WebSocket('ws://localhost:' + PORT + '/ws');
    const received = [];
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'join', room: 'TEST01', name, displayLang, typingLang }));
    });
    ws.on('message', async (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.type === 'message') received.push(m.message);
      if (m.type === 'history') {
        for (const text of msgs) {
          const translations = await translateToAll(text, typingLang);
          ws.send(JSON.stringify({ type: 'send', original: text, originalLang: typingLang, translations }));
          await new Promise(r => setTimeout(r, 300));
        }
        await new Promise(r => setTimeout(r, 1500));
        ws.close();
      }
    });
    ws.on('close', () => resolve(received));
    ws.on('error', reject);
    setTimeout(() => reject(new Error('timeout')), 30000);
  });
}

(async () => {
  const aP = client('王先生', 'en', 'zh-TW', ['請問今天進度如何？', '需要我去看現場嗎？']);
  await new Promise(r => setTimeout(r, 200));
  const bP = client('Pak Ahmad', 'id', 'id', ['Saya akan ke sana jam 9 pagi.', 'Baik, terima kasih banyak.']);
  const [aGot, bGot] = await Promise.all([aP, bP]);

  console.log('=== 王先生 (display=en) 收到的訊息 ===');
  for (const m of aGot) {
    if (m.from === '王先生') continue;
    const shown = m.translations.en || m.original;
    const orig  = m.translations['zh-TW'] || m.original;
    console.log(`[${m.from} | ${m.originalLang}] 顯示: ${shown}`);
    console.log(`                原文: ${orig}`);
  }
  console.log('');
  console.log('=== Pak Ahmad (display=id) 收到的訊息 ===');
  for (const m of bGot) {
    if (m.from === 'Pak Ahmad') continue;
    const shown = m.translations.id || m.original;
    const orig  = m.translations['zh-TW'] || m.original;
    console.log(`[${m.from} | ${m.originalLang}] 顯示: ${shown}`);
    console.log(`                原文: ${orig}`);
  }
  console.log('');
  console.log('--- data/TEST01.json 內容 ---');
  const fs = require('fs');
  console.log(fs.readFileSync('./data/TEST01.json', 'utf8'));
})();
