import { NextRequest, NextResponse } from "next/server";
import { addDays, addMonths, findMatches, monthStarts, type RecreationCampsite } from "@/lib/availability";
import { CAMPGROUND_BY_ID } from "@/lib/campgrounds";
import { fetchCampgroundMonth, requestDelay } from "@/lib/recreation-gov";
import { parseSearchRequest } from "@/lib/validation";
import type { AvailabilityMatch, SearchResponse } from "@/types/search";

export const runtime = "nodejs";
export const maxDuration = 60;

const errorResponse = (message: string, status: number) => NextResponse.json({ error: message }, { status });

export async function POST(request: NextRequest) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }

  let search;
  try {
    search = parseSearchRequest(input);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Invalid search request.", 400);
  }

  const start = new Date(`${search.startDate}T00:00:00.000Z`);
  // Six months means six full months of dates, starting from the selected date.
  const end = addDays(addMonths(start, search.monthsAhead), -1);
  const months = monthStarts(start, end);
  const warnings: string[] = [];
  const matches: AvailabilityMatch[] = [];
  let successfulMonthRequests = 0;

  for (const campgroundId of search.campgroundIds) {
    const campground = CAMPGROUND_BY_ID.get(campgroundId);
    if (!campground) continue;
    const mergedCampsites = new Map<string, RecreationCampsite>();

    for (const month of months) {
      try {
        const payload = await fetchCampgroundMonth(campground.id, month);
        successfulMonthRequests += 1;
        for (const [campsiteId, campsite] of Object.entries(payload.campsites)) {
          const existing = mergedCampsites.get(campsiteId);
          if (existing) {
            existing.availabilities = { ...existing.availabilities, ...campsite.availabilities };
          } else {
            mergedCampsites.set(campsiteId, {
              ...campsite,
              campsite_id: campsite.campsite_id ?? campsiteId,
              availabilities: { ...campsite.availabilities },
            });
          }
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Unknown error";
        warnings.push(`${campground.name}, ${month.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}: ${detail}`);
      }

      // Throttle every request, including after failures, so public searches remain polite to the upstream service.
      await requestDelay();
    }

    matches.push(...findMatches(campground, mergedCampsites.values(), search, start, end));
  }

  if (successfulMonthRequests === 0) {
    return errorResponse("Recreation.gov could not be reached for this search. Please try again shortly.", 502);
  }

  matches.sort((left, right) =>
    left.arrival.localeCompare(right.arrival) || left.campground.localeCompare(right.campground) || left.site.localeCompare(right.site),
  );

  const response: SearchResponse = {
    generatedAt: new Date().toISOString(),
    search,
    matchCount: matches.length,
    matches,
    warnings,
  };

  return NextResponse.json(response, {
    headers: { "Cache-Control": "no-store" },
  });
}
