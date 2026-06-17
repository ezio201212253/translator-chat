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

// --- join room ---
function joinRoom() {
  const room = $('roomInput').value.trim().toUpperCase();
  const name = $('nameInput').value.trim();
  const displayLang = $('displayLang').value;

  if (!/^[A-Z0-9]{4,8}$/.test(room)) {
    alert('房號必須是 4-8 個英文字母或數字');
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
      // Fill missing translations for current display language
      await ensureAllTranslations(state.displayLang);
      renderMessages();
      scrollToBottom();
    } else if (msg.type === 'message') {
      state.messages.push(msg.message);
      // Lazy-fill translation if needed
      if (!msg.message.system) {
        ensureTranslation(msg.message, state.displayLang).then(() => renderMessages());
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
const ID_HINTS = ['saya','anda','yang','tidak','untuk','dengan','ada','halo','baik','benar','salah','bisa','akan','sudah','belum','mau','makan','rumah','kerja','hari','ini','itu','kami','kita','mereka','dia','pak','bu','mas','mbak','bapak','ibu','selamat','pagi','siang','malam','terima','kasih','maaf','tolong','bantu','bukan','ya','tidak'];
function autoDetectLang(text) {
  if (/[一-鿿]/.test(text)) return 'zh-TW';
  const lower = text.toLowerCase();
  let idScore = 0, enScore = 0;
  for (const w of ID_HINTS) {
    const re = new RegExp('\\b' + w + '\\b', 'gi');
    const m = lower.match(re);
    if (m) idScore += m.length;
  }
  // common English function words
  for (const w of ['the','is','are','was','were','i','you','he','she','we','they','and','or','but','please','thank','hello','hi','yes','no','can','will','would','could','should','have','has','had','do','does','did','not']) {
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
