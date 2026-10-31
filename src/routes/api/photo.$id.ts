import { createFileRoute } from "@tanstack/react-router";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

export const Route = createFileRoute("/api/photo/$id")({
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
        const row = getDb().prepare("SELECT photo_file FROM assets WHERE id = ?").get(id) as
          { photo_file: string | null } | undefined;
        if (!row?.photo_file) return text("Geen foto", 404);

        const name = path.basename(row.photo_file);
        const type = TYPES[name.split(".").pop() ?? ""];
        if (!type) return text("Niet gevonden", 404);
        let buf: Buffer;
        try {
          buf = await fs.readFile(path.join(FILES_DIR, name));
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === "ENOENT")
            return text("Foto ontbreekt op schijf", 404);
          throw err;
        }
        return new Response(new Uint8Array(buf), {
          headers: {
            "content-type": type,
            "x-content-type-options": "nosniff",
            "x-frame-options": "DENY",
            // De URL bevat ?v=<tijdstip>, een nieuwe foto krijgt dus een nieuwe URL.
            "cache-control": "private, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
