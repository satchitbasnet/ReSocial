import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  jsonb,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const planEnum = pgEnum("plan", ["trial", "starter", "pro", "agency"]);
export const platformEnum = pgEnum("platform", [
  "tiktok",
  "youtube",
  "instagram",
  "facebook",
  "linkedin",
  "twitter",
  "pinterest",
  "snapchat",
]);
export const postStatusEnum = pgEnum("post_status", [
  "draft",
  "processing",
  "scheduled",
  "published",
  "failed",
]);
export const distributionStatusEnum = pgEnum("distribution_status", [
  "pending",
  "processing",
  "published",
  "failed",
]);
export const referralStatusEnum = pgEnum("referral_status", [
  "pending",
  "converted",
]);
export const inboxMessageTypeEnum = pgEnum("inbox_message_type", [
  "comment",
  "dm",
  "mention",
]);
export const teamRoleEnum = pgEnum("team_role", ["admin", "editor", "viewer"]);
export const teamMemberStatusEnum = pgEnum("team_member_status", [
  "pending",
  "active",
]);
export const approvalStatusEnum = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
]);
export const reportFrequencyEnum = pgEnum("report_frequency", [
  "weekly",
  "monthly",
]);
export const accountTypeEnum = pgEnum("account_type", [
  "creator",
  "small_business",
  "agency",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  organizationName: text("organization_name"),
  accountType: accountTypeEnum("account_type").default("creator").notNull(),
  passwordHash: text("password_hash").notNull(),
  plan: planEnum("plan").default("trial").notNull(),
  trialEndsAt: timestamp("trial_ends_at"),
  videosPublished: integer("videos_published").default(0).notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  billingPeriodStart: timestamp("billing_period_start"),
  billingPeriodEnd: timestamp("billing_period_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usageMeters = pgTable(
  "usage_meters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),
    processingOpsUsed: integer("processing_ops_used").default(0).notNull(),
    postsPublished: integer("posts_published").default(0).notNull(),
    capWarningsSent: integer("cap_warnings_sent").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("usage_meters_user_period_idx").on(
      table.userId,
      table.periodStart
    ),
  ]
);

export const connectedAccounts = pgTable("connected_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  platform: platformEnum("platform").notNull(),
  accountName: text("account_name").notNull(),
  accountId: text("account_id"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  isActive: boolean("is_active").default(true).notNull(),
  connectedAt: timestamp("connected_at").defaultNow().notNull(),
});

export const driveConnections = pgTable("drive_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  accountEmail: text("account_email").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  folderId: text("folder_id"),
  isActive: boolean("is_active").default(true).notNull(),
  connectedAt: timestamp("connected_at").defaultNow().notNull(),
});

export const workflows = pgTable("workflows", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sourcePlatform: platformEnum("source_platform"),
  targetPlatforms: jsonb("target_platforms").$type<string[]>().notNull(),
  autoResize: boolean("auto_resize").default(true).notNull(),
  removeWatermark: boolean("remove_watermark").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const posts = pgTable("posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  workflowId: uuid("workflow_id").references(() => workflows.id),
  title: text("title").notNull(),
  caption: text("caption"),
  mediaUrl: text("media_url").notNull(),
  mediaType: text("media_type").default("video").notNull(),
  status: postStatusEnum("status").default("draft").notNull(),
  scheduledAt: timestamp("scheduled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const distributions = pgTable("distributions", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  accountId: uuid("account_id")
    .notNull()
    .references(() => connectedAccounts.id, { onDelete: "cascade" }),
  platform: platformEnum("platform").notNull(),
  status: distributionStatusEnum("status").default("pending").notNull(),
  platformPostId: text("platform_post_id"),
  caption: text("caption"),
  errorMessage: text("error_message"),
  processedDowngraded: boolean("processed_downgraded").default(false).notNull(),
  publishedAt: timestamp("published_at"),
});

export const usersRelations = relations(users, ({ many, one }) => ({
  connectedAccounts: many(connectedAccounts),
  workflows: many(workflows),
  posts: many(posts),
  usageMeters: many(usageMeters),
  driveConnection: one(driveConnections),
  affiliate: one(affiliates),
}));

export const usageMetersRelations = relations(usageMeters, ({ one }) => ({
  user: one(users, { fields: [usageMeters.userId], references: [users.id] }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(users, { fields: [posts.userId], references: [users.id] }),
  workflow: one(workflows, {
    fields: [posts.workflowId],
    references: [workflows.id],
  }),
  distributions: many(distributions),
}));

export const distributionsRelations = relations(distributions, ({ one }) => ({
  post: one(posts, {
    fields: [distributions.postId],
    references: [posts.id],
  }),
  account: one(connectedAccounts, {
    fields: [distributions.accountId],
    references: [connectedAccounts.id],
  }),
}));

export const postMetrics = pgTable("post_metrics", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  distributionId: uuid("distribution_id")
    .notNull()
    .references(() => distributions.id, { onDelete: "cascade" })
    .unique(),
  postId: uuid("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  platform: platformEnum("platform").notNull(),
  views: integer("views").default(0).notNull(),
  likes: integer("likes").default(0).notNull(),
  comments: integer("comments").default(0).notNull(),
  shares: integer("shares").default(0).notNull(),
  saves: integer("saves").default(0).notNull(),
  engagementRate: integer("engagement_rate").default(0).notNull(),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
});

export const platformDailyStats = pgTable("platform_daily_stats", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  platform: platformEnum("platform").notNull(),
  statDate: timestamp("stat_date").notNull(),
  views: integer("views").default(0).notNull(),
  engagements: integer("engagements").default(0).notNull(),
  postsPublished: integer("posts_published").default(0).notNull(),
  newFollowers: integer("new_followers").default(0).notNull(),
});

export const followerSnapshots = pgTable("follower_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: uuid("account_id")
    .notNull()
    .references(() => connectedAccounts.id, { onDelete: "cascade" }),
  platform: platformEnum("platform").notNull(),
  followerCount: integer("follower_count").notNull(),
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
});

