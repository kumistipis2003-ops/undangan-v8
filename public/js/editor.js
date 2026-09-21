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

// Copy Text Helper
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

// Global editor state
let editorData = {
  invitation: null,
  events: [],
  guests: [],
  rsvps: [],
  wishes: []
};

// Extract managementToken from current URL (/manage/:token)
const currentPath = window.location.pathname.split('/');
const managementToken = currentPath[2];

document.addEventListener('DOMContentLoaded', () => {
  if (!managementToken) return;

  initTabs();
  loadEditorData();
  initFormListeners();
  initShareModal();
});

// Tab Navigation Logic
function initTabs() {
  const tabButtons = document.querySelectorAll('.editor-tab-btn, .mobile-nav-btn');
  const panes = document.querySelectorAll('.editor-pane');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetPane = btn.getAttribute('data-tab');
      if (!targetPane) return;

      // Update active states
      document.querySelectorAll('.editor-tab-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-tab') === targetPane);
      });
      document.querySelectorAll('.mobile-nav-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-tab') === targetPane);
      });

      panes.forEach(pane => {
        pane.classList.toggle('active', pane.id === `pane-${targetPane}`);
      });

      // Scroll to top of content
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

// Load Full Data for Tenant
async function loadEditorData() {
  try {
    const res = await fetch(`/manage/api/${managementToken}/details`);
    const json = await res.json();

    if (!json.success) {
      showToast('Gagal memuat data undangan.', 'error');
      return;
    }

    editorData = json.data;
    renderEditorHeader();
    renderDashboardSummary();
    populateDataForm();
    renderThemePicker();
    renderEventsList();
    renderGuestsList();
    renderRsvpList();
    renderWishesList();
    updatePreviewButtons();
  } catch (err) {
    console.error('Failed to load editor data', err);
    showToast('Terjadi kesalahan koneksi server.', 'error');
  }
}

function renderEditorHeader() {
  const inv = editorData.invitation;
  document.getElementById('header-invitation-title').innerText = inv.title;
}

function updatePreviewButtons() {
  const inv = editorData.invitation;
  const origin = window.location.origin;
  const previewUrl = `${origin}/preview/${inv.slug}`;

  const previewBtn = document.getElementById('header-preview-btn');
  if (previewBtn) previewBtn.href = previewUrl;

  const quickPreviewBtn = document.getElementById('quick-preview-link');
  if (quickPreviewBtn) quickPreviewBtn.href = previewUrl;
}

function renderDashboardSummary() {
  const inv = editorData.invitation;
  document.getElementById('summary-bride-groom').innerText = `${inv.groom_name} & ${inv.bride_name}`;
  document.getElementById('summary-wedding-date').innerText = inv.wedding_date || '-';
  document.getElementById('summary-theme-name').innerText = inv.theme_name;
  document.getElementById('summary-guest-count').innerText = editorData.guests.length;
  document.getElementById('summary-rsvp-count').innerText = editorData.rsvps.length;

  const totalHadir = editorData.rsvps.filter(r => r.attendance_status === 'Hadir').reduce((acc, r) => acc + (r.guest_count || 1), 0);
  document.getElementById('summary-attending-count').innerText = `${totalHadir} orang`;
}

function populateDataForm() {
  const inv = editorData.invitation;
  document.getElementById('groom_name').value = inv.groom_name || '';
  document.getElementById('groom_nickname').value = inv.groom_nickname || '';
  document.getElementById('groom_parents').value = inv.groom_parents || '';
  document.getElementById('bride_name').value = inv.bride_name || '';
  document.getElementById('bride_nickname').value = inv.bride_nickname || '';
  document.getElementById('bride_parents').value = inv.bride_parents || '';
  document.getElementById('wedding_date').value = inv.wedding_date || '';
  document.getElementById('wedding_time').value = inv.wedding_time || '';
  document.getElementById('venue_name').value = inv.venue_name || '';
  document.getElementById('venue_address').value = inv.venue_address || '';
  document.getElementById('maps_url').value = inv.maps_url || '';
  document.getElementById('opening_text').value = inv.opening_text || '';
  document.getElementById('closing_text').value = inv.closing_text || '';
}

