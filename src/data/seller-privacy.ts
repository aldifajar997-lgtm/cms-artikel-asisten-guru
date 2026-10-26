/**
 * Kebijakan Privasi & Perlindungan Data Sensitif Kemitraan Kreator Asisten Guru
 * Sumber kebenaran: docs/kebijakan-privasi-kemitraan-kreator.md
 */

export const SELLER_PRIVACY_MARKDOWN = `# KEBIJAKAN PRIVASI & PERLINDUNGAN DATA SENSITIF KEMITRAAN KREATOR ASISTEN GURU

**Terakhir Diperbarui:** 19 Oktober 2026  
**Dasar Hukum Utama:** Undang-Undang Republik Indonesia Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)  
**Platform Resmi:** [https://asisten-guru.id/toko](https://asisten-guru.id/toko) (dan sub-domain portal mitra \`https://mitra.asisten-guru.id\`)

---

## 1. PENDAHULUAN & KOMITMEN KAMI

Pengelola Platform **Asisten Guru** ("Kami" atau "Platform") berkomitmen penuh melindungi privasi, kerahasiaan, dan keamanan Data Pribadi yang Anda berikan selaku Mitra Kreator ("Kreator", "Seller", atau "Anda"). 

Kebijakan Privasi ini menjelaskan bagaimana Kami mengumpulkan, menggunakan, menyimpan, melindungi, dan memproses data Anda, khususnya **Data Pribadi yang Bersifat Spesifik / Sensitif** (data keuangan/rekening bank) serta aset digital (portofolio dan contoh foto produk digital) yang dikumpulkan selama proses pendaftaran dan operasional kemitraan.

Dengan mencentang kotak persetujuan pada saat masuk (*login*) melalui Single Sign-On (SSO) Asisten Guru maupun pendaftaran akun mitra, Anda menyatakan memberikan **Persetujuan yang Sah dan Eksplisit (*Explicit Consent*)** atas seluruh ketentuan pemrosesan data dalam Kebijakan Privasi ini.

---

## 2. KATEGORI DATA PRIBADI YANG DIKUMPULKAN

Kami mengumpulkan data sesuai asas relevansi dan pembatasan tujuan (*data minimization*):

### a. Data Pribadi Umum
* **Identitas Akun:** Nama lengkap, alamat surat elektronik (*email*), dan ID Akun SSO Asisten Guru (\`hub_account_id\`).
* **Profil Publik Toko:** Foto profil/avatar, banner toko, nama toko/jenama, bidang keahlian (*niche* edukasi), biografi singkat, tautan portofolio eksternal, dan username media sosial (Instagram, TikTok, Twitter/X, LinkedIn).

### b. Data Pribadi Spesifik / Sensitif (Data Keuangan Pribadi)
Sesuai **Pasal 4 ayat (2) huruf f UU No. 27 Tahun 2022**, data keuangan pribadi tergolong data spesifik:
* **Nama Bank** (contoh: BCA, BRI, Bank Mandiri, BNI, BSI, dll).
* **Nomor Rekening Bank**.
* **Nama Lengkap Pemilik Rekening** (wajib sesuai identitas KTP/buku tabungan).

### c. Portofolio & Contoh Foto Produk Digital (Bahan Kurasi)
* Berkas gambar berupa contoh foto produk, lembar kerja, atau modul ajar digital (maksimal 5 foto dengan ukuran maksimal 1 MB per file dalam format JPG, PNG, atau WEBP).

---

## 3. TUJUAN SPESIFIK PEMROSESAN DATA (*PURPOSE LIMITATION*)

Data Anda diproses semata-mata untuk keperluan operasional kemitraan yang sah:

1. **Data Identitas Akun:** Digunakan untuk autentikasi sesi masuk terpusat melalui SSO Hub Asisten Guru, pengelolaan akun mitra, dan pengiriman notifikasi resmi terkait status transaksi atau kurasi.
2. **Data Rekening Bank (Sensitif):** HANYA digunakan untuk:
   * **Verifikasi Kemitraan (*Anti-Fraud & KYC*):** Memastikan kecocokan nama pendaftar dengan pemilik rekening penerima guna mencegah tindak pidana penipuan dan pencucian uang.
   * **Penyaluran Dana Bagi Hasil (*Payout/Disbursement*):** Mentransfer pendapatan royalti bagi hasil penjualan produk digital (85% hak Kreator) secara berkala sesuai permintaan penarikan dana (*withdrawal*).
3. **Contoh Foto Produk Digital:** HANYA digunakan oleh tim kurator Super Admin untuk meninjau standar mutu estetika, keterbacaan, keaslian materi, dan kesesuaian kategori sebelum toko diizinkan menerbitkan produk ke katalog publik.

---

## 4. PRINSIP KERAHASIAAN & ISOLASI DATA (*NON-DISCLOSURE*)

Kami menerapkan standar isolasi data yang ketat:
* **TIDAK DIBAGIKAN KE PEMBELI:** Nomor rekening bank, nama pemilik rekening, email login, dan contoh foto sampel kurasi Anda **TIDAK PERNAH** ditampilkan pada katalog publik atau halaman checkout pembeli. Pembeli hanya dapat melihat nama toko, bio, dan produk digital yang telah berstatus *Published*.
* **TIDAK DIJUAL KE PIHAK KETIGA:** Kami tidak pernah menjual, menyewakan, meminjamkan, atau memperdagangkan data pribadi dan data perbankan Anda kepada pihak ketiga mana pun untuk keperluan pemasaran, telemarketing, atau komersialisasi pihak ketiga.
* **HAK CIPTA TETAP MILIK ANDA:** Contoh foto produk dan materi ajar yang Anda unggah tetap menjadi hak cipta penuh milik Anda. Platform tidak mengklaim kepemilikan atas karya cipta tersebut.

---

## 5. KEAMANAN & PENYIMPANAN DATA (*SECURITY SAFEGUARDS*)

Kami menerapkan langkah-langkah teknis dan organisasional untuk mengamankan data Anda:
* **Enkripsi dalam Transit:** Seluruh transmisi data antara peramban Anda dan peladen menggunakan enkripsi modern HTTPS / TLS 1.3.
* **Enkripsi saat Disimpan (*At-Rest*):** Data rekening dan profil disimpan dalam basis data terenkripsi Cloudflare D1. File gambar disimpan secara aman dalam Cloudflare R2 Object Storage.
* **Autentikasi Aman:** Akses sesi menggunakan JWT (*JSON Web Token*) yang ditandatangani secara kriptografis serta *HttpOnly Refresh Cookie* untuk mencegah serangan XSS (*Cross-Site Scripting*).
* **Validasi File Ketat:** Unggahan foto kurasi diperiksa menggunakan inspeksi *magic bytes* dan pembatasan ukuran ketat 1 MB guna mencegah serangan injeksi kode berbahaya.

---

## 6. HAK-HAK ANDA SEBAGAI SUBJEK DATA PRIBADI

Berdasarkan **Pasal 5 hingga Pasal 13 UU No. 27 Tahun 2022**, Anda berhak untuk:
1. **Hak Mendapatkan Informasi:** Mengetahui tujuan pengumpulan dan dasar hukum pemrosesan data pribadi Anda.
2. **Hak Mengakses & Memperbarui Data:** Anda dapat memperbarui informasi toko, nomor rekening, dan foto kurasi kapan saja melalui halaman **Profil Toko**.
3. **Hak Menghapus Data (*Right to Erasure*):** Anda berhak mengajukan penutupan akun kemitraan dan penghapusan data rekening bank setelah seluruh transaksi dan pencairan dana hak Anda telah selesai diproses.
4. **Hak Menarik Persetujuan (*Withdrawal of Consent*):** Anda berhak menarik persetujuan kemitraan sewaktu-waktu dengan konsekuensi akun toko akan dinonaktifkan dari katalog Asisten Guru.

---

## 7. HUBUNGI KAMI

Apabila Anda memiliki pertanyaan, keberatan, atau ingin menggunakan hak-hak perlindungan data pribadi Anda, silakan hubungi tim pengelola data Asisten Guru melalui:
* **Platform:** [https://asisten-guru.id](https://asisten-guru.id)
* **Email Dukungan:** \`admin@asisten-guru.id\`
`
