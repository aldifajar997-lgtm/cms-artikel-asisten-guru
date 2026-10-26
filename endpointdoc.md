# Dokumentasi Endpoint API Backend (CMS)

> **Sumber kebenaran:** dokumen ini disinkronkan langsung dari kode `src/routes/*.ts` dan `src/index.ts` (terakhir: 2026-10-03).
> Salinan identik disimpan di `CMS3/endpointdoc.md`, `CMS3/docs/endpointdoc.md`, dan `asisten-guru hub/doc/endpointdoc.md`. Jika mengubah endpoint, perbarui ketiganya.

**Legenda Proteksi**
| Ikon | Arti |
| :--- | :--- |
| 🟢 **Publik** | Tanpa login. |
| 🔴 **Butuh Login** | Wajib `Authorization: Bearer <access_token>` CMS. |
| 🛡️ **Izin Khusus** | Login + permission tertentu (disebutkan di kolom keterangan). |
| 👑 **Super Admin** | Login + peran Super Admin. |
| 🔐 **S2S (Hub)** | Server-to-server dari Hub, JWT RS256 yang ditandatangani kunci privat Hub. |

Semua pesan error ke klien menggunakan bahasa yang ramah pengguna; detail teknis tidak pernah dikirim ke frontend.

---

## 🩺 Health Check
| Endpoint | Method | Proteksi | Keterangan |
| :--- | :---: | :--- | :--- |
| `/api/health` | `GET` | 🟢 Publik | Cek kesehatan layanan & database. `200 {status:"ok"}` atau `503 {status:"degraded"}`. |

---

## 🔑 Autentikasi (`/api/auth`)
| Endpoint | Method | Proteksi | Keterangan |
| :--- | :---: | :--- | :--- |
| `/login` | `POST` | 🟢 Publik | Email + password → `access_token`, `refresh_token` di cookie HTTP-only. Rate limit 5/menit, proteksi *timing attack*. |
| `/refresh` | `POST` | 🟢 Publik | Tukar cookie `refresh_token` → `access_token` baru (*token rotation*). Rate limit 5/menit. |
| `/logout` | `POST` | 🔴 Login | Mencabut access token aktif & menghapus refresh token + cookie. |
| `/forgot-password` | `POST` | 🟢 Publik | Kirim email reset password. Rate limit 3/jam. |
| `/reset-password` | `POST` | 🟢 Publik | Set password baru dengan token reset (berlaku terbatas). Rate limit 5/jam. |

---

## 👤 Profil & Pengguna (`/api/users`)

### Publik
| Endpoint | Method | Proteksi | Keterangan |
| :--- | :---: | :--- | :--- |
| `/author/:id` | `GET` | 🟢 Publik | Profil publik penulis/seller aktif: `id, name, avatar_url, cover_url, bio, portfolio_url, primary_niche, social_*`. Email & target pribadi **tidak** diekspos. Rate limit 500/menit. |

### Profil Sendiri (Anti-IDOR — selalu memakai `user.id` dari token)
| Endpoint | Method | Proteksi | Keterangan |
| :--- | :---: | :--- | :--- |
| `/me` | `GET` | 🔴 Login | Data profil lengkap termasuk `cover_url`, target SEO, dan sosial media. |
| `/me` | `PUT` | 🔴 Login | Update profil (whitelist field). `avatar_url`/`cover_url`: **tidak dikirim = dipertahankan**, `""`/`null` = dihapus (file lama ikut dibersihkan). URL absolut otomatis dinormalisasi ke relatif. Rate limit 10/menit. |
| `/me/password` | `PUT` | 🔴 Login | Ganti password (wajib password lama). Mengakhiri sesi di perangkat lain. Tidak berlaku untuk Super Admin. Rate limit 5/jam. |
| `/me/avatar` | `POST` | 🔴 Login | Upload avatar (`multipart`, field `avatar`). Maks 2MB, JPG/PNG/WEBP (validasi *magic bytes*). Response: `{ avatar_url }`. Rate limit 5/menit. |
| `/me/cover` | `POST` | 🔴 Login | **Baru.** Upload foto sampul etalase seller (`multipart`, field `cover`). Maks 3MB, JPG/PNG/WEBP. File lama otomatis dihapus. Response: `{ cover_url }` (relatif, `/api/media/covers/...`). Rate limit 5/menit. |

