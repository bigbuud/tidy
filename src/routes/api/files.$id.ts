import { createFileRoute } from "@tanstack/react-router";

const INLINE = /^(image\/(png|jpeg|gif|webp)|application\/pdf)$/;

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

export const Route = createFileRoute("/api/files/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { userFromToken, parseCookie, SESSION_COOKIE } = await import("@/server/auth.server");
        const { getDb, FILES_DIR } = await import("@/server/db.server");
        const fs = await import("node:fs/promises");
        const path = await import("node:path");

        if (!userFromToken(parseCookie(request.headers.get("cookie"), SESSION_COOKIE))) {
          return text("Niet aangemeld", 401);
        }
        const id = Number(params.id);
        if (!Number.isInteger(id)) return text("Niet gevonden", 404);

        const doc = getDb()
          .prepare("SELECT filename, stored_name, mime FROM documents WHERE id = ?")
          .get(id) as { filename: string; stored_name: string; mime: string } | undefined;
        if (!doc) return text("Niet gevonden", 404);

        let buf: Buffer;
        try {
          buf = await fs.readFile(path.join(FILES_DIR, path.basename(doc.stored_name)));
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === "ENOENT")
            return text("Bestand ontbreekt op schijf", 404);
          throw err;
        }
        const inline = INLINE.test(doc.mime);
        return new Response(new Uint8Array(buf), {
          headers: {
            "content-type": inline ? doc.mime : "application/octet-stream",
            "content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
            "x-content-type-options": "nosniff",
            "cache-control": "private, no-store",
          },
        });
      },
    },
  },
});
