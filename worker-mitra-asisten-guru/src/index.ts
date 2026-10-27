/**
 * Cloudflare Worker: Reverse Proxy untuk mitra.asisten-guru.id
 * Lokasi Deploy: Akun Cloudflare B (Domain Utama: asisten-guru.id)
 * Fungsi: Penyelubungan (Masking) total atas origin mitra.asisten-guru.my.id
 */

export interface Env {
  ORIGIN_UI?: string;       // Default: "mitra.asisten-guru.my.id"
  ORIGIN_API?: string;      // Default: "cms.asisten-guru.my.id"
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const originUiHost = env.ORIGIN_UI || "mitra.asisten-guru.my.id";
    const originApiHost = env.ORIGIN_API || "cms.asisten-guru.my.id";

    // -------------------------------------------------------------
    // 1. ROUTING API: Jalur /api/* diteruskan ke Backend CMS
    // -------------------------------------------------------------
    if (url.pathname.startsWith('/api/') || url.pathname === '/api') {
      const targetApiUrl = new URL(request.url);
      targetApiUrl.protocol = 'https:';
      targetApiUrl.host = originApiHost;

      const apiHeaders = new Headers(request.headers);
      apiHeaders.set('Host', originApiHost);
      apiHeaders.set('X-Forwarded-Host', url.host);
      apiHeaders.set('X-Forwarded-Proto', 'https');
      
      const clientIp = request.headers.get('CF-Connecting-IP');
      if (clientIp) {
        apiHeaders.set('CF-Connecting-IP', clientIp);
        apiHeaders.set('X-Real-IP', clientIp);
        const existingXff = request.headers.get('X-Forwarded-For');
        apiHeaders.set('X-Forwarded-For', existingXff ? `${existingXff}, ${clientIp}` : clientIp);
      }

      const apiRequest = new Request(targetApiUrl.toString(), {
        method: request.method,
        headers: apiHeaders,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
        redirect: 'manual',
        // @ts-ignore
        duplex: 'half'
      });
      const apiResponse = await fetch(apiRequest);

      // Modifikasi response header: Tulis ulang Cookie agar Same-Origin di mitra.asisten-guru.id
      const responseHeaders = new Headers(apiResponse.headers);

      // Pastikan cookie host-only (tidak menyertakan atribut Domain= agar tidak bocor ke subdomain lain)
      // Jika origin mengirimkan atribut Domain, hapus atribut Domain tersebut agar tetap Host-only di mitra.asisten-guru.id
      const rawCookies: string[] = [];
      if (typeof (apiResponse.headers as any).getSetCookie === 'function') {
        rawCookies.push(...(apiResponse.headers as any).getSetCookie());
      } else {
        const singleCookie = apiResponse.headers.get('Set-Cookie');
        if (singleCookie) rawCookies.push(singleCookie);
      }

      if (rawCookies.length > 0) {
        responseHeaders.delete('Set-Cookie');
        for (const cookieStr of rawCookies) {
          // Hapus atribut Domain=... agar cookie host-only terikat langsung ke host asal request (mitra.asisten-guru.id)
          const hostOnlyCookie = cookieStr.replace(/;\s*Domain=[^;]+/gi, '');
          responseHeaders.append('Set-Cookie', hostOnlyCookie);
        }
      }

      // Bersihkan jejak metadata origin internal
      responseHeaders.delete('cf-ray');
      responseHeaders.delete('cf-cache-status');

      return new Response(apiResponse.body, {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
        headers: responseHeaders
      });
    }

    // -------------------------------------------------------------
    // 2. ROUTING DOKUMEN LEGAL STATIS (SEO, Crawler & Bot Friendly)
    // Rute /tos, /privacy, /terms, /legal/* disajikan langsung sebagai HTML statis
    // -------------------------------------------------------------
    const lowerPath = url.pathname.toLowerCase().replace(/\/$/, '') || '/';
    const isLegalPath = lowerPath === '/tos' || lowerPath === '/privacy';

