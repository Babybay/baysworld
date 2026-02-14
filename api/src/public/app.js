// ── Auth State ──
const Auth = {
  tokenKey: 'baysworld_token',
  userKey: 'baysworld_user',

  getToken() { return localStorage.getItem(this.tokenKey); },
  getUser() { return localStorage.getItem(this.userKey) || 'admin'; },

  setSession(token, username) {
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem(this.userKey, username);
  },

  clearSession() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  },

  isLoggedIn() { return !!this.getToken(); },

  authHeaders() {
    const token = this.getToken();
    return token ? { 'Authorization': 'Bearer ' + token } : {};
  },
};

function isAdmin() { return Auth.isLoggedIn(); }

// ── API Service ──
const API = {
  base: '/api',
  async request(method, path, body = null) {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...Auth.authHeaders(),
      },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(this.base + path, opts);

    if (res.status === 401 && !path.startsWith('/auth/')) {
      Auth.clearSession();
      updateAdminUI();
      throw new Error('Session expired. Please log in again.');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  },
  // Auth
  login(username, password) { return this.request('POST', '/auth/login', { username, password }); },
  register(username, password, vipKey) { return this.request('POST', '/auth/register', { username, password, vipKey }); },
  verify() { return this.request('GET', '/auth/verify'); },
  changePassword(currentPassword, newPassword) { return this.request('PUT', '/auth/change-password', { currentPassword, newPassword }); },
  // Projects
  getProjects(q = '') { return this.request('GET', '/projects' + q); },
  getProject(id) { return this.request('GET', '/projects/' + id); },
  createProject(d) { return this.request('POST', '/projects', d); },
  updateProject(id, d) { return this.request('PUT', '/projects/' + id, d); },
  deleteProject(id) { return this.request('DELETE', '/projects/' + id); },
  // Notes
  getNotes(q = '') { return this.request('GET', '/notes' + q); },
  getNote(id) { return this.request('GET', '/notes/' + id); },
  createNote(d) { return this.request('POST', '/notes', d); },
  updateNote(id, d) { return this.request('PUT', '/notes/' + id, d); },
  deleteNote(id) { return this.request('DELETE', '/notes/' + id); },
  getCategories() { return this.request('GET', '/notes/categories'); },
  getLogs(limit = 50, offset = 0) { return this.request('GET', `/logs?limit=${limit}&offset=${offset}`); },
  health() { return this.request('GET', '/health'); },
  // Media
  uploadMedia(projectId, formData) {
    return fetch(`/api/media/upload/${projectId}`, {
      method: 'POST', headers: Auth.authHeaders(), body: formData,
    }).then(r => { if (!r.ok) throw new Error('Upload failed'); return r.json(); });
  },
  uploadThumbnail(projectId, formData) {
    return fetch(`/api/media/thumbnail/${projectId}`, {
      method: 'POST', headers: Auth.authHeaders(), body: formData,
    }).then(r => { if (!r.ok) throw new Error('Thumbnail upload failed'); return r.json(); });
  },
  getMedia(projectId) { return this.request('GET', '/media/' + projectId); },
  deleteMedia(projectId, filename) { return this.request('DELETE', `/media/${projectId}/${filename}`); },
  // Stats
  recordView(entityType, entityId) {
    return fetch('/api/stats/view', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType, entityId }),
    }).catch(() => { });
  },
  getPublicStats() { return this.request('GET', '/stats/public'); },
  getStats() { return this.request('GET', '/stats'); },
  // Comments
  getComments(entityType, entityId) { return this.request('GET', `/comments/${entityType}/${entityId}`); },
  addComment(entityType, entityId, data) {
    return fetch(`/api/comments/${entityType}/${entityId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => { if (!r.ok) throw new Error('Comment failed'); return r.json(); });
  },
  getPendingComments() { return this.request('GET', '/comments/pending'); },
  approveComment(id) { return this.request('PUT', `/comments/${id}/approve`); },
  deleteComment(id) { return this.request('DELETE', '/comments/' + id); },
  // Subscriptions
  subscribe(data) {
    return fetch('/api/subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => { if (!r.ok) throw new Error('Subscribe failed'); return r.json(); });
  },
  getSubscribers() { return this.request('GET', '/subscriptions'); },
};

// ── Markdown Parser (enhanced: tables, task lists, images) ──
function parseMarkdown(md) {
  if (!md) return '';
  // Extract tables first
  let html = md.replace(/^(\|.+\|\r?\n)(\|[\s:|-]+\|\r?\n)((?:\|.+\|\r?\n?)+)/gm, (match) => {
    const lines = match.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return match;
    const headers = lines[0].split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`);
    const rows = lines.slice(2).map(r => {
      const cells = r.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`);
      return `<tr>${cells.join('')}</tr>`;
    });
    return `<table><thead><tr>${headers.join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
  });
  html = html
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="lang-${lang || 'plaintext'}">${esc(code.trim())}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border:2px inset;margin:4px 0;">')
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/^---$/gm, '<hr>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // Task lists
    .replace(/^- \[x\] (.+)$/gm, '<li class="task-done"><input type="checkbox" checked disabled> $1</li>')
    .replace(/^- \[ \] (.+)$/gm, '<li class="task-todo"><input type="checkbox" disabled> $1</li>')
    .replace(/^[\-\*] (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  // Wrap task lists
  html = html.replace(/((?:<li class="task-(?:done|todo)">.*?<\/li><br>?)+)/g, '<ul class="task-list">$1</ul>');
  html = html.replace(/((?:<li>.*?<\/li><br>?)+)/g, '<ul>$1</ul>');
  html = html.replace(/<br><\/ul>/g, '</ul>');
  html = '<p>' + html + '</p>';
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>(<h[1-4]>)/g, '$1');
  html = html.replace(/(<\/h[1-4]>)<\/p>/g, '$1');
  html = html.replace(/<p>(<pre>)/g, '$1');
  html = html.replace(/(<\/pre>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ul)/g, '$1');
  html = html.replace(/(<\/ul>)<\/p>/g, '$1');
  html = html.replace(/<p>(<blockquote>)/g, '$1');
  html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');
  html = html.replace(/<p>(<hr>)<\/p>/g, '$1');
  html = html.replace(/<p>(<table>)/g, '$1');
  html = html.replace(/(<\/table>)<\/p>/g, '$1');
  html = html.replace(/<p>(<img )/g, '$1');
  html = html.replace(/<p><br>/g, '<p>');
  return html;
}

// ── Highlight code blocks after render ──
function highlightCodeBlocks(container) {
  if (typeof hljs === 'undefined') return;
  const el = typeof container === 'string' ? document.querySelector(container) : container;
  if (!el) return;
  el.querySelectorAll('pre code').forEach(block => {
    hljs.highlightElement(block);
  });
}

// ── Lightbox for images ──
function openLightbox(src) {
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = `<img src="${src}">`;
  lb.onclick = () => lb.remove();
  document.body.appendChild(lb);
}

// ── Drag & Drop Upload Zone ──
function createDropZone(options = {}) {
  const { accept = 'image/*', multiple = false, label = 'Drag files here or click to browse', icon = '📁', hint = 'Max 10MB per file', onFiles } = options;
  const id = 'dz_' + Math.random().toString(36).slice(2, 8);
  const html = `
    <div class="drop-zone" id="${id}">
      <div class="drop-zone-icon">${icon}</div>
      <div class="drop-zone-label">${label}</div>
      <div class="drop-zone-hint">${hint}</div>
      <input type="file" accept="${accept}" ${multiple ? 'multiple' : ''}>
      <div class="drop-zone-progress" style="width:0%;"></div>
    </div>
    <div class="media-preview-grid" id="${id}_previews"></div>`;

  // Attach events after DOM insert
  setTimeout(() => {
    const zone = document.getElementById(id);
    if (!zone) return;
    const input = zone.querySelector('input[type="file"]');
    zone.addEventListener('click', (e) => { if (e.target === zone || e.target.closest('.drop-zone-icon,.drop-zone-label,.drop-zone-hint')) input.click(); });
    zone.addEventListener('dragenter', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('dragover'); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); });
    input.addEventListener('change', () => { if (input.files.length) handleFiles(input.files); input.value = ''; });

    function handleFiles(files) {
      const valid = Array.from(files).filter(f => {
        if (!f.type.startsWith('image/')) { toast('Only images allowed: ' + f.name, 'error'); return false; }
        if (f.size > 10 * 1024 * 1024) { toast('File too large (max 10MB): ' + f.name, 'error'); return false; }
        return true;
      });
      if (!valid.length) return;
      // Show previews
      const grid = document.getElementById(id + '_previews');
      valid.forEach(f => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const item = document.createElement('div');
          item.className = 'media-preview-item';
          item.innerHTML = `<img src="${e.target.result}"><button class="media-preview-delete" title="Remove">×</button>`;
          item.querySelector('.media-preview-delete').onclick = () => item.remove();
          grid.appendChild(item);
        };
        reader.readAsDataURL(f);
      });
      if (onFiles) onFiles(valid);
    }
  }, 50);

  return { html, id };
}

