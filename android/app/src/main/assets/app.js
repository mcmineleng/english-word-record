/* =========================================================
 *  常量
 * ========================================================= */
const POS_MAP = {
  n: '名词', v: '动词', adj: '形容词', adv: '副词',
  prep: '介词', pron: '代词', conj: '连词', num: '数词',
  art: '冠词', int: '感叹词', aux: '助动词', abbr: '缩写',
  vt: '及物动词', vi: '不及物动词', modal: '情态动词',
  det: '限定词', pl: '复数', phr: '短语'
};

const SORT_OPTIONS = [
  { value: 'config',      label: '配置顺序' },
  { value: 'text-az',     label: 'A → Z' },
  { value: 'text-za',     label: 'Z → A' },
  { value: 'random',      label: '随机' },
  { value: 'ok-desc',     label: '正确最多',   icon: 'ok' },
  { value: 'ok-asc',      label: '正确最少',   icon: 'ok' },
  { value: 'err-desc',    label: '错误最多',   icon: 'err' },
  { value: 'err-asc',     label: '错误最少',   icon: 'err' },
  { value: 'mastery-desc',label: '掌握度 高→低',  icon: 'scale' },
  { value: 'mastery-asc', label: '掌握度 低→高',  icon: 'scale' },
];

/* =========================================================
 *  工具
 * ========================================================= */
function h(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') { el.className = v; continue; }
    if (k === 'text')  { el.textContent = v; continue; }
    if (k === 'html')  { el.innerHTML = v; continue; }
    if (k === 'style') {
      if (typeof v === 'string') el.style.cssText = v;
      else if (typeof v === 'object') Object.assign(el.style, v);
      continue;
    }
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v);
      continue;
    }
    // 快路径：标准 property 直接赋值
    if (k in el) {
      try { el[k] = v; continue; } catch {}
    }
    el.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

function svg(path, opts = {}) {
  const ns = 'http://www.w3.org/2000/svg';
  const el = document.createElementNS(ns, 'svg');
  el.setAttribute('viewBox', '0 0 24 24');
  el.setAttribute('fill', opts.fill || 'none');
  el.setAttribute('stroke', opts.stroke || 'currentColor');
  el.setAttribute('stroke-width', opts.strokeWidth || '2');
  el.setAttribute('stroke-linecap', 'round');
  el.setAttribute('stroke-linejoin', 'round');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', path);
  el.appendChild(p);
  return el;
}

function iconOk()   { return svg('M4 12.5l5 5L20 6.5', { strokeWidth: '2.6' }); }
function iconErr()  { return svg('M6 6l12 12M18 6L6 18', { strokeWidth: '2.6' }); }
function iconScale(){ return svg('M3 17l6-6 4 4 8-8M21 7v5h-5', { strokeWidth: '2' }); }
function iconMore() { return svg('M12 5.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z', { fill: 'currentColor', stroke: 'none' }); }
function iconLocate() { return svg('M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z', { fill: 'currentColor', stroke: 'none' }); }
function sortIcon(kind) {
  if (kind === 'ok')    return iconOk();
  if (kind === 'err')   return iconErr();
  if (kind === 'scale') return iconScale();
  return null;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}

/* —— 通用的带关闭动画的移除（全 inline 控制，不依赖 .closing 类） —— */
function animateRemove(el, className, fallback = 300) {
  if (!el || el._removing) return;
  el._removing = true;

  const cs = getComputedStyle(el);
  const startOpacity = cs.opacity;
  const startTransform = cs.transform;

  el.style.animation = 'none';
  el.style.transition = 'none';
  el.style.opacity = startOpacity;
  el.style.transform = startTransform;

  void el.offsetWidth;

  requestAnimationFrame(() => {
    el.style.transition = 'opacity .2s cubic-bezier(0.25, 1, 0.5, 1), transform .24s cubic-bezier(0.25, 1, 0.5, 1)';
    el.style.opacity = '0';
    el.style.transform = 'scale(.7) translateY(6px)';
  });

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    el.remove();
  };
  el.addEventListener('transitionend', finish, { once: true });
  setTimeout(finish, fallback);
}

/* =========================================================
 *  宽松匹配（子序列 + 打分）
 * ========================================================= */
function looseMatch(query, target) {
  if (!query) return { matched: true, score: 0 };
  if (!target) return { matched: false, score: 0 };
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  const idx = t.indexOf(q);
  if (idx >= 0) {
    let score = 1000 - idx * 2;
    if (t === q) score += 500;
    else if (idx === 0) score += 200;
    return { matched: true, score };
  }

  let ti = 0, score = 0, streak = 0, firstHit = -1;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    let found = -1;
    for (let k = ti; k < t.length; k++) {
      if (t[k] === ch) { found = k; break; }
    }
    if (found < 0) return { matched: false, score: 0 };
    if (firstHit < 0) firstHit = found;
    if (found === ti && qi > 0 && t[found - 1] === q[qi - 1]) {
      streak++;
      score += 10 + streak * 2;
    } else {
      streak = 0;
      score += 3;
    }
    ti = found + 1;
  }
  score += Math.max(0, 100 - firstHit * 3);
  score -= q.length * 0.5;
  return { matched: true, score };
}

function matchWord(word, query) {
  if (!query) return { matched: true, score: 0 };
  let best = -Infinity;
  const tryField = (text, weight) => {
    const r = looseMatch(query, text);
    if (r.matched) {
      const s = r.score + weight;
      if (s > best) best = s;
    }
  };
  tryField(word.text, 100);
  if (word.phonetic) tryField(word.phonetic, 20);
  for (const pos of Object.keys(word.paras)) {
    tryField(word.paras[pos].text, 30);
    tryField(POS_MAP[pos] || pos, 10);
  }
  return best === -Infinity
    ? { matched: false, score: 0 }
    : { matched: true, score: best };
}

/* =========================================================
 *  Toast / Dialog
 * ========================================================= */
let toastEl = null;
function toast(msg) {
  if (toastEl) toastEl.remove();
  toastEl = h('div', { class: 'toast', text: msg });
  document.body.appendChild(toastEl);
  requestAnimationFrame(() => toastEl.classList.add('show'));
  setTimeout(() => {
    if (!toastEl) return;
    toastEl.classList.remove('show');
    setTimeout(() => { toastEl && toastEl.remove(); toastEl = null; }, 250);
  }, 1800);
}

function dialog({ title, body, actions }) {
  return new Promise(resolve => {
    const scrim = h('div', { class: 'dialog-scrim' });
    const box = h('div', { class: 'dialog' });
    box.appendChild(h('h3', { text: title }));
    box.appendChild(h('div', { class: 'body', html: body || '' }));
    const actWrap = h('div', { class: 'actions' });
    actions.forEach(a => {
      const btn = h('button', {
        class: 'btn' + (a.primary ? ' primary' : ''),
        text: a.label,
        onclick: () => { close(); resolve(a.value); }
      });
      actWrap.appendChild(btn);
    });
    box.appendChild(actWrap);
    scrim.appendChild(box);
    document.body.appendChild(scrim);
    function close() { scrim.remove(); }
  });
}

/* =========================================================
 *  自定义下拉
 * ========================================================= */
