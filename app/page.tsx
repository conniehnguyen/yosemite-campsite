"use client";

import { Dispatch, FormEvent, SetStateAction, useMemo, useState } from "react";
import { CAMPGROUNDS } from "@/lib/campgrounds";
import type { AvailabilityMatch, SearchRequest, SearchResponse } from "@/types/search";

type FormState = SearchRequest;

const today = () => new Date().toLocaleDateString("en-CA");

const initialForm: FormState = {
  campgroundIds: CAMPGROUNDS.map((campground) => campground.id),
  startDate: today(),
  monthsAhead: 6,
  minConsecutiveNights: 2,
  partySize: 2,
};

const displayDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );

const monthLabel = (value: string) =>
  new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${value}-01T00:00:00Z`),
  );

const makeExport = (matches: AvailabilityMatch[], response: SearchResponse, selectedCampgrounds: string[], selectedTypes: string[], selectedMonths: string[]) => {
  const camps = selectedCampgrounds.length ? selectedCampgrounds.join(", ") : "All campgrounds";
  const types = selectedTypes.length ? selectedTypes.join(", ") : "All site types";
  const months = selectedMonths.length ? selectedMonths.map(monthLabel).join(", ") : "All months";
  const lines = [
    "Camp Crawler Results",
    `Generated: ${new Date(response.generatedAt).toLocaleString()}`,
    `Visible matches: ${matches.length}`,
    `Filters: ${camps}; ${types}; ${months}`,
    "",
  ];
  for (const match of matches) {
    lines.push(`${match.campground} — Site ${match.site}`);
    lines.push(`${match.campsiteType}${match.loop ? `, loop ${match.loop}` : ""}${match.maxPeople ? `, max ${match.maxPeople} people` : ""}`);
    lines.push(`${match.arrival} to ${match.departure} (${match.nights} nights)`);
    lines.push(match.recreationUrl, "");
  }
  return lines.join("\n");
};

export default function Home() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [campgroundFilter, setCampgroundFilter] = useState<string[]>([]);
  const [siteTypeFilter, setSiteTypeFilter] = useState<string[]>([]);
  const [monthFilter, setMonthFilter] = useState<string[]>([]);

  const resultMonths = useMemo(
    () => Array.from(new Set(result?.matches.map((match) => match.arrival.slice(0, 7)) ?? [])).sort(),
    [result],
  );
  const resultCampgrounds = useMemo(
    () => Array.from(new Set(result?.matches.map((match) => match.campground) ?? [])).sort(),
    [result],
  );
  const resultSiteTypes = useMemo(
    () => Array.from(new Set(result?.matches.map((match) => match.campsiteType) ?? [])).sort(),
    [result],
  );
  const visibleMatches = useMemo(
    () =>
      (result?.matches ?? []).filter(
        (match) =>
          (!campgroundFilter.length || campgroundFilter.includes(match.campground)) &&
          (!siteTypeFilter.length || siteTypeFilter.includes(match.campsiteType)) &&
          (!monthFilter.length || monthFilter.includes(match.arrival.slice(0, 7))),
      ),
    [result, campgroundFilter, siteTypeFilter, monthFilter],
  );

  const toggleFormCampground = (id: string) => {
    setForm((current) => ({
      ...current,
      campgroundIds: current.campgroundIds.includes(id)
        ? current.campgroundIds.filter((item) => item !== id)
        : [...current.campgroundIds, id],
    }));
  };

  const toggleFilter = (value: string, setter: Dispatch<SetStateAction<string[]>>) => {
    setter((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setResult(null);
    setCampgroundFilter([]);
    setSiteTypeFilter([]);
    setMonthFilter([]);
    if (!form.campgroundIds.length) {
      setError("Select at least one campground before searching.");
      return;
    }
    setIsSearching(true);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as SearchResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Search could not be completed.");
      setResult(payload);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Search could not be completed.");
    } finally {
      setIsSearching(false);
    }
  };

  const download = () => {
    if (!result) return;
    const text = makeExport(visibleMatches, result, campgroundFilter, siteTypeFilter, monthFilter);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `camp-crawler-results-${today()}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Yosemite availability finder</p>
        <h1>Find an open campsite window.</h1>
        <p className="lede">Search selected Yosemite campgrounds, then filter and export the availability windows you want to keep.</p>
        <p className="notice">Camp Crawler checks availability only. It never reserves a campsite; booking happens on Recreation.gov.</p>
      </section>

      <section className="panel" aria-labelledby="search-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">New search</p>
            <h2 id="search-heading">Choose your trip</h2>
          </div>
          <p>Large searches can take about a minute.</p>
        </div>
        <form onSubmit={submit}>
          <fieldset className="campgrounds">
            <legend>Campgrounds</legend>
            <div className="campground-grid">
              {CAMPGROUNDS.map((campground) => (
                <label className="check-card" key={campground.id}>
                  <input
                    type="checkbox"
                    checked={form.campgroundIds.includes(campground.id)}
                    onChange={() => toggleFormCampground(campground.id)}
                  />
                  <span>{campground.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="form-grid">
            <label>
              Start date
              <input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} required />
            </label>
            <label>
              Search range
              <select value={form.monthsAhead} onChange={(event) => setForm({ ...form, monthsAhead: Number(event.target.value) })}>
                {[1, 2, 3, 4, 5, 6].map((months) => <option key={months} value={months}>{months} month{months > 1 ? "s" : ""}</option>)}
              </select>
            </label>
            <label>
              Minimum nights
              <select value={form.minConsecutiveNights} onChange={(event) => setForm({ ...form, minConsecutiveNights: Number(event.target.value) })}>
                {Array.from({ length: 14 }, (_, index) => index + 1).map((nights) => <option key={nights} value={nights}>{nights} night{nights > 1 ? "s" : ""}</option>)}
              </select>
            </label>
            <label>
              People
              <select value={form.partySize} onChange={(event) => setForm({ ...form, partySize: Number(event.target.value) })}>
                {Array.from({ length: 12 }, (_, index) => index + 1).map((people) => <option key={people} value={people}>{people} {people === 1 ? "person" : "people"}</option>)}
              </select>
            </label>
          </div>
          <button className="primary" type="submit" disabled={isSearching}>
            {isSearching ? "Checking availability…" : "Search availability"}
          </button>
        </form>
        {error && <p className="message error" role="alert">{error}</p>}
      </section>

      {result && (
        <section className="results" aria-live="polite">
          <div className="section-heading result-heading">
            <div>
              <p className="eyebrow">Search results</p>
              <h2>{result.matchCount ? `${result.matchCount} availability window${result.matchCount === 1 ? "" : "s"}` : "No availability windows"}</h2>
              <p>Checked {new Date(result.generatedAt).toLocaleString()}.</p>
            </div>
            <button className="secondary" type="button" onClick={download} disabled={!visibleMatches.length}>Export .txt</button>
          </div>

          {result.warnings.length > 0 && (
            <div className="message warning">
              <strong>Some availability could not be checked.</strong>
              <ul>{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </div>
          )}

          {result.matches.length > 0 && (
            <div className="filter-panel">
              <div>
                <h3>Filter results</h3>
                <p>{visibleMatches.length} visible</p>
              </div>
              <fieldset>
                <legend>Campgrounds</legend>
                <div className="filter-options">
                  {resultCampgrounds.map((campground) => <label key={campground}><input type="checkbox" checked={campgroundFilter.includes(campground)} onChange={() => toggleFilter(campground, setCampgroundFilter)} /> {campground}</label>)}
                </div>
              </fieldset>
              <fieldset>
                <legend>Site type</legend>
                <div className="filter-options">
                  {resultSiteTypes.map((siteType) => <label key={siteType}><input type="checkbox" checked={siteTypeFilter.includes(siteType)} onChange={() => toggleFilter(siteType, setSiteTypeFilter)} /> {siteType}</label>)}
                </div>
              </fieldset>
              <fieldset>
                <legend>Arrival month</legend>
                <div className="filter-options">
                  {resultMonths.map((month) => <label key={month}><input type="checkbox" checked={monthFilter.includes(month)} onChange={() => toggleFilter(month, setMonthFilter)} /> {monthLabel(month)}</label>)}
                </div>
              </fieldset>
            </div>
          )}

          {result.matches.length === 0 ? (
            <div className="empty-state"><h3>No matches yet</h3><p>Try fewer nights, a larger date range, or different campgrounds.</p></div>
          ) : visibleMatches.length === 0 ? (
            <div className="empty-state"><h3>No matching filters</h3><p>Clear one or more filters to see your search results again.</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Campground</th><th>Site</th><th>Type</th><th>Arrival</th><th>Departure</th><th>Nights</th><th>Capacity</th><th><span className="sr-only">Book</span></th></tr></thead>
                <tbody>
                  {visibleMatches.map((match) => (
                    <tr key={`${match.facilityId}-${match.campsiteId}-${match.arrival}`}>
                      <td><strong>{match.campground}</strong>{match.loop && <span className="subtle">{match.loop}</span>}</td>
                      <td>{match.site}</td><td>{match.campsiteType}</td><td>{displayDate(match.arrival)}</td><td>{displayDate(match.departure)}</td><td>{match.nights}</td><td>{match.maxPeople ? `${match.maxPeople} people` : "—"}</td>
                      <td><a className="book-link" href={match.recreationUrl} target="_blank" rel="noreferrer">View site <span aria-hidden="true">↗</span></a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
