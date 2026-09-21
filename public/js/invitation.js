// Public Guest Invitation Logic
document.addEventListener('DOMContentLoaded', () => {
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  // Expected formats: ['u', 'andi-sinta'] OR ['u', 'andi-sinta', 'guestToken']
  const invitationSlug = pathParts[1];
  const guestToken = pathParts[2] || '';

  if (!invitationSlug) return;

  // Read guest name from WhatsApp URL parameters (?to=... or ?nama=...)
  const urlParams = new URLSearchParams(window.location.search);
  const nameFromUrl = (urlParams.get('to') || urlParams.get('nama') || urlParams.get('guest') || urlParams.get('u') || '').trim();

  // Instant update of guest name on cover screen even before network requests finish
  if (nameFromUrl) {
    const guestNameEl = document.getElementById('personalized-guest-name');
    if (guestNameEl) {
      guestNameEl.innerText = nameFromUrl;
    }
  }

  loadPublicInvitation(invitationSlug, guestToken, nameFromUrl);
  initOpenInvitationButton();
  initRsvpForm(invitationSlug, guestToken, nameFromUrl);
});

let invitationData = null;

async function loadPublicInvitation(slug, token, nameFromUrl) {
  try {
    const query = nameFromUrl ? `?to=${encodeURIComponent(nameFromUrl)}` : '';
    const apiUrl = token
      ? `/api/public/invitation/${slug}/${token}${query}`
      : `/api/public/invitation/${slug}${query}`;

    const res = await fetch(apiUrl);
    const json = await res.json();

    if (!json.success) {
      document.body.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:1.5rem;text-align:center;">
          <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:2rem;max-width:400px;width:100%;">
            <h2 style="color:#ef4444;margin-bottom:0.75rem;">Undangan Tidak Tersedia</h2>
            <p style="color:#94a3b8;">Mohon periksa kembali tautan undangan yang Anda terima.</p>
          </div>
        </div>
      `;
      return;
    }

    invitationData = json.data;

    // Prioritize name directly passed from WhatsApp link
    if (nameFromUrl) {
      invitationData.guest.name = nameFromUrl;
    }

    renderInvitationContent(invitationData);

    // Auto-fill RSVP name input
    const rsvpNameInput = document.getElementById('rsvp-guest-name');
    if (rsvpNameInput && invitationData.guest && invitationData.guest.name && invitationData.guest.name !== 'Tamu Undangan') {
      rsvpNameInput.value = invitationData.guest.name;
    }
  } catch (err) {
    console.error('Error loading invitation:', err);
  }
}

function renderInvitationContent(data) {
  const inv = data.invitation;
  const guest = data.guest;

  // Set Theme CSS dynamically
  const themeLink = document.getElementById('theme-stylesheet');
  if (themeLink && inv.css_theme_file) {
    themeLink.href = inv.css_theme_file;
  }

  // Set Body Theme Class
  document.body.className = `theme-${inv.theme_slug} invitation-locked`;

  // Cover Screen Information
  document.getElementById('cover-couple-names').innerText = `${inv.groom_nickname || inv.groom_name} & ${inv.bride_nickname || inv.bride_name}`;
  document.getElementById('cover-wedding-date').innerText = formatDateIndo(inv.wedding_date);

  // Personalized Guest Greeting
  const guestNameEl = document.getElementById('personalized-guest-name');
  if (guestNameEl) guestNameEl.innerText = guest.name || 'Tamu Undangan';

  // Opening Section
  const openingTextEl = document.getElementById('opening-quote-text');
  if (openingTextEl) openingTextEl.innerText = inv.opening_text || 'Dengan memohon rahmat dan ridho Allah SWT, kami bermaksud menyelenggarakan syukuran pernikahan putra-putri kami:';

  // Couple Profile
  document.getElementById('groom-full-name').innerText = inv.groom_name;
  document.getElementById('groom-parents-info').innerText = inv.groom_parents || '';
  document.getElementById('bride-full-name').innerText = inv.bride_name;
  document.getElementById('bride-parents-info').innerText = inv.bride_parents || '';

  // Closing Text
  const closingEl = document.getElementById('closing-salutation-text');
  if (closingEl) closingEl.innerText = inv.closing_text || 'Atas kehadiran dan doa restu Bapak/Ibu/Saudara/i sekalian, kami mengucapkan terima kasih.';

  // Render Events
  renderEventCards(data.events);

  // Render Wishes
  renderWishesStream(data.wishes);

  // Initialize Real-time Countdown
  initCountdown(inv.wedding_date, inv.wedding_time);
}

function formatDateIndo(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

function renderEventCards(events) {
  const container = document.getElementById('events-container');
  if (!container) return;

  if (!events || events.length === 0) {
    container.innerHTML = '<p style="text-align:center;opacity:0.8;">Detail acara akan segera diumumkan.</p>';
    return;
  }

  container.innerHTML = events.map(ev => `
    <div class="card-box event-schedule-card">
      <div class="event-name-tag">${ev.event_name}</div>
      <div class="event-time-tag">
        <span>📅 ${formatDateIndo(ev.event_date)}</span>
      </div>
      <div class="event-time-tag" style="margin-bottom:1rem;">
        <span>⏰ Pukul ${ev.start_time} ${ev.end_time ? '- ' + ev.end_time : ''}</span>
      </div>
      <div class="event-venue-tag">📍 ${ev.venue_name}</div>
      ${ev.venue_address ? `<div class="event-address-tag">${ev.venue_address}</div>` : ''}
      ${ev.maps_url ? `
        <a href="${ev.maps_url}" target="_blank" class="btn-theme btn-sm" style="margin-top:0.75rem;display:inline-flex;">
          🗺️ Petunjuk Google Maps
        </a>
      ` : ''}
    </div>
  `).join('');
}

function renderWishesStream(wishes) {
  const container = document.getElementById('public-wishes-stream');
  if (!container) return;

  if (!wishes || wishes.length === 0) {
    container.innerHTML = '<div style="text-align:center;opacity:0.6;font-size:0.85rem;">Jadilah yang pertama mengirimkan ucapan & doa restu.</div>';
    return;
  }

  container.innerHTML = wishes.map(w => `
    <div class="wish-bubble">
      <div class="wish-header">
        <span class="wish-author">${w.guest_name}</span>
        <span class="wish-time">${formatDateIndo(w.created_at)}</span>
      </div>
      <div class="wish-message">${w.message}</div>
    </div>
  `).join('');
}

function initOpenInvitationButton() {
  const openBtn = document.getElementById('btn-open-invitation');
  const mainContent = document.getElementById('main-invitation-content');

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      document.body.classList.remove('invitation-locked');
      if (mainContent) {
        mainContent.classList.add('revealed');
      }
      const firstSection = document.getElementById('section-opening');
      if (firstSection) {
        firstSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }
}

function initCountdown(weddingDate, weddingTime) {
  if (!weddingDate) return;

  const targetDateStr = weddingTime ? `${weddingDate}T${weddingTime.slice(0, 5)}:00` : `${weddingDate}T09:00:00`;
  const target = new Date(targetDateStr).getTime();

  function update() {
    const now = new Date().getTime();
    const diff = target - now;

    if (diff <= 0) {
      document.getElementById('countdown-days').innerText = '00';
      document.getElementById('countdown-hours').innerText = '00';
      document.getElementById('countdown-minutes').innerText = '00';
      document.getElementById('countdown-seconds').innerText = '00';
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    document.getElementById('countdown-days').innerText = String(days).padStart(2, '0');
    document.getElementById('countdown-hours').innerText = String(hours).padStart(2, '0');
    document.getElementById('countdown-minutes').innerText = String(minutes).padStart(2, '0');
    document.getElementById('countdown-seconds').innerText = String(seconds).padStart(2, '0');
  }

  update();
  setInterval(update, 1000);
}

function initRsvpForm(slug, token, nameFromUrl) {
  const form = document.getElementById('guest-rsvp-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerText = 'Mengirimkan...';

    const selectedStatus = form.querySelector('input[name="attendance_status"]:checked');
    if (!selectedStatus) {
      alert('Silakan pilih status kehadiran Anda (Hadir / Tidak Hadir / Masih Ragu).');
      submitBtn.disabled = false;
      submitBtn.innerText = 'Kirim Konfirmasi & Ucapan';
      return;
    }

    const nameInput = document.getElementById('rsvp-guest-name');
    const guestName = (nameInput ? nameInput.value.trim() : '') || nameFromUrl || (invitationData && invitationData.guest ? invitationData.guest.name : '') || 'Tamu Undangan';

    const payload = {
      guest_name: guestName,
      attendance_status: selectedStatus.value,
      guest_count: document.getElementById('rsvp-guest-count').value || 1,
      message: document.getElementById('rsvp-message').value
    };

    try {
      const rsvpUrl = token ? `/api/public/rsvp/${slug}/${token}` : `/api/public/rsvp/${slug}`;
      const res = await fetch(rsvpUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (json.success) {
        document.getElementById('rsvp-form-container').innerHTML = `
          <div style="background:rgba(16,185,129,0.2);border:1px solid #10b981;padding:1.5rem;border-radius:8px;text-align:center;">
            <div style="font-size:2rem;margin-bottom:0.5rem;">🎉</div>
            <h3 style="color:#fff;margin-bottom:0.5rem;">Terima Kasih, ${guestName}!</h3>
            <p style="opacity:0.9;font-size:0.95rem;">${json.message}</p>
          </div>
        `;

        if (payload.message && payload.message.trim().length > 0) {
          const stream = document.getElementById('public-wishes-stream');
          const newBubble = document.createElement('div');
          newBubble.className = 'wish-bubble';
          newBubble.innerHTML = `
            <div class="wish-header">
              <span class="wish-author">${guestName}</span>
              <span class="wish-time">Baru saja</span>
            </div>
            <div class="wish-message">${payload.message}</div>
          `;
          stream.prepend(newBubble);
        }
      } else {
        alert(json.message || 'Gagal mengirim RSVP.');
        submitBtn.disabled = false;
        submitBtn.innerText = 'Kirim Konfirmasi & Ucapan';
      }
    } catch (err) {
      alert('Terjadi kendala saat mengirim data. Silakan coba kembali.');
      submitBtn.disabled = false;
      submitBtn.innerText = 'Kirim Konfirmasi & Ucapan';
    }
  });
}