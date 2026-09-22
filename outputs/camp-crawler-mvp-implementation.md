# Camp Crawler Web App — MVP Implementation Plan

## Purpose

Turn the existing read-only Yosemite campground availability script into a Vercel-deployed web application. A visitor can search the supported campgrounds, review parsed availability windows, filter results by month and campground, and download the visible results as a `.txt` report.

This MVP does not make reservations, create user accounts, send email, or retain search history.

## Existing behavior to preserve

The reference implementation is [`yosemite_campsite_search.py`](../../camp-crawler/yosemite_campsite_search.py). It:

- Requests Recreation.gov availability one month at a time for each campground.
- Finds each continuous available date window that meets the selected minimum-night requirement.
- Filters by campsite type and party capacity.
- Returns the fields needed by the web application: campground, site, loop, campsite type, arrival and departure dates, available-night count, capacity, and a Recreation.gov booking URL.
- Waits between upstream requests and treats failed months as warnings rather than failing the entire search.

The web app must preserve one important semantic: one match is a complete continuous availability window. It does not expand a five-night open window into all possible two- or three-night stays.

`rv_length_ft` is present in the current configuration but is not implemented in the script. Exclude it from the MVP UI and API.

## MVP scope

### Included

- A public Yosemite campground search page.
- Search inputs: campground selection, start date, search range in months, minimum consecutive nights, and party size.
- The five existing campgrounds: Upper Pines, Lower Pines, North Pines, Wawona, and Hodgdon Meadow.
- A server-side availability search against Recreation.gov.
- Parsed, sortable results with links to the corresponding Recreation.gov campsite page.
- Client-side filters for campground and arrival month.
- Plain-text export of the currently filtered results.
- Clear loading, empty, partial-result, and error states.
- Deployment to Vercel.

### Explicitly deferred

- Accounts, saved searches, search history, or a database.
- Email or push notifications.
- Automated recurring scans.
- Adding arbitrary campground IDs through the public UI.
- Booking, checkout, or any interaction that changes a Recreation.gov reservation.
- RV-length filtering.

## Technical approach

Use a single Next.js application with TypeScript and the App Router.

```text
Browser
  ├─ Search form
  ├─ Results table + client-side filters
  └─ .txt download generator
          │
          ▼
POST /api/search (Node.js Vercel Function)
  ├─ Validate and constrain request
  ├─ Fetch Recreation.gov monthly availability
  ├─ Apply matching and filtering rules
  └─ Return normalized JSON with warnings
```

Port the crawler’s availability and matching functions to TypeScript instead of invoking the command-line Python program from the web app. This gives the app one runtime and one deployment path, while the Python script remains the behavioral reference.

Run the route handler in the Node.js runtime, never the Edge runtime, because it performs multiple outbound requests and deliberate throttling.

## Project structure

```text
camp-crawler-web/
  app/
    page.tsx                         # Search and results page
    api/search/route.ts              # Server-side search endpoint
  components/
    search-form.tsx
    result-filters.tsx
    results-table.tsx
    export-button.tsx
  lib/
    campgrounds.ts                   # Fixed supported campground list
    recreation-gov.ts                # Upstream API client and retries
    availability.ts                  # Pure window and matching logic
    export-results.ts                # Plain-text formatting
    validation.ts                    # Request schema
  types/
    search.ts
  tests/
    availability.test.ts
    fixtures/
      upper-pines-results.json
  vercel.json                        # Optional function/cron settings
```

## Data model

```ts
type Campground = {
  id: string;
  name: string;
};

type SearchRequest = {
  campgroundIds: string[];
  startDate: string;                 // YYYY-MM-DD
  monthsAhead: number;               // 1–6 for MVP
  minConsecutiveNights: number;      // 1–14 for MVP
  partySize: number;                 // 1–12 for MVP
};

type AvailabilityMatch = {
  campground: string;
  facilityId: string;
  site: string;
  campsiteId: string;
  loop: string;
  campsiteType: string;
  arrival: string;                   // YYYY-MM-DD
  departure: string;                 // YYYY-MM-DD
  nights: number;
  maxPeople: number | null;
  recreationUrl: string;
};

type SearchResponse = {
  generatedAt: string;
  search: SearchRequest;
  matchCount: number;
  matches: AvailabilityMatch[];
  warnings: string[];
};
```

## API contract

### `POST /api/search`

The endpoint accepts a `SearchRequest` JSON body and returns a `SearchResponse`.

Validation requirements:

- Require at least one supported campground ID.
- Reject unknown campground IDs; do not accept a raw URL or arbitrary upstream endpoint.
- Restrict `monthsAhead` to 1–6 and `minConsecutiveNights` to 1–14.
- Require ISO-formatted dates and sensible party sizes.
- Reject overly large requests before contacting Recreation.gov.

Upstream behavior:

- Fetch the Recreation.gov campground-month availability endpoint once per selected campground and month.
- Keep requests sequential initially, with a one-second delay between calls, matching the existing script’s conservative behavior.
- Retry HTTP 429 responses with bounded backoff and respect `Retry-After` when supplied.
- When one month fails, add a descriptive warning and return successful partial results.
- Do not cache an error response.

