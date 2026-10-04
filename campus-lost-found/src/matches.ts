import { CATEGORIES, MATCH_THRESHOLD } from "./constants";
import { getOpenReports } from "./reports";
import type { Category, MatchBreakdown, MatchResult, Report } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function parseDateOnly(value: string): DateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    throw new Error(`Invalid date-only value: ${value}`);
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function calculateDateDifference(left: string, right: string): number {
  const a = parseDateOnly(left);
  const b = parseDateOnly(right);
  const aUtc = Date.UTC(a.year, a.month - 1, a.day);
  const bUtc = Date.UTC(b.year, b.month - 1, b.day);
  return Math.abs(Math.round((aUtc - bUtc) / DAY_MS));
}

function scoreDate(days: number): number {
  if (days <= 1) return 20;
  if (days <= 3) return 10;
  return 0;
}

export function normalizeItemName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function scoreItemName(lostName: string, foundName: string): number {
  const lost = normalizeItemName(lostName);
  const found = normalizeItemName(foundName);

  if (!lost || !found) return 0;
  return lost.includes(found) || found.includes(lost) ? 10 : 0;
}

export function calculateMatch(lost: Report, found: Report): MatchResult {
  if (lost.type !== "lost" || found.type !== "found" || lost.status !== "open" || found.status !== "open") {
    return emptyMatch(lost, found);
  }

  const dateDifference = calculateDateDifference(lost.event_date, found.event_date);
  const breakdown: MatchBreakdown = {
    category: lost.category === found.category ? 30 : 0,
    color: lost.color === found.color ? 20 : 0,
    location: lost.location === found.location ? 20 : 0,
    date: scoreDate(dateDifference),
    itemName: scoreItemName(lost.item_name, found.item_name),
  };
  const score =
    breakdown.category +
    breakdown.color +
    breakdown.location +
    breakdown.date +
    breakdown.itemName;

  return { lostReport: lost, foundReport: found, score, breakdown, dateDifference };
}

function emptyMatch(lost: Report, found: Report): MatchResult {
  return {
    lostReport: lost,
    foundReport: found,
    score: 0,
    breakdown: { category: 0, color: 0, location: 0, date: 0, itemName: 0 },
    dateDifference: Number.POSITIVE_INFINITY,
  };
}

export function sortMatches(matches: MatchResult[]): MatchResult[] {
  return [...matches].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.dateDifference !== b.dateDifference) return a.dateDifference - b.dateDifference;

    const foundDiff =
      new Date(b.foundReport.created_at).getTime() - new Date(a.foundReport.created_at).getTime();
    if (foundDiff !== 0) return foundDiff;

    return new Date(b.lostReport.created_at).getTime() - new Date(a.lostReport.created_at).getTime();
  });
}

export async function findMatchesForLostReport(lostReport: Report): Promise<MatchResult[]> {
  if (lostReport.type !== "lost" || lostReport.status !== "open") {
    return [];
  }
  const foundReports = await getOpenReports("found");
  return sortMatches(
    foundReports
      .map((found) => calculateMatch(lostReport, found))
      .filter((match) => match.score >= MATCH_THRESHOLD)
  ).slice(0, 10);
}

export async function findMatchesForFoundReport(foundReport: Report): Promise<MatchResult[]> {
  if (foundReport.type !== "found" || foundReport.status !== "open") {
    return [];
  }
  const lostReports = await getOpenReports("lost");
  return sortMatches(
    lostReports
      .map((lost) => calculateMatch(lost, foundReport))
      .filter((match) => match.score >= MATCH_THRESHOLD)
  ).slice(0, 10);
}

export function buildRelationMatrix(lostReports: Report[], foundReports: Report[]): number[][] {
  return lostReports.map((lost) =>
    foundReports.map((found) => (calculateMatch(lost, found).score >= MATCH_THRESHOLD ? 1 : 0))
  );
}

export function buildScoreMatrix(lostReports: Report[], foundReports: Report[]): number[][] {
  return lostReports.map((lost) => foundReports.map((found) => calculateMatch(lost, found).score));
}

export function getRelationPairs(lostReports: Report[], foundReports: Report[]): MatchResult[] {
  const pairs: MatchResult[] = [];
  for (const lost of lostReports) {
    for (const found of foundReports) {
      const match = calculateMatch(lost, found);
      if (match.score >= MATCH_THRESHOLD) {
        pairs.push(match);
      }
    }
  }
  return sortMatches(pairs);
}

export function groupByCategoryEquivalence(reports: Report[]): Record<Category, Report[]> {
  const classes = Object.fromEntries(
    CATEGORIES.map((category) => [category, [] as Report[]])
  ) as Record<Category, Report[]>;

  for (const report of reports) {
    if (classes[report.category]) {
      classes[report.category].push(report);
    }
  }

  return classes;
}
