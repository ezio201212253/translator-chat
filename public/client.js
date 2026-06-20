// Chat client - WebSocket + auto-translate via /api/translate
// Supports 3 languages: en, id, zh-TW

const LANG_LABELS = {
  en: { short: 'EN', long: 'English' },
  id: { short: 'ID', long: 'Indonesian' },
  'zh-TW': { short: '中', long: '中文' }
};

const state = {
  ws: null,
  room: null,
  name: null,
  displayLang: 'en',
  typingLang: 'zh-TW',
  messages: [],
  showOriginal: new Set(), // message ids currently showing original
  pendingTranslations: new Set(), // "msgId|lang" keys
  reconnectAttempts: 0
};

const $ = (id) => document.getElementById(id);

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTime(ts) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function setStatus(text, cls) {
  const el = $('statusLine');
  el.textContent = text;
  el.className = 'status' + (cls ? ' ' + cls : '');
}

function setDisplayLangUI() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === state.displayLang);
  });
}

// Check whether we already have any translation result stored for this lang.
// (Even if the API returned the same text as original — that's still our best
// answer and we must save it, otherwise we'd re-fetch forever.)
function hasValidTranslation(m, lang) {
  if (lang === m.originalLang) return true;
  return m.translations && typeof m.translations[lang] === 'string';
}

async function ensureTranslation(m, lang) {
  if (m.system) return;
  if (hasValidTranslation(m, lang)) return;
  if (state.pendingTranslations.has(m.id + '|' + lang)) return;
  state.pendingTranslations.add(m.id + '|' + lang);
  try {
    const r = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: m.original, from: m.originalLang, to: lang })
    });
    const j = await r.json();
    // Save whatever we got (even empty or same as original). This marks
    // the slot as "attempted" so we don't loop. pickDisplayText falls
    // back to m.original for empty/undefined entries.
    if (typeof j.translatedText === 'string') {
      m.translations[lang] = j.translatedText;
    } else {
      m.translations[lang] = ''; // mark as attempted but unavailable
    }
  } catch (e) {
    console.error('lazy translate fail', e);
    m.translations[lang] = ''; // mark to prevent re-fetch storm
  } finally {
    state.pendingTranslations.delete(m.id + '|' + lang);
  }
}

async function ensureAllTranslations(lang) {
  const tasks = state.messages
    .filter(m => !m.system && !hasValidTranslation(m, lang))
    .map(m => ensureTranslation(m, lang));
  if (tasks.length) await Promise.all(tasks);
}

// --- local cache: survive reconnects + faster first paint ---
const CACHE_PREFIX = 'chatCache:';
const CACHE_MAX = 200;
function cacheSave(room, messages) {
  try {
    const slice = messages.slice(-CACHE_MAX);
    localStorage.setItem(CACHE_PREFIX + room, JSON.stringify(slice));
  } catch (e) { /* quota or disabled */ }
}
function cacheLoad(room) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + room);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

// --- join room ---
function joinRoom() {
  const room = $('roomInput').value.trim().toUpperCase();
  const name = $('nameInput').value.trim();
  const displayLang = $('displayLang').value;

  // 房號限制：英數字 1-32 字（任何工地編號、棟層戶別皆可，不再限制長度）
  if (!/^[A-Z0-9]{1,32}$/.test(room)) {
    alert('房號只能是英文字母和數字（最多 32 字）');
    return;
  }
  if (!name) {
    alert('請輸入你的名字');
    return;
  }

  // persist for next visit
  try {
    localStorage.setItem('chatName', name);
    localStorage.setItem('chatRoom', room);
    localStorage.setItem('chatDisplayLang', displayLang);
  } catch (e) { /* ignore quota errors */ }

  state.room = room;
  state.name = name;
  state.displayLang = displayLang;

  $('loginPanel').classList.add('hidden');
  $('chatPanel').classList.remove('hidden');
  $('roomDisplay').textContent = room;
  $('meName').textContent = name;
  setDisplayLangUI();
  $('messageInput').focus();

  connect();
}

// --- 返回首頁（離開當前房號，回到登入畫面） ---
function leaveRoom() {
  // 關閉 WebSocket
  if (state.ws) {
    try { state.ws.close(); } catch (e) { /* ignore */ }
    state.ws = null;
  }
  state.room = null;
  state.name = null;
  state.messages = [];
  // 切換面板
  $('chatPanel').classList.add('hidden');
  $('loginPanel').classList.remove('hidden');
  $('statusLine').textContent = '連線中…';
  // 清空訊息列表
  const list = $('messageList');
  if (list) list.innerHTML = '';
}