The initial largest allowed search is five campgrounds by six months: approximately 30 upstream requests. The endpoint should set an explicit Vercel `maxDuration` that supports this workload after a deployed test confirms typical execution time.

## Search behavior

1. Compute the inclusive date range from `startDate` and `monthsAhead`.
2. Fetch all required campground-month payloads.
3. Merge a campsite’s daily availability across months.
4. Keep campsites that:
   - match the supported campsite-type rules;
   - support at least `partySize`; and
   - have continuous available days for at least `minConsecutiveNights`.
5. Return results sorted by arrival date, campground, then site.

Initial campsite rules should match the Python configuration:

- Include types containing `STANDARD`, `TENT`, or `RV`.
- Exclude types containing `GROUP`, `HORSE`, or `MANAGEMENT`.
- Treat Recreation.gov `Open` as `Available`.

## User experience

### Initial screen

- Title and a short explanation that the app checks availability only and does not reserve a campsite.
- Search form with all five campgrounds checked by default.
- Defaults: today as the start date, six months ahead, two nights, and two people.
- A concise note that a full search can take up to about a minute.

### During a search

- Disable the submit button to prevent duplicate requests.
- Show an active progress message such as “Checking 5 campgrounds across 6 months…”.
- Let the request finish even when a single campground/month fails; show warnings with the final results.

### Results

- Show generated time, result count, and any partial-data warnings.
- Table columns: campground, site, type, loop, arrival, departure, nights, capacity, and booking link.
- Offer two multi-select filters:
  - Campground
  - Arrival month
- Apply filters only in the browser; never re-run the upstream search when a visitor filters.
- Display the count after filtering.
- Use an accessible empty state when no result matches the search or the selected filters.

### Text export

The Export button creates a local download named `camp-crawler-results-YYYY-MM-DD.txt`. It contains:

```text
Camp Crawler Results
Generated: 2026-09-21T10:00:00-07:00
Visible matches: 2
Filters: Upper Pines; November 2026

Upper Pines — Site 042
Standard Nonelectric, loop Upper Pines, max 6 people
2026-11-11 to 2026-11-14 (3 nights)
https://www.recreation.gov/camping/campgrounds/232447/campsites/97
```

Export exactly the matches visible after the visitor applies filters.

## Reliability, safety, and cost controls

- Keep Recreation.gov requests in the server route; do not expose raw upstream calls in the client.
- Use only a fixed allowlist of campground IDs.
- Cap the search size as described above.
- Add a durable IP-based rate limit before publicly sharing the app. A managed rate-limit store is appropriate because serverless instances do not retain reliable in-memory state.
- Add short caching for identical successful searches after the initial release. A five-minute cache reduces repeated upstream traffic without making availability appear stale for long.
- Log only operational metadata and error details; do not log user IP addresses or request bodies unless needed by the chosen rate-limit provider.
- Show partial data as warnings, not as a misleading “complete” result.

## Testing

### Unit tests

- Month-boundary date calculation.
- Availability-window detection, including the final day of a range.
- Minimum-night filtering.
- Party-size and campsite-type filtering.
- Recreation.gov status normalization.
- Sort order.
- Plain-text export formatting and filtered-results behavior.

### Parity test

Store a sanitized response fixture and confirm the TypeScript implementation returns the same normalized matches as the current Python script for identical input.

### Integration test

- Use a mocked Recreation.gov response for reliable continuous integration.
- Manually run a small live search before release to validate upstream response shape, timing, throttling, and Vercel connectivity.

### Acceptance checklist

- [ ] A visitor can run a search for any one supported campground.
- [ ] A visitor can run a multi-campground search within the configured limit.
- [ ] Every returned result has a working Recreation.gov campsite link.
- [ ] Month and campground filters update the visible result count without a new API request.
- [ ] Exported `.txt` content matches the visible filtered results.
- [ ] No-result, API-error, and partial-result cases are understandable.
- [ ] Invalid requests are rejected without making upstream calls.
- [ ] The deployed function completes a maximum-size search within its configured duration.

## Deployment plan

1. Create a Git repository for the web app and connect it to Vercel.
2. Deploy preview environments for pull requests.
3. Configure the search route for the Node.js runtime and an explicit maximum duration appropriate to the completed timing test.
4. Add production environment variables only if a rate-limit or monitoring provider is selected. The initial search itself needs no secret credentials.
5. Test one single-campground and one maximum-size search on the production deployment.
6. Review Vercel function logs and upstream warnings after launch.

Vercel function duration limits vary by plan and configuration. Confirm the current setting during deployment using Vercel’s [function limits documentation](https://vercel.com/docs/functions/limitations).

## Post-MVP options

- Scheduled daily scans with Vercel Cron Jobs and a persistent result store.
- Email notifications when new matches appear.
- Saved searches and login.
- More campgrounds and configurable campsite-type rules.
- Calendar or grid view of availability.
- CSV export and shareable result URLs.

## Implementation decision needed before build

Use the existing Yosemite-only list for the MVP. Supporting user-entered Recreation.gov facility IDs should be a later, explicitly rate-limited feature because it materially changes the load and abuse profile of the search endpoint.
