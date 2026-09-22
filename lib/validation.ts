import { CAMPGROUND_BY_ID } from "@/lib/campgrounds";
import type { SearchRequest } from "@/types/search";

const MAX_MONTHS = 6;
const MAX_NIGHTS = 14;
const MAX_PARTY_SIZE = 12;

const integerInRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

export const parseSearchRequest = (value: unknown): SearchRequest => {
  if (!value || typeof value !== "object") throw new Error("Request body must be a JSON object.");
  const input = value as Record<string, unknown>;
  const campgroundIds = input.campgroundIds;
  if (!Array.isArray(campgroundIds) || campgroundIds.length < 1 || campgroundIds.length > CAMPGROUND_BY_ID.size) {
    throw new Error("Select between one and five campgrounds.");
  }
  if (!campgroundIds.every((id) => typeof id === "string" && CAMPGROUND_BY_ID.has(id))) {
    throw new Error("One or more selected campgrounds are not supported.");
  }
  if (new Set(campgroundIds).size !== campgroundIds.length) throw new Error("Campgrounds cannot be selected more than once.");
  if (typeof input.startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) {
    throw new Error("Start date must use YYYY-MM-DD format.");
  }
  const parsedDate = new Date(`${input.startDate}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== input.startDate) {
    throw new Error("Start date is not valid.");
  }
  if (!integerInRange(input.monthsAhead, 1, MAX_MONTHS)) throw new Error(`Search range must be between 1 and ${MAX_MONTHS} months.`);
  if (!integerInRange(input.minConsecutiveNights, 1, MAX_NIGHTS)) throw new Error(`Minimum nights must be between 1 and ${MAX_NIGHTS}.`);
  if (!integerInRange(input.partySize, 1, MAX_PARTY_SIZE)) throw new Error(`Party size must be between 1 and ${MAX_PARTY_SIZE}.`);

  return {
    campgroundIds: campgroundIds as string[],
    startDate: input.startDate,
    monthsAhead: input.monthsAhead,
    minConsecutiveNights: input.minConsecutiveNights,
    partySize: input.partySize,
  };
};
