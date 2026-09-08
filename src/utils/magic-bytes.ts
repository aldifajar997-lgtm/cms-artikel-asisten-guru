export const isSafeImage = (buffer: ArrayBuffer): boolean => {
  return getContentTypeFromMagicBytes(buffer) !== null
}

/**
 * Derive content-type dari magic bytes file asli.
 * Tidak pernah percaya Content-Type header dari client karena bisa dipalsu.
 * Return null jika bukan format gambar yang diizinkan (JPG/PNG/WEBP).
 */
export const getContentTypeFromMagicBytes = (buffer: ArrayBuffer): string | null => {
  const bytes = new Uint8Array(buffer.slice(0, 12))

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'

  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'

  // WEBP: RIFF ... WEBP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'image/webp'
  }

  return null
}
