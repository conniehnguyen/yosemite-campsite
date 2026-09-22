export type Campground = {
  id: string;
  name: string;
};

export type SearchRequest = {
  campgroundIds: string[];
  startDate: string;
  monthsAhead: number;
  minConsecutiveNights: number;
  partySize: number;
};

export type AvailabilityMatch = {
  campground: string;
  facilityId: string;
  site: string;
  campsiteId: string;
  loop: string;
  campsiteType: string;
  arrival: string;
  departure: string;
  nights: number;
  maxPeople: number | null;
  recreationUrl: string;
};

export type SearchResponse = {
  generatedAt: string;
  search: SearchRequest;
  matchCount: number;
  matches: AvailabilityMatch[];
  warnings: string[];
};