async function renderThemePicker() {
  const container = document.getElementById('theme-selection-grid');
  if (!container) return;

  try {
    const res = await fetch('/admin/api/themes');
    const json = await res.json();
    if (!json.success) return;

    const currentThemeId = editorData.invitation.theme_id;

    container.innerHTML = json.data.map(t => {
      const isSelected = t.id === currentThemeId;
      return `
        <div class="theme-card-option ${isSelected ? 'selected' : ''}" onclick="changeInvitationTheme(${t.id})">
          <div class="theme-card-preview">
            <img src="${t.preview_image}" alt="${t.name}">
          </div>
          <div class="theme-card-info">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.3rem;">
              <span class="badge badge-info">${t.category_name}</span>
              ${isSelected ? '<span class="badge badge-success">Dipakai</span>' : ''}
            </div>
            <div class="theme-card-title">${t.name}</div>
            <div class="theme-card-desc">${t.description}</div>
            <button class="btn btn-sm ${isSelected ? 'btn-success' : 'btn-outline'}" style="width:100%;margin-top:0.75rem;">
              ${isSelected ? '✓ Tema Aktif' : 'Pilih Tema Ini'}
            </button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load theme picker', err);
  }
}

async function changeInvitationTheme(themeId) {
  try {
    const res = await fetch(`/manage/api/${managementToken}/theme`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme_id: themeId })
    });
    const json = await res.json();
    if (json.success) {
      showToast('Desain tema berhasil diubah!');
      editorData.invitation.theme_id = themeId;
      renderThemePicker();
      loadEditorData();
    } else {
      showToast(json.message || 'Gagal mengubah tema.', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan saat mengubah tema.', 'error');
  }
}

function initFormListeners() {
  // Save Data Form
  const dataForm = document.getElementById('invitation-data-form');
  if (dataForm) {
    dataForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = dataForm.querySelector('button[type="submit"]');
      saveBtn.disabled = true;
      saveBtn.innerText = 'Menyimpan...';

      const payload = {
        groom_name: document.getElementById('groom_name').value,
        groom_nickname: document.getElementById('groom_nickname').value,
        groom_parents: document.getElementById('groom_parents').value,
        bride_name: document.getElementById('bride_name').value,
        bride_nickname: document.getElementById('bride_nickname').value,
        bride_parents: document.getElementById('bride_parents').value,
        wedding_date: document.getElementById('wedding_date').value,
        wedding_time: document.getElementById('wedding_time').value,
        venue_name: document.getElementById('venue_name').value,
        venue_address: document.getElementById('venue_address').value,
        maps_url: document.getElementById('maps_url').value,
        opening_text: document.getElementById('opening_text').value,
        closing_text: document.getElementById('closing_text').value
      };

      try {
        const res = await fetch(`/manage/api/${managementToken}/data`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
          showToast('Data undangan berhasil disimpan!');
          loadEditorData();
        } else {
          showToast(json.message || 'Gagal menyimpan data.', 'error');
        }
      } catch (err) {
        showToast('Terjadi kesalahan jaringan.', 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = 'Simpan Perubahan';
      }
    });
  }

  // Add Event Form
  const eventForm = document.getElementById('add-event-form');
  if (eventForm) {
    eventForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = eventForm.querySelector('button[type="submit"]');
      btn.disabled = true;

      const payload = {
        event_name: document.getElementById('event_name').value,
        event_date: document.getElementById('event_date').value,
        start_time: document.getElementById('event_start_time').value,
        end_time: document.getElementById('event_end_time').value,
        venue_name: document.getElementById('event_venue').value,
        venue_address: document.getElementById('event_address').value,
        maps_url: document.getElementById('event_maps').value
      };

      try {
        const res = await fetch(`/manage/api/${managementToken}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
          showToast('Acara berhasil ditambahkan!');
          eventForm.reset();
          document.getElementById('modal-add-event').classList.remove('active');
          loadEditorData();
        } else {
          showToast(json.message || 'Gagal menambahkan acara.', 'error');
        }
      } catch (err) {
        showToast('Terjadi kesalahan jaringan.', 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }

  // Add Guest Form
  const guestForm = document.getElementById('add-guest-form');
  if (guestForm) {
    guestForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = guestForm.querySelector('button[type="submit"]');
      btn.disabled = true;

      const payload = {
        name: document.getElementById('guest_name').value,
        phone: document.getElementById('guest_phone').value,
        category: document.getElementById('guest_category').value
      };

      try {
        const res = await fetch(`/manage/api/${managementToken}/guests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
          showToast('Tamu berhasil ditambahkan!');
          guestForm.reset();
          document.getElementById('modal-add-guest').classList.remove('active');
          loadEditorData();
        } else {
          showToast(json.message || 'Gagal menambahkan tamu.', 'error');
        }
      } catch (err) {
        showToast('Terjadi kesalahan jaringan.', 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }
}

function renderEventsList() {
  const container = document.getElementById('events-list-container');
  if (!container) return;

  if (editorData.events.length === 0) {
    container.innerHTML = `<div style="text-align:center;color:#94a3b8;padding:2rem;">Belum ada acara ditambahkan. Klik [+ Tambah Acara] di atas.</div>`;
    return;
  }

  container.innerHTML = editorData.events.map(ev => `
    <div class="event-item-card">
      <div class="event-item-header">
        <div class="event-item-title">${ev.event_name}</div>
        <button class="btn btn-danger btn-sm" onclick="deleteEvent(${ev.id})">Hapus</button>
      </div>
      <div class="event-item-meta">
        <div>📅 <strong>Tanggal:</strong> ${ev.event_date} (${ev.start_time} ${ev.end_time ? '- ' + ev.end_time : ''})</div>
        <div>📍 <strong>Lokasi:</strong> ${ev.venue_name}</div>
        ${ev.venue_address ? `<div>🏠 ${ev.venue_address}</div>` : ''}
        ${ev.maps_url ? `<a href="${ev.maps_url}" target="_blank" style="color:var(--color-primary);font-size:0.8rem;text-decoration:underline;">Buka Google Maps ↗</a>` : ''}
      </div>
    </div>
  `).join('');
}

async function deleteEvent(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus acara ini?')) return;
  try {
    const res = await fetch(`/manage/api/${managementToken}/events/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast('Acara dihapus!');
      loadEditorData();
    }
  } catch (err) {
    showToast('Gagal menghapus acara', 'error');
  }
}

function renderGuestsList() {
  const container = document.getElementById('guests-list-container');
  if (!container) return;

  if (editorData.guests.length === 0) {
    container.innerHTML = `<div style="text-align:center;color:#94a3b8;padding:2rem;">Belum ada daftar tamu. Tambahkan tamu untuk menghasilkan Guest Link otomatis.</div>`;
    return;
  }

  const origin = window.location.origin;
  const slug = editorData.invitation.slug;

  container.innerHTML = editorData.guests.map(g => {
    const guestUrl = `${origin}/u/${slug}/${g.guest_token}`;
    
    // Master prompt WhatsApp format with URL encoding
    const waText = `Halo ${g.name},\n\nKami mengundang Anda untuk hadir di acara kami.\n\nSilakan buka undangan berikut:\n${guestUrl}\n\nTerima kasih.`;
    const cleanPhone = (g.phone || '').replace(/[^0-9]/g, '');
    const waUrl = cleanPhone 
      ? `https://api.whatsapp.com/send?phone=${cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone}&text=${encodeURIComponent(waText)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(waText)}`;

    return `
      <div class="guest-card">
        <div class="guest-info-row">
          <div>
            <div class="guest-name">${g.name}</div>
            <div class="guest-phone">${g.phone ? '📱 ' + g.phone : 'Tanpa No HP'} • <span class="badge badge-info">${g.category}</span></div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="deleteGuest(${g.id})" title="Hapus Tamu">✕</button>
        </div>

        <div style="background:#0b111e;padding:0.5rem 0.75rem;border-radius:6px;font-size:0.75rem;font-family:monospace;color:#94a3b8;word-break:break-all;">
          ${guestUrl}
        </div>

        <div class="guest-actions-row">
          <button class="btn btn-outline btn-sm" onclick="copyText('${guestUrl}', 'Guest Link disalin!')">
            📋 Copy Link
          </button>
          <a href="${waUrl}" target="_blank" class="btn btn-wa btn-sm">
            💬 WhatsApp
          </a>
          <a href="${guestUrl}" target="_blank" class="btn btn-secondary btn-sm">
            👁️ Preview
          </a>
        </div>
      </div>
    `;
  }).join('');
}

async function deleteGuest(id) {
  if (!confirm('Hapus tamu ini dari daftar undangan?')) return;
  try {
    const res = await fetch(`/manage/api/${managementToken}/guests/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast('Data tamu berhasil dihapus.');
      loadEditorData();
    }
  } catch (err) {
    showToast('Gagal menghapus tamu', 'error');
  }
}

function renderRsvpList() {
  const container = document.getElementById('rsvp-list-container');
  if (!container) return;

  if (editorData.rsvps.length === 0) {
    container.innerHTML = `<div style="text-align:center;color:#94a3b8;padding:2rem;">Belum ada konfirmasi RSVP yang masuk dari tamu.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="table-responsive">
      <table class="table">
        <thead>
          <tr>
            <th>Nama Tamu</th>
            <th>Status</th>
            <th>Jumlah</th>
            <th>Ucapan / Pesan</th>
            <th>Waktu</th>
          </tr>
        </thead>
        <tbody>
          ${editorData.rsvps.map(r => `
            <tr>
              <td><strong>${r.guest_name}</strong></td>
              <td>
                <span class="badge ${r.attendance_status === 'Hadir' ? 'badge-success' : (r.attendance_status === 'Tidak Hadir' ? 'badge-danger' : 'badge-warning')}">
                  ${r.attendance_status}
                </span>
              </td>
              <td>${r.guest_count} Orang</td>
              <td style="max-width:260px;font-size:0.85rem;font-style:italic;">${r.message || '-'}</td>
              <td style="font-size:0.75rem;color:#94a3b8;">${r.created_at}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderWishesList() {
  const container = document.getElementById('wishes-list-container');
  if (!container) return;

  if (editorData.wishes.length === 0) {
    container.innerHTML = `<div style="text-align:center;color:#94a3b8;padding:2rem;">Belum ada ucapan dan doa dari tamu.</div>`;
    return;
  }

  container.innerHTML = editorData.wishes.map(w => `
    <div style="background:#131c2e;border:1px solid var(--bg-dark-border);border-radius:8px;padding:1rem;margin-bottom:0.75rem;">
      <div style="display:flex;justify-content:space-between;margin-bottom:0.4rem;">
        <strong style="color:#fff;">${w.guest_name}</strong>
        <span style="font-size:0.75rem;color:#94a3b8;">${w.created_at}</span>
      </div>
      <p style="font-size:0.9rem;color:#cbd5e1;line-height:1.5;">${w.message}</p>
    </div>
  `).join('');
}

// Share Modal in Header
function initShareModal() {
  const shareBtn = document.getElementById('header-share-btn');
  const modal = document.getElementById('modal-share-invitation');
  const closeBtn = document.getElementById('close-share-modal-btn');

  if (shareBtn && modal) {
    shareBtn.addEventListener('click', () => {
      const inv = editorData.invitation;
      const origin = window.location.origin;
      const generalUrl = `${origin}/preview/${inv.slug}`;

      const linkInput = document.getElementById('share-general-link-input');
      if (linkInput) linkInput.value = generalUrl;

      const waBtn = document.getElementById('share-general-wa-btn');
      if (waBtn) {
        const text = `Halo,\n\nKami mengundang Anda untuk hadir di acara kami:\n${inv.title}\n\nBuka undangan di tautan berikut:\n${generalUrl}\n\nTerima kasih.`;
        waBtn.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      }

      modal.classList.add('active');
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });
  }
}