### Administratif
| Endpoint | Method | Proteksi | Keterangan |
| :--- | :---: | :--- | :--- |
| `/` | `GET` | 👑 Super Admin | Daftar pengguna + role (paginasi `limit`/`offset`, maks 100). |
| `/` | `POST` | 👑 Super Admin | Undang pengguna baru / kirim ulang undangan (email berisi link setup password 24 jam). Rate limit 10/menit. |
| `/:id/status` | `PUT` | 👑 Super Admin | Aktif/nonaktifkan user. Nonaktif → semua sesi dicabut. |
| `/:id/role` | `PUT` | 👑 Super Admin | Set satu/banyak role (`role_id` atau `role_ids`). Role Super Admin tidak bisa di-assign. |
| `/:id/reset-password` | `PUT` | 👑 Super Admin | Force reset password user (bukan Super Admin sistem). Semua sesi user dicabut. |
| `/roles/list` | `GET` | 👑 Super Admin | Daftar role untuk dropdown. |
| `/:id` | `DELETE` | 👑 Super Admin | Hapus user permanen beserta file avatar **dan foto sampul**. |

---

## 📝 Artikel (`/api/posts`)
| Endpoint | Method | Proteksi | Keterangan |
| :--- | :---: | :--- | :--- |
| `/` | `GET` | 🟢 Publik | Daftar artikel `published`. Query: `q`, `category_id`, `author_id`, `sort` (`newest`/`oldest`/`popular`), `cursor`, `limit` (≤50), `offset`. |
| `/:slug` | `GET` | 🟢 Publik | Detail artikel berdasarkan slug. |
| `/:slug/view` | `POST` | 🟢 Publik | Tambah view count (rate limit 1/menit per slug per IP). |
| `/preview/:identifier` | `GET` | 🟢 Publik + token | Preview draft, wajib `?token=` (berlaku 15 menit). |
| `/admin/stats` | `GET` | 🛡️ `view_dashboard` | Statistik artikel milik user. |
| `/admin/preview-token/:id` | `GET` | 🛡️ `edit_post` | Generate token preview. |
| `/admin/all` | `GET` | 🛡️ `view_dashboard` | Daftar artikel (Super Admin: semua; lainnya: milik sendiri). |
| `/admin/:id` | `GET` | 🛡️ `edit_post` | Detail artikel + tags untuk editor. |
| `/` | `POST` | 🛡️ `create_post` | Buat artikel (sanitasi XSS). |
| `/:id` | `PUT` | 🛡️ `edit_post` | Edit artikel (hanya pemilik kecuali Super Admin). |
| `/:id` | `DELETE` | 🛡️ `delete_post` | Hapus artikel. |

---

## 📂 Kategori & Tag (`/api/categories`, `/api/tags`)
| Endpoint | Method | Proteksi | Keterangan |
| :--- | :---: | :--- | :--- |
| `/api/categories` | `GET` | 🟢 Publik | Daftar kategori + `article_count` & `product_count`. Filter `?type=article\|product`. |
| `/api/categories` | `POST` | 🛡️ `manage_taxonomy` | Buat kategori (`article` hierarkis / `product` datar). |
| `/api/categories/:id` | `PUT` | 🛡️ `manage_taxonomy` | Update kategori. Tipe tidak bisa diubah bila sudah dipakai konten. |
| `/api/categories/:id` | `DELETE` | 🛡️ `manage_taxonomy` | Hapus kategori; relasi di artikel/produk di-*null*-kan, sub-kategori dilepas. |
| `/api/tags` | `GET` | 🟢 Publik | Daftar tag. |
| `/api/tags/:slug` | `GET` | 🟢 Publik | **Belum terdokumentasi sebelumnya.** Detail satu tag berdasarkan slug. |
| `/api/tags` | `POST` | 🛡️ `manage_taxonomy` | Buat tag. |
| `/api/tags/:id` | `PUT` | 🛡️ `manage_taxonomy` | Update tag. |
| `/api/tags/:id` | `DELETE` | 🛡️ `manage_taxonomy` | Hapus tag. |

---

## 🛍️ Produk Digital & Integrasi Hub (`/api/products`)

