const express = require('express');
const router = express.Router();
const path = require('node:path');
const db = require('../db');
const { validateManagementToken } = require('../middlewares/tokenMiddleware');
const { generateGuestToken } = require('../utils/tokenGenerator');

// Serve Single Page Mobile-First Editor View
router.get('/:managementToken', validateManagementToken, (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'views', 'manage', 'editor.html'));
});

// APIs for Editor
router.get('/api/:managementToken/details', validateManagementToken, (req, res) => {
  const inv = req.invitation;

  // Fetch events
  const events = db.prepare(`
    SELECT * FROM invitation_events
    WHERE invitation_id = ?
    ORDER BY sort_order, id
  `).all(inv.id);

  // Fetch guests with their access token
  const guests = db.prepare(`
    SELECT 
      g.id,
      g.name,
      g.phone,
      g.category,
      g.created_at,
      ga.token AS guest_token,
      ga.view_count,
      ga.last_viewed_at
    FROM guests g
    LEFT JOIN guest_access ga ON g.id = ga.guest_id
    WHERE g.invitation_id = ?
    ORDER BY g.created_at DESC
  `).all(inv.id);

  // Fetch RSVPs
  const rsvps = db.prepare(`
    SELECT * FROM rsvps
    WHERE invitation_id = ?
    ORDER BY created_at DESC
  `).all(inv.id);

  // Fetch Wishes
  const wishes = db.prepare(`
    SELECT * FROM wishes
    WHERE invitation_id = ?
    ORDER BY created_at DESC
  `).all(inv.id);

  res.json({
    success: true,
    data: {
      invitation: inv,
      events,
      guests,
      rsvps,
      wishes
    }
  });
});

// Update Invitation Details
router.put('/api/:managementToken/data', validateManagementToken, (req, res) => {
  const inv = req.invitation;
  const {
    groom_name, groom_nickname, groom_parents,
    bride_name, bride_nickname, bride_parents,
    wedding_date, wedding_time,
    venue_name, venue_address, maps_url,
    opening_text, closing_text
  } = req.body;

  const updateStmt = db.prepare(`
    UPDATE invitations SET
      groom_name = COALESCE(?, groom_name),
      groom_nickname = COALESCE(?, groom_nickname),
      groom_parents = COALESCE(?, groom_parents),
      bride_name = COALESCE(?, bride_name),
      bride_nickname = COALESCE(?, bride_nickname),
      bride_parents = COALESCE(?, bride_parents),
      wedding_date = COALESCE(?, wedding_date),
      wedding_time = COALESCE(?, wedding_time),
      venue_name = COALESCE(?, venue_name),
      venue_address = COALESCE(?, venue_address),
      maps_url = COALESCE(?, maps_url),
      opening_text = COALESCE(?, opening_text),
      closing_text = COALESCE(?, closing_text),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  updateStmt.run(
    groom_name, groom_nickname, groom_parents,
    bride_name, bride_nickname, bride_parents,
    wedding_date, wedding_time,
    venue_name, venue_address, maps_url,
    opening_text, closing_text,
    inv.id
  );

  res.json({ success: true, message: 'Data undangan berhasil diperbarui.' });
});

// Update Theme
router.put('/api/:managementToken/theme', validateManagementToken, (req, res) => {
  const inv = req.invitation;
  const { theme_id } = req.body;

  if (!theme_id) {
    return res.status(400).json({ success: false, message: 'ID Tema wajib disertakan.' });
  }

  const theme = db.prepare('SELECT id FROM themes WHERE id = ?').get(theme_id);
  if (!theme) {
    return res.status(404).json({ success: false, message: 'Tema tidak ditemukan.' });
  }

  db.prepare('UPDATE invitations SET theme_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(theme_id, inv.id);

  res.json({ success: true, message: 'Desain tema berhasil diganti.' });
});

// Add Event
router.post('/api/:managementToken/events', validateManagementToken, (req, res) => {
  const inv = req.invitation;
  const { event_name, event_date, start_time, end_time, venue_name, venue_address, maps_url } = req.body;

  if (!event_name || !event_date || !start_time || !venue_name) {
    return res.status(400).json({ success: false, message: 'Nama acara, tanggal, jam, dan lokasi wajib diisi.' });
  }

  const insertEvent = db.prepare(`
    INSERT INTO invitation_events (
      invitation_id, event_name, event_date, start_time, end_time,
      venue_name, venue_address, maps_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = insertEvent.run(
    inv.id,
    event_name,
    event_date,
    start_time,
    end_time || '',
    venue_name,
    venue_address || '',
    maps_url || ''
  );

  res.json({
    success: true,
    message: 'Acara berhasil ditambahkan.',
    eventId: result.lastInsertRowid
  });
});

// Delete Event
router.delete('/api/:managementToken/events/:eventId', validateManagementToken, (req, res) => {
  const inv = req.invitation;
  const { eventId } = req.params;

  db.prepare('DELETE FROM invitation_events WHERE id = ? AND invitation_id = ?').run(eventId, inv.id);
  res.json({ success: true, message: 'Acara berhasil dihapus.' });
});

// Add Guest & Generate Guest Token
router.post('/api/:managementToken/guests', validateManagementToken, (req, res) => {
  const inv = req.invitation;
  const { name, phone, category } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Nama tamu wajib diisi.' });
  }

  // Insert Guest
  const insertGuest = db.prepare(`
    INSERT INTO guests (invitation_id, name, phone, category)
    VALUES (?, ?, ?, ?)
  `);

  const guestRes = insertGuest.run(inv.id, name, phone || '', category || 'Keluarga');
  const guestId = guestRes.lastInsertRowid;

  // Generate unique Guest Token
  let guestToken = generateGuestToken();
  while (db.prepare('SELECT id FROM guest_access WHERE token = ?').get(guestToken)) {
    guestToken = generateGuestToken();
  }

  db.prepare(`
    INSERT INTO guest_access (guest_id, token, is_active)
    VALUES (?, ?, 1)
  `).run(guestId, guestToken);

  res.json({
    success: true,
    message: 'Tamu berhasil ditambahkan.',
    data: {
      id: guestId,
      name,
      phone,
      category: category || 'Keluarga',
      guest_token: guestToken,
      guest_url: `/u/${inv.slug}/${guestToken}`
    }
  });
});

// Delete Guest
router.delete('/api/:managementToken/guests/:guestId', validateManagementToken, (req, res) => {
  const inv = req.invitation;
  const { guestId } = req.params;

  db.prepare('DELETE FROM guests WHERE id = ? AND invitation_id = ?').run(guestId, inv.id);
  res.json({ success: true, message: 'Data tamu berhasil dihapus.' });
});

module.exports = router;
