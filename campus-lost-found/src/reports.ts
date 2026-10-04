import { getDemoDb, saveDemoDb, supabase } from "./supabase";
import type { Report, ReportInsertInput, ReportStatus, ReportType } from "./types";

const REPORT_COLUMNS =
  "id,user_id,type,item_name,category,color,location,event_date,description,image_path,status,created_at";

export async function createReport(input: ReportInsertInput): Promise<Report> {
  const createdAt = new Date().toISOString();
  const report: Report = {
    id: input.id,
    user_id: input.user_id,
    type: input.type,
    item_name: input.item_name,
    category: input.category,
    color: input.color,
    location: input.location,
    event_date: input.event_date,
    description: input.description,
    image_path: input.image_path,
    status: "open",
    created_at: createdAt,
  };

  const db = getDemoDb();
  db.reports.unshift(report);
  saveDemoDb(db);

  const { data, error } = await supabase
    .from("reports")
    .insert({
      id: report.id,
      user_id: report.user_id,
      type: report.type,
      item_name: report.item_name,
      category: report.category,
      color: report.color,
      location: report.location,
      event_date: report.event_date,
      description: report.description,
      image_path: report.image_path,
      status: report.status,
      created_at: report.created_at,
    })
    .select(REPORT_COLUMNS)
    .single();

  if (!error && data) {
    return data as Report;
  }

  return { ...report };
}

export async function getOpenReports(type?: ReportType): Promise<Report[]> {
  let query = supabase
    .from("reports")
    .select(REPORT_COLUMNS)
    .eq("status", "open")
    .order("created_at", { ascending: false });

  if (type) {
    query = query.eq("type", type);
  }

  const { data, error } = await query;

  if (!error && data && data.length > 0) {
    return data as Report[];
  }

  const db = getDemoDb();
  return db.reports
    .filter((r) => r.status === "open" && (!type || r.type === type))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((r) => ({ ...r }));
}

export async function getReportById(reportId: string): Promise<Report | null> {
  const { data, error } = await supabase
    .from("reports")
    .select(REPORT_COLUMNS)
    .eq("id", reportId)
    .maybeSingle();

  if (!error && data) {
    return data as Report;
  }

  const db = getDemoDb();
  const found = db.reports.find((r) => r.id === reportId);
  return found ? { ...found } : null;
}

export async function getMyReports(userId: string): Promise<Report[]> {
  const { data, error } = await supabase
    .from("reports")
    .select(REPORT_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!error && data && data.length > 0) {
    return data as Report[];
  }

  const db = getDemoDb();
  return db.reports
    .filter((r) => r.user_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((r) => ({ ...r }));
}

export async function updateReport(
  reportId: string,
  changes: Partial<Pick<Report, "item_name" | "category" | "color" | "location" | "event_date" | "description">>
): Promise<Report> {
  const db = getDemoDb();
  const index = db.reports.findIndex((r) => r.id === reportId && r.status === "open");

  if (index !== -1) {
    db.reports[index] = {
      ...db.reports[index],
      ...changes,
    };
    saveDemoDb(db);
  }

  const { data, error } = await supabase
    .from("reports")
    .update(changes)
    .eq("id", reportId)
    .eq("status", "open")
    .select(REPORT_COLUMNS)
    .single();

  if (!error && data) {
    return data as Report;
  }

  if (index === -1) {
    throw new Error("Unable to update the report. Only open reports can be edited.");
  }

  return { ...db.reports[index] };
}

export async function updateReportStatus(reportId: string, status: ReportStatus): Promise<Report> {
  const db = getDemoDb();
  const index = db.reports.findIndex((r) => r.id === reportId);

  if (index !== -1) {
    db.reports[index] = {
      ...db.reports[index],
      status,
    };
    saveDemoDb(db);
  }

  const { data, error } = await supabase
    .from("reports")
    .update({ status })
    .eq("id", reportId)
    .select(REPORT_COLUMNS)
    .single();

  if (!error && data) {
    return data as Report;
  }

  if (index === -1) {
    throw new Error("Unable to update the report status.");
  }

  return { ...db.reports[index] };
}

export async function markReportReturned(reportId: string): Promise<Report> {
  return updateReportStatus(reportId, "returned");
}

export async function closeReport(reportId: string): Promise<Report> {
  return updateReportStatus(reportId, "closed");
}

export async function deleteReport(reportId: string): Promise<void> {
  const db = getDemoDb();
  const index = db.reports.findIndex((r) => r.id === reportId && r.status === "open");
  if (index !== -1) {
    db.reports.splice(index, 1);
    db.claims = db.claims.filter((c) => c.report_id !== reportId);
    saveDemoDb(db);
  }

  await supabase.from("reports").delete().eq("id", reportId).eq("status", "open");
}

export async function getReportsByIds(ids: string[]): Promise<Record<string, Report>> {
  if (!ids.length) return {};

  const map: Record<string, Report> = {};
  const db = getDemoDb();
  const idSet = new Set(ids);
  for (const r of db.reports) {
    if (idSet.has(r.id)) {
      map[r.id] = { ...r };
    }
  }

  const { data, error } = await supabase
    .from("reports")
    .select(REPORT_COLUMNS)
    .in("id", ids);

  if (!error && data) {
    for (const r of data as Report[]) {
      map[r.id] = r;
    }
  }

  return map;
}
