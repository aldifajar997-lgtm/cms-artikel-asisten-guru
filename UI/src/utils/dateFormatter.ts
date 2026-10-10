/**
 * Mengonversi string waktu (UTC) dari backend menjadi format lokal WIB (Waktu Indonesia Barat)
 * Memaksa penggunaan zona waktu 'Asia/Jakarta' terlepas dari zona waktu browser pengguna.
 */
export const formatDateTime = (dateString: string | Date | null, includeTime: boolean = true, forceWIB: boolean = false): string => {
  if (!dateString) return '-';
  let parsedString = dateString;
  
  if (typeof parsedString === 'string') {
    if (!parsedString.includes('T') && !parsedString.includes('Z')) {
      parsedString = parsedString.replace(' ', 'T') + 'Z';
    } else if (parsedString.includes('T') && !parsedString.endsWith('Z') && !parsedString.match(/[+-]\d{2}:?\d{2}$/)) {
      parsedString = parsedString + 'Z';
    }
  }

  const date = new Date(parsedString);
  
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  };
  
  if (forceWIB) {
    options.timeZone = 'Asia/Jakarta';
  }

  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.hour12 = false;
  }

  const formattedDate = new Intl.DateTimeFormat('id-ID', options).format(date);
  return forceWIB ? `${formattedDate} WIB` : formattedDate;
};
