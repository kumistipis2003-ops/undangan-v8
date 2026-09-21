// Toast Helper
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// Copy to Clipboard Helper
function copyText(text, successMsg = 'Tautan berhasil disalin!') {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => showToast(successMsg));
  } else {
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    showToast(successMsg);
  }
}

// Admin Dashboard Logic
document.addEventListener('DOMContentLoaded', () => {
  // Check if we are on login page
  const loginForm = document.getElementById('admin-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = loginForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.innerText = 'Memverifikasi...';

      const adminId = document.getElementById('adminId').value;
      const password = document.getElementById('password').value;

      try {
        const res = await fetch('/admin/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminId, password })
        });
        const data = await res.json();
        if (data.success) {
          showToast('Login berhasil! Mengalihkan...', 'success');
          setTimeout(() => window.location.href = data.redirect, 800);
        } else {
          showToast(data.message || 'Login gagal.', 'error');
          btn.disabled = false;
          btn.innerText = 'Masuk ke Dashboard';
        }
      } catch (err) {
        showToast('Terjadi kesalahan jaringan.', 'error');
        btn.disabled = false;
        btn.innerText = 'Masuk ke Dashboard';
      }
    });
    return;
  }

  // Logout button
  const logoutBtn = document.getElementById('admin-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await fetch('/admin/api/logout', { method: 'POST' });
      window.location.href = '/admin/login';
    });
  }

  // If on Dashboard, load stats and invitations
  if (document.getElementById('stats-total-invitations')) {
    loadDashboardStats();
    loadInvitationsTable();
  }

  // If on Create Invitation page, load theme options
  if (document.getElementById('create-invitation-form')) {
    loadThemePicker();
    initCreateInvitationForm();
  }

  // If on Themes catalog page
  if (document.getElementById('themes-catalog-container')) {
    loadThemesCatalog();
  }
});

async function loadDashboardStats() {
  try {
    const res = await fetch('/admin/api/stats');
    const json = await res.json();
    if (json.success) {
      document.getElementById('stats-total-invitations').innerText = json.data.totalInvitations;
      document.getElementById('stats-active-invitations').innerText = json.data.activeInvitations;
      document.getElementById('stats-total-guests').innerText = json.data.totalGuests;
      document.getElementById('stats-total-rsvps').innerText = json.data.totalRsvps;
    }
  } catch (err) {
    console.error('Failed to load stats', err);
  }
}

