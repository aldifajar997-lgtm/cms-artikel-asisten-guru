# UI-Mitra — Portal Mitra Kreator & Seller Digital Asisten Guru

<p align="center">
  <img src="../logo3.svg" alt="Asisten Guru Mitra Logo" width="180" />
</p>

<p align="center">
  Platform khusus bagi <b>Mitra Kreator & Guru Penjual</b> materi edukasi digital di ekosistem Asisten Guru. Didesain dengan estetika modern <i>Swiss-Minimalist</i>, mengutamakan kemudahan navigasi, kejelasan data keuangan, serta kebebasan personalisasi etalase toko digital.
</p>

---

## 🎯 Ikhtisar Aplikasi

`UI-Mitra` adalah frontend SPA (Single Page Application) mandiri berbasis **React 19 + Vite + Tailwind CSS v4**. Aplikasi ini diakses oleh mitra di domain `mitra.asisten-guru.id` (melalui reverse proxy `worker-mitra-asisten-guru`) dan berkomunikasi langsung dengan backend API CMS di `cms.asisten-guru.my.id/api`.

### Fitur & Tanggung Jawab Utama:
1. **Onboarding Mitra Baru:** Alur pendaftaran mitra (data diri, NIK, nomor WhatsApp terverifikasi, persetujuan syarat & ketentuan kemitraan).
2. **Dashboard Finansial Real-Time:** Ringkasan pendapatan bersih, saldo yang dapat ditarik (*withdrawable*), saldo dalam penahanan sementara (*holding period* untuk proteksi dispute), grafik analitik penjualan, dan simulator kalkulator potongan fee platform.
3. **Pencairan Dana (Withdrawals):** Pengajuan penarikan dana ke rekening bank / e-wallet resmi dengan riwayat status audit transparan.
4. **Manajemen Produk Materi Edukasi:** Pembuatan, pengunggahan berkas digital (modul ajar, Canva template link, dokumen materi), penetapan harga, penetapan diskon, dan pemantauan status kurasi admin.
5. **Kustomisasi Profil & Etalase Toko (Store Profile):** Pengaturan foto sampul (*cover*), avatar, bio guru, media sosial, dan galeri foto kurasi sampel materi.
6. **Store Appearance Studio (Studio Personalisasi Toko):** Mesin konfigurasi tema etalase modular mutakhir untuk mempercantik toko digital guru.
7. **Sistem Slug Seller Permanen (Vanity URL):** Pembuatan tautan unik toko yang eksklusif dan terverifikasi.

---

## 🛍️ Sistem Tautan Toko Personal (Seller Vanity Slug)

Sistem slug toko memberikan URL ramah pengguna untuk etalase publik guru di portal Hub:  
Format tautan: `https://asisten-guru.id/toko/<slug_toko>`

### Aturan & Perilaku Teknis Slug:
- **Hak Akses Khusus Mitra Terverifikasi:** Pembuatan slug toko personal hanya dibuka bagi mitra yang status kurasi akunnya telah **disetujui oleh Super Admin (`isApprovedSeller = true`)**. Mitra yang masih pending approval menggunakan URL berbasis ID publik.
- **Dibuat 1x Seumur Hidup (Permanent Verification):** Demi menjaga integritas tautan produk yang sudah dibagikan mitra ke siswa atau grup guru, slug yang telah disimpan terkunci secara **permanen** (`hasPermanentSlug = true`).
- **Pengecekan Ketersediaan Real-Time (Debounced Validation):**
  - Mengirimkan request ke `GET /api/users/check-slug?slug=<input>` dengan debounce 400ms.
  - Memastikan format valid: huruf kecil, angka, dan tanda hubung (`^[a-z0-9-]+$`), minimal 3 karakter, dan bukan merupakan reserved words (seperti `admin`, `api`, `dashboard`, `toko`).
- **Dialog Konfirmasi Ganda:** Sebelum slug dikunci permanen, seller wajib menyetujui disclaimer bahwa slug tidak dapat diubah kembali di masa mendatang.

---

## 🎨 Store Appearance Studio (Studio Personalisasi Etalase)

Studio ini memungkinkan mitra merancang identitas visual toko layaknya microsite edukasi profesional tanpa koding, dengan live interactive preview. Konfigurasi tersimpan dalam kolom `store_appearance` (JSON) di profil pengguna:

### 1. Preset Tema Edukatif Instan
Tersedia 5 preset tema harmonis siap pakai:
- **Emerald Scholar:** Nuansa hijau zamrud klasik, terpercaya, dan tenang (cocok untuk materi akademik formal).
- **Royal Academy:** Nuansa biru safir premium dan elegan.
- **Sunset Educator:** Nuansa hangat oranye & terakota yang bersahabat dan memotivasi.
- **Minimalist Slate:** Tampilan monokromatik modern, clean, dan profesional.
- **Creative Violet:** Nuansa ungu ekspresif untuk guru seni, media, atau materi kreatif.

### 2. Latar Belakang Fleksibel (Background System)
- **Soft Gradients:** Gradien halus linear dengan kurasi sudut dan kontras aman.
- **Warna Solid:** Pilihan warna hex terverifikasi dengan input pemilih warna kustom.
- **Foto Sampul / Wallpaper Kustom:** Unggah wallpaper toko langsung ke Cloudflare R2 dengan tombol pembersih cepat.

