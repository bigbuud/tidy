import { createFileRoute } from "@tanstack/react-router";

const MAX_BYTES = 3 * 1024 * 1024;

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

/** Bepaalt het type aan de hand van de eerste bytes, de opgegeven bestandsnaam of -type wordt niet vertrouwd. */
function imageExt(b: Buffer): "jpg" | "png" | "webp" | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (
    b.length > 8 &&
    b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return "png";
  if (
    b.length > 12 &&
    b.subarray(0, 4).toString() === "RIFF" &&
    b.subarray(8, 12).toString() === "WEBP"
  )
    return "webp";
  return null;
}

export const Route = createFileRoute("/api/photo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { userFromToken, parseCookie, SESSION_COOKIE } = await import("@/server/auth.server");
        const { getDb, FILES_DIR, removeStoredFile } = await import("@/server/db.server");
        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        const crypto = await import("node:crypto");

        const origin = request.headers.get("origin");
        if (origin && new URL(origin).host !== new URL(request.url).host) {
          return text("Forbidden", 403);
        }
        if (!userFromToken(parseCookie(request.headers.get("cookie"), SESSION_COOKIE))) {
          return text("Niet aangemeld", 401);
        }
        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return text("Ongeldige upload", 400);
        }
        const assetId = Number(form.get("assetId"));
        const file = form.get("photo");
        if (!Number.isInteger(assetId) || !(file instanceof File))
          return text("Ongeldige aanvraag", 400);
        if (file.size > MAX_BYTES) return text("Foto is groter dan 3 MB", 413);

        const db = getDb();
        const row = db.prepare("SELECT photo_file FROM assets WHERE id = ?").get(assetId) as
          { photo_file: string | null } | undefined;
        if (!row) return text("Onbekend item", 400);

        const buf = Buffer.from(await file.arrayBuffer());
        const ext = imageExt(buf);
        if (!ext) return text("Alleen JPEG-, PNG- of WebP-foto's", 400);

        const stored = `${crypto.randomUUID()}.${ext}`;
        await fs.writeFile(path.join(FILES_DIR, stored), buf);
        const version = Date.now();
        try {
          db.prepare("UPDATE assets SET photo_file = ?, photo_v = ? WHERE id = ?").run(
            stored,
            version,
            assetId,
          );
        } catch (err) {
          removeStoredFile(stored);
          throw err;
        }
        if (row.photo_file) removeStoredFile(row.photo_file);
        return Response.json({ ok: true, v: version });
      },
    },
  },
});
