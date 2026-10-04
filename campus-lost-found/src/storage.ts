import { REPORT_IMAGE_BUCKET } from "./constants";
import { getDemoDb, saveDemoDb, supabase } from "./supabase";
import type { Report } from "./types";

export function getImageExtension(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Unable to read image file."));
    reader.readAsDataURL(file);
  });
}

export async function uploadReportImage(userId: string, reportId: string, file: File): Promise<string> {
  const path = `${userId}/${reportId}.${getImageExtension(file)}`;
  const dataUrl = await readFileAsDataUrl(file);
  const db = getDemoDb();
  db.images[path] = dataUrl;
  saveDemoDb(db);

  await supabase.storage
    .from(REPORT_IMAGE_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: true })
    .catch(() => null);

  return path;
}

export async function deleteReportImage(path: string): Promise<void> {
  const db = getDemoDb();
  delete db.images[path];
  saveDemoDb(db);

  await supabase.storage
    .from(REPORT_IMAGE_BUCKET)
    .remove([path])
    .catch(() => null);
}

export async function getReportImageUrl(path: string): Promise<string | null> {
  const db = getDemoDb();
  if (db.images[path]) {
    return db.images[path];
  }

  const { data, error } = await supabase.storage
    .from(REPORT_IMAGE_BUCKET)
    .createSignedUrl(path, 60 * 10);

  if (!error && data?.signedUrl) {
    return data.signedUrl;
  }

  return null;
}

export async function resolveReportImageUrls(reports: Report[]): Promise<Record<string, string>> {
  const urlMap: Record<string, string> = {};
  for (const report of reports) {
    if (report.image_path) {
      const url = await getReportImageUrl(report.image_path);
      if (url) {
        urlMap[report.image_path] = url;
      }
    }
  }
  return urlMap;
}
