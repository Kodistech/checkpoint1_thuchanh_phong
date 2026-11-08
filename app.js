/* =====================================================================
   ByteForge — app.js
   1 Config · 2 Utilities · 3 Auth · 4 Layout/UI · 5 Posts · 6 Comments
   7 Editor + profile modals · 8 Pages (home, post, auth, profile) · 9 Boot
   ===================================================================== */
'use strict';

/* ───────────── 1. CONFIG: replace these two values ───────────── */
const SUPABASE_URL      = "https://vpxmkagnyqgdalwuzuod.supabase.co";   // Project Settings → API → Project URL
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZweG1rYWdueXFnZGFsd3V6dW9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0NzE0MzQsImV4cCI6MjEwOTA0NzQzNH0.-NZ7fG6OVy67jkHoViPa5rCrO91ODSUDcDf5mWF3D00";                                // Project Settings → API → anon public key
/* ─────────────────────────────────────────────────────────────── */

const SITE_NAME  = "ByteForge";
const CATEGORIES = ["News", "Reviews", "Tutorials", "Rumors", "Forums"];
const CAT_ICON   = { News: "📰", Reviews: "⭐", Tutorials: "🛠️", Rumors: "🔮", Forums: "💬" };
const PAGE_SIZE  = 10;
const MAX_DEPTH  = 4;   // replies indent this many levels, then stay flat

const libLoaded = typeof window.supabase?.createClient === "function";
const configured = libLoaded
  && /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)/i.test(SUPABASE_URL)
  && !/YOUR_|__ANON/.test(SUPABASE_URL + SUPABASE_ANON_KEY)
  && SUPABASE_ANON_KEY.length > 40;
const sb = configured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

/* ───────────── 2. UTILITIES ───────────── */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const params = new URLSearchParams(location.search);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const escLike = (s) => String(s).replace(/[\\%_]/g, '\\$&');
const isHttpUrl = (u) => { try { const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:'; } catch { return false; } };
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const makeStore = (name) => ({
  get(k) { try { return window[name].getItem(k); } catch { return null; } },
  set(k, v) { try { window[name].setItem(k, v); } catch { /* storage unavailable */ } },
  del(k) { try { window[name].removeItem(k); } catch { /* storage unavailable */ } },
});
const local = makeStore('localStorage');
const session = makeStore('sessionStorage');

const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return Math.max(1, Math.floor(s / 60)) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 604800) return Math.floor(s / 86400) + 'd ago';
  return fmtDate(iso);
}
const readTime = (t) => Math.max(1, Math.round(String(t || '').trim().split(/\s+/).length / 220));
function excerpt(md, n = 170) {
  const t = String(md || '')
    .replace(/```[\s\S]*?```/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/(^|\n)\s*([-+]|\d+[.)])\s+/g, ' ')
    .replace(/[#>*`_~]+/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t;
}
function parseTags(s) {
  const out = [];
  for (const raw of String(s).split(',')) {
    const t = raw.trim().toLowerCase().replace(/^#+/, '').replace(/\s+/g, '-').replace(/[^a-z0-9\-_.+]/g, '').slice(0, 24);
    if (t && !out.includes(t)) out.push(t);
  }
  return out.slice(0, 8);
}
function errMsg(e) {
  const m = (e && (e.message || e.error_description)) || String(e || '');
  const c = e && e.code;
  if (/failed to fetch|networkerror|load failed/i.test(m)) return 'Network problem. Check your connection and try again.';
  if (c === '42P01' || c === 'PGRST205' || c === 'PGRST200' || /schema cache/i.test(m)) return 'Database tables not found. Run the SQL from README.md first.';
  if (c === '42501' || /row-level security/i.test(m)) return 'You don’t have permission to do that.';
  if (c === 'PGRST116') return 'That item no longer exists, or you don’t have permission to change it.';
  if (c === '23505') return 'That value is already taken.';
  if (c === '23514') return 'One of the values is not allowed. Check lengths and formats.';
  if (/invalid login credentials/i.test(m)) return 'Wrong email or password.';
  if (/email not confirmed/i.test(m)) return 'Confirm your email first. Check your inbox for the link.';
  if (/rate limit|too many/i.test(m)) return 'Too many attempts. Wait a minute and try again.';
  return m || 'Something went wrong.';
}

/* Toasts */
function toast(msg, type = 'info', ms = 4200) {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.setAttribute('role', type === 'error' ? 'alert' : 'status');
  const ico = document.createElement('span'); ico.className = 'toast-ico'; ico.textContent = { success: '✓', error: '!', info: 'i' }[type] || 'i';
  const txt = document.createElement('span'); txt.textContent = msg;
  t.append(ico, txt); box.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms);
}

/* Safe Markdown subset. Input is HTML-escaped first, so raw HTML never reaches the DOM. */
function inlineMd(s, images) {
  const stash = [];
  s = s.replace(/`([^`\n]+)`/g, (_, c) => { stash.push('<code>' + c + '</code>'); return '\u0000' + (stash.length - 1) + '\u0000'; });
  if (images) s = s.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" referrerpolicy="no-referrer">');
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer nofollow ugc">$1</a>');
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, n) => stash[+n]);
}
function renderContent(raw, { images = true } = {}) {
  const lines = String(raw || '').replace(/\u0000/g, '').replace(/\r\n?/g, '\n').split('\n');
  const inl = (t) => inlineMd(esc(t), images);
  let html = '', i = 0, para = [], m;
  const flush = () => { if (para.length) { html += '<p>' + inl(para.join('\n')).replace(/\n/g, '<br>') + '</p>'; para = []; } };
  while (i < lines.length) {
    const ln = lines[i];
    if (/^```/.test(ln)) {
      flush(); const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++; html += '<pre><code>' + esc(buf.join('\n')) + '</code></pre>'; continue;
    }
    if ((m = ln.match(/^(#{1,3})\s+(.*)$/))) { flush(); const l = m[1].length + 1; html += `<h${l}>${inl(m[2])}</h${l}>`; i++; continue; }
    if (/^>\s?/.test(ln)) {
      flush(); const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      html += '<blockquote>' + inl(buf.join('\n')).replace(/\n/g, '<br>') + '</blockquote>'; continue;
    }
    if (/^\s*[-*+]\s+/.test(ln)) {
      flush(); const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*+]\s+/, ''));
      html += '<ul>' + items.map((x) => '<li>' + inl(x) + '</li>').join('') + '</ul>'; continue;
    }
    if (/^\s*\d+[.)]\s+/.test(ln)) {
      flush(); const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''));
      html += '<ol>' + items.map((x) => '<li>' + inl(x) + '</li>').join('') + '</ol>'; continue;
    }
    if (/^\s*$/.test(ln)) { flush(); i++; continue; }
    para.push(ln); i++;
  }
  flush();
  return html;
}

