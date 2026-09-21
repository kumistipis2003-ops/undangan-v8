const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('node:path');

// Initialize database
require('./db');

const adminRoutes = require('./routes/adminRoutes');
const manageRoutes = require('./routes/manageRoutes');
const publicRoutes = require('./routes/publicRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static Files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Mount Routes
app.use('/admin', adminRoutes);
app.use('/manage', manageRoutes);
app.use('/', publicRoutes);

// Root route redirect to admin login
app.get('/', (req, res) => {
  res.redirect('/admin/login');
});

// 404 Handler
app.use((req, res) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>404 — Halaman Tidak Ditemukan</title>
      <link rel="stylesheet" href="/css/core.css">
    </head>
    <body style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:1rem;text-align:center;">
      <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:2.5rem;max-width:440px;width:100%;">
        <h1 style="color:#ef4444;font-size:3rem;margin-bottom:0.5rem;">404</h1>
        <h2 style="color:#fff;font-size:1.3rem;margin-bottom:0.5rem;">Halaman Tidak Ditemukan</h2>
        <p style="color:#94a3b8;margin-bottom:1.5rem;font-size:0.95rem;">Halaman yang Anda cari tidak tersedia atau URL yang dimasukkan salah.</p>
        <a href="/admin/login" class="btn btn-primary">Kembali ke Beranda</a>
      </div>
    </body>
    </html>
  `);
});

// Start Server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[SERVER] Platform Undangan Digital running on http://localhost:${PORT}`);
    console.log(`[ACCESS] Admin Login: http://localhost:${PORT}/admin/login`);
    console.log(`[ACCESS] Sample Tenant: http://localhost:${PORT}/manage/AbC82xP92LmK7`);
    console.log(`[ACCESS] Sample Guest: http://localhost:${PORT}/u/andi-sinta/X7mQa9`);
  });
}

module.exports = app;
