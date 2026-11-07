import crypto from "node:crypto";
import * as OTPAuth from "otpauth";
import { getCookie, setCookie, deleteCookie, getRequestHeader } from "@tanstack/react-start/server";
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
    issuer: "Tidy",
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

// ---------- Bescherming tegen gokken op het wachtwoord ----------
// Per bezoeker (IP-adres) maximaal MAX_FAILURES mislukte pogingen, daarna LOCK_MS geblokkeerd.
// Daarnaast een noodrem voor iedereen samen, voor als iemand IP-adressen vervalst.
const MAX_FAILURES = 5;
const LOCK_MS = 5 * 60 * 1000;
const GLOBAL_MAX = 30;
const GLOBAL_WINDOW_MS = 15 * 60 * 1000;

type Attempt = { failures: number; lockedUntil: number; last: number };
const attempts = new Map<string, Attempt>();
let globalFailures: number[] = [];

/**
 * Sleutel voor de blokkade. Alleen met TRUST_PROXY=true wordt het IP uit de proxy-headers gelezen
 * (Cloudflare of Nginx Proxy Manager). Zonder proxy zijn die headers vervalsbaar, dan geldt één teller voor iedereen.
 */
export function clientKey(): string {
  if (process.env["TRUST_PROXY"] !== "true") return "iedereen";
  const raw =
    getRequestHeader("cf-connecting-ip") ??
    getRequestHeader("x-forwarded-for")?.split(",")[0] ??
    getRequestHeader("x-real-ip");
  return raw?.trim().slice(0, 64) || "onbekend";
}

function prune(now: number) {
  globalFailures = globalFailures.filter((t) => now - t < GLOBAL_WINDOW_MS);
  if (attempts.size > 1000) {
    for (const [k, a] of attempts)
      if (now - a.last > LOCK_MS && now >= a.lockedUntil) attempts.delete(k);
  }
}

export function assertNotLocked(key: string) {
  const now = Date.now();
  prune(now);
  if (globalFailures.length >= GLOBAL_MAX) {
    throw new Error("Te veel mislukte pogingen. Probeer het later opnieuw.");
  }
  const a = attempts.get(key);
  if (a && now < a.lockedUntil) {
    const min = Math.ceil((a.lockedUntil - now) / 60000);
    throw new Error(`Te veel mislukte pogingen. Probeer opnieuw over ${min} min.`);
  }
}

export function registerFailure(key: string) {
  const now = Date.now();
  globalFailures.push(now);
  const a = attempts.get(key) ?? { failures: 0, lockedUntil: 0, last: now };
  a.failures++;
  a.last = now;
  if (a.failures >= MAX_FAILURES) {
    a.lockedUntil = now + LOCK_MS;
    a.failures = 0;
  }
  attempts.set(key, a);
}

export function registerSuccess(key: string) {
  attempts.delete(key);
}
