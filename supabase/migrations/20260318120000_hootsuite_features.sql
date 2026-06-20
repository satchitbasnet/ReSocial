-- ReSocial Features 5-8: listening, team, benchmarking, reports
-- Also: inbox, saved_replies, distributions.caption (if not yet applied)

ALTER TABLE distributions ADD COLUMN IF NOT EXISTS caption TEXT;

CREATE TABLE IF NOT EXISTS inbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES connected_accounts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  platform_message_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'comment' CHECK (type IN ('comment', 'dm', 'mention')),
  author_name TEXT NOT NULL,
  author_avatar TEXT,
  content TEXT NOT NULL,
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  distribution_id UUID REFERENCES distributions(id) ON DELETE SET NULL,
  platform_post_id TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_replied BOOLEAN NOT NULL DEFAULT false,
  replied_at TIMESTAMPTZ,
  assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS saved_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tracked_hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hashtag TEXT NOT NULL,
  platform TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hashtag_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hashtag TEXT NOT NULL,
  platform TEXT NOT NULL,
  stat_date TIMESTAMPTZ NOT NULL,
  post_count INTEGER NOT NULL DEFAULT 0,
  avg_engagement INTEGER NOT NULL DEFAULT 0,
  trend_score INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('admin', 'editor', 'viewer')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
  invite_token TEXT,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  joined_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS post_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS competitor_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  handle TEXT NOT NULL,
  display_name TEXT,
  follower_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS competitor_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES competitor_accounts(id) ON DELETE CASCADE,
  stat_date TIMESTAMPTZ NOT NULL,
  follower_count INTEGER NOT NULL DEFAULT 0,
  avg_views INTEGER NOT NULL DEFAULT 0,
  avg_engagement INTEGER NOT NULL DEFAULT 0,
  posts_published INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly')),
  day_of_week INTEGER NOT NULL DEFAULT 1,
  day_of_month INTEGER NOT NULL DEFAULT 1,
  email TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inbox_user ON inbox_messages(user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_hashtag_stats_user ON hashtag_stats(user_id, hashtag, platform);
CREATE INDEX IF NOT EXISTS idx_competitor_stats ON competitor_stats(competitor_id, stat_date DESC);
