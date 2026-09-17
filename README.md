<p align="center">
  <img src="./logo3.svg" alt="Asisten Guru CMS Logo" width="200" />
</p>

<h1 align="center">Asisten Guru Headless CMS</h1>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" />
</p>

<p align="center">
  Platform manajemen konten (CMS) modern berkinerja tinggi, aman, dan dirancang khusus untuk skalabilitas tanpa batas menggunakan ekosistem Serverless Cloudflare.
</p>

---

## 🚀 Ikhtisar Arsitektur

Asisten Guru CMS mengadopsi pola **Headless CMS**—memisahkan logika pengolahan data (Backend API) dari antarmuka visual (Frontend/Admin UI). Hal ini memungkinkan konten yang sama dikonsumsi oleh berbagai platform (Web, Mobile App, dll) tanpa hambatan performa.

### Stack Teknologi
- **Backend API:** [Cloudflare Workers](https://workers.cloudflare.com/) + [Hono.js](https://hono.dev/) (Edge Framework super ringan)
- **Database Utama:** [Cloudflare D1](https://developers.cloudflare.com/d1/) (Serverless SQLite di Edge)
- **Penyimpanan Media:** [Cloudflare R2](https://developers.cloudflare.com/r2/) (Object Storage tanpa biaya Egress)
- **Caching & Rate Limiting:** Cloudflare KV & WAF (Web Application Firewall)
- **Admin Dashboard UI:** React 19 + Vite + Tailwind CSS v4

---

## ✨ Fitur Unggulan

1. **Performa Edge Bertenaga Kilat** ⚡
   API dieksekusi di *edge network* (lokasi server terdekat dengan pengguna) sehingga latensi menjadi sangat rendah (rata-rata 30-50ms).
   
2. **Pencarian Cerdas (Full-Text Search)** 🔍
   Menggunakan modul `FTS5` SQLite, pencarian artikel berdasarkan kata kunci berjalan seketika tanpa perlu layanan pihak ketiga seperti Algolia atau ElasticSearch.
   
3. **Paginasi Berbasis Kursor (*Keyset Pagination*)** ⏭️
   Menghindari masalah lambatnya *query OFFSET* pada dataset besar. API artikel menggunakan kursor (tanggal publikasi) sehingga performa tetap stabil meski ada ratusan ribu artikel.

4. **Keamanan Lapis Baja (Zero-Trust Security)** 🛡️
   - **No Plaintext Passwords:** Seluruh *password* penulis di-hash secara aman.
   - **Strict JWT Auth:** Token unik yang kedaluwarsa otomatis (bukan token abadi).
   - **XSS Protection:** Input artikel disanitasi menggunakan `DOMPurify` di Backend, memastikan tidak ada skrip berbahaya, namun tetap menoleransi *embed* YouTube/Twitter secara cerdas.
   - **Anti-Brute Force:** Endpoint login dan API vital dijaga dengan *Rate Limiting* otomatis.
   - **CORS Terkendali:** Hanya mengizinkan *traffic* dari domain terdaftar.

5. **Manajemen Media Efisien (Client-Side Resizing)** 🖼️
   Backend secara tegas membatasi unggahan file di atas 1MB. Hal ini diakali secara brilian oleh *Frontend* yang otomatis mengecilkan dimensi gambar (*resize via HTML5 Canvas*) dan mengompresinya ke WebP **sebelum** dikirim ke *server*. Menghemat tagihan *bandwidth* 100%!

6. **SEO Terintegrasi (Technical SEO)** 📈
   Otomatis menghasilkan struktur *Sitemap XML* berskala besar (termasuk paginasi sitemap), lengkap dengan perlindungan konten draf (konten belum *publish* tidak akan pernah terekspos/terhitung).

---

## 📂 Struktur Repositori

```text
├── schema.sql              # Skema tabel database (D1), Triggers, & Virtual Tables (FTS5)
├── src/                    # KODE BACKEND API (Cloudflare Workers)
│   ├── index.ts            # Entry point API & Konfigurasi CORS
│   ├── routes/             # Endpoint (posts, users, categories, media, tags, seo)
│   ├── middlewares/        # Proteksi rute (Auth JWT, Role-Based Access, Rate Limit)
│   └── utils/              # Fungsi bantu (Hash, Paginasi, Sanitasi)
├── UI/                     # KODE FRONTEND ADMIN (React + Vite)
│   ├── src/                # Komponen React (Dashboard, Editor, Profile)
│   ├── package.json        # Dependensi UI
│   └── vite.config.ts      # Konfigurasi bundler Frontend
├── wrangler.jsonc          # Konfigurasi Infrastruktur Cloudflare (Bindings D1, R2, KV, Env)
└── README.md               # Dokumentasi Repositori
```

---

## 🛠️ Panduan Menjalankan di Lokal (Local Development)

### 1. Menjalankan Backend API

API Backend dijalankan menggunakan `wrangler` yang akan menyimulasikan lingkungan Cloudflare D1 & R2 di komputer Anda.

1. Buka terminal di folder root (*project* utama).
2. Instal dependensi (jika belum): 
   ```bash
   npm install
   ```
3. Buat file `.dev.vars` (jangan di-commit!) dari salinan `.dev.vars.example`:
   ```env
   JWT_SECRET="rahasia-super-kuat-anda-di-sini"
   SUPER_ADMIN_EMAIL="admin@asisten-guru.id"
   SUPER_ADMIN_PASSWORD_HASH="hash_password_di_sini"
   ```
4. Jalankan migrasi *database* dan data awal (seed) ke SQLite lokal:
   ```bash
   npx wrangler d1 execute cms-db --local --file=./migrasi/schema.sql
   npx wrangler d1 execute cms-db --local --file=./migrasi/seed.sql
   ```
5. Nyalakan server lokal:
   ```bash
   npm run dev
   ```
   *(Backend akan berjalan di `http://localhost:8787`)*

### 2. Menjalankan Admin UI Dashboard

Admin UI merupakan aplikasi React terpisah.

1. Buka terminal baru dan masuk ke folder `UI/`.
   ```bash
   cd UI
   ```
2. Instal dependensi Frontend:
   ```bash
   npm install
   ```
3. Konfigurasikan API Endpoint dengan membuat file `.env` (berdasarkan `.env.example`):
   ```env
   VITE_API_URL=http://localhost:8787/api
   ```
4. Nyalakan Vite Server:
   ```bash
   npm run dev
   ```
   *(Akses Dashboard di `http://localhost:3000`)*

---

## 🚢 Panduan Deployment ke Production

### 1. Deploy Backend (Cloudflare Workers)
Pastikan Anda sudah *login* ke Cloudflare di terminal (`npx wrangler login`).

```bash
# Daftarkan skema ke D1 Production (Lakukan jika ada perubahan database)
npx wrangler d1 execute cms-db --remote --file=./migrasi/schema.sql

# Masukkan data bawaan (seed) jika ini adalah deployment pertama
npx wrangler d1 execute cms-db --remote --file=./migrasi/seed.sql

# Setel Secret Variables (Hanya dilakukan sekali)
npx wrangler secret put JWT_SECRET
npx wrangler secret put SUPER_ADMIN_EMAIL
npx wrangler secret put SUPER_ADMIN_PASSWORD_HASH

# Deploy API ke Internet!
npx wrangler deploy
```

### 2. Deploy Frontend UI (Cloudflare Pages)
Masuk ke folder `UI/`. Pastikan file `.env.production` sudah menunjuk ke URL Backend Production Anda (misal `https://cms.asisten-guru.my.id/api`).

```bash
cd UI
npm run build
npx wrangler pages deploy dist --project-name cms-ui
```

---

## 🔒 Security Compliance Note

Sistem ini didesain sesuai panduan ketat:
- Semua pesan *error* teknis (`Internal Server Error`, `SQL Syntax`, dsb) disanitasi di `middlewares/error-handler.ts` dan tidak akan pernah dibocorkan ke Frontend/Client.
- Autentikasi JWT dikelola mandiri tanpa menggunakan *Session Storage* statis yang berisiko dicuri.
- Operasi manipulasi (INSERT/UPDATE) dibungkus dalam blok `try/catch` dan menggunakan fitur `batch()` D1 SQLite guna menjamin atomisitas data (*ACID Compliance*).

---

## 📄 Lisensi

Proyek ini menggunakan lisensi **[MIT License](./LICENSE)**. Anda bebas menggunakan, memodifikasi, dan mendistribusikan kode ini, baik untuk keperluan pribadi maupun komersial.

<p align="center">
  <i>Dibuat dengan ❤️ untuk sistem pendidikan yang lebih baik.</i>
</p>
