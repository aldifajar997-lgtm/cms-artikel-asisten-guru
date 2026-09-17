-- Migration: Isi default site settings untuk CMS Asisten Guru
-- Jalankan via: wrangler d1 execute asisten-guru-cms --file=migration_site_settings.sql --remote
-- Atau via Cloudflare Dashboard > D1 > Execute SQL

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('site_title',       'Asisten Guru'),
  ('site_description', 'Platform belajar dan mengajar untuk guru dan siswa Indonesia'),
  ('logo_url',         'https://asisten-guru.id/web-app-manifest-512x512.png'),
  ('contact_email',    ''),
  ('theme_color',      '#0D5B52');

-- Verifikasi setelah insert:
-- SELECT key, value FROM settings;
