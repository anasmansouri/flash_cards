import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { z } from "zod";
import { LEVELS, STATUS, SUPPORTED_LANGUAGES } from "./constants.js";
import { createCard, createUser, db, getDueCard } from "./store.js";
import { generateCardContent } from "./generation.js";

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

app.use(cors());
app.use(express.json());

const profileSchema = z.object({
  knownLanguage: z.enum(SUPPORTED_LANGUAGES),
  targetLanguage: z.enum(SUPPORTED_LANGUAGES),
  level: z.enum(LEVELS)
});
const authSchema = z.object({ email: z.string().email(), password: z.string().min(6) });

function auth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "UNAUTHORIZED" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }
}

function getProfile(userId) {
  return db.profiles.find((p) => p.userId === userId);
}

app.post("/api/auth/signup", async (req, res) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_INPUT" });
  if (db.users.some((u) => u.email === parsed.data.email)) return res.status(409).json({ error: "EMAIL_EXISTS" });
  const user = createUser(parsed.data.email, await bcrypt.hash(parsed.data.password, 10));
  const token = jwt.sign({ userId: user.id }, JWT_SECRET);
  res.json({ token });
});

app.post("/api/auth/login", async (req, res) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_INPUT" });
  const user = db.users.find((u) => u.email === parsed.data.email);
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ error: "INVALID_CREDENTIALS" });
  }
  const token = jwt.sign({ userId: user.id }, JWT_SECRET);
  res.json({ token });
});

app.post("/api/auth/forgot-password", (_req, res) => res.json({ ok: true }));

app.get("/api/profile", auth, (req, res) => {
  const profile = getProfile(req.userId);
  if (!profile) return res.status(404).json({ error: "PROFILE_NOT_FOUND" });
  return res.json(profile);
});

app.patch("/api/profile", auth, (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_INPUT" });
  if (parsed.data.knownLanguage === parsed.data.targetLanguage) {
    return res.status(400).json({
      error: "LANGUAGE_PAIR_INVALID",
      message: "Target language must differ from known language."
    });
  }
  const idx = db.profiles.findIndex((p) => p.userId === req.userId);
  const payload = { userId: req.userId, ...parsed.data };
  if (idx >= 0) db.profiles[idx] = payload;
  else db.profiles.push(payload);
  return res.json(payload);
});

function dailyGenerationCount(userId) {
  const day = new Date().toISOString().slice(0, 10);
  return db.cards.filter((c) => c.userId === userId && c.createdAt.startsWith(day)).length;
}

app.post("/api/cards", auth, async (req, res) => {
  const text = (req.body.text || "").trim();
  if (!text || text.length > 80) return res.status(400).json({ error: "INVALID_TEXT" });
  const profile = getProfile(req.userId);
  if (!profile) return res.status(400).json({ error: "PROFILE_REQUIRED" });
  if (dailyGenerationCount(req.userId) >= 10) {
    return res.status(429).json({ error: "DAILY_LIMIT_REACHED", message: "Daily word generation limit reached." });
  }
  const card = createCard({ userId: req.userId, text, targetLanguage: profile.targetLanguage });
  generateCardContent({ card, profile });
  return res.json({ cardId: card.id, status: card.status });
});

app.get("/api/cards", auth, (req, res) => {
  const { query = "", status, page = 1, pageSize = 20 } = req.query;
  let items = db.cards.filter((c) => c.userId === req.userId && c.text.toLowerCase().includes(String(query).toLowerCase()));
  if (status) items = items.filter((c) => c.status === status);
  const p = Number(page);
  const ps = Number(pageSize);
  const start = (p - 1) * ps;
  const paged = items.slice(start, start + ps).map((c) => ({
    cardId: c.id,
    text: c.text,
    status: c.status,
    createdAt: c.createdAt
  }));
  res.json({ items: paged, page: p, pageSize: ps, total: items.length });
});

app.delete("/api/cards/:id", auth, (req, res) => {
  db.cards = db.cards.filter((c) => !(c.id === req.params.id && c.userId === req.userId));
  db.cardContent = db.cardContent.filter((c) => c.cardId !== req.params.id);
  db.srsState = db.srsState.filter((s) => s.cardId !== req.params.id);
  res.json({ ok: true });
});

app.post("/api/cards/:id/retry", auth, async (req, res) => {
  const card = db.cards.find((c) => c.id === req.params.id && c.userId === req.userId);
  if (!card) return res.status(404).json({ error: "NOT_FOUND" });
  const profile = getProfile(req.userId);
  if (!profile) return res.status(400).json({ error: "PROFILE_REQUIRED" });
  card.status = STATUS.GENERATING;
  await generateCardContent({ card, profile });
  res.json({ status: card.status });
});

app.get("/api/session/next", auth, (req, res) => {
  const profile = getProfile(req.userId);
  if (!profile) return res.status(400).json({ error: "PROFILE_REQUIRED" });
  const card = getDueCard(req.userId, profile.targetLanguage);
  if (!card) return res.json({ cardId: null, text: null });
  return res.json({ cardId: card.id, text: card.text });
});

function review(req, res, result) {
  const card = db.cards.find((c) => c.id === req.params.id && c.userId === req.userId);
  if (!card) return res.status(404).json({ error: "NOT_FOUND" });
  db.reviews.push({ id: randomUUID(), userId: req.userId, cardId: card.id, result, reviewedAt: new Date().toISOString() });
  const srs = db.srsState.find((s) => s.userId === req.userId && s.cardId === card.id);
  if (result === "known") {
    srs.intervalDays = Math.max(1, Math.round((srs.intervalDays || 1) * 2));
  } else {
    srs.intervalDays = 1;
  }
  srs.dueAt = new Date(Date.now() + srs.intervalDays * 24 * 60 * 60 * 1000).toISOString();
  srs.updatedAt = new Date().toISOString();
  return { card };
}

app.post("/api/cards/:id/known", auth, (req, res) => {
  const result = review(req, res, "known");
  if (!result?.card) return;
  res.json({ ok: true });
});

app.post("/api/cards/:id/unknown", auth, (req, res) => {
  const result = review(req, res, "unknown");
  if (!result?.card) return;
  const profile = getProfile(req.userId);
  const content = db.cardContent.find(
    (c) => c.cardId === result.card.id && c.knownLanguage === profile.knownLanguage && c.level === profile.level
  );
  if (!content) return res.status(409).json({ error: "CONTENT_NOT_READY" });
  res.json({
    meaningTarget: content.meaningTarget,
    meaningKnown: content.meaningKnown,
    sentenceTarget: content.sentenceTarget,
    sentenceKnown: content.sentenceKnown
  });
});

app.get("/api/stats", auth, (req, res) => {
  const totalCards = db.cards.filter((c) => c.userId === req.userId).length;
  const day = new Date().toISOString().slice(0, 10);
  const reviewsToday = db.reviews.filter((r) => r.userId === req.userId && r.reviewedAt.startsWith(day));
  const known = reviewsToday.filter((r) => r.result === "known").length;
  const unknown = reviewsToday.filter((r) => r.result === "unknown").length;
  const dueToday = db.srsState.filter((s) => s.userId === req.userId && new Date(s.dueAt) <= new Date()).length;
  res.json({ totalCards, reviewsToday: reviewsToday.length, known, unknown, dueToday });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
