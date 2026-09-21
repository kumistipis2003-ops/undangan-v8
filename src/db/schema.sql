-- Platform Undangan Digital MVP Database Schema (SQLite)

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS theme_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS themes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES theme_categories(id) ON DELETE RESTRICT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  preview_image TEXT,
  css_theme_file TEXT NOT NULL,
  theme_path TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  theme_id INTEGER NOT NULL REFERENCES themes(id) ON DELETE RESTRICT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  groom_name TEXT NOT NULL,
  groom_nickname TEXT,
  groom_parents TEXT,
  bride_name TEXT NOT NULL,
  bride_nickname TEXT,
  bride_parents TEXT,
  wedding_date TEXT NOT NULL,
  wedding_time TEXT,
  venue_name TEXT,
  venue_address TEXT,
  maps_url TEXT,
  opening_text TEXT,
  closing_text TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS management_access (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invitation_id INTEGER UNIQUE NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  is_active INTEGER DEFAULT 1,
  last_accessed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invitation_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invitation_id INTEGER NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  venue_name TEXT NOT NULL,
  venue_address TEXT,
  maps_url TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS guests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invitation_id INTEGER NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  category TEXT DEFAULT 'Keluarga',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS guest_access (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guest_id INTEGER UNIQUE NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  is_active INTEGER DEFAULT 1,
  view_count INTEGER DEFAULT 0,
  last_viewed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rsvps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invitation_id INTEGER NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  guest_id INTEGER REFERENCES guests(id) ON DELETE SET NULL,
  guest_name TEXT NOT NULL,
  attendance_status TEXT NOT NULL, -- 'Hadir', 'Tidak Hadir', 'Masih Ragu'
  guest_count INTEGER DEFAULT 1,
  message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wishes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invitation_id INTEGER NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  guest_id INTEGER REFERENCES guests(id) ON DELETE SET NULL,
  guest_name TEXT NOT NULL,
  message TEXT NOT NULL,
  is_hidden INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for lightning fast token lookups and query resolution
CREATE INDEX IF NOT EXISTS idx_invitations_slug ON invitations(slug);
CREATE INDEX IF NOT EXISTS idx_management_access_token ON management_access(token);
CREATE INDEX IF NOT EXISTS idx_guest_access_token ON guest_access(token);
CREATE INDEX IF NOT EXISTS idx_guests_invitation_id ON guests(invitation_id);
CREATE INDEX IF NOT EXISTS idx_invitation_events_invitation ON invitation_events(invitation_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_invitation ON rsvps(invitation_id);
CREATE INDEX IF NOT EXISTS idx_wishes_invitation ON wishes(invitation_id);
