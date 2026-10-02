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
  { value: 'config',   label: '配置顺序' },
  { value: 'text-az',  label: 'A → Z' },
  { value: 'text-za',  label: 'Z → A' },
  { value: 'random',   label: '随机' },
  { value: 'ok-desc',  label: '✔ 最多' },
  { value: 'ok-asc',   label: '✔ 最少' },
  { value: 'err-desc', label: '✘ 最多' },
  { value: 'err-asc',  label: '✘ 最少' },
  { value: 'diff-desc',label: '✔−✘ 最高' },
  { value: 'diff-asc', label: '✔−✘ 最低' },
  { value: 'mastery-desc', label: '掌握度 高→低' },
  { value: 'mastery-asc',  label: '掌握度 低→高' },
];

/* =========================================================
 *  工具
 * ========================================================= */
function h(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v !== undefined && v !== null) {
      el.setAttribute(k, v);
    }
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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
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
    const bodyEl = h('div', { class: 'body', html: body || '' });
    box.appendChild(bodyEl);
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
    function close() {
      scrim.remove();
    }
  });
}

/* =========================================================
 *  自定义下拉
 * ========================================================= */
let openMenu = null;
function closeSelectMenu() {
  if (openMenu) { openMenu.remove(); openMenu = null; document.removeEventListener('click', onDocClick, true); }
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
    const opt = options.find(o => o.value === el._value);
    label.textContent = opt ? opt.label : '';
  }
  updateLabel();

  el.addEventListener('click', e => {
    e.stopPropagation();
    if (openMenu && openMenu._anchor === el) { closeSelectMenu(); return; }
    closeSelectMenu();
    const menu = h('div', { class: 'select-menu' });
    menu._anchor = el;
    for (const o of options) {
      const item = h('div', {
        class: 'item' + (o.value === el._value ? ' active' : ''),
        text: o.label,
        onclick: () => {
          el._value = o.value;
          updateLabel();
          closeSelectMenu();
          onChange && onChange(o.value);
        }
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
  return el;
}

/* =========================================================
 *  OPFS
 * ========================================================= */
let opfsRoot = null;
async function initOPFS() {
  if (!navigator.storage || !navigator.storage.getDirectory) return null;
  try {
    opfsRoot = await navigator.storage.getDirectory();
    return opfsRoot;
  } catch { return null; }
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
  try { (await opfsRoot.getDirectoryHandle(dir)).removeEntry(name); } catch {}
}
async function listFiles(dir) {
  try {
    const d = await opfsRoot.getDirectoryHandle(dir);
    const out = [];
    for await (const [name, h] of d.entries()) if (h.kind === 'file') out.push(name);
    return out;
  } catch { return []; }
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
let state = { books: [], currentUuid: null, counts: {}, settings: { sort: 'text-az' } };

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
  const s = await readFile('', 'settings.toml');
  if (s) try { const p = parseTOML(s); if (p.sort) state.settings.sort = p.sort; } catch {}
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
async function saveSettings() { await writeFile('', 'settings.toml', toTOML({ sort: state.settings.sort })); }
async function saveBook(book) { await writeFile('word', book.uuid + '.toml', bookToTOML(book)); }

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
    case 'diff-desc': words.sort((a,b) => (ok(b.key)-er(b.key)) - (ok(a.key)-er(a.key))); break;
    case 'diff-asc': words.sort((a,b) => (ok(a.key)-er(a.key)) - (ok(b.key)-er(b.key))); break;
    case 'mastery-desc': words.sort((a,b) => mastery(b) - mastery(a)); break;
    case 'mastery-asc': words.sort((a,b) => mastery(a) - mastery(b)); break;
  }
  return words;
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }

/* =========================================================
 *  页面结构
 * ========================================================= */
let els = {};

function buildUI() {
  const app = h('div', { class: 'app' });

  // 顶栏
  const topbar = h('div', { class: 'topbar' });
  const btnMenu = h('button', { class: 'icon-btn', title: '菜单' });
  btnMenu.appendChild(svg('M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z', { fill: 'currentColor', stroke: 'none' }));
  topbar.appendChild(btnMenu);

  topbar.appendChild(h('div', { class: 'title', text: '单词记录表' }));
  topbar.appendChild(h('div', { class: 'spacer' }));

  const bookSel = createSelect({
    options: [],
    value: '',
    onChange: v => { state.currentUuid = v; renderAll(); },
    class: 'desktop-only',
    width: '240px'
  });
  topbar.appendChild(bookSel);

  const sortSel = createSelect({
    options: SORT_OPTIONS,
    value: state.settings.sort,
    onChange: v => { state.settings.sort = v; saveSettings(); renderAll(); },
    class: 'desktop-only',
    width: '180px'
  });
  topbar.appendChild(sortSel);

  const btnImportTop = h('button', { class: 'icon-btn desktop-only', title: '导入' });
  btnImportTop.appendChild(svg('M12 3v12M7 10l5 5 5-5M5 21h14'));
  topbar.appendChild(btnImportTop);

  const btnExportTop = h('button', { class: 'icon-btn desktop-only', title: '导出' });
  btnExportTop.appendChild(svg('M12 15V3M7 8l5-5 5 5M5 21h14'));
  topbar.appendChild(btnExportTop);

  app.appendChild(topbar);

  // 抽屉
  const scrim = h('div', { class: 'drawer-scrim' });
  const drawer = h('div', { class: 'drawer' });

  drawer.appendChild(h('div', { class: 'section-title', text: '单词册' }));
  const bookList = h('div');
  drawer.appendChild(bookList);

  drawer.appendChild(h('div', { class: 'section-title', text: '排序' }));
  const sortSelMobile = createSelect({
    options: SORT_OPTIONS,
    value: state.settings.sort,
    onChange: v => { state.settings.sort = v; saveSettings(); renderAll(); }
  });
  sortSelMobile.style.width = '100%';
  drawer.appendChild(sortSelMobile);

  drawer.appendChild(h('div', { class: 'section-title', text: '操作' }));

  const actionImport = h('div', { class: 'action-item' });
  actionImport.appendChild(svg('M12 3v12M7 10l5 5 5-5M5 21h14'));
  actionImport.appendChild(h('span', { text: '导入 TOML' }));
  drawer.appendChild(actionImport);

  const actionExport = h('div', { class: 'action-item' });
  actionExport.appendChild(svg('M12 15V3M7 8l5-5 5 5M5 21h14'));
  actionExport.appendChild(h('span', { text: '导出当前单词册' }));
  drawer.appendChild(actionExport);

  const actionDelete = h('div', { class: 'action-item' });
  actionDelete.appendChild(svg('M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14'));
  actionDelete.appendChild(h('span', { text: '删除当前单词册' }));
  drawer.appendChild(actionDelete);

  app.appendChild(scrim);
  app.appendChild(drawer);

  // 主区域
  const main = h('div', { class: 'main' });
  const cards = h('div', { class: 'cards' });
  main.appendChild(cards);
  const empty = h('div', { class: 'empty', style: 'display:none' });
  empty.appendChild(svg('M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z'));
  empty.appendChild(h('div', { text: '还没有单词册' }));
  empty.appendChild(h('div', { text: '点击导入，选择一个 .toml 文件', style: 'margin-top:8px' }));
  main.appendChild(empty);
  app.appendChild(main);

  document.body.appendChild(app);

  // 文件 input
  const fileInput = h('input', { type: 'file', accept: '.toml,text/plain', style: 'display:none' });
  document.body.appendChild(fileInput);

  els = { topbar, btnMenu, bookSel, sortSel, btnImportTop, btnExportTop, drawer, scrim, bookList, sortSelMobile, actionImport, actionExport, actionDelete, main, cards, empty, fileInput };
}

/* =========================================================
 *  渲染
 * ========================================================= */
function renderBookSelect() {
  const books = state.books;
  els.bookSel._options = books.map(b => ({ value: b.uuid, label: b.metadata.name || b.uuid.slice(0,8) }));
  els.bookSel.setValue(state.currentUuid || '');
  if (!books.length) els.bookSel.querySelector('.label').textContent = '（无）';

  els.bookList.innerHTML = '';
  for (const b of books) {
    const item = h('div', { class: 'book-item' + (b.uuid === state.currentUuid ? ' active' : '') });
    item.appendChild(svg('M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z'));
    item.appendChild(h('span', { text: b.metadata.name || b.uuid.slice(0,8) }));
    item.addEventListener('click', () => {
      state.currentUuid = b.uuid;
      closeDrawer();
      renderAll();
    });
    els.bookList.appendChild(item);
  }
}

function renderSortSelect() {
  els.sortSel.setValue(state.settings.sort);
  els.sortSelMobile.setValue(state.settings.sort);
}

function renderCards() {
  const wrap = els.cards;
  wrap.innerHTML = '';
  const book = getCurrentBook();
  if (!book) {
    els.empty.style.display = '';
    return;
  }
  els.empty.style.display = 'none';
  const words = getSortedWords(book);
  const c = getCount(book.uuid);

  for (const w of words) {
    const card = h('div', { class: 'word-card' });

    const head = h('div', { class: 'word-head' });
    head.appendChild(h('div', { class: 'word-text', text: w.text }));
    if (w.phonetic) head.appendChild(h('div', { class: 'word-phonetic', text: w.phonetic }));
    card.appendChild(head);

    const defs = h('div', { class: 'word-defs' });
    const posKeys = Object.keys(w.paras);
    if (posKeys.length) {
      for (const pos of posKeys) {
        const line = h('div', { class: 'def-line' });
        line.appendChild(h('span', { class: 'pos', text: (POS_MAP[pos] || pos) + '：' }));
        line.appendChild(document.createTextNode(w.paras[pos].text));
        defs.appendChild(line);
      }
    } else {
      defs.appendChild(h('div', { class: 'def-line', text: '（无释义）', style: 'opacity:.5' }));
    }
    card.appendChild(defs);

    const actions = h('div', { class: 'word-actions' });

    const okBtn = h('button', { class: 'icon-btn ok-btn', title: '正确' });
    okBtn.appendChild(svg('M4 12.5l5 5L20 6.5', { strokeWidth: '2.6' }));
    const okNum = h('span', { class: 'count', text: String(c.success[w.key] || 0) });

    const errBtn = h('button', { class: 'icon-btn err-btn', title: '错误' });
    errBtn.appendChild(svg('M6 6l12 12M18 6L6 18', { strokeWidth: '2.6' }));
    const errNum = h('span', { class: 'count', text: String(c.error[w.key] || 0) });

    okBtn.addEventListener('click', e => { e.stopPropagation(); openBubble(okBtn, book.uuid, w.key, 'success', okNum); });
    errBtn.addEventListener('click', e => { e.stopPropagation(); openBubble(errBtn, book.uuid, w.key, 'error', errNum); });

    actions.appendChild(okBtn);
    actions.appendChild(okNum);
    actions.appendChild(h('div', { class: 'sep' }));
    actions.appendChild(errBtn);
    actions.appendChild(errNum);
    card.appendChild(actions);

    wrap.appendChild(card);
  }
}

function renderAll() {
  renderBookSelect();
  renderSortSelect();
  renderCards();
}

/* =========================================================
 *  泡泡
 * ========================================================= */
let currentBubble = null;
function closeBubble() {
  if (currentBubble) {
    currentBubble.remove();
    currentBubble = null;
    document.removeEventListener('click', onDocClickBubble, true);
  }
}
function onDocClickBubble(e) {
  if (currentBubble && !currentBubble.contains(e.target)) closeBubble();
}

function openBubble(anchor, uuid, key, type, numEl) {
  closeBubble();
  const bubble = h('div', { class: 'bubble' });

  const minus = h('button', { class: 'icon-btn' });
  minus.appendChild(svg('M5 12h14', { strokeWidth: '2.4' }));
  minus.addEventListener('click', e => { e.stopPropagation(); changeCount(uuid, key, type, -1, numEl, bubble); });

  const num = h('span', { class: 'num', text: String(getCount(uuid)[type][key] || 0) });

  const plus = h('button', { class: 'icon-btn' });
  plus.appendChild(svg('M12 5v14M5 12h14', { strokeWidth: '2.4' }));
  plus.addEventListener('click', e => { e.stopPropagation(); changeCount(uuid, key, type, 1, numEl, bubble); });

  bubble.appendChild(minus);
  bubble.appendChild(num);
  bubble.appendChild(plus);
  document.body.appendChild(bubble);
  currentBubble = bubble;

  const r = anchor.getBoundingClientRect();
  const br = bubble.getBoundingClientRect();
  let left = r.left + r.width / 2 - br.width / 2;
  let top = r.top - br.height - 8;
  if (top < 8) top = r.bottom + 8;
  if (left < 8) left = 8;
  if (left + br.width > window.innerWidth - 8) left = window.innerWidth - br.width - 8;
  bubble.style.left = left + 'px';
  bubble.style.top = top + 'px';

  setTimeout(() => document.addEventListener('click', onDocClickBubble, true), 0);
}

async function changeCount(uuid, key, type, delta, numEl, bubble) {
  const c = getCount(uuid);
  let v = (c[type][key] || 0) + delta;
  if (v < 0) v = 0;
  c[type][key] = v;
  numEl.textContent = v;
  const n = bubble.querySelector('.num');
  if (n) n.textContent = v;
  await saveCount(uuid);
}

/* =========================================================
 *  导入 / 导出 / 删除
 * ========================================================= */
async function importFile(file) {
  const text = await file.text();
  let parsed;
  try { parsed = parseTOML(text); }
  catch (e) {
    await dialog({ title: '导入失败', body: 'TOML 解析失败：' + escapeHtml(e.message), actions: [{label:'确定', value:'ok', primary:true}] });
    return;
  }
  const incoming = normalizeBook(parsed);
  const existing = state.books.find(b => b.uuid === incoming.uuid);

  if (!existing) {
    state.books.push(incoming);
    state.counts[incoming.uuid] = { success: {}, error: {} };
    await saveBook(incoming);
    await saveCount(incoming.uuid);
    if (!state.currentUuid) state.currentUuid = incoming.uuid;
    toast('导入成功');
    renderAll();
    return;
  }

  const fileChoice = await dialog({
    title: 'UUID 冲突',
    body: `单词册「${escapeHtml(incoming.metadata.name || incoming.uuid)}」已存在。<br>请选择处理方式：`,
    actions: [
      { label: '取消', value: 'cancel' },
      { label: '覆盖', value: 'overwrite' },
      { label: '合并', value: 'merge', primary: true },
    ]
  });
  if (fileChoice === 'cancel') return;
  if (fileChoice === 'overwrite') {
    const idx = state.books.findIndex(b => b.uuid === incoming.uuid);
    state.books[idx] = incoming;
    await saveBook(incoming);
    toast('已覆盖');
    renderAll();
    return;
  }
  await mergeBooks(existing, incoming);
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
  await saveBook(existing);
  toast('合并完成');
  renderAll();
}

function defsText(w) {
  const keys = Object.keys(w.paras);
  if (!keys.length) return '（无释义）';
  return keys.map(k => `${POS_MAP[k]||k}：${escapeHtml(w.paras[k].text)}`).join('；');
}

async function exportCurrent() {
  const book = getCurrentBook();
  if (!book) { toast('没有可导出的单词册'); return; }
  const text = bookToTOML(book);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (book.metadata.name || book.uuid) + '.toml';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function deleteCurrent() {
  const book = getCurrentBook();
  if (!book) { toast('没有可删除的单词册'); return; }
  const choice = await dialog({
    title: '删除单词册',
    body: `确定删除「${escapeHtml(book.metadata.name || book.uuid)}」吗？`,
    actions: [
      { label: '取消', value: 'cancel' },
      { label: '仅删单词册，保留计数', value: 'keep', primary: true },
      { label: '全部删除', value: 'all' },
    ]
  });
  if (choice === 'cancel') return;
  await removeFile('word', book.uuid + '.toml');
  if (choice === 'all') {
    await removeFile('number', book.uuid + '.toml');
    delete state.counts[book.uuid];
  }
  state.books = state.books.filter(b => b.uuid !== book.uuid);
  if (state.currentUuid === book.uuid) state.currentUuid = state.books[0] ? state.books[0].uuid : null;
  toast('已删除');
  renderAll();
}

/* =========================================================
 *  抽屉
 * ========================================================= */
function openDrawer() {
  els.drawer.classList.add('open');
  els.scrim.classList.add('show');
}
function closeDrawer() {
  els.drawer.classList.remove('open');
  els.scrim.classList.remove('show');
}

/* =========================================================
 *  事件绑定
 * ========================================================= */
function bindEvents() {
  els.btnMenu.addEventListener('click', openDrawer);
  els.scrim.addEventListener('click', closeDrawer);

  // 左边缘右滑
  let tx = 0, ty = 0, tracking = false;
  document.addEventListener('touchstart', e => {
    const t = e.touches[0]; tx = t.clientX; ty = t.clientY;
    tracking = t.clientX < 24;
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

  els.btnExportTop.addEventListener('click', exportCurrent);
  els.actionExport.addEventListener('click', () => { closeDrawer(); exportCurrent(); });
  els.actionDelete.addEventListener('click', () => { closeDrawer(); deleteCurrent(); });

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