### Publik (Katalog — dipakai Hub)
| Endpoint | Method | Proteksi | Keterangan |
| :--- | :---: | :--- | :--- |
| `/public` | `GET` | 🟢 Publik | Daftar produk `published`. Query: `search`, `category_id`, `category_slug`, **`seller_id`** (etalase seller), `limit` (≤50), `offset`. Response: `{ data, limit, offset, total }`. Tiap item memuat `seller_id`, `seller_name`, **`seller_avatar_url`, `seller_cover_url` (URL absolut)**, serta `cover_image_url` & `detail_image_*_url`. |
| `/public/:slug` | `GET` | 🟢 Publik | Detail produk + info seller (sama seperti di atas). `no-store` agar harga selalu real-time. Bila slug lama: `{ is_redirect: true, new_slug }`. |
| `/public/:slug/view` | `POST` | 🟢 Publik | Tambah view count (rate limit 1/menit per slug). |
| `/public/:slug/reviews` | `GET` | 🟢 Publik | **Belum terdokumentasi sebelumnya.** 50 ulasan terbaru: `{ success, reviews: [{id, rating, comment, created_at, user_id}] }`. `user_id` = ID akun Hub (nama diperkaya oleh Hub). |

### Internal (Server-to-Server Hub)
| Endpoint | Method | Proteksi | Keterangan |
| :--- | :---: | :--- | :--- |
| `/internal/:id/price` | `GET` | 🔐 S2S (`type: price_check`) | Harga real-time + `price_lock_token` (berlaku 90 menit). `product_id` di JWT wajib = `:id`. |
| `/internal/:id/sale` | `POST` | 🔐 S2S (`type: sale_trigger`) | Catat penjualan ke ledger. Wajib: `hub_transaction_id`, `gross_amount` (harus = harga terkunci), `price_lock_token`, `paid_at` (≤7 hari lalu). Opsional: `payment_method` (metode bayar dari Midtrans/Wallet). Idempoten per `hub_transaction_id` (72 jam). |
| `/internal/:id/download` | `POST` | 🔐 S2S (`type: download_request`) | Stream file produk dengan `Content-Disposition`. Rate limit 5000/menit. |
| `/internal-reviews` | `POST` | 🔐 S2S (Bearer kunci Hub) | **Belum terdokumentasi sebelumnya.** Simpan/ubah ulasan `{productId, accountId, rating 1-5, comment ≤500}`; agregat rating produk diperbarui atomik. Verifikasi pembelian dilakukan di Hub. |
| `/internal-reviews/my` | `GET` | 🔐 S2S (Bearer kunci Hub) | **Belum terdokumentasi sebelumnya.** Ulasan milik akun tertentu: `?productId=&accountId=`. |
| `/internal/order/complete` | `POST` | 🔐 S2S (JWT RS256 / Secret S2S) | **Baru.** Konfirmasi pesanan selesai oleh pembeli (`{ hub_transaction_id, buyer_hub_id? }`). Mempercepat rilis dana dari "Saldo Tertahan" langsung ke "Saldo Aktif" seller seketika tanpa menunggu sisa 3 hari. Rate limit 200/menit. |
| `/internal/order/complaint` | `POST` | 🔐 S2S (JWT RS256 / Secret S2S) | **Baru.** Tiket komplain pembeli (`{ hub_transaction_id, buyer_hub_id, category, reason, evidence_urls? }`). Membekukan transaksi (`dispute_status = 'complained'`) dan menahan dana seller untuk verifikasi/investigasi. Rate limit 100/menit. |
| `/internal/order/complaint/resolve` | `POST` | 🔐 S2S (JWT RS256 / Secret S2S) | **Baru.** Selesaikan sengketa order dari Hub (`{ hub_transaction_id, action: 'refund' \| 'release', admin_notes? }`). `refund` = batalkan transaksi seller; `release` = tolak komplain & rilis dana ke Saldo Aktif seller. Rate limit 100/menit. |
| `/internal/order/:hub_transaction_id/complaint` | `GET` | 🔐 S2S (JWT RS256 / Secret S2S) | **Baru.** Ambil detail komplain & tanggapan terbaru dari seller di CMS untuk sinkronisasi Hub. Rate limit 200/menit. |

