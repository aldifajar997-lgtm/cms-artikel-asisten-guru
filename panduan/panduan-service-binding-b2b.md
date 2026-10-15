# Panduan Integrasi Backend-to-Backend (Service Bindings)

Karena backend CMS3 ini berjalan di atas Cloudflare Workers, Anda bisa melakukan penarikan data secara instan dari aplikasi frontend Anda (jika frontend di-hosting di Cloudflare Pages atau Cloudflare Workers) **tanpa perlu melewati internet publik**.

Fitur ini disebut **Service Bindings**. Metode ini menjamin:
1. **Lebih Cepat:** Mengurangi latensi DNS dan jaringan, karena berjalan di jaringan fiber internal Cloudflare.
2. **Lebih Aman:** Trafik tidak pernah keluar dari infrastruktur Cloudflare.
3. **Nol Perubahan di CMS3:** Backend CMS saat ini sudah mendukung Service Bindings tanpa mengubah baris kode apa pun!

---

## 1. Konfigurasi di Frontend (`wrangler.toml` / Cloudflare Dashboard)

### Jika Frontend Menggunakan `wrangler.toml`
Buka file `wrangler.toml` pada repositori frontend Anda (misal `asisten-guru hub`), lalu tambahkan blok berikut:

```toml
services = [
  { binding = "CMS_API", service = "cms3" } # "cms3" harus sesuai dengan nama worker di backend
]
```

### Jika Frontend Menggunakan Cloudflare Pages
1. Buka Dasbor Cloudflare -> Pilih proyek Pages Anda.
2. Ke menu **Settings** -> **Functions** -> **Service bindings**.
3. Tambahkan binding baru:
   - **Variable name:** `CMS_API`
   - **Service:** Pilih `cms3` (Worker backend Anda).
   - **Environment:** Pilih `production`.

---

## 2. Cara Menarik Data (Fetch) di Frontend

Alih-alih menembak URL publik `https://cms.asisten-guru.my.id/api/...`, Anda akan menggunakan variabel lingkungan (`env`) untuk memanggil API secara lokal.

### Contoh di Cloudflare Pages Functions / API Routes Remix / Next.js Edge

```typescript
export async function onRequest(context) {
  const { env } = context; // Ambil env binding

  try {
    // Memanggil API posts/public secara internal
    // Catatan: Gunakan dummy domain seperti 'http://internal' karena host aslinya akan di-bypass
    const response = await env.CMS_API.fetch(
      new Request('http://internal/api/posts/public?limit=5')
    );
    
    if (!response.ok) {
        throw new Error('Gagal mengambil artikel dari CMS');
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
```

### 3. Menggunakan Service Bindings Bersamaan dengan Aplikasi Client-Side (React/Vite)

Jika aplikasi `asisten-guru hub` Anda berjalan sebagai React SPA murni di browser (Client-Side), *Service Binding tidak bisa dipanggil langsung dari dalam file komponen `.tsx` di browser*. 

Untuk hal tersebut, Anda perlu membuat jembatan (API Route / Cloudflare Pages Functions). 
1. Buat file `functions/api/get-articles.ts` di direktori frontend.
2. Tulis kode B2B seperti di atas.
3. Di dalam komponen React (`BlogDetail.tsx`), panggil API jembatan tersebut:
   ```typescript
   // fetch ini dilakukan di browser
   const response = await fetch('/api/get-articles');
   const data = await response.json();
   ```

---
**Peringatan Tambahan:**
Saat menarik endpoint internal CMS yang dilindungi autentikasi atau khusus Admin (bukan publik), Anda tetap harus menyertakan header `Authorization: Bearer <TOKEN>` pada `Request` object Service Binding seperti biasa.
