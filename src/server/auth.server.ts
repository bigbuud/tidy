import crypto from "node:crypto";
import * as OTPAuth from "otpauth";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { getDb } from "./db.server";

export const SESSION_COOKIE = "logboek_sid";
const MAX_AGE = 60 * 60 * 24 * 14;

export function hashPassword(pw: string) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString("hex")}$${h.toString("hex")}`;
}

export function verifyPassword(pw: string, stored: string) {
  const [, s, h] = stored.split("$");
  if (!s || !h) return false;
  const calc = crypto.scryptSync(pw, Buffer.from(s, "hex"), 64);
  const expected = Buffer.from(h, "hex");
  return calc.length === expected.length && crypto.timingSafeEqual(calc, expected);
}

// Wordt gebruikt zodat een login met een onbekende gebruikersnaam even lang duurt
// als een login met een bestaande (geen gebruikersnamen af te leiden uit de responstijd).
let dummyHash: string | undefined;
export function verifyAgainstDummy(pw: string) {
  dummyHash ??= hashPassword("dummy-wachtwoord");
  verifyPassword(pw, dummyHash);
  return false;
}

export function makeTotp(secret: string, username: string) {
  return new OTPAuth.TOTP({
    issuer: "Logboek",
    label: username,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

/** Returns the time step of a valid code, or null. */
export function checkTotp(secret: string, username: string, code: string): number | null {
  const delta = makeTotp(secret, username).validate({ token: code.replace(/\s/g, ""), window: 1 });
  if (delta === null) return null;
  return Math.floor(Date.now() / 30000) + delta;
}

const sha = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

export function createSession(userId: number) {
  const token = crypto.randomBytes(32).toString("base64url");
  getDb()
    .prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .run(sha(token), userId, Date.now() + MAX_AGE * 1000);
  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
    secure: process.env["COOKIE_SECURE"] === "true",
  });
}

let lastCleanup = 0;

export function userFromToken(token: string | undefined) {
  if (!token) return null;
  const db = getDb();
  const now = Date.now();
  // Verlopen sessies hoogstens één keer per uur opruimen i.p.v. bij elke aanvraag.
  if (now - lastCleanup > 60 * 60 * 1000) {
    lastCleanup = now;
    db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now);
  }
  const row = db
    .prepare(
      `SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(sha(token), now) as { id: number; username: string } | undefined;
  return row ?? null;
}

export function getSessionUser() {
  return userFromToken(getCookie(SESSION_COOKIE));
}

export function requireUser() {
  const u = getSessionUser();
  if (!u) throw new Error("Niet aangemeld");
  return u;
}

export function destroySession() {
  const token = getCookie(SESSION_COOKIE);
  if (token) getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha(token));
  deleteCookie(SESSION_COOKIE, { path: "/" });
}

export function parseCookie(header: string | null, name: string) {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

// Simple brute-force protection (single-user app, single process).
let failures = 0;
let lockedUntil = 0;
export function assertNotLocked() {
  if (Date.now() < lockedUntil) {
    const min = Math.ceil((lockedUntil - Date.now()) / 60000);
    throw new Error(`Te veel mislukte pogingen. Probeer opnieuw over ${min} min.`);
  }
}
export function registerFailure() {
  failures++;
  if (failures >= 5) {
    lockedUntil = Date.now() + 5 * 60 * 1000;
    failures = 0;
  }
}
export function registerSuccess() {
  failures = 0;
}