/* Small view helpers */
function avatar(p, size = 'md') {
  const name = (p && p.username) || '?';
  const initial = esc(name.charAt(0).toUpperCase());
  const hue = Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  if (p && p.avatar_url && isHttpUrl(p.avatar_url))
    return `<img class="avatar ${size}" src="${esc(p.avatar_url)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-initial="${initial}" style="--h:${hue}">`;
  return `<span class="avatar ${size}" style="--h:${hue}" aria-hidden="true">${initial}</span>`;
}
const userLink = (a) => `profile.html?u=${encodeURIComponent((a && a.username) || '')}`;
const tagsHtml = (tags) => (tags || []).map((t) => `<a class="tag" href="index.html?tag=${encodeURIComponent(t)}">#${esc(t)}</a>`).join('');
const catBadge = (c, extra = '') => `<a class="cat ${extra}" data-cat="${esc(c)}" href="index.html?cat=${encodeURIComponent(c)}">${esc(c)}</a>`;
const skelItem = () => '<div class="post-item"><div class="thumb sk"></div><div class="pi-body"><div class="sk sk-line w30"></div><div class="sk sk-line w80 h20"></div><div class="sk sk-line"></div><div class="sk sk-line w60"></div></div></div>';
const skeletonList = (n = 4) => Array.from({ length: n }, skelItem).join('');
const emptyState = (icon, title, text = '', actions = '') =>
  `<div class="empty"><div class="empty-ico" aria-hidden="true">${icon}</div><h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}${actions ? `<div class="empty-actions">${actions}</div>` : ''}</div>`;
const errorState = (msg) => emptyState('⚠️', 'Couldn’t load this', msg, '<button class="btn btn-primary" data-action="retry">Try again</button>');
const setupState = () => emptyState('⚙️', libLoaded ? 'Supabase isn’t connected yet' : 'Couldn’t load the Supabase library',
  libLoaded ? 'Open app.js and set SUPABASE_URL and SUPABASE_ANON_KEY. README.md explains where to find them.'
            : 'The Supabase script from the CDN was blocked or offline. Check your connection or ad blocker and reload.');

/* Broken images fall back to the gradient/initial underneath */
document.addEventListener('error', (e) => {
  const el = e.target;
  if (!(el instanceof HTMLImageElement)) return;
  if (el.classList.contains('avatar')) {
    const s = document.createElement('span');
    s.className = el.className; s.setAttribute('style', el.getAttribute('style') || ''); s.textContent = el.dataset.initial || '?';
    el.replaceWith(s);
  } else { el.style.display = 'none'; }
}, true);

/* ───────────── 3. AUTH ───────────── */
const state = { session: null, user: null, profile: null };
const pageHooks = {};                                  // each page registers: onAuth, retry, editPost, deletePost, editProfile, afterEdit
let authReadyResolve; const authReady = new Promise((r) => { authReadyResolve = r; });

async function ensureProfile(user) {
  try {
    const { data, error } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error) throw error;
    if (data) return data;
    // Fallback if the DB trigger hasn't created it (e.g. user created before the SQL was run)
    const meta = user.user_metadata || {};
    let base = String(meta.username || (user.email || 'user').split('@')[0]).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 18);
    if (base.length < 3) base = 'user' + base;
    const row = { id: user.id, username: base + Math.floor(1000 + Math.random() * 9000), avatar_url: meta.avatar_url || meta.picture || null };
    const ins = await sb.from('profiles').insert(row).select().single();
    if (ins.error) throw ins.error;
    return ins.data;
  } catch (e) {
    console.error('ensureProfile:', e);
    return { id: user.id, username: (user.email || 'user').split('@')[0].slice(0, 24), avatar_url: null, bio: null, _fallback: true };
  }
}
async function applySession(s) {
  state.session = s; state.user = (s && s.user) || null;
  state.profile = state.user ? await ensureProfile(state.user) : null;
  renderUserMenu();
}
async function loadAuth() {
  if (!sb) { renderUserMenu(); authReadyResolve(); return; }
  try {
    const { data } = await sb.auth.getSession();
    await applySession(data.session);
  } catch (e) { console.error('getSession:', e); renderUserMenu(); }
  authReadyResolve();
  sb.auth.onAuthStateChange((event, s) => {
    if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
    const prev = state.user && state.user.id;
    // Defer: calling supabase inside this callback can deadlock the auth lock
    setTimeout(async () => {
      await applySession(s);
      if (prev !== (state.user && state.user.id) && pageHooks.onAuth) pageHooks.onAuth(!!state.user);
    }, 0);
  });
}
function goAuth(mode = 'login') {
  session.set('bf_next', (location.pathname.split('/').pop() || 'index.html') + location.search);
  location.href = 'auth.html' + (mode === 'signup' ? '?mode=signup' : '');
}
function consumeNext() {
  const n = session.get('bf_next'); session.del('bf_next');
  return /^[\w.-]+\.html(\?[\w%=&.\-]*)?$/.test(n || '') ? n : 'index.html';
}
function requireAuth() {
  if (state.user) return true;
  toast('Log in to do that.', 'info');
  setTimeout(() => goAuth(), 700);
  return false;
}
async function logout() {
  if (!sb) return;
  const { error } = await sb.auth.signOut();
  if (error) return toast(errMsg(error), 'error');
  goAuth();
}

/* ───────────── 4. LAYOUT / UI ───────────── */
function renderLayout() {
  const h = $('#siteHeader');
  if (h) {
    h.innerHTML = `<div class="container header-inner">
      <button class="icon-btn menu-btn" data-action="menu" aria-label="Toggle menu" aria-expanded="false">☰</button>
      <a class="logo" href="index.html" aria-label="${esc(SITE_NAME)} home"><span class="logo-mark" aria-hidden="true">&lt;/&gt;</span><span>Byte<b>Forge</b></span></a>
      <nav class="main-nav" id="mainNav" aria-label="Categories">
        <a href="index.html" data-nav="home">Home</a>
        ${CATEGORIES.map((c) => `<a href="index.html?cat=${c}" data-nav="${c}">${c}</a>`).join('')}
      </nav>
      <form class="search" id="searchForm" role="search">
        <input type="search" id="searchInput" placeholder="Search posts…" aria-label="Search posts" maxlength="80" autocomplete="off">
        <button type="submit" aria-label="Search">🔍</button>
      </form>
      <div class="header-actions">
        <button class="icon-btn" data-action="theme" id="themeBtn" aria-label="Toggle light and dark theme"></button>
        <div id="userMenu"><span class="sk sk-pill" aria-hidden="true"></span></div>
      </div>
    </div>`;
    const page = document.body.dataset.page, cat = params.get('cat');
    $$('.main-nav a', h).forEach((a) => {
      const on = page === 'home' && (a.dataset.nav === 'home' ? !cat && !params.get('q') && !params.get('tag') : a.dataset.nav === cat);
      a.classList.toggle('active', on); if (on) a.setAttribute('aria-current', 'page');
    });
    updateThemeBtn();
  }
  const f = $('#siteFooter');
  if (f) f.innerHTML = `<div class="container footer-inner">
    <a class="logo" href="index.html"><span class="logo-mark" aria-hidden="true">&lt;/&gt;</span><span>Byte<b>Forge</b></span></a>
    <nav class="footer-links" aria-label="Footer">${CATEGORIES.map((c) => `<a href="index.html?cat=${c}">${c}</a>`).join('')}<a href="auth.html">Account</a></nav>
    <p class="footer-note">© ${new Date().getFullYear()} ${esc(SITE_NAME)}. An independent community project, inspired by tech forums such as XDA. Not affiliated with XDA.</p>
  </div>`;
  if (!configured) { const b = $('#configBanner'); if (b) b.hidden = false; }
}
function renderUserMenu() {
  const box = $('#userMenu'); if (!box) return;
  if (!state.user) {
    box.innerHTML = '<a class="btn btn-ghost btn-sm" href="auth.html">Log in</a><a class="btn btn-primary btn-sm" href="auth.html?mode=signup">Sign up</a>';
    return;
  }
  const p = state.profile || { username: 'me' };
  box.innerHTML = `<button class="btn btn-primary btn-sm" data-action="write">✎ <span class="hide-sm">Write</span></button>
    <div class="user-wrap">
      <button class="avatar-btn" data-action="user" aria-haspopup="menu" aria-expanded="false" aria-label="Account menu">${avatar(p, 'sm')}</button>
      <div class="dropdown" id="userDrop" role="menu" hidden>
        <div class="dd-head"><b>${esc(p.username)}</b><span class="muted">${esc(state.user.email || '')}</span></div>
        <a role="menuitem" href="profile.html">👤 My profile</a>
        <button role="menuitem" data-action="logout">⎋ Log out</button>
      </div>
    </div>`;
}
function updateThemeBtn() {
  const b = $('#themeBtn'); if (!b) return;
  const light = document.documentElement.dataset.theme === 'light';
  b.textContent = light ? '🌙' : '☀️'; b.title = light ? 'Switch to dark theme' : 'Switch to light theme';
}
function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next; local.set('bf_theme', next); updateThemeBtn();
}

