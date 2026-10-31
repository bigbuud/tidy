import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CATEGORY_VALUES } from "./categories";

/** Zod-fouten omzetten naar een korte, leesbare melding (i.p.v. een JSON-dump in de toast). */
function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.output<S> {
  const r = schema.safeParse(input);
  if (!r.success) throw new Error(r.error.issues[0]?.message ?? "Ongeldige invoer");
  return r.data;
}

const idSchema = z.object({ id: z.number().int().positive("Ongeldig id") });

const auth = () => import("@/server/auth.server");
const database = () => import("@/server/db.server");

export type Asset = {
  id: number;
  name: string;
  category: string;
  description: string;
  /** Tijdstip van de laatste fotowijziging (voor de URL), of null zonder foto. */
  photo_v: number | null;
  log_count: number;
  total_cost: number | null;
  last_date: string | null;
};
export type LogEntry = {
  id: number;
  date: string;
  title: string;
  notes: string;
  cost: number | null;
  mileage: number | null;
};
export type Doc = {
  id: number;
  log_id: number | null;
  filename: string;
  mime: string;
  size: number;
  uploaded_at: string;
};

// ---------- Auth ----------

export const getAuthState = createServerFn({ method: "GET" }).handler(async () => {
  const { getDb } = await database();
  const { getSessionUser } = await auth();
  const hasUser = !!getDb().prepare("SELECT 1 FROM users LIMIT 1").get();
  return { setupNeeded: !hasUser, user: hasUser ? getSessionUser() : null };
});

export const setupInit = createServerFn({ method: "POST" })
  .inputValidator((d: { username: string }) =>
    parse(
      z.object({ username: z.string().trim().min(1, "Gebruikersnaam is verplicht").max(50) }),
      d,
    ),
  )
  .handler(async ({ data }) => {
    const { getDb } = await database();
    if (getDb().prepare("SELECT 1 FROM users LIMIT 1").get()) throw new Error("Account bestaat al");
    const OTPAuth = await import("otpauth");
    const QRCode = await import("qrcode");
    const { makeTotp } = await auth();
    const secret = new OTPAuth.Secret({ size: 20 }).base32;
    const uri = makeTotp(secret, data.username).toString();
    const qr = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
    return { secret, qr };
  });

export const setupComplete = createServerFn({ method: "POST" })
  .inputValidator((d: { username: string; password: string; secret: string; code: string }) =>
    parse(
      z.object({
        username: z.string().trim().min(1, "Gebruikersnaam is verplicht").max(50),
        password: z.string().min(10, "Wachtwoord moet minstens 10 tekens zijn").max(200),
        secret: z.string().min(16).max(64),
        code: z.string().min(6, "Code moet 6 cijfers zijn").max(8),
      }),
      d,
    ),
  )
  .handler(async ({ data }) => {
    const { getDb } = await database();
    const a = await auth();
    const db = getDb();
    if (db.prepare("SELECT 1 FROM users LIMIT 1").get()) throw new Error("Account bestaat al");
    const step = a.checkTotp(data.secret, data.username, data.code);
    if (step === null) throw new Error("Verificatiecode klopt niet");
    const res = db
      .prepare(
        "INSERT INTO users (username, password_hash, totp_secret, last_totp_step) VALUES (?, ?, ?, ?)",
      )
      .run(data.username, a.hashPassword(data.password), data.secret, step);
    a.createSession(Number(res.lastInsertRowid));
    return { ok: true };
  });

