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

function setTypingLangButton() {
  const btn = $('typingLangBtn');
  btn.textContent = LANG_LABELS[state.typingLang].short;
  btn.title = '目前打字的語言: ' + LANG_LABELS[state.typingLang].long + '（點擊切換）';
}

function setDisplayLangUI() {
  $('displayLangLive').value = state.displayLang;
}

// --- join room ---
function joinRoom() {
  const room = $('roomInput').value.trim().toUpperCase();
  const name = $('nameInput').value.trim();
  const displayLang = $('displayLang').value;
  const typingLang = $('typingLang').value;

  if (!/^[A-Z0-9]{4,8}$/.test(room)) {
    alert('房號必須是 4-8 個英文字母或數字');
    return;
  }
  if (!name) {
    alert('請輸入你的名字');
    return;
  }

  state.room = room;
  state.name = name;
  state.displayLang = displayLang;
  state.typingLang = typingLang;

  $('loginPanel').classList.add('hidden');
  $('chatPanel').classList.remove('hidden');
  $('roomDisplay').textContent = room;
  $('meName').textContent = name;
  setDisplayLangUI();
  setTypingLangButton();
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

  state.ws.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    if (msg.type === 'history') {
      state.messages = msg.messages || [];
      renderMessages();
      scrollToBottom();
    } else if (msg.type === 'message') {
      state.messages.push(msg.message);
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
  const from = state.typingLang;
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
  $('messageInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      sendMessage();
    }
  });
  $('typingLangBtn').addEventListener('click', () => {
    const order = ['zh-TW', 'en', 'id'];
    const i = order.indexOf(state.typingLang);
    state.typingLang = order[(i + 1) % order.length];
    setTypingLangButton();
  });
  $('displayLangLive').addEventListener('change', (e) => {
    state.displayLang = e.target.value;
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(JSON.stringify({ type: 'setLang', displayLang: state.displayLang }));
    }
    renderMessages();
  });

  // restore name from localStorage
  const saved = localStorage.getItem('chatName');
  if (saved) $('nameInput').value = saved;

  $('nameInput').addEventListener('change', () => {
    localStorage.setItem('chatName', $('nameInput').value.trim());
  });
});
