// 广播字幕：监听音频引擎的 gz-audio-caption 事件，显示当前片段的文字和语言标记。
export const HOLD_MS = 2500;
const BADGE = { zh: '普', yue: '粤', nan: '闽', en: 'EN' };
export function initCaptions() {
  const el = document.getElementById('caption'), langEl = el.querySelector('.lang'), textEl = el.querySelector('.text');
  let hideTimer = null;
  window.addEventListener('gz-audio-caption', e => {
    const d = e.detail;
    clearTimeout(hideTimer);
    // 一段播完（null）→ 再留 2.5 秒就收起；没等到 null（音频回调丢了 / 被别的打断）→ 按片段时长 + 3 秒兜底收起
    if (!d) { hideTimer = setTimeout(() => { el.hidden = true; }, HOLD_MS); return; }
    hideTimer = setTimeout(() => { el.hidden = true; }, (d.ms || 6000) + 3000);
    langEl.textContent = BADGE[d.lang] || d.lang;
    textEl.textContent = d.text;
    el.classList.toggle('silent', !!d.silent);
    el.hidden = false;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  });
}
