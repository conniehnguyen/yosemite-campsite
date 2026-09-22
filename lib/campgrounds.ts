import type { Campground } from "@/types/search";

export const CAMPGROUNDS: Campground[] = [
  { name: "Upper Pines", id: "232447" },
  { name: "Lower Pines", id: "232450" },
  { name: "North Pines", id: "232449" },
  { name: "Wawona", id: "232446" },
  { name: "Hodgdon Meadow", id: "232451" },
];

export const CAMPGROUND_BY_ID = new Map(CAMPGROUNDS.map((campground) => [campground.id, campground]));
