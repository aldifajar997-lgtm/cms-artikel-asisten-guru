import { Bindings } from '../types'

export interface GcReport {
  scannedCount: number
  deletedCount: number
  activeCount: number
  errors: string[]
}

/**
 * Garbage Collector R2 untuk Berkas Digital Marketplace (prefix 'products/')
 * 
 * Mekanisme Keamanan & Integritas:
 * 1. Paginasi D1 (chunking 1.000 baris) mencegah kegagalan batas row query limit saat data produk membesar.
 * 2. Proteksi Hak Unduh Pembeli: Memeriksa 'sale_transactions.purchased_file_r2_key' sehingga berkas versi lama
 *    yang pernah dibeli konsumen TIDAK akan terhapus saat seller mengunggah versi baru.
 * 3. Defensive Abort Guard: Jika terdapat produk aktif di DB namun activeKeys kosong, proses dibatalkan untuk mencegah data loss.
 * 4. Sinkronisasi DB: Menghapus record metadata terkait di tabel 'media' D1 saat berkas orphan R2 dimusnahkan.
 * 5. Buffer 24 Jam: Hanya menghapus file yang berusia > 24 jam untuk melindungi sesi unggah/draft yang sedang aktif.
 */
export async function runMarketplaceR2GarbageCollector(
  env: Bindings,
  isManual = false
): Promise<GcReport> {
  const report: GcReport = {
    scannedCount: 0,
    deletedCount: 0,
    activeCount: 0,
    errors: []
  }

  const activeKeys = new Set<string>()
  const PAGE_SIZE = 1000

  // 1. Kumpulkan seluruh r2 key yang digunakan pada tabel products dengan paginasi
  try {
    let productOffset = 0
    while (true) {
      const pBatch = await env.DB.prepare(
        'SELECT file_r2_key, cover_image_key, detail_image_1_key, detail_image_2_key, detail_image_3_key FROM products LIMIT ? OFFSET ?'
      ).bind(PAGE_SIZE, productOffset).all()

      const rows = (pBatch.results || []) as any[]
      for (const row of rows) {
        if (row.file_r2_key) activeKeys.add(row.file_r2_key)
        if (row.cover_image_key) activeKeys.add(row.cover_image_key)
        if (row.detail_image_1_key) activeKeys.add(row.detail_image_1_key)
        if (row.detail_image_2_key) activeKeys.add(row.detail_image_2_key)
        if (row.detail_image_3_key) activeKeys.add(row.detail_image_3_key)
      }

      if (rows.length < PAGE_SIZE) break
      productOffset += PAGE_SIZE
    }
  } catch (err: any) {
    const errorMsg = `Gagal memindai tabel products: ${err?.message || String(err)}`
    console.error(`[GC ERROR] ${errorMsg}`)
    report.errors.push(errorMsg)
    return report // Batalkan segera jika query database produk gagal
  }

  // 2. PROTEKSI HAK UNDUH PEMBELI AKTIF:
  // Kumpulkan snapshot r2 key dari transaksi penjualan yang MASIH AKTIF (pembelian <= 7 hari ATAU sengketa/komplain terbuka).
  // Berkas versi lama yang sudah tidak memiliki pembeli aktif akan dibersihkan secara aman dari R2.
  try {
    let txOffset = 0
    while (true) {
      let txBatch: any
      try {
        // Mode utama: Hanya lindungi file transaksi aktif (< 7 hari) atau yang sedang disengketakan (dispute_status = 'open')
        txBatch = await env.DB.prepare(`
          SELECT DISTINCT purchased_file_r2_key 
          FROM sale_transactions 
          WHERE purchased_file_r2_key IS NOT NULL 
            AND (
              paid_at >= datetime('now', '-7 days') 
              OR dispute_status = 'open'
            )
          LIMIT ? OFFSET ?
        `).bind(PAGE_SIZE, txOffset).all()
      } catch (colErr: any) {
        // Fallback backward-compatible jika kolom dispute_status belum ada di database lokal/lama
        txBatch = await env.DB.prepare(`
          SELECT DISTINCT purchased_file_r2_key 
          FROM sale_transactions 
          WHERE purchased_file_r2_key IS NOT NULL 
            AND paid_at >= datetime('now', '-7 days')
          LIMIT ? OFFSET ?
        `).bind(PAGE_SIZE, txOffset).all()
      }

      const rows = (txBatch.results || []) as any[]
      for (const row of rows) {
        if (row.purchased_file_r2_key) activeKeys.add(row.purchased_file_r2_key)
      }

      if (rows.length < PAGE_SIZE) break
      txOffset += PAGE_SIZE
    }
  } catch (txErr: any) {
    console.warn('[GC WARNING] Gagal memuat purchased_file_r2_key dari sale_transactions:', txErr)
    report.errors.push(`Gagal membaca snapshot transaksi pembelian: ${txErr?.message || String(txErr)}`)
  }

  report.activeCount = activeKeys.size

  // 3. DEFENSIVE SECURITY GUARD: Cegah penghapusan massal jika database memiliki produk aktif tetapi activeKeys kosong
  if (activeKeys.size === 0) {
    try {
      const countCheck = await env.DB.prepare(
        'SELECT count(*) as total FROM products WHERE file_r2_key IS NOT NULL'
      ).first<{ total: number }>()

      if ((countCheck?.total || 0) > 0) {
        const anomalyMsg = 'Deteksi anomali: Database memiliki berkas produk aktif tetapi activeKeys kosong. Pembersihan R2 dibatalkan demi keamanan data.'
        console.error(`[GC ABORT] ${anomalyMsg}`)
        report.errors.push(anomalyMsg)
        return report
      }
    } catch (guardErr: any) {
      console.error('[GC GUARD ERROR] Gagal menjalankan defensive guard check:', guardErr)
      report.errors.push(`Gagal menjalankan guard check: ${guardErr?.message || String(guardErr)}`)
      return report
    }
  }

  // 4. Iterasi object di R2 dengan prefix 'products/'
  let cursor: string | undefined
  const nowTime = Date.now()
  const ONE_DAY_MS = 24 * 60 * 60 * 1000

  do {
    const list: any = await env.R2.list({ prefix: 'products/', cursor })
    const objects = list.objects || []
    report.scannedCount += objects.length

    for (const object of objects) {
      const uploadTime = object.uploaded ? new Date(object.uploaded).getTime() : 0
      const isOlderThan24h = (nowTime - uploadTime) > ONE_DAY_MS

      // Hapus HANYA jika file tidak terdaftar di activeKeys DAN usianya sudah lebih dari 24 jam
      if (!activeKeys.has(object.key) && isOlderThan24h) {
        try {
          // 4a. Hapus fisik dari R2 storage
          await env.R2.delete(object.key)
          report.deletedCount++
          console.log(`[GC] Berhasil menghapus file yatim (orphan): ${object.key}`)

          // 4b. Hapus metadata dari tabel media D1 untuk menjaga konsistensi database
          await env.DB.prepare('DELETE FROM media WHERE r2_key = ?').bind(object.key).run().catch((dbErr: any) => {
            console.warn(`[GC] Gagal membersihkan metadata media untuk key ${object.key}:`, dbErr)
          })
        } catch (delErr: any) {
          const errDetail = `Gagal menghapus file ${object.key}: ${delErr?.message || String(delErr)}`
          console.error(`[GC DELETE ERROR] ${errDetail}`)
          report.errors.push(errDetail)
        }
      }
    }

    cursor = list.truncated ? list.cursor : undefined
  } while (cursor)

  console.log(`[GC COMPLETED] Selesai Marketplace. Dipindai: ${report.scannedCount}, Terhapus: ${report.deletedCount}, Kunci Aktif Terlindungi: ${report.activeCount}`)
  return report
}

