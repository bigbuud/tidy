export async function uploadFiles(assetId: number, files: ArrayLike<File>, logId?: number) {
  const fd = new FormData();
  fd.set("assetId", String(assetId));
  if (logId) fd.set("logId", String(logId));
  Array.from(files).forEach((f) => fd.append("files", f));
  const r = await fetch("/api/files", { method: "POST", body: fd });
  if (!r.ok) throw new Error(await r.text());
}
