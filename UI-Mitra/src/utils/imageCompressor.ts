/**
 * Utilitas Kompresi Gambar di Sisi Klien (Browser Canvas)
 * 
 * Manfaat:
 * 1. Mengurangi ukuran foto dari 2MB - 10MB (standar kamera HP) menjadi ~80KB - 200KB dalam hitungan milidetik.
 * 2. Menghemat bandwidth dan memangkas waktu transmisi jaringan seluler hingga 90% (upload menjadi instan).
 * 3. Menghindari penolakan error HTTP 400 "Ukuran melebihi batas 1MB" saat pengguna memilih foto mentah dari galeri.
 */

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 - 1.0 (default 0.85)
}

export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const { maxWidth = 1280, maxHeight = 1280, quality = 0.85 } = options;

  // Hanya proses jika file adalah format gambar raster
  const supportedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!supportedTypes.includes(file.type)) {
    return file;
  }

  // Jika file sudah sangat kecil (< 150 KB), tidak perlu kompresi ulang
  if (file.size <= 150 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Hitung dimensi baru proporsional jika melebihi batas maksimum
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      // Aktifkan interpolasi berkualitas tinggi
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Gambar ke canvas
      ctx.drawImage(img, 0, 0, width, height);

      // Konversi ke format webp atau jpeg berkualitas tinggi
      // Jika PNG transparan dipertahankan formatnya atau dikonversi ke webp
      const targetMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            // Jika hasil tidak valid atau lebih besar, pakai file asli
            resolve(file);
            return;
          }

          // Ganti ekstensi jika dikonversi
          let newName = file.name;
          if (targetMime === 'image/jpeg' && !newName.match(/\.(jpg|jpeg)$/i)) {
            newName = newName.replace(/\.[^.]+$/, '') + '.jpg';
          }

          const compressedFile = new File([blob], newName, {
            type: targetMime,
            lastModified: Date.now(),
          });

          resolve(compressedFile);
        },
        targetMime,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // Fallback ke file asli jika gagal memuat gambar
    };

    img.src = objectUrl;
  });
}
