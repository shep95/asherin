// Foundation horoscopes for nations — independence/constitution moment in local civil time.
// Sources: standard mundane astrology references (Campion, Lahiri, Bishop datasets).
// All times are official local civil time at the capital on the founding day.

export interface CountryFoundation {
  code: string;       // ISO-2
  name: string;
  flag: string;       // emoji
  event: string;      // "Independence", "Republic Constitution", etc.
  birthDate: string;  // YYYY-MM-DD (local civil)
  birthTime: string;  // HH:MM (local civil, 24h)
  tzOffset: number;   // hours from UTC at that moment (incl. historical DST)
  lat: number;
  lon: number;
  city: string;
}

export const COUNTRY_CHARTS: CountryFoundation[] = [
  { code: "US", name: "United States", flag: "🇺🇸", event: "Declaration of Independence",
    birthDate: "1776-07-04", birthTime: "17:10", tzOffset: -5.0, lat: 39.9526, lon: -75.1652, city: "Philadelphia" },
  { code: "IN", name: "India", flag: "🇮🇳", event: "Independence",
    birthDate: "1947-08-15", birthTime: "00:00", tzOffset: 5.5, lat: 28.6139, lon: 77.2090, city: "New Delhi" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", event: "Act of Union",
    birthDate: "1801-01-01", birthTime: "00:00", tzOffset: 0, lat: 51.5074, lon: -0.1278, city: "London" },
  { code: "FR", name: "France (Fifth Republic)", flag: "🇫🇷", event: "Constitution",
    birthDate: "1958-10-05", birthTime: "00:00", tzOffset: 1, lat: 48.8566, lon: 2.3522, city: "Paris" },
  { code: "DE", name: "Germany (Reunified)", flag: "🇩🇪", event: "Reunification",
    birthDate: "1990-10-03", birthTime: "00:00", tzOffset: 2, lat: 52.5200, lon: 13.4050, city: "Berlin" },
  { code: "CN", name: "China (PRC)", flag: "🇨🇳", event: "Proclamation of PRC",
    birthDate: "1949-10-01", birthTime: "15:15", tzOffset: 8, lat: 39.9042, lon: 116.4074, city: "Beijing" },
  { code: "RU", name: "Russian Federation", flag: "🇷🇺", event: "Sovereignty Declaration",
    birthDate: "1991-12-25", birthTime: "19:45", tzOffset: 3, lat: 55.7558, lon: 37.6173, city: "Moscow" },
  { code: "JP", name: "Japan (Constitution)", flag: "🇯🇵", event: "Postwar Constitution",
    birthDate: "1947-05-03", birthTime: "00:00", tzOffset: 9, lat: 35.6762, lon: 139.6503, city: "Tokyo" },
  { code: "BR", name: "Brazil", flag: "🇧🇷", event: "Independence",
    birthDate: "1822-09-07", birthTime: "16:30", tzOffset: -3.0, lat: -23.5505, lon: -46.6333, city: "São Paulo" },
  { code: "CA", name: "Canada", flag: "🇨🇦", event: "Confederation",
    birthDate: "1867-07-01", birthTime: "00:00", tzOffset: -5, lat: 45.4215, lon: -75.6972, city: "Ottawa" },
  { code: "AU", name: "Australia", flag: "🇦🇺", event: "Federation",
    birthDate: "1901-01-01", birthTime: "00:00", tzOffset: 10, lat: -33.8688, lon: 151.2093, city: "Sydney" },
  { code: "MX", name: "Mexico", flag: "🇲🇽", event: "Independence",
    birthDate: "1810-09-16", birthTime: "11:00", tzOffset: -6.6166667, lat: 19.4326, lon: -99.1332, city: "Mexico City" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩", event: "Independence",
    birthDate: "1945-08-17", birthTime: "10:00", tzOffset: 7.5, lat: -6.2088, lon: 106.8456, city: "Jakarta" },
  { code: "PK", name: "Pakistan", flag: "🇵🇰", event: "Independence",
    birthDate: "1947-08-14", birthTime: "00:00", tzOffset: 5.5, lat: 33.6844, lon: 73.0479, city: "Karachi" },
  { code: "BD", name: "Bangladesh", flag: "🇧🇩", event: "Independence Proclamation",
    birthDate: "1971-03-26", birthTime: "00:30", tzOffset: 6, lat: 23.8103, lon: 90.4125, city: "Dhaka" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", event: "Independence",
    birthDate: "1960-10-01", birthTime: "00:00", tzOffset: 1, lat: 9.0765, lon: 7.3986, city: "Abuja" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", event: "New Constitution",
    birthDate: "1994-04-27", birthTime: "00:00", tzOffset: 2, lat: -25.7479, lon: 28.2293, city: "Pretoria" },
  { code: "EG", name: "Egypt", flag: "🇪🇬", event: "Republic Proclamation",
    birthDate: "1953-06-18", birthTime: "12:00", tzOffset: 2, lat: 30.0444, lon: 31.2357, city: "Cairo" },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦", event: "Unification",
    birthDate: "1932-09-23", birthTime: "00:00", tzOffset: 3, lat: 24.7136, lon: 46.6753, city: "Riyadh" },
  { code: "IR", name: "Iran (Islamic Republic)", flag: "🇮🇷", event: "Republic Proclamation",
    birthDate: "1979-04-01", birthTime: "15:00", tzOffset: 3.5, lat: 35.6892, lon: 51.3890, city: "Tehran" },
  { code: "IL", name: "Israel", flag: "🇮🇱", event: "Declaration of Independence",
    birthDate: "1948-05-14", birthTime: "16:00", tzOffset: 2, lat: 32.0853, lon: 34.7818, city: "Tel Aviv" },
  { code: "TR", name: "Turkey", flag: "🇹🇷", event: "Republic Proclamation",
    birthDate: "1923-10-29", birthTime: "20:30", tzOffset: 2, lat: 39.9334, lon: 32.8597, city: "Ankara" },
  { code: "IT", name: "Italy (Republic)", flag: "🇮🇹", event: "Republic Referendum",
    birthDate: "1946-06-18", birthTime: "18:00", tzOffset: 2, lat: 41.9028, lon: 12.4964, city: "Rome" },
  { code: "ES", name: "Spain (Constitution)", flag: "🇪🇸", event: "Constitution",
    birthDate: "1978-12-29", birthTime: "00:00", tzOffset: 1, lat: 40.4168, lon: -3.7038, city: "Madrid" },
  { code: "KR", name: "South Korea", flag: "🇰🇷", event: "Republic Proclamation",
    birthDate: "1948-08-15", birthTime: "11:00", tzOffset: 9, lat: 37.5665, lon: 126.9780, city: "Seoul" },
  { code: "AR", name: "Argentina", flag: "🇦🇷", event: "Independence",
    birthDate: "1816-07-09", birthTime: "12:00", tzOffset: -4.2833333, lat: -26.8083, lon: -65.2176, city: "Tucumán" },
  { code: "VN", name: "Vietnam", flag: "🇻🇳", event: "Independence Proclamation",
    birthDate: "1945-09-02", birthTime: "14:00", tzOffset: 7, lat: 21.0285, lon: 105.8542, city: "Hanoi" },
  { code: "TH", name: "Thailand (Constitution)", flag: "🇹🇭", event: "Constitutional Monarchy",
    birthDate: "1932-06-24", birthTime: "06:00", tzOffset: 7, lat: 13.7563, lon: 100.5018, city: "Bangkok" },
  { code: "PH", name: "Philippines", flag: "🇵🇭", event: "Independence",
    birthDate: "1946-07-04", birthTime: "09:15", tzOffset: 8, lat: 14.5995, lon: 120.9842, city: "Manila" },
  { code: "UA", name: "Ukraine", flag: "🇺🇦", event: "Independence",
    birthDate: "1991-08-24", birthTime: "17:59", tzOffset: 3, lat: 50.4501, lon: 30.5234, city: "Kyiv" },
];