function connect() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${proto}//${location.host}`;
  setStatus('連線中…');

  try {
    state.ws = new WebSocket(url);
  } catch (e) {
    setStatus('連線失敗，5 秒後重試', 'error');
    scheduleReconnect();
    return;
  }

  state.ws.onopen = () => {
    state.reconnectAttempts = 0;
    setStatus('已連線', 'connected');
    // Paint cached history immediately so the user has context
    const cached = cacheLoad(state.room);
    if (cached.length && state.messages.length === 0) {
      state.messages = cached;
      renderMessages();
      setStatus('已連線（顯示本機快取）', 'connected');
    }
    state.ws.send(JSON.stringify({
      type: 'join',
      room: state.room,
      name: state.name,
      displayLang: state.displayLang,
      typingLang: state.typingLang
    }));
  };

  state.ws.onmessage = async (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    if (msg.type === 'history') {
      state.messages = msg.messages || [];
      cacheSave(state.room, state.messages);
      // Fill missing translations for current display language
      await ensureAllTranslations(state.displayLang);
      renderMessages();
      scrollToBottom();
    } else if (msg.type === 'message') {
      state.messages.push(msg.message);
      cacheSave(state.room, state.messages);
      // Lazy-fill translation if needed
      if (!msg.message.system) {
        ensureTranslation(msg.message, state.displayLang).then(() => {
          cacheSave(state.room, state.messages);
          renderMessages();
        });
      }
      renderMessages();
      scrollToBottom();
    } else if (msg.type === 'presence') {
      addSystemMessage(msg.text);
    } else if (msg.type === 'system') {
      addSystemMessage(msg.text);
    }
  };

  state.ws.onerror = () => {
    setStatus('連線錯誤', 'error');
  };

  state.ws.onclose = () => {
    setStatus('已斷線，3 秒後重連…', 'error');
    scheduleReconnect();
  };
}

function scheduleReconnect() {
  state.reconnectAttempts++;
  const delay = Math.min(2000 * state.reconnectAttempts, 10000);
  setTimeout(() => {
    if (state.room) connect();
  }, delay);
}

function addSystemMessage(text) {
  state.messages.push({ id: 'sys-' + Date.now(), system: true, text, ts: Date.now() });
  renderMessages();
  scrollToBottom();
}

// --- translation ---
async function callTranslate(text, from, to) {
  if (from === to) return text;
  try {
    const r = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, from, to })
    });
    const j = await r.json();
    return j.translatedText || text;
  } catch (e) {
    console.error('translate fail', from, '->', to, e);
    return text;
  }
}

async function translateToAll(text, from) {
  const out = { [from]: text };
  const targets = ['en', 'id', 'zh-TW'].filter((l) => l !== from);
  await Promise.all(targets.map(async (to) => {
    out[to] = await callTranslate(text, from, to);
  }));
  return out;
}

