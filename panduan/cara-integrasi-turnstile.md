# Panduan Integrasi Cloudflare Turnstile di Frontend

Cloudflare Turnstile adalah alternatif CAPTCHA modern yang menjaga privasi dan jauh lebih tidak mengganggu pengguna (seringkali berjalan otomatis di balik layar) untuk melindungi sistem dari serangan bot atau _brute-force_.

Dokumen ini menjelaskan cara memasang Turnstile pada Frontend berbasis React (khususnya Vite).

## 1. Persiapan Environment Variables
Pastikan Anda sudah meletakkan **Site Key** (Kunci Publik) dari Turnstile di file environment frontend Anda (misalnya `.env`).

```env
# File: .env (di project Frontend)
VITE_TURNSTILE_SITE_KEY=0x4AAAAAAEsPegXeoBSVpz4G
```
> **Penting:** *Site Key* memang bersifat publik, jadi aman ditaruh di `.env` frontend. Sebaliknya, *Secret Key* **hanya boleh** ada di Backend.

## 2. Instalasi Library
Agar lebih mudah dan _native_ dengan ekosistem React, Anda bisa menggunakan library _wrapper_ populer, misalnya `@marsidev/react-turnstile`.

Buka terminal di folder Frontend Anda:
```bash
npm install @marsidev/react-turnstile
```

## 3. Menambahkan Widget ke dalam Form
Widget Turnstile harus dipasang di form yang rentan terhadap spam/bot, seperti **Form Login**, **Form Register**, atau **Form Lupa Password**. 

Saat _widget_ berhasil memverifikasi bahwa pengunjung adalah manusia sungguhan, ia akan menghasilkan sebuah **Token Unik**. Token inilah yang harus disisipkan saat mengirim data ke Backend.

**Contoh Kode React (Form Login):**
```tsx
import React, { useState } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // State untuk menyimpan token dari Turnstile
  const [turnstileToken, setTurnstileToken] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Cegah pengiriman form jika Turnstile belum tervalidasi
    if (!turnstileToken) {
      alert("Harap tunggu sebentar, verifikasi keamanan sedang berjalan.");
      return;
    }

    try {
      // Kirim data login ke Backend (CMS)
      const response = await fetch('https://api.cms-anda.com/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          // WAJIB: Sertakan token yang didapat dari widget
          'cf-turnstile-response': turnstileToken 
        })
      });
      
      const result = await response.json();
      if (response.ok) {
        console.log("Login Berhasil!");
      } else {
        console.error("Gagal:", result.message);
      }
    } catch (error) {
      console.error("Terjadi kesalahan:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm">
      <input 
        type="email" 
        value={email} 
        onChange={e => setEmail(e.target.value)} 
        placeholder="Email" 
      />
      
      <input 
        type="password" 
        value={password} 
        onChange={e => setPassword(e.target.value)} 
        placeholder="Password" 
      />
      
      {/* Render Widget Turnstile */}
      <div className="my-2">
        <Turnstile
          siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
          onSuccess={(token) => {
            // Ketika sukses, simpan token ke state
            setTurnstileToken(token);
          }}
          onError={() => {
            console.error('Turnstile mengalami error');
            setTurnstileToken(''); // Reset state jika error
          }}
          onExpire={() => {
            // Token memiliki batas waktu, reset jika kedaluwarsa
            console.warn('Sesi Turnstile berakhir, harap ulangi.');
            setTurnstileToken('');
          }}
        />
      </div>
      
      <button type="submit" disabled={!turnstileToken}>
        Login
      </button>
    </form>
  );
}
```

## 4. Cara Kerja Validasi di Sisi Backend
1. Frontend menyisipkan properti `'cf-turnstile-response'` saat melakukan POST request ke endpoint (misalnya `/login`).
2. Backend (CMS) akan menangkap *payload* tersebut dan mengirim *request* rahasia ke server Cloudflare (`https://challenges.cloudflare.com/turnstile/v0/siteverify`).
3. Cloudflare akan mencocokkan *Secret Key* backend dengan *Token* dari frontend.
4. Jika Cloudflare merespons dengan valid, maka Backend akan memproses fungsi utamanya (mengecek password di DB, membalas token JWT, dsb). Jika gagal, Backend akan menolak _request_ dengan kode status HTTP `403` atau `400` dan pesannya diteruskan ke user.

Oleh karena itu, dari sisi Frontend, Anda **hanya perlu** memfokuskan integrasi agar dapat merender widget secara UI dan berhasil mengambil+mengirim `turnstileToken`-nya. Sisanya sudah ditangani oleh Backend!