let openMenu = null;
function closeSelectMenu() {
  if (openMenu) {
    const el = openMenu;
    openMenu = null;
    animateRemove(el, 'closing', 240);
  }
  document.removeEventListener('click', onDocClick, true);
}
function onDocClick(e) {
  if (openMenu && !openMenu.contains(e.target) && !openMenu._anchor.contains(e.target)) closeSelectMenu();
}

function createSelect({ options, value, onChange, class: cls = '', width }) {
  const el = h('div', { class: 'select ' + cls });
  if (width) el.style.maxWidth = width;
  const label = h('span', { class: 'label' });
  el.appendChild(label);
  el._value = value;
  el._options = options;

  function updateLabel() {
    label.innerHTML = '';
    const opt = el._options.find(o => o.value === el._value);
    if (!opt) return;
    const ic = sortIcon(opt.icon);
    if (ic) label.appendChild(ic);
    label.appendChild(document.createTextNode(opt.label));
  }
  updateLabel();

  el.addEventListener('click', e => {
    e.stopPropagation();
    if (openMenu && openMenu._anchor === el) { closeSelectMenu(); return; }
    closeSelectMenu();
    const menu = h('div', { class: 'select-menu' });
    menu._anchor = el;
    for (const o of el._options) {
      const item = h('div', {
        class: 'item' + (o.value === el._value ? ' active' : '')
      });
      const ic = sortIcon(o.icon);
      if (ic) item.appendChild(ic);
      item.appendChild(h('span', { text: o.label }));
      item.addEventListener('click', () => {
        el._value = o.value;
        updateLabel();
        closeSelectMenu();
        onChange && onChange(o.value);
      });
      menu.appendChild(item);
    }
    document.body.appendChild(menu);
    const r = el.getBoundingClientRect();
    menu.style.left = r.left + 'px';
    menu.style.top = (r.bottom + 6) + 'px';
    menu.style.minWidth = r.width + 'px';
    if (r.bottom + 6 + menu.offsetHeight > window.innerHeight - 8) {
      menu.style.top = (r.top - menu.offsetHeight - 6) + 'px';
    }
    openMenu = menu;
    setTimeout(() => document.addEventListener('click', onDocClick, true), 0);
  });

  el.setValue = v => { el._value = v; updateLabel(); };
  el.getValue = () => el._value;
  el.setOptions = opts => { el._options = opts; updateLabel(); };
  return el;
}

/* =========================================================
 *  OPFS
 * ========================================================= */
let opfsRoot = null;
async function initOPFS() {
  if (!navigator.storage || !navigator.storage.getDirectory) return null;
  try { opfsRoot = await navigator.storage.getDirectory(); return opfsRoot; }
  catch { return null; }
}
async function ensureDir(name) { return await opfsRoot.getDirectoryHandle(name, { create: true }); }
async function writeFile(dir, name, text) {
  const d = await ensureDir(dir);
  const fh = await d.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(text); await w.close();
}
async function readFile(dir, name) {
  try {
    const d = await opfsRoot.getDirectoryHandle(dir);
    const fh = await d.getFileHandle(name);
    return await (await fh.getFile()).text();
  } catch { return null; }
}
async function removeFile(dir, name) {
  try { const d = await opfsRoot.getDirectoryHandle(dir); await d.removeEntry(name); } catch {}
}
async function listFiles(dir) {
  try {
    const d = await opfsRoot.getDirectoryHandle(dir);
    const out = [];
    for await (const [name, h] of d.entries()) if (h.kind === 'file') out.push(name);
    return out;
  } catch { return []; }
}
async function writeFileRoot(name, text) {
  const fh = await opfsRoot.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(text); await w.close();
}
async function readFileRoot(name) {
  try {
    const fh = await opfsRoot.getFileHandle(name);
    return await (await fh.getFile()).text();
  } catch { return null; }
}

/* =========================================================
 *  TOML
 * ========================================================= */
