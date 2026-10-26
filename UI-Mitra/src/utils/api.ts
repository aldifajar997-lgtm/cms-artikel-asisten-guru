import axios from 'axios';

// Konfigurasi Axios default untuk UI-Mitra
// Di production (Vite build), cegah kebocoran request ke localhost dengan fallback ke same-origin /api
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:8787/api'),
  withCredentials: true, // Penting agar cookie httpOnly (refresh_token) terkirim
});

// Menyimpan access token secara aman di memori runtime (tidak disimpan di localStorage, mematuhi Rule #1)
let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const getAccessToken = () => {
  return accessToken;
};

// Request Interceptor: Otomatis tambahkan access_token ke header Authorization
api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    // Ketika payload berupa FormData, hapus Content-Type dari AxiosHeaders
    // agar browser menyematkan multipart/form-data beserta boundary token yang valid secara otomatis.
    if (config.data instanceof FormData) {
      if (config.headers) {
        if (typeof (config.headers as any).delete === 'function') {
          (config.headers as any).delete('Content-Type');
          (config.headers as any).delete('content-type');
        }
        delete config.headers['Content-Type'];
        delete config.headers['content-type'];
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (error: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token as string);
    }
  });
  failedQueue = [];
};

type AuthExpiredListener = () => void;
const authExpiredListeners: AuthExpiredListener[] = [];

export const onAuthExpired = (cb: AuthExpiredListener) => {
  authExpiredListeners.push(cb);
  return () => {
    const idx = authExpiredListeners.indexOf(cb);
    if (idx !== -1) authExpiredListeners.splice(idx, 1);
  };
};

const notifyAuthExpired = () => {
  authExpiredListeners.forEach((cb) => {
    try {
      cb();
    } catch (e) {
      console.error('Auth expired callback error', e);
    }
  });
};

// Response Interceptor: Otomatis perbarui token saat 401
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Hindari infinite loop atau refresh yang salah jika request yang gagal adalah refresh atau login itu sendiri
    if (originalRequest?.url && (originalRequest.url.includes('/auth/refresh') || originalRequest.url.includes('/auth/login'))) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        
        const newAccessToken = res.data.access_token;
        setAccessToken(newAccessToken);
        processQueue(null, newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        setAccessToken(null);
        notifyAuthExpired();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Sanitasi Pesan Error Ramah Pengguna (Kepatuhan Mutlak Rule #7: Jangan bocorkan pesan teknis backend)
export const handleApiError = (error: any): string => {
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;

    if (status === 401) {
      return 'Email atau password salah, atau sesi Anda telah berakhir. Silakan login kembali.';
    }
    if (status === 403) {
      return 'Akses ditolak. Anda tidak memiliki izin untuk melakukan tindakan ini.';
    }
    if (status === 404) {
      return 'Data atau produk yang Anda cari tidak ditemukan.';
    }
    if (status === 429) {
      return 'Terlalu banyak permintaan dalam waktu singkat. Mohon tunggu beberapa saat demi keamanan akun Anda.';
    }
    
    // Zod validation error parser
    if (data?.error?.issues && Array.isArray(data.error.issues) && data.error.issues.length > 0) {
      return 'Sebagian data yang Anda masukkan tidak valid. Periksa kembali formulir Anda.';
    }
    
    if (data?.error?.name === 'ZodError') {
      try {
        const issues = JSON.parse(data.error.message);
        if (Array.isArray(issues) && issues.length > 0) {
          const firstIssue = issues[0];
          const fieldMap: Record<string, string> = {
            title: 'Judul Produk',
            slug: 'Slug URL',
            price: 'Harga Jual',
            description: 'Deskripsi',
            cover_image_key: 'Foto Cover',
            file_r2_key: 'File Produk Digital',
            category_id: 'Kategori',
            bank_details: 'Informasi Rekening Bank',
            preset: 'Pilihan Tema',
            background: 'Latar Belakang',
            button: 'Gaya Tombol',
            typography: 'Tipografi',
            catalogLayout: 'Tata Letak Katalog',
            socialLinksStyle: 'Gaya Ikon Sosial'
          };
          const fieldName = firstIssue.path?.[0];
          const friendlyName = fieldMap[fieldName] || fieldName || 'Formulir';
          
          if (firstIssue.code === 'invalid_type' && firstIssue.received === 'undefined') {
            return `Harap lengkapi bagian: ${friendlyName}.`;
          }
          return `Terdapat kesalahan pengisian pada bagian: ${friendlyName}. Periksa kembali data Anda.`;
        }
      } catch {
        return 'Sebagian data yang Anda masukkan tidak valid. Periksa kembali formulir Anda.';
      }
      return 'Sebagian data yang Anda masukkan tidak valid. Periksa kembali formulir Anda.';
    }

    // Filter pesan bawaan: Jangan izinkan string teknis seperti SQL, JWT, Database, Cloudflare, Internal Server Error
    if (data?.message && typeof data.message === 'string') {
      const lower = data.message.toLowerCase();
      const forbiddenTerms = ['sql', 'jwt', 'syntax', 'internal server error', 'd1_', 'database', 'column', 'pragma', 'token expired', 'worker', 'binding'];
      const hasForbiddenTerm = forbiddenTerms.some(term => lower.includes(term));
      
      if (!hasForbiddenTerm) {
        return data.message;
      }
    }
    
    return 'Terjadi kendala pada sistem. Silakan coba kembali beberapa saat lagi.';
  } else if (error.request) {
    return 'Gagal terhubung ke server. Pastikan perangkat Anda terhubung dengan internet.';
  } else {
    return 'Terjadi kesalahan yang tidak terduga. Silakan coba lagi.';
  }
};

export default api;
