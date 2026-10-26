/**
 * Utilitas parser ZIP murni berbasis Web Standards (Uint8Array, DataView, DecompressionStream)
 * Berjalan langsung di Cloudflare Workers V8 runtime tanpa external dependencies.
 * Aman dari zip-slip / arbitrary execution karena hanya membaca metadata central directory.
 */

export interface ZipEntryMeta {
  id: string
  name: string
  path: string
  folder: string
  isDirectory: boolean
  compressedSize: number
  uncompressedSize: number
  compressionMethod: number
  modifiedAt: string
  extension: string
  category: 'document' | 'image' | 'audio' | 'video' | 'archive' | 'code' | 'presentation' | 'spreadsheet' | 'executable' | 'other'
  isSuspicious: boolean
  suspiciousReason?: string
  canPreview: boolean
  previewType?: 'image' | 'pdf' | 'text' | 'audio' | 'video' | 'none'
  localHeaderOffset: number
}

import { scanArchiveEntries, ThreatItem } from './malware-scanner'

export interface ZipArchiveInfo {
  isZip: boolean
  totalEntries: number
  totalFiles: number
  totalFolders: number
  totalUncompressedSize: number
  hasSuspiciousFiles: boolean
  threats: ThreatItem[]
  entries: ZipEntryMeta[]
  error?: string
}

const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh',
  'msi', 'msp', 'scr', 'pif', 'com', 'hta', 'cpl', 'jar', 'ps1', 'psm1',
  'reg', 'inf', 'dll', 'sys', 'iso', 'img', 'apk'
])

function getFileCategory(ext: string): ZipEntryMeta['category'] {
  const e = ext.toLowerCase()
  if (['pdf', 'doc', 'docx', 'odt', 'rtf', 'txt', 'md', 'epub'].includes(e)) return 'document'
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'ico', 'tiff'].includes(e)) return 'image'
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(e)) return 'audio'
  if (['mp4', 'webm', 'mov', 'avi', 'mkv', 'wmv'].includes(e)) return 'video'
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e)) return 'archive'
  if (['ppt', 'pptx', 'odp', 'key'].includes(e)) return 'presentation'
  if (['xls', 'xlsx', 'ods', 'csv'].includes(e)) return 'spreadsheet'
  if (['html', 'css', 'json', 'xml', 'sql', 'ts', 'jsx', 'tsx', 'py', 'php'].includes(e)) return 'code'
  if (DANGEROUS_EXTENSIONS.has(e)) return 'executable'
  return 'other'
}

function getPreviewType(ext: string, isDirectory: boolean): ZipEntryMeta['previewType'] {
  if (isDirectory) return 'none'
  const e = ext.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'ico'].includes(e)) return 'image'
  if (e === 'pdf') return 'pdf'
  if (['txt', 'md', 'json', 'csv', 'xml', 'html', 'css', 'sql', 'js', 'ts'].includes(e)) return 'text'
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(e)) return 'audio'
  if (['mp4', 'webm'].includes(e)) return 'video'
  return 'none'
}

function parseDosDateTime(dosDate: number, dosTime: number): string {
  try {
    const year = ((dosDate >> 9) & 0x7f) + 1980
    const month = (dosDate >> 5) & 0x0f
    const day = dosDate & 0x1f
    const hours = (dosTime >> 11) & 0x1f
    const minutes = (dosTime >> 5) & 0x3f
    const seconds = (dosTime & 0x1f) * 2

    const d = new Date(Date.UTC(year, Math.max(0, month - 1), Math.max(1, day), hours, minutes, seconds))
    if (!isNaN(d.getTime())) {
      return d.toISOString()
    }
  } catch {}
  return new Date().toISOString()
}

/**
 * Membaca Central Directory file ZIP dari ArrayBuffer
 */
