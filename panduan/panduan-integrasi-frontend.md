# Panduan Integrasi Frontend (Pengambilan Artikel & Produk)

Dokumen ini adalah referensi lengkap untuk _developer frontend_ (baik web, mobile, maupun aplikasi lainnya) yang ingin mengambil dan menampilkan data **Artikel** dan **Produk Digital** dari Headless CMS ini. 

Semua endpoint yang ada di dokumen ini bersifat **Publik (🟢)**, yang artinya Anda bisa memanggilnya secara langsung lewat `fetch` atau `axios` tanpa memerlukan token akses (login).

---

## 📌 1. Mengambil Data Artikel

CMS ini menyediakan API untuk menampilkan daftar artikel maupun detail sebuah artikel yang berstatus _Published_ (sudah diterbitkan).

### A. Mengambil Daftar Artikel
Endpoint ini biasanya digunakan untuk halaman beranda blog, pencarian artikel, atau halaman kategori.

- **Endpoint:** `GET /api/posts`
- **Query Parameters (Opsional):**
  - `q` : Kata kunci pencarian judul/isi (contoh: `?q=belajar`).
  - `category_id` : Memfilter artikel berdasarkan ID kategori tertentu.
  - `author_id` : Memfilter artikel yang ditulis oleh penulis tertentu.
  - `sort` : Urutan data (`newest`, `oldest`, `popular`).
  - `limit` : Jumlah data per halaman (maksimal 50, default: 10).
  - `offset` : Titik awal data (untuk paginasi).

**Contoh Permintaan (Javascript/Fetch):**
```javascript
const response = await fetch('https://api.cms-anda.com/api/posts?sort=newest&limit=6');
const result = await response.json();
console.log(result.data); // Array berisi daftar artikel
```

### B. Mengambil Detail Artikel (Baca Postingan)
Endpoint ini digunakan ketika user mengklik salah satu artikel untuk membaca isinya. Parameter yang dikirimkan adalah `slug` (bukan ID).

- **Endpoint:** `GET /api/posts/:slug`

**Contoh Permintaan:**
```javascript
const slug = 'cara-cepat-belajar-coding';
const response = await fetch(`https://api.cms-anda.com/api/posts/${slug}`);
const articleDetail = await response.json();
```

---

## 📌 2. Mengambil Data Produk Digital (Katalog)

Selain artikel, sistem CMS ini juga mengatur katalog produk digital. Endpoint katalog sengaja dibuat terpisah agar lebih mudah dikelola.

### A. Mengambil Daftar Produk (Etalase)
Digunakan untuk halaman "Toko", "Katalog", atau saat memunculkan etalase milik _seller_ tertentu.

- **Endpoint:** `GET /api/products/public`
- **Query Parameters (Opsional):**
  - `search` : Kata kunci pencarian produk.
  - `category_slug` : Memfilter produk berdasarkan slug kategori.
  - `seller_id` : Sangat berguna jika Anda ingin membuat halaman "Toko Profil Seller".
  - `limit` & `offset` : Untuk paginasi.

**Keunggulan Endpoint Ini:** Data yang dikembalikan (seperti foto sampul, gambar detail, dan avatar seller) sudah berupa **URL Absolut** (`https://...`), sehingga Anda di frontend tinggal langsung memasukkannya ke dalam tag `<img src="...">` tanpa perlu menyusun URL dasar lagi.

**Contoh Permintaan:**
```javascript
const response = await fetch('https://api.cms-anda.com/api/products/public?limit=12');
const result = await response.json();
// Response struktur: { data: [...], limit: 12, offset: 0, total: 100 }
```

### B. Mengambil Detail Produk
Digunakan saat menampilkan halaman detail produk sebelum dibeli. *Endpoint ini didesain tanpa menggunakan cache browser (no-store)* agar harga yang muncul selalu _real-time_ (akurat).

- **Endpoint:** `GET /api/products/public/:slug`

**Contoh Permintaan:**
```javascript
const response = await fetch(`https://api.cms-anda.com/api/products/public/template-website-premium`);
const productDetail = await response.json();
```

---

## 📌 3. Data Pelengkap: Kategori, Tag & Profil Penulis

Untuk melengkapi navigasi di frontend Anda, gunakan API pelengkap ini:

### A. Mengambil Daftar Kategori
- **Endpoint:** `GET /api/categories`
- **Filter Opsional:** `?type=article` atau `?type=product`
- **Info Ekstra:** API ini akan otomatis mengembalikan jumlah konten di tiap kategori (`article_count` & `product_count`). Sangat cocok untuk dibuat _Sidebar Menu_ kategori.

### B. Mengambil Profil Penulis / Seller
Jika ada pengunjung yang mengklik nama penulis di artikel, atau Anda ingin membangun tampilan Toko Seller khusus.

- **Endpoint:** `GET /api/users/author/:id`
- **Catatan Penting:** 
  Untuk menjaga privasi, email dan data finansial _seller_ **tidak akan pernah** dikirimkan melalui endpoint ini. Anda hanya akan mendapatkan data publik seperti `name`, `bio`, `social_links`, `avatar_url`, dan `cover_url`. 
  Khusus untuk profil author, URL gambar yang didapat bersifat **relatif**, Anda harus menggabungkannya dengan Base URL server CMS saat merender gambar. (Misal: `https://api.cms-anda.com` + `avatar_url`).

---

### Tips Terbaik untuk Frontend Developer
1. **Atasi Error dengan Baik:** Jika produk/artikel tidak ditemukan, server akan mengembalikan status `404`. Pastikan Anda menangkap error ini dan merendernya dengan halaman "Not Found" yang elegan.
2. **Rekam Jumlah View:** Jika Anda ingin jumlah views (dilihat) artikel dan produk naik, setiap kali halaman detail dirender, panggil API `POST /api/posts/:slug/view` atau `POST /api/products/public/:slug/view`. API ini sudah dilindungi _Rate Limit_ per IP agar _view_ tidak dimanipulasi secara brutal.