function parseTOML(text) {
  const root = {};
  let current = root;
  for (let raw of text.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('[') && line.endsWith(']')) {
      let path = line.slice(1, -1).trim();
      const isArray = path.startsWith('[') && path.endsWith(']');
      if (isArray) path = path.slice(1, -1).trim();
      const parts = splitPath(path);
      let node = root;
      for (let i = 0; i < parts.length; i++) {
        const key = parts[i];
        const isLast = i === parts.length - 1;
        if (isLast && isArray) {
          if (!node[key]) node[key] = [];
          else if (!Array.isArray(node[key])) node[key] = [node[key]];
          const obj = {};
          node[key].push(obj);
          current = obj;
        } else {
          if (!node[key]) node[key] = {};
          node = node[key];
          if (isLast) current = node;
        }
      }
      continue;
    }
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    current[key] = parseValue(line.slice(eq + 1).trim());
  }
  return root;
}
function splitPath(p) {
  const out = []; let cur = ''; let inQ = false;
  for (const ch of p) {
    if (ch === '"') { inQ = !inQ; cur += ch; continue; }
    if (ch === '.' && !inQ) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.map(s => s.replace(/^"|"$/g, ''));
}
function parseValue(v) {
  if (v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1).replace(/\\"/g, '"');
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
  if (v === 'true') return true;
  if (v === 'false') return false;
  const n = Number(v);
  if (!isNaN(n) && v !== '') return n;
  if (v.startsWith('[') && v.endsWith(']'))
    return v.slice(1, -1).split(',').map(s => parseValue(s.trim())).filter(x => x !== '');
  return v;
}
function toTOML(obj) {
  let out = '';
  function walk(o, path) {
    const keys = Object.keys(o);
    const scalars = keys.filter(k => typeof o[k] !== 'object' || o[k] === null);
    const objs = keys.filter(k => typeof o[k] === 'object' && o[k] !== null && !Array.isArray(o[k]));
    const arrays = keys.filter(k => Array.isArray(o[k]));
    for (const k of scalars) out += `${k} = ${fmtVal(o[k])}\n`;
    for (const k of objs) {
      const p = [...path, k];
      out += `\n[${p.join('.')}]\n`;
      walk(o[k], p);
    }
    for (const k of arrays) for (const item of o[k]) {
      const p = [...path, k];
      out += `\n[[${p.join('.')}]]\n`;
      walk(item, p);
    }
  }
  walk(obj, []);
  return out.trim() + '\n';
}
function fmtVal(v) {
  if (typeof v === 'string') return `"${v.replace(/"/g, '\\"')}"`;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  return `"${String(v)}"`;
}

/* =========================================================
 *  数据
 * ========================================================= */
let state = { books: [], currentUuid: null, counts: {}, settings: { sort: 'text-az' }, search: '' };

function normalizeBook(parsed) {
  const metadata = parsed.metadata || {};
  const uuid = metadata.uuid || genUuid();
  const words = [];
  if (parsed.word) {
    const keys = Object.keys(parsed.word).sort((a,b) => {
      const na = Number(a), nb = Number(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return String(a).localeCompare(String(b));
    });
    for (const key of keys) {
      let arr = parsed.word[key];
      if (!Array.isArray(arr)) arr = [arr];
      for (const w of arr) {
        const word = { key, text: w.text || '', phonetic: w.phonetic || '', paras: {} };
        if (w.para) for (const pos of Object.keys(w.para)) {
          let p = w.para[pos];
          if (Array.isArray(p)) p = p[0] || {};
          word.paras[pos] = { text: p.text || '' };
        }
        words.push(word);
      }
    }
  }
  return { uuid, metadata: { ...metadata, uuid }, words };
}

function bookToTOML(book) {
  const obj = {
    metadata: { uuid: book.uuid, name: book.metadata.name || '', level: book.metadata.level || '', desc: book.metadata.desc || '' },
    word: {}
  };
  for (const w of book.words) {
    const wobj = { text: w.text };
    if (w.phonetic) wobj.phonetic = w.phonetic;
    if (Object.keys(w.paras).length) {
      wobj.para = {};
      for (const pos of Object.keys(w.paras)) wobj.para[pos] = { text: w.paras[pos].text };
    }
    obj.word[w.key] = wobj;
  }
  return toTOML(obj);
}
function genUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
function wordToJSON(w) {
  return JSON.stringify({ text: w.text, phonetic: w.phonetic, paras: w.paras });
}

async function loadAll() {
  const s = await readFileRoot('settings.toml');
  if (s) {
    try {
      const p = parseTOML(s);
      if (p.sort) state.settings.sort = p.sort;
    } catch (e) { console.warn('settings.toml 解析失败', e); }
  }
  const files = await listFiles('word');
  state.books = [];
  for (const f of files) {
    if (!f.endsWith('.toml')) continue;
    const txt = await readFile('word', f);
    if (!txt) continue;
    try { state.books.push(normalizeBook(parseTOML(txt))); } catch (e) { console.warn(e); }
  }
  state.counts = {};
  for (const b of state.books) state.counts[b.uuid] = await loadCount(b.uuid);
  if (state.books.length && !state.books.find(b => b.uuid === state.currentUuid))
    state.currentUuid = state.books[0].uuid;
  if (!state.books.length) state.currentUuid = null;
}
async function loadCount(uuid) {
  const txt = await readFile('number', uuid + '.toml');
  const c = { success: {}, error: {} };
  if (txt) try {
    const p = parseTOML(txt);
    if (p.success) c.success = { ...p.success };
    if (p.error) c.error = { ...p.error };
  } catch {}
  return c;
}
async function saveCount(uuid) {
  const c = state.counts[uuid] || { success: {}, error: {} };
  await writeFile('number', uuid + '.toml', toTOML({ success: c.success, error: c.error }));
}
async function saveSettings() {
  await writeFileRoot('settings.toml', toTOML({ sort: state.settings.sort }));
}
async function saveBook(book) { await writeFile('word', book.uuid + '.toml', bookToTOML(book)); }

/* —— debounce 保存 —— */
const _saveTimers = new Map();
function scheduleSaveCount(uuid) {
  clearTimeout(_saveTimers.get(uuid));
  _saveTimers.set(uuid, setTimeout(() => {
    _saveTimers.delete(uuid);
    saveCount(uuid);
  }, 400));
}

/* =========================================================
 *  计数广播中心（消灭"多处真相"）
 * ========================================================= */
const countListeners = new Set();
function subscribeCount(fn) {
  countListeners.add(fn);
  return () => countListeners.delete(fn);
}
function emitCount(uuid, key, type, value) {
  for (const fn of countListeners) {
    try { fn(uuid, key, type, value); } catch (e) { console.error(e); }
  }
}

/* =========================================================
 *  排序
 * ========================================================= */
function getCurrentBook() { return state.books.find(b => b.uuid === state.currentUuid) || null; }
function getCount(uuid) {
  if (!state.counts[uuid]) state.counts[uuid] = { success: {}, error: {} };
  return state.counts[uuid];
}
function getSortedWords(book) {
  const words = [...book.words];
  const c = getCount(book.uuid);
  const sort = state.settings.sort;
  const ok = k => c.success[k] || 0;
  const er = k => c.error[k] || 0;
  const mastery = w => { const s = ok(w.key), e = er(w.key); return s + e === 0 ? -1 : s / (s + e); };
  switch (sort) {
    case 'config': break;
    case 'text-az': words.sort((a,b) => a.text.localeCompare(b.text)); break;
    case 'text-za': words.sort((a,b) => b.text.localeCompare(a.text)); break;
    case 'random': shuffle(words); break;
    case 'ok-desc': words.sort((a,b) => ok(b.key) - ok(a.key)); break;
    case 'ok-asc': words.sort((a,b) => ok(a.key) - ok(b.key)); break;
    case 'err-desc': words.sort((a,b) => er(b.key) - er(a.key)); break;
    case 'err-asc': words.sort((a,b) => er(a.key) - er(b.key)); break;
    case 'mastery-desc': words.sort((a,b) => mastery(b) - mastery(a)); break;
    case 'mastery-asc': words.sort((a,b) => mastery(a) - mastery(b)); break;
  }
  return words;
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }

function getVisibleWords(book) {
  const words = getSortedWords(book);
  const q = (state.search || '').trim();
  if (!q) return words;
  const scored = [];
  for (const w of words) {
    const r = matchWord(w, q);
    if (r.matched) scored.push({ w, score: r.score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map(x => x.w);
}

/* =========================================================
 *  标题滚动
 * ========================================================= */
const TITLE_MARQUEE_MAX_CHARS = 10;
const TITLE_SCROLL_SPEED = 45;
const TITLE_SCROLL_GAP = 60;
const TITLE_PAUSE_MS = 900;

let titleRaf = null;
let titleDocTimer = null;
let titleState = {
  raw: '',
  needScroll: false,
  offset: 0,
  last: 0,
  pauseUntil: 0,
  total: 0
};

function stopTitleScroll() {
  if (titleRaf) cancelAnimationFrame(titleRaf);
  titleRaf = null;
  if (titleDocTimer) clearInterval(titleDocTimer);
  titleDocTimer = null;
  titleState.offset = 0;
  titleState.pauseUntil = 0;
}

function setTitle(text) {
  stopTitleScroll();
  titleState.raw = text;

  els.titleInner.textContent = text;
  els.titleInner.style.transform = 'translateX(0)';
  document.title = text;

  requestAnimationFrame(() => {
    const wrap = els.titleEl;
    const inner = els.titleInner;
    const wrapW = wrap.clientWidth;
    const innerW = inner.scrollWidth;
    const charCount = [...text].length;

    const tooLongByChars = charCount > TITLE_MARQUEE_MAX_CHARS;
    const tooLongByPixels = innerW > wrapW;

    if (!tooLongByChars && !tooLongByPixels) {
      titleState.needScroll = false;
      startDocTitleScroll(text, false);
      return;
    }

    titleState.needScroll = true;
    titleState.total = innerW + TITLE_SCROLL_GAP;
    titleState.offset = 0;
    titleState.last = performance.now();
    titleState.pauseUntil = titleState.last + TITLE_PAUSE_MS;

    const tick = now => {
      const dt = now - titleState.last;
      titleState.last = now;

      if (now >= titleState.pauseUntil) {
        titleState.offset += (TITLE_SCROLL_SPEED * dt) / 1000;
        if (titleState.offset >= titleState.total) {
          titleState.offset = 0;
          titleState.pauseUntil = now + TITLE_PAUSE_MS;
        }
      }
      inner.style.transform = `translateX(${-titleState.offset}px)`;
      titleRaf = requestAnimationFrame(tick);
    };
    titleRaf = requestAnimationFrame(tick);

    startDocTitleScroll(text, true);
  });
}

function startDocTitleScroll(text, needScroll) {
  if (titleDocTimer) { clearInterval(titleDocTimer); titleDocTimer = null; }
  const chars = [...text];

  if (!needScroll || chars.length <= TITLE_MARQUEE_MAX_CHARS) {
    document.title = text;
    return;
  }

  const sep = '   ';
  const loop = [...chars, ...sep].join('');
  const loopChars = [...loop];

  let pos = 0;
  let paused = true;
  let pauseUntil = performance.now() + TITLE_PAUSE_MS;
  let last = performance.now();

  const charsPerSec = TITLE_SCROLL_SPEED / 12;

  titleDocTimer = setInterval(() => {
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;

    if (paused) {
      if (now >= pauseUntil) { paused = false; }
      else { return; }
    }

    pos += charsPerSec * dt;
    while (pos >= loopChars.length) pos -= loopChars.length;

    const windowLen = chars.length;
    let out = '';
    for (let i = 0; i < windowLen; i++) {
      out += loopChars[(Math.floor(pos) + i) % loopChars.length];
    }
    document.title = out;

    if (Math.floor(pos) === 0) {
      paused = true;
      pauseUntil = now + TITLE_PAUSE_MS;
    }
  }, 1000 / 30);
}

/* =========================================================
 *  ZIP（仅存储，无压缩）
 * ========================================================= */
function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function strToU8(s) { return new TextEncoder().encode(s); }

function makeZip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;

  const d = new Date();
  const dosTime = ((d.getHours() & 0x1F) << 11) | ((d.getMinutes() & 0x3F) << 5) | ((d.getSeconds() / 2) & 0x1F);
  const dosDate = (((d.getFullYear() - 1980) & 0x7F) << 9) | (((d.getMonth() + 1) & 0x0F) << 5) | (d.getDate() & 0x1F);

  for (const f of files) {
    const nameBytes = strToU8(f.name);
    const data = f.data;
    const crc = crc32(data);
    const size = data.length;

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    chunks.push(local, data);

    const centralEntry = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralEntry.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralEntry.set(nameBytes, 46);
    central.push(centralEntry);

    offset += local.length + data.length;
  }

  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const total = chunks.reduce((s, c) => s + c.length, 0) + centralSize + 22;
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of chunks) { out.set(c, p); p += c.length; }
  for (const c of central) { out.set(c, p); p += c.length; }
  out.set(end, p);
  return out;
}

function readU16(dv, off) { return dv.getUint16(off, true); }
function readU32(dv, off) { return dv.getUint32(off, true); }

function unzip(u8) {
  const files = {};
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let p = 0;
  while (p < u8.length - 4) {
    const sig = readU32(dv, p);
    if (sig === 0x04034b50) {
      const method = readU16(dv, p + 8);
      const compSize = readU32(dv, p + 18);
      const nameLen = readU16(dv, p + 26);
      const extraLen = readU16(dv, p + 28);
      const name = new TextDecoder().decode(u8.slice(p + 30, p + 30 + nameLen));
      const dataStart = p + 30 + nameLen + extraLen;
      const data = u8.slice(dataStart, dataStart + compSize);
      files[name] = data;
      p = dataStart + compSize;
    } else if (sig === 0x02014b50) {
      break;
    } else {
      p++;
    }
  }
  return files;
}

/* =========================================================
 *  导出 / 导入
 * ========================================================= */
function downloadBlob(data, filename, mime = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportBookOnly(book) {
  const text = bookToTOML(book);
  downloadBlob(text, (book.metadata.name || book.uuid) + '.toml', 'text/plain;charset=utf-8');
}

async function exportBookData(book) {
  const c = getCount(book.uuid);
  const text = toTOML({ success: c.success, error: c.error });
  downloadBlob(text, 'data.toml', 'text/plain;charset=utf-8');
}

async function exportBookBoth(book) {
  const wordToml = bookToTOML(book);
  const c = getCount(book.uuid);
  const dataToml = toTOML({ success: c.success, error: c.error });
  const files = [
    { name: 'word.toml', data: strToU8(wordToml) },
    { name: 'data.toml', data: strToU8(dataToml) }
  ];
  const zip = makeZip(files);
  downloadBlob(zip, (book.metadata.name || book.uuid) + '.zip', 'application/zip');
}

async function exportAll() {
  const files = [];
  const wordFiles = await listFiles('word');
  for (const f of wordFiles) {
    const txt = await readFile('word', f);
    if (txt != null) files.push({ name: 'word/' + f, data: strToU8(txt) });
  }
  const numFiles = await listFiles('number');
  for (const f of numFiles) {
    const txt = await readFile('number', f);
    if (txt != null) files.push({ name: 'number/' + f, data: strToU8(txt) });
  }
  if (!files.length) { toast('没有可导出的数据'); return; }
  const zip = makeZip(files);
  downloadBlob(zip, 'words-backup.zip', 'application/zip');
}

function detectTomlType(parsed) {
  if (parsed && parsed.metadata && (parsed.metadata.uuid || parsed.word)) return 'book';
  if (parsed && (parsed.success || parsed.error)) return 'data';
  return 'unknown';
}

async function importBookFromParsed(parsed, { allowMerge = true } = {}) {
  const incoming = normalizeBook(parsed);
  const existing = state.books.find(b => b.uuid === incoming.uuid);
  if (!existing) {
    state.books.push(incoming);
    state.counts[incoming.uuid] = { success: {}, error: {} };
    await saveBook(incoming); await saveCount(incoming.uuid);
    if (!state.currentUuid) state.currentUuid = incoming.uuid;
    toast('导入成功'); renderAll(); return;
  }
  const actions = [
    { label: '取消', value: 'cancel' },
    { label: '覆盖', value: 'overwrite' },
  ];
  if (allowMerge) actions.push({ label: '合并', value: 'merge', primary: true });
  else actions[1].primary = true;

  const choice = await dialog({
    title: 'UUID 冲突',
    body: `单词册「${escapeHtml(incoming.metadata.name || incoming.uuid)}」已存在。<br>请选择处理方式：`,
    actions
  });
  if (choice === 'cancel') return;
  if (choice === 'overwrite') {
    const idx = state.books.findIndex(b => b.uuid === incoming.uuid);
    state.books[idx] = incoming;
    await saveBook(incoming); toast('已覆盖'); renderAll(); return;
  }
  if (choice === 'merge') await mergeBooks(existing, incoming);
}

async function importDataFromParsed(parsed, targetUuid, { onlyOverwrite = true } = {}) {
  const c = { success: {}, error: {} };
  if (parsed.success) c.success = { ...parsed.success };
  if (parsed.error) c.error = { ...parsed.error };

  const existing = state.counts[targetUuid];
  if (existing && !onlyOverwrite) {
    for (const k of Object.keys(c.success)) existing.success[k] = (existing.success[k] || 0) + c.success[k];
    for (const k of Object.keys(c.error)) existing.error[k] = (existing.error[k] || 0) + c.error[k];
  } else {
    state.counts[targetUuid] = c;
  }
  await saveCount(targetUuid);
  toast('数据导入成功');
  renderAll();
}

async function importFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.zip')) {
    const buf = new Uint8Array(await file.arrayBuffer());
    let files;
    try { files = unzip(buf); }
    catch (e) { await dialog({ title: '导入失败', body: 'ZIP 解析失败：' + escapeHtml(e.message), actions: [{ label: '确定', value: 'ok', primary: true }] }); return; }

    let hasWord = false;
    let hasData = false;
    let wordParsed = null;
    let dataParsed = null;

    if (files['word.toml']) {
      try { wordParsed = parseTOML(new TextDecoder().decode(files['word.toml'])); hasWord = true; } catch {}
    }
    if (files['data.toml']) {
      try { dataParsed = parseTOML(new TextDecoder().decode(files['data.toml'])); hasData = true; } catch {}
    }

    if (hasWord && hasData) {
      const beforeUuids = new Set(state.books.map(b => b.uuid));
      await importBookFromParsed(wordParsed);
      const newBook = state.books.find(b => !beforeUuids.has(b.uuid)) || state.books.find(b => b.uuid === (wordParsed.metadata?.uuid));
      if (newBook) {
        const c = { success: {}, error: {} };
        if (dataParsed.success) c.success = { ...dataParsed.success };
        if (dataParsed.error) c.error = { ...dataParsed.error };
        state.counts[newBook.uuid] = c;
        await saveCount(newBook.uuid);
      }
      toast('单词册与数据已导入');
      renderAll();
      return;
    }
    if (hasWord) { await importBookFromParsed(wordParsed); return; }
    if (hasData) {
      const book = getCurrentBook();
      if (!book) { toast('没有当前单词册，无法导入数据'); return; }
      await importDataFromParsed(dataParsed, book.uuid, { onlyOverwrite: false });
      return;
    }
    await dialog({ title: '导入失败', body: 'ZIP 中没有找到 word.toml 或 data.toml', actions: [{ label: '确定', value: 'ok', primary: true }] });
    return;
  }

  const text = await file.text();
  let parsed;
  try { parsed = parseTOML(text); }
  catch (e) {
    await dialog({ title: '导入失败', body: 'TOML 解析失败：' + escapeHtml(e.message), actions: [{ label: '确定', value: 'ok', primary: true }] });
    return;
  }
  const type = detectTomlType(parsed);
  if (type === 'book') { await importBookFromParsed(parsed); return; }
  if (type === 'data') {
    const book = getCurrentBook();
    if (!book) { toast('没有当前单词册，无法导入数据'); return; }
    await importDataFromParsed(parsed, book.uuid, { onlyOverwrite: false });
    return;
  }
  await dialog({ title: '导入失败', body: '无法识别的 TOML 类型', actions: [{ label: '确定', value: 'ok', primary: true }] });
}

async function importDataFile(file) {
  const name = file.name.toLowerCase();
  let parsed = null;
  if (name.endsWith('.zip')) {
    const buf = new Uint8Array(await file.arrayBuffer());
    let files;
    try { files = unzip(buf); }
    catch (e) { await dialog({ title: '导入失败', body: 'ZIP 解析失败：' + escapeHtml(e.message), actions: [{ label: '确定', value: 'ok', primary: true }] }); return; }
    if (!files['data.toml']) { await dialog({ title: '导入失败', body: 'ZIP 中没有 data.toml', actions: [{ label: '确定', value: 'ok', primary: true }] }); return; }
    try { parsed = parseTOML(new TextDecoder().decode(files['data.toml'])); } catch (e) { await dialog({ title: '导入失败', body: 'data.toml 解析失败', actions: [{ label: '确定', value: 'ok', primary: true }] }); return; }
  } else {
    const text = await file.text();
    try { parsed = parseTOML(text); } catch (e) { await dialog({ title: '导入失败', body: 'TOML 解析失败：' + escapeHtml(e.message), actions: [{ label: '确定', value: 'ok', primary: true }] }); return; }
  }
  const book = getCurrentBook();
  if (!book) { toast('没有当前单词册，无法导入数据'); return; }
  const choice = await dialog({
    title: '导入数据',
    body: `将 data.toml 覆盖到「${escapeHtml(book.metadata.name || book.uuid)}」？`,
    actions: [
      { label: '取消', value: 'cancel' },
      { label: '覆盖', value: 'overwrite', primary: true }
    ]
  });
  if (choice !== 'overwrite') return;
  await importDataFromParsed(parsed, book.uuid, { onlyOverwrite: true });
}

async function mergeBooks(existing, incoming) {
  const existingMap = new Map(existing.words.map(w => [w.key, w]));
  const mergedWords = [...existing.words];
  for (const w of incoming.words) {
    const old = existingMap.get(w.key);
    if (!old) { mergedWords.push(w); continue; }
    if (wordToJSON(old) === wordToJSON(w)) continue;
    const choice = await dialog({
      title: '单词冲突',
      body: `单词「<b>${escapeHtml(w.text || w.key)}</b>」在两个文件中内容不同。<br><br>
             <div style="font-size:13px;line-height:1.6;">
             <b>现有：</b>${escapeHtml(old.text)} ${old.phonetic?escapeHtml(old.phonetic):''}<br>${defsText(old)}<br><br>
             <b>导入：</b>${escapeHtml(w.text)} ${w.phonetic?escapeHtml(w.phonetic):''}<br>${defsText(w)}
             </div>`,
      actions: [
        { label: '取消', value: 'cancel' },
        { label: '保留导入', value: 'incoming', primary: true },
        { label: '保留现有', value: 'existing' },
      ]
    });
    if (choice === 'cancel') return;
    if (choice === 'incoming') {
      const idx = mergedWords.findIndex(x => x.key === w.key);
      mergedWords[idx] = w;
    }
  }
  existing.words = mergedWords;
  await saveBook(existing); toast('合并完成'); renderAll();
}

function defsText(w) {
  const keys = Object.keys(w.paras);
  if (!keys.length) return '（无释义）';
  return keys.map(k => `${POS_MAP[k]||k}：${escapeHtml(w.paras[k].text)}`).join('；');
}

async function deleteBook(book) {
  const choice = await dialog({
    title: '删除单词册',
    body: `确定删除「${escapeHtml(book.metadata.name || book.uuid)}」吗？`,
    actions: [
      { label: '取消', value: 'cancel' },
      { label: '仅删单词册，保留计数', value: 'keep', primary: true },
      { label: '全部删除', value: 'all' }
    ]
  });
  if (choice === 'cancel') return;
  await removeFile('word', book.uuid + '.toml');
  if (choice === 'all') { await removeFile('number', book.uuid + '.toml'); delete state.counts[book.uuid]; }
  state.books = state.books.filter(b => b.uuid !== book.uuid);
  if (state.currentUuid === book.uuid) state.currentUuid = state.books[0] ? state.books[0].uuid : null;
  toast('已删除'); renderAll();
}

/* =========================================================
 *  页面结构
 * ========================================================= */
let els = {};

function buildUI() {
  const app = h('div', { class: 'app' });

  const topbar = h('div', { class: 'topbar' });
  const btnMenu = h('button', { class: 'icon-btn', title: '菜单' });
  btnMenu.appendChild(svg('M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z', { fill: 'currentColor', stroke: 'none' }));
  topbar.appendChild(btnMenu);

  const titleEl = h('div', { class: 'title-wrap' });
  const titleInner = h('div', { class: 'title', text: '单词记录表' });
  titleEl.appendChild(titleInner);
  topbar.appendChild(titleEl);

  const searchWrap = h('div', { class: 'search-wrap' });
  const searchIcon = svg('M11 4a7 7 0 105.2 11.9l3.4 3.4 1.4-1.4-3.4-3.4A7 7 0 0011 4zm0 2a5 5 0 110 10 5 5 0 010-10z', { fill: 'currentColor', stroke: 'none' });
  searchIcon.classList.add('search-icon');
  searchWrap.appendChild(searchIcon);

  const searchInput = h('input', {
    class: 'search-input', type: 'search',
    placeholder: '搜索单词或释义…', autocomplete: 'off', spellcheck: 'false'
  });

  const searchClear = h('button', { class: 'search-clear', title: '清除' });
  searchClear.appendChild(svg('M6 6l12 12M18 6L6 18'));
  searchClear.style.display = 'none';

  searchInput.addEventListener('input', () => {
    state.search = searchInput.value;
    searchClear.style.display = state.search ? '' : 'none';
    renderCards();
  });
  searchClear.addEventListener('click', () => {
    searchInput.value = ''; state.search = '';
    searchClear.style.display = 'none';
    renderCards(); searchInput.focus();
  });

  searchWrap.appendChild(searchInput);
  searchWrap.appendChild(searchClear);
  topbar.appendChild(searchWrap);

  topbar.appendChild(h('div', { class: 'spacer' }));

  const bookSel = createSelect({
    options: [], value: '',
    onChange: v => {
      state.currentUuid = v;
      state.search = '';
      if (els.searchInput) els.searchInput.value = '';
      if (els.searchClear) els.searchClear.style.display = 'none';
      renderAll();
    },
    class: 'desktop-only', width: '240px'
  });
  topbar.appendChild(bookSel);

  const sortSel = createSelect({
    options: SORT_OPTIONS, value: state.settings.sort,
    onChange: v => { state.settings.sort = v; saveSettings(); renderAll(); },
    class: 'desktop-only', width: '180px'
  });
  topbar.appendChild(sortSel);

  const btnImportTop = h('button', { class: 'icon-btn desktop-only', title: '导入' });
  btnImportTop.appendChild(svg('M12 3v12M7 10l5 5 5-5M5 21h14'));
  topbar.appendChild(btnImportTop);

  const btnExportTop = h('button', { class: 'icon-btn desktop-only', title: '导出全部' });
  btnExportTop.appendChild(svg('M12 15V3M7 8l5-5 5 5M5 21h14'));
  topbar.appendChild(btnExportTop);

  app.appendChild(topbar);

  const scrim = h('div', { class: 'drawer-scrim' });
  const drawer = h('div', { class: 'drawer' });

  drawer.appendChild(h('div', { class: 'section-title', text: '单词册' }));
  const bookList = h('div');
  drawer.appendChild(bookList);

  drawer.appendChild(h('div', { class: 'section-title', text: '排序' }));
  const sortSelMobile = createSelect({
    options: SORT_OPTIONS, value: state.settings.sort,
    onChange: v => { state.settings.sort = v; saveSettings(); renderAll(); }
  });
  sortSelMobile.style.width = '100%';
  drawer.appendChild(sortSelMobile);

  drawer.appendChild(h('div', { class: 'section-title', text: '操作' }));

  const actionImport = h('div', { class: 'action-item' });
  actionImport.appendChild(svg('M12 3v12M7 10l5 5 5-5M5 21h14'));
  actionImport.appendChild(h('span', { text: '导入（单词册 / 数据 / 备份）' }));
  drawer.appendChild(actionImport);

  const actionExportAll = h('div', { class: 'action-item' });
  actionExportAll.appendChild(svg('M12 15V3M7 8l5-5 5 5M5 21h14'));
  actionExportAll.appendChild(h('span', { text: '导出全部（备份）' }));
  drawer.appendChild(actionExportAll);

  app.appendChild(scrim);
  app.appendChild(drawer);

  const main = h('div', { class: 'main' });
  const cards = h('div', { class: 'cards' });
  main.appendChild(cards);
  const empty = h('div', { class: 'empty', style: 'display:none' });
  empty.appendChild(svg('M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z'));
  empty.appendChild(h('div', { text: '还没有单词册' }));
  empty.appendChild(h('div', { text: '点击导入，选择 toml 或 zip', style: 'margin-top:8px' }));
  main.appendChild(empty);
  app.appendChild(main);

  document.body.appendChild(app);

  const fileInput = h('input', { type: 'file', accept: '.toml,.zip,application/zip,text/plain', style: 'display:none' });
  document.body.appendChild(fileInput);

  const dataInput = h('input', { type: 'file', accept: '.toml,.zip,application/zip,text/plain', style: 'display:none' });
  document.body.appendChild(dataInput);

  els = {
    topbar, btnMenu, titleEl, titleInner, bookSel, sortSel, btnImportTop, btnExportTop,
    drawer, scrim, bookList, sortSelMobile, actionImport, actionExportAll,
    main, cards, empty, fileInput, dataInput, searchWrap, searchInput, searchClear
  };
}

/* =========================================================
 *  渲染
 * ========================================================= */
function renderBookSelect() {
  const books = state.books;
  els.bookSel.setOptions(books.map(b => ({ value: b.uuid, label: b.metadata.name || b.uuid.slice(0,8) })));
  els.bookSel.setValue(state.currentUuid || '');
  if (!books.length) els.bookSel.querySelector('.label').textContent = '（无）';

  const book = getCurrentBook();
  setTitle(book ? (book.metadata.name || book.uuid.slice(0, 8)) : '单词记录表');

  els.bookList.innerHTML = '';
  for (const b of books) {
    const item = h('div', { class: 'book-item' + (b.uuid === state.currentUuid ? ' active' : '') });
    item.appendChild(svg('M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z'));
    item.appendChild(h('span', { text: b.metadata.name || b.uuid.slice(0,8) }));

    const more = h('button', { class: 'icon-btn more-btn', title: '更多' });
    more.appendChild(iconMore());
    more.addEventListener('click', e => {
      e.stopPropagation();
      openBookMenu(more, b);
    });
    item.appendChild(more);

    item.addEventListener('click', () => {
      state.currentUuid = b.uuid; state.search = '';
      if (els.searchInput) els.searchInput.value = '';
      if (els.searchClear) els.searchClear.style.display = 'none';
      closeDrawer(); renderAll();
    });
    els.bookList.appendChild(item);
  }
}

/* —— 单词册三点菜单 —— */
let bookMenuEl = null;
function closeBookMenu() {
  if (bookMenuEl) {
    const el = bookMenuEl;
    bookMenuEl = null;
    animateRemove(el, 'closing', 280);
  }
  document.removeEventListener('click', onDocClickBookMenu, true);
}
function onDocClickBookMenu(e) {
  if (!bookMenuEl) return;
  if (bookMenuEl.contains(e.target)) return;
  if (bookMenuEl._anchor && bookMenuEl._anchor.contains(e.target)) return;
  closeBookMenu();
}
function openBookMenu(anchor, book) {
  if (bookMenuEl && bookMenuEl._anchor === anchor) {
    closeBookMenu();
    return;
  }
  closeBookMenu();

  const menu = h('div', { class: 'select-menu book-menu' });
  menu._anchor = anchor;

  const items = [
    { label: '导出单词册', fn: () => exportBookOnly(book) },
    { label: '导出数据', fn: () => exportBookData(book) },
    { label: '同时导出', fn: () => exportBookBoth(book) },
    { label: '导入数据', fn: () => { els.dataInput._targetUuid = book.uuid; els.dataInput.click(); } },
    { label: '删除单词册', fn: () => deleteBook(book) }
  ];
  for (const it of items) {
    const el = h('div', { class: 'item' });
    el.appendChild(h('span', { text: it.label }));
    el.addEventListener('click', e => {
      e.stopPropagation();
      closeBookMenu();
      it.fn();
    });
    menu.appendChild(el);
  }
  document.body.appendChild(menu);

  const r = anchor.getBoundingClientRect();
  const mr = menu.getBoundingClientRect();
  let left = r.right - mr.width;
  let top = r.bottom + 6;
  if (left < 8) left = 8;
  if (top + mr.height > window.innerHeight - 8) top = r.top - mr.height - 6;
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';

  bookMenuEl = menu;
  setTimeout(() => document.addEventListener('click', onDocClickBookMenu, true), 0);
}

function renderSortSelect() {
  els.sortSel.setValue(state.settings.sort);
  els.sortSelMobile.setValue(state.settings.sort);
}

/* =========================================================
 *  卡片池（keyed 复用）
 * ========================================================= */
const cardPool = new Map();     // key -> { el, okNum, errNum, word, unsub, locateBtn }
let cardObserver = null;
let poolBookUuid = null;

function getCardObserver() {
  if (cardObserver) return cardObserver;
  cardObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      el.classList.remove('is-hidden');
      el.classList.add('is-visible');
      cardObserver.unobserve(el);
    }
  }, { rootMargin: '0px 0px 0px 0px', threshold: 0.05 });
  return cardObserver;
}

