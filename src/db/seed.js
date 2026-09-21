const { hashPassword } = require('../utils/tokenGenerator');

function seedDatabase(db) {
  // Check if admin exists
  const checkAdmin = db.prepare('SELECT COUNT(*) as count FROM admins').get();
  if (checkAdmin.count === 0) {
    console.log('[SEED] Seeding Admin...');
    const insertAdmin = db.prepare(`
      INSERT INTO admins (admin_id, password_hash)
      VALUES (?, ?)
    `);
    insertAdmin.run('admin', hashPassword('admin123'));
  }

  // Check if categories exist
  const checkCat = db.prepare('SELECT COUNT(*) as count FROM theme_categories').get();
  if (checkCat.count === 0) {
    console.log('[SEED] Seeding Theme Categories...');
    const insertCat = db.prepare(`
      INSERT INTO theme_categories (slug, name, description, sort_order)
      VALUES (?, ?, ?, ?)
    `);
    insertCat.run('jawa', 'Jawa Tradisional', 'Desain bernuansa budaya Jawa adiluhung & keraton', 1);
    insertCat.run('islamic', 'Islami Elegan', 'Desain bernuansa islami mewah, suci, dan syar’i', 2);
    insertCat.run('modern', 'Modern Minimal', 'Desain bersih kontemporer dengan tipografi berkelas', 3);
    insertCat.run('floral', 'Floral & Botanical', 'Desain bertema bebungaan estetik dan romantis', 4);
  }

  // Check themes
  const checkThemes = db.prepare('SELECT COUNT(*) as count FROM themes').get();
  if (checkThemes.count === 0) {
    console.log('[SEED] Seeding Themes...');
    const catJawa = db.prepare("SELECT id FROM theme_categories WHERE slug = 'jawa'").get().id;
    const catIslamic = db.prepare("SELECT id FROM theme_categories WHERE slug = 'islamic'").get().id;
    const catModern = db.prepare("SELECT id FROM theme_categories WHERE slug = 'modern'").get().id;
    const catFloral = db.prepare("SELECT id FROM theme_categories WHERE slug = 'floral'").get().id;

    const insertTheme = db.prepare(`
      INSERT INTO themes (category_id, slug, name, description, preview_image, css_theme_file, theme_path)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertTheme.run(
      catJawa,
      'gebyok-joglo',
      'Jawa Gebyok Joglo',
      'Nuansa kayu jati ukiran Gebyok dengan Gunungan Wayang dan aksen tembaga emas',
      '/themes/jawa/gebyok-joglo/preview.svg',
      '/themes/jawa/gebyok-joglo/theme.css',
      '/themes/jawa/gebyok-joglo'
    );

    insertTheme.run(
      catJawa,
      'batik-kawung',
      'Jawa Batik Kawung',
      'Kain mori berpadu motif geometris Batik Kawung bernuansa soga cokelat klasik',
      '/themes/jawa/batik-kawung/preview.svg',
      '/themes/jawa/batik-kawung/theme.css',
      '/themes/jawa/batik-kawung'
    );

    insertTheme.run(
      catIslamic,
      'islamic-elegant',
      'Islamic Elegant',
      'Kubah Moorish, ornamen arabesque bintang delapan emas, dan hijau zamrud mewah',
      '/themes/islamic/elegant/preview.svg',
      '/themes/islamic/elegant/theme.css',
      '/themes/islamic/elegant'
    );

    insertTheme.run(
      catModern,
      'modern-minimal',
      'Modern Minimal',
      'Gaya kontemporer bersih, tipografi premium, alabaster ivory dan garis gold hairline',
      '/themes/modern/minimal/preview.svg',
      '/themes/modern/minimal/theme.css',
      '/themes/modern/minimal'
    );
  }

  // Check sample invitation
  const checkInv = db.prepare('SELECT COUNT(*) as count FROM invitations').get();
  if (checkInv.count === 0) {
    console.log('[SEED] Seeding Sample Invitation (Andi & Sinta)...');
    const admin = db.prepare("SELECT id FROM admins WHERE admin_id = 'admin'").get();
    const themeJawa = db.prepare("SELECT id FROM themes WHERE slug = 'gebyok-joglo'").get();

    const insertInv = db.prepare(`
      INSERT INTO invitations (
        admin_id, theme_id, slug, title,
        groom_name, groom_nickname, groom_parents,
        bride_name, bride_nickname, bride_parents,
        wedding_date, wedding_time, venue_name, venue_address, maps_url,
        opening_text, closing_text, is_active
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, 1
      )
    `);

    const invResult = insertInv.run(
      admin.id,
      themeJawa.id,
      'andi-sinta',
      'Pernikahan Andi & Sinta',
      'Andi Pratama, S.Kom',
      'Andi',
      'Putra tercinta dari Bpk. Bambang Supriyadi & Ibu Sri Wahyuni',
      'Sinta Nurhaliza, S.E',
      'Sinta',
      'Putri tercinta dari Bpk. Hartono Kusumo & Ibu Endang Rahayu',
      '2026-10-24',
      '08:00 WIB',
      'Sasana Kriya Grand Ballroom',
      'Jl. Pintu Utama TMII, Cipayung, Jakarta Timur',
      'https://maps.google.com/?q=Sasana+Kriya+TMII',
      'Maha Suci Allah yang telah menciptakan makhluk-Nya berpasang-pasangan. Dengan memohon rahmat dan ridho-Nya, kami bermaksud mengundang Anda untuk hadir pada hari istimewa kami.',
      'Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu kepada kami berdua.'
    );

    const invId = invResult.lastInsertRowid;

    // Management Access with master token AbC82xP92LmK7
    const insertMgmt = db.prepare(`
      INSERT INTO management_access (invitation_id, token, is_active)
      VALUES (?, ?, 1)
    `);
    insertMgmt.run(invId, 'AbC82xP92LmK7');

    // Events
    const insertEvent = db.prepare(`
      INSERT INTO invitation_events (
        invitation_id, event_name, event_date, start_time, end_time,
        venue_name, venue_address, maps_url, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertEvent.run(
      invId,
      'Akad Nikah',
      '2026-10-24',
      '08:00',
      '10:00 WIB',
      'Masjid Agung At-Tin',
      'Jl. Raya TMII, Jakarta Timur',
      'https://maps.google.com/?q=Masjid+Agung+At-Tin',
      1
    );

    insertEvent.run(
      invId,
      'Resepsi Pernikahan',
      '2026-10-24',
      '11:00',
      '14:00 WIB',
      'Sasana Kriya Grand Ballroom',
      'Jl. Pintu Utama TMII, Cipayung, Jakarta Timur',
      'https://maps.google.com/?q=Sasana+Kriya+TMII',
      2
    );

    // Guest: Budi Santoso with token X7mQa9
    const insertGuest = db.prepare(`
      INSERT INTO guests (invitation_id, name, phone, category)
      VALUES (?, ?, ?, ?)
    `);
    const guestResult = insertGuest.run(invId, 'Budi Santoso', '081234567890', 'Sahabat');
    const guestId = guestResult.lastInsertRowid;

    const insertGuestAccess = db.prepare(`
      INSERT INTO guest_access (guest_id, token, is_active)
      VALUES (?, ?, 1)
    `);
    insertGuestAccess.run(guestId, 'X7mQa9');

    // Guest 2: Siti Aisyah
    const guest2 = insertGuest.run(invId, 'Siti Aisyah & Keluarga', '089876543210', 'Keluarga');
    insertGuestAccess.run(guest2.lastInsertRowid, 'K9mYq2');

    // Initial RSVP & Wishes
    const insertRsvp = db.prepare(`
      INSERT INTO rsvps (invitation_id, guest_id, guest_name, attendance_status, guest_count, message)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertRsvp.run(invId, guestId, 'Budi Santoso', 'Hadir', 2, 'Selamat untuk Andi dan Sinta! Semoga selalu bahagia dan sakinah mawaddah warahmah.');

    const insertWish = db.prepare(`
      INSERT INTO wishes (invitation_id, guest_id, guest_name, message)
      VALUES (?, ?, ?, ?)
    `);
    insertWish.run(invId, guestId, 'Budi Santoso', 'Selamat berbahagia sahabatku Andi dan Sinta! Lancar sampai hari H.');
    insertWish.run(invId, null, 'Keluarga Besar Bpk. Supriyadi', 'Barakallahu lakuma wa baraka alaikuma wa jamaa bainakuma fii khoir. Aamiin.');

    console.log('[SEED] Initial data seeded successfully!');
  }
}

module.exports = { seedDatabase };
