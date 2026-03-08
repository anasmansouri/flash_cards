CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  plan TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_profile (
  user_id TEXT PRIMARY KEY,
  known_language TEXT NOT NULL,
  target_language TEXT NOT NULL,
  level TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  target_language TEXT NOT NULL,
  text TEXT NOT NULL,
  group_name TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS card_content (
  card_id TEXT NOT NULL,
  known_language TEXT NOT NULL,
  level TEXT NOT NULL,
  meaning_target TEXT NOT NULL,
  meaning_known TEXT NOT NULL,
  sentence_target TEXT NOT NULL,
  sentence_known TEXT NOT NULL,
  source TEXT NOT NULL,
  model TEXT NOT NULL,
  generation_error TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (card_id, known_language, level)
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  result TEXT NOT NULL,
  reviewed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS srs_state (
  user_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  due_at TEXT NOT NULL,
  interval_days INT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, card_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