function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function strip(md) {
  if (!md) return '';
  return md.replace(/```[\s\S]*?```/g, '').replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,4}\s/g, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/^[\-\*>] /gm, '').replace(/\n+/g, ' ').trim();
}

// ── Utilities ──
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
function timeAgo(iso) {
  if (!iso) return '';
  const m = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const d = Math.floor(h / 24);
  if (d < 30) return d + 'd ago';
  return fmtDate(iso);
}
function getCatClass(cat) {
  if (!cat) return 'cat-general';
  const c = cat.toLowerCase().replace(/\s+/g, '-');
  return ({
    'cyber-security': 'cat-cyber-security', 'devops': 'cat-devops', 'frontend': 'cat-frontend',
    'backend': 'cat-backend', 'database': 'cat-database', 'networking': 'cat-networking',
    'tools': 'cat-tools', 'career': 'cat-career', 'learning': 'cat-learning'
  })[c] || 'cat-general';
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function setStatus(msg) { const el = document.getElementById('statusText'); if (el) el.textContent = msg; }
function setAddr(path) { const el = document.getElementById('addressBar'); if (el) el.textContent = 'http://thebaysworld.xyz' + path; }
const BASE_URL = 'https://thebaysworld.xyz';
function shareBar(type, slug) {
  if (!slug) return '';
  const url = `${BASE_URL}/${type}/${slug}`;
  const title = encodeURIComponent('Check this out on BaysWorld!');
  const encodedUrl = encodeURIComponent(url);
  return `<div class="share-bar">
    <span class="share-label">📎 Share:</span>
    <span class="share-url">${url}</span>
    <div class="share-buttons">
      <button class="win-btn btn-sm" onclick="navigator.clipboard.writeText('${url}').then(()=>{this.textContent='✓ Copied!'}).catch(()=>{})">📋 Copy</button>
      <a class="share-btn share-twitter" href="https://twitter.com/intent/tweet?url=${encodedUrl}&text=${title}" target="_blank" title="Share on Twitter">🐦 Twitter</a>
      <a class="share-btn share-linkedin" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}" target="_blank" title="Share on LinkedIn">💼 LinkedIn</a>
      <a class="share-btn share-email" href="mailto:?subject=${title}&body=${title}%20${encodedUrl}" title="Share via Email">📧 Email</a>
      <a class="share-btn share-whatsapp" href="https://wa.me/?text=${title}%20${encodedUrl}" target="_blank" title="Share on WhatsApp">💬 WhatsApp</a>
    </div>
  </div>`;
}

// ── Toast ──
function toast(message, type = 'info') {
  const c = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  c.appendChild(el);
  setTimeout(() => { el.classList.add('toast-exit'); setTimeout(() => el.remove(), 200); }, 3000);
}

// ── Modal ──
function openModal(title, html) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = html;
  document.getElementById('modalOverlay').classList.add('open');
}
function closeModal() { document.getElementById('modalOverlay').classList.remove('open'); }

// ── Quick Menu ──
function hideQuickMenu() { document.getElementById('quickMenu').style.display = 'none'; }

// ══════════════════════════════════════════════════════════
// ── AUTH UI FLOW
// ══════════════════════════════════════════════════════════

function showLoginScreen() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
  document.getElementById('loginError').style.display = 'none';
  document.getElementById('loginUser').focus();
}

function hideLogin() {
  document.getElementById('loginScreen').style.display = 'none';
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');
  const errEl = document.getElementById('loginError');

  errEl.style.display = 'none';

  if (tab === 'login') {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    setTimeout(() => document.getElementById('loginUser').focus(), 50);
  } else {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    tabLogin.classList.remove('active');
    tabRegister.classList.add('active');
    setTimeout(() => document.getElementById('regUser').focus(), 50);
  }
}

function updateAdminUI() {
  const admin = isAdmin();
  // Toggle toolbar buttons
  document.getElementById('adminControls').style.display = admin ? 'inline' : 'none';
  document.getElementById('guestControls').style.display = admin ? 'none' : 'inline';

  // Toggle all admin-only elements
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = admin ? '' : 'none';
  });

  // Update user display
  const adminEl = document.getElementById('adminUser');
  if (adminEl) adminEl.textContent = admin ? '👤 ' + Auth.getUser() : '';
  const statusUser = document.getElementById('statusUser');
  if (statusUser) statusUser.textContent = admin ? 'User: ' + Auth.getUser() : 'Visitor: Guest';
}

function logout() {
  Auth.clearSession();
  updateAdminUI();
  toast('Logged out', 'info');
  Router.resolve(); // Re-render current view without admin buttons
}

// ── Admin-only helper: returns HTML only if admin ──
function adminOnly(html) { return isAdmin() ? html : ''; }

// ── Change Password Form ──
function showChangePasswordForm() {
  openModal('🔑 Change Password', `
    <form id="pwForm">
      <div class="form-group">
        <label class="form-label">Current Password</label>
        <input class="form-input" name="currentPassword" type="password" required>
      </div>
      <div class="form-group">
        <label class="form-label">New Password</label>
        <input class="form-input" name="newPassword" type="password" required minlength="6">
        <span class="form-hint">Minimum 6 characters</span>
      </div>
      <div class="form-group">
        <label class="form-label">Confirm New Password</label>
        <input class="form-input" name="confirmPassword" type="password" required>
      </div>
      <div class="form-actions">
        <button type="button" class="win-btn" onclick="closeModal()">Cancel</button>
        <button type="submit" class="win-btn win-btn-primary">Change Password</button>
      </div>
    </form>
  `);
  document.getElementById('pwForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const currentPassword = fd.get('currentPassword');
    const newPassword = fd.get('newPassword');
    const confirmPassword = fd.get('confirmPassword');
    if (newPassword !== confirmPassword) { toast('Passwords do not match', 'error'); return; }
    try {
      await API.changePassword(currentPassword, newPassword);
      toast('Password changed!', 'success');
      closeModal();
    } catch (err) { toast(err.message, 'error'); }
  });
}

// ── Router ──
const Router = {
  routes: {},
  on(p, h) { this.routes[p] = h; },
  navigate(p) { window.location.hash = p; },
  async resolve() {
    const hash = window.location.hash.slice(1) || '/';
    setAddr(hash);
    document.querySelectorAll('.tree-item[data-route]').forEach(el => {
      const r = el.getAttribute('data-route');
      el.classList.toggle('active', r === hash || (r !== '/' && hash.startsWith(r)));
    });
    for (const [pattern, handler] of Object.entries(this.routes)) {
      const regex = pattern.replace(/:(\w+)/g, '([^/]+)');
      const match = hash.match(new RegExp('^' + regex + '$'));
      if (match) { await handler(...match.slice(1)); return; }
    }
    document.getElementById('contentArea').innerHTML =
      '<div class="empty-state"><div class="empty-icon">❌</div>Page Not Found<br><br><a href="#/">Return to Dashboard</a></div>';
  },
};