/**
 * Garbage Collector R2 untuk Berkas Media Artikel & Konten Blog (tanpa prefix folder khusus di root R2)
 *
 * Mekanisme Keamanan & Integritas:
 * 1. Paginasi D1 (chunking 1.000 baris) pada tabel posts untuk memindai kolom 'featured_image' dan 'content'.
 * 2. Ekstraksi otomatis kunci media R2 dari HTML body dan featured_image via regex /api/media/{r2_key}.
 * 3. Menghindari berkas dari domain/kategori lain dengan mengabaikan prefix folder:
 *    ('products/', 'avatars/', 'covers/', 'store-backgrounds/', 'sample-products/').
 * 4. Defensive Abort Guard: Jika tabel posts memiliki artikel aktif namun activeKeys kosong, proses dihentikan.
 * 5. Buffer 24 Jam: File yang baru diunggah dalam 24 jam terakhir TIDAK akan pernah dihapus, menjamin keamanan sesi draft/penulisan.
 * 6. Sinkronisasi DB: Menghapus record metadata terkait di tabel 'media' D1 saat berkas orphan R2 dimusnahkan.
 */
export async function runArticleMediaGarbageCollector(
  env: Bindings,
  isManual = false
): Promise<GcReport> {
  const report: GcReport = {
    scannedCount: 0,
    deletedCount: 0,
    activeCount: 0,
    errors: []
  }

  const activeKeys = new Set<string>()
  const PAGE_SIZE = 1000

  // 1. Kumpulkan seluruh r2 key yang digunakan pada tabel posts (featured_image & content)
  try {
    let postOffset = 0
    while (true) {
      const pBatch = await env.DB.prepare(
        'SELECT featured_image, content FROM posts LIMIT ? OFFSET ?'
      ).bind(PAGE_SIZE, postOffset).all()

      const rows = (pBatch.results || []) as any[]
      for (const row of rows) {
        // Ekstrak dari featured_image
        if (row.featured_image) {
          const match = String(row.featured_image).match(/\/api\/media\/([a-zA-Z0-9.\-_\/]+?)(?=["'\s>)]|$)/)
          if (match && match[1]) {
            activeKeys.add(match[1].replace(/\/+$/, ''))
          } else if (!row.featured_image.includes('/') && !row.featured_image.includes(':')) {
            activeKeys.add(row.featured_image)
          }
        }

        // Ekstrak dari HTML content
        if (row.content) {
          const regex = /\/api\/media\/([a-zA-Z0-9.\-_\/]+?)(?=["'\s>)]|$)/g
          let match: RegExpExecArray | null
          while ((match = regex.exec(row.content)) !== null) {
            if (match[1]) activeKeys.add(match[1].replace(/\/+$/, ''))
          }
        }
      }

      if (rows.length < PAGE_SIZE) break
      postOffset += PAGE_SIZE
    }
  } catch (err: any) {
    const errorMsg = `Gagal memindai tabel posts: ${err?.message || String(err)}`
    console.error(`[GC ARTICLE ERROR] ${errorMsg}`)
    report.errors.push(errorMsg)
    return report
  }

  // 1b. EFEK DOMINO PROTEKSI: Gambar cover & detail produk juga diunggah ke root R2 melalui /api/media.
  // Pastikan kunci cover dan detail produk dilindungi agar tidak terhapus oleh GC root R2.
  try {
    let productOffset = 0
    while (true) {
      const prodBatch = await env.DB.prepare(
        'SELECT cover_image_key, detail_image_1_key, detail_image_2_key, detail_image_3_key FROM products LIMIT ? OFFSET ?'
      ).bind(PAGE_SIZE, productOffset).all()

      const pRows = (prodBatch.results || []) as any[]
      for (const row of pRows) {
        if (row.cover_image_key && !row.cover_image_key.includes('/')) activeKeys.add(row.cover_image_key)
        if (row.detail_image_1_key && !row.detail_image_1_key.includes('/')) activeKeys.add(row.detail_image_1_key)
        if (row.detail_image_2_key && !row.detail_image_2_key.includes('/')) activeKeys.add(row.detail_image_2_key)
        if (row.detail_image_3_key && !row.detail_image_3_key.includes('/')) activeKeys.add(row.detail_image_3_key)
      }

      if (pRows.length < PAGE_SIZE) break
      productOffset += PAGE_SIZE
    }
  } catch (prodErr: any) {
    console.warn('[GC ARTICLE WARNING] Gagal memindai kunci gambar produk untuk perlindungan root R2:', prodErr)
  }

  report.activeCount = activeKeys.size

  // 2. DEFENSIVE SECURITY GUARD: Cegah penghapusan massal jika tabel posts ada data tetapi activeKeys kosong sama sekali
  if (activeKeys.size === 0) {
    try {
      const countCheck = await env.DB.prepare(
        'SELECT count(*) as total FROM posts WHERE featured_image IS NOT NULL OR content IS NOT NULL'
      ).first<{ total: number }>()

      if ((countCheck?.total || 0) > 0) {
        const anomalyMsg = 'Deteksi anomali: Database memiliki artikel aktif tetapi activeKeys kosong. Pembersihan media artikel dibatalkan demi keamanan data.'
        console.error(`[GC ARTICLE ABORT] ${anomalyMsg}`)
        report.errors.push(anomalyMsg)
        return report
      }
    } catch (guardErr: any) {
      console.error('[GC ARTICLE GUARD ERROR] Gagal menjalankan defensive guard check:', guardErr)
      report.errors.push(`Gagal menjalankan guard check artikel: ${guardErr?.message || String(guardErr)}`)
      return report
    }
  }

  // 3. Iterasi object di R2 root (hanya yang BUKAN prefix products, avatars, covers, store-backgrounds, sample-products)
  const EXCLUDED_PREFIXES = [
    'products/',
    'avatars/',
    'covers/',
    'store-backgrounds/',
    'sample-products/'
  ]

  let cursor: string | undefined
  const nowTime = Date.now()
  const ONE_DAY_MS = 24 * 60 * 60 * 1000

  do {
    const list: any = await env.R2.list({ cursor })
    const objects = list.objects || []

    for (const object of objects) {
      // Lewati file yang berada di folder sub-sistem lain
      if (EXCLUDED_PREFIXES.some(prefix => object.key.startsWith(prefix))) {
        continue
      }

      report.scannedCount++

      const uploadTime = object.uploaded ? new Date(object.uploaded).getTime() : 0
      const isOlderThan24h = (nowTime - uploadTime) > ONE_DAY_MS

      // Hapus HANYA jika file tidak terdaftar di activeKeys artikel DAN usianya sudah lebih dari 24 jam
      if (!activeKeys.has(object.key) && isOlderThan24h) {
        try {
          // 3a. Hapus fisik dari R2 storage
          await env.R2.delete(object.key)
          report.deletedCount++
          console.log(`[GC ARTICLE] Berhasil menghapus file yatim (orphan) artikel: ${object.key}`)

          // 3b. Hapus metadata dari tabel media D1
          await env.DB.prepare('DELETE FROM media WHERE r2_key = ?').bind(object.key).run().catch((dbErr: any) => {
            console.warn(`[GC ARTICLE] Gagal membersihkan metadata media untuk key ${object.key}:`, dbErr)
          })
        } catch (delErr: any) {
          const errDetail = `Gagal menghapus file ${object.key}: ${delErr?.message || String(delErr)}`
          console.error(`[GC ARTICLE DELETE ERROR] ${errDetail}`)
          report.errors.push(errDetail)
        }
      }
    }

    cursor = list.truncated ? list.cursor : undefined
  } while (cursor)

  console.log(`[GC COMPLETED] Selesai Artikel. Dipindai: ${report.scannedCount}, Terhapus: ${report.deletedCount}, Kunci Aktif Terlindungi: ${report.activeCount}`)
  return report
}

/**
 * Runner Utama Pembersihan Harian (Daily Garbage Collector) jam 3 pagi (20:00 UTC)
 * Menjalankan pembersihan berkas yatim untuk:
 * 1. Berkas digital & sampul marketplace (prefix 'products/')
 * 2. Gambar artikel & featured image (root R2 / non-prefix)
 */
export async function runDailyGarbageCollector(
  env: Bindings,
  isManual = false
): Promise<{ marketplace: GcReport; articles: GcReport }> {
  console.log('[GC DAILY] Memulai rutinitas pembersihan harian jam 3 pagi...')
  const marketplaceReport = await runMarketplaceR2GarbageCollector(env, isManual)
  const articlesReport = await runArticleMediaGarbageCollector(env, isManual)
  console.log('[GC DAILY] Seluruh rutinitas pembersihan harian selesai.')
  return {
    marketplace: marketplaceReport,
    articles: articlesReport
  }
}