### Administratif (CMS)
| Endpoint | Method | Proteksi | Keterangan |
| :--- | :---: | :--- | :--- |
| `/upload-file` | `POST` | 🛡️ `upload_media` | Upload file produk (.zip/.rar/.pdf, maks 50MB, *magic bytes*, streaming). Rate limit 5/menit. |
| `/admin/all` | `GET` | 🛡️ `view_dashboard` | Daftar produk (pemilik saja kecuali Super Admin / `edit_any_product`). |
| `/admin/:id` | `GET` | 🛡️ `edit_product` | Detail produk untuk editor. |
| `/` | `POST` | 🛡️ `create_product` | Buat produk + snapshot harga awal. Kategori wajib bertipe `product`. |
| `/:id` | `PUT` | 🛡️ `edit_product` | Edit produk; file lama dibersihkan bila diganti; riwayat harga dicatat bila berubah; produk `published` tidak bisa kembali ke `draft`; produk `archived` tidak bisa diedit. |
| `/:id/archive` | `PUT` | 🛡️ `edit_product` | **Belum terdokumentasi sebelumnya.** Arsipkan produk (disembunyikan dari etalase, pembeli lama tetap bisa unduh). |
| `/:id` | `DELETE` | 🛡️ `delete_product` | Draft → hapus total; published → diarsipkan (*soft delete*). |

---

## 💰 Pendapatan Seller & Payout (`/api/earnings`) — *seluruhnya belum terdokumentasi sebelumnya*
Semua endpoint wajib login; data seller selalu difilter dengan `user.id` dari token.

| Endpoint | Method | Proteksi | Keterangan |
| :--- | :---: | :--- | :--- |
| `/summary` | `GET` | 🔴 Login | Ringkasan pendapatan seller (gross, potongan admin, net, saldo). Rate limit 30/menit. |
| `/transactions` | `GET` | 🔴 Login | Riwayat transaksi penjualan seller (paginasi). Memuat field `payment_method` (metode pembayaran pembeli). |
| `/products` | `GET` | 🔴 Login | Performa pendapatan per produk milik seller. |
| `/price-history/:product_id` | `GET` | 🔴 Login | Riwayat harga satu produk (hanya pemilik produk / admin). |
| `/withdrawals` | `GET` | 🔴 Login | Riwayat pengajuan penarikan dana seller. |
| `/withdrawals` | `POST` | 🔴 Login | Ajukan penarikan dana. Rate limit 5/menit. |
| `/admin/overview` | `GET` | 🛡️ `view_dashboard` (admin) | Ringkasan pendapatan seluruh platform. |
| `/admin/payout/:transaction_id` | `PUT` | 🛡️ `view_dashboard` (admin) | Update status payout satu transaksi. |
| `/admin/fee-config` | `GET` | 🛡️ `view_dashboard` (admin) | Riwayat konfigurasi potongan admin. |
| `/admin/fee-config` | `POST` | 🛡️ `view_dashboard` (admin) | Tetapkan konfigurasi potongan baru (`fee_bps`, `min_fee`, `max_fee`, `effective_from`). Rate limit 5/menit. |
| `/admin/withdrawals` | `GET` | 🛡️ `view_dashboard` (admin) | Daftar seluruh pengajuan penarikan. |
| `/admin/withdrawals/:id` | `PUT` | 🛡️ `view_dashboard` (admin) | Setujui/tolak/tandai selesai pengajuan penarikan. |
| `/complaints` | `GET` | 🔴 Login (Seller) | **Baru.** Daftar tiket komplain pembeli atas produk seller yang login (`?status=&limit=&offset=`). |
| `/complaints/:id/respond` | `PUT` | 🔴 Login (Seller) | **Baru.** Kirim tanggapan/klarifikasi seller & tautan perbaikan file (`{ seller_response, seller_replacement_url? }`). Sinkron S2S ke Hub. Rate limit 10/menit. |
| `/admin/complaints` | `GET` | 🛡️ Super Admin | **Baru.** Seluruh komplain pembeli di platform untuk investigasi & mediasi (`?status=&limit=&offset=`). |
| `/admin/complaints/:id/resolve` | `PUT` | 🛡️ Super Admin | **Baru.** Putusan penyelesaian komplain (`{ action: 'refund' \| 'release', admin_notes? }`). `refund` mendebit transaksi seller & mengkreditkan Saldo Akun pembeli di Hub secara sinkron atomik; `release` menolak komplain & merilis dana ke Saldo Aktif seller. Rate limit 20/menit. |

---

## 🖼️ Media (`/api/media`)
| Endpoint | Method | Proteksi | Keterangan |
| :--- | :---: | :--- | :--- |
| `/:r2_key` | `GET` | 🟢 Publik | Ambil file gambar konten/produk. Cache 1 tahun. |
| `/avatars/:r2_key` | `GET` | 🟢 Publik | Ambil gambar avatar. |
| `/covers/:r2_key` | `GET` | 🟢 Publik | **Baru.** Ambil foto sampul seller (nilai `cover_url`). |
| `/` | `POST` | 🛡️ `upload_media` | Upload gambar editor (`type`: `content` 1MB / `avatar` 2MB / `featured` 5MB). |
| `/:id` | `DELETE` | 🛡️ `delete_media` | Hapus media (pemilik / `delete_any_media` / Super Admin); referensi di artikel & produk di-*null*-kan. |

