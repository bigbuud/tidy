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
