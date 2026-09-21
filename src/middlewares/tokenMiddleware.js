const db = require('../db');

function validateManagementToken(req, res, next) {
  const token = req.params.managementToken;

  if (!token) {
    return res.status(400).send('Management token tidak ditemukan.');
  }

  // Join management_access, invitations, and themes
  const query = `
    SELECT 
      m.id AS management_id,
      m.token AS management_token,
      m.is_active AS management_is_active,
      i.*,
      t.slug AS theme_slug,
      t.name AS theme_name,
      t.css_theme_file,
      t.theme_path
    FROM management_access m
    JOIN invitations i ON m.invitation_id = i.id
    JOIN themes t ON i.theme_id = t.id
    WHERE m.token = ?
  `;

  const row = db.prepare(query).get(token);

  if (!row) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tautan Tidak Ditemukan</title>
        <link rel="stylesheet" href="/css/core.css">
      </head>
      <body style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:1rem;text-align:center;">
        <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:2rem;max-width:420px;width:100%;">
          <h2 style="color:#ef4444;margin-bottom:0.75rem;">Akses Tidak Ditemukan</h2>
          <p style="color:#94a3b8;margin-bottom:1.5rem;">Management Link yang Anda tuju tidak valid atau tidak terdaftar pada sistem.</p>
        </div>
      </body>
      </html>
    `);
  }

  if (row.management_is_active !== 1 || row.is_active !== 1) {
    return res.status(403).send(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Akses Dinonaktifkan</title>
        <link rel="stylesheet" href="/css/core.css">
      </head>
      <body style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:1rem;text-align:center;">
        <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:2rem;max-width:420px;width:100%;">
          <h2 style="color:#f59e0b;margin-bottom:0.75rem;">Akses Dinonaktifkan</h2>
          <p style="color:#94a3b8;margin-bottom:1.5rem;">Akses manajemen untuk undangan ini saat ini telah dinonaktifkan oleh administrator.</p>
        </div>
      </body>
      </html>
    `);
  }

  // Update last_accessed_at timestamp
  db.prepare("UPDATE management_access SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = ?").run(row.management_id);

  req.invitation = row;
  next();
}

function validateGuestAccess(req, res, next) {
  const { invitationSlug, guestToken } = req.params;

  const query = `
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

  const row = db.prepare(query).get(invitationSlug, guestToken);

  if (!row || row.guest_is_active !== 1 || row.is_active !== 1) {
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

  // Increment view count
  db.prepare("UPDATE guest_access SET view_count = view_count + 1, last_viewed_at = CURRENT_TIMESTAMP WHERE token = ?").run(guestToken);

  req.guest = row;
  next();
}

module.exports = {
  validateManagementToken,
  validateGuestAccess
};
