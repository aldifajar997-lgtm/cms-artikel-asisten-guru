# Dokumentasi Endpoint API Backend (CMS)

Berikut adalah rangkuman dari seluruh *endpoint* yang telah dikonstruksi untuk sistem CMS ini. Dokumentasi ini akan mempermudah *review* arsitektur dan kontrol akses sebelum di-*deploy* ke *production*.

## 🔑 Modul Autentikasi (`/api/auth`)
Modul ini bertugas menangani sesi pengguna, pengamanan menggunakan *JWT*, dan *HTTP-only cookies*.

| Endpoint | Method | Status Proteksi | Keterangan / Fungsi |
| :--- | :---: | :--- | :--- |
| `/login` | `POST` | 🟢 **Publik** | Menerima email dan password, mengembalikan `access_token` dan mengatur `refresh_token` di *cookie*. Memiliki proteksi *Rate Limiting* dan *Timing Attack*. |
| `/refresh` | `POST` | 🟢 **Publik** | Menggunakan *cookie* `refresh_token` untuk mengeluarkan `access_token` baru tanpa perlu *login* ulang. (Mendukung *token rotation* demi keamanan). |
| `/logout` | `POST` | 🔴 **Butuh Login** | Menghapus token dari database dan membersihkan *cookie* sesi dari *browser*. |
| `/forgot-password` | `POST` | 🟢 **Publik** | Mengirimkan *email reset password* melalui layanan email. (Dilengkapi *Rate Limiting*). |
| `/reset-password` | `POST` | 🟢 **Publik** | Mengubah *password* setelah memverifikasi token reset yang valid. |

---

## 👤 Modul Profil & Manajemen SEO (`/api/users`)
Modul ini bertugas mengelola identitas penulis, preferensi SEO, target penulisan, serta operasi administratif untuk Super Admin.

### Endpoint Publik (Untuk Pembaca)
Endpoint ini diletakkan khusus *sebelum* `authMiddleware`, agar para pembaca blog bisa melihat profil penulis artikel tanpa login. Namun, data yang disajikan sangat dibatasi demi keamanan.

*   `q` (opsional): Keyword pencarian.
*   `category_id` (opsional): Filter berdasarkan kategori.
*   `author_id` (opsional): Filter berdasarkan pembuat artikel.
*   `sort` (opsional): Urutan artikel (`newest`, `oldest`, `popular`). Default: `newest` (berdasarkan `published_at`).
*   `cursor` (opsional): Keyset cursor (nilai `published_at` atau `view_count` terakhir).
*   `limit` (opsional): Maksimal item yang dikembalikan (default 10, maks 50).
*   `offset` (opsional): Offset paginasi tradisional (default 0). *Disarankan menggunakan cursor*.

| Endpoint | Method | Status Proteksi | Keterangan / Fungsi |
| :--- | :---: | :--- | :--- |
| `/author/:id` | `GET` | 🟢 **Publik** | Menarik data publik milik penulis (Nama, Avatar, Bio, Portfolio, Role, Niche). *Endpoint* ini **memblokir** pengungkapan data sensitif seperti Email, Target Kata, dan Target Artikel. |

### Endpoint Profil Sendiri (Personal)
Hanya bisa diakses dan mengubah data milik pengguna yang *login* itu sendiri (*Anti-IDOR*).

| Endpoint | Method | Status Proteksi | Keterangan / Fungsi |
| :--- | :---: | :--- | :--- |
| `/me` | `GET` | 🔴 **Butuh Login** | Menarik data profil (termasuk *bio*, metrik *SEO*, target kata bulanan, dan *niche* utama). |
| `/me` | `PUT` | 🔴 **Butuh Login** | Memperbarui teks profil dan target *SEO* bulanan. Terdapat proteksi *Mass Assignment* (hanya memproses atribut yang diizinkan). |
| `/me/password` | `PUT` | 🔴 **Butuh Login** | Mengganti *password* lama ke *password* baru. Otomatis memutuskan/mengakhiri sesi *login* pada perangkat (*device*) lain. |
| `/me/avatar` | `POST` | 🔴 **Butuh Login** | Mengunggah foto profil (*avatar*) ke penyimpanan objek. Dibatasi maksimal 2MB dengan validasi *Magic Bytes* gambar. Otomatis menghapus sisa _file_ foto lama dari penyimpanan. |

### Endpoint Administratif (Super Admin)
Endpoint khusus ini secara berlapis dicegat (*intercepted*) oleh *middleware*, dan hanya meloloskan pengguna dengan peran *Super Admin*.

