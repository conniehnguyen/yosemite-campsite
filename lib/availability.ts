import type { AvailabilityMatch, SearchRequest } from "@/types/search";
import type { Campground } from "@/types/search";

export type RecreationCampsite = {
  campsite_id?: string | number;
  campsite_name?: string;
  site?: string;
  loop?: string;
  campsite_type?: string;
  max_num_people?: string | number;
  min_num_people?: string | number;
  availabilities?: Record<string, string>;
};

export const addMonths = (value: Date, months: number) => {
  const result = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1));
  const daysInTargetMonth = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(value.getUTCDate(), daysInTargetMonth));
  return result;
};

export const addDays = (value: Date, days: number) => {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

export const dateKey = (value: Date) => value.toISOString().slice(0, 10);

export const monthStarts = (start: Date, end: Date) => {
  const months: Date[] = [];
  let current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (current <= end) {
    months.push(current);
    current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1));
  }
  return months;
};

export const normalizeStatus = (status?: string) => {
  if (status === "Open") return "Available";
  if (status === "NYR") return "Not Reservable";
  return status ?? "Unknown";
};

const siteName = (site: RecreationCampsite) =>
  String(site.site ?? site.campsite_name ?? site.campsite_id ?? "Unknown site");

const maximumPeople = (site: RecreationCampsite): number | null => {
  for (const candidate of [site.max_num_people, site.min_num_people]) {
    if (typeof candidate === "number") return candidate;
    if (typeof candidate === "string" && /^\d+$/.test(candidate)) return Number(candidate);
  }
  return null;
};

const campsiteTypeAllowed = (site: RecreationCampsite) => {
  const campsiteType = String(site.campsite_type ?? "").toUpperCase();
  const allowed = ["STANDARD", "TENT", "RV"];
  const excluded = ["GROUP", "HORSE", "MANAGEMENT"];
  return allowed.some((part) => campsiteType.includes(part)) && !excluded.some((part) => campsiteType.includes(part));
};

const siteMatchesFilters = (site: RecreationCampsite, partySize: number) => {
  const people = maximumPeople(site);
  return campsiteTypeAllowed(site) && (people === null || people >= partySize);
};

const availableWindows = (site: RecreationCampsite, start: Date, end: Date, minimumNights: number) => {
  const windows: Array<{ arrival: Date; departure: Date; nights: number }> = [];
  const availabilities = site.availabilities ?? {};
  let windowStart: Date | null = null;

  for (let current = new Date(start); current <= end; current = addDays(current, 1)) {
    const isAvailable = normalizeStatus(availabilities[`${dateKey(current)}T00:00:00Z`]) === "Available";
    if (isAvailable && !windowStart) windowStart = new Date(current);
    if ((!isAvailable || current.getTime() === end.getTime()) && windowStart) {
      const lastAvailable = isAvailable ? current : addDays(current, -1);
      const nights = Math.round((lastAvailable.getTime() - windowStart.getTime()) / 86_400_000) + 1;
      if (nights >= minimumNights) {
        windows.push({ arrival: windowStart, departure: addDays(lastAvailable, 1), nights });
      }
      windowStart = null;
    }
  }
  return windows;
};

export const findMatches = (
  campground: Campground,
  campsites: Iterable<RecreationCampsite>,
  request: SearchRequest,
  start: Date,
  end: Date,
): AvailabilityMatch[] => {
  const matches: AvailabilityMatch[] = [];
  for (const site of campsites) {
    if (!siteMatchesFilters(site, request.partySize)) continue;
    const campsiteId = String(site.campsite_id ?? "");
    for (const window of availableWindows(site, start, end, request.minConsecutiveNights)) {
      matches.push({
        campground: campground.name,
        facilityId: campground.id,
        site: siteName(site),
        campsiteId,
        loop: String(site.loop ?? ""),
        campsiteType: String(site.campsite_type ?? ""),
        arrival: dateKey(window.arrival),
        departure: dateKey(window.departure),
        nights: window.nights,
        maxPeople: maximumPeople(site),
        recreationUrl: `https://www.recreation.gov/camping/campgrounds/${campground.id}/campsites/${campsiteId}`,
      });
    }
  }
  return matches;
};
