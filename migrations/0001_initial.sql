PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS competitions (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  discipline TEXT NOT NULL,
  name TEXT NOT NULL,
  organizer TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competition_id TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('rating','rating_na','text','yesno')),
  domain TEXT,
  position INTEGER NOT NULL,
  FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competition_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  response_id INTEGER NOT NULL,
  question_id INTEGER,
  value TEXT NOT NULL,
  FOREIGN KEY (response_id) REFERENCES responses(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_competitions_year ON competitions(year);
CREATE INDEX IF NOT EXISTS idx_competitions_discipline ON competitions(discipline);
CREATE INDEX IF NOT EXISTS idx_responses_competition ON responses(competition_id);
