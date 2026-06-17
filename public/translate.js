// Translate page - simple paste-text-translate
const $ = (id) => document.getElementById(id);

const LANG_HINTS = {
  'zh-TW': ['的', '是', '我', '你', '他', '了', '在', '有'],
  en: ['the', 'is', 'i', 'you', 'he', 'and', 'to', 'a'],
  id: ['saya', 'anda', 'yang', 'tidak', 'untuk', 'dengan', 'ada', 'halo']
};

function autoDetect(text) {
  // cheap heuristic: which language has the highest hit ratio of common words
  const lower = text.toLowerCase();
  let best = 'en';
  let bestScore = 0;
  for (const [lang, words] of Object.entries(LANG_HINTS)) {
    let score = 0;
    for (const w of words) {
      const re = new RegExp('\\b' + w + '\\b', 'gi');
      const m = lower.match(re);
      if (m) score += m.length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = lang;
    }
  }
  // chinese: presence of CJK
  if (/[一-鿿]/.test(text)) return 'zh-TW';
  return best;
}

async function translate() {
  const src = $('srcText').value.trim();
  if (!src) return;
  let from = $('fromLang').value;
  const to = $('toLang').value;
  if (from === 'auto') from = autoDetect(src);
  $('translateStatus').textContent = `偵測語言: ${from} → ${to}，翻譯中…`;
  $('dstText').value = '';

  try {
    const r = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: src, from, to })
    });
    const j = await r.json();
    if (j.error) {
      $('translateStatus').textContent = '翻譯失敗: ' + j.error;
    } else {
      $('dstText').value = j.translatedText;
      $('translateStatus').textContent = '完成';
    }
  } catch (e) {
    $('translateStatus').textContent = '錯誤: ' + e.message;
  }
}

function swap() {
  const a = $('fromLang').value;
  const b = $('toLang').value;
  $('fromLang').value = b;
  $('toLang').value = a;
  $('srcText').value = $('dstText').value;
  $('dstText').value = '';
}

function copy() {
  const dst = $('dstText').value;
  if (!dst) return;
  navigator.clipboard.writeText(dst).then(() => {
    $('translateStatus').textContent = '已複製到剪貼簿';
  }).catch(() => {
    $('translateStatus').textContent = '複製失敗，請手動選取';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  $('translateBtn').addEventListener('click', translate);
  $('swapBtn').addEventListener('click', swap);
  $('copyBtn').addEventListener('click', copy);
  $('srcText').addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      translate();
    }
  });
});
