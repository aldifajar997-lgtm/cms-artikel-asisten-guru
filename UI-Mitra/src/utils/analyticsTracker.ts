/**
 * Helper Utilitas Pelacakan Trafik & Atribusi Toko Mitra (Client-Side Tracker)
 * 
 * Fitur:
 * 1. Auto-Capture: Membaca parameter query URL (?utm_source, ?utm_medium, ?utm_campaign, ?ref, ?source) dan document.referrer
 * 2. Session Attribution Persistence: Menyimpan kanal atribusi ke sessionStorage agar event checkout_intent tidak terputus (tidak jatuh jadi 'direct')
 * 3. Non-Blocking Beacon: Menggunakan navigator.sendBeacon atau fetch keepalive agar pengiriman data tidak terputus saat pengunjung berpindah halaman atau redirect ke Midtrans.
 */

const STORAGE_KEY_TRAFFIC = 'ag_store_traffic_source';
const STORAGE_KEY_UTM_CAMPAIGN = 'ag_store_utm_campaign';
const STORAGE_KEY_REFERRER = 'ag_store_initial_referrer';

export interface TrackEventPayload {
  seller_id?: string;
  product_id?: string;
  product_slug?: string;
  store_slug?: string;
  event_type: 'store_view' | 'product_view' | 'checkout_intent';
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  ref?: string;
  source?: string;
  referrer?: string;
  url?: string;
}

/**
 * Tangkap dan simpan atribusi kanal trafik pengunjung ke sessionStorage
 */
export function captureAndPersistTrafficAttribution(): {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  ref?: string;
  source?: string;
  referrer?: string;
} {
  if (typeof window === 'undefined') return {};

  try {
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get('utm_source') || undefined;
    const utmMedium = params.get('utm_medium') || undefined;
    const utmCampaign = params.get('utm_campaign') || undefined;
    const ref = params.get('ref') || undefined;
    const source = params.get('source') || undefined;
    const rawReferrer = document.referrer || undefined;

    // First-touch attribution: Simpan jika ada parameter baru atau belum ada data tersimpan
    const primaryChannel = utmSource || ref || source;
    if (primaryChannel) {
      sessionStorage.setItem(STORAGE_KEY_TRAFFIC, primaryChannel);
    }
    if (utmCampaign) {
      sessionStorage.setItem(STORAGE_KEY_UTM_CAMPAIGN, utmCampaign);
    }
    if (rawReferrer && !sessionStorage.getItem(STORAGE_KEY_REFERRER)) {
      sessionStorage.setItem(STORAGE_KEY_REFERRER, rawReferrer);
    }

    return {
      utm_source: utmSource || sessionStorage.getItem(STORAGE_KEY_TRAFFIC) || undefined,
      utm_medium: utmMedium || undefined,
      utm_campaign: utmCampaign || sessionStorage.getItem(STORAGE_KEY_UTM_CAMPAIGN) || undefined,
      ref,
      source,
      referrer: rawReferrer || sessionStorage.getItem(STORAGE_KEY_REFERRER) || undefined
    };
  } catch {
    return {};
  }
}

/**
 * Kirim event analitik ke backend CMS3 secara aman & non-blocking
 */
export async function trackStoreEvent(
  endpointBase: string,
  event: TrackEventPayload
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    const attribution = captureAndPersistTrafficAttribution();
    const payload: TrackEventPayload = {
      ...event,
      utm_source: event.utm_source || attribution.utm_source,
      utm_medium: event.utm_medium || attribution.utm_medium,
      utm_campaign: event.utm_campaign || attribution.utm_campaign,
      ref: event.ref || attribution.ref,
      source: event.source || attribution.source,
      referrer: event.referrer || attribution.referrer,
      url: event.url || window.location.href
    };

    const targetUrl = `${endpointBase.replace(/\/+$/, '')}/api/products/public/track-event`;
    const jsonBody = JSON.stringify(payload);

    // 1. Coba gunakan navigator.sendBeacon jika didukung (ideal saat checkout / page unload)
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([jsonBody], { type: 'application/json' });
      const sent = navigator.sendBeacon(targetUrl, blob);
      if (sent) return true;
    }

    // 2. Fallback fetch dengan keepalive
    await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: jsonBody,
      keepalive: true
    });

    return true;
  } catch (err) {
    console.debug('[StoreTracker] Silent track fail:', err);
    return false;
  }
}
