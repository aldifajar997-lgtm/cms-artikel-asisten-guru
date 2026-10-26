-- ===================================================================
-- SEED REMOTE D1: DOKUMEN LEGAL MITRA & REVISI PERTAMA
-- ===================================================================

-- 1. Buat tabel jika belum ada di remote D1
CREATE TABLE IF NOT EXISTS legal_documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    is_published INTEGER NOT NULL DEFAULT 1,
    updated_by TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS legal_document_revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    change_summary TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES legal_documents(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_legal_rev_doc_ver 
    ON legal_document_revisions(document_id, version DESC);

-- 2. Masukkan / Perbarui Dokumen Syarat & Ketentuan Mitra
INSERT INTO legal_documents (id, title, content, version, is_published, updated_at)
VALUES (
    'seller_terms',
    'Syarat dan Ketentuan Program Kemitraan Kreator Asisten Guru',
    '# SYARAT DAN KETENTUAN PROGRAM KEMITRAAN KREATOR ASISTEN GURU

**Terakhir Diperbarui:** 17 Oktober 2026  
**Platform Resmi:** [https://asisten-guru.id/toko](https://asisten-guru.id/toko)

Selamat datang di Program Kemitraan Kreator **Asisten Guru** (\`https://asisten-guru.id/toko\`). Dokumen Syarat dan Ketentuan ("Ketentuan") ini merupakan perjanjian yang mengikat secara hukum antara Anda ("Kreator" atau "Mitra Kontributor") dan Pengelola Platform **Asisten Guru** ("Kami" atau "Platform"). 

Dengan mendaftarkan diri sebagai Kreator, mencentang kotak persetujuan pada formulir pendaftaran, dan/atau mengunggah karya digital ke Platform Kami, Anda menyatakan telah membaca, memahami, dan menyetujui seluruh isi Ketentuan ini tanpa terkecuali.

---

## PASAL 1: DEFINISI & RUANG LINGKUP KEMITRAAN

1. **Model Kemitraan:** Hubungan hukum antara Asisten Guru dan Kreator adalah **Kemitraan Publikasi dan Bagi Hasil Karya Digital (Konsinyasi Digital)**. Hubungan ini bukan merupakan hubungan kerja (karyawan-pemberi kerja), persekutuan perdata, keagenan eksklusif, maupun kegiatan penghimpunan dana perbankan/uang elektronik.
2. **Peran Kreator:** Pihak independen (guru, pendidik, akademisi, atau praktisi pendidikan) yang menyusun, memiliki hak cipta penuh, dan menyerahkan produk digital edukasi untuk dipasarkan serta didistribusikan melalui katalog Platform \`asisten-guru.id/toko\`.
3. **Peran Platform:** Penyedia infrastruktur katalog digital, kurator standar mutu & visual, pengelola promosi ekosistem, serta fasilitator pemrosesan pembayaran dari Pembeli (Pengguna Akhir).
4. **Produk Digital:** Segala bentuk perangkat ajar, Modul Ajar, RPP, LKPD, bank soal, asesmen, media pembelajaran interaktif, *template* administrasi guru, maupun aset digital edukasi lainnya yang diunggah dalam format elektronik (PDF, DOCX, XLSX, PPTX, atau tautan terintegrasi seperti Canva/Google Workspace).

---

## PASAL 2: PERSYARATAN AKUN & VERIFIKASI KREATOR

1. **Kualifikasi Pendaftaran:** Kreator wajib berusia minimal 18 (delapan belas) tahun atau telah cakap secara hukum menurut peraturan perundang-undangan di Republik Indonesia, serta wajib memberikan informasi identitas yang akurat, lengkap, dan dapat dipertanggungjawabkan pada saat proses pengajuan (*Creator Onboarding*).
2. **Kurasi & Persetujuan Akun:** Pengelola Platform memiliki hak penuh untuk melakukan verifikasi atas pengajuan akun Kreator dan contoh portofolio karya yang dilampirkan. Platform berhak menerima atau menolak pengajuan tanpa kewajiban memberikan alasan teknis secara terperinci.
3. **Kesesuaian Data Rekening Pencairan:** Nama pemilik rekening bank atau dompet digital (*e-wallet*) yang didaftarkan untuk penerimaan dana bagi hasil **wajib sama persis** dengan nama lengkap Kreator yang tertera pada profil identitas resmi. Demi kepatuhan terhadap prinsip pencegahan penipuan dan pencucian uang, Kami berhak menolak pencairan dana ke rekening milik pihak ketiga.
4. **Keamanan & Tanggung Jawab Akun:** Kreator bertanggung jawab penuh untuk menjaga kerahasiaan kredensial akses akunnya (termasuk akses melalui autentikasi pihak ketiga/OAuth). Segala aktivitas pengunggahan dokumen, perubahan harga, maupun permohonan pencairan dana yang dilakukan melalui akun Kreator dianggap sebagai tindakan sah dari Kreator tersebut.

---

## PASAL 3: STANDAR KUALITAS, KURASI & HAK KEKAYAAN INTELEKTUAL (HKI)

1. **Kepemilikan Hak Cipta:** Hak Cipta moral dan ekonomi atas karya digital yang diunggah **tetap sepenuhnya menjadi milik Kreator**. Dengan mengunggah karya ke Platform, Kreator memberikan lisensi non-eksklusif kepada Asisten Guru untuk menampilkan, memasarkan, memotong cuplikan pratinjau (*preview/watermark*), mempromosikan di media sosial resmi, dan mendistribusikan karya tersebut kepada Pembeli.
2. **Jaminan Orisinalitas (Anti-Plagiarisme):** Kreator menjamin sepenuhnya bahwa setiap karya yang diunggah adalah **100% karya orisinal hasil penyusunan sendiri** atau karya yang telah memiliki lisensi distribusi komersial yang sah.
3. **Daftar Konten Terlarang:** Kreator dilarang keras mengunggah dan memperjualbelikan:
   * Buku elektronik (PDF/hasil pindai cetak) milik penerbit komersial maupun buku terbitan pemerintah/kementerian yang mencantumkan larangan untuk diperjualbelikan kembali.
   * Karya milik guru lain, komunitas pendidikan, atau instansi lain tanpa izin tertulis resmi (plagiarisme maupun pengemasan ulang/*re-upload* tanpa hak).
   * Aset desain, ilustrasi, *font*, atau elemen pihak ketiga (termasuk elemen berbayar dari platform desain pihak ketiga) yang melanggar ketentuan lisensi penjualan ulang (*resell license*) dari penyedia aslinya.
   * Dokumen yang rusak (*corrupt*), kosong, terkunci kata sandi tanpa keterangan, mengandung kode berbahaya (*malware/virus*), atau memiliki isi yang jauh menyimpang dari judul dan deskripsi produk.
4. **Standar Kurasi & Identitas Visual:** Demi menjaga standar kualitas mutu dan keselarasan estetika \`asisten-guru.id/toko\`, seluruh produk yang diunggah akan melewati tahap **Peninjauan Admin (*In-Review*)**. Platform berhak untuk:
   * Mewajibkan penggunaan rasio gambar sampul (*cover*) **4:3** dengan tata letak yang rapi dan terbaca jelas sesuai panduan Kreator.
   * Menolak publikasi, meminta revisi isi/sampul, atau merapikan format penulisan judul/deskripsi sebelum produk ditayangkan ke publik.
5. **Pelepasan Tanggung Jawab Hukum (*Indemnification*):** Apabila di kemudian hari timbul klaim, somasi, tuntutan hukum, atau sengketa pelanggaran Hak Kekayaan Intelektual dari pihak ketiga atas karya yang diunggah oleh Kreator, maka **Kreator bertanggung jawab penuh secara pribadi, perdata, maupun pidana**, serta membebaskan Pengelola Asisten Guru dari segala tuntutan hukum, denda, maupun kerugian finansial.

---

## PASAL 4: HARGA PRODUK, SKEMA BAGI HASIL & PENCAIRAN DANA

1. **Penentuan Harga Jual:** Kreator memiliki kebebasan menentukan harga jual produknya sendiri dengan mengikuti batas harga minimum sebesar **[Rp10.000]** per produk yang ditetapkan oleh sistem Platform.
2. **Proporsi Bagi Hasil (Royalti Kemitraan):** Atas setiap transaksi produk yang berhasil dibayarkan secara sah oleh Pembeli, perhitungan bagi hasilnya adalah sebagai berikut:
   * **Hak Bagi Hasil Kreator:** Sebesar **[85%]** dari Harga Jual bersih produk.
   * **Biaya Layanan & Pemeliharaan Platform:** Sebesar **[15%]** dari Harga Jual bersih produk.
   * *Catatan Biaya Transaksi:* Biaya layanan gerbang pembayaran (*Payment Gateway Fee* seperti QRIS/Virtual Account) dibebankan kepada Pembeli saat checkout atau dipotong secara transparan sebelum perhitungan bagi hasil.
3. **Masa Tunggu Kliring (*Holding Period*):** Untuk melindungi Pembeli dari risiko kegagalan unduhan, tautan rusak, atau ketidaksesuaian produk digital, dana bagi hasil dari setiap transaksi baru akan dicatat pada status **"Saldo Tertahan"** selama **3x24 jam (3 hari kalender)** sejak pembayaran terverifikasi. Apabila tidak terdapat pengajuan komplain yang sah dari Pembeli dalam kurun waktu tersebut, dana akan otomatis berpindah ke **"Saldo Aktif"**.
4. **Mekanisme Pencairan Dana (*Payout/Disbursement*):**
   * Pencairan dana merupakan penyaluran royalti/bagi hasil kemitraan secara berkala dan **bukan** merupakan layanan penyimpanan dana perbankan atau uang elektronik.
   * Batas minimum pengajuan pencairan dari Saldo Aktif adalah sebesar **[Rp50.000]**.
   * Pencairan dana diproses secara kolektif dan terjadwal pada **Setiap Hari Jumat** atau **Setiap Tanggal 1 dan 15** pada jam kerja operasional.
   * Biaya administrasi transfer antar-bank (sesuai tarif BI-Fast, berkisar antara Rp2.500 – Rp6.500) akan dipotong langsung dari nominal dana yang dicairkan.
5. **Kewajiban Perpajakan:** Masing-masing pihak bertanggung jawab atas kewajiban perpajakannya sesuai ketentuan hukum yang berlaku di Republik Indonesia.

---

## PASAL 5: KEBIJAKAN KOMPLAIN & PENGEMBALIAN DANA (*REFUND*)

1. **Prinsip Penjualan Final:** Mengingat sifat produk digital yang dapat langsung diakses, diunduh, dan digandakan oleh Pembeli begitu pembayaran selesai, maka **seluruh transaksi bersifat final dan tidak dapat dikembalikan (*Non-Refundable*)**.
2. **Pengecualian Kondisi *Refund*:** Pembeli berhak mengajukan komplain dalam masa tunggu **3x24 jam** apabila:
   * File terbukti rusak (*corrupt*), kosong, atau tautan mati.
   * Isi dokumen sangat menyimpang secara substansial dari judul dan deskripsi.
3. **Prosedur Penyelesaian:** Kreator diberikan waktu maksimal **2x24 jam** untuk memperbaiki file yang rusak atau memberikan klarifikasi resmi.

---

## PASAL 6: LARANGAN TRANSAKSI DI LUAR PLATFORM (*ANTI-BYPASS*)

1. Kreator **dilarang keras** mencantumkan nomor telepon pribadi, tautan WhatsApp langsung, nomor rekening pribadi, atau kode QR pribadi untuk bertransaksi di luar sistem demi menghindari skema bagi hasil Platform.
2. Pelanggaran atas ketentuan ini akan dikenakan tindakan tegas berupa pembekuan akun dan penurunan produk secara sepihak.

---

## PASAL 7: SANKSI PELANGGARAN & PENGHENTIAN KEMITRAAN

1. Asisten Guru berhak menurunkan produk (*takedown*), menangguhkan akses akun sementara, hingga memutus kemitraan secara permanen apabila Kreator terbukti melakukan plagiarisme, manipulasi transaksi fiktif, atau menerima komplain berulang.
2. Sisa saldo akun yang dibekukan akibat penipuan/plagiarisme dapat ditahan untuk kompensasi kepada pihak yang dirugikan.

---

## PASAL 8: KEBIJAKAN PRIVASI & PERLINDUNGAN DATA SENSITIF (UU PDP NO. 27/2022)

Sebagai Pengendali dan Pemroses Data Pribadi, Platform Asisten Guru berkomitmen menjunjung tinggi hak privasi dan kerahasiaan data seluruh Mitra Kreator sesuai Undang-Undang Republik Indonesia No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP).

1. **Kategori Data yang Dikumpulkan:**
   * **Data Pribadi Umum:** Nama lengkap, alamat surat elektronik (*email*), foto profil/avatar, tautan portofolio, dan akun media sosial yang diperoleh secara sah melalui autentikasi Akun Asisten Guru (SSO Hub) atau pendaftaran mandiri.
   * **Data Pribadi Spesifik / Sensitif (Data Keuangan Pribadi):** Nama bank, nomor rekening bank, dan nama lengkap pemilik rekening sesuai buku tabungan/KTP (sebagaimana diatur dalam Pasal 4 ayat (2) huruf f UU PDP).
   * **Materi Portofolio Kurasi:** Contoh foto produk digital (maksimal 5 file foto dengan ukuran maksimal 1 MB per file) yang diunggah oleh calon Kreator saat mengajukan kemitraan.
2. **Tujuan Spesifik Pemrosesan Data (*Purpose Limitation*):**
   * **Data Rekening Bank:** HANYA digunakan untuk verifikasi keabsahan identitas mitra guna mencegah penipuan perbankan (*anti-fraud* & *KYC*) serta penyaluran dana bagi hasil (*payout disbursement*) penjualan karya digital milik Kreator.
   * **Contoh Foto Produk Kurasi:** HANYA digunakan oleh tim kurator Super Admin sebagai instrumen evaluasi standar mutu, relevansi edukasi, dan kelayakan katalog sebelum status akun Kreator disetujui untuk mulai mempublikasikan karya ke etalase utama.
3. **Prinsip Kerahasiaan & Non-Disclosure (Data Isolation):**
   * Platform menjamin bahwa data rekening bank dan data keuangan Kreator **TIDAK AKAN PERNAH** ditampilkan secara publik, tidak dibagikan kepada Pembeli (*Buyer*), dan tidak akan dialihkan atau diperjualbelikan kepada pihak ketiga mana pun untuk tujuan periklanan atau komersialisasi di luar ekosistem Asisten Guru.
   * Hak Cipta dan kepemilikan moral atas contoh foto produk yang diunggah tetap sepenuhnya milik Kreator. Platform tidak akan menjual atau mengklaim kepemilikan atas sampel foto kurasi tersebut.
4. **Keamanan Penyimpanan Data (*Security Safeguards*):**
   * Seluruh pertukaran data antara perangkat Kreator dan peladen Platform dilindungi menggunakan protokol enkripsi standar industri (*Transport Layer Security/TLS*).
   * Data disimpan pada basis data terenkripsi (*Cloudflare D1 & R2 Object Storage*) dengan kontrol akses terbatas (*Role-Based Access Control*) yang hanya dapat diakses oleh Administrator Terotorisasi.
5. **Hak-Hak Subjek Data Pribadi:**
   Sesuai Pasal 5 hingga Pasal 13 UU PDP, Kreator berhak mengakses, memperbaiki data rekening atau profil toko, serta mengajukan penutupan akun kemitraan dan penghapusan data rekening setelah seluruh kewajiban hak bagi hasil selesai diproses.

---

## PASAL 9: HUKUM YANG BERLAKU

Syarat dan Ketentuan ini diatur dan ditafsirkan berdasarkan hukum Negara Kesatuan Republik Indonesia. Segala perselisihan akan diselesaikan terlebih dahulu secara musyawarah untuk mufakat.
',
    1,
    1,
    CURRENT_TIMESTAMP
)
ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    content = excluded.content,
    is_published = 1,
    updated_at = CURRENT_TIMESTAMP;

-- 3. Masukkan / Perbarui Dokumen Kebijakan Privasi & PDP
INSERT INTO legal_documents (id, title, content, version, is_published, updated_at)
VALUES (
    'seller_privacy',
    'Kebijakan Privasi & Perlindungan Data Sensitif Kemitraan Kreator',
    '# KEBIJAKAN PRIVASI & PERLINDUNGAN DATA SENSITIF KEMITRAAN KREATOR ASISTEN GURU

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
',
    1,
    1,
    CURRENT_TIMESTAMP
)
ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    content = excluded.content,
    is_published = 1,
    updated_at = CURRENT_TIMESTAMP;

-- 4. Catat ke Tabel Riwayat Revisi Awal
INSERT INTO legal_document_revisions (document_id, version, title, content, change_summary, created_by, created_at)
VALUES 
(
    'seller_terms',
    1,
    'Syarat dan Ketentuan Program Kemitraan Kreator Asisten Guru',
    '# SYARAT DAN KETENTUAN PROGRAM KEMITRAAN KREATOR ASISTEN GURU

**Terakhir Diperbarui:** 17 Oktober 2026  
**Platform Resmi:** [https://asisten-guru.id/toko](https://asisten-guru.id/toko)

Selamat datang di Program Kemitraan Kreator **Asisten Guru** (\`https://asisten-guru.id/toko\`). Dokumen Syarat dan Ketentuan ("Ketentuan") ini merupakan perjanjian yang mengikat secara hukum antara Anda ("Kreator" atau "Mitra Kontributor") dan Pengelola Platform **Asisten Guru** ("Kami" atau "Platform"). 

Dengan mendaftarkan diri sebagai Kreator, mencentang kotak persetujuan pada formulir pendaftaran, dan/atau mengunggah karya digital ke Platform Kami, Anda menyatakan telah membaca, memahami, dan menyetujui seluruh isi Ketentuan ini tanpa terkecuali.

---

## PASAL 1: DEFINISI & RUANG LINGKUP KEMITRAAN

1. **Model Kemitraan:** Hubungan hukum antara Asisten Guru dan Kreator adalah **Kemitraan Publikasi dan Bagi Hasil Karya Digital (Konsinyasi Digital)**. Hubungan ini bukan merupakan hubungan kerja (karyawan-pemberi kerja), persekutuan perdata, keagenan eksklusif, maupun kegiatan penghimpunan dana perbankan/uang elektronik.
2. **Peran Kreator:** Pihak independen (guru, pendidik, akademisi, atau praktisi pendidikan) yang menyusun, memiliki hak cipta penuh, dan menyerahkan produk digital edukasi untuk dipasarkan serta didistribusikan melalui katalog Platform \`asisten-guru.id/toko\`.
3. **Peran Platform:** Penyedia infrastruktur katalog digital, kurator standar mutu & visual, pengelola promosi ekosistem, serta fasilitator pemrosesan pembayaran dari Pembeli (Pengguna Akhir).
4. **Produk Digital:** Segala bentuk perangkat ajar, Modul Ajar, RPP, LKPD, bank soal, asesmen, media pembelajaran interaktif, *template* administrasi guru, maupun aset digital edukasi lainnya yang diunggah dalam format elektronik (PDF, DOCX, XLSX, PPTX, atau tautan terintegrasi seperti Canva/Google Workspace).

---

## PASAL 2: PERSYARATAN AKUN & VERIFIKASI KREATOR

1. **Kualifikasi Pendaftaran:** Kreator wajib berusia minimal 18 (delapan belas) tahun atau telah cakap secara hukum menurut peraturan perundang-undangan di Republik Indonesia, serta wajib memberikan informasi identitas yang akurat, lengkap, dan dapat dipertanggungjawabkan pada saat proses pengajuan (*Creator Onboarding*).
2. **Kurasi & Persetujuan Akun:** Pengelola Platform memiliki hak penuh untuk melakukan verifikasi atas pengajuan akun Kreator dan contoh portofolio karya yang dilampirkan. Platform berhak menerima atau menolak pengajuan tanpa kewajiban memberikan alasan teknis secara terperinci.
3. **Kesesuaian Data Rekening Pencairan:** Nama pemilik rekening bank atau dompet digital (*e-wallet*) yang didaftarkan untuk penerimaan dana bagi hasil **wajib sama persis** dengan nama lengkap Kreator yang tertera pada profil identitas resmi. Demi kepatuhan terhadap prinsip pencegahan penipuan dan pencucian uang, Kami berhak menolak pencairan dana ke rekening milik pihak ketiga.
4. **Keamanan & Tanggung Jawab Akun:** Kreator bertanggung jawab penuh untuk menjaga kerahasiaan kredensial akses akunnya (termasuk akses melalui autentikasi pihak ketiga/OAuth). Segala aktivitas pengunggahan dokumen, perubahan harga, maupun permohonan pencairan dana yang dilakukan melalui akun Kreator dianggap sebagai tindakan sah dari Kreator tersebut.

---

## PASAL 3: STANDAR KUALITAS, KURASI & HAK KEKAYAAN INTELEKTUAL (HKI)

1. **Kepemilikan Hak Cipta:** Hak Cipta moral dan ekonomi atas karya digital yang diunggah **tetap sepenuhnya menjadi milik Kreator**. Dengan mengunggah karya ke Platform, Kreator memberikan lisensi non-eksklusif kepada Asisten Guru untuk menampilkan, memasarkan, memotong cuplikan pratinjau (*preview/watermark*), mempromosikan di media sosial resmi, dan mendistribusikan karya tersebut kepada Pembeli.
2. **Jaminan Orisinalitas (Anti-Plagiarisme):** Kreator menjamin sepenuhnya bahwa setiap karya yang diunggah adalah **100% karya orisinal hasil penyusunan sendiri** atau karya yang telah memiliki lisensi distribusi komersial yang sah.
3. **Daftar Konten Terlarang:** Kreator dilarang keras mengunggah dan memperjualbelikan:
   * Buku elektronik (PDF/hasil pindai cetak) milik penerbit komersial maupun buku terbitan pemerintah/kementerian yang mencantumkan larangan untuk diperjualbelikan kembali.
   * Karya milik guru lain, komunitas pendidikan, atau instansi lain tanpa izin tertulis resmi (plagiarisme maupun pengemasan ulang/*re-upload* tanpa hak).
   * Aset desain, ilustrasi, *font*, atau elemen pihak ketiga (termasuk elemen berbayar dari platform desain pihak ketiga) yang melanggar ketentuan lisensi penjualan ulang (*resell license*) dari penyedia aslinya.
   * Dokumen yang rusak (*corrupt*), kosong, terkunci kata sandi tanpa keterangan, mengandung kode berbahaya (*malware/virus*), atau memiliki isi yang jauh menyimpang dari judul dan deskripsi produk.
4. **Standar Kurasi & Identitas Visual:** Demi menjaga standar kualitas mutu dan keselarasan estetika \`asisten-guru.id/toko\`, seluruh produk yang diunggah akan melewati tahap **Peninjauan Admin (*In-Review*)**. Platform berhak untuk:
   * Mewajibkan penggunaan rasio gambar sampul (*cover*) **4:3** dengan tata letak yang rapi dan terbaca jelas sesuai panduan Kreator.
   * Menolak publikasi, meminta revisi isi/sampul, atau merapikan format penulisan judul/deskripsi sebelum produk ditayangkan ke publik.
5. **Pelepasan Tanggung Jawab Hukum (*Indemnification*):** Apabila di kemudian hari timbul klaim, somasi, tuntutan hukum, atau sengketa pelanggaran Hak Kekayaan Intelektual dari pihak ketiga atas karya yang diunggah oleh Kreator, maka **Kreator bertanggung jawab penuh secara pribadi, perdata, maupun pidana**, serta membebaskan Pengelola Asisten Guru dari segala tuntutan hukum, denda, maupun kerugian finansial.

---

## PASAL 4: HARGA PRODUK, SKEMA BAGI HASIL & PENCAIRAN DANA

1. **Penentuan Harga Jual:** Kreator memiliki kebebasan menentukan harga jual produknya sendiri dengan mengikuti batas harga minimum sebesar **[Rp10.000]** per produk yang ditetapkan oleh sistem Platform.
2. **Proporsi Bagi Hasil (Royalti Kemitraan):** Atas setiap transaksi produk yang berhasil dibayarkan secara sah oleh Pembeli, perhitungan bagi hasilnya adalah sebagai berikut:
   * **Hak Bagi Hasil Kreator:** Sebesar **[85%]** dari Harga Jual bersih produk.
   * **Biaya Layanan & Pemeliharaan Platform:** Sebesar **[15%]** dari Harga Jual bersih produk.
   * *Catatan Biaya Transaksi:* Biaya layanan gerbang pembayaran (*Payment Gateway Fee* seperti QRIS/Virtual Account) dibebankan kepada Pembeli saat checkout atau dipotong secara transparan sebelum perhitungan bagi hasil.
3. **Masa Tunggu Kliring (*Holding Period*):** Untuk melindungi Pembeli dari risiko kegagalan unduhan, tautan rusak, atau ketidaksesuaian produk digital, dana bagi hasil dari setiap transaksi baru akan dicatat pada status **"Saldo Tertahan"** selama **3x24 jam (3 hari kalender)** sejak pembayaran terverifikasi. Apabila tidak terdapat pengajuan komplain yang sah dari Pembeli dalam kurun waktu tersebut, dana akan otomatis berpindah ke **"Saldo Aktif"**.
4. **Mekanisme Pencairan Dana (*Payout/Disbursement*):**
   * Pencairan dana merupakan penyaluran royalti/bagi hasil kemitraan secara berkala dan **bukan** merupakan layanan penyimpanan dana perbankan atau uang elektronik.
   * Batas minimum pengajuan pencairan dari Saldo Aktif adalah sebesar **[Rp50.000]**.
   * Pencairan dana diproses secara kolektif dan terjadwal pada **Setiap Hari Jumat** atau **Setiap Tanggal 1 dan 15** pada jam kerja operasional.
   * Biaya administrasi transfer antar-bank (sesuai tarif BI-Fast, berkisar antara Rp2.500 – Rp6.500) akan dipotong langsung dari nominal dana yang dicairkan.
5. **Kewajiban Perpajakan:** Masing-masing pihak bertanggung jawab atas kewajiban perpajakannya sesuai ketentuan hukum yang berlaku di Republik Indonesia.

---

## PASAL 5: KEBIJAKAN KOMPLAIN & PENGEMBALIAN DANA (*REFUND*)

1. **Prinsip Penjualan Final:** Mengingat sifat produk digital yang dapat langsung diakses, diunduh, dan digandakan oleh Pembeli begitu pembayaran selesai, maka **seluruh transaksi bersifat final dan tidak dapat dikembalikan (*Non-Refundable*)**.
2. **Pengecualian Kondisi *Refund*:** Pembeli berhak mengajukan komplain dalam masa tunggu **3x24 jam** apabila:
   * File terbukti rusak (*corrupt*), kosong, atau tautan mati.
   * Isi dokumen sangat menyimpang secara substansial dari judul dan deskripsi.
3. **Prosedur Penyelesaian:** Kreator diberikan waktu maksimal **2x24 jam** untuk memperbaiki file yang rusak atau memberikan klarifikasi resmi.

---

## PASAL 6: LARANGAN TRANSAKSI DI LUAR PLATFORM (*ANTI-BYPASS*)

1. Kreator **dilarang keras** mencantumkan nomor telepon pribadi, tautan WhatsApp langsung, nomor rekening pribadi, atau kode QR pribadi untuk bertransaksi di luar sistem demi menghindari skema bagi hasil Platform.
2. Pelanggaran atas ketentuan ini akan dikenakan tindakan tegas berupa pembekuan akun dan penurunan produk secara sepihak.

---

## PASAL 7: SANKSI PELANGGARAN & PENGHENTIAN KEMITRAAN

1. Asisten Guru berhak menurunkan produk (*takedown*), menangguhkan akses akun sementara, hingga memutus kemitraan secara permanen apabila Kreator terbukti melakukan plagiarisme, manipulasi transaksi fiktif, atau menerima komplain berulang.
2. Sisa saldo akun yang dibekukan akibat penipuan/plagiarisme dapat ditahan untuk kompensasi kepada pihak yang dirugikan.

---

## PASAL 8: KEBIJAKAN PRIVASI & PERLINDUNGAN DATA SENSITIF (UU PDP NO. 27/2022)

Sebagai Pengendali dan Pemroses Data Pribadi, Platform Asisten Guru berkomitmen menjunjung tinggi hak privasi dan kerahasiaan data seluruh Mitra Kreator sesuai Undang-Undang Republik Indonesia No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP).

1. **Kategori Data yang Dikumpulkan:**
   * **Data Pribadi Umum:** Nama lengkap, alamat surat elektronik (*email*), foto profil/avatar, tautan portofolio, dan akun media sosial yang diperoleh secara sah melalui autentikasi Akun Asisten Guru (SSO Hub) atau pendaftaran mandiri.
   * **Data Pribadi Spesifik / Sensitif (Data Keuangan Pribadi):** Nama bank, nomor rekening bank, dan nama lengkap pemilik rekening sesuai buku tabungan/KTP (sebagaimana diatur dalam Pasal 4 ayat (2) huruf f UU PDP).
   * **Materi Portofolio Kurasi:** Contoh foto produk digital (maksimal 5 file foto dengan ukuran maksimal 1 MB per file) yang diunggah oleh calon Kreator saat mengajukan kemitraan.
2. **Tujuan Spesifik Pemrosesan Data (*Purpose Limitation*):**
   * **Data Rekening Bank:** HANYA digunakan untuk verifikasi keabsahan identitas mitra guna mencegah penipuan perbankan (*anti-fraud* & *KYC*) serta penyaluran dana bagi hasil (*payout disbursement*) penjualan karya digital milik Kreator.
   * **Contoh Foto Produk Kurasi:** HANYA digunakan oleh tim kurator Super Admin sebagai instrumen evaluasi standar mutu, relevansi edukasi, dan kelayakan katalog sebelum status akun Kreator disetujui untuk mulai mempublikasikan karya ke etalase utama.
3. **Prinsip Kerahasiaan & Non-Disclosure (Data Isolation):**
   * Platform menjamin bahwa data rekening bank dan data keuangan Kreator **TIDAK AKAN PERNAH** ditampilkan secara publik, tidak dibagikan kepada Pembeli (*Buyer*), dan tidak akan dialihkan atau diperjualbelikan kepada pihak ketiga mana pun untuk tujuan periklanan atau komersialisasi di luar ekosistem Asisten Guru.
   * Hak Cipta dan kepemilikan moral atas contoh foto produk yang diunggah tetap sepenuhnya milik Kreator. Platform tidak akan menjual atau mengklaim kepemilikan atas sampel foto kurasi tersebut.
4. **Keamanan Penyimpanan Data (*Security Safeguards*):**
   * Seluruh pertukaran data antara perangkat Kreator dan peladen Platform dilindungi menggunakan protokol enkripsi standar industri (*Transport Layer Security/TLS*).
   * Data disimpan pada basis data terenkripsi (*Cloudflare D1 & R2 Object Storage*) dengan kontrol akses terbatas (*Role-Based Access Control*) yang hanya dapat diakses oleh Administrator Terotorisasi.
5. **Hak-Hak Subjek Data Pribadi:**
   Sesuai Pasal 5 hingga Pasal 13 UU PDP, Kreator berhak mengakses, memperbaiki data rekening atau profil toko, serta mengajukan penutupan akun kemitraan dan penghapusan data rekening setelah seluruh kewajiban hak bagi hasil selesai diproses.

---

## PASAL 9: HUKUM YANG BERLAKU

Syarat dan Ketentuan ini diatur dan ditafsirkan berdasarkan hukum Negara Kesatuan Republik Indonesia. Segala perselisihan akan diselesaikan terlebih dahulu secara musyawarah untuk mufakat.
',
    'Inisialisasi naskah resmi perdana dari berkas sistem',
    'super_admin',
    CURRENT_TIMESTAMP
),
(
    'seller_privacy',
    1,
    'Kebijakan Privasi & Perlindungan Data Sensitif Kemitraan Kreator',
    '# KEBIJAKAN PRIVASI & PERLINDUNGAN DATA SENSITIF KEMITRAAN KREATOR ASISTEN GURU

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
',
    'Inisialisasi naskah resmi perdana dari berkas sistem',
    'super_admin',
    CURRENT_TIMESTAMP
);