### 3. Smart Contrast Guard & Readability Engine
- **Luminance Calculation:** Secara otomatis menghitung koefisien kecerahan latar (standar ITU-R BT.601) untuk memilih warna teks kontras (`#0f172a` atau `#ffffff`).
- **Glassmorphism Profile Card:** Jika mitra menggunakan wallpaper foto yang ramai, sistem secara otomatis menawarkan tombol satu klik *"✨ Optimalkan Keterbacaan"* yang menyematkan wadah kartu kaca transparan (*backdrop blur*) agar teks profil 100% terbaca jelas.

### 4. Tipografi & Google Fonts Explorer
- Mendukung integrasi dinamis Google Fonts (Inter, Manrope, Plus Jakarta Sans, Outfit, DM Sans, Merriweather, Playfair Display, dll).
- Font Explorer Modal lengkap dengan filter kategori (Sans-Serif, Serif, Display) dan pratinjau teks live.

### 5. Blok Halaman Modular (Section Manager)
Mitra bebas mengaktifkan, menonaktifkan, atau mengubah urutan tampil bagian (*sections order*) menggunakan tombol geser atas-bawah:
- `profile`: Profil, bio guru, avatar, dan lencana terverifikasi.
- `social_links`: Deretan tautan media sosial (Instagram, TikTok, YouTube, LinkedIn, Facebook) dan tombol pintas WhatsApp.
- `video_teaser`: Video YouTube pengantar etalase atau perkenalan karya guru.
- `featured_product`: Penyorotan 1 produk unggulan dengan badge khusus (*pulse animation*).
- `catalog`: Grid/list katalog modul digital yang telah lolos kurasi.
- `faq`: Accordion tanya-jawab interaktif seputar produk, lisensi Canva, dan panduan download.

### 6. Desain Tombol & Interaksi
- Pengaturan radius sudut tombol (*Pill*, *Rounded*, atau *Sharp*).
- Efek hover mikro (Glow, Elevate, Shine, atau Border Shift).

---

## 📂 Struktur Direktori UI-Mitra

```text
UI-Mitra/
├── src/
│   ├── components/
│   │   ├── DashboardMitra.tsx         # Dashboard utama ringkasan finansial & statistik
│   │   ├── MitraOnboardingForm.tsx    # Formulir pendaftaran mitra kreator
│   │   ├── StoreProfile.tsx           # Form profil toko, upload avatar & cover etalase
│   │   ├── ProductList.tsx            # Daftar produk digital seller
│   │   ├── ProductEditor.tsx          # Form tambah & edit modul digital
│   │   ├── TransactionLedger.tsx      # Riwayat transaksi penjualan & komisi
│   │   ├── WithdrawalModal.tsx        # Modal pengajuan penarikan dana
│   │   ├── SellerNetCalculatorModal.tsx # Kalkulator simulator fee & estimasi keuntungan
│   │   ├── BuyerComplaints.tsx        # Penanganan komplain & dispute pembeli
│   │   ├── StoreAppearanceStudio.tsx  # Kontainer utama Studio Personalisasi Toko
│   │   ├── store-appearance/          # Komponen modular Store Appearance
│   │   │   ├── constants.ts           # Preset tema, metadata blok, opsi background
│   │   │   ├── utils.ts               # Algoritma kontras luminansi & styling preview
│   │   │   ├── editor/                # Sub-editor seksi modular:
│   │   │   │   ├── StoreSlugSection.tsx      # Editor Vanity URL toko seller
│   │   │   │   ├── ThemePresetSection.tsx    # Pilihan 5 tema edukatif
│   │   │   │   ├── BackgroundSection.tsx     # Pengaturan warna / wallpaper
│   │   │   │   ├── ButtonSection.tsx         # Kustomisasi tombol & hover
│   │   │   │   ├── TypographySection.tsx     # Pengaturan font & glassmorphism card
│   │   │   │   ├── SectionManagerSection.tsx # Urutan blok modular (reorder)
│   │   │   │   ├── SocialLinksSection.tsx    # Konfigurasi media sosial & WhatsApp
│   │   │   │   ├── VideoTeaserSection.tsx    # Embed video YouTube teaser
│   │   │   │   ├── FeaturedProductSection.tsx # Penyorotan modul unggulan
│   │   │   │   └── FaqSection.tsx            # Tanya-jawab modular (FAQ)
│   │   │   └── modals/
│   │   │       └── FontExplorerModal.tsx     # Dialog browser Google Fonts
│   ├── types.ts                       # Tipe data profil mitra, appearance, produk & ledger
│   ├── App.tsx                        # Routing tab & state global seller
│   └── main.tsx                       # Entry point React Vite
├── package.json
└── README.md
```

---

## ⚠️ Panduan untuk AI Coding Agent & Developer

Sebelum mengubah file apapun di folder `UI-Mitra/`:
1. **Wajib Membaca [Agents.md](../Agents.md):** Pahami aturan non-destruktif sistem live dan larangan membocorkan kredensial.
2. **Kesesuaian dengan Hub:** Tampilan etalase yang dirancang di `StoreAppearanceStudio.tsx` harus kompatibel 1:1 saat dirender oleh frontend publik `asisten-guru hub` di halaman `/toko/:slug`.
3. **Validasi State Appearance:** Selalu sediakan nilai fallback aman menggunakan `BASE_EXTENSIONS` dan preset default jika data `store_appearance` dari database bernilai `null` atau kosong.
4. **Anti-Leakage:** Jangan membocorkan istilah teknis backend pada notifikasi toast, error form, atau label antarmuka. Gunakan bahasa Indonesia yang santun, profesional, dan mudah dipahami guru.