| Endpoint | Method | Status Proteksi | Keterangan / Fungsi |
| :--- | :---: | :--- | :--- |
| `/` | `GET` | 🛡️ **Super Admin** | Melihat senarai (daftar) seluruh penulis yang terdaftar di dalam sistem beserta *role* mereka (mendukung *Pagination*). |
| `/` | `POST` | 🛡️ **Super Admin** | Mendaftarkan pengguna baru (mengundang anggota tim). Otomatis mengirimkan *email* undangan lewat layanan email. |
| `/:id/status` | `PUT` | 🛡️ **Super Admin** | Mengaktifkan atau menonaktifkan pengguna. Jika dinonaktifkan, seluruh token miliknya dibakar secara instan (langsung ter-*logout* dari sistem). |
| `/:id/role` | `PUT` | 🛡️ **Super Admin** | Menugaskan *role* baru (misal mengubah *Writer* menjadi *Editor*). |
| `/:id/reset-password`| `PUT` | 🛡️ **Super Admin** | Penyetelan ulang (*force reset*) *password* anggota jika mereka tidak dapat mengakses tautan dari *email*. |
| `/roles/list` | `GET` | 🛡️ **Super Admin** | Mendapatkan daftar opsi _Role_ yang tersedia di _database_ untuk keperluan _dropdown_. |
| `/:id` | `DELETE` | 🛡️ **Super Admin** | Menghapus pengguna secara permanen dari sistem, beserta token dan *file avatar*-nya. |

---

## 📝 Modul Artikel & Postingan (`/api/posts`)
Modul ini bertugas menangani pembuatan, pengeditan, dan pengelolaan artikel beserta fitur-fitur pendukung SEO-nya.

| Endpoint | Method | Status Proteksi | Keterangan / Fungsi |
| :--- | :---: | :--- | :--- |
| `/` | `GET` | 🟢 **Publik** | Mendapatkan daftar artikel publik yang statusnya `published` (Mendukung *Pagination*). |
| `/:slug` | `GET` | 🟢 **Publik** | Membaca satu artikel publik secara spesifik berdasarkan *slug*. |
| `/:slug/view` | `POST` | 🟢 **Publik** | Menambahkan jumlah tayangan (View Count) pada suatu artikel. Dilindungi *Rate Limit* ketat berbasis IP untuk mencegah *spam* atau klik ganda bot. |
| `/preview/:identifier` | `GET` | 🟢 **Publik** | Menampilkan *preview* artikel (termasuk *draft*). Wajib menyertakan parameter `?token=` valid hasil generate JWT preview. |
| `/admin/stats` | `GET` | 🔴 **Butuh Login** | Mendapatkan ringkasan statistik (jumlah artikel *published/draft*, total views, *word count*, dll) untuk _dashboard_ pengguna saat ini. |
| `/admin/preview-token/:id` | `GET` | 🔴 **Butuh Login** | Menghasilkan token JWT sementara (berlaku 15 menit) untuk pratinjau (*preview*) artikel *draft*. (Membutuhkan izin `edit_post`). |
| `/admin/all` | `GET` | 🔴 **Butuh Login** | Mendapatkan daftar lengkap seluruh artikel untuk manajemen di dalam CMS. *Super Admin* bisa melihat semua artikel, sedangkan pengguna biasa hanya melihat artikel miliknya. |
| `/admin/:id` | `GET` | 🔴 **Butuh Login** | Mengambil detail spesifik satu artikel beserta *tags* untuk dimuat ke dalam form Editor. (Membutuhkan izin `edit_post`). |
| `/` | `POST` | 🔴 **Butuh Login** | Membuat artikel baru (tersimpan ke `draft` atau `published`). Mengeksekusi proteksi anti-XSS melalui DOMPurify pada konten HTML. (Membutuhkan izin `create_post`). |
| `/:id` | `PUT` | 🔴 **Butuh Login** | Mengedit artikel yang sudah ada. Menjamin kontrol akses sehingga pengguna hanya bisa mengedit artikelnya sendiri, kecuali ia adalah *Super Admin*. (Membutuhkan izin `edit_post`). |
| `/:id` | `DELETE` | 🔴 **Butuh Login** | Menghapus artikel dari _database_. (Membutuhkan izin `delete_post`). |

---

## 📂 Modul Taksonomi & Kategori (`/api/categories` & `/api/tags`)
Menangani pembuatan taksonomi untuk pengelompokan artikel.