function createCard(word, uuid, count) {
  const el = h('div', { class: 'word-card is-hidden' });
  el._key = word.key;

  const head = h('div', { class: 'word-head' });
  head.appendChild(h('div', { class: 'word-text', text: word.text }));
  if (word.phonetic) head.appendChild(h('div', { class: 'word-phonetic', text: word.phonetic }));
  el.appendChild(head);

  const defs = h('div', { class: 'word-defs' });
  const posKeys = Object.keys(word.paras);
  if (posKeys.length) {
    for (const pos of posKeys) {
      const line = h('div', { class: 'def-line' });
      line.appendChild(h('span', { class: 'pos', text: (POS_MAP[pos] || pos) + '：' }));
      line.appendChild(document.createTextNode(word.paras[pos].text));
      defs.appendChild(line);
    }
  } else {
    defs.appendChild(h('div', { class: 'def-line', text: '（无释义）', style: 'opacity:.5' }));
  }
  el.appendChild(defs);

  const actions = h('div', { class: 'word-actions' });
  const okBtn = h('button', { class: 'icon-btn ok-btn', title: '正确' });
  okBtn.appendChild(iconOk());
  const okNum = h('span', { class: 'count', text: String(count.success[word.key] || 0) });
  const errBtn = h('button', { class: 'icon-btn err-btn', title: '错误' });
  errBtn.appendChild(iconErr());
  const errNum = h('span', { class: 'count', text: String(count.error[word.key] || 0) });

  okBtn.addEventListener('click', e => {
    e.stopPropagation();
    openBubble(okBtn, uuid, word.key, 'success');
  });
  errBtn.addEventListener('click', e => {
    e.stopPropagation();
    openBubble(errBtn, uuid, word.key, 'error');
  });

  actions.appendChild(okBtn); actions.appendChild(okNum);
  actions.appendChild(h('div', { class: 'sep' }));
  actions.appendChild(errBtn); actions.appendChild(errNum);
  el.appendChild(actions);

  // —— 定位按钮（仅在搜索状态下显示） ——
  const locateBtn = h('button', { class: 'icon-btn locate-btn', title: '定位到此处' });
  locateBtn.appendChild(iconLocate());
  locateBtn.style.display = 'none';
  locateBtn.addEventListener('click', e => {
    e.stopPropagation();
    locateWord(word.key);
  });
  el.appendChild(locateBtn);

  // 订阅计数变化 —— 卡片自己的数字自动更新
  const unsub = subscribeCount((u, k, t, v) => {
    if (u !== uuid || k !== word.key) return;
    if (t === 'success') okNum.textContent = String(v);
    else errNum.textContent = String(v);
  });

  // 入场动画：新卡才 observe
  getCardObserver().observe(el);

  return { el, okNum, errNum, word, unsub, locateBtn };
}

