import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, desc, sql as drizzleSql, and } from "drizzle-orm";
import {
  users, topics, levels, questions, userProgress, cosmetics, userCosmetics,
  badges, userBadges,
  type User, type InsertUser, type Topic, type Level, type Question,
  type UserProgress, type Cosmetic, type UserCosmetic,
  type Badge, type UserBadge,
  type InsertTopic, type InsertLevel, type InsertQuestion, type InsertBadge
} from "@shared/schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User>;
  getLeaderboard(limit?: number): Promise<User[]>;
  getFarmLeaderboard(limit?: number): Promise<User[]>;
  getAllUsers(): Promise<User[]>;

  // Topics
  getAllTopics(): Promise<Topic[]>;
  getTopic(id: string): Promise<Topic | undefined>;
  createTopic(topic: InsertTopic): Promise<Topic>;

  // Levels
  getLevelsByTopic(topicId: string): Promise<Level[]>;
  getLevel(id: string): Promise<Level | undefined>;
  createLevel(level: InsertLevel): Promise<Level>;
  updateLevel(id: string, data: Partial<Level>): Promise<Level>;
  deleteLevel(id: string): Promise<void>;

  // Questions
  getQuestionsByLevel(levelId: string): Promise<Question[]>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  updateQuestion(id: string, data: Partial<Question>): Promise<Question>;
  deleteQuestion(id: string): Promise<void>;

  // Progress
  getUserProgress(userId: string): Promise<(UserProgress & { level: Level; topic: Topic })[]>;
  getStageProgress(userId: string, levelId: string, stageIndex: number): Promise<UserProgress | undefined>;
  getLevelStages(userId: string, levelId: string): Promise<UserProgress[]>;
  saveProgress(userId: string, levelId: string, stageIndex: number, score: number, completed: boolean): Promise<UserProgress>;
  getCompletedLevelsCount(userId: string): Promise<number>;
  runWithProgressLock<T>(userId: string, levelId: string, fn: () => Promise<T>): Promise<T>;

  // Cosmetics
  getAllCosmetics(): Promise<Cosmetic[]>;
  getUserCosmetics(userId: string): Promise<(UserCosmetic & { cosmetic: Cosmetic })[]>;
  purchaseCosmetic(userId: string, cosmeticId: string): Promise<UserCosmetic>;
  hasCosmetic(userId: string, cosmeticId: string): Promise<boolean>;

  // SAD concept mastery
  recordSadConceptMastery(userId: string, gameType: string): Promise<Record<string, boolean>>;
  getSadTeachBackOverrides(gameType: string): Promise<unknown[]>;

  // Badges
  getAllBadges(): Promise<Badge[]>;
  getUserBadges(userId: string): Promise<(UserBadge & { badge: Badge })[]>;
  // Returns undefined if the badge was already awarded (no row inserted).
  awardBadge(userId: string, badgeId: string): Promise<UserBadge | undefined>;
  hasBadge(userId: string, badgeId: string): Promise<boolean>;
  badgesCount(): Promise<number>;

  // Seeding
  topicsCount(): Promise<number>;
  cosmeticsCount(): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }

  async getLeaderboard(limit = 50): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.xp)).limit(limit);
  }

  async getFarmLeaderboard(limit = 50): Promise<User[]> {
    // Rank by lifetime farm earnings (best management proxy), with
    // current-day as tiebreaker so consistent farmers stay ahead of
    // one-off lucky harvests.
    return db.select().from(users)
      .orderBy(desc(users.farmTotalEarned), desc(users.farmDay))
      .limit(limit);
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getAllTopics(): Promise<Topic[]> {
    return db.select().from(topics).orderBy(topics.orderIndex);
  }

  async getTopic(id: string): Promise<Topic | undefined> {
    const [topic] = await db.select().from(topics).where(eq(topics.id, id));
    return topic;
  }

  async createTopic(topic: InsertTopic): Promise<Topic> {
    const [newTopic] = await db.insert(topics).values(topic).returning();
    return newTopic;
  }

  async getLevelsByTopic(topicId: string): Promise<Level[]> {
    return db.select().from(levels).where(eq(levels.topicId, topicId)).orderBy(levels.levelNumber);
  }

  async getLevel(id: string): Promise<Level | undefined> {
    const [level] = await db.select().from(levels).where(eq(levels.id, id));
    return level;
  }

  async createLevel(level: InsertLevel): Promise<Level> {
    const [newLevel] = await db.insert(levels).values(level).returning();
    return newLevel;
  }

  async updateLevel(id: string, data: Partial<Level>): Promise<Level> {
    const [updated] = await db.update(levels).set(data).where(eq(levels.id, id)).returning();
    return updated;
  }

  async deleteLevel(id: string): Promise<void> {
    await db.delete(questions).where(eq(questions.levelId, id));
    await db.delete(userProgress).where(eq(userProgress.levelId, id));
    await db.delete(levels).where(eq(levels.id, id));
  }

  async getQuestionsByLevel(levelId: string): Promise<Question[]> {
    return db.select().from(questions).where(eq(questions.levelId, levelId)).orderBy(questions.orderIndex);
  }

  async createQuestion(question: InsertQuestion): Promise<Question> {
    const [newQuestion] = await db.insert(questions).values(question).returning();
    return newQuestion;
  }

  async updateQuestion(id: string, data: Partial<Question>): Promise<Question> {
    const [updated] = await db.update(questions).set(data).where(eq(questions.id, id)).returning();
    return updated;
  }

  async deleteQuestion(id: string): Promise<void> {
    await db.delete(questions).where(eq(questions.id, id));
  }

  async getUserProgress(userId: string): Promise<(UserProgress & { level: Level; topic: Topic })[]> {
    const results = await db
      .select({ progress: userProgress, level: levels, topic: topics })
      .from(userProgress)
      .innerJoin(levels, eq(userProgress.levelId, levels.id))
      .innerJoin(topics, eq(levels.topicId, topics.id))
      .where(eq(userProgress.userId, userId));
    return results.map(r => ({ ...r.progress, level: r.level, topic: r.topic }));
  }

  // Serializes the read-modify-write critical section for a (userId, levelId) pair.
  // Uses a Postgres transaction-scoped advisory lock so concurrent /api/progress
  // submissions for the same user+level can't double-award first-completion bonuses.
  // Inner storage calls run on other pool connections — that's fine; the lock just
  // gates entry to this critical section, not the SQL inside it.
  async runWithProgressLock<T>(userId: string, levelId: string, fn: () => Promise<T>): Promise<T> {
    const key = `${userId}|${levelId}`;
    return db.transaction(async (tx) => {
      await tx.execute(drizzleSql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
      return fn();
    });
  }

  async getStageProgress(userId: string, levelId: string, stageIndex: number): Promise<UserProgress | undefined> {
    const [progress] = await db
      .select().from(userProgress)
      .where(and(
        eq(userProgress.userId, userId),
        eq(userProgress.levelId, levelId),
        eq(userProgress.stageIndex, stageIndex),
      ));
    return progress;
  }

  async getLevelStages(userId: string, levelId: string): Promise<UserProgress[]> {
    return db
      .select().from(userProgress)
      .where(and(eq(userProgress.userId, userId), eq(userProgress.levelId, levelId)));
  }

  async saveProgress(userId: string, levelId: string, stageIndex: number, score: number, completed: boolean): Promise<UserProgress> {
    // Atomic, race-safe upsert keyed by the (user_id, level_id, stage_index) unique index.
    // Score is monotonically max'd; completed is sticky-true; completedAt is set the first
    // time the stage transitions to completed, then preserved on later replays.
    const now = new Date();
    const [progress] = await db
      .insert(userProgress)
      .values({ userId, levelId, stageIndex, score, completed, completedAt: completed ? now : null })
      .onConflictDoUpdate({
        target: [userProgress.userId, userProgress.levelId, userProgress.stageIndex],
        set: {
          score: drizzleSql`GREATEST(${userProgress.score}, EXCLUDED.score)`,
          completed: drizzleSql`${userProgress.completed} OR EXCLUDED.completed`,
          completedAt: drizzleSql`COALESCE(${userProgress.completedAt}, EXCLUDED.completed_at)`,
        },
      })
      .returning();
    return progress;
  }

  // Counts levels where every question (stage) has at least one completed progress row.
  async getCompletedLevelsCount(userId: string): Promise<number> {
    const result = await db.execute(drizzleSql`
      SELECT COUNT(*)::int AS count FROM (
        SELECT up.level_id
        FROM user_progress up
        WHERE up.user_id = ${userId} AND up.completed = true
        GROUP BY up.level_id
        HAVING COUNT(DISTINCT up.stage_index) >=
          (SELECT GREATEST(COUNT(*), 1) FROM questions q WHERE q.level_id = up.level_id)
      ) t
    `);
    const rows: any[] = (result as any).rows ?? (result as any);
    return Number(rows?.[0]?.count) || 0;
  }

  async getAllCosmetics(): Promise<Cosmetic[]> {
    return db.select().from(cosmetics);
  }

  async getUserCosmetics(userId: string): Promise<(UserCosmetic & { cosmetic: Cosmetic })[]> {
    const results = await db
      .select({ uc: userCosmetics, cosmetic: cosmetics })
      .from(userCosmetics)
      .innerJoin(cosmetics, eq(userCosmetics.cosmeticId, cosmetics.id))
      .where(eq(userCosmetics.userId, userId));
    return results.map(r => ({ ...r.uc, cosmetic: r.cosmetic }));
  }

  async purchaseCosmetic(userId: string, cosmeticId: string): Promise<UserCosmetic> {
    const [uc] = await db.insert(userCosmetics).values({ userId, cosmeticId }).returning();
    return uc;
  }

  async hasCosmetic(userId: string, cosmeticId: string): Promise<boolean> {
    const [uc] = await db
      .select().from(userCosmetics)
      .where(and(eq(userCosmetics.userId, userId), eq(userCosmetics.cosmeticId, cosmeticId)));
    return !!uc;
  }

  async getSadTeachBackOverrides(gameType: string): Promise<unknown[]> {
    // Returns the union of every per-question `options.teachBack` array
    // attached to questions belonging to a level with the given game_type.
    // Used by the server to verify a submitted teach-back answer against
    // the same pool the client sampled from.
    const rows = await db
      .select({ options: questions.options })
      .from(questions)
      .innerJoin(levels, eq(questions.levelId, levels.id))
      .where(eq(levels.gameType, gameType));
    const out: unknown[] = [];
    for (const r of rows) {
      const opts = r.options as { teachBack?: unknown } | null;
      const tb = opts?.teachBack;
      if (Array.isArray(tb)) out.push(...tb);
    }
    return out;
  }

  async recordSadConceptMastery(userId: string, gameType: string): Promise<Record<string, boolean>> {
    // Atomic JSONB merge — set { [gameType]: true } without a read-modify-write race.
    const [updated] = await db
      .update(users)
      .set({
        sadConceptMastery: drizzleSql`COALESCE(${users.sadConceptMastery}, '{}'::jsonb)
          || jsonb_build_object(${gameType}::text, true)`,
      })
      .where(eq(users.id, userId))
      .returning({ mastery: users.sadConceptMastery });
    return (updated?.mastery ?? {}) as Record<string, boolean>;
  }

  async getAllBadges(): Promise<Badge[]> {
    return db.select().from(badges);
  }

  async getUserBadges(userId: string): Promise<(UserBadge & { badge: Badge })[]> {
    const results = await db
      .select({ ub: userBadges, badge: badges })
      .from(userBadges)
      .innerJoin(badges, eq(userBadges.badgeId, badges.id))
      .where(eq(userBadges.userId, userId));
    return results.map(r => ({ ...r.ub, badge: r.badge }));
  }

  async awardBadge(userId: string, badgeId: string): Promise<UserBadge | undefined> {
    // ON CONFLICT DO NOTHING relies on the (user_id, badge_id) unique index
    // created in server/index.ts. If the badge was already awarded, no row
    // is returned — callers use that signal to skip duplicate reward grants.
    const [ub] = await db
      .insert(userBadges)
      .values({ userId, badgeId })
      .onConflictDoNothing({ target: [userBadges.userId, userBadges.badgeId] })
      .returning();
    return ub;
  }

  async hasBadge(userId: string, badgeId: string): Promise<boolean> {
    const [ub] = await db
      .select().from(userBadges)
      .where(and(eq(userBadges.userId, userId), eq(userBadges.badgeId, badgeId)));
    return !!ub;
  }

  async badgesCount(): Promise<number> {
    const [{ count }] = await db.select({ count: drizzleSql<number>`count(*)` }).from(badges);
    return Number(count);
  }

  async topicsCount(): Promise<number> {
    const [{ count }] = await db.select({ count: drizzleSql<number>`count(*)` }).from(topics);
    return Number(count);
  }

  async cosmeticsCount(): Promise<number> {
    const [{ count }] = await db.select({ count: drizzleSql<number>`count(*)` }).from(cosmetics);
    return Number(count);
  }
}

export const storage = new DatabaseStorage();