| Endpoint | Method | Status Proteksi | Keterangan / Fungsi |
| :--- | :---: | :--- | :--- |
| `/api/categories` | `GET` | 🟢 **Publik** | Mendapatkan daftar seluruh kategori yang tersedia beserta jumlah artikel di masing-masing kategori (`article_count`). |
| `/api/categories` | `POST` | 🛡️ **Izin Khusus** | Membuat kategori baru (Membutuhkan izin `manage_taxonomy`). |
| `/api/categories/:id` | `PUT` | 🛡️ **Izin Khusus** | Memperbarui nama/slug kategori (Membutuhkan izin `manage_taxonomy`). |
| `/api/categories/:id` | `DELETE` | 🛡️ **Izin Khusus** | Menghapus kategori (Membutuhkan izin `manage_taxonomy`). |
| `/api/tags` | `GET` | 🟢 **Publik** | Mendapatkan daftar seluruh *tags* (label) artikel yang ada. |
| `/api/tags` | `POST` | 🛡️ **Izin Khusus** | Membuat _tag_ baru (Membutuhkan izin `manage_taxonomy`). |
| `/api/tags/:id` | `PUT` | 🛡️ **Izin Khusus** | Memperbarui nama/slug _tag_ (Membutuhkan izin `manage_taxonomy`). |
| `/api/tags/:id` | `DELETE` | 🛡️ **Izin Khusus** | Menghapus _tag_ (Membutuhkan izin `manage_taxonomy`). |

---

## 🖼️ Modul Media & Upload (`/api/media`)
Menangani pengunggahan dan pemanggilan aset *file* statis melalui penyimpanan objek.

| Endpoint | Method | Status Proteksi | Keterangan / Fungsi |
| :--- | :---: | :--- | :--- |
| `/:r2_key` | `GET` | 🟢 **Publik** | Mengakses dan merender gambar _inline_ untuk artikel yang tersimpan di penyimpanan objek. |
| `/avatars/:r2_key` | `GET` | 🟢 **Publik** | Mengakses gambar khusus _avatar_ pengguna. |
| `/` | `POST` | 🔴 **Butuh Login** | Mengunggah aset media (gambar) dari editor teks. Melakukan validasi *Magic Bytes*, membatasi ukuran (max 2MB), menghasilkan kunci unik, dan menyimpannya ke penyimpanan objek (Membutuhkan izin `upload_media`). |
| `/:id` | `DELETE` | 🔴 **Butuh Login** | Menghapus aset media dari penyimpanan objek dan rekamannya dari database (Membutuhkan izin `delete_media`). |

---

## ⚙️ Modul Pengaturan Situs (`/api/settings`)
Pengaturan *frontend* dan *meta-data* dari blog secara global.

| Endpoint | Method | Status Proteksi | Keterangan / Fungsi |
| :--- | :---: | :--- | :--- |
| `/` | `GET` | 🟢 **Publik** | Membaca konfigurasi CMS saat ini (Nama Situs, Meta Description Global, Logo, dll). |
| `/` | `PUT` | 🛡️ **Izin Khusus** | Memperbarui konfigurasi situs secara global. (Membutuhkan izin `manage_settings`). |

---

## 📈 Modul Dashboard (`/api/dashboard`)
Menyediakan agregasi data dan statistik menyeluruh untuk ditampilkan pada _dashboard_ utama.

| Endpoint | Method | Status Proteksi | Keterangan / Fungsi |
| :--- | :---: | :--- | :--- |
| `/stats` | `GET` | 🛡️ **Izin Khusus** | Menghitung total artikel, total pengguna, dan total media secara agregat. (Membutuhkan izin `view_dashboard`). |

---

## 🔍 Modul Root & SEO Generik (Root `/`)
Menangani *file* khusus untuk keperluan SEO dan verifikasi *health check* sistem.

| Endpoint | Method | Status Proteksi | Keterangan / Fungsi |
| :--- | :---: | :--- | :--- |
| `/` | `GET` | 🟢 **Publik** | Mengembalikan status *health check* dasar. |
| `/sitemap.xml` | `GET` | 🟢 **Publik** | Men-generate Sitemap Index secara dinamis, yang merujuk ke sub-sitemap artikel (paginated), kategori, dan tag. Memiliki proteksi *Rate Limiting* (20 req/menit) dan *Cache-Control* 1 jam. |
| `/sitemap-posts-:page.xml` | `GET` | 🟢 **Publik** | Sub-sitemap artikel per halaman (masing-masing maks 1000 URL). |
| `/sitemap-taxonomy.xml` | `GET` | 🟢 **Publik** | Sub-sitemap kategori dan tag. |
| `/robots.txt` | `GET` | 🟢 **Publik** | Men-generate dokumen *robots.txt* yang berisi direktif akses _bot_ dan _link_ sitemap. |

> [!TIP]
> **Catatan Persiapan Deployment:**
> Pastikan variabel rahasia (`JWT_SECRET`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD_HASH`, `BREVO_API_KEY`, dan `ALLOWED_ORIGINS`) tidak tersimpan ke dalam _source code_ git. Konfigurasikan melalui mekanisme *secret management* platform Anda saat akan merilis ke produksi.