export const login = createServerFn({ method: "POST" })
  .inputValidator((d: { username: string; password: string; code: string }) =>
    parse(
      z.object({
        username: z.string().max(50),
        password: z.string().max(200),
        code: z.string().max(8),
      }),
      d,
    ),
  )
  .handler(async ({ data }) => {
    const { getDb } = await database();
    const a = await auth();
    const key = a.clientKey();
    a.assertNotLocked(key);
    const db = getDb();
    const user = db
      .prepare(
        "SELECT id, username, password_hash, totp_secret, last_totp_step FROM users WHERE username = ?",
      )
      .get(data.username.trim()) as
      | {
          id: number;
          username: string;
          password_hash: string;
          totp_secret: string;
          last_totp_step: number;
        }
      | undefined;
    const pwOk = user
      ? a.verifyPassword(data.password, user.password_hash)
      : a.verifyAgainstDummy(data.password);
    const step = user && pwOk ? a.checkTotp(user.totp_secret, user.username, data.code) : null;
    if (!user || !pwOk || step === null || step <= user.last_totp_step) {
      a.registerFailure(key);
      throw new Error("Gebruikersnaam, wachtwoord of code klopt niet");
    }
    a.registerSuccess(key);
    db.prepare("UPDATE users SET last_totp_step = ? WHERE id = ?").run(step, user.id);
    a.createSession(user.id);
    return { ok: true };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  (await auth()).destroySession();
  return { ok: true };
});

// ---------- Assets ----------

export const listAssets = createServerFn({ method: "GET" }).handler(async () => {
  (await auth()).requireUser();
  const { getDb } = await database();
  return getDb()
    .prepare(
      `SELECT a.id, a.name, a.category, a.description, a.photo_v,
        (SELECT COUNT(*) FROM logs l WHERE l.asset_id = a.id) AS log_count,
        (SELECT SUM(cost) FROM logs l WHERE l.asset_id = a.id) AS total_cost,
        (SELECT MAX(date) FROM logs l WHERE l.asset_id = a.id) AS last_date
       FROM assets a ORDER BY a.name COLLATE NOCASE`,
    )
    .all() as unknown as Asset[];
});

export const getAsset = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number }) => parse(idSchema, d))
  .handler(async ({ data }) => {
    (await auth()).requireUser();
    const { getDb } = await database();
    const db = getDb();
    const asset = db
      .prepare("SELECT id, name, category, description, photo_v FROM assets WHERE id = ?")
      .get(data.id) as
      Pick<Asset, "id" | "name" | "category" | "description" | "photo_v"> | undefined;
    if (!asset) return null;
    const logs = db
      .prepare(
        "SELECT id, date, title, notes, cost, mileage FROM logs WHERE asset_id = ? ORDER BY date DESC, id DESC",
      )
      .all(data.id) as unknown as LogEntry[];
    const docs = db
      .prepare(
        "SELECT id, log_id, filename, mime, size, uploaded_at FROM documents WHERE asset_id = ? ORDER BY uploaded_at DESC",
      )
      .all(data.id) as unknown as Doc[];
    return { asset, logs, docs };
  });

const assetSchema = z.object({
  id: z.number().int().optional(),
  name: z.string().trim().min(1, "Naam is verplicht").max(120, "Naam is te lang"),
  category: z.enum(CATEGORY_VALUES, { errorMap: () => ({ message: "Ongeldige categorie" }) }),
  description: z.string().max(2000, "Omschrijving is te lang").default(""),
});

export const saveAsset = createServerFn({ method: "POST" })
  .inputValidator((d: z.input<typeof assetSchema>) => parse(assetSchema, d))
  .handler(async ({ data }) => {
    (await auth()).requireUser();
    const { getDb } = await database();
    const db = getDb();
    if (data.id) {
      const res = db
        .prepare("UPDATE assets SET name = ?, category = ?, description = ? WHERE id = ?")
        .run(data.name, data.category, data.description, data.id);
      if (res.changes === 0) throw new Error("Item niet gevonden");
      return { id: data.id };
    }
    const r = db
      .prepare("INSERT INTO assets (name, category, description) VALUES (?, ?, ?)")
      .run(data.name, data.category, data.description);
    return { id: Number(r.lastInsertRowid) };
  });