---

## ⚙️ Pengaturan Situs (`/api/settings`)
| Endpoint | Method | Proteksi | Keterangan |
| :--- | :---: | :--- | :--- |
| `/` | `GET` | 🟢 Publik | Konfigurasi situs (nama, meta, logo, dll). |
| `/` | `PUT` | 🛡️ `manage_settings` | Update konfigurasi situs. |

---

## 📈 Dashboard & Tren
| Endpoint | Method | Proteksi | Keterangan |
| :--- | :---: | :--- | :--- |
| `/api/dashboard/stats` | `GET` | 🛡️ `view_dashboard` | Total artikel, pengguna, media. Rate limit 20/menit. |
| `/api/trends/suggest` | `GET` | 🔴 Login | **Belum terdokumentasi sebelumnya.** Saran topik/keyword tren untuk penulis. |

---

## 📜 Dokumen Legal (`/api/legal` & `/api/auth/terms`)
| Endpoint | Method | Proteksi | Keterangan |
| :--- | :---: | :--- | :--- |
| `/api/auth/terms/seller` | `GET` | 🟢 Publik | Mengambil Syarat & Ketentuan dan Kebijakan Privasi mitra terbitan aktif dari Edge KV Cache / D1. Rate limit 60/menit. |
| `/api/legal/admin/documents` | `GET` | 👑 Super Admin | Mengambil daftar seluruh dokumen legal aktif beserta metadata versi dan editor. Rate limit 60/menit. |
| `/api/legal/admin/documents/:id` | `GET` | 👑 Super Admin | Mengambil naskah lengkap satu dokumen legal untuk dimuat ke editor. Rate limit 60/menit. |
| `/api/legal/admin/documents/:id` | `PUT` | 👑 Super Admin | Memperbarui dan menerbitkan naskah dokumen legal, mengarsipkan versi lama ke riwayat revisi, dan menginvalidasi KV cache. Rate limit 20/menit. |
| `/api/legal/admin/documents/:id/revisions` | `GET` | 👑 Super Admin | Mengambil riwayat revisi (audit trail kepatuhan hukum & UU PDP). Rate limit 30/menit. |
| `/api/legal/admin/documents/:id/rollback/:revId` | `POST` | 👑 Super Admin | Mengembalikan naskah dokumen ke snapshot revisi masa lalu. Rate limit 10/menit. |

---

## 🔍 SEO (Root `/`)
| Endpoint | Method | Proteksi | Keterangan |
| :--- | :---: | :--- | :--- |
| `/` | `GET` | 🟢 Publik | Status dasar layanan. |
| `/sitemap.xml` | `GET` | 🟢 Publik | Sitemap index (artikel, produk, taksonomi). Rate limit 20/menit, cache 1 jam. |
| `/sitemap-posts-:page.xml` | `GET` | 🟢 Publik | Sub-sitemap artikel (maks 1000 URL/halaman). |
| `/sitemap-products-:page.xml` | `GET` | 🟢 Publik | Sub-sitemap produk (maks 1000 URL/halaman). |
| `/sitemap-taxonomy.xml` | `GET` | 🟢 Publik | Sub-sitemap kategori & tag. |
| `/robots.txt` | `GET` | 🟢 Publik | Direktif bot + link sitemap. |

---

## 🔗 Kontrak untuk Hub: Etalase Seller
Alur yang disarankan untuk halaman toko seller di Hub:
1. `GET /api/users/author/:sellerId` → nama, avatar, **foto sampul**, bio, sosial media.
2. `GET /api/products/public?seller_id=:sellerId&limit=12&offset=0` → katalog produk seller.
3. `avatar_url`/`cover_url` dari langkah 1 bersifat **relatif** → gabungkan dengan base URL CMS. Field `seller_*_url` dari langkah 2 sudah **absolut**.

> [!TIP]
> **Catatan Deployment:** semua rahasia (`JWT_SECRET`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD_HASH`, `BREVO_API_KEY`, `HUB_PUBLIC_KEY`, `HUB_URL`, `ALLOWED_ORIGINS`) wajib dikelola lewat secret manager, bukan di source code. Deploy hanya lewat CLI, bukan auto-deploy dari repositori.
