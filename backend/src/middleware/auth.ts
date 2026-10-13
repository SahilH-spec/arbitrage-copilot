import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { authRequired, config } from "../config";

export const SESSION_COOKIE = "ac_session";

/** Constant-time password check (compares fixed-length digests). */
export function passwordMatches(candidate: string): boolean {
  const a = crypto.createHash("sha256").update(candidate).digest();
  const b = crypto.createHash("sha256").update(config.security.appPassword).digest();
  return crypto.timingSafeEqual(a, b);
}

export function issueSession(res: Response): void {
  const hours = config.security.sessionTtlHours;
  const token = jwt.sign({ sub: "owner" }, config.security.jwtSecret, { algorithm: "HS256", expiresIn: `${hours}h` });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: config.env === "production",
    maxAge: hours * 3600 * 1000,
    path: "/",
  });
}

export function clearSession(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function hasValidSession(req: Request): boolean {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return false;
  try {
    jwt.verify(token, config.security.jwtSecret, { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

/** Gate for every /api route except /health and /auth/*. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!authRequired || hasValidSession(req)) return next();
  res.status(401).json({ error: "Authentication required" });
}

/** Public demo: reads only. Writes (and every route that spends API credits) are refused. */
export function demoReadOnly(req: Request, res: Response, next: NextFunction) {
  if (req.method === "GET" || req.method === "HEAD") return next();
  res.status(403).json({ error: "This is a read-only public demo with fictional data." });
}

export const gate = config.demo ? demoReadOnly : requireAuth;
