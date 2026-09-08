import axios from 'axios';

// Konfigurasi Axios default
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8787/api',
  withCredentials: true, // Penting agar cookie httpOnly (refresh_token) terkirim
  headers: {
    'Content-Type': 'application/json',
  },
});

// Menyimpan access token di memory
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

// Response Interceptor: Tangani 401 dan coba refresh token
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Hindari infinite loop jika endpoint refresh gagal
    if (originalRequest.url === '/auth/refresh') {
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
        // Coba perbarui access_token menggunakan refresh_token (yang ada di cookie)
        const res = await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          {},
          { withCredentials: true } // Pastikan cookie ikut terkirim
        );
        
        const newAccessToken = res.data.access_token;
        setAccessToken(newAccessToken);
        processQueue(null, newAccessToken);

        // Ulangi request aslinya dengan token baru
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh token gagal/kadaluarsa. Sesi berakhir.
        processQueue(refreshError, null);
        setAccessToken(null);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Utility untuk standardisasi penanganan pesan error ke frontend (Rule #7)
export const handleApiError = (error: any): string => {
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;

    // Jika backend mengirimkan pesan khusus, dan bukan error teknis, kita bisa pakai,
    // tetapi sebagai lapis keamanan tambahan (Rule 7), kita pastikan tidak membocorkan error teknis.
    if (status === 401) return 'Email atau password salah, atau sesi Anda telah berakhir.';
    if (status === 403) return 'Akses ditolak. Hubungi administrator.';
    if (status === 429) return 'Terlalu banyak percobaan. Silakan tunggu beberapa saat lagi.';
    
    // Zod validation error parser from Hono @hono/zod-validator
    if (data?.error?.issues && Array.isArray(data.error.issues) && data.error.issues.length > 0) {
      return 'Input tidak valid. Periksa kembali data yang diisi.';
    }

    // Pesan bawaan dari backend jika ada dan relatif aman
    if (data?.message && typeof data.message === 'string' && !data.message.includes('SQL') && !data.message.includes('JWT')) {
        return data.message;
    }
    
    return 'Terjadi kesalahan pada server. Silakan coba lagi.';
  } else if (error.request) {
    return 'Gagal terhubung ke server. Periksa koneksi internet Anda.';
  } else {
    return 'Terjadi kesalahan. Silakan coba lagi.';
  }
};

export default api;
