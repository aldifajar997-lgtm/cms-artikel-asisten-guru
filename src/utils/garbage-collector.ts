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

  // 2. PROTEKSI HAK UNDUH PEMBELI: Kumpulkan snapshot r2 key dari transaksi penjualan yang sah
  try {
    let txOffset = 0
    while (true) {
      const txBatch = await env.DB.prepare(
        'SELECT DISTINCT purchased_file_r2_key FROM sale_transactions WHERE purchased_file_r2_key IS NOT NULL LIMIT ? OFFSET ?'
      ).bind(PAGE_SIZE, txOffset).all()

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

  console.log(`[GC COMPLETED] Selesai. Dipindai: ${report.scannedCount}, Terhapus: ${report.deletedCount}, Kunci Aktif Terlindungi: ${report.activeCount}`)
  return report
}