// --- auto-detect source language ---
// zh-TW if CJK present, id if common Indonesian words present, otherwise en
const ID_HINTS = [
  // pronouns & people
  'saya','aku','kamu','kamu','dia','kami','kita','mereka','beliau','anda','pak','bu','mas','mbak','bapak','ibu','om','tante','kakak','adik','suami','istri','anak','teman','orang',
  // question words
  'apa','siapa','mana','kapan','dimana','kemana','darimana','mengapa','kenapa','gimana','bagaimana','berapa','yang','mana','kapan','dimana',
  // common verbs
  'adalah','yaitu','akan','sudah','belum','sedang','masih','telah','sedang','pernah','bisa','dapat','boleh','harus','mau','ingin','makan','minum','tidur','pergi','datang','lihat','dengar','bicara','bilang','kata','pikir','rasa','tahu','tidak','bukan','ada','jadi','mau','mulai','selesai','coba','bantu','tolong','pakai','ambil','kasih','beri','cari','temu','jumpa','kenal','tanya','jawab','panggil','masuk','keluar','naik','turun','duduk','berdiri','jalan','lari','buka','tutup','cuci','bersih','tulis','baca','kirim','terima','beli','jual','bayar','pinjam','simpan','bawa','taruh','pindah','tinggal','tinggal','pulang','naik','turun',
  // function words
  'yang','dan','atau','tapi','tetapi','kalau','jika','bila','ketika','saat','waktu','setelah','sebelum','sambil','sementara','supaya','agar','karena','sebab','akibat','untuk','bagi','dengan','tanpa','pada','dari','ke','di','ini','itu','sini','situ','sana','mana','begitu','demikian','begini','jadi','lalu','kemudian','sekarang','tadi','nanti','besok','kemarin','hari','minggu','bulan','tahun','jam','menit','detik','pagi','siang','malam','subuh','sore',
  // adjectives & misc
  'baik','buruk','besar','kecil','baru','lama','tinggi','rendah','jauh','dekat','panjang','pendek','banyak','sedikit','semua','beberapa','satu','dua','tiga','empat','lima','enam','tujuh','delapan','sembilan','sepuluh','seratus','seribu','juta','pertama','kedua','terakhir','benar','salah','mudah','sulit','bagus','hebat','cantik','jelek','murah','mahal','cepat','lambat','keras','lunak','panas','dingin','hangat','sejuk','basah','kering','penuh','kosong','terbuka','tertutup','sama','berbeda','lain','rumah','sekolah','kantor','jalan','mobil','motor','sepeda','pesawat','kapal','kereta','bis','uang','makan','minum','makanan','minuman','air','api','tanah','udara','langit','matahari','bulan','bintang','hujan','angin','awan','tanah','laut','sungai','gunung','hutan','kota','desa','negara','dunia',
  // common greetings
  'halo','hai','selamat','apa','kabar','terima','kasih','maaf','permisi','tolong','ya','tidak','mungkin','benar','betul','sama','selamat','pagi','siang','malam','sore','datang','pergi','pulang','sampai','bertemu','jumpa','salam','sehat','sejahtera',
  // particles & connectors
  'sih','dong','deh','kok','kan','lah','kah','nya','pun','per','para'
];
function autoDetectLang(text) {
  if (/[一-鿿]/.test(text)) return 'zh-TW';
  const lower = text.toLowerCase();
  let idScore = 0, enScore = 0;
  for (const w of ID_HINTS) {
    if (w.length < 2) continue;
    const re = new RegExp('\\b' + w + '\\b', 'gi');
    const m = lower.match(re);
    if (m) idScore += m.length * w.length; // longer words = stronger signal
  }
  for (const w of ['the','is','are','was','were','i','you','he','she','we','they','and','or','but','please','thank','hello','hi','yes','no','can','will','would','could','should','have','has','had','do','does','did','not','what','when','where','who','why','how','this','that','these','those','because','about','from','with','into','over','under','after','before','between','through','during','until','while','than','then','also','just','only','very','really','much','many','some','any','all','most','more','less','such','same','different','other','another','first','second','last','next','new','old','good','bad','big','small','long','short','high','low','far','near','easy','hard','fast','slow','hot','cold','full','empty','right','left','up','down','here','there']) {
    const re = new RegExp('\\b' + w + '\\b', 'gi');
    const m = lower.match(re);
    if (m) enScore += m.length;
  }
  if (idScore > enScore && idScore > 0) return 'id';
  if (enScore > 0) return 'en';
  // fallback: pure ascii → en, else zh-TW
  return /^[A-Za-z0-9\s\.,!\?\-'"()]+$/.test(text) ? 'en' : 'zh-TW';
}

// --- send ---
async function sendMessage() {
  const input = $('messageInput');
  const text = input.value.trim();
  if (!text) return;
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    setStatus('尚未連線，無法送出', 'error');
    return;
  }

  input.value = '';
  autoGrowTextarea(input);
  const from = autoDetectLang(text);
  // Translate first to other langs, send all 3 versions
  let translations = { [from]: text };
  if (text.length <= 1500) {
    try {
      translations = await translateToAll(text, from);
    } catch (e) {
      console.error('pre-translate fail', e);
    }
  }

  state.ws.send(JSON.stringify({
    type: 'send',
    original: text,
    originalLang: from,
    translations
  }));
}

// auto-grow textarea: 1 -> up to 5 lines
function autoGrowTextarea(el) {
  el.style.height = 'auto';
  const lineH = 22; // ~ font-size 16 * line-height 1.4
  const maxH = lineH * 5 + 24;
  const newH = Math.min(el.scrollHeight, maxH);
  el.style.height = newH + 'px';
  el.style.overflowY = el.scrollHeight > maxH ? 'auto' : 'hidden';
}