/* Modals */
let activeModal = null, lastFocus = null;
function openModal(html, { wide = false, label = '' } = {}) {
  closeModal();
  lastFocus = document.activeElement;
  const o = document.createElement('div');
  o.className = 'modal-overlay';
  o.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(label)}">${html}</div>`;
  document.body.appendChild(o); document.body.classList.add('modal-open');
  o.addEventListener('mousedown', (e) => { if (e.target === o) closeModal(); });
  activeModal = o;
  const first = $('input, textarea, select, button.btn', o.firstElementChild); if (first) first.focus();
  return o.firstElementChild;
}
function closeModal() {
  if (!activeModal) return;
  const o = activeModal; activeModal = null;
  o.remove(); document.body.classList.remove('modal-open');
  if (o._onClose) o._onClose();
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
function confirmDialog(message, okLabel = 'Delete') {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; closeModal(); resolve(v); };
    const m = openModal(`<div class="modal-head"><h2>Are you sure?</h2></div><p class="confirm-text">${esc(message)}</p>
      <div class="modal-actions"><button class="btn btn-ghost" data-k="no">Cancel</button><button class="btn btn-danger" data-k="yes">${esc(okLabel)}</button></div>`, { label: 'Confirm' });
    m.addEventListener('click', (e) => { const k = e.target.closest('[data-k]'); if (k) finish(k.dataset.k === 'yes'); });
    activeModal._onClose = () => finish(false);
  });
}

/* Global event wiring */
function bindGlobal() {
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-wrap')) { const d = $('#userDrop'); if (d) d.hidden = true; }
    const t = e.target.closest('[data-action]'); if (!t) return;
    const a = t.dataset.action;
    if (a === 'menu') { const open = $('#siteHeader').classList.toggle('nav-open'); t.setAttribute('aria-expanded', String(open)); }
    else if (a === 'theme') toggleTheme();
    else if (a === 'user') { const d = $('#userDrop'); if (d) { d.hidden = !d.hidden; t.setAttribute('aria-expanded', String(!d.hidden)); } }
    else if (a === 'write') openEditor();
    else if (a === 'logout') logout();
    else if (a === 'close-modal') closeModal();
    else if (a === 'retry' && pageHooks.retry) pageHooks.retry();
    else if (a === 'edit-post' && pageHooks.editPost) pageHooks.editPost();
    else if (a === 'delete-post' && pageHooks.deletePost) pageHooks.deletePost();
    else if (a === 'edit-profile' && pageHooks.editProfile) pageHooks.editProfile();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (activeModal) closeModal();
    const d = $('#userDrop'); if (d) d.hidden = true;
    $('#siteHeader')?.classList.remove('nav-open');
  });
  document.addEventListener('submit', (e) => {
    if (e.target.id !== 'searchForm') return;
    e.preventDefault();
    const v = $('#searchInput').value.trim();
    location.href = v ? 'index.html?q=' + encodeURIComponent(v) : 'index.html';
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.error(e.reason);
    if (e.reason && e.reason.name === 'AbortError') return;
    toast(errMsg(e.reason), 'error');
  });
}

/* ───────────── 5. POSTS (CRUD) ───────────── */
const POST_SELECT = '*, author:profiles(id,username,avatar_url,bio), comments(count)';

