/**
 * Memformat string ISO timestamp ke format tanggal dan waktu Indonesia
 */
export const formatDateTime = (
  dateString?: string | null,
  includeTime = true,
  shortMonth = false
): string => {
  if (!dateString) return '-';

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';

    const day = date.getDate();
    const monthIndex = date.getMonth();
    const year = date.getFullYear();

    const monthsLong = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    const monthsShort = [
      'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
      'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
    ];

    const monthName = shortMonth ? monthsShort[monthIndex] : monthsLong[monthIndex];
    let result = `${day} ${monthName} ${year}`;

    if (includeTime) {
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      result += ` ${hours}:${minutes} WIB`;
    }

    return result;
  } catch {
    return '-';
  }
};

/**
 * Format angka ke mata uang Rupiah
 */
export const formatCurrency = (amount?: number | null): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount ?? 0);
};
