import { shrinkImage } from "@/lib/image";

export async function uploadFiles(assetId: number, files: ArrayLike<File>, logId?: number) {
  const fd = new FormData();
  fd.set("assetId", String(assetId));
  if (logId) fd.set("logId", String(logId));
  const prepared = await Promise.all(Array.from(files).map((f) => shrinkImage(f)));
  prepared.forEach((f) => fd.append("files", f));
  const r = await fetch("/api/files", { method: "POST", body: fd });
  if (!r.ok) throw new Error(await r.text());
}
