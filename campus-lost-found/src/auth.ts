import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import {
  DEMO_STUDENT_1,
  DEMO_STUDENT_2,
  getDemoDb,
  getStoredDemoUserId,
  saveDemoDb,
  setStoredDemoUserId,
  supabase,
  syncSeedToSupabase,
  type DemoUserAccount,
} from "./supabase";
import type { Profile } from "./types";

export interface RegisterResult {
  user: User | null;
  needsEmailConfirmation: boolean;
}

type AuthListener = (event: AuthChangeEvent, session: Session | null) => void;
const listeners = new Set<AuthListener>();

function toSupabaseUser(account: DemoUserAccount): User {
  return {
    id: account.id,
    email: account.email,
    app_metadata: {},
    user_metadata: { full_name: account.full_name },
    aud: "authenticated",
    created_at: account.created_at,
  } as User;
}

function toSession(user: User): Session {
  return {
    access_token: "demo-token",
    refresh_token: "demo-refresh",
    expires_in: 3600,
    token_type: "bearer",
    user,
  } as Session;
}

function notifyAuthListeners(event: AuthChangeEvent, user: User | null): void {
  const session = user ? toSession(user) : null;
  for (const listener of listeners) {
    listener(event, session);
  }
}

async function syncProfileToSupabase(profile: Profile): Promise<void> {
  try {
    await supabase.from("profiles").upsert(
      {
        id: profile.id,
        full_name: profile.full_name,
        created_at: profile.created_at,
      },
      { onConflict: "id" }
    );
  } catch {
    // Fallback to local demo store if remote policy is not yet updated
  }
}

export async function register(email: string, _password: string, fullName: string): Promise<RegisterResult> {
  const cleanedEmail = email.trim().toLowerCase();
  const cleanedName = fullName.trim();
  const db = getDemoDb();

  let account = db.users.find((u) => u.email.toLowerCase() === cleanedEmail);
  if (!account) {
    account = {
      id: crypto.randomUUID(),
      email: cleanedEmail,
      full_name: cleanedName,
      created_at: new Date().toISOString(),
    };
    db.users.push(account);
  } else {
    account.full_name = cleanedName;
  }

  let profile = db.profiles.find((p) => p.id === account.id);
  if (!profile) {
    profile = {
      id: account.id,
      full_name: cleanedName,
      created_at: account.created_at,
    };
    db.profiles.push(profile);
  } else {
    profile.full_name = cleanedName;
  }

  saveDemoDb(db);
  setStoredDemoUserId(account.id);
  await syncProfileToSupabase(profile);

  const user = toSupabaseUser(account);
  notifyAuthListeners("SIGNED_IN", user);
  return { user, needsEmailConfirmation: false };
}

export async function login(email: string, _password: string): Promise<User> {
  const cleanedEmail = email.trim().toLowerCase();
  const db = getDemoDb();

  let account = db.users.find((u) => u.email.toLowerCase() === cleanedEmail);
  if (!account) {
    const derivedName = cleanedEmail
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    account = {
      id: crypto.randomUUID(),
      email: cleanedEmail,
      full_name: derivedName.length >= 2 ? derivedName.slice(0, 80) : "Campus Student",
      created_at: new Date().toISOString(),
    };
    db.users.push(account);
    const newProfile: Profile = {
      id: account.id,
      full_name: account.full_name,
      created_at: account.created_at,
    };
    db.profiles.push(newProfile);
    saveDemoDb(db);
    await syncProfileToSupabase(newProfile);
  }

  setStoredDemoUserId(account.id);
  const user = toSupabaseUser(account);
  notifyAuthListeners("SIGNED_IN", user);
  return user;
}

export async function loginAsDemoStudent(studentNumber: 1 | 2): Promise<User> {
  const target = studentNumber === 1 ? DEMO_STUDENT_1 : DEMO_STUDENT_2;
  const db = getDemoDb();

  if (!db.users.some((u) => u.id === target.id)) {
    db.users.push(target);
  }
  let profile = db.profiles.find((p) => p.id === target.id);
  if (!profile) {
    profile = {
      id: target.id,
      full_name: target.full_name,
      created_at: target.created_at,
    };
    db.profiles.push(profile);
  }
  saveDemoDb(db);
  setStoredDemoUserId(target.id);
  await syncProfileToSupabase(profile);

  const user = toSupabaseUser(target);
  notifyAuthListeners("SIGNED_IN", user);
  return user;
}

export async function logout(): Promise<void> {
  setStoredDemoUserId(null);
  notifyAuthListeners("SIGNED_OUT", null);
}

export async function getCurrentUser(): Promise<User | null> {
  const userId = getStoredDemoUserId();
  if (!userId) return null;

  const db = getDemoDb();
  const account = db.users.find((u) => u.id === userId) ?? DEMO_STUDENT_1;
  return toSupabaseUser(account);
}

export async function getCurrentSession(): Promise<Session | null> {
  const user = await getCurrentUser();
  return user ? toSession(user) : null;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,created_at")
    .eq("id", userId)
    .maybeSingle();

  if (!error && data) {
    return data as Profile;
  }

  const db = getDemoDb();
  return db.profiles.find((p) => p.id === userId) ?? null;
}

export async function ensureProfile(user: User): Promise<Profile | null> {
  await syncSeedToSupabase();
  const existing = await getProfile(user.id);
  if (existing) {
    await syncProfileToSupabase(existing);
    return existing;
  }

  const metadataName =
    typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  const profile: Profile = {
    id: user.id,
    full_name: metadataName || "Campus Student",
    created_at: new Date().toISOString(),
  };
  const db = getDemoDb();
  db.profiles.push(profile);
  saveDemoDb(db);
  await syncProfileToSupabase(profile);
  return profile;
}

export function listenForAuthChanges(
  callback: (event: AuthChangeEvent, session: Session | null) => void
): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}