async function fetchPosts({ category, q, tag, authorId, page = 0, size = PAGE_SIZE, orderBy = 'created_at' } = {}) {
  let query = sb.from('posts').select(POST_SELECT, { count: 'exact' });
  if (category) query = query.eq('category', category);
  if (authorId) query = query.eq('author_id', authorId);
  if (tag) query = query.contains('tags', [tag]);
  if (q) {
    const s = q.replace(/[%,()*\\"]/g, ' ').trim();
    if (s) query = query.or(`title.ilike.%${s}%,content.ilike.%${s}%`);
  }
  if (orderBy !== 'created_at') query = query.order(orderBy, { ascending: false });
  query = query.order('created_at', { ascending: false }).range(page * size, page * size + size - 1);
  const { data, error, count } = await query;
  if (error) throw error;
  return { posts: data || [], total: count ?? 0 };
}
async function fetchPost(id) {
  const { data, error } = await sb.from('posts').select(POST_SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}
async function createPost(v) {
  const { data, error } = await sb.from('posts').insert({ author_id: state.user.id, ...v }).select('id').single();
  if (error) throw error;
  return data;
}
async function updatePost(id, v) {
  const { data, error } = await sb.from('posts').update(v).eq('id', id).select('id').single();
  if (error) throw error;
  return data;
}
async function deletePost(id) {
  const { data, error } = await sb.from('posts').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data || !data.length) throw { code: 'PGRST116' };
}
function bumpViews(id) {
  const k = 'bf_viewed_' + id;
  if (session.get(k)) return;
  session.set(k, '1');
  sb.rpc('increment_post_views', { p_post_id: id }).then(() => {}, () => {});
}

/* Cards */
function thumbInner(p) {
  return `<span class="ph" aria-hidden="true">${CAT_ICON[p.category] || '📰'}</span>` +
    (p.cover_url && isHttpUrl(p.cover_url) ? `<img src="${esc(p.cover_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '');
}
function postItem(p) {
  const n = (p.comments && p.comments[0] && p.comments[0].count) || 0;
  return `<article class="post-item" data-cat="${esc(p.category)}">
    <a class="thumb" href="post.html?id=${esc(p.id)}" tabindex="-1" aria-hidden="true">${thumbInner(p)}</a>
    <div class="pi-body">
      <div class="pi-top">${catBadge(p.category)}<span class="muted">${timeAgo(p.created_at)}</span></div>
      <h3><a href="post.html?id=${esc(p.id)}">${esc(p.title)}</a></h3>
      <p class="excerpt">${esc(excerpt(p.content))}</p>
      <div class="pi-meta">
        <a class="author" href="${userLink(p.author)}">${avatar(p.author, 'sm')}${esc((p.author && p.author.username) || 'unknown')}</a>
        <span title="Comments">💬 ${n}</span><span title="Views">👁 ${p.views || 0}</span>
        <span>${readTime(p.content)} min read</span>
      </div>
    </div></article>`;
}
function featCard(p, big) {
  const n = (p.comments && p.comments[0] && p.comments[0].count) || 0;
  return `<a class="feat-card" data-cat="${esc(p.category)}" href="post.html?id=${esc(p.id)}">
    <span class="feat-ph" aria-hidden="true">${CAT_ICON[p.category] || '📰'}</span>
    ${p.cover_url && isHttpUrl(p.cover_url) ? `<img src="${esc(p.cover_url)}" alt="" ${big ? '' : 'loading="lazy"'} referrerpolicy="no-referrer">` : ''}
    <div class="feat-body"><span class="cat on-media">${esc(p.category)}</span><h3>${esc(p.title)}</h3>
      <div class="feat-meta"><span>${esc((p.author && p.author.username) || 'unknown')}</span><span>${timeAgo(p.created_at)}</span><span>💬 ${n}</span></div></div></a>`;
}
function ctaWidget() {
  return state.user
    ? '<div class="widget cta"><h3>Got something to share?</h3><p>Publish news, a review, a tutorial or start a discussion.</p><button class="btn btn-primary btn-block" data-action="write">✎ Write a post</button></div>'
    : '<div class="widget cta"><h3>Join the community</h3><p>Create a free account to publish posts and join the discussion.</p><a class="btn btn-primary btn-block" href="auth.html?mode=signup">Create account</a></div>';
}

/* Paginated feed used by home + profile */
function createFeed({ list, more, filters, empty }) {
  let page = 0, busy = false;
  async function load(reset) {
    if (busy) return; busy = true;
    if (reset) { page = 0; list.innerHTML = skeletonList(4); more.hidden = true; }
    more.disabled = true; more.textContent = 'Loading…';
    try {
      const { posts, total } = await fetchPosts({ ...filters(), page });
      if (reset) list.innerHTML = '';
      if (!posts.length && reset) list.innerHTML = empty();
      else list.insertAdjacentHTML('beforeend', posts.map(postItem).join(''));
      page++;
      more.hidden = page * PAGE_SIZE >= total;
    } catch (e) {
      console.error(e);
      if (reset) list.innerHTML = errorState(errMsg(e)); else toast(errMsg(e), 'error');
    } finally { busy = false; more.disabled = false; more.textContent = 'Load more'; }
  }
  more.addEventListener('click', () => load(false));
  pageHooks.retry = () => load(true);
  return { load, get page() { return page; } };
}

/* ───────────── 6. COMMENTS (CRUD + nesting + realtime) ───────────── */
async function fetchComments(postId) {
  const { data, error } = await sb.from('comments').select('*, author:profiles(id,username,avatar_url)').eq('post_id', postId).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}
async function createComment(postId, content, parentId) {
  const { error } = await sb.from('comments').insert({ post_id: postId, author_id: state.user.id, parent_id: parentId || null, content });
  if (error) throw error;
}
async function updateComment(id, content) {
  const { data, error } = await sb.from('comments').update({ content }).eq('id', id).select('id');
  if (error) throw error;
  if (!data || !data.length) throw { code: 'PGRST116' };
}
async function deleteComment(id) {
  const { data, error } = await sb.from('comments').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data || !data.length) throw { code: 'PGRST116' };
}
function buildTree(list) {
  const map = new Map(list.map((c) => [c.id, { ...c, children: [] }]));
  const roots = [];
  map.forEach((c) => { const p = c.parent_id && map.get(c.parent_id); (p ? p.children : roots).push(c); });
  return roots;
}

/* ───────────── 7. EDITOR + PROFILE MODALS ───────────── */
function mdApply(ta, kind) {
  const map = { b: ['**', '**', 'bold text'], i: ['*', '*', 'italic text'], code: ['`', '`', 'code'], link: ['[', '](https://)', 'link text'],
    h: ['\n## ', '', 'Heading'], ul: ['\n- ', '', 'List item'], q: ['\n> ', '', 'Quote'] };
  const [a, b, ph] = map[kind]; if (!a && !b) return;
  const s = ta.selectionStart, e = ta.selectionEnd;
  ta.setRangeText(a + (ta.value.slice(s, e) || ph) + b, s, e, 'end');
  ta.focus(); ta.dispatchEvent(new Event('input'));
}
function openEditor(post = null) {
  if (!requireAuth()) return;
  const editing = !!post;
  const m = openModal(`
    <div class="modal-head"><h2>${editing ? 'Edit post' : 'Write a new post'}</h2><button class="icon-btn" data-action="close-modal" aria-label="Close">✕</button></div>
    <form id="edForm" novalidate>
      <div class="form-row"><label for="edTitle">Title</label>
        <input type="text" id="edTitle" maxlength="200" placeholder="A clear, descriptive headline" value="${esc(post ? post.title : '')}"></div>
      <div class="form-grid">
        <div class="form-row"><label for="edCat">Category</label>
          <select id="edCat">${CATEGORIES.map((c) => `<option ${post && post.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        <div class="form-row"><label for="edTags">Tags <span class="hint">comma separated, max 8</span></label>
          <input type="text" id="edTags" placeholder="android, root, pixel" value="${esc(post ? (post.tags || []).join(', ') : '')}"></div>
      </div>
      <div class="form-row"><label for="edCover">Cover image URL <span class="hint">optional</span></label>
        <input type="url" id="edCover" placeholder="https://example.com/image.jpg" value="${esc(post && post.cover_url ? post.cover_url : '')}">
        <div class="cover-preview" id="edPrev" hidden></div></div>
      <div class="form-row">
        <div class="ed-bar">
          <button type="button" class="tab on" data-ed="write">Write</button><button type="button" class="tab" data-ed="preview">Preview</button>
          <span class="ed-tools" id="edTools">
            <button type="button" data-md="b" title="Bold" aria-label="Bold"><b>B</b></button><button type="button" data-md="i" title="Italic" aria-label="Italic"><i>I</i></button>
            <button type="button" data-md="h" title="Heading" aria-label="Heading">H</button><button type="button" data-md="link" title="Link" aria-label="Link">🔗</button>
            <button type="button" data-md="code" title="Code" aria-label="Code">&lt;/&gt;</button><button type="button" data-md="ul" title="List" aria-label="List">•</button>
            <button type="button" data-md="q" title="Quote" aria-label="Quote">❝</button></span>
        </div>
        <textarea id="edBody" rows="12" maxlength="50000" placeholder="Write your post. Markdown is supported: **bold**, *italic*, ## headings, - lists, [links](https://…)">${esc(post ? post.content : '')}</textarea>
        <div class="prose preview" id="edPreview" hidden></div>
      </div>
      <p class="form-err" id="edErr" role="alert"></p>
      <div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Cancel</button>
        <button type="submit" class="btn btn-primary" id="edSave">${editing ? 'Save changes' : 'Publish'}</button></div>
    </form>`, { wide: true, label: editing ? 'Edit post' : 'New post' });

  const body = $('#edBody', m), prev = $('#edPreview', m), tools = $('#edTools', m), err = $('#edErr', m);
  const coverIn = $('#edCover', m), coverPrev = $('#edPrev', m);
  const showCover = () => {
    const u = coverIn.value.trim();
    coverPrev.hidden = !isHttpUrl(u);
    if (!coverPrev.hidden) coverPrev.innerHTML = `<img src="${esc(u)}" alt="Cover preview" referrerpolicy="no-referrer">`;
  };
  coverIn.addEventListener('input', debounce(showCover, 400)); showCover();
  $$('[data-ed]', m).forEach((b) => b.addEventListener('click', () => {
    const pv = b.dataset.ed === 'preview';
    $$('[data-ed]', m).forEach((x) => x.classList.toggle('on', x === b));
    body.hidden = pv; prev.hidden = !pv; tools.hidden = pv;
    if (pv) prev.innerHTML = renderContent(body.value) || '<p class="muted">Nothing to preview yet.</p>';
  }));
  tools.addEventListener('click', (e) => { const b = e.target.closest('[data-md]'); if (b) mdApply(body, b.dataset.md); });

  $('#edForm', m).addEventListener('submit', async (e) => {
    e.preventDefault(); err.textContent = '';
    const title = $('#edTitle', m).value.trim(), content = body.value.trim();
    const category = $('#edCat', m).value, tags = parseTags($('#edTags', m).value), cover = coverIn.value.trim();
    if (title.length < 3) return void (err.textContent = 'Title needs at least 3 characters.');
    if (content.length < 10) return void (err.textContent = 'Content needs at least 10 characters.');
    if (cover && !isHttpUrl(cover)) return void (err.textContent = 'Cover image must be a full http(s) URL, or leave it empty.');
    const btn = $('#edSave', m); btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const values = { title, content, category, tags, cover_url: cover || null };
      if (editing) {
        await updatePost(post.id, values); closeModal(); toast('Post updated.', 'success');
        if (pageHooks.afterEdit) pageHooks.afterEdit(); else location.href = 'post.html?id=' + post.id;
      } else {
        const { id } = await createPost(values); toast('Post published.', 'success');
        setTimeout(() => { location.href = 'post.html?id=' + id; }, 500);
      }
    } catch (ex) { console.error(ex); err.textContent = errMsg(ex); btn.disabled = false; btn.textContent = editing ? 'Save changes' : 'Publish'; }
  });
}

function openProfileEditor(profile, onSaved) {
  const m = openModal(`
    <div class="modal-head"><h2>Edit profile</h2><button class="icon-btn" data-action="close-modal" aria-label="Close">✕</button></div>
    <form id="pfForm" novalidate>
      <div class="form-row"><label for="pfUser">Username <span class="hint">3–24 letters, numbers or underscore</span></label>
        <input type="text" id="pfUser" maxlength="24" value="${esc(profile.username)}" autocomplete="username"></div>
      <div class="form-row"><label for="pfAvatar">Avatar URL <span class="hint">optional</span></label>
        <input type="url" id="pfAvatar" placeholder="https://example.com/me.png" value="${esc(profile.avatar_url || '')}"></div>
      <div class="form-row"><label for="pfBio">Bio</label>
        <textarea id="pfBio" rows="4" maxlength="280" placeholder="Tell people what you tinker with.">${esc(profile.bio || '')}</textarea>
        <div class="counter" id="pfCount">0 / 280</div></div>
      <p class="form-err" id="pfErr" role="alert"></p>
      <div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Cancel</button>
        <button type="submit" class="btn btn-primary" id="pfSave">Save changes</button></div>
    </form>`, { label: 'Edit profile' });
  const bio = $('#pfBio', m), count = $('#pfCount', m), err = $('#pfErr', m);
  const upd = () => { count.textContent = bio.value.length + ' / 280'; }; bio.addEventListener('input', upd); upd();
  $('#pfForm', m).addEventListener('submit', async (e) => {
    e.preventDefault(); err.textContent = '';
    const username = $('#pfUser', m).value.trim(), avatarUrl = $('#pfAvatar', m).value.trim(), bioV = bio.value.trim();
    if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) return void (err.textContent = 'Username must be 3–24 characters: letters, numbers or underscore.');
    if (avatarUrl && !isHttpUrl(avatarUrl)) return void (err.textContent = 'Avatar must be a full http(s) URL, or leave it empty.');
    const btn = $('#pfSave', m); btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const { data, error } = await sb.from('profiles').update({ username, avatar_url: avatarUrl || null, bio: bioV || null }).eq('id', state.user.id).select().single();
      if (error) throw error;
      state.profile = data; renderUserMenu(); closeModal(); toast('Profile saved.', 'success'); onSaved(data);
    } catch (ex) {
      console.error(ex);
      err.textContent = ex && ex.code === '23505' ? 'That username is already taken.' : errMsg(ex);
      btn.disabled = false; btn.textContent = 'Save changes';
    }
  });
}

/* ───────────── 8. PAGES ───────────── */

/* ---- Home ---- */
async function initHome() {
  const cat = CATEGORIES.includes(params.get('cat')) ? params.get('cat') : '';
  const q = (params.get('q') || '').trim().slice(0, 80);
  const tag = (params.get('tag') || '').trim().toLowerCase().replace(/[^a-z0-9\-_.+]/g, '').slice(0, 24);
  const filtered = !!(cat || q || tag);
  const list = $('#postList'), more = $('#loadMore'), feat = $('#featured');

  $('#feedTitle').textContent = q ? `Results for “${q}”` : tag ? `Tagged #${tag}` : cat || 'Latest';
  if (q) $('#searchInput').value = q;
  $('#chips').innerHTML = ['All', ...CATEGORIES].map((c) => {
    const on = c === 'All' ? !cat : c === cat;
    return `<a class="chip ${on ? 'on' : ''}" href="${c === 'All' ? 'index.html' : 'index.html?cat=' + c}">${c}</a>`;
  }).join('');
  if (filtered) {
    feat.hidden = true;
    const note = $('#filterNote'); note.hidden = false;
    note.innerHTML = `Showing ${q ? `matches for “${esc(q)}”` : tag ? `posts tagged #${esc(tag)}` : `the ${esc(cat)} category`}. <a href="index.html">Clear filter</a>`;
  }
  $('#sidebar').innerHTML = '<div id="ctaSlot"></div>' +
    `<div class="widget"><h3>Categories</h3><ul class="cat-list">${CATEGORIES.map((c) => `<li><a href="index.html?cat=${c}">${CAT_ICON[c]} ${c}<span class="count" data-count="${c}"></span></a></li>`).join('')}</ul></div>
     <div class="widget"><h3>Popular tags</h3><div class="tag-cloud" id="tagCloud"><span class="muted">Loading…</span></div></div>`;
  const renderCta = () => { $('#ctaSlot').innerHTML = ctaWidget(); };
  renderCta(); pageHooks.onAuth = renderCta;

  if (!sb) { more.hidden = true; list.innerHTML = setupState(); feat.hidden = true; $('#tagCloud').innerHTML = '<span class="muted">Connect Supabase to see tags.</span>'; return; }

  const feed = createFeed({
    list, more, filters: () => ({ category: cat, q, tag }),
    empty: () => filtered
      ? emptyState('🔎', 'Nothing found', 'Try a different search or browse another category.', '<a class="btn btn-ghost" href="index.html">Back to all posts</a>')
      : emptyState('✍️', 'No posts yet', 'Be the first to publish something.', state.user ? '<button class="btn btn-primary" data-action="write">✎ Write a post</button>' : '<a class="btn btn-primary" href="auth.html?mode=signup">Create account</a>'),
  });

  async function loadFeatured() {
    if (filtered) return;
    feat.hidden = false;
    feat.innerHTML = '<div class="feat-grid" data-n="3"><div class="sk feat-card"></div><div class="sk feat-card"></div><div class="sk feat-card"></div></div>';
    try {
      const { posts } = await fetchPosts({ size: 5, orderBy: 'views' });
      if (!posts.length) { feat.hidden = true; return; }
      feat.innerHTML = `<div class="section-head"><h2>Featured</h2></div><div class="feat-grid" data-n="${posts.length}">${posts.map((p, i) => featCard(p, i === 0)).join('')}</div>`;
    } catch (e) { console.error(e); feat.hidden = true; }
  }
  async function loadSidebarData() {
    CATEGORIES.forEach(async (c) => {
      const { count } = await sb.from('posts').select('id', { count: 'exact', head: true }).eq('category', c);
      const el = $(`[data-count="${c}"]`); if (el && count != null) el.textContent = count;
    });
    const cloud = $('#tagCloud');
    const { data, error } = await sb.from('posts').select('tags').order('created_at', { ascending: false }).limit(100);
    const freq = {}; (data || []).forEach((r) => (r.tags || []).forEach((t) => { freq[t] = (freq[t] || 0) + 1; }));
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([t]) => t);
    cloud.innerHTML = error ? '<span class="muted">Couldn’t load tags.</span>' : top.length ? tagsHtml(top) : '<span class="muted">No tags yet.</span>';
  }

  await Promise.all([loadFeatured(), feed.load(true)]);
  loadSidebarData().catch((e) => console.error(e));

  // Realtime: tell readers when someone publishes
  sb.channel('posts-feed').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, (pl) => {
    if (state.user && pl.new && pl.new.author_id === state.user.id) return;
    toast('A new post was just published.', 'info');
    if (feed.page <= 1) { loadFeatured(); feed.load(true); }
  }).subscribe();
}

