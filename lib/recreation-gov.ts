import { dateKey, type RecreationCampsite } from "@/lib/availability";

const BASE_URL = "https://www.recreation.gov";
const USER_AGENT = "CampCrawler/1.0 (read-only availability checker)";

export type FetchMonthResult = {
  campsites: Record<string, RecreationCampsite>;
};

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const retryAfterMilliseconds = (response: Response, attempt: number) => {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter && /^\d+$/.test(retryAfter)) return Number(retryAfter) * 1_000;
  return 1_000 * (attempt + 1);
};

export async function fetchCampgroundMonth(facilityId: string, monthStart: Date): Promise<FetchMonthResult> {
  const url = new URL(`/api/camps/availability/campground/${facilityId}/month`, BASE_URL);
  url.searchParams.set("start_date", `${dateKey(monthStart).slice(0, 7)}-01T00:00:00.000Z`);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        signal: controller.signal,
        cache: "no-store",
      });
      if (response.ok) {
        const payload = (await response.json()) as { campsites?: Record<string, RecreationCampsite> };
        return { campsites: payload.campsites ?? {} };
      }
      if (response.status === 429 && attempt < 3) {
        await sleep(retryAfterMilliseconds(response, attempt));
        continue;
      }
      throw new Error(`Recreation.gov returned HTTP ${response.status}`);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("Recreation.gov rate-limited this search after retrying");
}

export const requestDelay = () => sleep(1_000);
