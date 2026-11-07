/** Maakt van een foto (bv. 12 MP van je telefoon) een vierkante JPEG van 512 px: klein en snel te laden. */
export async function squarePhoto(file: File, size = 512): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Foto verwerken lukt niet in deze browser");
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  bmp.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Foto verwerken mislukt"))),
      "image/jpeg",
      0.85,
    ),
  );
}

export async function uploadPhoto(assetId: number, file: File) {
  const blob = await squarePhoto(file);
  const fd = new FormData();
  fd.set("assetId", String(assetId));
  fd.set("photo", blob, "foto.jpg");
  const r = await fetch("/api/photo", { method: "POST", body: fd });
  if (!r.ok) throw new Error(await r.text());
}

/**
 * Verkleint grote foto's (bv. een factuur die je met je telefoon neemt) tot max. 2200 px aan de lange kant,
 * zodat je NAS niet vol loopt en uploaden snel blijft. Tekst blijft goed leesbaar.
 * PDF's, andere bestanden en kleine foto's blijven ongewijzigd.
 */
export async function shrinkImage(file: File, maxSide = 2200): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 700 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff"; // PNG met transparantie wordt anders zwart in een JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // bv. HEIC in een browser die dat niet kan lezen: dan het origineel uploaden
  }
}
