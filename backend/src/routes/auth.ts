import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authRequired, config } from "../config";
import { clearSession, hasValidSession, issueSession, passwordMatches } from "../middleware/auth";

const router = Router();

// Brute-force protection: 8 attempts per 15 minutes per IP (trust proxy is set in server.ts).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again in 15 minutes." },
});

// GET /api/auth/me — tells the UI whether to show the login screen or the demo banner
router.get("/me", (req, res) => {
  res.json({
    demo: config.demo,
    authRequired,
    authenticated: !authRequired || hasValidSession(req),
  });
});

// POST /api/auth/login
router.post("/login", loginLimiter, (req, res) => {
  if (!authRequired) return res.status(400).json({ error: "Login is not enabled on this server" });
  const { password } = (req.body || {}) as { password?: unknown };
  if (typeof password !== "string" || !passwordMatches(password)) {
    return res.status(401).json({ error: "Incorrect password" });
  }
  issueSession(res);
  res.json({ authenticated: true });
});

// POST /api/auth/logout
router.post("/logout", (_req, res) => {
  clearSession(res);
  res.json({ authenticated: false });
});

export default router;
