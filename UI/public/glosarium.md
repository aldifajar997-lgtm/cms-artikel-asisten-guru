# Glosarium SEO dan Sistem Artikel

Dokumen ini berisi daftar terminologi yang berkaitan dengan sistem SEO (Search Engine Optimization) dan manajemen artikel pada CMS Asisten Guru.

## Terminologi Dasar

### 1. Slug
Bagian terakhir dari URL yang mengidentifikasi halaman web tertentu dalam format yang mudah dibaca oleh manusia dan mesin pencari. Slug biasanya dibuat dari judul artikel yang diubah menjadi huruf kecil dan spasi diganti dengan tanda hubung.
* **Contoh:** Untuk artikel berjudul "Cara Belajar Efektif", slug-nya mungkin adalah `cara-belajar-efektif`.
* **URL Lengkap:** `https://asisten-guru.id/blog/cara-belajar-efektif`

### 2. Meta Title (Title Tag)
Judul halaman web (HTML `<title>`) yang mendeskripsikan konten halaman secara singkat dan relevan. Meta title ini ditampilkan pada tab browser dan menjadi judul utama (teks biru tebal) pada halaman hasil pencarian (SERP).
* **Fungsi:** Sangat penting untuk SEO dan memberikan gambaran pertama kepada pengguna tentang isi artikel. Panjang ideal biasanya 50-60 karakter.

### 3. Meta Description
Ringkasan singkat (HTML `<meta name="description">`) dari konten halaman web. Ini muncul di bawah Meta Title pada hasil pencarian (SERP).
* **Fungsi:** Membujuk pengguna untuk mengklik tautan (meningkatkan CTR - Click-Through Rate). Mesin pencari kadang menggunakan deskripsi ini, atau membuat sendiri dari konten artikel. Panjang ideal biasanya 150-160 karakter.

### 4. Focus Keyword / Keyword
Kata atau frasa utama yang menjadi target optimasi artikel agar muncul di hasil pencarian ketika orang mengetikkan kata tersebut di Google atau mesin pencari lainnya.
* **Fungsi:** Membantu penulis fokus pada satu topik dan memudahkan mesin pencari mengkategorikan konten.

### 5. Alt Text (Alternative Text)
Teks deskriptif yang ditambahkan ke atribut `alt` pada tag gambar (HTML `<img>`).
* **Fungsi:** 
  - Dibaca oleh _screen reader_ untuk aksesibilitas pengguna tunanetra.
  - Ditampilkan saat gambar gagal dimuat.
  - Membantu mesin pencari memahami konteks gambar (penting untuk pencarian gambar).

### 6. Featured Image (Gambar Andalan)
Gambar utama yang mewakili keseluruhan isi artikel.
* **Fungsi:** Ditampilkan di bagian atas artikel, di daftar blog, dan sebagai *thumbnail* utama (melalui Open Graph/Twitter Cards) ketika tautan artikel dibagikan di media sosial atau aplikasi pesan.

### 7. Heading Tags (H1, H2, H3, dst.)
Tag HTML yang digunakan untuk menstrukturkan teks pada halaman.
* **H1:** Biasanya digunakan untuk Judul Utama Artikel (hanya boleh ada satu H1 dalam satu halaman).
* **H2, H3, dst.:** Digunakan untuk sub-judul (subheading) yang memecah artikel menjadi beberapa bagian yang lebih mudah dibaca. Membantu mesin pencari memahami struktur dan poin-poin penting konten.

## Terminologi Sosial Media & Berbagi Tautan

### 8. Open Graph (OG) Tags
Kumpulan tag meta spesifik (HTML `<meta property="og:...">`) yang mengontrol bagaimana informasi artikel ditampilkan saat tautan dibagikan di platform seperti Facebook, LinkedIn, WhatsApp, dll.
* **Contoh:** `og:title`, `og:description`, `og:image`.

### 9. Twitter Cards
Mirip dengan Open Graph, tetapi khusus dirancang untuk mengoptimalkan pratinjau tautan (teks, gambar, video) ketika artikel dibagikan di Twitter.
* **Contoh:** `twitter:card`, `twitter:title`, `twitter:image`.

