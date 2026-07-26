export interface PublicHoliday {
  date: string;
  name: string;
  localName: string;
}

export interface HolidayCountry {
  code: string;
  name: string;
}

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const holidayCache = new Map<string, CacheEntry<PublicHoliday[]>>();
let countriesCache: CacheEntry<HolidayCountry[]> | null = null;

/** Fallback picker list if AvailableCountries is unreachable. */
export const HOLIDAY_COUNTRIES: HolidayCountry[] = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "IE", name: "Ireland" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "CH", name: "Switzerland" },
  { code: "AT", name: "Austria" },
  { code: "PT", name: "Portugal" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "AR", name: "Argentina" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "SG", name: "Singapore" },
  { code: "PH", name: "Philippines" },
  { code: "ID", name: "Indonesia" },
  { code: "VN", name: "Vietnam" },
  { code: "ZA", name: "South Africa" },
  { code: "NG", name: "Nigeria" },
  { code: "EG", name: "Egypt" },
  { code: "TR", name: "Turkey" },
  { code: "PL", name: "Poland" },
  { code: "CZ", name: "Czechia" },
  { code: "RO", name: "Romania" },
  { code: "HU", name: "Hungary" },
  { code: "GR", name: "Greece" },
  { code: "UA", name: "Ukraine" },
];

export function normalizeCountryCode(code: string): string | null {
  const normalized = code.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

function dedupeHolidays(holidays: PublicHoliday[]): PublicHoliday[] {
  const seen = new Set<string>();
  const out: PublicHoliday[] = [];
  for (const h of holidays) {
    const key = `${h.date}|${h.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

/**
 * Nager v4 returns the actual calendar holiday date (e.g. Jul 4),
 * not the substitute/observed weekday used by banks (e.g. Jul 3).
 * Prefer v4 for content calendars. Fall back to v3 if v4 is unavailable.
 */
export async function fetchPublicHolidays(
  year: number,
  countryCode: string
): Promise<PublicHoliday[]> {
  const country = normalizeCountryCode(countryCode);
  if (!country || !Number.isFinite(year) || year < 1970 || year > 2100) {
    return [];
  }

  const cacheKey = `v4:${country}:${year}`;
  const cached = holidayCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    let holidays = await fetchHolidaysV4(country, year);
    if (holidays.length === 0) {
      holidays = await fetchHolidaysV3(country, year);
    }

    holidays = dedupeHolidays(holidays);
    holidayCache.set(cacheKey, {
      value: holidays,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return holidays;
  } catch {
    return [];
  }
}

async function fetchHolidaysV4(
  country: string,
  year: number
): Promise<PublicHoliday[]> {
  const res = await fetch(
    `https://date.nager.at/api/v4/Holidays/${country}/${year}`,
    { next: { revalidate: 86400 } }
  );
  if (!res.ok) return [];

  const data = (await res.json()) as Array<{
    date?: string;
    name?: string;
  }>;

  return data
    .filter((h) => typeof h.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(h.date))
    .map((h) => {
      const name = (h.name || "Holiday").trim() || "Holiday";
      return { date: h.date as string, name, localName: name };
    });
}

async function fetchHolidaysV3(
  country: string,
  year: number
): Promise<PublicHoliday[]> {
  const res = await fetch(
    `https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`,
    { next: { revalidate: 86400 } }
  );
  if (!res.ok) return [];

  const data = (await res.json()) as Array<{
    date?: string;
    name?: string;
    localName?: string;
  }>;

  // v3 often shifts weekends to observed weekdays. Prefer the earliest
  // date for the same English name within a short window so we lean
  // toward the cultural/calendar date when both appear (e.g. AU Anzac).
  const byName = new Map<string, PublicHoliday[]>();
  for (const h of data) {
    if (typeof h.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(h.date)) {
      continue;
    }
    const name = (h.name || h.localName || "Holiday").trim() || "Holiday";
    const localName = (h.localName || h.name || name).trim() || name;
    const entry = { date: h.date, name, localName };
    const list = byName.get(name.toLowerCase()) ?? [];
    list.push(entry);
    byName.set(name.toLowerCase(), list);
  }

  const holidays: PublicHoliday[] = [];
  for (const list of byName.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date));
    // If duplicates within 3 days, keep the earliest (actual date).
    const kept: PublicHoliday[] = [];
    for (const item of list) {
      const prev = kept[kept.length - 1];
      if (!prev) {
        kept.push(item);
        continue;
      }
      const prevTime = Date.parse(`${prev.date}T12:00:00Z`);
      const curTime = Date.parse(`${item.date}T12:00:00Z`);
      if (curTime - prevTime <= 3 * 24 * 60 * 60 * 1000) {
        continue;
      }
      kept.push(item);
    }
    holidays.push(...kept);
  }

  return holidays.sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchHolidayCountries(): Promise<HolidayCountry[]> {
  if (countriesCache && countriesCache.expiresAt > Date.now()) {
    return countriesCache.value;
  }

  try {
    const res = await fetch(
      "https://date.nager.at/api/v3/AvailableCountries",
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return HOLIDAY_COUNTRIES;

    const data = (await res.json()) as Array<{
      countryCode?: string;
      name?: string;
    }>;

    const countries = data
      .map((c) => ({
        code: (c.countryCode || "").toUpperCase(),
        name: (c.name || c.countryCode || "").trim(),
      }))
      .filter((c) => /^[A-Z]{2}$/.test(c.code) && c.name)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (countries.length === 0) return HOLIDAY_COUNTRIES;

    countriesCache = {
      value: countries,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    return countries;
  } catch {
    return HOLIDAY_COUNTRIES;
  }
}