// ══════════════════════════════════════════════════════════
// ──  VIEW RENDERERS
// ══════════════════════════════════════════════════════════

async function renderDashboard() {
  const c = document.getElementById('contentArea');
  setStatus('Loading dashboard...');
  try {
    const [projects, notes] = await Promise.all([API.getProjects(), API.getNotes()]);
    const active = projects.filter(p => p.status === 'active').length;
    const inProg = projects.filter(p => p.status === 'in-progress').length;
    const pinned = notes.filter(n => n.pinned).length;
    const visitorNum = String(Math.floor(Math.random() * 9000) + 1000).padStart(6, '0');

    c.innerHTML = `
      <div class="retro-marquee"><span>★ Welcome to Babybay's World a.k.a BaysWorld Hub ★ Personal project portfolio and knowledge base ★ Powered by Node.js ★</span></div>

      <div class="welcome-box" style="margin-top:10px;">
        <h2>📟 Welcome to BaysWorld</h2>
        <p>A lightweight Project Portfolio & Developer Knowledge Base.<br>
        Manage your projects, write notes in Markdown, and keep your developer knowledge organized.</p>
        <p style="margin-top:4px;font-size:10px;color:#808080;">
          <i>Best viewed at 800×600 resolution</i>
        </p>
      </div>

      <div class="stats-row">
        <div class="stat-box"><span class="stat-num">${projects.length}</span><span class="stat-label">Total Projects</span></div>
        <div class="stat-box"><span class="stat-num">${active + inProg}</span><span class="stat-label">Active</span></div>
        <div class="stat-box"><span class="stat-num">${notes.length}</span><span class="stat-label">Total Notes</span></div>
        <div class="stat-box"><span class="stat-num">${pinned}</span><span class="stat-label">Pinned 📌</span></div>
      </div>

      <hr class="retro-hr">

      ${projects.length ? `
      <div class="win-window">
        <div class="win-title-bar"><span>📁 Recent Projects</span></div>
        <div class="win-body" style="padding:6px;">
          <table class="data-table">
            <thead><tr><th>Name</th><th>Status</th><th>Tech Stack</th><th>Updated</th></tr></thead>
            <tbody>${projects.slice(0, 5).map(p => `
              <tr onclick="Router.navigate('/projects/${p.id}')" style="cursor:pointer;">
                <td><b>${esc(p.name)}</b></td>
                <td><span class="badge badge-${(p.status || 'active').replace(/\s+/g, '-')}">${p.status || 'active'}</span></td>
                <td>${(p.techStack || []).slice(0, 3).map(t => `<span class="tech-tag">${esc(t)}</span>`).join(' ')}</td>
                <td style="font-size:10px;color:#808080;">${timeAgo(p.updatedAt)}</td>
              </tr>`).join('')}</tbody>
          </table>
          <div style="text-align:right;margin-top:4px;"><a href="#/projects">View all projects →</a></div>
        </div>
      </div>` : `<div class="groupbox"><p>No projects yet.${adminOnly(' <a href="#" onclick="showProjectForm();return false;">Create your first project!</a>')}</p></div>`}

      ${notes.length ? `
      <div class="win-window">
        <div class="win-title-bar"><span>📝 Recent Notes</span></div>
        <div class="win-body" style="padding:6px;">
          <table class="data-table">
            <thead><tr><th></th><th>Title</th><th>Category</th><th>Updated</th></tr></thead>
            <tbody>${notes.slice(0, 5).map(n => `
              <tr onclick="Router.navigate('/notes/${n.id}')" style="cursor:pointer;">
                <td style="width:20px;">${n.pinned ? '📌' : ''}</td>
                <td><b>${esc(n.title)}</b></td>
                <td><span class="cat-tag ${getCatClass(n.category)}">${esc(n.category || 'General')}</span></td>
                <td style="font-size:10px;color:#808080;">${timeAgo(n.updatedAt)}</td>
              </tr>`).join('')}</tbody>
          </table>
          <div style="text-align:right;margin-top:4px;"><a href="#/notes">View all notes →</a></div>
        </div>
      </div>` : `<div class="groupbox"><p>No notes yet.${adminOnly(' <a href="#" onclick="showNoteForm();return false;">Write your first note!</a>')}</p></div>`}

      ${adminOnly(`
      <div class="win-window" style="margin-top:12px;">
        <div class="win-title-bar"><span>📊 Quick Stats</span></div>
        <div class="win-body" style="padding:6px;">
          <div id="dashQuickStats" style="color:#808080;font-size:10px;">Loading analytics...</div>
          <div style="text-align:right;margin-top:4px;"><a href="#/stats">Full Analytics Dashboard →</a></div>
        </div>
      </div>`)}

      <hr class="retro-hr">

      <fieldset class="groupbox" style="margin:10px 0;">
        <legend>📬 Stay Updated</legend>
        <p style="font-size:10px;margin-bottom:6px;">Get notified when new projects or notes are published!</p>
        <form id="subscribeForm" style="display:flex;gap:4px;align-items:center;">
          <input class="form-input" name="email" type="email" placeholder="your@email.com" required style="flex:1;font-size:10px;">
          <input class="form-input" name="name" placeholder="Name (optional)" style="width:100px;font-size:10px;">
          <button type="submit" class="win-btn btn-sm">📩 Subscribe</button>
        </form>
      </fieldset>

      <div class="visitor-counter">You are visitor number:<br><span class="counter-display">${visitorNum}</span></div>
      <p style="text-align:center;font-size:10px;color:#808080;margin-top:8px;">🏗️ This site is under construction 🏗️</p>
    `;
    // Subscribe form handler
    const sf = document.getElementById('subscribeForm');
    if (sf) sf.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const fd = new FormData(e.target);
        await API.subscribe({ email: fd.get('email'), name: fd.get('name') });
        toast('Subscribed! 📬', 'success');
        sf.reset();
      } catch (err) { toast(err.message, 'error'); }
    });
    // Load quick stats for admin
    if (isAdmin()) {
      try {
        const stats = await API.getStats();
        const el = document.getElementById('dashQuickStats');
        if (el) el.innerHTML = `
          <div class="stats-row" style="margin:0;">
            <div class="stat-box"><span class="stat-num">${stats.totalViews}</span><span class="stat-label">Total Views</span></div>
            <div class="stat-box"><span class="stat-num">${stats.todayViews}</span><span class="stat-label">Today</span></div>
            <a href="#/comments" class="stat-box"><span class="stat-num">${stats.pendingComments}</span><span class="stat-label">Pending 💬</span></a>
            <div class="stat-box"><span class="stat-num">${stats.totalSubscribers}</span><span class="stat-label">Subscribers</span></div>
          </div>`;
      } catch (e) { }
    }
    // Track dashboard view
    API.recordView('dashboard', null);
    setStatus('Done');
  } catch (err) {
    c.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
    setStatus('Error');
  }
}

async function renderProjectsList() {
  const c = document.getElementById('contentArea');
  setStatus('Loading projects...');
  try {
    const projects = await API.getProjects();
    c.innerHTML = `
      <div class="section-header">
        <span class="section-title">📁 All Projects (${projects.length})</span>
        ${adminOnly('<button class="win-btn" onclick="showProjectForm()">📄 New Project</button>')}
      </div>
      <div class="filter-bar" id="projectFilters">
        <button class="filter-btn active" data-status="">All</button>
        <button class="filter-btn" data-status="active">🟢 Active</button>
        <button class="filter-btn" data-status="in-progress">🟡 In Progress</button>
        <button class="filter-btn" data-status="archived">⚫ Archived</button>
      </div>
      <div id="projectsGrid">${projects.length ?
        `<table class="data-table"><thead><tr><th>Name</th><th>Description</th><th>Status</th><th>Tech Stack</th><th>Links</th><th>Updated</th></tr></thead><tbody>${projects.map(p => projectRow(p)).join('')}</tbody></table>` :
        '<div class="empty-state"><div class="empty-icon">📁</div>No projects yet.</div>'}</div>
    `;
    document.querySelectorAll('#projectFilters .filter-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        document.querySelectorAll('#projectFilters .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const s = btn.dataset.status;
        const filtered = await API.getProjects(s ? `?status=${s}` : '');
        document.getElementById('projectsGrid').innerHTML = filtered.length ?
          `<table class="data-table"><thead><tr><th>Name</th><th>Description</th><th>Status</th><th>Tech Stack</th><th>Links</th><th>Updated</th></tr></thead><tbody>${filtered.map(p => projectRow(p)).join('')}</tbody></table>` :
          '<div class="empty-state">No projects in this category.</div>';
      });
    });
    setStatus(`${projects.length} project(s) loaded`);
  } catch (err) {
    c.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
  }
}

