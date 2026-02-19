import { randomUUID } from "crypto";
import { STATUS } from "./constants.js";

export const db = {
  users: [],
  profiles: [],
  cards: [],
  cardContent: [],
  reviews: [],
  srsState: []
};

export function createUser(email, passwordHash) {
  const user = { id: randomUUID(), email, passwordHash, createdAt: new Date().toISOString() };
  db.users.push(user);
  return user;
}

export function createCard({ userId, text, targetLanguage }) {
  const card = {
    id: randomUUID(),
    userId,
    text,
    targetLanguage,
    status: STATUS.GENERATING,
    createdAt: new Date().toISOString()
  };
  db.cards.push(card);
  db.srsState.push({ userId, cardId: card.id, dueAt: new Date().toISOString(), intervalDays: 1, updatedAt: new Date().toISOString() });
  return card;
}

export function getDueCard(userId, targetLanguage) {
  const now = Date.now();
  const candidates = db.srsState
    .filter((s) => s.userId === userId && new Date(s.dueAt).getTime() <= now)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  for (const s of candidates) {
    const card = db.cards.find((c) => c.id === s.cardId && c.targetLanguage === targetLanguage && c.status === STATUS.READY);
    if (card) return card;
  }
  return null;
}
