import { createFileRoute } from "@tanstack/react-router";

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 20;

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

export const Route = createFileRoute("/api/files")({
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
        const logIdRaw = form.get("logId");
        const logId = logIdRaw ? Number(logIdRaw) : null;
        if (!Number.isInteger(assetId) || (logId !== null && !Number.isInteger(logId))) {
          return text("Ongeldige aanvraag", 400);
        }
        const files = form.getAll("files").filter((f): f is File => f instanceof File);
        if (files.length === 0) return text("Geen bestanden gekozen", 400);
        if (files.length > MAX_FILES) return text(`Maximaal ${MAX_FILES} bestanden per keer`, 400);

        const db = getDb();
        if (!db.prepare("SELECT 1 FROM assets WHERE id = ?").get(assetId)) {
          return text("Onbekend item", 400);
        }
        // Een log moet bij hetzelfde item horen als het document.
        if (
          logId !== null &&
          !db.prepare("SELECT 1 FROM logs WHERE id = ? AND asset_id = ?").get(logId, assetId)
        ) {
          return text("Onbekende log", 400);
        }
        for (const file of files) {
          if (file.size > MAX_BYTES) return text(`${file.name} is groter dan 25 MB`, 413);
        }

        const insert = db.prepare(
          "INSERT INTO documents (asset_id, log_id, filename, stored_name, mime, size) VALUES (?, ?, ?, ?, ?, ?)",
        );
        let saved = 0;
        for (const file of files) {
          const stored = crypto.randomUUID();
          await fs.writeFile(path.join(FILES_DIR, stored), Buffer.from(await file.arrayBuffer()));
          try {
            insert.run(
              assetId,
              logId,
              (file.name || "bestand").slice(0, 200),
              stored,
              file.type || "application/octet-stream",
              file.size,
            );
            saved++;
          } catch (err) {
            removeStoredFile(stored); // geen wezen op schijf achterlaten
            throw err;
          }
        }
        return Response.json({ ok: true, count: saved });
      },
    },
  },
});
