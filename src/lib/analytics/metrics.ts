/** Deterministic pseudo-random metrics until platform API sync is wired. */
function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function seededInt(seed: string, min: number, max: number): number {
  const h = hashSeed(seed);
  return min + (h % (max - min + 1));
}

export interface SimulatedMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagementRate: number;
}

export function simulatePlatformMetrics(
  distributionId: string,
  platform: string
): SimulatedMetrics {
  const base = hashSeed(`${distributionId}:${platform}`);
  const views = seededInt(`${base}:views`, 800, 85000);
  const likes = Math.floor(views * (0.03 + (base % 50) / 1000));
  const comments = Math.floor(likes * (0.05 + (base % 30) / 1000));
  const shares = Math.floor(likes * (0.08 + (base % 20) / 1000));
  const saves = Math.floor(likes * (0.12 + (base % 25) / 1000));
  const engagements = likes + comments + shares + saves;
  const engagementRate =
    views > 0 ? Math.round((engagements / views) * 10000) : 0;

  return { views, likes, comments, shares, saves, engagementRate };
}

export function simulateNewFollowers(accountId: string, platform: string): number {
  return seededInt(`${accountId}:${platform}:followers`, 2, 120);
}

export function simulateFollowerCount(accountId: string): number {
  return seededInt(`${accountId}:total`, 500, 50000);
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function formatDayOfWeek(dow: number): string {
  return DAY_NAMES[dow] ?? "Unknown";
}

export function formatHour(hour: number): string {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? "AM" : "PM";
  return `${h}:00 ${ampm}`;
}
