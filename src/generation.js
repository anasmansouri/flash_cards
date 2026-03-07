import { COMPLEX_CONNECTORS, LEVEL_WORD_LIMITS, STATUS } from "./constants.js";
import { db } from "./store.js";

function oneSentence(text, level) {
  const templates = {
    A1: `${text} helps me every day now`,
    A2: `I often use ${text} when I speak at school`,
    B1: `During class, I try to use ${text} naturally in longer conversations`,
    B2: `In professional meetings, I deliberately include ${text} so my arguments remain clear and precise`,
    C1: `While debating complex topics, I intentionally weave ${text} into nuanced explanations that preserve tone, context, and accuracy`
  };
  return templates[level];
}

function mockGenerate({ text, targetLanguage, knownLanguage, level }) {
  const sentenceTarget = oneSentence(text, level);
  return {
    meaningTarget: `${text} (${targetLanguage}) short meaning`,
    meaningKnown: `${text} (${knownLanguage}) short meaning`,
    sentenceTarget,
    sentenceKnown: `Translation: ${sentenceTarget}`
  };
}

export function validateGeneration(payload, { text, targetLanguage, level }) {
  const keys = Object.keys(payload).sort();
  const expected = ["meaningKnown", "meaningTarget", "sentenceKnown", "sentenceTarget"].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expected)) return "INVALID_KEYS";
  for (const value of Object.values(payload)) {
    if (!value || typeof value !== "string" || !value.trim()) return "EMPTY_VALUES";
  }
  const sentence = payload.sentenceTarget.trim();
  if ((sentence.match(/[.!?]/g) || []).length > 1) return "MULTI_SENTENCE";
  if (!sentence.toLowerCase().includes(text.toLowerCase())) return "TEXT_NOT_INCLUDED";
  const words = sentence.split(/\s+/).filter(Boolean).length;
  const [min, max] = LEVEL_WORD_LIMITS[level];
  if (words < min || words > max) return "WORD_COUNT_INVALID";
  if (["A1", "A2"].includes(level)) {
    const complex = COMPLEX_CONNECTORS[targetLanguage] || [];
    if (complex.some((c) => sentence.toLowerCase().includes(c.toLowerCase()))) return "COMPLEX_CONNECTOR";
  }
  return null;
}

export async function generateCardContent({ card, profile, maxRetries = 3 }) {
  const existing = db.cardContent.find(
    (c) => c.cardId === card.id && c.knownLanguage === profile.knownLanguage && c.level === profile.level
  );
  if (existing) {
    card.status = STATUS.READY;
    return existing;
  }

  let lastError = "UNKNOWN";
  for (let i = 0; i < maxRetries; i += 1) {
    const generated = mockGenerate({
      text: card.text,
      targetLanguage: card.targetLanguage,
      knownLanguage: profile.knownLanguage,
      level: profile.level
    });
    const err = validateGeneration(generated, {
      text: card.text,
      targetLanguage: card.targetLanguage,
      level: profile.level
    });
    if (!err) {
      const row = {
        cardId: card.id,
        knownLanguage: profile.knownLanguage,
        level: profile.level,
        meaningTarget: generated.meaningTarget,
        meaningKnown: generated.meaningKnown,
        sentenceTarget: generated.sentenceTarget,
        sentenceKnown: generated.sentenceKnown,
        model: "mock-v1",
        qualityFlags: null,
        createdAt: new Date().toISOString()
      };
      db.cardContent.push(row);
      card.status = STATUS.READY;
      return row;
    }
    lastError = err;
  }

  card.status = STATUS.FAILED;
  return { error: lastError };
}