export function parseZipBuffer(buffer: ArrayBuffer): ZipArchiveInfo {
  const byteLength = buffer.byteLength
  if (byteLength < 22) {
    return {
      isZip: false,
      totalEntries: 0,
      totalFiles: 0,
      totalFolders: 0,
      totalUncompressedSize: 0,
      hasSuspiciousFiles: false,
      threats: [],
      entries: [],
      error: 'Berkas terlalu kecil untuk format ZIP.'
    }
  }

  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)

  // 1. Verifikasi magic bytes awal (PK\x03\x04 atau PK\x05\x06 atau PK\x07\x08)
  const isZipStart = bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)
  if (!isZipStart) {
    return {
      isZip: false,
      totalEntries: 0,
      totalFiles: 0,
      totalFolders: 0,
      totalUncompressedSize: 0,
      hasSuspiciousFiles: false,
      threats: [],
      entries: [],
      error: 'Berkas bukan format ZIP yang valid.'
    }
  }

  // 2. Cari End of Central Directory Record (EOCD signature: 0x06054b50) dari akhir file (maksimal 65KB ke belakang)
  let eocdOffset = -1
  const maxSearch = Math.min(byteLength - 22, 65535 + 22)
  for (let i = byteLength - 22; i >= byteLength - maxSearch; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i
      break
    }
  }

  if (eocdOffset === -1) {
    return {
      isZip: true,
      totalEntries: 0,
      totalFiles: 0,
      totalFolders: 0,
      totalUncompressedSize: 0,
      hasSuspiciousFiles: false,
      threats: [],
      entries: [],
      error: 'Struktur arsip ZIP rusak atau terputus (EOCD tidak ditemukan).'
    }
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true)
  const cdSize = view.getUint32(eocdOffset + 12, true)
  const cdOffset = view.getUint32(eocdOffset + 16, true)

  if (cdOffset + cdSize > byteLength) {
    return {
      isZip: true,
      totalEntries: 0,
      totalFiles: 0,
      totalFolders: 0,
      totalUncompressedSize: 0,
      hasSuspiciousFiles: false,
      threats: [],
      entries: [],
      error: 'Indeks direktori ZIP melebihi ukuran berkas.'
    }
  }

  const entries: ZipEntryMeta[] = []
  let currentOffset = cdOffset
  const utf8Decoder = new TextDecoder('utf-8')
  let totalFiles = 0
  let totalFolders = 0
  let totalUncompressedSize = 0
  let hasSuspiciousFiles = false

  // Batasi parsing maksimal 500 entri untuk mencegah DoS arsip raksasa
  const maxEntriesToParse = Math.min(totalEntries, 500)

  for (let i = 0; i < maxEntriesToParse; i++) {
    if (currentOffset + 46 > byteLength) break
    const sig = view.getUint32(currentOffset, true)
    if (sig !== 0x02014b50) {
      // bukan central directory header
      break
    }

    const compressionMethod = view.getUint16(currentOffset + 10, true)
    const dosTime = view.getUint16(currentOffset + 12, true)
    const dosDate = view.getUint16(currentOffset + 14, true)
    const compressedSize = view.getUint32(currentOffset + 20, true)
    const uncompressedSize = view.getUint32(currentOffset + 24, true)
    const fileNameLength = view.getUint16(currentOffset + 28, true)
    const extraFieldLength = view.getUint16(currentOffset + 30, true)
    const fileCommentLength = view.getUint16(currentOffset + 32, true)
    const localHeaderOffset = view.getUint32(currentOffset + 42, true)

    const rawNameBytes = bytes.slice(currentOffset + 46, currentOffset + 46 + fileNameLength)
    let rawPath = utf8Decoder.decode(rawNameBytes).replace(/\\/g, '/')

    // Bersihkan leading slash
    if (rawPath.startsWith('/')) rawPath = rawPath.slice(1)

    const isDirectory = rawPath.endsWith('/')
    const pathParts = rawPath.split('/').filter(Boolean)
    const fileName = pathParts[pathParts.length - 1] || ''
    const folder = pathParts.slice(0, -1).join('/')

    const extMatch = fileName.includes('.') ? fileName.split('.').pop() || '' : ''
    const ext = extMatch.toLowerCase()

    // Deteksi risiko keamanan:
    // 1. Ekstensi berbahaya langsung
    // 2. Double extension berbahaya (contoh: invoice.pdf.exe)
    let isSuspicious = false
    let suspiciousReason = ''

    if (DANGEROUS_EXTENSIONS.has(ext)) {
      isSuspicious = true
      suspiciousReason = `Berkas program / executable berbahaya (.${ext}) tidak diizinkan di marketplace.`
    } else if (fileName.includes('.')) {
      const parts = fileName.split('.')
      if (parts.length > 2) {
        const subExt = parts[parts.length - 2].toLowerCase()
        if (DANGEROUS_EXTENSIONS.has(ext) || DANGEROUS_EXTENSIONS.has(subExt)) {
          isSuspicious = true
          suspiciousReason = `Berkas menyamarkan ekstensi ganda (.${subExt}.${ext}).`
        }
      }
    }

    if (rawPath.includes('..') || rawPath.startsWith('/') || rawPath.includes('\0')) {
      isSuspicious = true
      suspiciousReason = 'Path berpotensi exploit path-traversal.'
    }

    if (isSuspicious) {
      hasSuspiciousFiles = true
    }

    if (isDirectory) {
      totalFolders++
    } else {
      totalFiles++
      totalUncompressedSize += uncompressedSize
    }

    const category = isDirectory ? 'archive' : getFileCategory(ext)
    const previewType = getPreviewType(ext, isDirectory)

    entries.push({
      id: `entry-${i}`,
      name: isDirectory ? pathParts[pathParts.length - 1] || 'folder' : fileName,
      path: rawPath,
      folder,
      isDirectory,
      compressedSize,
      uncompressedSize,
      compressionMethod,
      modifiedAt: parseDosDateTime(dosDate, dosTime),
      extension: isDirectory ? 'folder' : ext,
      category,
      isSuspicious,
      suspiciousReason,
      canPreview: previewType !== 'none',
      previewType,
      localHeaderOffset
    })

    currentOffset += 46 + fileNameLength + extraFieldLength + fileCommentLength
  }

  // Jalankan pemindaian ancaman malware dan integritas pada seluruh entri arsip
  const threats = scanArchiveEntries(entries)
  if (threats.length > 0) {
    hasSuspiciousFiles = true
    // Beri penandaan rinci pada entri yang bermasalah
    threats.forEach(t => {
      const match = entries.find(e => e.path === t.fileName)
      if (match) {
        match.isSuspicious = true
        match.suspiciousReason = t.description
      }
    })
  }

  return {
    isZip: true,
    totalEntries,
    totalFiles,
    totalFolders,
    totalUncompressedSize,
    hasSuspiciousFiles,
    threats,
    entries
  }
}