export const deleteAsset = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number }) => parse(idSchema, d))
  .handler(async ({ data }) => {
    (await auth()).requireUser();
    const { getDb, removeStoredFile } = await database();
    const db = getDb();
    const files = db
      .prepare("SELECT stored_name FROM documents WHERE asset_id = ?")
      .all(data.id) as { stored_name: string }[];
    const photo = db.prepare("SELECT photo_file FROM assets WHERE id = ?").get(data.id) as
      { photo_file: string | null } | undefined;
    db.prepare("DELETE FROM assets WHERE id = ?").run(data.id);
    files.forEach((f) => removeStoredFile(f.stored_name));
    if (photo?.photo_file) removeStoredFile(photo.photo_file);
    return { ok: true };
  });

export const removePhoto = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number }) => parse(idSchema, d))
  .handler(async ({ data }) => {
    (await auth()).requireUser();
    const { getDb, removeStoredFile } = await database();
    const db = getDb();
    const row = db.prepare("SELECT photo_file FROM assets WHERE id = ?").get(data.id) as
      { photo_file: string | null } | undefined;
    db.prepare("UPDATE assets SET photo_file = NULL, photo_v = NULL WHERE id = ?").run(data.id);
    if (row?.photo_file) removeStoredFile(row.photo_file);
    return { ok: true };
  });

// ---------- Logs ----------

const logSchema = z.object({
  assetId: z.number().int().positive(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ongeldige datum")
    .refine((d) => !Number.isNaN(Date.parse(d)), "Ongeldige datum"),
  title: z.string().trim().min(1, "Omschrijving is verplicht").max(200, "Omschrijving is te lang"),
  notes: z.string().max(5000, "Notities zijn te lang").default(""),
  cost: z.number({ invalid_type_error: "Kost moet een getal zijn" }).finite().nullable(),
  mileage: z
    .number()
    .int("Kilometerstand moet een geheel getal zijn")
    .min(0, "Kilometerstand kan niet negatief zijn")
    .nullable(),
});

export const addLog = createServerFn({ method: "POST" })
  .inputValidator((d: z.input<typeof logSchema>) => parse(logSchema, d))
  .handler(async ({ data }) => {
    (await auth()).requireUser();
    const { getDb } = await database();
    const db = getDb();
    if (!db.prepare("SELECT 1 FROM assets WHERE id = ?").get(data.assetId))
      throw new Error("Item niet gevonden");
    const r = db
      .prepare(
        "INSERT INTO logs (asset_id, date, title, notes, cost, mileage) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(data.assetId, data.date, data.title, data.notes, data.cost, data.mileage);
    return { id: Number(r.lastInsertRowid) };
  });

const updateLogSchema = logSchema
  .omit({ assetId: true })
  .extend({ id: z.number().int().positive() });

export const updateLog = createServerFn({ method: "POST" })
  .inputValidator((d: z.input<typeof updateLogSchema>) => parse(updateLogSchema, d))
  .handler(async ({ data }) => {
    (await auth()).requireUser();
    const { getDb } = await database();
    const res = getDb()
      .prepare("UPDATE logs SET date = ?, title = ?, notes = ?, cost = ?, mileage = ? WHERE id = ?")
      .run(data.date, data.title, data.notes, data.cost, data.mileage, data.id);
    if (res.changes === 0) throw new Error("Log niet gevonden");
    return { id: data.id };
  });

export const deleteLog = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number }) => parse(idSchema, d))
  .handler(async ({ data }) => {
    (await auth()).requireUser();
    const { getDb, removeStoredFile } = await database();
    const db = getDb();
    const files = db.prepare("SELECT stored_name FROM documents WHERE log_id = ?").all(data.id) as {
      stored_name: string;
    }[];
    db.prepare("DELETE FROM logs WHERE id = ?").run(data.id);
    files.forEach((f) => removeStoredFile(f.stored_name));
    return { ok: true };
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number }) => parse(idSchema, d))
  .handler(async ({ data }) => {
    (await auth()).requireUser();
    const { getDb, removeStoredFile } = await database();
    const db = getDb();
    const f = db.prepare("SELECT stored_name FROM documents WHERE id = ?").get(data.id) as
      { stored_name: string } | undefined;
    db.prepare("DELETE FROM documents WHERE id = ?").run(data.id);
    if (f) removeStoredFile(f.stored_name);
    return { ok: true };
  });
