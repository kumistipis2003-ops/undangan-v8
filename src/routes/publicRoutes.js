const express = require("express");
const router = express.Router();
const path = require("node:path");
const db = require("../db");
const { validateGuestAccess } = require("../middlewares/tokenMiddleware");

// 1. Personalized Guest Invitation View (with token or direct slug with ?to=...)
router.get("/u/:invitationSlug/:guestToken", validateGuestAccess, (req, res) => {
  res.sendFile(path.join(__dirname, "..", "..", "views", "guest", "invitation.html"));
});

router.get("/u/:invitationSlug", (req, res) => {
  const { invitationSlug } = req.params;
  const inv = db.prepare("SELECT id, is_active FROM invitations WHERE slug = ?").get(invitationSlug);
  if (!inv || inv.is_active !== 1) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Undangan Tidak Ditemukan</title>
        <link rel="stylesheet" href="/css/core.css">
      </head>
      <body style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:1rem;text-align:center;">
        <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:2rem;max-width:420px;width:100%;">
          <h2 style="color:#ef4444;margin-bottom:0.75rem;">Undangan Tidak Tersedia</h2>
          <p style="color:#94a3b8;margin-bottom:1.5rem;">Tautan undangan tamu tidak ditemukan atau telah dinonaktifkan.</p>
        </div>
      </body>
      </html>
    `);
  }
  res.sendFile(path.join(__dirname, "..", "..", "views", "guest", "invitation.html"));
});

// 2. Generic Preview Route (for tenant editor preview)
router.get("/preview/:invitationSlug", (req, res) => {
  const { invitationSlug } = req.params;
  const inv = db.prepare("SELECT id FROM invitations WHERE slug = ?").get(invitationSlug);
  if (!inv) {
    return res.status(404).send("Undangan tidak ditemukan.");
  }
  return res.redirect(`/u/${invitationSlug}?to=Tamu+Undangan`);
});

// 3. Public API to fetch Invitation Data for the Guest (supports :guestToken or direct slug with ?to=...)
router.get(["/api/public/invitation/:invitationSlug", "/api/public/invitation/:invitationSlug/:guestToken"], (req, res) => {
  const { invitationSlug, guestToken } = req.params;
  const guestNameFromQuery = req.query.to || req.query.nama || req.query.guest || req.query.n;

  let guestData = null;
  let invRow = null;

  if (guestToken) {
    const queryWithToken = `
      SELECT 
        g.id AS guest_id,
        g.name AS guest_name,
        g.phone AS guest_phone,
        g.category AS guest_category,
        ga.token AS guest_token,
        ga.is_active AS guest_is_active,
        i.*,
        t.slug AS theme_slug,
        t.name AS theme_name,
        t.css_theme_file,
        t.theme_path
      FROM guest_access ga
      JOIN guests g ON ga.guest_id = g.id
      JOIN invitations i ON g.invitation_id = i.id
      JOIN themes t ON i.theme_id = t.id
      WHERE i.slug = ? AND ga.token = ?
    `;
    const row = db.prepare(queryWithToken).get(invitationSlug, guestToken);
    if (row && row.guest_is_active === 1 && row.is_active === 1) {
      invRow = row;
      guestData = {
        id: row.guest_id,
        name: guestNameFromQuery || row.guest_name,
        category: row.guest_category,
        token: row.guest_token
      };
      try {
        db.prepare("UPDATE guest_access SET view_count = view_count + 1, last_viewed_at = CURRENT_TIMESTAMP WHERE token = ?").run(guestToken);
      } catch (e) {}
    }
  }

  // If not resolved via token, load by invitation slug directly
  if (!invRow) {
    const querySlug = `
      SELECT 
        i.*,
        t.slug AS theme_slug,
        t.name AS theme_name,
        t.css_theme_file,
        t.theme_path
      FROM invitations i
      JOIN themes t ON i.theme_id = t.id
      WHERE i.slug = ? AND i.is_active = 1
    `;
    invRow = db.prepare(querySlug).get(invitationSlug);
    if (!invRow) {
      return res.status(404).json({ success: false, message: "Undangan tidak ditemukan." });
    }
    guestData = {
      id: null,
      name: guestNameFromQuery || "Tamu Undangan",
      category: "Umum",
      token: ""
    };
  }

  const events = db.prepare(`
    SELECT event_name, event_date, start_time, end_time, venue_name, venue_address, maps_url
    FROM invitation_events
    WHERE invitation_id = ?
    ORDER BY sort_order, id
  `).all(invRow.id);

  const wishes = db.prepare(`
    SELECT guest_name, message, created_at
    FROM wishes
    WHERE invitation_id = ? AND is_hidden = 0
    ORDER BY created_at DESC
  `).all(invRow.id);

  res.json({
    success: true,
    data: {
      invitation: {
        id: invRow.id,
        slug: invRow.slug,
        title: invRow.title,
        groom_name: invRow.groom_name,
        groom_nickname: invRow.groom_nickname,
        groom_parents: invRow.groom_parents,
        bride_name: invRow.bride_name,
        bride_nickname: invRow.bride_nickname,
        bride_parents: invRow.bride_parents,
        wedding_date: invRow.wedding_date,
        wedding_time: invRow.wedding_time,
        venue_name: invRow.venue_name,
        venue_address: invRow.venue_address,
        maps_url: invRow.maps_url,
        opening_text: invRow.opening_text,
        closing_text: invRow.closing_text,
        theme_slug: invRow.theme_slug,
        theme_name: invRow.theme_name,
        css_theme_file: invRow.css_theme_file
      },
      guest: guestData,
      events,
      wishes
    }
  });
});

// 4. Submit RSVP & Wish API
router.post(["/api/public/rsvp/:invitationSlug", "/api/public/rsvp/:invitationSlug/:guestToken"], (req, res) => {
  const { invitationSlug, guestToken } = req.params;
  const { attendance_status, guest_count, message, guest_name } = req.body;

  const inv = db.prepare("SELECT id FROM invitations WHERE slug = ? AND is_active = 1").get(invitationSlug);
  if (!inv) {
    return res.status(404).json({ success: false, message: "Undangan tidak ditemukan." });
  }

  if (!attendance_status) {
    return res.status(400).json({ success: false, message: "Status kehadiran wajib dipilih." });
  }

  const validStatuses = ["Hadir", "Tidak Hadir", "Masih Ragu"];
  if (!validStatuses.includes(attendance_status)) {
    return res.status(400).json({ success: false, message: "Status kehadiran tidak valid." });
  }

  let guestId = null;
  let finalGuestName = guest_name || req.query.to || req.query.nama || "Tamu Undangan";

  if (guestToken) {
    const gRow = db.prepare(`
      SELECT g.id, g.name 
      FROM guest_access ga
      JOIN guests g ON ga.guest_id = g.id
      WHERE ga.token = ? AND g.invitation_id = ?
    `).get(guestToken, inv.id);

    if (gRow) {
      guestId = gRow.id;
      if (!guest_name) {
        finalGuestName = gRow.name;
      }
    }
  }

  // Create guest record if not exists
  if (!guestId) {
    try {
      const insGuest = db.prepare(`
        INSERT INTO guests (invitation_id, name, category)
        VALUES (?, ?, "WhatsApp")
      `).run(inv.id, finalGuestName);
      guestId = insGuest.lastInsertRowid;
    } catch (e) {
      guestId = null;
    }
  }

  const parsedCount = parseInt(guest_count, 10) || 1;

  // Insert RSVP
  const insertRsvp = db.prepare(`
    INSERT INTO rsvps (invitation_id, guest_id, guest_name, attendance_status, guest_count, message)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertRsvp.run(
    inv.id,
    guestId,
    finalGuestName,
    attendance_status,
    parsedCount,
    message || ""
  );

  // If wish message provided
  if (message && message.trim().length > 0) {
    const insertWish = db.prepare(`
      INSERT INTO wishes (invitation_id, guest_id, guest_name, message)
      VALUES (?, ?, ?, ?)
    `);
    insertWish.run(inv.id, guestId, finalGuestName, message.trim());
  }

  res.json({
    success: true,
    message: "Konfirmasi kehadiran dan ucapan Anda berhasil dikirimkan. Terima kasih!"
  });
});

module.exports = router;