function projectRow(p) {
  const thumb = p.thumbnail ? `<img class="thumbnail-small" src="${p.thumbnail}" alt="">` : '';
  return `<tr onclick="Router.navigate('/projects/${p.id}')" style="cursor:pointer;">
    <td>${thumb}<b>${esc(p.name)}</b></td>
    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc((p.description || '').slice(0, 60))}</td>
    <td><span class="badge badge-${(p.status || 'active').replace(/\s+/g, '-')}">${p.status || 'active'}</span></td>
    <td>${(p.techStack || []).slice(0, 4).map(t => `<span class="tech-tag">${esc(t)}</span>`).join(' ')}</td>
    <td style="white-space:nowrap;">
      ${p.githubUrl ? `<a href="${p.githubUrl}" target="_blank" onclick="event.stopPropagation()">GitHub</a> ` : ''}
      ${p.liveUrl ? `<a href="${p.liveUrl}" target="_blank" onclick="event.stopPropagation()">Live</a>` : ''}
    </td>
    <td style="font-size:10px;color:#808080;">${timeAgo(p.updatedAt)}</td>
  </tr>`;
}

async function renderProjectDetail(id) {
  const c = document.getElementById('contentArea');
  setStatus('Loading project...');
  try {
    const p = await API.getProject(id);
    const thumbnailHtml = p.thumbnail ? `<img class="project-thumbnail" src="${p.thumbnail}" alt="${esc(p.name)}" onclick="openLightbox('${p.thumbnail}')">` : '';
    const galleryHtml = (p.images && p.images.length) ? `
      <fieldset class="groupbox"><legend>📸 Media Gallery (${p.images.length})</legend>
        <div class="media-gallery">
          ${p.images.map(img => `<div class="media-gallery-item" onclick="openLightbox('${img}')"><img src="${img}" alt=""></div>`).join('')}
        </div>
      </fieldset>` : '';
    c.innerHTML = `
      <a class="back-link" onclick="history.back()">⬅ Back to Projects</a>
      <div class="win-window">
        <div class="win-title-bar"><span>📁 ${esc(p.name)}</span></div>
        <div class="win-body">
          ${thumbnailHtml}
          <div style="margin-bottom:8px;">
            <span class="badge badge-${(p.status || 'active').replace(/\s+/g, '-')}">${p.status || 'active'}</span>
            ${p.description ? `<p style="margin-top:6px;">${esc(p.description)}</p>` : ''}
          </div>
          ${adminOnly(`<div style="margin-bottom:8px;">
            <button class="win-btn btn-sm" onclick="showProjectForm('${p.id}')">✏️ Edit</button>
            <button class="win-btn btn-sm win-btn-danger" onclick="confirmDeleteProject('${p.id}')">🗑️ Delete</button>
          </div>`)}
          <div class="detail-grid">
            <div class="detail-item"><div class="dl">Status</div><div class="dv"><span class="badge badge-${(p.status || 'active').replace(/\s+/g, '-')}">${p.status || 'active'}</span></div></div>
            <div class="detail-item"><div class="dl">Created</div><div class="dv">${fmtDate(p.createdAt)}</div></div>
            <div class="detail-item"><div class="dl">Updated</div><div class="dv">${fmtDate(p.updatedAt)}</div></div>
            ${p.githubUrl ? `<div class="detail-item"><div class="dl">GitHub</div><div class="dv"><a href="${p.githubUrl}" target="_blank">${esc(p.githubUrl)}</a></div></div>` : ''}
            ${p.liveUrl ? `<div class="detail-item"><div class="dl">Live URL</div><div class="dv"><a href="${p.liveUrl}" target="_blank">${esc(p.liveUrl)}</a></div></div>` : ''}
          </div>
          ${p.techStack?.length ? `<fieldset class="groupbox"><legend>Tech Stack</legend>${p.techStack.map(t => `<span class="tech-tag">${esc(t)}</span>`).join(' ')}</fieldset>` : ''}
          ${p.tags?.length ? `<fieldset class="groupbox"><legend>Tags</legend>${p.tags.map(t => `<span class="note-tag">${esc(t)}</span>`).join(' ')}</fieldset>` : ''}
          ${galleryHtml}
          ${p.notes ? `<fieldset class="groupbox"><legend>Notes</legend><div class="note-content">${parseMarkdown(p.notes)}</div></fieldset>` : ''}
          ${shareBar('p', p.slug)}
          <fieldset class="groupbox"><legend>💬 Comments</legend>
            <div id="commentsArea">Loading comments...</div>
            <form id="commentForm" class="comment-form" style="margin-top:8px;">
              <input class="form-input" name="authorName" placeholder="Your name *" required style="font-size:10px;">
              <textarea class="form-textarea" name="content" placeholder="Write a comment... (max 2000 chars)" required style="min-height:60px;font-size:10px;"></textarea>
              <button type="submit" class="win-btn btn-sm">💬 Post Comment</button>
              <span style="font-size:9px;color:#808080;">Comments are reviewed before appearing.</span>
            </form>
          </fieldset>
        </div>
      </div>`;
    highlightCodeBlocks(c);
    // Track view
    API.recordView('project', id);
    // Load comments
    loadComments('project', id);
    // Comment form
    document.getElementById('commentForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await API.addComment('project', id, { authorName: fd.get('authorName'), content: fd.get('content') });
        toast('Comment submitted for review! ✅', 'success');
        e.target.reset();
      } catch (err) { toast(err.message, 'error'); }
    });
    setStatus('Project loaded');
  } catch (err) {
    c.innerHTML = `<div class="empty-state">Project Not Found<br><br><a href="#/projects">Back to Projects</a></div>`;
  }
}

async function renderNotesList() {
  const c = document.getElementById('contentArea');
  setStatus('Loading notes...');
  try {
    const [notes, cats] = await Promise.all([API.getNotes(), API.getCategories()]);
    c.innerHTML = `
      <div class="section-header">
        <span class="section-title">📝 Knowledge Base (${notes.length} notes)</span>
        ${adminOnly('<button class="win-btn" onclick="showNoteForm()">📄 New Note</button>')}
      </div>
      <div class="filter-bar" id="noteFilters">
        ${['All', ...cats].map((cat, i) => `<button class="filter-btn ${i === 0 ? 'active' : ''}" data-category="${cat === 'All' ? '' : cat}">${cat}</button>`).join('')}
      </div>
      <div id="notesGrid">${notes.length ?
        `<table class="data-table"><thead><tr><th style="width:20px;"></th><th>Title</th><th>Category</th><th>Preview</th><th>Updated</th></tr></thead><tbody>${notes.map(n => noteRow(n)).join('')}</tbody></table>` :
        '<div class="empty-state"><div class="empty-icon">📝</div>No notes yet.</div>'}</div>
    `;
    document.querySelectorAll('#noteFilters .filter-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        document.querySelectorAll('#noteFilters .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const cat = btn.dataset.category;
        const filtered = await API.getNotes(cat ? `?category=${encodeURIComponent(cat)}` : '');
        document.getElementById('notesGrid').innerHTML = filtered.length ?
          `<table class="data-table"><thead><tr><th style="width:20px;"></th><th>Title</th><th>Category</th><th>Preview</th><th>Updated</th></tr></thead><tbody>${filtered.map(n => noteRow(n)).join('')}</tbody></table>` :
          '<div class="empty-state">No notes in this category.</div>';
      });
    });
    setStatus(`${notes.length} note(s) loaded`);
  } catch (err) {
    c.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
  }
}

