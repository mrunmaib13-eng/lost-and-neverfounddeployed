import type { CATEGORIES, COLORS, LOCATIONS } from "./constants";

export type ReportType = "lost" | "found";
export type ReportStatus = "open" | "claimed" | "returned" | "closed";
export type ClaimStatus = "pending" | "approved" | "rejected";

export type Category = (typeof CATEGORIES)[number];
export type Color = (typeof COLORS)[number];
export type CampusLocation = (typeof LOCATIONS)[number];

export interface Profile {
  id: string;
  full_name: string;
  created_at: string;
}

export interface Report {
  id: string;
  user_id: string;
  type: ReportType;
  item_name: string;
  category: Category;
  color: Color;
  location: CampusLocation;
  event_date: string;
  description: string;
  image_path: string | null;
  status: ReportStatus;
  created_at: string;
}

export interface Claim {
  id: string;
  report_id: string;
  claimant_id: string;
  status: ClaimStatus;
  created_at: string;
}

export interface ClaimQuestion {
  id: string;
  claim_id: string;
  question: string;
  answer: string | null;
  created_at: string;
}

export interface EnrichedClaim {
  claim: Claim;
  report: Report | null;
  questions: ClaimQuestion[];
}

export interface MatchBreakdown {
  category: number;
  color: number;
  location: number;
  date: number;
  itemName: number;
}

export interface MatchResult {
  lostReport: Report;
  foundReport: Report;
  score: number;
  breakdown: MatchBreakdown;
  dateDifference: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export interface ReportFormInput {
  type: ReportType;
  item_name: string;
  category: string;
  color: string;
  location: string;
  event_date: string;
  description: string;
}

export interface ReportInsertInput extends ReportFormInput {
  id: string;
  user_id: string;
  category: Category;
  color: Color;
  location: CampusLocation;
  image_path: string | null;
}

export interface BrowseFilters {
  type: "all" | ReportType;
  category: string;
  color: string;
  location: string;
  search: string;
}

export interface AuthResult {
  ok: boolean;
  message?: string;
}
