# Worker Reverse Proxy: mitra.asisten-guru.id

Worker ini berfungsi sebagai **Edge Reverse Proxy & Domain Masking** untuk portal mitra seller Asisten Guru.

## Tujuan Utama
- Pengguna **hanya melihat dan mengakses** domain utama: `https://mitra.asisten-guru.id`.
- Hosting asli di `mitra.asisten-guru.my.id` dan backend di `cms.asisten-guru.my.id` diselubungi sepenuhnya di layer edge Cloudflare.
- Rute `/api/*` diteruskan ke backend CMS secara **Same-Origin** sehingga cookie sesi `refresh_token` (`HttpOnly, Secure, SameSite=Strict`) terkirim tanpa kendala 3rd-party cookie blocking.
- Menangani **SPA Routing Fallback** (Single Page App React) secara otomatis.

---

## Variabel Environment
Didefinisikan di `wrangler.jsonc`:
- `ORIGIN_UI`: `"mitra.asisten-guru.my.id"` (Hosting UI-Mitra di Akun Cloudflare A)
- `ORIGIN_API`: `"cms.asisten-guru.my.id"` (Backend CMS di Akun Cloudflare A)

---

## Cara Deploy ke Akun Cloudflare B (Domain asisten-guru.id)

1. Pastikan Anda telah login ke akun Cloudflare yang mengelola domain `asisten-guru.id`:
   ```bash
   npx wrangler login
   ```

2. Jalankan perintah deploy dari dalam folder ini:
   ```bash
   npx wrangler deploy
   ```

3. Pada Cloudflare Dashboard akun `asisten-guru.id`:
   - Buka menu **Workers & Pages** -> Pilih **worker-mitra-asisten-guru**.
   - Buka tab **Settings** -> **Domains & Routes** -> Pastikan rute atau custom domain telah terpasang ke:
     `mitra.asisten-guru.id`
   - Pastikan status DNS menunjukkan **Proxied (Orange Cloud)**.