function teardownCards() {
  for (const [, entry] of cardPool) {
    entry.unsub();
    entry.el.remove();
  }
  cardPool.clear();
  els.cards.replaceChildren();
  poolBookUuid = null;
}

function renderCards() {
  const book = getCurrentBook();
  if (!book) {
    teardownCards();
    els.empty.style.display = '';
    return;
  }
  els.empty.style.display = 'none';

  // 切换单词册 → 整个池作废
  if (poolBookUuid !== book.uuid) {
    teardownCards();
    poolBookUuid = book.uuid;
  }

  const words = getVisibleWords(book);
  const c = getCount(book.uuid);
  const searching = !!(state.search || '').trim();

  // 空结果：清场 + 可能显示提示
  if (!words.length) {
    for (const [, entry] of cardPool) {
      entry.unsub();
      entry.el.remove();
    }
    cardPool.clear();
    els.cards.replaceChildren();
    if (searching) {
      els.cards.appendChild(h('div', { class: 'search-empty', text: '没有匹配的单词' }));
    }
    return;
  }

  const visibleKeys = new Set(words.map(w => w.key));

  // 1) 移除不可见的卡片
  for (const [key, entry] of cardPool) {
    if (!visibleKeys.has(key)) {
      entry.unsub();
      entry.el.remove();
      cardPool.delete(key);
    }
  }

  // 2) 按顺序组装（复用 or 新建）
  const frag = document.createDocumentFragment();
  for (const w of words) {
    let entry = cardPool.get(w.key);
    if (!entry) {
      entry = createCard(w, book.uuid, c);
      cardPool.set(w.key, entry);
    } else {
      // 复用：只同步计数
      entry.okNum.textContent = String(c.success[w.key] || 0);
      entry.errNum.textContent = String(c.error[w.key] || 0);
    }

    // 同步定位按钮可见性
    if (entry.locateBtn) entry.locateBtn.style.display = searching ? '' : 'none';
    entry.el.classList.toggle('has-locate', searching);

    frag.appendChild(entry.el); // 自动从旧位置 detach
  }

  // 3) 一次性替换
  els.cards.replaceChildren(frag);
}

