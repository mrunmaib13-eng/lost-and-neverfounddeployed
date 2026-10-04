import { createClient } from "@supabase/supabase-js";
import type { Claim, ClaimQuestion, Profile, Report } from "./types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://demo.supabase.co";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "demo-anon-key";

export const supabase = createClient(supabaseUrl, supabaseKey);

const STORAGE_KEY = "campus_lost_found_demo_db_v2";
const SESSION_KEY = "campus_lost_found_demo_session_v1";

export interface DemoUserAccount {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

export interface DemoDatabase {
  users: DemoUserAccount[];
  profiles: Profile[];
  reports: Report[];
  claims: Claim[];
  claim_questions: ClaimQuestion[];
  images: Record<string, string>;
}

export const DEMO_STUDENT_1: DemoUserAccount = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "student1@campus.edu",
  full_name: "Pranav B",
  created_at: "2026-10-01T09:00:00.000Z",
};

export const DEMO_STUDENT_2: DemoUserAccount = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "student2@campus.edu",
  full_name: "Mrunmai B",
  created_at: "2026-10-01T09:05:00.000Z",
};

export function createSeedDatabase(): DemoDatabase {
  const users: DemoUserAccount[] = [DEMO_STUDENT_1, DEMO_STUDENT_2];

  const profiles: Profile[] = users.map((u) => ({
    id: u.id,
    full_name: u.full_name,
    created_at: u.created_at,
  }));

  const reports: Report[] = [
    {
      id: "a0000001-0000-4000-8000-000000000001",
      user_id: DEMO_STUDENT_1.id,
      type: "lost",
      item_name: "Black Water Bottle",
      category: "bottles",
      color: "black",
      location: "library",
      event_date: "2026-10-04",
      description:
        "Matte black 1L insulated steel water bottle with a small red star sticker near the base. Left on the 2nd floor reading table.",
      image_path: null,
      status: "open",
      created_at: "2026-10-04T10:15:00.000Z",
    },
    {
      id: "a0000002-0000-4000-8000-000000000002",
      user_id: DEMO_STUDENT_1.id,
      type: "lost",
      item_name: "Casio Scientific Calculator",
      category: "electronics",
      color: "gray",
      location: "computer_lab",
      event_date: "2026-10-03",
      description:
        "Casio fx-991EX scientific calculator in a dark gray slide cover. Lost after the afternoon programming lab session.",
      image_path: null,
      status: "open",
      created_at: "2026-10-03T16:30:00.000Z",
    },
    {
      id: "a0000003-0000-4000-8000-000000000003",
      user_id: DEMO_STUDENT_1.id,
      type: "lost",
      item_name: "Discrete Mathematics Textbook",
      category: "books",
      color: "blue",
      location: "classroom_block",
      event_date: "2026-10-02",
      description:
        "Blue hardcover Discrete Mathematics textbook (Rosen 8th Edition) with yellow index tabs on the Relations chapter.",
      image_path: null,
      status: "open",
      created_at: "2026-10-02T14:20:00.000Z",
    },
    {
      id: "a0000004-0000-4000-8000-000000000004",
      user_id: DEMO_STUDENT_1.id,
      type: "found",
      item_name: "Silver Hostel Keys",
      category: "keys",
      color: "silver",
      location: "canteen",
      event_date: "2026-10-04",
      description:
        "Found a keyring with two silver keys and a numbered metal token on a table near the juice counter.",
      image_path: null,
      status: "open",
      created_at: "2026-10-04T13:10:00.000Z",
    },
    {
      id: "b0000001-0000-4000-8000-000000000001",
      user_id: DEMO_STUDENT_2.id,
      type: "found",
      item_name: "Black Water Bottle",
      category: "bottles",
      color: "black",
      location: "library",
      event_date: "2026-10-04",
      description:
        "Found a black insulated metal water bottle by the second-floor study cubicles in the central library.",
      image_path: null,
      status: "open",
      created_at: "2026-10-04T11:45:00.000Z",
    },
    {
      id: "b0000002-0000-4000-8000-000000000002",
      user_id: DEMO_STUDENT_2.id,
      type: "found",
      item_name: "Water Bottle",
      category: "bottles",
      color: "black",
      location: "canteen",
      event_date: "2026-10-03",
      description:
        "Black metal water bottle found near the main canteen seating area on Saturday afternoon.",
      image_path: null,
      status: "open",
      created_at: "2026-10-03T17:00:00.000Z",
    },
    {
      id: "b0000003-0000-4000-8000-000000000003",
      user_id: DEMO_STUDENT_2.id,
      type: "found",
      item_name: "Scientific Calculator",
      category: "electronics",
      color: "gray",
      location: "computer_lab",
      event_date: "2026-10-01",
      description:
        "Found a gray Casio scientific calculator next to workstation #14 in the main computer lab.",
      image_path: null,
      status: "open",
      created_at: "2026-10-03T18:00:00.000Z",
    },
    {
      id: "b0000004-0000-4000-8000-000000000004",
      user_id: DEMO_STUDENT_2.id,
      type: "found",
      item_name: "Discrete Mathematics Book",
      category: "books",
      color: "blue",
      location: "library",
      event_date: "2026-10-02",
      description:
        "Blue hardcover Discrete Mathematics book found near the library return desk.",
      image_path: null,
      status: "open",
      created_at: "2026-10-02T17:30:00.000Z",
    },
    {
      id: "b0000005-0000-4000-8000-000000000005",
      user_id: DEMO_STUDENT_2.id,
      type: "lost",
      item_name: "Hostel Keys",
      category: "keys",
      color: "silver",
      location: "canteen",
      event_date: "2026-10-02",
      description:
        "Lost my hostel room keyring with two silver keys while having lunch at the campus canteen.",
      image_path: null,
      status: "open",
      created_at: "2026-10-04T14:00:00.000Z",
    },
    {
      id: "b0000006-0000-4000-8000-000000000006",
      user_id: DEMO_STUDENT_2.id,
      type: "found",
      item_name: "Student ID Card Holder",
      category: "id_cards",
      color: "blue",
      location: "main_gate",
      event_date: "2026-10-04",
      description:
        "Blue neck lanyard with a transparent ID card holder found near the main gate security desk.",
      image_path: null,
      status: "open",
      created_at: "2026-10-04T09:30:00.000Z",
    },
    {
      id: "b0000007-0000-4000-8000-000000000007",
      user_id: DEMO_STUDENT_2.id,
      type: "found",
      item_name: "Black Canvas Backpack",
      category: "bags",
      color: "black",
      location: "auditorium",
      event_date: "2026-10-03",
      description:
        "Black canvas backpack found in row D of the main auditorium after the seminar.",
      image_path: null,
      status: "open",
      created_at: "2026-10-03T19:00:00.000Z",
    },
  ];

  const claims: Claim[] = [
    {
      id: "c0000001-0000-4000-8000-000000000001",
      report_id: "b0000003-0000-4000-8000-000000000003",
      claimant_id: DEMO_STUDENT_1.id,
      status: "pending",
      created_at: "2026-10-04T12:00:00.000Z",
    },
    {
      id: "c0000002-0000-4000-8000-000000000002",
      report_id: "a0000004-0000-4000-8000-000000000004",
      claimant_id: DEMO_STUDENT_2.id,
      status: "pending",
      created_at: "2026-10-04T14:30:00.000Z",
    },
  ];

  const claim_questions: ClaimQuestion[] = [
    {
      id: "d0000001-0000-4000-8000-000000000001",
      claim_id: "c0000001-0000-4000-8000-000000000001",
      question: "What initials or roll-number digits are scratched inside the slide cover?",
      answer: null,
      created_at: "2026-10-04T12:15:00.000Z",
    },
    {
      id: "d0000002-0000-4000-8000-000000000002",
      claim_id: "c0000002-0000-4000-8000-000000000002",
      question: "What room number is stamped on the metal token attached to the keyring?",
      answer: "Hostel Block B, Room 204",
      created_at: "2026-10-04T14:40:00.000Z",
    },
  ];

  return {
    users,
    profiles,
    reports,
    claims,
    claim_questions,
    images: {},
  };
}