## Terminologi Teknis SEO & Indexing

### 10. SERP (Search Engine Results Page)
Halaman hasil yang ditampilkan oleh mesin pencari (seperti Google) setelah pengguna memasukkan kata kunci pencarian.

### 11. Crawling (Perayapan)
Proses di mana "robot" atau *crawler* mesin pencari (misal: Googlebot) menelusuri halaman web dan mengikuti tautan untuk menemukan konten baru atau konten yang telah diperbarui.

### 12. Indexing (Pengindeksan)
Proses mesin pencari menyimpan dan mengatur informasi halaman web yang telah di-crawl ke dalam database mereka. Halaman yang tidak diindeks tidak akan pernah muncul di hasil pencarian.

### 13. Sitemap (Peta Situs)
File XML (biasanya `sitemap.xml`) yang berisi daftar semua URL halaman penting dalam website. 
* **Fungsi:** Memandu *crawler* mesin pencari agar dapat menemukan dan merayapi semua halaman website dengan lebih efisien dan terstruktur.

### 14. Robots.txt
File teks yang ditempatkan di root website untuk memberi instruksi kepada *crawler* mesin pencari mengenai halaman atau direktori mana yang **boleh** (Allow) atau **tidak boleh** (Disallow) di-crawl.

### 15. Canonical URL (Canonical Tag)
Tag HTML (HTML `<link rel="canonical" href="...">`) yang memberi tahu mesin pencari mana versi URL "utama" atau "asli" dari suatu halaman.
* **Fungsi:** Mencegah masalah penalti SEO akibat *duplicate content* (konten duplikat) ketika satu artikel bisa diakses dari beberapa URL yang berbeda.

### 16. Structured Data / Schema Markup
Potongan kode (seringkali berformat JSON-LD) yang ditambahkan ke HTML halaman. 
* **Fungsi:** Memberikan konteks eksplisit tentang konten halaman kepada mesin pencari (misalnya mendefinisikan bahwa halaman tersebut adalah "Artikel", siapa "Penulis"-nya, dan kapan "Tanggal Publikasi"-nya). Membantu memunculkan *Rich Snippets* di hasil pencarian.

## Terminologi Tautan (Link)

### 17. Internal Link
Tautan yang menghubungkan satu halaman ke halaman lain **di dalam** domain website yang sama (misal: dari Artikel A ke Artikel B di asisten-guru.id).
* **Fungsi:** Membantu navigasi pengguna, menyebarkan *Page Authority*, dan membangun hierarki informasi situs.

### 18. External Link (Outbound Link)
Tautan yang mengarah dari halaman website kita ke domain website **orang lain**.
* **Fungsi:** Memberikan referensi atau sumber tambahan yang kredibel kepada pembaca.

### 19. Backlink (Inbound Link)
Tautan dari website **orang lain** yang mengarah ke website kita.
* **Fungsi:** Salah satu faktor peringkat SEO terpenting. Dianggap sebagai "suara/rekomendasi" dari website lain bahwa konten kita berkualitas.

### 20. Anchor Text
Teks yang dapat diklik pada sebuah tautan (hyperlink).
* **Contoh:** Pada kalimat "Baca [panduan SEO ini](#)", frasa "panduan SEO ini" adalah anchor text.
* **Fungsi:** Memberikan petunjuk yang kuat kepada mesin pencari tentang topik halaman yang dituju.

### 21. Dofollow & Nofollow Links
Atribut pada tag HTML tautan (`rel="nofollow"`). 
* **Dofollow:** Secara default semua link adalah dofollow. Ini mengizinkan mesin pencari untuk mengikuti link dan meneruskan "otoritas" (link juice) ke halaman yang dituju.
* **Nofollow:** Memberi tahu mesin pencari untuk tidak mengikuti link tersebut dan tidak meneruskan otoritas. Biasanya digunakan untuk link sponsor, komentar spam, atau link ke situs yang tidak sepenuhnya kita percayai.

## Terminologi Performa & UI/UX SEO