    if (isLegalPath && (request.method === 'GET' || request.method === 'HEAD')) {
      const targetLegalUrl = new URL(request.url);
      targetLegalUrl.protocol = 'https:';
      targetLegalUrl.host = originApiHost;

      const legalHeaders = new Headers(request.headers);
      legalHeaders.set('Host', originApiHost);
      legalHeaders.set('X-Forwarded-Host', url.host);
      legalHeaders.set('X-Forwarded-Proto', 'https');
      const clientIp = request.headers.get('CF-Connecting-IP');
      if (clientIp) {
        legalHeaders.set('CF-Connecting-IP', clientIp);
        legalHeaders.set('X-Real-IP', clientIp);
        const existingXff = request.headers.get('X-Forwarded-For');
        legalHeaders.set('X-Forwarded-For', existingXff ? `${existingXff}, ${clientIp}` : clientIp);
      }

      const legalResponse = await fetch(targetLegalUrl.toString(), {
        method: request.method,
        headers: legalHeaders,
        cf: {
          cacheEverything: true,
          cacheTtl: 86400
        }
      });

      if (legalResponse.status === 200) {
        const responseHeaders = new Headers(legalResponse.headers);
        responseHeaders.delete('cf-ray');
        responseHeaders.delete('cf-cache-status');

        responseHeaders.set('Content-Type', 'text/html; charset=UTF-8');
        responseHeaders.set('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
        responseHeaders.set('X-Frame-Options', 'SAMEORIGIN');
        responseHeaders.set('X-Content-Type-Options', 'nosniff');
        responseHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');

        // Sinyal Canonical URL Resmi ke Search Engine & Robot Crawler
        const canonicalSlug = lowerPath === '/privacy' ? '/privacy' : '/tos';
        responseHeaders.set('Link', `<https://mitra.asisten-guru.id${canonicalSlug}>; rel="canonical"`);

        return new Response(legalResponse.body, {
          status: 200,
          headers: responseHeaders
        });
      }
    }

    // -------------------------------------------------------------
    // 3. ROUTING WEB UI & ASET STATIS: Diteruskan ke UI-Mitra Hosting
    // -------------------------------------------------------------
    const targetUiUrl = new URL(request.url);
    targetUiUrl.protocol = 'https:';
    targetUiUrl.host = originUiHost;

    const uiHeaders = new Headers(request.headers);
    uiHeaders.set('Host', originUiHost);
    uiHeaders.set('X-Forwarded-Host', url.host);
    uiHeaders.set('X-Forwarded-Proto', 'https');

    let uiResponse = await fetch(targetUiUrl.toString(), {
      method: request.method,
      headers: uiHeaders,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      redirect: 'manual'
    });

    // -------------------------------------------------------------
    // 3. SPA ROUTING FALLBACK (Single Page Application)
    // Jika halaman non-aset menghasilkan 404 (misal: /transaksi, /profil-toko),
    // ambil index.html dari origin agar client-side routing React berfungsi
    // -------------------------------------------------------------
    const isAsset = /\.(js|css|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|json|map|xml|txt)$/i.test(url.pathname);
    const isHtmlNavigation = request.method === 'GET' && !isAsset && (
      request.headers.get('accept')?.includes('text/html') || !url.pathname.includes('.')
    );

    if (uiResponse.status === 404 && isHtmlNavigation) {
      const fallbackUrl = new URL('/index.html', `https://${originUiHost}`);
      uiResponse = await fetch(fallbackUrl.toString(), {
        method: 'GET',
        headers: uiHeaders
      });
    }

    const finalHeaders = new Headers(uiResponse.headers);
    finalHeaders.delete('cf-ray');
    finalHeaders.delete('cf-cache-status');

    // ANTI-CLICKJACKING & SECURITY HARDENING:
    finalHeaders.set('X-Frame-Options', 'SAMEORIGIN');
    finalHeaders.set('X-Content-Type-Options', 'nosniff');
    finalHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    finalHeaders.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    // SEO CANONICAL HEADER (Edge Signal untuk Search Engine & AI Crawlers)
    if (url.pathname === '/' || isHtmlNavigation) {
      finalHeaders.set('Link', '<https://mitra.asisten-guru.id/>; rel="canonical"');
    }

    return new Response(uiResponse.body, {
      status: uiResponse.status,
      statusText: uiResponse.statusText,
      headers: finalHeaders
    });
  }
};
