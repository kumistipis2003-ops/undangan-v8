// Verification test script for MVP APIs
async function runTests() {
  const baseUrl = 'http://localhost:3000';
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  console.log('=== MEMULAI VERIFIKASI API ENDPOINT TAHAP 1 (MVP) ===');

  // 1. Check Admin Login Page
  await test('1. GET /admin/login returns 200 HTML', async () => {
    const res = await fetch(`${baseUrl}/admin/login`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const html = await res.text();
    if (!html.includes('Login Administrator')) throw new Error('HTML content mismatch');
  });

  // 2. Admin Login API
  let adminCookie = '';
  await test('2. POST /admin/api/login authenticates admin and sets cookie', async () => {
    const res = await fetch(`${baseUrl}/admin/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: 'admin', password: 'admin123' })
    });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    const setCookie = res.headers.get('set-cookie');
    if (!setCookie) throw new Error('No cookie received');
    adminCookie = setCookie.split(';')[0];
  });

  // 3. Admin Stats API
  await test('3. GET /admin/api/stats returns stats data', async () => {
    const res = await fetch(`${baseUrl}/admin/api/stats`, {
      headers: { 'Cookie': adminCookie }
    });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (!json.success || typeof json.data.totalInvitations !== 'number') throw new Error('Invalid stats payload');
  });

  // 4. Admin Create Invitation API
  let createdManagementToken = '';
  let createdSlug = '';
  await test('4. POST /admin/api/invitations generates invitation & management link', async () => {
    const res = await fetch(`${baseUrl}/admin/api/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookie
      },
      body: JSON.stringify({
        title: 'Pernikahan Dimas & Anisa',
        groom_name: 'Dimas Anggara',
        bride_name: 'Anisa Rahma',
        wedding_date: '2026-12-12',
        theme_id: 1,
        status: 1
      })
    });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (!json.success || !json.data.managementToken) throw new Error('Token not created');
    createdManagementToken = json.data.managementToken;
    createdSlug = json.data.slug;
    console.log(`   -> Created Invitation Slug: ${createdSlug}, Management Token: ${createdManagementToken}`);
  });

  // 5. Tenant Access via Management Token (Zero Login)
  await test('5. GET /manage/:token directly enters editor without login', async () => {
    const res = await fetch(`${baseUrl}/manage/${createdManagementToken}`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const html = await res.text();
    if (!html.includes('Editor Undangan — Panel Penyewa')) throw new Error('Editor view not rendered');
  });

  // 6. Tenant Details API
  await test('6. GET /manage/api/:token/details returns complete tenant data', async () => {
    const res = await fetch(`${baseUrl}/manage/api/${createdManagementToken}/details`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (!json.success || json.data.invitation.groom_name !== 'Dimas Anggara') {
      throw new Error('Details payload invalid');
    }
  });

  // 7. Tenant Add Event API
  await test('7. POST /manage/api/:token/events adds new event', async () => {
    const res = await fetch(`${baseUrl}/manage/api/${createdManagementToken}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: 'Resepsi Pernikahan',
        event_date: '2026-12-12',
        start_time: '19:00 WIB',
        end_time: '21:00 WIB',
        venue_name: 'Balai Samudera',
        venue_address: 'Kelapa Gading, Jakarta Utara'
      })
    });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
  });

  // 8. Tenant Add Guest API -> Generates unique Guest Token
  let createdGuestToken = '';
  await test('8. POST /manage/api/:token/guests adds guest and generates Guest Token', async () => {
    const res = await fetch(`${baseUrl}/manage/api/${createdManagementToken}/guests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'dr. Hendra Setiawan & Keluarga',
        phone: '081299887766',
        category: 'VIP'
      })
    });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (!json.success || !json.data.guest_token) throw new Error('Guest token not created');
    createdGuestToken = json.data.guest_token;
    console.log(`   -> Created Guest Token: ${createdGuestToken}`);
  });

  // 9. Guest Opens Invitation (Zero Login, Personalized)
  await test('9. GET /u/:slug/:token renders personalized guest invitation page', async () => {
    const res = await fetch(`${baseUrl}/u/${createdSlug}/${createdGuestToken}`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const html = await res.text();
    if (!html.includes('BUKA UNDANGAN')) throw new Error('Cover button not found');
  });

  // 10. Public Invitation API gives personalized guest name
  await test('10. GET /api/public/invitation/:slug/:token gives personalized guest name', async () => {
    const res = await fetch(`${baseUrl}/api/public/invitation/${createdSlug}/${createdGuestToken}`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (!json.success || json.data.guest.name !== 'dr. Hendra Setiawan & Keluarga') {
      throw new Error(`Guest name mismatch: ${json.data?.guest?.name}`);
    }
  });

  // 11. Guest Submits RSVP & Wish
  await test('11. POST /api/public/rsvp/:slug/:token saves RSVP and Wish', async () => {
    const res = await fetch(`${baseUrl}/api/public/rsvp/${createdSlug}/${createdGuestToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attendance_status: 'Hadir',
        guest_count: 2,
        message: 'Selamat untuk Dimas dan Anisa! Semoga menjadi keluarga yang sakinah mawaddah warahmah.'
      })
    });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
  });

  // 12. Tenant Verifies RSVP Received
  await test('12. Tenant sees the submitted RSVP in editor details', async () => {
    const res = await fetch(`${baseUrl}/manage/api/${createdManagementToken}/details`);
    const json = await res.json();
    const foundRsvp = json.data.rsvps.find(r => r.guest_name === 'dr. Hendra Setiawan & Keluarga');
    if (!foundRsvp || foundRsvp.attendance_status !== 'Hadir') throw new Error('RSVP not found in tenant data');
    const foundWish = json.data.wishes.find(w => w.guest_name === 'dr. Hendra Setiawan & Keluarga');
    if (!foundWish) throw new Error('Wish not found in tenant data');
  });

  // 13. Tenant Switches Theme without losing data
  await test('13. Tenant changes theme to Islamic Elegant without losing data', async () => {
    const res = await fetch(`${baseUrl}/manage/api/${createdManagementToken}/theme`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme_id: 3 }) // Islamic Elegant
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    // Verify theme changed and data intact
    const verifyRes = await fetch(`${baseUrl}/manage/api/${createdManagementToken}/details`);
    const verifyJson = await verifyRes.json();
    if (verifyJson.data.invitation.theme_slug !== 'islamic-elegant') throw new Error('Theme not changed');
    if (verifyJson.data.invitation.groom_name !== 'Dimas Anggara') throw new Error('Groom name was lost');
  });

  // 14. Access Control Security Check: Invalid Management Token
  await test('14. Invalid management token is rejected with 404', async () => {
    const res = await fetch(`${baseUrl}/manage/fakeToken123xyz`);
    if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
  });

  // 15. Access Control Security Check: Invalid Guest Token
  await test('15. Invalid guest token is rejected with 404', async () => {
    const res = await fetch(`${baseUrl}/u/${createdSlug}/fakeGuestToken`);
    if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
  });

  console.log(`\n=== HASIL: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) process.exit(1);
}

runTests();
