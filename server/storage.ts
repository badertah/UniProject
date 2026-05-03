import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, desc, sql as drizzleSql, and, gte, isNull, lt } from "drizzle-orm";
import {
  users, topics, levels, questions, userProgress, cosmetics, userCosmetics,
  badges, userBadges, minigameSessions, gameSessions,
  type User, type InsertUser, type Topic, type Level, type Question,
  type UserProgress, type Cosmetic, type UserCosmetic,
  type Badge, type UserBadge, type MinigameSession, type GameSession,
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
  purchaseCosmetic(userId: string, cosmeticId: string): Promise<{ userCosmetic: UserCosmetic; newBalance: number }>;
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

  // Minigame sessions
  createMinigameSession(userId: string): Promise<MinigameSession | null>;
  claimMinigameSession(id: string, userId: string): Promise<boolean>;
  countDailyMinigameClaims(userId: string): Promise<number>;

  // Game sessions
  createGameSession(userId: string, levelId: string, stageIndex: number): Promise<GameSession>;
  claimGameSession(id: string, userId: string, levelId: string, stageIndex: number, requireTeachback: boolean): Promise<boolean>;
  markSessionTeachbackPassed(id: string, userId: string, levelId: string, stageIndex: number): Promise<boolean>;

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

  async purchaseCosmetic(userId: string, cosmeticId: string): Promise<{ userCosmetic: UserCosmetic; newBalance: number }> {
    return db.transaction(async (tx) => {
      // Lock the user row to serialize concurrent purchase attempts.
      const [user] = await tx.execute(
        drizzleSql`SELECT id, edu_coins FROM users WHERE id = ${userId} FOR UPDATE`
      ).then((r) => (r.rows ?? r) as { id: string; edu_coins: number }[]);
      if (!user) throw new Error("User not found");

      const [cosmetic] = await tx.select().from(cosmetics).where(eq(cosmetics.id, cosmeticId));
      if (!cosmetic) throw new Error("Cosmetic not found");

      const [existing] = await tx.select().from(userCosmetics)
        .where(and(eq(userCosmetics.userId, userId), eq(userCosmetics.cosmeticId, cosmeticId)));
      if (existing) throw new Error("Already owned");

      if (user.edu_coins < cosmetic.price) throw new Error("Insufficient EduCoins");

      const [uc] = await tx.insert(userCosmetics).values({ userId, cosmeticId }).returning();

      const newBalance = user.edu_coins - cosmetic.price;
      await tx.update(users)
        .set({ eduCoins: newBalance })
        .where(and(eq(users.id, userId), gte(users.eduCoins, cosmetic.price)));

      return { userCosmetic: uc, newBalance };
    });
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

  // Enforce a per-user rate-limit: no more than one minigame session created per
  // MINIGAME_CREATION_COOLDOWN_MS window. This prevents rapid start→reward cycling
  // even though each session is single-use.
  async createMinigameSession(userId: string): Promise<MinigameSession | null> {
    const cooldownAgo = new Date(Date.now() - 30_000);
    const [recent] = await db
      .select({ id: minigameSessions.id })
      .from(minigameSessions)
      .where(and(eq(minigameSessions.userId, userId), gte(minigameSessions.createdAt, cooldownAgo)))
      .limit(1);
    if (recent) return null;
    const [session] = await db.insert(minigameSessions).values({ userId }).returning();
    return session;
  }

  async claimMinigameSession(id: string, userId: string): Promise<boolean> {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const result = await db
      .update(minigameSessions)
      .set({ claimedAt: new Date() })
      .where(
        and(
          eq(minigameSessions.id, id),
          eq(minigameSessions.userId, userId),
          isNull(minigameSessions.claimedAt),
          gte(minigameSessions.createdAt, tenMinutesAgo),
        ),
      )
      .returning({ id: minigameSessions.id });
    return result.length > 0;
  }

  async countDailyMinigameClaims(userId: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [{ count }] = await db
      .select({ count: drizzleSql<number>`count(*)` })
      .from(minigameSessions)
      .where(
        and(
          eq(minigameSessions.userId, userId),
          gte(minigameSessions.claimedAt, startOfDay),
        ),
      );
    return Number(count);
  }

  // Returns an existing unclaimed session for the same (user, level, stage) if
  // one was created recently, or creates a new one. This prevents flooding the
  // table with thousands of unclaimed tokens for the same stage (which an attacker
  // could use to keep cycling claims after the daily cap resets).
  async createGameSession(userId: string, levelId: string, stageIndex: number): Promise<GameSession> {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const [existing] = await db
      .select()
      .from(gameSessions)
      .where(
        and(
          eq(gameSessions.userId, userId),
          eq(gameSessions.levelId, levelId),
          eq(gameSessions.stageIndex, stageIndex),
          isNull(gameSessions.claimedAt),
          gte(gameSessions.createdAt, tenMinutesAgo),
        ),
      )
      .limit(1);
    if (existing) return existing;
    const [session] = await db.insert(gameSessions).values({ userId, levelId, stageIndex }).returning();
    return session;
  }

  // Marks a session as having passed the server-graded teach-back quiz.
  // Only updates when the session belongs to this user, matches levelId+stageIndex,
  // is still unclaimed, and is within the 30-minute window.
  async markSessionTeachbackPassed(id: string, userId: string, levelId: string, stageIndex: number): Promise<boolean> {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const result = await db
      .update(gameSessions)
      .set({ teachbackPassed: true })
      .where(
        and(
          eq(gameSessions.id, id),
          eq(gameSessions.userId, userId),
          eq(gameSessions.levelId, levelId),
          eq(gameSessions.stageIndex, stageIndex),
          isNull(gameSessions.claimedAt),
          gte(gameSessions.createdAt, thirtyMinutesAgo),
        ),
      )
      .returning({ id: gameSessions.id });
    return result.length > 0;
  }

  // Returns true when the session was successfully claimed.
  // For SAD game types (requireTeachback=true) the session must also have
  // teachback_passed=true, which is set only by the server-graded quiz route.
  async claimGameSession(id: string, userId: string, levelId: string, stageIndex: number, requireTeachback: boolean): Promise<boolean> {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const conditions = [
      eq(gameSessions.id, id),
      eq(gameSessions.userId, userId),
      eq(gameSessions.levelId, levelId),
      eq(gameSessions.stageIndex, stageIndex),
      isNull(gameSessions.claimedAt),
      gte(gameSessions.createdAt, thirtyMinutesAgo),
    ] as const;
    const whereClause = requireTeachback
      ? and(...conditions, eq(gameSessions.teachbackPassed, true))
      : and(...conditions);
    const result = await db
      .update(gameSessions)
      .set({ claimedAt: new Date() })
      .where(whereClause)
      .returning({ id: gameSessions.id });
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