// --- render ---
function pickDisplayText(m) {
  // display in user's display language; fall back to original
  return m.translations[state.displayLang] || m.original;
}

function renderMessages() {
  const list = $('messageList');
  list.innerHTML = '';
  for (const m of state.messages) {
    if (m.system) {
      const div = document.createElement('div');
      div.className = 'message system';
      div.textContent = m.text;
      list.appendChild(div);
      continue;
    }
    const isMine = m.from === state.name;
    const div = document.createElement('div');
    div.className = 'message' + (isMine ? ' mine' : '');

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${m.from} · ${formatTime(m.ts)}`;

    const textEl = document.createElement('div');
    textEl.className = 'text';
    const showingOrig = state.showOriginal.has(m.id);
    textEl.textContent = showingOrig ? m.original : pickDisplayText(m);

    const btn = document.createElement('button');
    btn.className = 'toggle-original';
    btn.textContent = showingOrig ? '翻譯' : '原文 (' + (LANG_LABELS[m.originalLang]?.short || m.originalLang) + ')';
    btn.onclick = () => {
      if (state.showOriginal.has(m.id)) state.showOriginal.delete(m.id);
      else state.showOriginal.add(m.id);
      renderMessages();
    };

    div.appendChild(meta);
    div.appendChild(textEl);
    div.appendChild(btn);
    list.appendChild(div);
  }
}

function scrollToBottom() {
  const list = $('messageList');
  requestAnimationFrame(() => {
    list.scrollTop = list.scrollHeight;
  });
}

// --- wire up ---
document.addEventListener('DOMContentLoaded', () => {
  $('joinBtn').addEventListener('click', joinRoom);
  $('leaveBtn').addEventListener('click', leaveRoom);
  $('roomInput').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
  });
  $('sendForm').addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage();
  });
  const input = $('messageInput');
  input.addEventListener('input', () => autoGrowTextarea(input));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      sendMessage();
    }
  });
  // (typing-lang toggle removed; auto-detect on send)
  document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const lang = btn.dataset.lang;
    if (!lang || lang === state.displayLang) return;
    setStatus('切換中，翻譯中…');
    state.displayLang = lang;
    setDisplayLangUI();
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(JSON.stringify({ type: 'setLang', displayLang: state.displayLang }));
    }
    // Re-translate any missing translations on demand, then re-render
    await ensureAllTranslations(lang);
    renderMessages();
    setStatus('已連線', 'connected');
    try { localStorage.setItem('chatDisplayLang', state.displayLang); } catch (e) {}
  });
});

  // restore name + room from localStorage (and accept ?room=XXX in URL for fixed rooms)
  const urlRoom = new URLSearchParams(location.search).get('room');
  const savedName = localStorage.getItem('chatName');
  const savedRoom = localStorage.getItem('chatRoom');
  const savedDisplay = localStorage.getItem('chatDisplayLang');
  const savedTyping = localStorage.getItem('chatTypingLang');

  if (savedName) $('nameInput').value = savedName;
  if (savedRoom) $('roomInput').value = savedRoom;
  if (urlRoom) $('roomInput').value = urlRoom.toUpperCase();
  if (savedDisplay && ['en', 'id', 'zh-TW'].includes(savedDisplay)) $('displayLang').value = savedDisplay;
  if (savedDisplay && ['en', 'id', 'zh-TW'].includes(savedDisplay)) {
    state.displayLang = savedDisplay;
  }

  // show hint if room is pre-filled
  const hintEl = $('roomHint');
  if (hintEl && $('roomInput').value) {
    hintEl.textContent = '✓ 已自動帶入上次房號';
    hintEl.style.display = 'block';
  }

  // focus first empty field for fast entry
  if (!$('nameInput').value) $('nameInput').focus();
  else if (!$('roomInput').value) $('roomInput').focus();
  else $('joinBtn').focus();

  $('nameInput').addEventListener('change', () => {
    localStorage.setItem('chatName', $('nameInput').value.trim());
  });
  $('roomInput').addEventListener('change', () => {
    localStorage.setItem('chatRoom', $('roomInput').value.trim().toUpperCase());
  });
});