/* ---- Post detail ---- */
async function initPost() {
  const root = $('#postRoot'), cSec = $('#comments'), sidebar = $('#sidebar');
  const id = params.get('id') || '';
  if (!sb) { root.innerHTML = setupState(); return; }
  if (!UUID_RE.test(id)) { root.innerHTML = emptyState('🧭', 'Post not found', 'This link looks broken.', '<a class="btn btn-primary" href="index.html">Back to home</a>'); return; }

  let post = null, comments = [], commentsStarted = false;
  const isOwner = () => !!(state.user && post && post.author_id === state.user.id);

  function renderPost() {
    const a = post.author || { username: 'unknown' };
    root.innerHTML = `
      <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><a href="index.html?cat=${encodeURIComponent(post.category)}">${esc(post.category)}</a></nav>
      <header class="post-head">
        ${catBadge(post.category)}
        <h1>${esc(post.title)}</h1>
        <div class="post-meta">
          <a class="author" href="${userLink(a)}">${avatar(a, 'sm')}${esc(a.username)}</a>
          <time datetime="${esc(post.created_at)}">${fmtDate(post.created_at)}</time>
          ${new Date(post.updated_at) - new Date(post.created_at) > 60000 ? `<span>Edited ${timeAgo(post.updated_at)}</span>` : ''}
          <span>${readTime(post.content)} min read</span><span>👁 ${post.views || 0} views</span>
        </div>
        <div class="owner-actions" id="ownerSlot"></div>
      </header>
      ${post.cover_url && isHttpUrl(post.cover_url) ? `<figure class="cover"><img src="${esc(post.cover_url)}" alt="" referrerpolicy="no-referrer"></figure>` : ''}
      <div class="prose">${renderContent(post.content)}</div>
      ${(post.tags || []).length ? `<div class="tags">${tagsHtml(post.tags)}</div>` : ''}`;
    renderOwner();
    renderSidebar();
  }
  function renderOwner() {
    const s = $('#ownerSlot'); if (!s) return;
    s.innerHTML = isOwner() ? '<button class="btn btn-ghost btn-sm" data-action="edit-post">✎ Edit</button><button class="btn btn-danger btn-sm" data-action="delete-post">🗑 Delete</button>' : '';
  }
  function renderSidebar() {
    const a = post.author || { username: 'unknown' };
    sidebar.innerHTML = '<div id="ctaSlot">' + ctaWidget() + '</div>' +
      `<div class="widget"><h3>About the author</h3><a class="author-box" href="${userLink(a)}">${avatar(a, 'lg')}<span><b>${esc(a.username)}</b><small class="muted">${a.bio ? esc(a.bio.slice(0, 120)) : 'View profile'}</small></span></a></div>
       <div class="widget"><h3>More in ${esc(post.category)}</h3><div class="mini-list" id="related"><span class="muted">Loading…</span></div></div>`;
    fetchPosts({ category: post.category, size: 5 }).then(({ posts }) => {
      const rel = posts.filter((p) => p.id !== post.id).slice(0, 4);
      $('#related').innerHTML = rel.length ? rel.map((p) => `<a href="post.html?id=${esc(p.id)}">${esc(p.title)}<small>${timeAgo(p.created_at)}</small></a>`).join('') : '<span class="muted">Nothing else here yet.</span>';
    }).catch(() => { const r = $('#related'); if (r) r.innerHTML = '<span class="muted">Couldn’t load related posts.</span>'; });
  }

  async function loadPost() {
    root.innerHTML = '<div class="sk sk-line w30"></div><div class="sk sk-line w80 h20"></div><div class="sk sk-block"></div><div class="sk sk-line"></div><div class="sk sk-line w60"></div>';
    try {
      post = await fetchPost(id);
      if (!post) { root.innerHTML = emptyState('🧭', 'Post not found', 'It may have been deleted.', '<a class="btn btn-primary" href="index.html">Back to home</a>'); sidebar.innerHTML = ''; return; }
      document.title = `${post.title} · ${SITE_NAME}`;
      renderPost();
      if (!commentsStarted) { commentsStarted = true; startComments(); bumpViews(post.id); } else scheduleReload();
    } catch (e) { console.error(e); root.innerHTML = errorState(errMsg(e)); }
  }
  pageHooks.retry = loadPost;
  pageHooks.afterEdit = loadPost;
  pageHooks.editPost = () => { if (isOwner()) openEditor(post); };
  pageHooks.deletePost = async () => {
    if (!isOwner()) return;
    if (!(await confirmDialog('This permanently deletes the post and all of its comments.', 'Delete post'))) return;
    try { await deletePost(post.id); toast('Post deleted.', 'success'); setTimeout(() => { location.href = 'index.html'; }, 600); }
    catch (e) { console.error(e); toast(errMsg(e), 'error'); }
  };

  /* --- comments --- */
  function renderCommentForm() {
    const slot = $('#commentFormSlot');
    if (!state.user) { slot.innerHTML = '<div class="c-login"><a href="auth.html" id="cLogin">Log in</a> or <a href="auth.html?mode=signup" id="cSignup">sign up</a> to join the discussion.</div>'; $('#cLogin').onclick = (e) => { e.preventDefault(); goAuth(); }; $('#cSignup').onclick = (e) => { e.preventDefault(); goAuth('signup'); }; return; }
    slot.innerHTML = `<div class="c-new">${avatar(state.profile, 'md')}<form id="cForm"><textarea id="cText" rows="3" maxlength="2000" placeholder="Add a comment. Markdown works here too." aria-label="Add a comment"></textarea>
      <div class="c-form-actions"><button class="btn btn-primary btn-sm" type="submit">Post comment</button></div></form></div>`;
    $('#cForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const ta = $('#cText'), text = ta.value.trim(), btn = e.target.querySelector('button');
      if (!text) { ta.setAttribute('aria-invalid', 'true'); ta.focus(); return; }
      ta.removeAttribute('aria-invalid'); btn.disabled = true; btn.textContent = 'Posting…';
      try { await createComment(post.id, text, null); ta.value = ''; toast('Comment posted.', 'success'); scheduleReload(); }
      catch (ex) { console.error(ex); toast(errMsg(ex), 'error'); }
      finally { btn.disabled = false; btn.textContent = 'Post comment'; }
    });
  }
  function commentHtml(c, depth) {
    const mine = state.user && state.user.id === c.author_id, a = c.author || { username: 'unknown' };
    const edited = c.updated_at && new Date(c.updated_at) - new Date(c.created_at) > 1000;
    return `<li class="comment ${depth >= MAX_DEPTH ? 'flat' : ''}" id="c-${esc(c.id)}" data-id="${esc(c.id)}">
      <div class="c-head">${avatar(a, 'sm')}<a class="c-user" href="${userLink(a)}">${esc(a.username)}</a>${post.author_id === c.author_id ? '<span class="badge-op">Author</span>' : ''}
        <time class="muted" datetime="${esc(c.created_at)}" title="${esc(new Date(c.created_at).toLocaleString())}">${timeAgo(c.created_at)}</time>${edited ? '<span class="muted">edited</span>' : ''}</div>
      <div class="c-body prose sm">${renderContent(c.content, { images: false })}</div>
      <div class="c-actions"><button class="link-btn" data-c="reply">Reply</button>${mine ? '<button class="link-btn" data-c="edit">Edit</button><button class="link-btn" data-c="delete">Delete</button>' : ''}</div>
      <div class="c-form-slot"></div>
      ${c.children.length ? `<ul class="c-children">${c.children.map((x) => commentHtml(x, depth + 1)).join('')}</ul>` : ''}</li>`;
  }
  function openForm(li, mode, value, focus = true) {
    const slot = $('.c-form-slot', li);
    $$('.c-form-slot').forEach((s) => { if (s !== slot) s.innerHTML = ''; });
    slot.innerHTML = `<form class="c-form" data-mode="${mode}"><textarea rows="3" maxlength="2000" aria-label="${mode === 'edit' ? 'Edit comment' : 'Write a reply'}" placeholder="Write a reply…"></textarea>
      <div class="c-form-actions"><button type="button" class="btn btn-ghost btn-sm" data-c="cancel">Cancel</button><button type="submit" class="btn btn-primary btn-sm">${mode === 'edit' ? 'Save' : 'Reply'}</button></div></form>`;
    const ta = $('textarea', slot); ta.value = value || '';
    if (focus) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  }
  function renderComments() {
    const open = $$('.c-form').map((f) => ({ id: f.closest('.comment').dataset.id, mode: f.dataset.mode, value: $('textarea', f).value })); // keep drafts across live updates
    $('#cCount').textContent = comments.length;
    const tree = buildTree(comments), list = $('#commentList');
    list.innerHTML = tree.length ? tree.map((c) => commentHtml(c, 0)).join('') : `<li>${emptyState('💬', 'No comments yet', 'Start the conversation.')}</li>`;
    open.forEach((o) => { const li = document.getElementById('c-' + o.id); if (li) openForm(li, o.mode, o.value, false); });
  }
  async function loadComments(silent) {
    try { comments = await fetchComments(post.id); renderComments(); }
    catch (e) { console.error(e); if (!silent) $('#commentList').innerHTML = `<li>${errorState(errMsg(e))}</li>`; else toast(errMsg(e), 'error'); }
  }
  const scheduleReload = debounce(() => loadComments(true), 250);

  function startComments() {
    cSec.hidden = false;
    renderCommentForm();
    $('#commentList').innerHTML = '<li><div class="sk sk-line w60"></div><div class="sk sk-line"></div></li>';
    loadComments(false);
    const list = $('#commentList');
    list.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-c]'); if (!b) return;
      const li = b.closest('.comment'), cid = li && li.dataset.id, act = b.dataset.c;
      if (act === 'cancel') { $('.c-form-slot', li).innerHTML = ''; return; }
      if (act === 'reply') { if (requireAuth()) openForm(li, 'reply', ''); return; }
      const c = comments.find((x) => x.id === cid); if (!c) return;
      if (act === 'edit') openForm(li, 'edit', c.content);
      if (act === 'delete') {
        const replies = comments.filter((x) => x.parent_id === cid).length;
        if (!(await confirmDialog(replies ? 'Deleting this comment also deletes the replies under it.' : 'This comment will be permanently deleted.', 'Delete comment'))) return;
        try { await deleteComment(cid); toast('Comment deleted.', 'success'); scheduleReload(); } catch (ex) { console.error(ex); toast(errMsg(ex), 'error'); }
      }
    });
    list.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target, li = f.closest('.comment'), ta = $('textarea', f), text = ta.value.trim(), btn = $('button[type=submit]', f);
      if (!text) { ta.setAttribute('aria-invalid', 'true'); ta.focus(); return; }
      btn.disabled = true;
      try {
        if (f.dataset.mode === 'edit') { await updateComment(li.dataset.id, text); toast('Comment updated.', 'success'); }
        else { await createComment(post.id, text, li.dataset.id); toast('Reply posted.', 'success'); }
        $('.c-form-slot', li).innerHTML = ''; scheduleReload();
      } catch (ex) { console.error(ex); toast(errMsg(ex), 'error'); btn.disabled = false; }
    });
    // Realtime: INSERT/UPDATE are filtered by post; DELETE events can't be filtered, so check the id
    const ch = sb.channel('comments-' + post.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments', filter: `post_id=eq.${post.id}` }, scheduleReload)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'comments', filter: `post_id=eq.${post.id}` }, scheduleReload)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comments' }, (pl) => { if (pl.old && comments.some((c) => c.id === pl.old.id)) scheduleReload(); })
      .subscribe();
    window.addEventListener('pagehide', () => { sb.removeChannel(ch); });
  }

  pageHooks.onAuth = () => { renderOwner(); const c = $('#ctaSlot'); if (c) c.innerHTML = ctaWidget(); if (commentsStarted) { renderCommentForm(); renderComments(); } };
  await loadPost();
}

