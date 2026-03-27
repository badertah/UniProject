import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, desc, sql as drizzleSql, and } from "drizzle-orm";
import {
  users, topics, levels, questions, userProgress, cosmetics, userCosmetics,
  type User, type InsertUser, type Topic, type Level, type Question,
  type UserProgress, type Cosmetic, type UserCosmetic,
  type InsertTopic, type InsertLevel, type InsertQuestion
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

  // Topics
  getAllTopics(): Promise<Topic[]>;
  getTopic(id: string): Promise<Topic | undefined>;
  createTopic(topic: InsertTopic): Promise<Topic>;

  // Levels
  getLevelsByTopic(topicId: string): Promise<Level[]>;
  getLevel(id: string): Promise<Level | undefined>;
  createLevel(level: InsertLevel): Promise<Level>;

  // Questions
  getQuestionsByLevel(levelId: string): Promise<Question[]>;
  createQuestion(question: InsertQuestion): Promise<Question>;

  // Progress
  getUserProgress(userId: string): Promise<(UserProgress & { level: Level; topic: Topic })[]>;
  getLevelProgress(userId: string, levelId: string): Promise<UserProgress | undefined>;
  saveProgress(userId: string, levelId: string, score: number, completed: boolean): Promise<UserProgress>;

  // Cosmetics
  getAllCosmetics(): Promise<Cosmetic[]>;
  getUserCosmetics(userId: string): Promise<(UserCosmetic & { cosmetic: Cosmetic })[]>;
  purchaseCosmetic(userId: string, cosmeticId: string): Promise<UserCosmetic>;
  hasCosmetic(userId: string, cosmeticId: string): Promise<boolean>;

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

  async getLeaderboard(limit = 10): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.xp)).limit(limit);
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

  async getQuestionsByLevel(levelId: string): Promise<Question[]> {
    return db.select().from(questions).where(eq(questions.levelId, levelId)).orderBy(questions.orderIndex);
  }

  async createQuestion(question: InsertQuestion): Promise<Question> {
    const [newQuestion] = await db.insert(questions).values(question).returning();
    return newQuestion;
  }

  async getUserProgress(userId: string): Promise<(UserProgress & { level: Level; topic: Topic })[]> {
    const results = await db
      .select({
        progress: userProgress,
        level: levels,
        topic: topics,
      })
      .from(userProgress)
      .innerJoin(levels, eq(userProgress.levelId, levels.id))
      .innerJoin(topics, eq(levels.topicId, topics.id))
      .where(eq(userProgress.userId, userId));

    return results.map(r => ({ ...r.progress, level: r.level, topic: r.topic }));
  }

  async getLevelProgress(userId: string, levelId: string): Promise<UserProgress | undefined> {
    const [progress] = await db
      .select()
      .from(userProgress)
      .where(and(eq(userProgress.userId, userId), eq(userProgress.levelId, levelId)));
    return progress;
  }

  async saveProgress(userId: string, levelId: string, score: number, completed: boolean): Promise<UserProgress> {
    const existing = await this.getLevelProgress(userId, levelId);
    if (existing) {
      const [updated] = await db
        .update(userProgress)
        .set({ score: Math.max(existing.score, score), completed: existing.completed || completed, completedAt: completed ? new Date() : existing.completedAt })
        .where(eq(userProgress.id, existing.id))
        .returning();
      return updated;
    }
    const [progress] = await db
      .insert(userProgress)
      .values({ userId, levelId, score, completed, completedAt: completed ? new Date() : undefined })
      .returning();
    return progress;
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
      .select()
      .from(userCosmetics)
      .where(and(eq(userCosmetics.userId, userId), eq(userCosmetics.cosmeticId, cosmeticId)));
    return !!uc;
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
