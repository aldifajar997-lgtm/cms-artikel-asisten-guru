export const getSafeFrontendUrl = (envUrl: string | undefined): string => {
  const defaultUrl = 'https://asisten-guru.id'
  if (!envUrl) return defaultUrl

  try {
    const url = new URL(envUrl)
    // Pastikan protokol hanya http atau https
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return defaultUrl
    }
    // Hapus trailing slash jika ada
    return url.origin
  } catch {
    return defaultUrl
  }
}