let memoryFallbackDb: DemoDatabase | null = null;

export function getDemoDb(): DemoDatabase {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as DemoDatabase;
      }
      const seeded = createSeedDatabase();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
  } catch (error) {
    console.warn("Using in-memory demo database fallback", error);
  }

  if (!memoryFallbackDb) {
    memoryFallbackDb = createSeedDatabase();
  }
  return memoryFallbackDb;
}

export function saveDemoDb(db: DemoDatabase): void {
  memoryFallbackDb = db;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    }
  } catch (error) {
    console.warn("Unable to persist demo database to localStorage", error);
  }
}

export async function syncSeedToSupabase(): Promise<boolean> {
  const seed = createSeedDatabase();
  try {
    const { error: profileErr } = await supabase
      .from("profiles")
      .upsert(seed.profiles, { onConflict: "id" });
    if (profileErr) {
      return false;
    }

    await supabase.from("reports").upsert(seed.reports, { onConflict: "id" });
    await supabase.from("claims").upsert(seed.claims, { onConflict: "id" });
    await supabase.from("claim_questions").upsert(seed.claim_questions, { onConflict: "id" });
    return true;
  } catch {
    return false;
  }
}

export async function resetDemoDb(): Promise<DemoDatabase> {
  const seeded = createSeedDatabase();
  saveDemoDb(seeded);
  await syncSeedToSupabase();
  return seeded;
}

export function getStoredDemoUserId(): string | null {
  try {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved === "logged_out") return null;
      if (saved) return saved;
      localStorage.setItem(SESSION_KEY, DEMO_STUDENT_1.id);
      return DEMO_STUDENT_1.id;
    }
  } catch {
    // ignore storage errors
  }
  return DEMO_STUDENT_1.id;
}

export function setStoredDemoUserId(userId: string | null): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(SESSION_KEY, userId ?? "logged_out");
    }
  } catch {
    // ignore storage errors
  }
}