### 22. Breadcrumbs (Navigasi Roti Kumal)
Elemen navigasi teks yang biasanya terletak di bagian atas halaman, menunjukkan lokasi halaman saat ini dalam struktur hierarki website (misal: Beranda > Blog > Kategori > Judul Artikel).
* **Fungsi:** Membantu pengguna mengetahui posisi mereka dan memudahkan navigasi. Mesin pencari sangat menyukai breadcrumbs karena memperjelas struktur situs dan sering dimunculkan di SERP.

### 23. Rich Snippets
Hasil pencarian Google yang menampilkan informasi tambahan selain meta title dan deskripsi biasa. Informasi ini ditarik dari *Structured Data / Schema Markup*.
* **Contoh:** Bintang rating, tanggal publikasi, gambar thumbnail, atau durasi waktu baca yang muncul langsung di hasil pencarian.

### 24. CTR (Click-Through Rate)
Rasio antara jumlah klik yang diterima artikel Anda di hasil pencarian dibagi dengan jumlah tayangan (impressions) artikel tersebut dilihat.
* **Fungsi:** Indikator seberapa menarik Meta Title dan Meta Description Anda di mata pengguna.

### 25. Bounce Rate (Rasio Pantulan)
Persentase pengunjung yang masuk ke sebuah halaman website dan langsung keluar (bounce) tanpa membuka halaman lain atau berinteraksi lebih lanjut.
* **Fungsi:** Jika terlalu tinggi, bisa menjadi sinyal bagi Google bahwa konten artikel tidak relevan dengan apa yang dicari pengguna.

### 26. Core Web Vitals (CWV)
Metrik performa yang digunakan Google untuk mengukur *user experience* pada sebuah halaman web. Terdiri dari kecepatan muat (LCP), interaktivitas (FID/INP), dan stabilitas visual (CLS).
* **Fungsi:** Halaman web dan artikel yang memuat lebih cepat dan stabil akan mendapatkan nilai plus dalam peringkat pencarian Google.

## Terminologi Konten (CMS)

### 27. Kategori & Tag (Taxonomy)
Sistem pengelompokan artikel.
* **Kategori:** Kelompok topik yang besar dan luas (seperti daftar isi buku). Contoh: "Edukasi", "Teknologi".
* **Tag (Label):** Kata kunci spesifik yang lebih detail mengenai isi artikel (seperti indeks di belakang buku). Contoh: "ujian-online", "kurikulum-merdeka".

### 28. Status Publikasi
Status yang menandakan siklus hidup sebuah artikel di dalam CMS:
* **Draft:** Artikel masih dalam tahap penulisan dan belum bisa dilihat publik.
* **Published:** Artikel sudah diterbitkan dan bisa diakses secara publik.
* **Scheduled:** Artikel sudah selesai dan dijadwalkan untuk terbit secara otomatis pada tanggal/waktu tertentu di masa depan.
* **Archived:** Artikel sudah ditarik dari publikasi atau diarsipkan.

### 29. Evergreen Content (Konten Abadi)
Artikel yang topiknya selalu relevan dan tidak lekang oleh waktu (tidak cepat basi). 
* **Contoh:** "Cara Menghitung Luas Segitiga" (Evergreen) dibandingkan dengan "Berita Pendidikan Hari Ini" (Bukan Evergreen).

### 30. Redirect (Pengalihan 301 & 302)
Perintah teknis yang otomatis mengalihkan pengguna dan mesin pencari dari satu URL ke URL lain.
* **301 Redirect (Permanent):** Jika slug artikel diubah, URL lama harus diarahkan ke URL baru secara permanen (301) agar SEO dari URL lama (backlink dsb) tidak hilang (Broken Link / Error 404).

### 31. LSI Keywords (Latent Semantic Indexing)
Kata-kata atau frasa yang memiliki hubungan makna (semantik) secara erat dengan kata kunci utama (Focus Keyword). 
* **Contoh:** Jika kata kunci utama adalah "Mobil", kata kunci LSI-nya mungkin "mesin, ban, setir, bensin". Menggunakan LSI keyword membuat artikel terlihat lebih natural bagi Google.

