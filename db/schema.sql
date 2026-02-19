CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_profile (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  known_language TEXT NOT NULL,
  target_language TEXT NOT NULL,
  level TEXT NOT NULL,
  CHECK (known_language <> target_language)
);

CREATE TABLE cards (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_language TEXT NOT NULL,
  text TEXT NOT NULL,
  group_name TEXT NOT NULL DEFAULT 'Default',
  status TEXT NOT NULL CHECK (status IN ('generating', 'ready', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE card_content (
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  known_language TEXT NOT NULL,
  level TEXT NOT NULL,
  meaning_target TEXT NOT NULL,
  meaning_known TEXT NOT NULL,
  sentence_target TEXT NOT NULL,
  sentence_known TEXT NOT NULL,
  model TEXT NOT NULL,
  quality_flags JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (card_id, known_language, level)
);

CREATE TABLE reviews (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  result TEXT NOT NULL CHECK (result IN ('known', 'unknown')),
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE srs_state (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  due_at TIMESTAMPTZ NOT NULL,
  interval_days INT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, card_id)
);
