import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  jsonb,
  pgEnum,
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

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  plan: planEnum("plan").default("trial").notNull(),
  trialEndsAt: timestamp("trial_ends_at"),
  videosPublished: integer("videos_published").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
  errorMessage: text("error_message"),
  publishedAt: timestamp("published_at"),
});

export const usersRelations = relations(users, ({ many }) => ({
  connectedAccounts: many(connectedAccounts),
  workflows: many(workflows),
  posts: many(posts),
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

export type User = typeof users.$inferSelect;
export type ConnectedAccount = typeof connectedAccounts.$inferSelect;
export type Workflow = typeof workflows.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Distribution = typeof distributions.$inferSelect;
