import { describe, expect, it, vi } from "vitest";

vi.mock("./reports", () => ({
  getOpenReports: vi.fn(async () => []),
}));

import {
  buildRelationMatrix,
  calculateDateDifference,
  calculateMatch,
  getRelationPairs,
  groupByCategoryEquivalence,
  sortMatches,
} from "./matches";
import type { Report } from "./types";
import {
  validateClaimAnswer,
  validateClaimQuestion,
  validateEmail,
  validateFullName,
  validatePassword,
  validateReportForm,
} from "./validation";

function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    id: "report-1",
    user_id: "user-1",
    type: "lost",
    item_name: "Black Water Bottle",
    category: "bottles",
    color: "black",
    location: "library",
    event_date: "2026-10-04",
    description: "Matte black insulated water bottle left near the reading desk.",
    image_path: null,
    status: "open",
    created_at: "2026-10-04T10:00:00.000Z",
    ...overrides,
  };
}

describe("Deterministic Matcher (Section 71)", () => {
  it("calculates UTC-safe calendar date differences accurately", () => {
    expect(calculateDateDifference("2026-10-04", "2026-10-04")).toBe(0);
    expect(calculateDateDifference("2026-10-04", "2026-10-03")).toBe(1);
    expect(calculateDateDifference("2026-10-01", "2026-10-04")).toBe(3);
    expect(calculateDateDifference("2026-09-28", "2026-10-02")).toBe(4);
  });

  it("awards +30 for same category and +0 for different category", () => {
    const lost = makeReport({ type: "lost", category: "bottles" });
    const foundSame = makeReport({ id: "f1", type: "found", category: "bottles" });
    const foundDiff = makeReport({ id: "f2", type: "found", category: "books" });

    expect(calculateMatch(lost, foundSame).breakdown.category).toBe(30);
    expect(calculateMatch(lost, foundDiff).breakdown.category).toBe(0);
  });

  it("awards +20 for same color and +0 for different color", () => {
    const lost = makeReport({ type: "lost", color: "black" });
    const foundSame = makeReport({ id: "f1", type: "found", color: "black" });
    const foundDiff = makeReport({ id: "f2", type: "found", color: "blue" });

    expect(calculateMatch(lost, foundSame).breakdown.color).toBe(20);
    expect(calculateMatch(lost, foundDiff).breakdown.color).toBe(0);
  });

  it("awards +20 for same location and +0 for different location", () => {
    const lost = makeReport({ type: "lost", location: "library" });
    const foundSame = makeReport({ id: "f1", type: "found", location: "library" });
    const foundDiff = makeReport({ id: "f2", type: "found", location: "canteen" });

    expect(calculateMatch(lost, foundSame).breakdown.location).toBe(20);
    expect(calculateMatch(lost, foundDiff).breakdown.location).toBe(0);
  });

  it("scores date difference: 0-1 days = +20, 2-3 days = +10, >=4 days = +0", () => {
    const lost = makeReport({ type: "lost", event_date: "2026-10-04" });

    expect(
      calculateMatch(lost, makeReport({ type: "found", event_date: "2026-10-04" })).breakdown.date
    ).toBe(20);
    expect(
      calculateMatch(lost, makeReport({ type: "found", event_date: "2026-10-03" })).breakdown.date
    ).toBe(20);
    expect(
      calculateMatch(lost, makeReport({ type: "found", event_date: "2026-10-02" })).breakdown.date
    ).toBe(10);
    expect(
      calculateMatch(lost, makeReport({ type: "found", event_date: "2026-10-01" })).breakdown.date
    ).toBe(10);
    expect(
      calculateMatch(lost, makeReport({ type: "found", event_date: "2026-09-30" })).breakdown.date
    ).toBe(0);
  });

  it("awards +10 for normalized substring item-name match and +0 otherwise", () => {
    const lost = makeReport({ type: "lost", item_name: "  water   bottle " });
    const foundMatch = makeReport({ type: "found", item_name: "Black Water Bottle" });
    const foundNoMatch = makeReport({ type: "found", item_name: "Scientific Calculator" });

    expect(calculateMatch(lost, foundMatch).breakdown.itemName).toBe(10);
    expect(calculateMatch(lost, foundNoMatch).breakdown.itemName).toBe(0);
  });

  it("verifies Section 70 classroom demo scenario: 100 -> 80 -> 50", () => {
    const lost = makeReport({
      type: "lost",
      item_name: "Black Bottle",
      category: "bottles",
      color: "black",
      location: "library",
      event_date: "2026-10-04",
    });

    const foundExact = makeReport({
      id: "f-100",
      type: "found",
      item_name: "Black Bottle",
      category: "bottles",
      color: "black",
      location: "library",
      event_date: "2026-10-04",
    });
    expect(calculateMatch(lost, foundExact).score).toBe(100);

    const foundCanteen = makeReport({
      ...foundExact,
      id: "f-80",
      location: "canteen",
    });
    expect(calculateMatch(lost, foundCanteen).score).toBe(80);

    const foundBooksCanteen = makeReport({
      ...foundCanteen,
      id: "f-50",
      category: "books",
    });
    expect(calculateMatch(lost, foundBooksCanteen).score).toBe(50);
  });

  it("enforces maximum score = 100 and minimum score = 0", () => {
    const lost = makeReport({ type: "lost" });
    const foundMax = makeReport({ type: "found" });
    const foundMin = makeReport({
      type: "found",
      item_name: "Umbrella",
      category: "accessories",
      color: "yellow",
      location: "main_gate",
      event_date: "2026-09-01",
    });

    expect(calculateMatch(lost, foundMax).score).toBe(100);
    expect(calculateMatch(lost, foundMin).score).toBe(0);
  });

  it("never mutates input report objects", () => {
    const lost = makeReport({ type: "lost" });
    const found = makeReport({ type: "found" });
    const lostSnapshot = JSON.stringify(lost);
    const foundSnapshot = JSON.stringify(found);

    calculateMatch(lost, found);

    expect(JSON.stringify(lost)).toBe(lostSnapshot);
    expect(JSON.stringify(found)).toBe(foundSnapshot);
  });

  it("rejects lost/lost, found/found, and non-open reports with score 0", () => {
    const lost1 = makeReport({ id: "l1", type: "lost" });
    const lost2 = makeReport({ id: "l2", type: "lost" });
    const found1 = makeReport({ id: "f1", type: "found" });
    const found2 = makeReport({ id: "f2", type: "found" });
    const foundReturned = makeReport({ id: "f3", type: "found", status: "returned" });

    expect(calculateMatch(lost1, lost2).score).toBe(0);
    expect(calculateMatch(found1, found2).score).toBe(0);
    expect(calculateMatch(lost1, foundReturned).score).toBe(0);
  });

  it("sorts matches by score desc, then smaller dateDifference, then newest report", () => {
    const lost = makeReport({ type: "lost", event_date: "2026-10-04" });
    const fHigh = makeReport({ id: "f-high", type: "found", event_date: "2026-10-04" }); // 100
    const fTieOlder = makeReport({
      id: "f-tie-older",
      type: "found",
      location: "canteen",
      event_date: "2026-10-04",
      created_at: "2026-10-04T08:00:00.000Z",
    }); // 80, 0d diff
    const fTieNewer = makeReport({
      id: "f-tie-newer",
      type: "found",
      location: "canteen",
      event_date: "2026-10-04",
      created_at: "2026-10-04T12:00:00.000Z",
    }); // 80, 0d diff
    const fTie1Day = makeReport({
      id: "f-tie-1d",
      type: "found",
      location: "canteen",
      event_date: "2026-10-03",
      created_at: "2026-10-04T15:00:00.000Z",
    }); // 80, 1d diff

    const sorted = sortMatches([
      calculateMatch(lost, fTie1Day),
      calculateMatch(lost, fTieOlder),
      calculateMatch(lost, fHigh),
      calculateMatch(lost, fTieNewer),
    ]);

    expect(sorted.map((m) => m.foundReport.id)).toEqual([
      "f-high",
      "f-tie-newer",
      "f-tie-older",
      "f-tie-1d",
    ]);
  });

  it("builds binary relation matrix R and groups equivalence classes by category", () => {
    const lost1 = makeReport({ id: "l1", type: "lost", category: "bottles", color: "black", location: "library" });
    const lost2 = makeReport({ id: "l2", type: "lost", category: "keys", color: "silver", location: "hostel", item_name: "Room Key" });
    const found1 = makeReport({ id: "f1", type: "found", category: "bottles", color: "black", location: "library" });
    const found2 = makeReport({ id: "f2", type: "found", category: "keys", color: "silver", location: "hostel", item_name: "Hostel Room Key" });

    const matrix = buildRelationMatrix([lost1, lost2], [found1, found2]);
    expect(matrix).toEqual([
      [1, 0],
      [0, 1],
    ]);

    const pairs = getRelationPairs([lost1, lost2], [found1, found2]);
    expect(pairs).toHaveLength(2);

    const classes = groupByCategoryEquivalence([lost1, lost2, found1, found2]);
    expect(classes.bottles).toHaveLength(2);
    expect(classes.keys).toHaveLength(2);
    expect(classes.electronics).toHaveLength(0);
  });
});

describe("Validation Module", () => {
  it("validates report forms and claim questions/answers", () => {
    expect(validateEmail("student@college.edu").valid).toBe(true);
    expect(validatePassword("secret123").valid).toBe(true);
    expect(validateFullName("Pranav").valid).toBe(true);
    expect(validateClaimQuestion("What sticker is on the bottle?").valid).toBe(true);
    expect(validateClaimQuestion("Hi?").valid).toBe(false);
    expect(validateClaimAnswer("Red star sticker").valid).toBe(true);

    const validReport = validateReportForm({
      type: "lost",
      item_name: "Black Bottle",
      category: "bottles",
      color: "black",
      location: "library",
      event_date: "2026-10-04",
      description: "Left near the second floor study table.",
    });
    expect(validReport.valid).toBe(true);
  });
});