export const postingTimeInsights = pgTable("posting_time_insights", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  platform: platformEnum("platform").notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  hourOfDay: integer("hour_of_day").notNull(),
  avgEngagementRate: integer("avg_engagement_rate").notNull(),
  sampleSize: integer("sample_size").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const inboxMessages = pgTable("inbox_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: uuid("account_id")
    .notNull()
    .references(() => connectedAccounts.id, { onDelete: "cascade" }),
  platform: platformEnum("platform").notNull(),
  platformMessageId: text("platform_message_id").notNull(),
  type: inboxMessageTypeEnum("type").default("comment").notNull(),
  authorName: text("author_name").notNull(),
  authorAvatar: text("author_avatar"),
  content: text("content").notNull(),
  postId: uuid("post_id").references(() => posts.id, { onDelete: "set null" }),
  distributionId: uuid("distribution_id").references(() => distributions.id, {
    onDelete: "set null",
  }),
  platformPostId: text("platform_post_id"),
  isRead: boolean("is_read").default(false).notNull(),
  isReplied: boolean("is_replied").default(false).notNull(),
  repliedAt: timestamp("replied_at"),
  assignedToUserId: uuid("assigned_to_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
});

export const savedReplies = pgTable("saved_replies", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const trackedHashtags = pgTable("tracked_hashtags", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  hashtag: text("hashtag").notNull(),
  platform: platformEnum("platform").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const hashtagStats = pgTable("hashtag_stats", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  hashtag: text("hashtag").notNull(),
  platform: platformEnum("platform").notNull(),
  statDate: timestamp("stat_date").notNull(),
  postCount: integer("post_count").default(0).notNull(),
  avgEngagement: integer("avg_engagement").default(0).notNull(),
  trendScore: integer("trend_score").default(0).notNull(),
});

export const teamMembers = pgTable("team_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  memberId: uuid("member_id").references(() => users.id, { onDelete: "set null" }),
  email: text("email").notNull(),
  role: teamRoleEnum("role").default("editor").notNull(),
  status: teamMemberStatusEnum("status").default("pending").notNull(),
  inviteToken: text("invite_token"),
  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  joinedAt: timestamp("joined_at"),
});

export const postApprovals = pgTable("post_approvals", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  requestedBy: uuid("requested_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  reviewedBy: uuid("reviewed_by").references(() => users.id, {
    onDelete: "set null",
  }),
  status: approvalStatusEnum("status").default("pending").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const competitorAccounts = pgTable("competitor_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  platform: platformEnum("platform").notNull(),
  handle: text("handle").notNull(),
  displayName: text("display_name"),
  followerCount: integer("follower_count").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const competitorStats = pgTable("competitor_stats", {
  id: uuid("id").defaultRandom().primaryKey(),
  competitorId: uuid("competitor_id")
    .notNull()
    .references(() => competitorAccounts.id, { onDelete: "cascade" }),
  statDate: timestamp("stat_date").notNull(),
  followerCount: integer("follower_count").default(0).notNull(),
  avgViews: integer("avg_views").default(0).notNull(),
  avgEngagement: integer("avg_engagement").default(0).notNull(),
  postsPublished: integer("posts_published").default(0).notNull(),
});

export const reportSchedules = pgTable("report_schedules", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  frequency: reportFrequencyEnum("frequency").notNull(),
  dayOfWeek: integer("day_of_week").default(1).notNull(),
  dayOfMonth: integer("day_of_month").default(1).notNull(),
  email: text("email").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastSentAt: timestamp("last_sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const affiliates = pgTable("affiliates", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  referralCode: text("referral_code").notNull().unique(),
  totalReferrals: integer("total_referrals").default(0).notNull(),
  totalEarnings: integer("total_earnings").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const referrals = pgTable("referrals", {
  id: uuid("id").defaultRandom().primaryKey(),
  affiliateId: uuid("affiliate_id")
    .notNull()
    .references(() => affiliates.id, { onDelete: "cascade" }),
  referredUserId: uuid("referred_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  status: referralStatusEnum("status").default("pending").notNull(),
  commission: integer("commission").default(0).notNull(),
  monthsCredited: integer("months_credited").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PostMetrics = typeof postMetrics.$inferSelect;
export type PlatformDailyStats = typeof platformDailyStats.$inferSelect;
export type FollowerSnapshot = typeof followerSnapshots.$inferSelect;
export type PostingTimeInsight = typeof postingTimeInsights.$inferSelect;
export type Affiliate = typeof affiliates.$inferSelect;
export type Referral = typeof referrals.$inferSelect;

export type UsageMeter = typeof usageMeters.$inferSelect;
export type User = typeof users.$inferSelect;
export type ConnectedAccount = typeof connectedAccounts.$inferSelect;
export type DriveConnection = typeof driveConnections.$inferSelect;
export type Workflow = typeof workflows.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Distribution = typeof distributions.$inferSelect;
export type InboxMessage = typeof inboxMessages.$inferSelect;
export type SavedReply = typeof savedReplies.$inferSelect;
export type TrackedHashtag = typeof trackedHashtags.$inferSelect;
export type HashtagStat = typeof hashtagStats.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type PostApproval = typeof postApprovals.$inferSelect;
export type CompetitorAccount = typeof competitorAccounts.$inferSelect;
export type CompetitorStat = typeof competitorStats.$inferSelect;
export type ReportSchedule = typeof reportSchedules.$inferSelect;