function renderAll() {
  renderBookSelect();
  renderSortSelect();
  renderCards();
}

/* =========================================================
 *  定位（搜索 → 关闭搜索并滚动到对应卡片）
 * ========================================================= */
function locateWord(wordKey) {
  if (!(state.search || '').trim()) return;

  // 关闭搜索状态
  state.search = '';
  if (els.searchInput) els.searchInput.value = '';
  if (els.searchClear) els.searchClear.style.display = 'none';
  closeBubble();
  renderCards();

  // 等布局稳定后再测量并滚动
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const entry = cardPool.get(wordKey);
    if (!entry) return;
    const el = entry.el;

    // 强制显示（跳过入场动画，避免滚动到一半还在淡入）
    el.classList.remove('is-hidden');
    el.classList.add('is-visible');
    getCardObserver().unobserve(el);

    const topbarH = els.topbar ? els.topbar.getBoundingClientRect().height : 0;
    const offset = topbarH + 16;
    const rect = el.getBoundingClientRect();
    const targetY = Math.max(0, window.scrollY + rect.top - offset);
    window.scrollTo({ top: targetY, behavior: 'smooth' });

    // 高亮提示
    el.classList.add('locate-highlight');
    setTimeout(() => el.classList.remove('locate-highlight'), 1800);
  }));
}