/* ---- Auth page (login + signup; validation carried over from login.js / register.js) ---- */
function checkEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Enter a valid email address, like you@example.com.'; }
function checkPassword(v) {
  const missing = [];
  if (v.length < 6)     missing.push('at least 6 characters');
  if (!/[A-Z]/.test(v)) missing.push('1 uppercase letter');
  if (!/[a-z]/.test(v)) missing.push('1 lowercase letter');
  if (!/[0-9]/.test(v)) missing.push('1 number');
  return missing.length ? 'Password needs ' + missing.join(', ') + '.' : '';
}
function checkUsername(v) { return /^[A-Za-z0-9_]{3,24}$/.test(v) ? '' : 'Use 3–24 characters: letters, numbers or underscore.'; }

let redirecting = false;
function redirectAfterAuth() { if (redirecting) return; redirecting = true; location.replace(consumeNext()); }

async function initAuthPage() {
  const setError = (id, message) => { $('#' + id + 'Err').textContent = message; $('#' + id).setAttribute('aria-invalid', message ? 'true' : 'false'); return !message; };
  const showMsg = (text, type) => { const el = $('#authMsg'); el.textContent = text; el.className = 'msg ' + (text ? type : ''); };
  const setBusy = (btn, busy, label) => { btn.disabled = busy; btn.textContent = busy ? 'Please wait…' : label; };
  const ensureConfigured = () => { if (configured) return true; showMsg(libLoaded ? 'Add your Supabase URL and Anon Key at the top of app.js first.' : 'The Supabase library failed to load. Check your connection and reload.', 'error'); return false; };
  const authUrl = new URL('auth.html', location.href).href;
  const fL = $('#loginForm'), fS = $('#signupForm'), tabL = $('#tabLogin'), tabS = $('#tabSignup');

  function setMode(mode) {
    const signup = mode === 'signup';
    fL.hidden = signup; fS.hidden = !signup;
    tabL.setAttribute('aria-selected', String(!signup)); tabS.setAttribute('aria-selected', String(signup));
    $('#authTitle').textContent = signup ? 'Join the community' : 'Welcome back';
    showMsg('', '');
  }
  tabL.addEventListener('click', () => setMode('login')); tabS.addEventListener('click', () => setMode('signup'));
  setMode(params.get('mode') === 'signup' ? 'signup' : 'login');

  $$('.field input').forEach((input) => input.addEventListener('input', () => setError(input.id, '')));
  $$('[data-eye]').forEach((btn) => btn.addEventListener('click', () => {
    const input = $('#' + btn.dataset.eye), show = input.type === 'password';
    input.type = show ? 'text' : 'password'; btn.textContent = show ? '🙈' : '👁';
    btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  }));

  fL.addEventListener('submit', async (e) => {
    e.preventDefault(); showMsg('', '');
    const email = $('#loginEmail').value.trim(), pass = $('#loginPass').value;
    const okE = setError('loginEmail', checkEmail(email)), okP = setError('loginPass', pass ? '' : 'Enter your password.');
    if (!(okE && okP) || !ensureConfigured()) return;
    setBusy($('#loginBtn'), true, 'Login');
    try {
      const { error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
      showMsg('Login successful. Taking you back…', 'ok');
      setTimeout(redirectAfterAuth, 700);
    } catch (err) { showMsg(errMsg(err), 'error'); }
    finally { setBusy($('#loginBtn'), false, 'Login'); }
  });

  fS.addEventListener('submit', async (e) => {
    e.preventDefault(); showMsg('', '');
    const username = $('#signupUser').value.trim(), email = $('#signupEmail').value.trim();
    const pass = $('#signupPass').value, confirm = $('#signupConfirm').value;
    const ok = [setError('signupUser', checkUsername(username)), setError('signupEmail', checkEmail(email)),
      setError('signupPass', checkPassword(pass)), setError('signupConfirm', pass === confirm ? '' : 'Passwords do not match.')];
    if (!ok.every(Boolean) || !ensureConfigured()) return;
    setBusy($('#signupBtn'), true, 'Sign up');
    try {
      const { data: taken, error: tErr } = await sb.from('profiles').select('id').ilike('username', escLike(username)).limit(1);
      if (tErr) throw tErr;
      if (taken && taken.length) { setError('signupUser', 'That username is taken. Try another.'); return; }
      const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { username }, emailRedirectTo: authUrl } });
      if (error) throw error;
      // Supabase returns an empty identities list when the email is already registered
      if (data.user && data.user.identities && data.user.identities.length === 0) { showMsg('This email is already registered. Try logging in instead.', 'error'); return; }
      if (!data.session) { showMsg('Signup successful! Check your inbox to confirm your email, then log in.', 'ok'); fS.reset(); return; }
      showMsg('Account created. Taking you in…', 'ok');
      setTimeout(redirectAfterAuth, 800);
    } catch (err) { showMsg(errMsg(err), 'error'); }
    finally { setBusy($('#signupBtn'), false, 'Sign up'); }
  });

  $('#googleBtn').addEventListener('click', async () => {
    if (!ensureConfigured()) return;
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: authUrl } });
    if (error) showMsg(errMsg(error), 'error');
  });

  pageHooks.onAuth = (signedIn) => { if (signedIn) redirectAfterAuth(); };
  await authReady;
  if (state.user) redirectAfterAuth();   // already signed in (or just came back from Google / email link)
}

