import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { insertUserSchema } from "@shared/schema";

const JWT_SECRET = process.env.SESSION_SECRET || "eduquest-secret-2024";

interface AuthRequest extends Request {
  userId?: string;
  user?: any;
}

function generateToken(userId: string) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }
  try {
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

async function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const user = await storage.getUser(req.userId);
  if (!user?.isAdmin) return res.status(403).json({ error: "Admin access required" });
  next();
}

function calculateLevel(xp: number): number {
  return Math.floor(xp / 150) + 1;
}

function getTier(xp: number): string {
  if (xp >= 7000) return "Legend";
  if (xp >= 3500) return "Master";
  if (xp >= 1500) return "Expert";
  if (xp >= 500) return "Scholar";
  return "Rookie";
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // ============ AUTH ============
  app.post("/api/auth/register", async (req, res) => {
    try {
      const parsed = insertUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Username and password are required" });
      }
      const { username, password } = parsed.data;
      if (username.length < 3) return res.status(400).json({ error: "Username must be at least 3 characters" });
      if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

      const existing = await storage.getUserByUsername(username);
      if (existing) return res.status(409).json({ error: "Username already taken" });

      const hash = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ username, password: hash });
      const token = generateToken(user.id);

      // Set streak for first login
      const today = new Date().toISOString().split("T")[0];
      await storage.updateUser(user.id, { lastLoginDate: today, streak: 1, level: 1 });

      const { password: _, ...safeUser } = { ...user, lastLoginDate: today, streak: 1, level: 1 };
      res.json({ token, user: { ...safeUser, tier: getTier(safeUser.xp) } });
    } catch (e) {
      console.error("Register error:", e);
      res.status(500).json({ error: "Registration failed. Please try again." });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ error: "Username and password are required" });

      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(401).json({ error: "Invalid username or password" });

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ error: "Invalid username or password" });

      // Streak logic
      const today = new Date().toISOString().split("T")[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      let newStreak = user.streak;
      let streakBonus = 0;

      if (user.lastLoginDate !== today) {
        if (user.lastLoginDate === yesterday) {
          newStreak = user.streak + 1;
        } else {
          newStreak = 1;
        }
        streakBonus = Math.min(newStreak * 5, 50);
        const newXp = user.xp + streakBonus;
        const newLevel = calculateLevel(newXp);
        await storage.updateUser(user.id, {
          lastLoginDate: today,
          streak: newStreak,
          xp: newXp,
          level: newLevel,
          eduCoins: user.eduCoins + Math.floor(streakBonus / 2),
        });
      }

      const updated = await storage.getUser(user.id);
      const token = generateToken(user.id);
      const { password: _, ...safeUser } = updated!;
      res.json({ token, user: { ...safeUser, tier: getTier(safeUser.xp), streakBonus } });
    } catch (e) {
      console.error("Login error:", e);
      res.status(500).json({ error: "Login failed. Please try again." });
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) return res.status(404).json({ error: "User not found" });
      const { password: _, ...safeUser } = user;
      res.json({ ...safeUser, tier: getTier(safeUser.xp) });
    } catch {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // ============ TOPICS ============
  app.get("/api/topics", async (req, res) => {
    try {
      const allTopics = await storage.getAllTopics();
      const topicsWithCount = await Promise.all(
        allTopics.map(async (topic) => {
          const levels = await storage.getLevelsByTopic(topic.id);
          return { ...topic, levelCount: levels.length, levels };
        })
      );
      res.json(topicsWithCount);
    } catch {
      res.status(500).json({ error: "Failed to fetch topics" });
    }
  });

  app.get("/api/topics/:id", async (req, res) => {
    try {
      const topic = await storage.getTopic(req.params.id);
      if (!topic) return res.status(404).json({ error: "Topic not found" });
      const topicLevels = await storage.getLevelsByTopic(topic.id);
      res.json({ ...topic, levels: topicLevels });
    } catch {
      res.status(500).json({ error: "Failed to fetch topic" });
    }
  });

  app.post("/api/topics", authMiddleware, adminMiddleware as any, async (req: AuthRequest, res) => {
    try {
      const topic = await storage.createTopic(req.body);
      res.json(topic);
    } catch {
      res.status(500).json({ error: "Failed to create topic" });
    }
  });

  // ============ LEVELS ============
  app.get("/api/levels/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const level = await storage.getLevel(req.params.id);
      if (!level) return res.status(404).json({ error: "Level not found" });
      const qs = await storage.getQuestionsByLevel(level.id);
      res.json({ ...level, questions: qs });
    } catch {
      res.status(500).json({ error: "Failed to fetch level" });
    }
  });

  app.post("/api/levels", authMiddleware, adminMiddleware as any, async (req: AuthRequest, res) => {
    try {
      const level = await storage.createLevel(req.body);
      res.json(level);
    } catch {
      res.status(500).json({ error: "Failed to create level" });
    }
  });

  app.post("/api/questions", authMiddleware, adminMiddleware as any, async (req: AuthRequest, res) => {
    try {
      const question = await storage.createQuestion(req.body);
      res.json(question);
    } catch {
      res.status(500).json({ error: "Failed to create question" });
    }
  });

  // ============ PROGRESS ============
  app.post("/api/progress", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { levelId, score, completed } = req.body;
      if (!levelId) return res.status(400).json({ error: "levelId required" });

      const level = await storage.getLevel(levelId);
      if (!level) return res.status(404).json({ error: "Level not found" });

      const existing = await storage.getLevelProgress(req.userId!, levelId);
      const isFirstCompletion = !existing?.completed && completed;

      const progress = await storage.saveProgress(req.userId!, levelId, score, completed);

      let xpGained = 0;
      let coinsGained = 0;

      if (isFirstCompletion) {
        xpGained = level.xpReward;
        coinsGained = level.coinReward;
      } else if (completed) {
        // Partial reward for replaying
        xpGained = Math.floor(level.xpReward * 0.25);
        coinsGained = Math.floor(level.coinReward * 0.25);
      }

      if (xpGained > 0 || coinsGained > 0) {
        const user = await storage.getUser(req.userId!);
        if (user) {
          const newXp = user.xp + xpGained;
          const newLevel = calculateLevel(newXp);
          await storage.updateUser(req.userId!, {
            xp: newXp,
            level: newLevel,
            eduCoins: user.eduCoins + coinsGained,
          });
        }
      }

      const updatedUser = await storage.getUser(req.userId!);
      const { password: _, ...safeUser } = updatedUser!;

      res.json({
        progress,
        xpGained,
        coinsGained,
        user: { ...safeUser, tier: getTier(safeUser.xp) },
        isFirstCompletion,
      });
    } catch (e) {
      console.error("Progress error:", e);
      res.status(500).json({ error: "Failed to save progress" });
    }
  });

  app.get("/api/progress", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const progress = await storage.getUserProgress(req.userId!);
      res.json(progress);
    } catch {
      res.status(500).json({ error: "Failed to fetch progress" });
    }
  });

  // ============ LEADERBOARD ============
  app.get("/api/leaderboard", async (req, res) => {
    try {
      const leaders = await storage.getLeaderboard(20);
      const safe = leaders.map(({ password: _, ...u }) => ({ ...u, tier: getTier(u.xp) }));
      res.json(safe);
    } catch {
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  // ============ COSMETICS ============
  app.get("/api/cosmetics", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const all = await storage.getAllCosmetics();
      const owned = await storage.getUserCosmetics(req.userId!);
      const ownedIds = new Set(owned.map(uc => uc.cosmeticId));
      res.json(all.map(c => ({ ...c, owned: ownedIds.has(c.id) })));
    } catch {
      res.status(500).json({ error: "Failed to fetch cosmetics" });
    }
  });

  app.post("/api/cosmetics/purchase/:cosmeticId", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { cosmeticId } = req.params;
      const user = await storage.getUser(req.userId!);
      if (!user) return res.status(404).json({ error: "User not found" });

      const cosmetic = (await storage.getAllCosmetics()).find(c => c.id === cosmeticId);
      if (!cosmetic) return res.status(404).json({ error: "Cosmetic not found" });

      const alreadyOwned = await storage.hasCosmetic(req.userId!, cosmeticId);
      if (alreadyOwned) return res.status(409).json({ error: "Already owned" });

      if (user.eduCoins < cosmetic.price) {
        return res.status(400).json({ error: "Insufficient EduCoins" });
      }

      await storage.purchaseCosmetic(req.userId!, cosmeticId);
      const updated = await storage.updateUser(req.userId!, { eduCoins: user.eduCoins - cosmetic.price });
      const { password: _, ...safeUser } = updated;

      res.json({ success: true, user: { ...safeUser, tier: getTier(safeUser.xp) } });
    } catch {
      res.status(500).json({ error: "Purchase failed" });
    }
  });

  app.post("/api/cosmetics/equip/:cosmeticId", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { cosmeticId } = req.params;
      const user = await storage.getUser(req.userId!);
      if (!user) return res.status(404).json({ error: "User not found" });

      const cosmetic = (await storage.getAllCosmetics()).find(c => c.id === cosmeticId);
      if (!cosmetic) return res.status(404).json({ error: "Cosmetic not found" });

      const owned = await storage.hasCosmetic(req.userId!, cosmeticId);
      if (!owned) return res.status(403).json({ error: "You don't own this cosmetic" });

      const updateData: any = {};
      if (cosmetic.type === "avatar") updateData.equippedAvatar = cosmeticId;
      if (cosmetic.type === "frame") updateData.equippedFrame = cosmeticId;
      if (cosmetic.type === "theme") updateData.equippedTheme = cosmeticId;

      const updated = await storage.updateUser(req.userId!, updateData);
      const { password: _, ...safeUser } = updated;
      res.json({ user: { ...safeUser, tier: getTier(safeUser.xp) } });
    } catch {
      res.status(500).json({ error: "Equip failed" });
    }
  });

  app.post("/api/cosmetics/unequip", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { type } = req.body;
      const updateData: any = {};
      if (type === "avatar") updateData.equippedAvatar = null;
      if (type === "frame") updateData.equippedFrame = null;
      if (type === "theme") updateData.equippedTheme = null;
      const updated = await storage.updateUser(req.userId!, updateData);
      const { password: _, ...safeUser } = updated;
      res.json({ user: { ...safeUser, tier: getTier(safeUser.xp) } });
    } catch {
      res.status(500).json({ error: "Unequip failed" });
    }
  });

  // ============ MINIGAME REWARD ============
  app.post("/api/minigame/reward", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { score } = req.body;
      const xpReward = Math.min(Math.floor(score * 2), 20);
      const coinsReward = Math.min(Math.floor(score / 5), 5);
      const user = await storage.getUser(req.userId!);
      if (!user) return res.status(404).json({ error: "User not found" });
      const newXp = user.xp + xpReward;
      const newLevel = calculateLevel(newXp);
      const updated = await storage.updateUser(req.userId!, {
        xp: newXp,
        level: newLevel,
        eduCoins: user.eduCoins + coinsReward,
        tier: getTier(newXp),
      });
      const { password: _, ...safeUser } = updated;
      res.json({ user: { ...safeUser, tier: getTier(safeUser.xp) }, xpReward, coinsReward });
    } catch {
      res.status(500).json({ error: "Reward failed" });
    }
  });

  // ============ SPEND COINS (Tycoon) ============
  app.post("/api/coins/spend", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { amount } = req.body;
      const user = await storage.getUser(req.userId!);
      if (!user) return res.status(404).json({ error: "User not found" });
      if (user.eduCoins < amount) return res.status(400).json({ error: "Not enough EduCoins" });
      const updated = await storage.updateUser(req.userId!, { eduCoins: user.eduCoins - amount });
      const { password: _, ...safeUser } = updated;
      res.json({ user: { ...safeUser, tier: getTier(safeUser.xp) } });
    } catch {
      res.status(500).json({ error: "Spend failed" });
    }
  });

  return httpServer;
}
