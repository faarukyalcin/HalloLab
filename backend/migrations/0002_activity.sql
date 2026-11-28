-- Istanbul local-day learning attendance. No passwords or private lesson content here.
CREATE TABLE IF NOT EXISTS activity_days (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  active_seconds INTEGER NOT NULL DEFAULT 0,
  last_ping_at INTEGER,
  login_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id,day)
);
CREATE INDEX IF NOT EXISTS activity_days_day_idx ON activity_days(day);