/* =========================================================
 *  泡泡
 * ========================================================= */
let currentBubble = null;
let currentBubbleAnchor = null;
let currentBubbleUnsub = null;
let bubbleRaf = null;

function positionBubble() {
  if (!currentBubble || !currentBubbleAnchor) return;
  if (currentBubble._removing) return;

  const r = currentBubbleAnchor.getBoundingClientRect();
  const br = currentBubble.getBoundingClientRect();

  let left = r.left + r.width / 2 - br.width / 2 + window.scrollX;
  let top  = r.top - br.height - 8 + window.scrollY;
  if (r.top - br.height - 8 < 8) top = r.bottom + 8 + window.scrollY;
  if (left < 8 + window.scrollX) left = 8 + window.scrollX;
  if (left + br.width > window.innerWidth - 8 + window.scrollX) {
    left = window.innerWidth - br.width - 8 + window.scrollX;
  }

  currentBubble.style.left = left + 'px';
  currentBubble.style.top  = top + 'px';
}

function closeBubble() {
  if (currentBubble) {
    const el = currentBubble;
    currentBubble = null;
    animateRemove(el, 'closing', 280);
  }
  if (currentBubbleUnsub) { currentBubbleUnsub(); currentBubbleUnsub = null; }
  currentBubbleAnchor = null;
  if (bubbleRaf) { cancelAnimationFrame(bubbleRaf); bubbleRaf = null; }
  document.removeEventListener('click', onDocClickBubble, true);
  window.removeEventListener('scroll', positionBubble, true);
  window.removeEventListener('resize', positionBubble);
}

