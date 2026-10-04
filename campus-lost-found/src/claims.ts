import { updateReportStatus } from "./reports";
import { getDemoDb, saveDemoDb, supabase } from "./supabase";
import type { Claim, ClaimQuestion } from "./types";

const CLAIM_COLUMNS = "id,report_id,claimant_id,status,created_at";
const QUESTION_COLUMNS = "id,claim_id,question,answer,created_at";

export async function createClaim(reportId: string, claimantId: string): Promise<Claim> {
  const db = getDemoDb();
  const localReport = db.reports.find((r) => r.id === reportId);

  if (localReport && (localReport.type !== "found" || localReport.status !== "open")) {
    throw new Error("Claims can only be submitted for open found reports.");
  }

  if (localReport && localReport.user_id === claimantId) {
    throw new Error("You cannot submit a claim on your own report.");
  }

  const duplicate = db.claims.some(
    (c) => c.report_id === reportId && c.claimant_id === claimantId
  );
  if (duplicate) {
    throw new Error("You have already submitted a claim for this report.");
  }

  const claim: Claim = {
    id: crypto.randomUUID(),
    report_id: reportId,
    claimant_id: claimantId,
    status: "pending",
    created_at: new Date().toISOString(),
  };

  db.claims.unshift(claim);
  saveDemoDb(db);

  const { data, error } = await supabase
    .from("claims")
    .insert({
      id: claim.id,
      report_id: claim.report_id,
      claimant_id: claim.claimant_id,
      status: claim.status,
      created_at: claim.created_at,
    })
    .select(CLAIM_COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("You have already submitted a claim for this report.");
    }
    return { ...claim };
  }

  return (data as Claim) ?? { ...claim };
}

export async function getMyClaims(userId: string): Promise<Claim[]> {
  const { data, error } = await supabase
    .from("claims")
    .select(CLAIM_COLUMNS)
    .eq("claimant_id", userId)
    .order("created_at", { ascending: false });

  if (!error && data && data.length > 0) {
    return data as Claim[];
  }

  const db = getDemoDb();
  return db.claims
    .filter((c) => c.claimant_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((c) => ({ ...c }));
}

export async function getClaimsForMyReports(userId: string): Promise<Claim[]> {
  const { data: remoteReports } = await supabase
    .from("reports")
    .select("id")
    .eq("user_id", userId);

  const remoteIds = (remoteReports ?? []).map((r) => r.id as string);
  if (remoteIds.length > 0) {
    const { data, error } = await supabase
      .from("claims")
      .select(CLAIM_COLUMNS)
      .in("report_id", remoteIds)
      .order("created_at", { ascending: false });

    if (!error && data && data.length > 0) {
      return data as Claim[];
    }
  }

  const db = getDemoDb();
  const myReportIds = new Set(db.reports.filter((r) => r.user_id === userId).map((r) => r.id));

  return db.claims
    .filter((c) => myReportIds.has(c.report_id))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((c) => ({ ...c }));
}

export async function approveClaim(claimId: string, reportId: string): Promise<Claim> {
  const db = getDemoDb();
  const index = db.claims.findIndex((c) => c.id === claimId);

  if (index !== -1) {
    db.claims[index] = {
      ...db.claims[index],
      status: "approved",
    };
    saveDemoDb(db);
  }

  await supabase
    .from("claims")
    .update({ status: "approved" })
    .eq("id", claimId);

  await updateReportStatus(reportId, "returned");

  if (index === -1) {
    throw new Error("Unable to approve the claim.");
  }

  return { ...db.claims[index] };
}

export async function rejectClaim(claimId: string): Promise<Claim> {
  const db = getDemoDb();
  const index = db.claims.findIndex((c) => c.id === claimId);

  if (index !== -1) {
    db.claims[index] = {
      ...db.claims[index],
      status: "rejected",
    };
    saveDemoDb(db);
  }

  await supabase
    .from("claims")
    .update({ status: "rejected" })
    .eq("id", claimId);

  if (index === -1) {
    throw new Error("Unable to reject the claim.");
  }

  return { ...db.claims[index] };
}

export async function createClaimQuestion(claimId: string, question: string): Promise<ClaimQuestion> {
  const db = getDemoDb();
  const item: ClaimQuestion = {
    id: crypto.randomUUID(),
    claim_id: claimId,
    question: question.trim(),
    answer: null,
    created_at: new Date().toISOString(),
  };

  db.claim_questions.push(item);
  saveDemoDb(db);

  await supabase.from("claim_questions").insert({
    id: item.id,
    claim_id: item.claim_id,
    question: item.question,
    answer: item.answer,
    created_at: item.created_at,
  });

  return { ...item };
}

export async function answerClaimQuestion(questionId: string, answer: string): Promise<ClaimQuestion> {
  const db = getDemoDb();
  const index = db.claim_questions.findIndex((q) => q.id === questionId);

  if (index !== -1) {
    db.claim_questions[index] = {
      ...db.claim_questions[index],
      answer: answer.trim(),
    };
    saveDemoDb(db);
  }

  await supabase
    .from("claim_questions")
    .update({ answer: answer.trim() })
    .eq("id", questionId);

  if (index === -1) {
    throw new Error("Unable to save the answer.");
  }

  return { ...db.claim_questions[index] };
}

export async function getQuestionsForClaims(
  claimIds: string[]
): Promise<Record<string, ClaimQuestion[]>> {
  if (!claimIds.length) return {};

  const { data, error } = await supabase
    .from("claim_questions")
    .select(QUESTION_COLUMNS)
    .in("claim_id", claimIds)
    .order("created_at", { ascending: true });

  if (!error && data && data.length > 0) {
    const grouped: Record<string, ClaimQuestion[]> = {};
    for (const q of data as ClaimQuestion[]) {
      if (!grouped[q.claim_id]) grouped[q.claim_id] = [];
      grouped[q.claim_id].push(q);
    }
    return grouped;
  }

  const db = getDemoDb();
  const idSet = new Set(claimIds);
  const grouped: Record<string, ClaimQuestion[]> = {};

  for (const q of db.claim_questions) {
    if (idSet.has(q.claim_id)) {
      if (!grouped[q.claim_id]) grouped[q.claim_id] = [];
      grouped[q.claim_id].push({ ...q });
    }
  }
  return grouped;
}
