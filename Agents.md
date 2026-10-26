# ATURAN & PROTOKOL WAJIB AI CODING AGENT (Agents.md)

> [!CRITICAL]
> **STATUS APLIKASI: SUDAH LIVE & MEMILIKI PENGGUNA AKTIF (PRODUCTION).**  
> Repositori ini melayani pengguna nyata setiap hari (penulis, mitra kreator/seller, pembeli materi edukasi, dan admin).
> **Setiap perubahan kode, keputusan arsitektur, modifikasi skema database, atau penambahan fitur HARUS dilakukan secara super ketat dan terukur tanpa mengganggu stabilitas aplikasi yang saat ini berjalan lancar.**  
> Jangan pernah melakukan *breaking changes*, menghapus kolom aktif, atau merombak endpoint yang sedang dikonsumsi klien.

---

## 1. 📖 Pemahaman Infrastruktur & Single Source of Truth
1. **Wajib Membaca [README.md](file:///c:/Users/User/Music/LOGO%20ASISTEN%20GURU/project/CMS3/README.md) & [endpointdoc.md](file:///c:/Users/User/Music/LOGO%20ASISTEN%20GURU/project/CMS3/endpointdoc.md)**:
   - Sebelum memulai eksplorasi atau pengkodean, Agent **wajib memahami arsitektur lengkap** yang dijelaskan di `README.md`.
   - `README.md` menjelaskan pembagian peran monorepo: `src/` (Core Backend API), `UI/` (Admin Dashboard), `UI-Mitra/` (Portal Seller), and `worker-mitra-asisten-guru/` (Reverse Proxy).
2. **Keterhubungan dengan Frontend Hub (`asisten-guru hub`) & SSR Alignment**:
   - **PENTING:** Antarmuka publik untuk menampilkan **Katalog Produk Digital** dan **Artikel Blog/Berita** berada di repositori **Frontend Hub (`asisten-guru hub` / `asisten-guru.id`)**, BUKAN di `UI/` atau `UI-Mitra/` (keduanya adalah panel dashboard internal & portal seller).
   - Setiap keputusan terkait **Server-Side Rendering (SSR)**, hidrasi initial data, payload API publik, struktur metadata SEO/OpenGraph, maupun skema respon artikel/produk **HARUS SELARAS** dengan arsitektur frontend Hub (`functions/blog/[[path]].js` dan sistem SSR Hub).
   - Agent **WAJIB membaca `AGENTS.md` di repositori frontend Hub** ([asisten-guru hub/AGENTS.md](file:///c:/Users/User/Music/LOGO%20ASISTEN%20GURU/project/asisten-guru%20hub/AGENTS.md)) setiap kali membuat keputusan atau perubahan pada endpoint publik, SEO, SSR, format response produk, atau artikel agar tidak merusak rendering di Hub.
3. **Wajib Membaca [UI-Mitra/README.md](file:///c:/Users/User/Music/LOGO%20ASISTEN%20GURU/project/CMS3/UI-Mitra/README.md) Sebelum Mengubah Kode UI-Mitra**:
   - Apabila terdapat instruksi atau tugas yang **mengharuskan mengubah kode atau melakukan perubahan apapun di direktori `UI-Mitra/`**, Agent **WAJIB membaca [UI-Mitra/README.md](file:///c:/Users/User/Music/LOGO%20ASISTEN%20GURU/project/CMS3/UI-Mitra/README.md)** terlebih dahulu.
   - Dokumen tersebut memuat panduan lengkap seluruh fungsi portal mitra, termasuk alur pendaftaran, ledger keuangan, sistem **Vanity Slug Toko Seller** (validasi debounced, aturan khusus approved seller, penguncian permanen 1x seumur hidup), serta arsitektur **Store Appearance Studio** (preset tema edukatif, kontras luminansi ITU-R BT.601, wadah glassmorphism, Google Fonts explorer, dan urutan seksi modular).
4. **Kerahasiaan Istilah Infrastruktur ke Pengguna (Anti-Information Leakage)**:
   - **JANGAN PERNAH** membocorkan nama teknologi internal infrastruktur kita ke sisi frontend/klien (seperti istilah: *Cloudflare, D1, SQLite, KV, R2, Cloudflare Workers, Hono, Wrangler, S2S internal details*).
   - Gunakan istilah umum dan bersahabat yang dipahami pengguna awam (misal: "Server", "Penyimpanan Berkas", "Basis Data", "Sistem Sedang Memproses").
5. **Pembaruan Knowledge Graph (Graphify)**:
   - Repositori ini menggunakan sistem knowledge graph `/graphify` yang tersimpan di `graphify-out/`.
   - **Wajib:** Setelah menyelesaikan modifikasi arsitektur besar, penambahan rute, atau refactoring komponen penting, jalankan pembaruan graph secara inkremental atau catat relasi dependensi baru agar pemahaman kode tetap mutakhir (`graphify --update` atau skrip sinkronisasi graph).

---

## 2. 🛡️ Kebijakan Kritis Keamanan Git & GitHub (Public Open-Source)
> [!WARNING]
> **REPOSITORI INI BERSIFAT PUBLIK (OPEN-SOURCE).**  
> Apabila ada instruksi untuk `git push origin main` atau branch lainnya:
> **PASTIKAN TIDAK ADA SETITIKPUN KREDENSIAL, TOKEN, API KEY, PRIVATE KEY, ATAU DATA RAHASIA YANG TER-COMMIT ATAU TER-DEPLOY KE GITHUB!**

### Checklist Verifikasi Sebelum Commit & Push:
- [ ] **Tidak ada file sensitif yang ter-stage:** Cek dengan teliti output `git status`. File `.dev.vars`, `.env`, `.env.production`, `Key index/`, berkas sertifikat `.pem`, dan folder `docs/` internal TIDAK boleh masuk ke staging Git (sudah diatur di `.gitignore`).
- [ ] **Tidak ada hardcoded secrets di kode:** Tidak boleh ada API key Brevo, JWT secret, password hash super admin, private key RS256, atau credential internal di dalam file `.ts`, `.tsx`, `.js`, atau `.json`.
- [ ] **Wrangler Secret:** Seluruh secret produksi hanya diatur melalui `npx wrangler secret put <NAMA_SECRET>`, bukan di dalam `wrangler.jsonc`.
- [ ] **Sanitasi File Contoh:** File `.dev.vars.example` dan `wrangler.jsonc.example` hanya boleh berisi placeholder dummy, bukan nilai asli lingkungan produksi.

---

## 3. 🔒 Aturan Baku Sistem Login & Autentikasi Pengguna
*Aturan ini mengikat secara mutlak untuk seluruh implementasi autentikasi:*

1. **Anti-Static Token:** Dilarang keras membuat token/session statis yang hardcoded di kode. Semua token harus di-generate unik per sesi (JWT signed dengan secret dari environment variable, atau random session ID di database) dan memiliki masa kedaluwarsa (*expiry time*).
2. **Anti-Plaintext Password:** Dilarang menyimpan atau membandingkan password dalam bentuk plaintext di manapun. Seluruh password pengguna wajib di-hash menggunakan algoritma aman (misal bcrypt dengan salt rounds yang memadai).
3. **Anti-IDOR (Insecure Direct Object References):** Setiap endpoint yang mengubah atau membaca data privat milik user (update profil, ganti password, etalase toko, upload materi, akses konten berbayar) **HARUS memverifikasi bahwa `user_id` dari token otentikasi benar-benar milik pengguna yang bersangkutan**, bukan sekadar "token valid".
4. **Rate Limiting Wajib:** Endpoint autentikasi (`/login`, `/refresh`, `/forgot-password`, `/reset-password`) dan endpoint sensitif lainnya wajib diproteksi dengan rate limiter untuk mencegah serangan brute force dan credential stuffing.
5. **Verifikasi Hak Akses Real-Time:** Endpoint yang memeriksa status "premium aktif", saldo *earnings*, status verifikasi seller, atau hak akses berbayar HARUS memverifikasi data langsung ke database secara real-time. Jangan pernah percaya pada query parameter URL, payload body sepihak, atau `localStorage` tanpa validasi server.
6. **Error Sanitization (No Technical Leakage):** JANGAN PERNAH melempar pesan error teknis ke frontend (seperti `"JWT invalid"`, `"SQL syntax error"`, `"Internal Server Error"`, `"D1_EXEC_ERROR"`). Sajikan skema pesan error yang ramah pengguna (misal: *"Sesi Anda telah berakhir, silakan masuk kembali"*, *"Terjadi kendala pada sistem, silakan coba beberapa saat lagi"*).
7. **Rangkuman Endpoint:** Setiap penambahan atau perubahan rute/endpoint API, buat rangkuman singkat yang menandai proteksi rute (Publik, Butuh Login, Role Khusus, atau S2S) dan sinkronkan dengan [endpointdoc.md](file:///c:/Users/User/Music/LOGO%20ASISTEN%20GURU/project/CMS3/endpointdoc.md).

---

## 4. 🚀 Prinsip Perubahan di Sistem Produksi (Zero-Downtime & High Stability)
Karena sistem sudah memiliki user aktif:

1. **Perubahan Skema Database (D1 SQLite):**
   - **TIDAK BOLEH** menjalankan perintah destruktif (`DROP TABLE`, `DROP COLUMN`) pada tabel yang sedang berjalan tanpa strategi migrasi bertahap.
   - Perubahan skema dilakukan secara aditif (*backward-compatible*): gunakan `ALTER TABLE ... ADD COLUMN` dengan nilai default yang aman.
   - Kode aplikasi harus mampu menangani kondisi kolom baru bernilai `NULL` untuk baris data lama yang sudah ada di database.
   - Simpan setiap langkah perubahan database ke dalam file migrasi bernomor/bernama jelas di folder `migrasi/`.
2. **Perubahan API & Kontrak Data:**
   - Dilarang mengubah struktur field JSON yang sudah dikonsumsi frontend aktif tanpa kompatibilitas mundur.
   - Endpoint publik katalog marketplace (`/api/products/public*`) dan artikel (`/api/posts*`) harus selalu memiliki fallback data aman dan cache headers yang tepat.
3. **Deployment Mandiri via Wrangler CLI:**
   - Backend dan Frontend dideploy langsung melalui CLI `wrangler` secara terencana, bukan melalui auto-deploy yang tidak terverifikasi.

---

## 5. 📋 Security & Quality Assurance Checklist

Sebelum menyatakan pekerjaan selesai atau siap deploy:
- [ ] **SQL Query Safety:** Gunakan parameter binding (`?`) untuk semua query D1. Jangan pernah lakukan string concatenation pada SQL.
- [ ] **Explicit Column Selection:** Hindari `SELECT *`. Sebutkan kolom secara eksplisit untuk efisiensi memori Edge dan mencegah kebocoran field sensitif (seperti `password_hash` atau `phone_number`).
- [ ] **Pagination & Anti-DoS:** Semua endpoint daftar data wajib memiliki limit paginasi (maksimal 100 entri per request) dan paginasi kursor untuk dataset besar.
- [ ] **Input Sanitization & Magic Bytes:** Sanitasi input rich text menggunakan DOMPurify di backend. File upload wajib dicek tipe MIME asli serta *magic bytes* header-nya sebelum disimpan ke Cloudflare R2.
- [ ] **CORS Strict Whitelist:** Hanya izinkan origin resmi yang terdaftar di konfigurasi `ALLOWED_ORIGINS`.
- [ ] **Testing:** Pastikan tidak ada regresi pada fitur yang sudah berjalan dengan menguji alur login, profil, dan akses data.
