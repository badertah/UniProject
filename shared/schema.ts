import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, serial, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  streak: integer("streak").notNull().default(0),
  lastLoginDate: text("last_login_date"),
  eduCoins: integer("edu_coins").notNull().default(100),
  equippedAvatar: varchar("equipped_avatar"),
  equippedFrame: varchar("equipped_frame"),
  equippedTheme: varchar("equipped_theme"),
  isAdmin: boolean("is_admin").notNull().default(false),
  sadConceptMastery: jsonb("sad_concept_mastery").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow(),
});

export const topics = pgTable("topics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull().default("BookOpen"),
  color: text("color").notNull().default("from-blue-500 to-purple-600"),
  orderIndex: integer("order_index").notNull().default(0),
});

export const levels = pgTable("levels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id").notNull().references(() => topics.id),
  levelNumber: integer("level_number").notNull(),
  name: text("name").notNull(),
  gameType: text("game_type").notNull(),
  xpReward: integer("xp_reward").notNull().default(50),
  coinReward: integer("coin_reward").notNull().default(10),
  difficulty: text("difficulty").notNull().default("easy"),
});

export const questions = pgTable("questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  levelId: varchar("level_id").notNull().references(() => levels.id),
  content: text("content").notNull(),
  answer: text("answer").notNull(),
  options: jsonb("options"),
  hint: text("hint"),
  orderIndex: integer("order_index").notNull().default(0),
});

export const userProgress = pgTable("user_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  levelId: varchar("level_id").notNull().references(() => levels.id),
  stageIndex: integer("stage_index").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  score: integer("score").notNull().default(0),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  userLevelStageUniq: uniqueIndex("user_progress_user_level_stage_uniq")
    .on(table.userId, table.levelId, table.stageIndex),
}));

export const cosmetics = pgTable("cosmetics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(),
  price: integer("price").notNull(),
  icon: text("icon").notNull(),
  description: text("description").notNull(),
  rarity: text("rarity").notNull().default("common"),
});

export const userCosmetics = pgTable("user_cosmetics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  cosmeticId: varchar("cosmetic_id").notNull().references(() => cosmetics.id),
  unlockedAt: timestamp("unlocked_at").defaultNow(),
});

export const badges = pgTable("badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  color: text("color").notNull().default("from-violet-500 to-purple-600"),
  requirementType: text("requirement_type").notNull(),
  requirementValue: integer("requirement_value").notNull().default(1),
  xpReward: integer("xp_reward").notNull().default(0),
  coinReward: integer("coin_reward").notNull().default(0),
  rarity: text("rarity").notNull().default("common"),
});

export const userBadges = pgTable("user_badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  badgeId: varchar("badge_id").notNull().references(() => badges.id),
  earnedAt: timestamp("earned_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertTopicSchema = createInsertSchema(topics).omit({ id: true });
export const insertLevelSchema = createInsertSchema(levels).omit({ id: true });
export const insertQuestionSchema = createInsertSchema(questions).omit({ id: true });
export const insertCosmeticSchema = createInsertSchema(cosmetics).omit({ id: true });
export const insertProgressSchema = createInsertSchema(userProgress).omit({ id: true, completedAt: true });
export const insertBadgeSchema = createInsertSchema(badges).omit({ id: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Topic = typeof topics.$inferSelect;
export type Level = typeof levels.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type UserProgress = typeof userProgress.$inferSelect;
export type Cosmetic = typeof cosmetics.$inferSelect;
export type UserCosmetic = typeof userCosmetics.$inferSelect;
export type Badge = typeof badges.$inferSelect;
export type UserBadge = typeof userBadges.$inferSelect;
export type InsertTopic = z.infer<typeof insertTopicSchema>;
export type InsertLevel = z.infer<typeof insertLevelSchema>;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type InsertBadge = z.infer<typeof insertBadgeSchema>;