async function loadInvitationsTable() {
  const tbody = document.getElementById('invitations-table-body');
  if (!tbody) return;

  try {
    const res = await fetch('/admin/api/invitations');
    const json = await res.json();
    if (!json.success || json.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:2rem;">Belum ada undangan dibuat.</td></tr>`;
      return;
    }

    tbody.innerHTML = json.data.map(inv => {
      const origin = window.location.origin;
      const mgmtUrl = `${origin}/manage/${inv.management_token}`;
      const previewUrl = `${origin}/preview/${inv.slug}`;

      return `
        <tr>
          <td>
            <div style="font-weight:700;color:#fff;">${inv.title}</div>
            <div style="font-size:0.75rem;color:#94a3b8;">${inv.groom_name} & ${inv.bride_name}</div>
          </td>
          <td>
            <span class="badge badge-info">${inv.theme_name || 'Standar'}</span>
          </td>
          <td>${inv.wedding_date}</td>
          <td>
            <div style="font-size:0.85rem;">
              👥 ${inv.guest_count} Tamu | 💌 ${inv.rsvp_count} RSVP
            </div>
          </td>
          <td>
            <div style="display:flex;align-items:center;gap:0.4rem;">
              <span class="badge ${inv.is_active ? 'badge-success' : 'badge-danger'}">
                ${inv.is_active ? 'Aktif' : 'Nonaktif'}
              </span>
              <button class="btn btn-outline btn-sm" onclick="toggleInvitationStatus(${inv.id})">
                Ubah
              </button>
            </div>
          </td>
          <td>
            <div style="display:flex;gap:0.35rem;align-items:center;">
              <button class="btn btn-primary btn-sm" onclick="copyText('${mgmtUrl}', 'Management Link disalin!')" title="Copy Management Link">
                📋 Copy Link
              </button>
              <a href="${mgmtUrl}" target="_blank" class="btn btn-secondary btn-sm" title="Buka Editor Penyewa">
                ⚙️ Editor
              </a>
              <a href="${previewUrl}" target="_blank" class="btn btn-outline btn-sm" title="Pratinjau Undangan">
                👁️ Preview
              </a>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load invitations', err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#ef4444;padding:2rem;">Gagal memuat data.</td></tr>`;
  }
}

async function toggleInvitationStatus(id) {
  try {
    const res = await fetch(`/admin/api/invitations/${id}/toggle`, { method: 'PATCH' });
    const data = await res.json();
    if (data.success) {
      showToast('Status undangan berhasil diubah!');
      loadInvitationsTable();
      loadDashboardStats();
    }
  } catch (err) {
    showToast('Gagal mengubah status undangan', 'error');
  }
}

async function loadThemePicker() {
  const container = document.getElementById('theme-picker-container');
  if (!container) return;

  try {
    const res = await fetch('/admin/api/themes');
    const json = await res.json();
    if (json.success) {
      container.innerHTML = json.data.map((t, idx) => `
        <div class="theme-card-option ${idx === 0 ? 'selected' : ''}" data-id="${t.id}" onclick="selectThemeCard(this, ${t.id})">
          <div class="theme-card-preview">
            <img src="${t.preview_image}" alt="${t.name}">
          </div>
          <div class="theme-card-info">
            <span class="badge badge-info" style="margin-bottom:0.3rem;">${t.category_name}</span>
            <div class="theme-card-title">${t.name}</div>
            <div class="theme-card-desc">${t.description}</div>
          </div>
        </div>
      `).join('');

      if (json.data.length > 0) {
        document.getElementById('selected-theme-id').value = json.data[0].id;
      }
    }
  } catch (err) {
    console.error('Failed to load themes', err);
  }
}

function selectThemeCard(el, themeId) {
  document.querySelectorAll('.theme-card-option').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('selected-theme-id').value = themeId;
}

function initCreateInvitationForm() {
  const form = document.getElementById('create-invitation-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerText = 'Menyimpan...';

    const payload = {
      title: document.getElementById('invTitle').value,
      groom_name: document.getElementById('groomName').value,
      bride_name: document.getElementById('brideName').value,
      wedding_date: document.getElementById('weddingDate').value,
      theme_id: document.getElementById('selected-theme-id').value,
      status: document.getElementById('invStatus').value
    };

    try {
      const res = await fetch('/admin/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        // Show Success Modal with Management Link
        const modal = document.getElementById('inv-success-modal');
        if (modal) {
          const fullMgmtUrl = `${window.location.origin}${data.data.managementUrl}`;
          document.getElementById('modal-management-link-input').value = fullMgmtUrl;
          document.getElementById('modal-copy-link-btn').onclick = () => {
            copyText(fullMgmtUrl, 'Management Link disalin!');
          };
          document.getElementById('modal-open-editor-btn').href = fullMgmtUrl;
          modal.classList.add('active');
        } else {
          showToast('Undangan berhasil dibuat!');
          window.location.href = '/admin/dashboard';
        }
      } else {
        showToast(data.message || 'Gagal membuat undangan.', 'error');
        btn.disabled = false;
        btn.innerText = 'Buat Undangan Sekarang';
      }
    } catch (err) {
      showToast('Terjadi kesalahan jaringan.', 'error');
      btn.disabled = false;
      btn.innerText = 'Buat Undangan Sekarang';
    }
  });
}

async function loadThemesCatalog() {
  const container = document.getElementById('themes-catalog-container');
  if (!container) return;

  try {
    const res = await fetch('/admin/api/themes');
    const json = await res.json();
    if (json.success) {
      container.innerHTML = json.data.map(t => `
        <div class="theme-card-option" style="cursor:default;">
          <div class="theme-card-preview" style="height:180px;">
            <img src="${t.preview_image}" alt="${t.name}">
          </div>
          <div class="theme-card-info">
            <span class="badge badge-info" style="margin-bottom:0.4rem;">${t.category_name}</span>
            <div class="theme-card-title" style="font-size:1.1rem;">${t.name}</div>
            <div class="theme-card-desc" style="font-size:0.85rem;margin:0.5rem 0;">${t.description}</div>
            <div style="font-size:0.75rem;color:#64748b;font-family:monospace;">${t.theme_path}</div>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load theme catalog', err);
  }
}