/**
 * Mengekstrak satu berkas spesifik dari ZIP buffer untuk preview inline
 */
export async function extractZipEntry(buffer: ArrayBuffer, targetPath: string): Promise<{ data: Uint8Array; mimeType: string } | null> {
  const zipInfo = parseZipBuffer(buffer)
  const normalizedTarget = targetPath.replace(/\\/g, '/').replace(/^\//, '')

  const entry = zipInfo.entries.find(e => e.path === normalizedTarget && !e.isDirectory)
  if (!entry) return null

  // Cegah ekstraksi preview untuk berkas berisiko tinggi / malware atau tipe yang tidak didukung
  if (entry.isSuspicious || entry.previewType === 'none') {
    throw new Error('Berkas ini terindikasi berbahaya atau formatnya tidak didukung untuk pratinjau langsung.')
  }

  // Batasi ukuran ekstraksi preview maksimal 15MB agar tidak membebani memory
  if (entry.uncompressedSize > 15 * 1024 * 1024) {
    throw new Error('Ukuran berkas terlalu besar untuk dipratinjau langsung (Maks 15MB). Silakan unduh berkas untuk pemeriksaan offline.')
  }

  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  const localOffset = entry.localHeaderOffset

  if (localOffset + 30 > buffer.byteLength) return null
  const localSig = view.getUint32(localOffset, true)
  if (localSig !== 0x04034b50) return null

  const compressionMethod = view.getUint16(localOffset + 8, true)
  const compressedSize = view.getUint32(localOffset + 18, true) || entry.compressedSize
  const fileNameLen = view.getUint16(localOffset + 26, true)
  const extraLen = view.getUint16(localOffset + 28, true)

  const dataStart = localOffset + 30 + fileNameLen + extraLen
  const dataEnd = dataStart + compressedSize

  if (dataEnd > buffer.byteLength) return null

  const rawCompressedData = bytes.slice(dataStart, dataEnd)
  let decompressedData: Uint8Array

  if (compressionMethod === 0) {
    // Uncompressed (Stored)
    decompressedData = rawCompressedData
  } else if (compressionMethod === 8) {
    // Deflate compression
    try {
      // Gunakan Web standard DecompressionStream('deflate-raw')
      const ds = new DecompressionStream('deflate-raw')
      const stream = new Response(rawCompressedData).body?.pipeThrough(ds)
      if (!stream) return null

      const reader = stream.getReader()
      const chunks: Uint8Array[] = []
      let totalBytes = 0
      const MAX_BYTES = 15 * 1024 * 1024 // 15MB safety limit against zip bombs

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          totalBytes += value.byteLength
          if (totalBytes > MAX_BYTES) {
            await reader.cancel()
            throw new Error('Ukuran ekstraksi berkas melebihi batas pratinjau aman (Maks 15MB). Silakan unduh berkas untuk pemeriksaan offline.')
          }
          chunks.push(value)
        }
      }

      decompressedData = new Uint8Array(totalBytes)
      let offset = 0
      for (const chunk of chunks) {
        decompressedData.set(chunk, offset)
        offset += chunk.byteLength
      }
    } catch (err: any) {
      if (err?.message && err.message.includes('Maks 15MB')) {
        throw err
      }
      console.error('Failed to deflate raw zip entry:', err)
      return null
    }
  } else {
    // Metode kompresi lain tidak didukung untuk inline preview
    return null
  }

  // Tentukan MIME type
  const ext = entry.extension.toLowerCase()
  let mimeType = 'application/octet-stream'
  if (ext === 'pdf') mimeType = 'application/pdf'
  else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg'
  else if (ext === 'png') mimeType = 'image/png'
  else if (ext === 'webp') mimeType = 'image/webp'
  else if (ext === 'gif') mimeType = 'image/gif'
  else if (ext === 'svg') mimeType = 'image/svg+xml'
  else if (ext === 'txt') mimeType = 'text/plain; charset=utf-8'
  else if (ext === 'md') mimeType = 'text/markdown; charset=utf-8'
  else if (ext === 'json') mimeType = 'application/json'
  else if (ext === 'csv') mimeType = 'text/csv; charset=utf-8'
  else if (ext === 'mp3') mimeType = 'audio/mpeg'
  else if (ext === 'wav') mimeType = 'audio/wav'
  else if (ext === 'mp4') mimeType = 'video/mp4'

  return { data: decompressedData, mimeType }
}
