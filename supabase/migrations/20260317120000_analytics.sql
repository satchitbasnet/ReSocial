-- ReSocial Analytics Schema (Supabase-ready with RLS)
-- Run via Supabase CLI or apply_migration MCP tool.
-- user_id references auth.users when using Supabase Auth.

-- ─── Post-level metrics (synced from platform APIs) ───────────────────────────

CREATE TABLE IF NOT EXISTS post_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  distribution_id UUID NOT NULL UNIQUE,
  post_id         UUID NOT NULL,
  platform        TEXT NOT NULL CHECK (platform IN (
    'tiktok','youtube','instagram','facebook','linkedin','twitter','pinterest','snapchat'
  )),
  views           INTEGER NOT NULL DEFAULT 0,
  likes           INTEGER NOT NULL DEFAULT 0,
  comments        INTEGER NOT NULL DEFAULT 0,
  shares          INTEGER NOT NULL DEFAULT 0,
  saves           INTEGER NOT NULL DEFAULT 0,
  engagement_rate INTEGER NOT NULL DEFAULT 0,
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_metrics_user_id ON post_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_post_metrics_platform ON post_metrics(user_id, platform);

-- ─── Daily platform rollups ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_daily_stats (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform         TEXT NOT NULL CHECK (platform IN (
    'tiktok','youtube','instagram','facebook','linkedin','twitter','pinterest','snapchat'
  )),
  stat_date        DATE NOT NULL,
  views            INTEGER NOT NULL DEFAULT 0,
  engagements      INTEGER NOT NULL DEFAULT 0,
  posts_published  INTEGER NOT NULL DEFAULT 0,
  new_followers    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, platform, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_platform_daily_stats_user ON platform_daily_stats(user_id, stat_date);

-- ─── Follower count snapshots ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS follower_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id      UUID NOT NULL,
  platform        TEXT NOT NULL CHECK (platform IN (
    'tiktok','youtube','instagram','facebook','linkedin','twitter','pinterest','snapchat'
  )),
  follower_count  INTEGER NOT NULL,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_follower_snapshots_user ON follower_snapshots(user_id, recorded_at);

-- ─── Best time to post (computed from historical engagement) ──────────────────

CREATE TABLE IF NOT EXISTS posting_time_insights (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform            TEXT NOT NULL CHECK (platform IN (
    'tiktok','youtube','instagram','facebook','linkedin','twitter','pinterest','snapchat'
  )),
  day_of_week         INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  hour_of_day         INTEGER NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
  avg_engagement_rate INTEGER NOT NULL DEFAULT 0,
  sample_size         INTEGER NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform, day_of_week, hour_of_day)
);

CREATE INDEX IF NOT EXISTS idx_posting_time_user ON posting_time_insights(user_id, platform);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE post_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE follower_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE posting_time_insights ENABLE ROW LEVEL SECURITY;

-- post_metrics
CREATE POLICY "post_metrics_select_own" ON post_metrics
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "post_metrics_insert_own" ON post_metrics
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "post_metrics_update_own" ON post_metrics
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "post_metrics_delete_own" ON post_metrics
  FOR DELETE USING (auth.uid() = user_id);

-- platform_daily_stats
CREATE POLICY "platform_daily_stats_select_own" ON platform_daily_stats
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "platform_daily_stats_insert_own" ON platform_daily_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "platform_daily_stats_update_own" ON platform_daily_stats
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "platform_daily_stats_delete_own" ON platform_daily_stats
  FOR DELETE USING (auth.uid() = user_id);

-- follower_snapshots
CREATE POLICY "follower_snapshots_select_own" ON follower_snapshots
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "follower_snapshots_insert_own" ON follower_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "follower_snapshots_update_own" ON follower_snapshots
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "follower_snapshots_delete_own" ON follower_snapshots
  FOR DELETE USING (auth.uid() = user_id);

-- posting_time_insights
CREATE POLICY "posting_time_insights_select_own" ON posting_time_insights
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "posting_time_insights_insert_own" ON posting_time_insights
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posting_time_insights_update_own" ON posting_time_insights
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "posting_time_insights_delete_own" ON posting_time_insights
  FOR DELETE USING (auth.uid() = user_id);

-- Service role bypasses RLS for background sync jobs (use service_role key server-side only).