function noteRow(n) {
  return `<tr onclick="Router.navigate('/notes/${n.id}')" style="cursor:pointer;">
    <td>${n.pinned ? '📌' : ''}</td>
    <td><b>${esc(n.title)}</b></td>
    <td><span class="cat-tag ${getCatClass(n.category)}">${esc(n.category || 'General')}</span></td>
    <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:#808080;">${esc(strip(n.content).slice(0, 80))}</td>
    <td style="font-size:10px;color:#808080;">${timeAgo(n.updatedAt)}</td>
  </tr>`;
}

async function renderNoteDetail(id) {
  const c = document.getElementById('contentArea');
  setStatus('Loading note...');
  try {
    const n = await API.getNote(id);
    c.innerHTML = `
      <a class="back-link" onclick="history.back()">⬅ Back to Notes</a>
      <div class="win-window">
        <div class="win-title-bar"><span>📝 ${esc(n.title)} ${n.pinned ? '📌' : ''}</span></div>
        <div class="win-body">
          <div style="margin-bottom:6px;">
            <span class="cat-tag ${getCatClass(n.category)}">${esc(n.category || 'General')}</span>
            ${n.tags?.length ? n.tags.map(t => `<span class="note-tag">${esc(t)}</span>`).join(' ') : ''}
          </div>
          <div style="font-size:10px;color:#808080;margin-bottom:8px;">Last updated: ${fmtDate(n.updatedAt)} · Created: ${fmtDate(n.createdAt)}</div>
          ${adminOnly(`<div style="margin-bottom:10px;">
            <button class="win-btn btn-sm" onclick="showNoteForm('${n.id}')">✏️ Edit</button>
            <button class="win-btn btn-sm" onclick="togglePin('${n.id}', ${!n.pinned})">${n.pinned ? '📌 Unpin' : '📌 Pin'}</button>
            <button class="win-btn btn-sm win-btn-danger" onclick="confirmDeleteNote('${n.id}')">🗑️ Delete</button>
          </div>`)}
          <hr class="retro-hr">
          <div class="note-content">${parseMarkdown(n.content)}</div>
          ${shareBar('n', n.slug)}
          <fieldset class="groupbox"><legend>💬 Comments</legend>
            <div id="commentsArea">Loading comments...</div>
            <form id="commentForm" class="comment-form" style="margin-top:8px;">
              <input class="form-input" name="authorName" placeholder="Your name *" required style="font-size:10px;">
              <textarea class="form-textarea" name="content" placeholder="Write a comment... (max 2000 chars)" required style="min-height:60px;font-size:10px;"></textarea>
              <button type="submit" class="win-btn btn-sm">💬 Post Comment</button>
              <span style="font-size:9px;color:#808080;">Comments are reviewed before appearing.</span>
            </form>
          </fieldset>
        </div>
      </div>`;
    highlightCodeBlocks(c);
    // Track view
    API.recordView('note', id);
    // Load comments
    loadComments('note', id);
    // Comment form
    document.getElementById('commentForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await API.addComment('note', id, { authorName: fd.get('authorName'), content: fd.get('content') });
        toast('Comment submitted for review! ✅', 'success');
        e.target.reset();
      } catch (err) { toast(err.message, 'error'); }
    });
    setStatus('Note loaded');
  } catch (err) {
    c.innerHTML = `<div class="empty-state">Note Not Found<br><br><a href="#/notes">Back to Notes</a></div>`;
  }
}

// ── Activity Log Viewer (admin only) ──
async function renderActivityLogs() {
  const c = document.getElementById('contentArea');
  if (!isAdmin()) {
    c.innerHTML = '<div class="empty-state"><div class="empty-icon">🔒</div>Admin login required to view logs.<br><br><a href="#/">Return to Dashboard</a></div>';
    return;
  }
  setStatus('Loading activity logs...');
  try {
    const data = await API.getLogs(100, 0);
    const logs = data.logs || [];
    const actionIcons = { create: '🆕', update: '✏️', delete: '🗑️', login: '🔐', register: '📝' };
    c.innerHTML = `
      <div class="section-header">
        <span class="section-title">📋 Activity Logs (${data.total || logs.length} total)</span>
      </div>
      ${logs.length ? `
      <table class="data-table">
        <thead><tr><th style="width:30px;"></th><th>Action</th><th>Entity</th><th>Name</th><th>User</th><th>Details</th><th>Time</th></tr></thead>
        <tbody>${logs.map(l => `<tr>
          <td>${actionIcons[l.action] || '📌'}</td>
          <td><span class="badge badge-${l.action === 'delete' ? 'archived' : l.action === 'create' ? 'active' : 'in-progress'}">${l.action}</span></td>
          <td>${esc(l.entityType || '')}</td>
          <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${l.entityType === 'project' && l.entityId ? `<a href="#/projects/${l.entityId}">${esc(l.entityName || '')}</a>` :
        l.entityType === 'note' && l.entityId ? `<a href="#/notes/${l.entityId}">${esc(l.entityName || '')}</a>` :
          esc(l.entityName || '')}
          </td>
          <td>👤 ${esc(l.username || 'system')}</td>
          <td style="font-size:10px;color:#808080;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(l.details || '')}</td>
          <td style="font-size:10px;color:#808080;white-space:nowrap;">${timeAgo(l.createdAt)}</td>
        </tr>`).join('')}</tbody>
      </table>` : '<div class="empty-state"><div class="empty-icon">📋</div>No activity logs yet.</div>'}
    `;
    setStatus(`${logs.length} log(s) loaded`);
  } catch (err) {
    c.innerHTML = `<div class="empty-state">Error loading logs: ${err.message}</div>`;
  }
}

// ══════════════════════════════════════════════════════════
// FORM HANDLERS (admin only)
// ══════════════════════════════════════════════════════════

