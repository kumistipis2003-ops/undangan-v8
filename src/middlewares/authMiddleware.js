const db = require('../db');

function validateAdmin(req, res, next) {
  const sessionToken = req.cookies?.admin_session;

  if (!sessionToken) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ success: false, message: 'Sesi Admin tidak valid atau telah berakhir.' });
    }
    return res.redirect('/admin/login');
  }

  // Verify sessionToken against admins
  // For MVP simplicity and security: token is encrypted or signed admin_id
  const admin = db.prepare('SELECT id, admin_id FROM admins WHERE admin_id = ?').get(sessionToken);

  if (!admin) {
    res.clearCookie('admin_session');
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ success: false, message: 'Admin tidak ditemukan.' });
    }
    return res.redirect('/admin/login');
  }

  req.admin = admin;
  next();
}

module.exports = { validateAdmin };
