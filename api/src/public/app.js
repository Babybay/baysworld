/* ═══════════════════════════════════════════════════════════
   BaysWorld v2.0 — Frontend Application (Retro 2000s Edition)
   ═══════════════════════════════════════════════════════════ */

// ── API Service ──
const API = {
  base: '/api',
  async request(method, path, body = null) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(this.base + path, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  },
  getProjects(q = '') { return this.request('GET', '/projects' + q); },
  getProject(id) { return this.request('GET', '/projects/' + id); },
  createProject(d) { return this.request('POST', '/projects', d); },
  updateProject(id, d) { return this.request('PUT', '/projects/' + id, d); },
  deleteProject(id) { return this.request('DELETE', '/projects/' + id); },
  getNotes(q = '') { return this.request('GET', '/notes' + q); },
  getNote(id) { return this.request('GET', '/notes/' + id); },
  createNote(d) { return this.request('POST', '/notes', d); },
  updateNote(id, d) { return this.request('PUT', '/notes/' + id, d); },
  deleteNote(id) { return this.request('DELETE', '/notes/' + id); },
  getCategories() { return this.request('GET', '/notes/categories'); },
  health() { return this.request('GET', '/health'); },
};

// ── Markdown Parser ──
function parseMarkdown(md) {
  if (!md) return '';
  let html = md
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="lang-${lang}">${esc(code.trim())}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
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
    .replace(/^[\-\*] (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  html = html.replace(/((?:<li>.*?<\/li><br>?)+)/g, '<ul>$1</ul>');
  html = html.replace(/<br><\/ul>/g, '</ul>');
  html = '<p>' + html + '</p>';
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>(<h[1-4]>)/g, '$1');
  html = html.replace(/(<\/h[1-4]>)<\/p>/g, '$1');
  html = html.replace(/<p>(<pre>)/g, '$1');
  html = html.replace(/(<\/pre>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)<\/p>/g, '$1');
  html = html.replace(/<p>(<blockquote>)/g, '$1');
  html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');
  html = html.replace(/<p>(<hr>)<\/p>/g, '$1');
  html = html.replace(/<p><br>/g, '<p>');
  return html;
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
function setAddr(path) { const el = document.getElementById('addressBar'); if (el) el.textContent = 'http://baysworld.dev' + path; }

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

// ── Router ──
const Router = {
  routes: {},
  on(p, h) { this.routes[p] = h; },
  navigate(p) { window.location.hash = p; },
  async resolve() {
    const hash = window.location.hash.slice(1) || '/';
    setAddr(hash);
    // Update nav
    document.querySelectorAll('.tree-item[data-route]').forEach(el => {
      const r = el.getAttribute('data-route');
      el.classList.toggle('active', r === hash || (r !== '/' && hash.startsWith(r)));
    });
    // Match
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

// ── Dashboard ──
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
      <div class="retro-marquee"><span>★ Welcome to BaysWorld Developer Hub ★ Your personal project portfolio and knowledge base ★ Powered by Node.js ★</span></div>

      <div class="welcome-box" style="margin-top:10px;">
        <h2>📟 Welcome to BaysWorld v2.0</h2>
        <p>A lightweight Project Portfolio & Developer Knowledge Base.<br>
        Manage your projects, write notes in Markdown, and keep your developer knowledge organized.</p>
        <p style="margin-top:4px;font-size:10px;color:#808080;">
          <i>Best viewed with Internet Explorer 5.0 or Netscape Navigator 4.7 at 800×600 resolution</i>
        </p>
      </div>

      <div class="stats-row">
        <div class="stat-box">
          <span class="stat-num">${projects.length}</span>
          <span class="stat-label">Total Projects</span>
        </div>
        <div class="stat-box">
          <span class="stat-num">${active + inProg}</span>
          <span class="stat-label">Active</span>
        </div>
        <div class="stat-box">
          <span class="stat-num">${notes.length}</span>
          <span class="stat-label">Total Notes</span>
        </div>
        <div class="stat-box">
          <span class="stat-num">${pinned}</span>
          <span class="stat-label">Pinned 📌</span>
        </div>
      </div>

      <hr class="retro-hr">

      ${projects.length ? `
      <div class="win-window">
        <div class="win-title-bar"><span>📁 Recent Projects</span></div>
        <div class="win-body" style="padding:6px;">
          <table class="data-table">
            <thead><tr><th>Name</th><th>Status</th><th>Tech Stack</th><th>Updated</th></tr></thead>
            <tbody>
              ${projects.slice(0, 5).map(p => `
                <tr onclick="Router.navigate('/projects/${p.id}')" style="cursor:pointer;">
                  <td><b>${esc(p.name)}</b></td>
                  <td><span class="badge badge-${(p.status || 'active').replace(/\s+/g, '-')}">${p.status || 'active'}</span></td>
                  <td>${(p.techStack || []).slice(0, 3).map(t => `<span class="tech-tag">${esc(t)}</span>`).join(' ')}</td>
                  <td style="font-size:10px;color:#808080;">${timeAgo(p.updatedAt)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div style="text-align:right;margin-top:4px;"><a href="#/projects">View all projects →</a></div>
        </div>
      </div>
      ` : '<div class="groupbox"><p>No projects yet. <a href="#" onclick="showProjectForm();return false;">Create your first project!</a></p></div>'}

      ${notes.length ? `
      <div class="win-window">
        <div class="win-title-bar"><span>📝 Recent Notes</span></div>
        <div class="win-body" style="padding:6px;">
          <table class="data-table">
            <thead><tr><th></th><th>Title</th><th>Category</th><th>Updated</th></tr></thead>
            <tbody>
              ${notes.slice(0, 5).map(n => `
                <tr onclick="Router.navigate('/notes/${n.id}')" style="cursor:pointer;">
                  <td style="width:20px;">${n.pinned ? '📌' : ''}</td>
                  <td><b>${esc(n.title)}</b></td>
                  <td><span class="cat-tag ${getCatClass(n.category)}">${esc(n.category || 'General')}</span></td>
                  <td style="font-size:10px;color:#808080;">${timeAgo(n.updatedAt)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div style="text-align:right;margin-top:4px;"><a href="#/notes">View all notes →</a></div>
        </div>
      </div>
      ` : '<div class="groupbox"><p>No notes yet. <a href="#" onclick="showNoteForm();return false;">Write your first note!</a></p></div>'}

      <hr class="retro-hr">

      <div class="visitor-counter">
        You are visitor number:<br>
        <span class="counter-display">${visitorNum}</span>
      </div>

      <p style="text-align:center;font-size:10px;color:#808080;margin-top:8px;">
        🏗️ This site is under construction 🏗️<br>
        <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" width="88" height="1">
      </p>
    `;
    setStatus('Done');
  } catch (err) {
    c.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
    setStatus('Error');
  }
}

// ── Projects List ──
async function renderProjectsList() {
  const c = document.getElementById('contentArea');
  setStatus('Loading projects...');
  try {
    const projects = await API.getProjects();
    c.innerHTML = `
      <div class="section-header">
        <span class="section-title">📁 All Projects (${projects.length})</span>
        <button class="win-btn" onclick="showProjectForm()">📄 New Project</button>
      </div>

      <div class="filter-bar" id="projectFilters">
        <button class="filter-btn active" data-status="">All</button>
        <button class="filter-btn" data-status="active">🟢 Active</button>
        <button class="filter-btn" data-status="in-progress">🟡 In Progress</button>
        <button class="filter-btn" data-status="archived">⚫ Archived</button>
      </div>

      <div id="projectsGrid">
        ${projects.length ? `
          <table class="data-table">
            <thead><tr><th>Name</th><th>Description</th><th>Status</th><th>Tech Stack</th><th>Links</th><th>Updated</th></tr></thead>
            <tbody>${projects.map(p => projectRow(p)).join('')}</tbody>
          </table>
        ` : '<div class="empty-state"><div class="empty-icon">📁</div>No projects yet.<br><br><button class="win-btn" onclick="showProjectForm()">Create Project</button></div>'}
      </div>
    `;

    document.querySelectorAll('#projectFilters .filter-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        document.querySelectorAll('#projectFilters .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const s = btn.dataset.status;
        const q = s ? `?status=${s}` : '';
        const filtered = await API.getProjects(q);
        document.getElementById('projectsGrid').innerHTML = filtered.length ?
          `<table class="data-table"><thead><tr><th>Name</th><th>Description</th><th>Status</th><th>Tech Stack</th><th>Links</th><th>Updated</th></tr></thead><tbody>${filtered.map(p => projectRow(p)).join('')}</tbody></table>` :
          '<div class="empty-state">No projects in this category.</div>';
      });
    });
    setStatus(`${projects.length} project(s) loaded`);
  } catch (err) {
    c.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
    setStatus('Error');
  }
}

function projectRow(p) {
  return `
    <tr onclick="Router.navigate('/projects/${p.id}')" style="cursor:pointer;">
      <td><b>${esc(p.name)}</b></td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc((p.description || '').slice(0, 60))}</td>
      <td><span class="badge badge-${(p.status || 'active').replace(/\s+/g, '-')}">${p.status || 'active'}</span></td>
      <td>${(p.techStack || []).slice(0, 4).map(t => `<span class="tech-tag">${esc(t)}</span>`).join(' ')}</td>
      <td style="white-space:nowrap;">
        ${p.githubUrl ? `<a href="${p.githubUrl}" target="_blank" onclick="event.stopPropagation()">GitHub</a> ` : ''}
        ${p.liveUrl ? `<a href="${p.liveUrl}" target="_blank" onclick="event.stopPropagation()">Live</a>` : ''}
      </td>
      <td style="font-size:10px;color:#808080;">${timeAgo(p.updatedAt)}</td>
    </tr>
  `;
}

// ── Project Detail ──
async function renderProjectDetail(id) {
  const c = document.getElementById('contentArea');
  setStatus('Loading project...');
  try {
    const p = await API.getProject(id);
    c.innerHTML = `
      <a class="back-link" onclick="history.back()">⬅ Back to Projects</a>

      <div class="win-window">
        <div class="win-title-bar"><span>📁 ${esc(p.name)}</span></div>
        <div class="win-body">
          <div style="margin-bottom:8px;">
            <span class="badge badge-${(p.status || 'active').replace(/\s+/g, '-')}">${p.status || 'active'}</span>
            ${p.description ? `<p style="margin-top:6px;">${esc(p.description)}</p>` : ''}
          </div>

          <div style="margin-bottom:8px;">
            <button class="win-btn btn-sm" onclick="showProjectForm('${p.id}')">✏️ Edit</button>
            <button class="win-btn btn-sm win-btn-danger" onclick="confirmDeleteProject('${p.id}')">🗑️ Delete</button>
          </div>

          <div class="detail-grid">
            <div class="detail-item">
              <div class="dl">Status</div>
              <div class="dv"><span class="badge badge-${(p.status || 'active').replace(/\s+/g, '-')}">${p.status || 'active'}</span></div>
            </div>
            <div class="detail-item">
              <div class="dl">Created</div>
              <div class="dv">${fmtDate(p.createdAt)}</div>
            </div>
            <div class="detail-item">
              <div class="dl">Updated</div>
              <div class="dv">${fmtDate(p.updatedAt)}</div>
            </div>
            ${p.githubUrl ? `<div class="detail-item"><div class="dl">GitHub</div><div class="dv"><a href="${p.githubUrl}" target="_blank">${esc(p.githubUrl)}</a></div></div>` : ''}
            ${p.liveUrl ? `<div class="detail-item"><div class="dl">Live URL</div><div class="dv"><a href="${p.liveUrl}" target="_blank">${esc(p.liveUrl)}</a></div></div>` : ''}
          </div>

          ${p.techStack && p.techStack.length ? `
            <fieldset class="groupbox"><legend>Tech Stack</legend>
              ${p.techStack.map(t => `<span class="tech-tag">${esc(t)}</span>`).join(' ')}
            </fieldset>
          ` : ''}

          ${p.tags && p.tags.length ? `
            <fieldset class="groupbox"><legend>Tags</legend>
              ${p.tags.map(t => `<span class="note-tag">${esc(t)}</span>`).join(' ')}
            </fieldset>
          ` : ''}

          ${p.notes ? `
            <fieldset class="groupbox"><legend>Notes</legend>
              <div class="note-content">${parseMarkdown(p.notes)}</div>
            </fieldset>
          ` : ''}
        </div>
      </div>
    `;
    setStatus('Project loaded');
  } catch (err) {
    c.innerHTML = `<div class="empty-state">Project Not Found<br><br><a href="#/projects">Back to Projects</a></div>`;
    setStatus('Error');
  }
}

// ── Notes List ──
async function renderNotesList() {
  const c = document.getElementById('contentArea');
  setStatus('Loading notes...');
  try {
    const [notes, cats] = await Promise.all([API.getNotes(), API.getCategories()]);
    const allCats = ['All', ...cats];

    c.innerHTML = `
      <div class="section-header">
        <span class="section-title">📝 Knowledge Base (${notes.length} notes)</span>
        <button class="win-btn" onclick="showNoteForm()">📄 New Note</button>
      </div>

      <div class="filter-bar" id="noteFilters">
        ${allCats.map((cat, i) => `<button class="filter-btn ${i === 0 ? 'active' : ''}" data-category="${cat === 'All' ? '' : cat}">${cat}</button>`).join('')}
      </div>

      <div id="notesGrid">
        ${notes.length ? `
          <table class="data-table">
            <thead><tr><th style="width:20px;"></th><th>Title</th><th>Category</th><th>Preview</th><th>Updated</th></tr></thead>
            <tbody>${notes.map(n => noteRow(n)).join('')}</tbody>
          </table>
        ` : '<div class="empty-state"><div class="empty-icon">📝</div>No notes yet.<br><br><button class="win-btn" onclick="showNoteForm()">Create Note</button></div>'}
      </div>
    `;

    document.querySelectorAll('#noteFilters .filter-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        document.querySelectorAll('#noteFilters .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const cat = btn.dataset.category;
        const q = cat ? `?category=${encodeURIComponent(cat)}` : '';
        const filtered = await API.getNotes(q);
        document.getElementById('notesGrid').innerHTML = filtered.length ?
          `<table class="data-table"><thead><tr><th style="width:20px;"></th><th>Title</th><th>Category</th><th>Preview</th><th>Updated</th></tr></thead><tbody>${filtered.map(n => noteRow(n)).join('')}</tbody></table>` :
          '<div class="empty-state">No notes in this category.</div>';
      });
    });
    setStatus(`${notes.length} note(s) loaded`);
  } catch (err) {
    c.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
    setStatus('Error');
  }
}

function noteRow(n) {
  return `
    <tr onclick="Router.navigate('/notes/${n.id}')" style="cursor:pointer;">
      <td>${n.pinned ? '📌' : ''}</td>
      <td><b>${esc(n.title)}</b></td>
      <td><span class="cat-tag ${getCatClass(n.category)}">${esc(n.category || 'General')}</span></td>
      <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:#808080;">${esc(strip(n.content).slice(0, 80))}</td>
      <td style="font-size:10px;color:#808080;">${timeAgo(n.updatedAt)}</td>
    </tr>
  `;
}

// ── Note Detail ──
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
            ${n.tags && n.tags.length ? n.tags.map(t => `<span class="note-tag">${esc(t)}</span>`).join(' ') : ''}
          </div>

          <div style="font-size:10px;color:#808080;margin-bottom:8px;">
            Last updated: ${fmtDate(n.updatedAt)} · Created: ${fmtDate(n.createdAt)}
          </div>

          <div style="margin-bottom:10px;">
            <button class="win-btn btn-sm" onclick="showNoteForm('${n.id}')">✏️ Edit</button>
            <button class="win-btn btn-sm" onclick="togglePin('${n.id}', ${!n.pinned})">${n.pinned ? '📌 Unpin' : '📌 Pin'}</button>
            <button class="win-btn btn-sm win-btn-danger" onclick="confirmDeleteNote('${n.id}')">🗑️ Delete</button>
          </div>

          <hr class="retro-hr">

          <div class="note-content">${parseMarkdown(n.content)}</div>
        </div>
      </div>
    `;
    setStatus('Note loaded');
  } catch (err) {
    c.innerHTML = `<div class="empty-state">Note Not Found<br><br><a href="#/notes">Back to Notes</a></div>`;
    setStatus('Error');
  }
}

// ══════════════════════════════════════════════════════════
// FORM HANDLERS
// ══════════════════════════════════════════════════════════

async function showProjectForm(editId = null) {
  let p = { name: '', description: '', techStack: [], status: 'active', githubUrl: '', liveUrl: '', tags: [], notes: '' };
  if (editId) { try { p = await API.getProject(editId); } catch (e) { toast('Not found', 'error'); return; } }

  openModal(editId ? 'Edit Project' : 'New Project', `
    <form id="pForm">
      <div class="form-group">
        <label class="form-label">Project Name *</label>
        <input class="form-input" name="name" value="${esc(p.name)}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <input class="form-input" name="description" value="${esc(p.description)}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-select" name="status">
            <option value="active" ${p.status === 'active' ? 'selected' : ''}>Active</option>
            <option value="in-progress" ${p.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
            <option value="archived" ${p.status === 'archived' ? 'selected' : ''}>Archived</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Tech Stack</label>
          <input class="form-input" name="techStack" value="${(p.techStack || []).join(', ')}">
          <span class="form-hint">Comma-separated</span>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">GitHub URL</label>
          <input class="form-input" name="githubUrl" value="${esc(p.githubUrl || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Live URL</label>
          <input class="form-input" name="liveUrl" value="${esc(p.liveUrl || '')}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Tags</label>
        <input class="form-input" name="tags" value="${(p.tags || []).join(', ')}">
        <span class="form-hint">Comma-separated</span>
      </div>
      <div class="form-group">
        <label class="form-label">Notes (Markdown)</label>
        <textarea class="form-textarea" name="notes">${p.notes || ''}</textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="win-btn" onclick="closeModal()">Cancel</button>
        <button type="submit" class="win-btn win-btn-primary">${editId ? 'Update' : 'Create'}</button>
      </div>
    </form>
  `);

  document.getElementById('pForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      name: fd.get('name'), description: fd.get('description'), status: fd.get('status'),
      techStack: fd.get('techStack').split(',').map(s => s.trim()).filter(Boolean),
      githubUrl: fd.get('githubUrl'), liveUrl: fd.get('liveUrl'),
      tags: fd.get('tags').split(',').map(s => s.trim()).filter(Boolean),
      notes: fd.get('notes'),
    };
    try {
      if (editId) { await API.updateProject(editId, data); toast('Project updated!', 'success'); }
      else { await API.createProject(data); toast('Project created!', 'success'); }
      closeModal(); Router.resolve();
    } catch (err) { toast(err.message, 'error'); }
  });
}

async function showNoteForm(editId = null) {
  let n = { title: '', content: '', category: 'General', tags: [], pinned: false };
  if (editId) { try { n = await API.getNote(editId); } catch (e) { toast('Not found', 'error'); return; } }
  const cats = ['General', 'Cyber Security', 'DevOps', 'Frontend', 'Backend', 'Database', 'Networking', 'Tools', 'Career', 'Learning'];

  openModal(editId ? 'Edit Note' : 'New Note', `
    <form id="nForm">
      <div class="form-group">
        <label class="form-label">Title *</label>
        <input class="form-input" name="title" value="${esc(n.title)}" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Category</label>
          <select class="form-select" name="category">
            ${cats.map(c => `<option value="${c}" ${n.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Tags</label>
          <input class="form-input" name="tags" value="${(n.tags || []).join(', ')}">
          <span class="form-hint">Comma-separated</span>
        </div>
      </div>
      <div class="form-group">
        <label class="form-check"><input type="checkbox" name="pinned" ${n.pinned ? 'checked' : ''}> 📌 Pin this note</label>
      </div>
      <div class="form-group">
        <label class="form-label">Content (Markdown)</label>
        <textarea class="form-textarea" name="content" style="min-height:200px;">${n.content || ''}</textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="win-btn" onclick="closeModal()">Cancel</button>
        <button type="submit" class="win-btn win-btn-primary">${editId ? 'Update' : 'Create'}</button>
      </div>
    </form>
  `);

  document.getElementById('nForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      title: fd.get('title'), content: fd.get('content'), category: fd.get('category'),
      tags: fd.get('tags').split(',').map(s => s.trim()).filter(Boolean),
      pinned: fd.has('pinned'),
    };
    try {
      if (editId) { await API.updateNote(editId, data); toast('Note updated!', 'success'); }
      else { await API.createNote(data); toast('Note created!', 'success'); }
      closeModal(); Router.resolve();
    } catch (err) { toast(err.message, 'error'); }
  });
}

// ── Actions ──
async function confirmDeleteProject(id) {
  if (!confirm('Are you sure you want to delete this project?')) return;
  try { await API.deleteProject(id); toast('Deleted', 'success'); Router.navigate('/projects'); }
  catch (err) { toast(err.message, 'error'); }
}
async function confirmDeleteNote(id) {
  if (!confirm('Are you sure you want to delete this note?')) return;
  try { await API.deleteNote(id); toast('Deleted', 'success'); Router.navigate('/notes'); }
  catch (err) { toast(err.message, 'error'); }
}
async function togglePin(id, pinned) {
  try { await API.updateNote(id, { pinned }); toast(pinned ? 'Pinned!' : 'Unpinned', 'success'); Router.resolve(); }
  catch (err) { toast(err.message, 'error'); }
}

// ══════════════════════════════════════════════════════════
// INITIALIZATION
// ══════════════════════════════════════════════════════════

Router.on('/', renderDashboard);
Router.on('/projects', renderProjectsList);
Router.on('/projects/:id', renderProjectDetail);
Router.on('/notes', renderNotesList);
Router.on('/notes/:id', renderNoteDetail);

window.addEventListener('hashchange', () => Router.resolve());

document.addEventListener('DOMContentLoaded', async () => {
  // Clock
  function updateClock() {
    const now = new Date();
    document.getElementById('clock').textContent = now.toLocaleTimeString('en-US', { hour12: true });
  }
  updateClock();
  setInterval(updateClock, 1000);

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
          📄 ${cat} <span class="cat-count">(${count})</span>
        </a>`;
      }).join('');
    }
  } catch { }

  // Mobile menu
  const mobileBtn = document.getElementById('mobileMenuBtn');
  if (mobileBtn) {
    mobileBtn.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });
  }

  // Close sidebar on nav click (mobile)
  document.querySelectorAll('.tree-item[data-route]').forEach(link => {
    link.addEventListener('click', () => document.getElementById('sidebar').classList.remove('open'));
  });

  // Modal
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); hideQuickMenu(); } });

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

  // Global search
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
      c.innerHTML = `
        <div class="win-window">
          <div class="win-title-bar"><span>🔍 Search Results for "${esc(q)}"</span></div>
          <div class="win-body" style="padding:6px;">
            ${projects.length ? `
              <b>📁 Projects (${projects.length}):</b>
              <table class="data-table" style="margin:4px 0 10px;">
                <thead><tr><th>Name</th><th>Status</th><th>Updated</th></tr></thead>
                <tbody>${projects.map(p => `
                  <tr onclick="Router.navigate('/projects/${p.id}')" style="cursor:pointer;">
                    <td><b>${esc(p.name)}</b></td>
                    <td><span class="badge badge-${(p.status || 'active').replace(/\s+/g, '-')}">${p.status || 'active'}</span></td>
                    <td style="font-size:10px;">${timeAgo(p.updatedAt)}</td>
                  </tr>`).join('')}</tbody>
              </table>` : ''}
            ${notes.length ? `
              <b>📝 Notes (${notes.length}):</b>
              <table class="data-table" style="margin:4px 0;">
                <thead><tr><th>Title</th><th>Category</th><th>Updated</th></tr></thead>
                <tbody>${notes.map(n => `
                  <tr onclick="Router.navigate('/notes/${n.id}')" style="cursor:pointer;">
                    <td><b>${esc(n.title)}</b></td>
                    <td><span class="cat-tag ${getCatClass(n.category)}">${esc(n.category || 'General')}</span></td>
                    <td style="font-size:10px;">${timeAgo(n.updatedAt)}</td>
                  </tr>`).join('')}</tbody>
              </table>` : ''}
            ${!projects.length && !notes.length ? '<div class="empty-state">No results found.</div>' : ''}
          </div>
        </div>
      `;
      setStatus(`Found ${projects.length + notes.length} result(s)`);
    } catch (err) { toast('Search failed', 'error'); }
  }, 300));

  // Initial route
  Router.resolve();
});

// Category filter from sidebar
function filterByCategory(cat) {
  Router.navigate('/notes');
  setTimeout(async () => {
    const q = `?category=${encodeURIComponent(cat)}`;
    const filtered = await API.getNotes(q);
    const grid = document.getElementById('notesGrid');
    if (grid) {
      grid.innerHTML = filtered.length ?
        `<table class="data-table"><thead><tr><th style="width:20px;"></th><th>Title</th><th>Category</th><th>Preview</th><th>Updated</th></tr></thead><tbody>${filtered.map(n => noteRow(n)).join('')}</tbody></table>` :
        '<div class="empty-state">No notes in this category.</div>';
    }
    document.querySelectorAll('#noteFilters .filter-btn').forEach(b => b.classList.toggle('active', b.dataset.category === cat));
  }, 100);
}