async function showProjectForm(editId = null) {
  if (!isAdmin()) { showLoginScreen(); return; }
  let p = { name: '', description: '', techStack: [], status: 'active', githubUrl: '', liveUrl: '', tags: [], notes: '', thumbnail: '', images: [] };
  if (editId) { try { p = await API.getProject(editId); } catch (e) { toast('Not found', 'error'); return; } }

  // Create drop zones
  let pendingThumbnail = null;
  let pendingImages = [];
  const thumbDZ = createDropZone({ icon: '🖼️', label: 'Drop thumbnail here', hint: 'Single image, max 10MB', multiple: false, onFiles: files => { pendingThumbnail = files[0]; } });
  const imagesDZ = createDropZone({ icon: '📸', label: 'Drop project images here', hint: 'Multiple images, max 10MB each', multiple: true, onFiles: files => { pendingImages.push(...files); } });

  openModal(editId ? 'Edit Project' : 'New Project', `
    <form id="pForm">
      <div class="form-group"><label class="form-label">Project Name *</label><input class="form-input" name="name" value="${esc(p.name)}" required></div>
      <div class="form-group"><label class="form-label">Description</label><input class="form-input" name="description" value="${esc(p.description)}"></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Status</label>
          <select class="form-select" name="status">
            <option value="active" ${p.status === 'active' ? 'selected' : ''}>Active</option>
            <option value="in-progress" ${p.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
            <option value="archived" ${p.status === 'archived' ? 'selected' : ''}>Archived</option>
          </select>
        </div>
        <div class="form-group"><label class="form-label">Tech Stack</label><input class="form-input" name="techStack" value="${(p.techStack || []).join(', ')}"><span class="form-hint">Comma-separated</span></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">GitHub URL</label><input class="form-input" name="githubUrl" value="${esc(p.githubUrl || '')}"></div>
        <div class="form-group"><label class="form-label">Live URL</label><input class="form-input" name="liveUrl" value="${esc(p.liveUrl || '')}"></div>
      </div>
      <div class="form-group"><label class="form-label">Tags</label><input class="form-input" name="tags" value="${(p.tags || []).join(', ')}"><span class="form-hint">Comma-separated</span></div>
      <div class="form-group">
        <label class="form-label">🖼️ Thumbnail</label>
        ${p.thumbnail ? `<div style="margin-bottom:6px;"><img src="${p.thumbnail}" style="max-height:80px;border:2px inset;"></div>` : ''}
        ${thumbDZ.html}
      </div>
      <div class="form-group">
        <label class="form-label">📸 Project Images</label>
        ${(p.images && p.images.length) ? `<div class="media-preview-grid" style="margin-bottom:6px;">${p.images.map(img => `<div class="media-preview-item"><img src="${img}"></div>`).join('')}</div>` : ''}
        ${imagesDZ.html}
      </div>
      <div class="form-group"><label class="form-label">Notes (Markdown)</label><textarea class="form-textarea" name="notes" id="projectNotesEditor">${p.notes || ''}</textarea></div>
      <div class="form-actions">
        <button type="button" class="win-btn" onclick="closeModal()">Cancel</button>
        <button type="submit" class="win-btn win-btn-primary">${editId ? 'Update' : 'Create'}</button>
      </div>
    </form>`);

  // Initialize EasyMDE for project notes
  let notesEditor = null;
  try {
    if (typeof EasyMDE !== 'undefined') {
      notesEditor = new EasyMDE({
        element: document.getElementById('projectNotesEditor'),
        spellChecker: false,
        status: ['lines', 'words'],
        toolbar: ['bold', 'italic', 'heading', '|', 'code', 'quote', 'unordered-list', 'ordered-list', '|', 'link', 'image', 'table', '|', 'preview', 'side-by-side', 'fullscreen', '|', 'guide'],
        placeholder: 'Write project notes in Markdown...',
        initialValue: p.notes || '',
      });
    }
  } catch (e) { console.warn('EasyMDE init failed:', e); }

  document.getElementById('pForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      name: fd.get('name'), description: fd.get('description'), status: fd.get('status'),
      techStack: fd.get('techStack').split(',').map(s => s.trim()).filter(Boolean),
      githubUrl: fd.get('githubUrl'), liveUrl: fd.get('liveUrl'),
      tags: fd.get('tags').split(',').map(s => s.trim()).filter(Boolean),
      notes: notesEditor ? notesEditor.value() : fd.get('notes')
    };
    try {
      let project;
      if (editId) { project = await API.updateProject(editId, data); toast('Project updated!', 'success'); }
      else { project = await API.createProject(data); toast('Project created!', 'success'); }
      const pid = project.id || editId;
      // Upload thumbnail if pending
      if (pendingThumbnail && pid) {
        const tf = new FormData(); tf.append('thumbnail', pendingThumbnail);
        await API.uploadThumbnail(pid, tf);
        toast('Thumbnail uploaded!', 'success');
      }
      // Upload images if pending
      if (pendingImages.length && pid) {
        const imf = new FormData();
        pendingImages.forEach(f => imf.append('images', f));
        await API.uploadMedia(pid, imf);
        toast(`${pendingImages.length} image(s) uploaded!`, 'success');
      }
      closeModal(); Router.resolve();
    } catch (err) { toast(err.message, 'error'); }
  });
}

