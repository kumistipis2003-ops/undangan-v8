const express = require('express');
const router = express.Router();
const path = require('node:path');
const db = require('../db');
const { verifyPassword, generateManagementToken } = require('../utils/tokenGenerator');
const { slugify } = require('../utils/slugHelper');
const { validateAdmin } = require('../middlewares/authMiddleware');

// 1. Admin Login View
router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'views', 'admin', 'login.html'));
});

// 2. Admin Login API
router.post('/api/login', (req, res) => {
  const { adminId, password } = req.body;

  if (!adminId || !password) {
    return res.status(400).json({ success: false, message: 'Admin ID dan Password wajib diisi.' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE admin_id = ?').get(adminId);
  if (!admin || !verifyPassword(password, admin.password_hash)) {
    return res.status(401).json({ success: false, message: 'Admin ID atau Password tidak cocok.' });
  }

  // Set HTTP-only session cookie
  res.cookie('admin_session', admin.admin_id, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  return res.json({ success: true, message: 'Login berhasil.', redirect: '/admin/dashboard' });
});

// 3. Admin Logout API
router.post('/api/logout', (req, res) => {
  res.clearCookie('admin_session');
  return res.json({ success: true, redirect: '/admin/login' });
});

// Protected Admin Web Views
router.get('/dashboard', validateAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'views', 'admin', 'dashboard.html'));
});

router.get('/invitations/create', validateAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'views', 'admin', 'create-invitation.html'));
});

router.get('/themes', validateAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'views', 'admin', 'themes.html'));
});

// Protected Admin APIs
router.get('/api/stats', validateAdmin, (req, res) => {
  const totalInvitations = db.prepare('SELECT COUNT(*) as count FROM invitations').get().count;
  const activeInvitations = db.prepare('SELECT COUNT(*) as count FROM invitations WHERE is_active = 1').get().count;
  const totalGuests = db.prepare('SELECT COUNT(*) as count FROM guests').get().count;
  const totalRsvps = db.prepare('SELECT COUNT(*) as count FROM rsvps').get().count;

  res.json({
    success: true,
    data: {
      totalInvitations,
      activeInvitations,
      totalGuests,
      totalRsvps
    }
  });
});

router.get('/api/invitations', validateAdmin, (req, res) => {
  const query = `
    SELECT 
      i.id,
      i.title,
      i.slug,
      i.groom_name,
      i.bride_name,
      i.wedding_date,
      i.is_active,
      i.created_at,
      m.token AS management_token,
      m.is_active AS management_is_active,
      t.name AS theme_name,
      t.slug AS theme_slug,
      tc.name AS category_name,
      (SELECT COUNT(*) FROM guests WHERE invitation_id = i.id) AS guest_count,
      (SELECT COUNT(*) FROM rsvps WHERE invitation_id = i.id) AS rsvp_count
    FROM invitations i
    LEFT JOIN management_access m ON i.id = m.invitation_id
    LEFT JOIN themes t ON i.theme_id = t.id
    LEFT JOIN theme_categories tc ON t.category_id = tc.id
    ORDER BY i.created_at DESC
  `;

  const rows = db.prepare(query).all();
  res.json({ success: true, data: rows });
});

router.post('/api/invitations', validateAdmin, (req, res) => {
  const { title, groom_name, bride_name, wedding_date, theme_id, status } = req.body;

  if (!groom_name || !bride_name || !wedding_date || !theme_id) {
    return res.status(400).json({ success: false, message: 'Semua field wajib diisi lengkap.' });
  }

  // Generate unique slug
  let baseSlug = slugify(title || `${groom_name}-${bride_name}`);
  if (!baseSlug) baseSlug = 'undangan';
  let slug = baseSlug;
  let counter = 1;

  while (db.prepare('SELECT id FROM invitations WHERE slug = ?').get(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  const isActive = status === '0' ? 0 : 1;
  const invTitle = title || `Pernikahan ${groom_name} & ${bride_name}`;

  // Insert Invitation
  const insertInv = db.prepare(`
    INSERT INTO invitations (
      admin_id, theme_id, slug, title, groom_name, bride_name, wedding_date, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const invRes = insertInv.run(
    req.admin.id,
    parseInt(theme_id, 10),
    slug,
    invTitle,
    groom_name,
    bride_name,
    wedding_date,
    isActive
  );

  const invitationId = invRes.lastInsertRowid;

  // Generate cryptographically random Management Token
  const managementToken = generateManagementToken();

  const insertMgmt = db.prepare(`
    INSERT INTO management_access (invitation_id, token, is_active)
    VALUES (?, ?, ?)
  `);

  insertMgmt.run(invitationId, managementToken, 1);

  // Add default event placeholder
  db.prepare(`
    INSERT INTO invitation_events (invitation_id, event_name, event_date, start_time, venue_name, sort_order)
    VALUES (?, 'Akad Nikah', ?, '08:00 WIB', 'Kediaman Mempelai / Tempat Ibadah', 1)
  `).run(invitationId, wedding_date);

  return res.json({
    success: true,
    message: 'Undangan dan Management Link berhasil dibuat!',
    data: {
      invitationId,
      slug,
      managementToken,
      managementUrl: `/manage/${managementToken}`
    }
  });
});

router.patch('/api/invitations/:id/toggle', validateAdmin, (req, res) => {
  const { id } = req.params;
  const inv = db.prepare('SELECT is_active FROM invitations WHERE id = ?').get(id);
  if (!inv) return res.status(404).json({ success: false, message: 'Undangan tidak ditemukan.' });

  const newStatus = inv.is_active === 1 ? 0 : 1;
  db.prepare('UPDATE invitations SET is_active = ? WHERE id = ?').run(newStatus, id);

  res.json({ success: true, is_active: newStatus });
});

router.patch('/api/invitations/:id/toggle-management', validateAdmin, (req, res) => {
  const { id } = req.params;
  const mgmt = db.prepare('SELECT is_active FROM management_access WHERE invitation_id = ?').get(id);
  if (!mgmt) return res.status(404).json({ success: false, message: 'Akses manajemen tidak ditemukan.' });

  const newStatus = mgmt.is_active === 1 ? 0 : 1;
  db.prepare('UPDATE management_access SET is_active = ? WHERE invitation_id = ?').run(newStatus, id);

  res.json({ success: true, management_is_active: newStatus });
});

router.get('/api/themes', (req, res) => {
  const query = `
    SELECT 
      t.*,
      tc.name AS category_name,
      tc.slug AS category_slug
    FROM themes t
    JOIN theme_categories tc ON t.category_id = tc.id
    WHERE t.is_active = 1
    ORDER BY tc.sort_order, t.id
  `;
  const rows = db.prepare(query).all();
  res.json({ success: true, data: rows });
});

module.exports = router;
