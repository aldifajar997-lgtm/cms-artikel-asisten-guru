# Panduan Konfigurasi Keamanan Cloudflare (WAF & Bot Fight Mode)

Agar aplikasi CMS dan Frontend Anda aman dari serangan *hijacking*, *brute-force*, atau *DDoS*, sangat disarankan untuk memanfaatkan fitur keamanan bawaan Cloudflare. 

Tantangan utamanya adalah: **Bagaimana cara memblokir bot jahat, tetapi tetap membiarkan bot mesin pencari (Googlebot, Bingbot) merayapi (crawling/menggerayangi) konten kita agar SEO tetap bagus?**

Ikuti panduan konfigurasi Cloudflare berikut ini.

---

## 1. Mengaktifkan Bot Fight Mode
Cloudflare memiliki database kecerdasan buatan untuk mendeteksi mana bot jahat (scraper/spammer) dan mana bot baik (mesin pencari / Verified Bots).

**Langkah-langkah:**
1. Login ke [Cloudflare Dashboard](https://dash.cloudflare.com) dan pilih domain Anda.
2. Di menu sebelah kiri, masuk ke **Security** > **Bots**.
3. Aktifkan toggle **Bot Fight Mode**. 
   - *Catatan:* Jika Anda menggunakan paket Free, ini hanya saklar On/Off. Jika Anda menggunakan paket Pro/Business (Super Bot Fight Mode), atur *Definitely automated* ke **Challenge** atau **Block**, dan pastikan *Verified bots* diatur ke **Allow**.

> 💡 **Kabar Baik untuk SEO:** Cloudflare secara otomatis telah *memasukkan (whitelist)* bot mesin pencari populer (Google, Bing, Yandex, Yahoo) ke dalam daftar **Verified Bots**. Bot Fight Mode **TIDAK AKAN** memblokir bot SEO ini, sehingga artikel Anda tetap akan terindeks dengan lancar.

---

## 2. Membuat WAF Custom Rules (Aturan Firewall)
Kita perlu membuat aturan spesifik (WAF) agar area sensitif (seperti halaman login atau API) terlindungi berlapis, namun halaman publik untuk SEO dibiarkan terbuka cepat.

Buka menu **Security** > **WAF** > tab **Custom rules**, lalu klik **Create rule**.

### Aturan A: Memberi Jalur Khusus Bot Terverifikasi (Opsional tapi Disarankan)
Meskipun Cloudflare sudah pintar, kita bisa menegaskan aturan agar *Verified Bots* melewati semua filter keamanan tambahan kita.

- **Rule name:** `Allow SEO Bots`
- **Field:** `Known Bots` | **Operator:** `equals` | **Value:** `On`
- **Action:** `Skip` (Lalu centang semua opsi *WAF components* agar bot bebas masuk).
- Klik **Deploy**.

### Aturan B: Melindungi Endpoint Login & Registrasi dari Hijacking
Bagian API otentikasi rentan diserang *brute-force* atau *credential stuffing*. Kita pasang *JS Challenge* atau *Managed Challenge* untuk akses mencurigakan yang mengarah ke login.

- **Rule name:** `Protect Auth API`
- **Expression Builder:**
  - **Field:** `URI Path` | **Operator:** `contains` | **Value:** `/api/auth/`
  - Klik **And**
  - **Field:** `Known Bots` | **Operator:** `equals` | **Value:** `Off` (Bot tak dikenal)
- **Action:** `Managed Challenge` (Mendeteksi manusia/bot di latar belakang sebelum membiarkan akses).
- Klik **Deploy**.

---

## 3. Konfigurasi Rate Limiting (Mencegah Serangan Spam)
API kita sudah memiliki *rate limiting* di dalam kode (Hono Rate Limiter). Namun, memblokir langsung di *Edge Network* Cloudflare akan sangat menghemat biaya _server/worker_ Anda.

Jika domain Anda mendukung *Rate Limiting Rules* (di Security > WAF > Rate limiting rules):
1. Buat aturan baru untuk endpoint publik berat, misal: `/api/products/public*`.
2. Jika ada satu IP meminta lebih dari 100 request dalam 1 menit, berikan aksi **Block** atau **Managed Challenge**.

---

## 4. Keamanan TLS/SSL (Strict Mode)
Pastikan enkripsi antara Cloudflare dan Workers/Server Anda terlindungi sepenuhnya agar tidak disadap (*hijacking/man-in-the-middle*).

1. Pergi ke menu **SSL/TLS** > **Overview**.
2. Ubah enkripsi ke mode **Full (strict)**. Karena backend kita menggunakan Cloudflare Workers (D1), SSL ditangani secara internal dan aman secara otomatis.
3. Di menu **SSL/TLS** > **Edge Certificates**, aktifkan **Always Use HTTPS** dan aktifkan **HTTP Strict Transport Security (HSTS)** (Centang opsi perlindungan selama 6-12 bulan).

---

## Kesimpulan Alur (*Traffic Flow*)

Dengan pengaturan di atas, inilah yang akan terjadi pada pengunjung website Anda:
1. **Googlebot / Bingbot datang:** Dikenali oleh `Known Bots = On`. Cloudflare mempersilakan masuk tanpa tes/captcha. Konten Anda sukses di-*crawling*.
2. **Bot Jahat / Hacker datang:** Mencoba *brute-force* ke `/api/auth/login`. Dikenali sebagai _unverified bot_. Mereka akan langsung dihadang halaman *Cloudflare Challenge* atau ditendang oleh *Rate Limiter*.
3. **Pengunjung Manusia Asli:** Masuk membaca artikel, sistem tidak memberikan CAPTCHA yang mengganggu. Pengalaman pengguna tetap lancar.

Penerapan *Cloudflare Security* ini dikombinasikan dengan *Turnstile* (di Frontend) menjadikan aplikasi CMS Anda **kebal terhadap serangan umum** tanpa mengorbankan _Search Engine Optimization_ (SEO)!