function onDocClickBubble(e) {
  if (!currentBubble) return;
  if (currentBubble.contains(e.target)) return;
  if (currentBubbleAnchor && currentBubbleAnchor.contains(e.target)) return;
  closeBubble();
}

function openBubble(anchor, uuid, key, type) {
  if (currentBubble && currentBubbleAnchor === anchor) {
    closeBubble();
    return;
  }
  // 关掉旧的（如果有）
  if (currentBubble) {
    closeBubble();
  }

  const bubble = h('div', { class: 'bubble' });
  const num = h('span', { class: 'num', text: String(getCount(uuid)[type][key] || 0) });

  const minus = h('button', { class: 'icon-btn' });
  minus.appendChild(svg('M5 12h14', { strokeWidth: '2.4' }));
  minus.addEventListener('click', e => { e.stopPropagation(); changeCount(uuid, key, type, -1); });

  const plus = h('button', { class: 'icon-btn' });
  plus.appendChild(svg('M12 5v14M5 12h14', { strokeWidth: '2.4' }));
  plus.addEventListener('click', e => { e.stopPropagation(); changeCount(uuid, key, type, 1); });

  bubble.appendChild(minus); bubble.appendChild(num); bubble.appendChild(plus);
  document.body.appendChild(bubble);

  currentBubble = bubble;
  currentBubbleAnchor = anchor;

  // 泡泡也订阅 —— 数字自动同步
  currentBubbleUnsub = subscribeCount((u, k, t, v) => {
    if (u === uuid && k === key && t === type) num.textContent = String(v);
  });

  positionBubble();

  let frames = 0;
  const follow = () => {
    positionBubble();
    frames++;
    if (frames < 30) bubbleRaf = requestAnimationFrame(follow);
    else bubbleRaf = null;
  };
  bubbleRaf = requestAnimationFrame(follow);

  window.addEventListener('scroll', positionBubble, true);
  window.addEventListener('resize', positionBubble);

  setTimeout(() => document.addEventListener('click', onDocClickBubble, true), 0);
}

async function changeCount(uuid, key, type, delta) {
  const c = getCount(uuid);
  let v = (c[type][key] || 0) + delta;
  if (v < 0) v = 0;
  c[type][key] = v;
  emitCount(uuid, key, type, v);   // 广播给卡片 + 泡泡
  scheduleSaveCount(uuid);          // debounce 落盘
}

/* =========================================================
 *  抽屉
 * ========================================================= */
function openDrawer() { els.drawer.classList.add('open'); els.scrim.classList.add('show'); }
function closeDrawer() { els.drawer.classList.remove('open'); els.scrim.classList.remove('show'); }

/* =========================================================
 *  事件绑定
 * ========================================================= */
function bindEvents() {
  els.btnMenu.addEventListener('click', openDrawer);
  els.scrim.addEventListener('click', closeDrawer);

  let tx = 0, ty = 0, tracking = false;
  document.addEventListener('touchstart', e => {
    const t = e.touches[0]; tx = t.clientX; ty = t.clientY; tracking = t.clientX < 24;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!tracking) return;
    const t = e.touches[0];
    if (t.clientX - tx > 60 && Math.abs(t.clientY - ty) < 50) { openDrawer(); tracking = false; }
  }, { passive: true });
  document.addEventListener('touchend', () => { tracking = false; }, { passive: true });

  els.btnImportTop.addEventListener('click', () => els.fileInput.click());
  els.actionImport.addEventListener('click', () => { closeDrawer(); els.fileInput.click(); });
  els.fileInput.addEventListener('change', async () => {
    const f = els.fileInput.files[0];
    if (f) await importFile(f);
    els.fileInput.value = '';
  });

  els.btnExportTop.addEventListener('click', exportAll);
  els.actionExportAll.addEventListener('click', () => { closeDrawer(); exportAll(); });

  els.dataInput.addEventListener('change', async () => {
    const f = els.dataInput.files[0];
    if (f) await importDataFile(f);
    els.dataInput.value = '';
  });

  const main = els.main;
  ['dragenter','dragover'].forEach(ev => main.addEventListener(ev, e => { e.preventDefault(); main.classList.add('drop-active'); }));
  ['dragleave','drop'].forEach(ev => main.addEventListener(ev, e => { e.preventDefault(); main.classList.remove('drop-active'); }));
  main.addEventListener('drop', async e => {
    const f = e.dataTransfer.files[0];
    if (f) await importFile(f);
  });

  window.addEventListener('scroll', closeBubble, true);
  window.addEventListener('resize', closeBubble);
}

/* =========================================================
 *  入口
 * ========================================================= */
(async function () {
  const root = await initOPFS();
  buildUI();
  if (!root) {
    await dialog({
      title: '无法使用',
      body: '您的浏览器不支持 OPFS（浏览器文件系统），请安装你使用的浏览器的最新版或者更新系统 WebView',
      actions: [{ label: '确定', value: 'ok', primary: true }]
    });
    return;
  }
  await loadAll();
  bindEvents();
  renderAll();
})();