// Current heads-of-state / heads-of-government for each country in COUNTRY_CHARTS.
// Birth data sourced from public biographical records. Times marked "12:00" are
// "noon-chart" approximations where exact birth time is not publicly recorded;
// in those cases the Moon sign and Sun sign are reliable but the Lagna (rising)
// is computed as a best-estimate placeholder. Times we DO have on record are exact.

export interface LeaderRecord {
  countryCode: string;       // ISO-2 matching CountryFoundation.code
  name: string;
  role: string;              // "President", "Prime Minister", etc.
  birthDate: string;         // YYYY-MM-DD
  birthTime: string;         // HH:MM 24h local civil
  timeKnown: boolean;        // false = noon-chart approximation
  tzOffset: number;          // hours from UTC at birth (incl. historical DST)
  lat: number;
  lon: number;
  city: string;
}

export const COUNTRY_LEADERS: LeaderRecord[] = [
  { countryCode: "US", name: "Donald J. Trump", role: "President",
    birthDate: "1946-06-14", birthTime: "10:54", timeKnown: true,
    tzOffset: -4, lat: 40.7128, lon: -73.9650, city: "Queens, NY" },
  { countryCode: "IN", name: "Narendra Modi", role: "Prime Minister",
    birthDate: "1950-09-17", birthTime: "11:00", timeKnown: true,
    tzOffset: 5.5, lat: 23.5880, lon: 72.3693, city: "Vadnagar" },
  { countryCode: "GB", name: "Keir Starmer", role: "Prime Minister",
    birthDate: "1962-09-02", birthTime: "12:00", timeKnown: false,
    tzOffset: 1, lat: 51.5072, lon: -0.1276, city: "London" },
  { countryCode: "FR", name: "Emmanuel Macron", role: "President",
    birthDate: "1977-12-21", birthTime: "10:40", timeKnown: true,
    tzOffset: 1, lat: 49.8941, lon: 2.2958, city: "Amiens" },
  { countryCode: "DE", name: "Friedrich Merz", role: "Chancellor",
    birthDate: "1955-11-11", birthTime: "12:00", timeKnown: false,
    tzOffset: 1, lat: 51.0303, lon: 8.7506, city: "Brilon" },
  { countryCode: "CN", name: "Xi Jinping", role: "President & General Secretary",
    birthDate: "1953-06-15", birthTime: "12:00", timeKnown: false,
    tzOffset: 8, lat: 39.9042, lon: 116.4074, city: "Beijing" },
  { countryCode: "RU", name: "Vladimir Putin", role: "President",
    birthDate: "1952-10-07", birthTime: "09:30", timeKnown: true,
    tzOffset: 3, lat: 59.9311, lon: 30.3609, city: "Leningrad" },
  { countryCode: "JP", name: "Sanae Takaichi", role: "Prime Minister",
    birthDate: "1961-03-07", birthTime: "12:00", timeKnown: false,
    tzOffset: 9, lat: 34.6851, lon: 135.8048, city: "Nara" },
  { countryCode: "BR", name: "Luiz Inácio Lula da Silva", role: "President",
    birthDate: "1945-10-27", birthTime: "12:00", timeKnown: false,
    tzOffset: -3, lat: -8.6667, lon: -36.4167, city: "Caetés" },
  { countryCode: "CA", name: "Mark Carney", role: "Prime Minister",
    birthDate: "1965-03-16", birthTime: "12:00", timeKnown: false,
    tzOffset: -7, lat: 60.7212, lon: -135.0568, city: "Fort Smith" },
  { countryCode: "AU", name: "Anthony Albanese", role: "Prime Minister",
    birthDate: "1963-03-02", birthTime: "12:00", timeKnown: false,
    tzOffset: 11, lat: -33.8688, lon: 151.2093, city: "Sydney" },
  { countryCode: "MX", name: "Claudia Sheinbaum", role: "President",
    birthDate: "1962-06-24", birthTime: "12:00", timeKnown: false,
    tzOffset: -6, lat: 19.4326, lon: -99.1332, city: "Mexico City" },
  { countryCode: "ID", name: "Prabowo Subianto", role: "President",
    birthDate: "1951-10-17", birthTime: "12:00", timeKnown: false,
    tzOffset: 7.5, lat: -6.2088, lon: 106.8456, city: "Jakarta" },
  { countryCode: "PK", name: "Shehbaz Sharif", role: "Prime Minister",
    birthDate: "1951-09-23", birthTime: "12:00", timeKnown: false,
    tzOffset: 5, lat: 31.5204, lon: 74.3587, city: "Lahore" },
  { countryCode: "BD", name: "Muhammad Yunus", role: "Chief Adviser",
    birthDate: "1940-06-28", birthTime: "12:00", timeKnown: false,
    tzOffset: 6, lat: 22.3569, lon: 91.7832, city: "Chittagong" },
  { countryCode: "NG", name: "Bola Tinubu", role: "President",
    birthDate: "1952-03-29", birthTime: "12:00", timeKnown: false,
    tzOffset: 1, lat: 6.5244, lon: 3.3792, city: "Lagos" },
  { countryCode: "ZA", name: "Cyril Ramaphosa", role: "President",
    birthDate: "1952-11-17", birthTime: "12:00", timeKnown: false,
    tzOffset: 2, lat: -26.2041, lon: 28.0473, city: "Johannesburg" },
  { countryCode: "EG", name: "Abdel Fattah el-Sisi", role: "President",
    birthDate: "1954-11-19", birthTime: "12:00", timeKnown: false,
    tzOffset: 2, lat: 30.0444, lon: 31.2357, city: "Cairo" },
  { countryCode: "SA", name: "Mohammed bin Salman", role: "Crown Prince & PM",
    birthDate: "1985-08-31", birthTime: "12:00", timeKnown: false,
    tzOffset: 3, lat: 24.7136, lon: 46.6753, city: "Riyadh" },
  { countryCode: "IR", name: "Masoud Pezeshkian", role: "President",
    birthDate: "1954-09-29", birthTime: "12:00", timeKnown: false,
    tzOffset: 3.5, lat: 36.6700, lon: 48.4900, city: "Mahabad" },
  { countryCode: "IL", name: "Benjamin Netanyahu", role: "Prime Minister",
    birthDate: "1949-10-21", birthTime: "10:00", timeKnown: true,
    tzOffset: 2, lat: 32.0853, lon: 34.7818, city: "Tel Aviv" },
  { countryCode: "TR", name: "Recep Tayyip Erdoğan", role: "President",
    birthDate: "1954-02-26", birthTime: "12:00", timeKnown: false,
    tzOffset: 2, lat: 41.0082, lon: 28.9784, city: "Istanbul" },
  { countryCode: "IT", name: "Giorgia Meloni", role: "Prime Minister",
    birthDate: "1977-01-15", birthTime: "12:00", timeKnown: false,
    tzOffset: 1, lat: 41.9028, lon: 12.4964, city: "Rome" },
  { countryCode: "ES", name: "Pedro Sánchez", role: "Prime Minister",
    birthDate: "1972-02-29", birthTime: "12:00", timeKnown: false,
    tzOffset: 1, lat: 40.4168, lon: -3.7038, city: "Madrid" },
  { countryCode: "KR", name: "Lee Jae-myung", role: "President",
    birthDate: "1963-12-22", birthTime: "12:00", timeKnown: false,
    tzOffset: 9, lat: 36.5500, lon: 128.7300, city: "Andong" },
  { countryCode: "AR", name: "Javier Milei", role: "President",
    birthDate: "1970-10-22", birthTime: "12:00", timeKnown: false,
    tzOffset: -3, lat: -34.6037, lon: -58.3816, city: "Buenos Aires" },
  { countryCode: "VN", name: "Tô Lâm", role: "General Secretary",
    birthDate: "1957-07-10", birthTime: "12:00", timeKnown: false,
    tzOffset: 7, lat: 20.7610, lon: 105.7800, city: "Hưng Yên" },
  { countryCode: "TH", name: "Anutin Charnvirakul", role: "Prime Minister",
    birthDate: "1966-09-13", birthTime: "12:00", timeKnown: false,
    tzOffset: 7, lat: 13.7563, lon: 100.5018, city: "Bangkok" },
  { countryCode: "PH", name: "Ferdinand Marcos Jr.", role: "President",
    birthDate: "1957-09-13", birthTime: "12:00", timeKnown: false,
    tzOffset: 8, lat: 14.5995, lon: 120.9842, city: "Manila" },
  { countryCode: "UA", name: "Volodymyr Zelenskyy", role: "President",
    birthDate: "1978-01-25", birthTime: "12:00", timeKnown: false,
    tzOffset: 3, lat: 47.9105, lon: 33.3918, city: "Kryvyi Rih" },
];

export function getLeaderForCountry(code: string): LeaderRecord | undefined {
  return COUNTRY_LEADERS.find((l) => l.countryCode === code);
}
