/**
 * Weather at popular destinations for the Travel page, from Open-Meteo (free, no key).
 * One request for every place, cached 30 minutes.
 */
export type Place = { id: string; vi: string; en: string; lat: number; lon: number; region: "vn" | "intl" };
export type Weather = Place & { temp: number; code: number; min: number; max: number };

export const PLACES: Place[] = [
  { id: "hn", vi: "Hà Nội", en: "Hanoi", lat: 21.03, lon: 105.85, region: "vn" },
  { id: "sapa", vi: "Sa Pa", en: "Sa Pa", lat: 22.34, lon: 103.84, region: "vn" },
  { id: "halong", vi: "Hạ Long", en: "Ha Long", lat: 20.95, lon: 107.08, region: "vn" },
  { id: "hue", vi: "Huế", en: "Hue", lat: 16.46, lon: 107.59, region: "vn" },
  { id: "dn", vi: "Đà Nẵng", en: "Da Nang", lat: 16.05, lon: 108.2, region: "vn" },
  { id: "hoian", vi: "Hội An", en: "Hoi An", lat: 15.88, lon: 108.33, region: "vn" },
  { id: "nt", vi: "Nha Trang", en: "Nha Trang", lat: 12.24, lon: 109.19, region: "vn" },
  { id: "dl", vi: "Đà Lạt", en: "Da Lat", lat: 11.94, lon: 108.44, region: "vn" },
  { id: "hcm", vi: "TP.HCM", en: "Ho Chi Minh City", lat: 10.78, lon: 106.7, region: "vn" },
  { id: "pq", vi: "Phú Quốc", en: "Phu Quoc", lat: 10.22, lon: 103.96, region: "vn" },
  { id: "bkk", vi: "Bangkok", en: "Bangkok", lat: 13.76, lon: 100.5, region: "intl" },
  { id: "sg", vi: "Singapore", en: "Singapore", lat: 1.29, lon: 103.85, region: "intl" },
  { id: "seoul", vi: "Seoul", en: "Seoul", lat: 37.57, lon: 126.98, region: "intl" },
  { id: "tokyo", vi: "Tokyo", en: "Tokyo", lat: 35.68, lon: 139.69, region: "intl" },
  { id: "paris", vi: "Paris", en: "Paris", lat: 48.86, lon: 2.35, region: "intl" },
];

/** WMO weather code → icon and short label. */
export function describe(code: number, lang: "vi" | "en"): { icon: string; label: string } {
  const vi = lang === "vi";
  if (code === 0) return { icon: "☀️", label: vi ? "Nắng" : "Clear" };
  if (code <= 2) return { icon: "🌤️", label: vi ? "Ít mây" : "Partly cloudy" };
  if (code === 3) return { icon: "☁️", label: vi ? "Nhiều mây" : "Cloudy" };
  if (code <= 48) return { icon: "🌫️", label: vi ? "Sương mù" : "Fog" };
  if (code <= 57) return { icon: "🌦️", label: vi ? "Mưa phùn" : "Drizzle" };
  if (code <= 67 || (code >= 80 && code <= 82)) return { icon: "🌧️", label: vi ? "Mưa" : "Rain" };
  if (code <= 77 || code === 85 || code === 86) return { icon: "❄️", label: vi ? "Tuyết" : "Snow" };
  return { icon: "⛈️", label: vi ? "Dông" : "Storm" };
}

let memo: { at: number; data: Weather[] } | null = null;

export async function getWeather(): Promise<Weather[]> {
  if (process.env.MOCK_FEEDS === "1") {
    return PLACES.map((p, i) => ({ ...p, temp: 18 + ((i * 7) % 15), code: [0, 2, 3, 61, 1, 80, 0, 45][i % 8], min: 16 + (i % 6), max: 26 + (i % 7) }));
  }
  if (memo && Date.now() - memo.at < 30 * 60_000) return memo.data;
  try {
    const q = new URLSearchParams({
      latitude: PLACES.map((p) => p.lat).join(","),
      longitude: PLACES.map((p) => p.lon).join(","),
      current: "temperature_2m,weather_code",
      daily: "temperature_2m_max,temperature_2m_min",
      timezone: "auto",
      forecast_days: "1",
    });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(String(res.status));
    const json = (await res.json()) as any[];
    const data = PLACES.map((p, i) => ({
      ...p,
      temp: Math.round(json[i].current.temperature_2m),
      code: json[i].current.weather_code,
      min: Math.round(json[i].daily.temperature_2m_min[0]),
      max: Math.round(json[i].daily.temperature_2m_max[0]),
    }));
    memo = { at: Date.now(), data };
    return data;
  } catch (e) {
    console.warn("[weather]", String(e));
    return memo?.data ?? [];
  }
}