/* ---- Profile ---- */
async function initProfile() {
  const root = $('#profileRoot');
  if (!sb) { root.innerHTML = setupState(); return; }
  await authReady;
  const u = (params.get('u') || '').trim();
  if (!u && !state.user) { goAuth(); return; }
  let profile = null;
  const isOwn = () => !!(state.user && profile && state.user.id === profile.id);

  async function load() {
    root.innerHTML = '<div class="sk sk-block"></div>' + skeletonList(2);
    try {
      if (u) {
        const { data, error } = await sb.from('profiles').select('*').ilike('username', escLike(u)).limit(1);
        if (error) throw error; profile = data && data[0];
      } else {
        const { data, error } = await sb.from('profiles').select('*').eq('id', state.user.id).maybeSingle();
        if (error) throw error; profile = data || state.profile;
      }
      if (!profile) { root.innerHTML = emptyState('👤', 'Profile not found', u ? `Nobody is using the username “${u}”.` : '', '<a class="btn btn-primary" href="index.html">Back to home</a>'); return; }
      document.title = `${profile.username} · ${SITE_NAME}`;
      const [{ count: pc }, { count: cc }] = await Promise.all([
        sb.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', profile.id),
        sb.from('comments').select('id', { count: 'exact', head: true }).eq('author_id', profile.id),
      ]);
      root.innerHTML = `<section class="profile-card">
          <div class="profile-banner"></div>
          <div class="profile-body">${avatar(profile, 'xl')}
            <div class="profile-info"><h1>${esc(profile.username)}</h1><div class="muted">Joined ${fmtDate(profile.created_at || Date.now())}</div>
              <p class="bio">${profile.bio ? esc(profile.bio) : '<span class="muted">No bio yet.</span>'}</p>
              <div class="stats"><div><b>${pc ?? 0}</b><span>Posts</span></div><div><b>${cc ?? 0}</b><span>Comments</span></div></div></div>
            <div class="profile-actions" id="pfActions"></div>
          </div></section>
        <div class="section-head"><h2>Posts by ${esc(profile.username)}</h2></div>
        <div class="post-list" id="postList" aria-live="polite"></div>
        <div class="load-more"><button class="btn btn-ghost" id="loadMore" hidden>Load more</button></div>`;
      renderActions();
      const feed = createFeed({
        list: $('#postList'), more: $('#loadMore'), filters: () => ({ authorId: profile.id }),
        empty: () => emptyState('📝', 'No posts yet', isOwn() ? 'Your first post is a couple of clicks away.' : `${profile.username} hasn’t published anything yet.`,
          isOwn() ? '<button class="btn btn-primary" data-action="write">✎ Write a post</button>' : ''),
      });
      await feed.load(true);
    } catch (e) { console.error(e); root.innerHTML = errorState(errMsg(e)); pageHooks.retry = load; }
  }
  function renderActions() {
    const s = $('#pfActions'); if (!s) return;
    s.innerHTML = isOwn() ? '<button class="btn btn-ghost btn-sm" data-action="edit-profile">Edit profile</button><button class="btn btn-primary btn-sm" data-action="write">✎ New post</button>' : '';
  }
  pageHooks.editProfile = () => { if (isOwn()) openProfileEditor(profile, (p) => { if (u) history.replaceState(null, '', 'profile.html?u=' + encodeURIComponent(p.username)); load(); }); };
  pageHooks.onAuth = (signedIn) => { if (!signedIn && !u) location.href = 'index.html'; else renderActions(); };
  await load();
}

/* ───────────── 9. BOOT ───────────── */
async function boot() {
  renderLayout();
  bindGlobal();
  await loadAuth();
  const page = document.body.dataset.page;
  try {
    if (page === 'home') await initHome();
    else if (page === 'post') await initPost();
    else if (page === 'auth') await initAuthPage();
    else if (page === 'profile') await initProfile();
  } catch (e) { console.error(e); toast(errMsg(e), 'error'); }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