async function showNoteForm(editId = null) {
  if (!isAdmin()) { showLoginScreen(); return; }
  let n = { title: '', content: '', category: 'General', tags: [], pinned: false };
  if (editId) { try { n = await API.getNote(editId); } catch (e) { toast('Not found', 'error'); return; } }
  const cats = ['General', 'Cyber Security', 'DevOps', 'Frontend', 'Backend', 'Database', 'Networking', 'Tools', 'Career', 'Learning'];
  openModal(editId ? 'Edit Note' : 'New Note', `
    <form id="nForm">
      <div class="form-group"><label class="form-label">Title *</label><input class="form-input" name="title" value="${esc(n.title)}" required></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Category</label>
          <select class="form-select" name="category">${cats.map(c => `<option value="${c}" ${n.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label class="form-label">Tags</label><input class="form-input" name="tags" value="${(n.tags || []).join(', ')}"><span class="form-hint">Comma-separated</span></div>
      </div>
      <div class="form-group"><label class="form-check"><input type="checkbox" name="pinned" ${n.pinned ? 'checked' : ''}> 📌 Pin this note</label></div>
      <div class="form-group"><label class="form-label">Content (Markdown)</label><textarea class="form-textarea" name="content" id="noteContentEditor" style="min-height:200px;">${n.content || ''}</textarea></div>
      <div class="form-actions">
        <button type="button" class="win-btn" onclick="closeModal()">Cancel</button>
        <button type="submit" class="win-btn win-btn-primary">${editId ? 'Update' : 'Create'}</button>
      </div>
    </form>`);

  // Initialize EasyMDE for note content
  let contentEditor = null;
  try {
    if (typeof EasyMDE !== 'undefined') {
      contentEditor = new EasyMDE({
        element: document.getElementById('noteContentEditor'),
        spellChecker: false,
        status: ['lines', 'words'],
        toolbar: ['bold', 'italic', 'heading', 'heading-smaller', '|', 'code', 'quote', 'unordered-list', 'ordered-list', '|', 'link', 'image', 'table', 'horizontal-rule', '|', 'preview', 'side-by-side', 'fullscreen', '|', 'guide'],
        placeholder: 'Write your note in Markdown...\n\nSupports: **bold**, *italic*, `code`, ```code blocks```, tables, task lists, and more!',
        initialValue: n.content || '',
        renderingConfig: {
          codeSyntaxHighlighting: true,
        },
      });
    }
  } catch (e) { console.warn('EasyMDE init failed:', e); }

  document.getElementById('nForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      title: fd.get('title'),
      content: contentEditor ? contentEditor.value() : fd.get('content'),
      category: fd.get('category'),
      tags: fd.get('tags').split(',').map(s => s.trim()).filter(Boolean),
      pinned: fd.has('pinned')
    };
    try {
      if (editId) { await API.updateNote(editId, data); toast('Note updated!', 'success'); }
      else { await API.createNote(data); toast('Note created!', 'success'); }
      closeModal(); Router.resolve();
    } catch (err) { toast(err.message, 'error'); }
  });
}

async function confirmDeleteProject(id) {
  if (!isAdmin()) return;
  if (!confirm('Are you sure you want to delete this project?')) return;
  try { await API.deleteProject(id); toast('Deleted', 'success'); Router.navigate('/projects'); }
  catch (err) { toast(err.message, 'error'); }
}
async function confirmDeleteNote(id) {
  if (!isAdmin()) return;
  if (!confirm('Are you sure you want to delete this note?')) return;
  try { await API.deleteNote(id); toast('Deleted', 'success'); Router.navigate('/notes'); }
  catch (err) { toast(err.message, 'error'); }
}
async function togglePin(id, pinned) {
  if (!isAdmin()) return;
  try { await API.updateNote(id, { pinned }); toast(pinned ? 'Pinned!' : 'Unpinned', 'success'); Router.resolve(); }
  catch (err) { toast(err.message, 'error'); }
}

// ══════════════════════════════════════════════════════════
// COMMENTS, STATS & PENDING COMMENTS
// ══════════════════════════════════════════════════════════

async function loadComments(entityType, entityId) {
  const area = document.getElementById('commentsArea');
  if (!area) return;
  try {
    const comments = await API.getComments(entityType, entityId);
    if (!comments.length) {
      area.innerHTML = '<p style="color:#808080;font-size:10px;">No comments yet. Be the first to comment!</p>';
      return;
    }
    area.innerHTML = comments.map(c => `
      <div class="comment-item">
        <div class="comment-header">
          <strong>${esc(c.authorName)}</strong>
          <span class="comment-date">${timeAgo(c.createdAt)}</span>
        </div>
        <div class="comment-body">${esc(c.content)}</div>
      </div>
    `).join('');
  } catch (err) {
    area.innerHTML = '<p style="color:#808080;font-size:10px;">Could not load comments.</p>';
  }
}

async function renderStats() {
  if (!isAdmin()) { showLoginScreen(); return; }
  const c = document.getElementById('contentArea');
  setStatus('Loading analytics...');
  try {
    const s = await API.getStats();
    const maxProjectViews = s.topProjects.length ? Math.max(...s.topProjects.map(p => p.views)) : 1;
    const maxNoteViews = s.topNotes.length ? Math.max(...s.topNotes.map(n => n.views)) : 1;
    const maxCatViews = s.categoryEngagement.length ? Math.max(...s.categoryEngagement.map(c => c.views)) : 1;

    c.innerHTML = `
      <div class="win-window">
        <div class="win-title-bar"><span>\ud83d\udcca Analytics Dashboard</span></div>
        <div class="win-body">
          <div class="stats-row">
            <div class="stat-box"><span class="stat-num">${s.totalViews}</span><span class="stat-label">Total Views</span></div>
            <div class="stat-box"><span class="stat-num">${s.todayViews}</span><span class="stat-label">Today</span></div>
            <div class="stat-box"><span class="stat-num">${s.weekViews}</span><span class="stat-label">This Week</span></div>
            <div class="stat-box"><span class="stat-num">${s.totalComments}</span><span class="stat-label">Comments</span></div>
            <div class="stat-box"><span class="stat-num">${s.pendingComments}</span><span class="stat-label">Pending \ud83d\udcac</span></div>
            <div class="stat-box"><span class="stat-num">${s.totalSubscribers}</span><span class="stat-label">Subscribers</span></div>
          </div>

          <fieldset class="groupbox"><legend>\ud83d\udcc8 Views (Last 14 Days)</legend>
            <div class="chart-container">
              ${s.recentViewsByDay.length ? s.recentViewsByDay.map(d => {
      const maxDay = Math.max(...s.recentViewsByDay.map(x => x.views)) || 1;
      const pct = Math.round((d.views / maxDay) * 100);
      const label = new Date(d.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `<div class="chart-bar-wrap"><div class="chart-bar" style="height:${pct}%" title="${d.views} views"></div><span class="chart-label">${label}</span></div>`;
    }).join('') : '<p style="color:#808080;font-size:10px;">No view data yet.</p>'}
            </div>
          </fieldset>

          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <fieldset class="groupbox" style="flex:1;min-width:200px;"><legend>\ud83c\udfc6 Most Viewed Projects</legend>
              ${s.topProjects.length ? s.topProjects.map(p => `
                <div class="bar-item">
                  <a href="#/projects/${p.id}" class="bar-name">${esc(p.name)}</a>
                  <div class="bar-track"><div class="bar-fill bar-fill-blue" style="width:${Math.round((p.views / maxProjectViews) * 100)}%"></div></div>
                  <span class="bar-count">${p.views}</span>
                </div>
              `).join('') : '<p style="color:#808080;font-size:10px;">No project views yet.</p>'}
            </fieldset>

            <fieldset class="groupbox" style="flex:1;min-width:200px;"><legend>\ud83c\udfc6 Most Viewed Notes</legend>
              ${s.topNotes.length ? s.topNotes.map(n => `
                <div class="bar-item">
                  <a href="#/notes/${n.id}" class="bar-name">${esc(n.name)}</a>
                  <div class="bar-track"><div class="bar-fill bar-fill-green" style="width:${Math.round((n.views / maxNoteViews) * 100)}%"></div></div>
                  <span class="bar-count">${n.views}</span>
                </div>
              `).join('') : '<p style="color:#808080;font-size:10px;">No note views yet.</p>'}
            </fieldset>
          </div>

          <fieldset class="groupbox"><legend>\ud83d\udcca Category Engagement</legend>
            ${s.categoryEngagement.length ? s.categoryEngagement.map(cat => `
              <div class="bar-item">
                <span class="bar-name cat-tag ${getCatClass(cat.category)}">${esc(cat.category)}</span>
                <div class="bar-track"><div class="bar-fill bar-fill-purple" style="width:${Math.round((cat.views / maxCatViews) * 100)}%"></div></div>
                <span class="bar-count">${cat.views}</span>
              </div>
            `).join('') : '<p style="color:#808080;font-size:10px;">No category data yet.</p>'}
          </fieldset>

          ${s.pendingComments > 0 ? `
          <fieldset class="groupbox"><legend>\u26a0\ufe0f Pending Comments (${s.pendingComments})</legend>
            <div style="text-align:center;"><a href="#/comments" class="win-btn">Manage Comments \u2192</a></div>
          </fieldset>` : ''}

          <fieldset class="groupbox"><legend>\ud83d\udce7 Subscribers (${s.totalSubscribers})</legend>
            <div id="subscribersList">Loading...</div>
          </fieldset>
        </div>
      </div>
    `;
    // Load subscribers
    try {
      const subs = await API.getSubscribers();
      const el = document.getElementById('subscribersList');
      if (el) {
        if (!subs.length) { el.innerHTML = '<p style="color:#808080;font-size:10px;">No subscribers yet.</p>'; }
        else {
          el.innerHTML = `<table class="data-table"><thead><tr><th>Email</th><th>Name</th><th>Active</th><th>Since</th></tr></thead><tbody>
            ${subs.map(s => `<tr><td>${esc(s.email)}</td><td>${esc(s.name || '-')}</td><td>${s.active ? '\u2705' : '\u274c'}</td><td style="font-size:10px;">${fmtDate(s.createdAt)}</td></tr>`).join('')}
          </tbody></table>`;
        }
      }
    } catch (e) { }
    setStatus('Analytics loaded');
  } catch (err) {
    c.innerHTML = `<div class="empty-state">Failed to load analytics. Are you logged in?<br><br><a href="#/">Back to Dashboard</a></div>`;
  }
}

async function renderPendingComments() {
  if (!isAdmin()) { showLoginScreen(); return; }
  const c = document.getElementById('contentArea');
  setStatus('Loading pending comments...');
  try {
    const comments = await API.getPendingComments();
    c.innerHTML = `
      <div class="win-window">
        <div class="win-title-bar"><span>\ud83d\udcac Pending Comments (${comments.length})</span></div>
        <div class="win-body">
          ${!comments.length ? '<div class="empty-state">\u2705 No pending comments!</div>' :
        comments.map(cm => `
              <div class="comment-item pending-comment" id="pending-${cm.id}">
                <div class="comment-header">
                  <strong>${esc(cm.authorName)}</strong>
                  ${cm.authorEmail ? `<span style="color:#808080;">&lt;${esc(cm.authorEmail)}&gt;</span>` : ''}
                  <span class="comment-date">${timeAgo(cm.createdAt)}</span>
                </div>
                <div style="font-size:9px;color:#808080;margin-bottom:4px;">
                  On ${cm.entityType}: <a href="#/${cm.entityType}s/${cm.entityId}">${esc(cm.entityName || 'Unknown')}</a>
                </div>
                <div class="comment-body">${esc(cm.content)}</div>
                <div style="margin-top:4px;">
                  <button class="win-btn btn-sm" onclick="approveComment(${cm.id})">\u2705 Approve</button>
                  <button class="win-btn btn-sm win-btn-danger" onclick="rejectComment(${cm.id})">\u274c Delete</button>
                </div>
              </div>
            `).join('')}
        </div>
      </div>
    `;
    setStatus('Comments loaded');
  } catch (err) {
    c.innerHTML = `<div class="empty-state">Failed to load comments<br><br><a href="#/">Back to Dashboard</a></div>`;
  }
}

async function approveComment(id) {
  try {
    await API.approveComment(id);
    toast('Comment approved!', 'success');
    const el = document.getElementById('pending-' + id);
    if (el) el.style.display = 'none';
  } catch (err) { toast(err.message, 'error'); }
}

async function rejectComment(id) {
  if (!confirm('Delete this comment permanently?')) return;
  try {
    await API.deleteComment(id);
    toast('Comment deleted', 'success');
    const el = document.getElementById('pending-' + id);
    if (el) el.style.display = 'none';
  } catch (err) { toast(err.message, 'error'); }
}

// ══════════════════════════════════════════════════════════
// INITIALIZATION
// ══════════════════════════════════════════════════════════

Router.on('/', renderDashboard);
Router.on('/projects', renderProjectsList);
Router.on('/projects/:id', renderProjectDetail);
Router.on('/notes', renderNotesList);
Router.on('/notes/:id', renderNoteDetail);
Router.on('/stats', renderStats);
Router.on('/comments', renderPendingComments);

window.addEventListener('hashchange', () => Router.resolve());

document.addEventListener('DOMContentLoaded', async () => {
  // Clock
  function updateClock() {
    const el = document.getElementById('clock');
    if (el) el.textContent = new Date().toLocaleTimeString('en-US', { hour12: true });
  }
  updateClock();
  setInterval(updateClock, 1000);

  // ── Login Form Handler ──
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    const errEl = document.getElementById('loginError');
    const username = document.getElementById('loginUser').value.trim();
    const password = document.getElementById('loginPass').value;

    btn.disabled = true;
    btn.textContent = 'Logging in...';
    errEl.style.display = 'none';

    try {
      const data = await API.login(username, password);
      Auth.setSession(data.token, data.username);
      hideLogin();
      updateAdminUI();
      toast('Welcome back, ' + data.username + '!', 'success');
      Router.resolve(); // Re-render current view with admin buttons
    } catch (err) {
      errEl.textContent = err.message || 'Login failed';
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Log In';
    }
  });

  // ── Register Form Handler ──
  document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('regBtn');
    const errEl = document.getElementById('loginError');
    const username = document.getElementById('regUser').value.trim();
    const password = document.getElementById('regPass').value;
    const vipKey = document.getElementById('regVipKey').value.trim();

    btn.disabled = true;
    btn.textContent = 'Creating account...';
    errEl.style.display = 'none';

    try {
      const data = await API.register(username, password, vipKey);
      Auth.setSession(data.token, data.username);
      hideLogin();
      updateAdminUI();
      toast('Welcome, ' + data.username + '! Account created.', 'success');
      Router.resolve();
    } catch (err) {
      errEl.textContent = err.message || 'Registration failed';
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  });

  // ── Login Trigger ──
  document.getElementById('loginTrigger').addEventListener('click', showLoginScreen);

  // ── Logout ──
  document.getElementById('logoutBtn').addEventListener('click', logout);

  // ── Verify existing session silently ──
  if (Auth.isLoggedIn()) {
    try {
      const check = await API.verify();
      if (!check.valid) Auth.clearSession();
    } catch {
      Auth.clearSession();
    }
  }

  // Update admin UI state
  updateAdminUI();

  // Initialize app
  initApp();
});

async function initApp() {
  // Health check
  try {
    await API.health();
    document.getElementById('apiStatus').innerHTML = '<span class="status-led online"></span> API Online';
  } catch {
    document.getElementById('apiStatus').innerHTML = '<span class="status-led offline"></span> API Offline';
  }

  // Sidebar categories
  try {
    const cats = await API.getCategories();
    const notes = await API.getNotes();
    const el = document.getElementById('categoryLinks');
    if (cats.length) {
      el.innerHTML = cats.map(cat => {
        const count = notes.filter(n => n.category === cat).length;
        return `<a href="#/notes" class="tree-item tree-category" onclick="filterByCategory('${cat}')">
          📄 ${cat} <span class="cat-count">(${count})</span></a>`;
      }).join('');
    }
  } catch { }

  // Activity log route
  Router.on('/logs', renderActivityLogs);

  // Mobile menu
  const mobileBtn = document.getElementById('mobileMenuBtn');
  if (mobileBtn) {
    mobileBtn.addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
  }

  // Close sidebar on nav click (mobile)
  document.querySelectorAll('.tree-item[data-route]').forEach(link => {
    link.addEventListener('click', () => document.getElementById('sidebar').classList.remove('open'));
  });

  // Modal
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); hideQuickMenu(); hideLogin(); } });

  // Quick add
  document.getElementById('quickAddBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = document.getElementById('quickMenu');
    if (menu.style.display === 'block') { menu.style.display = 'none'; return; }
    const rect = e.target.getBoundingClientRect();
    menu.style.left = rect.left + 'px';
    menu.style.top = (rect.bottom + 2) + 'px';
    menu.style.display = 'block';
  });
  document.addEventListener('click', () => hideQuickMenu());

  // Search
  const searchInput = document.getElementById('globalSearch');
  searchInput.addEventListener('input', debounce(async () => {
    const q = searchInput.value.trim();
    if (!q) { Router.resolve(); return; }
    setStatus('Searching...');
    const c = document.getElementById('contentArea');
    try {
      const [projects, notes] = await Promise.all([
        API.getProjects(`?q=${encodeURIComponent(q)}`),
        API.getNotes(`?q=${encodeURIComponent(q)}`),
      ]);
      c.innerHTML = `<div class="win-window">
        <div class="win-title-bar"><span>🔍 Search Results for "${esc(q)}"</span></div>
        <div class="win-body" style="padding:6px;">
          ${projects.length ? `<b>📁 Projects (${projects.length}):</b>
            <table class="data-table" style="margin:4px 0 10px;"><thead><tr><th>Name</th><th>Status</th><th>Updated</th></tr></thead>
            <tbody>${projects.map(p => `<tr onclick="Router.navigate('/projects/${p.id}')" style="cursor:pointer;">
              <td><b>${esc(p.name)}</b></td><td><span class="badge badge-${(p.status || 'active').replace(/\s+/g, '-')}">${p.status || 'active'}</span></td>
              <td style="font-size:10px;">${timeAgo(p.updatedAt)}</td></tr>`).join('')}</tbody></table>` : ''}
          ${notes.length ? `<b>📝 Notes (${notes.length}):</b>
            <table class="data-table" style="margin:4px 0;"><thead><tr><th>Title</th><th>Category</th><th>Updated</th></tr></thead>
            <tbody>${notes.map(n => `<tr onclick="Router.navigate('/notes/${n.id}')" style="cursor:pointer;">
              <td><b>${esc(n.title)}</b></td><td><span class="cat-tag ${getCatClass(n.category)}">${esc(n.category || 'General')}</span></td>
              <td style="font-size:10px;">${timeAgo(n.updatedAt)}</td></tr>`).join('')}</tbody></table>` : ''}
          ${!projects.length && !notes.length ? '<div class="empty-state">No results found.</div>' : ''}
        </div></div>`;
      setStatus(`Found ${projects.length + notes.length} result(s)`);
    } catch (err) { toast('Search failed', 'error'); }
  }, 300));

  // Initial route
  Router.resolve();
}

function filterByCategory(cat) {
  Router.navigate('/notes');
  setTimeout(async () => {
    const filtered = await API.getNotes(`?category=${encodeURIComponent(cat)}`);
    const grid = document.getElementById('notesGrid');
    if (grid) {
      grid.innerHTML = filtered.length ?
        `<table class="data-table"><thead><tr><th style="width:20px;"></th><th>Title</th><th>Category</th><th>Preview</th><th>Updated</th></tr></thead><tbody>${filtered.map(n => noteRow(n)).join('')}</tbody></table>` :
        '<div class="empty-state">No notes in this category.</div>';
    }
    document.querySelectorAll('#noteFilters .filter-btn').forEach(b => b.classList.toggle('active', b.dataset.category === cat));
  }, 100);
}
