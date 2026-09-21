const express = require('express');
const router = express.Router();
const path = require('node:path');
const db = require('../db');
const { validateGuestAccess } = require('../middlewares/tokenMiddleware');

// 1. Personalized Guest Invitation View
router.get('/u/:invitationSlug/:guestToken', validateGuestAccess, (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'views', 'guest', 'invitation.html'));
});

// 2. Generic Preview Route (for tenant editor preview)
router.get('/preview/:invitationSlug', (req, res) => {
  const { invitationSlug } = req.params;
  const inv = db.prepare('SELECT id FROM invitations WHERE slug = ?').get(invitationSlug);
  if (!inv) {
    return res.status(404).send('Undangan tidak ditemukan.');
  }
  // Find sample or first guest, or fallback
  const firstGuest = db.prepare(`
    SELECT ga.token 
    FROM guest_access ga
    JOIN guests g ON ga.guest_id = g.id
    WHERE g.invitation_id = ?
    LIMIT 1
  `).get(inv.id);

  if (firstGuest) {
    return res.redirect(`/u/${invitationSlug}/${firstGuest.token}`);
  }

  // If no guest exists yet, create temporary demo guest
  const guestRes = db.prepare(`
    INSERT INTO guests (invitation_id, name, category)
    VALUES (?, 'Tamu Undangan (Preview)', 'Demo')
  `).run(inv.id);

  const demoToken = 'preview';
  db.prepare(`
    INSERT INTO guest_access (guest_id, token, is_active)
    VALUES (?, ?, 1)
  `).run(guestRes.lastInsertRowid, demoToken);

  return res.redirect(`/u/${invitationSlug}/${demoToken}`);
});

// 3. Public API to fetch Invitation Data for the Guest
router.get('/api/public/invitation/:invitationSlug/:guestToken', validateGuestAccess, (req, res) => {
  const g = req.guest;

  const events = db.prepare(`
    SELECT event_name, event_date, start_time, end_time, venue_name, venue_address, maps_url
    FROM invitation_events
    WHERE invitation_id = ?
    ORDER BY sort_order, id
  `).all(g.id);

  const wishes = db.prepare(`
    SELECT guest_name, message, created_at
    FROM wishes
    WHERE invitation_id = ? AND is_hidden = 0
    ORDER BY created_at DESC
  `).all(g.id);

  res.json({
    success: true,
    data: {
      invitation: {
        id: g.id,
        slug: g.slug,
        title: g.title,
        groom_name: g.groom_name,
        groom_nickname: g.groom_nickname,
        groom_parents: g.groom_parents,
        bride_name: g.bride_name,
        bride_nickname: g.bride_nickname,
        bride_parents: g.bride_parents,
        wedding_date: g.wedding_date,
        wedding_time: g.wedding_time,
        venue_name: g.venue_name,
        venue_address: g.venue_address,
        maps_url: g.maps_url,
        opening_text: g.opening_text,
        closing_text: g.closing_text,
        theme_slug: g.theme_slug,
        theme_name: g.theme_name,
        css_theme_file: g.css_theme_file
      },
      guest: {
        id: g.guest_id,
        name: g.guest_name,
        category: g.guest_category,
        token: g.guest_token
      },
      events,
      wishes
    }
  });
});

// 4. Submit RSVP & Wish API
router.post('/api/public/rsvp/:invitationSlug/:guestToken', validateGuestAccess, (req, res) => {
  const g = req.guest;
  const { attendance_status, guest_count, message } = req.body;

  if (!attendance_status) {
    return res.status(400).json({ success: false, message: 'Status kehadiran wajib dipilih.' });
  }

  const validStatuses = ['Hadir', 'Tidak Hadir', 'Masih Ragu'];
  if (!validStatuses.includes(attendance_status)) {
    return res.status(400).json({ success: false, message: 'Status kehadiran tidak valid.' });
  }

  const parsedCount = parseInt(guest_count, 10) || 1;

  // Insert RSVP
  const insertRsvp = db.prepare(`
    INSERT INTO rsvps (invitation_id, guest_id, guest_name, attendance_status, guest_count, message)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertRsvp.run(
    g.id,
    g.guest_id,
    g.guest_name,
    attendance_status,
    parsedCount,
    message || ''
  );

  // If there's a wish message, also save to wishes table
  if (message && message.trim().length > 0) {
    const insertWish = db.prepare(`
      INSERT INTO wishes (invitation_id, guest_id, guest_name, message)
      VALUES (?, ?, ?, ?)
    `);
    insertWish.run(g.id, g.guest_id, g.guest_name, message.trim());
  }

  res.json({
    success: true,
    message: 'Konfirmasi kehadiran dan ucapan Anda berhasil dikirimkan. Terima kasih!'
  });
});

module.exports = router;
