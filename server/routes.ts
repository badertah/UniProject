import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { insertUserSchema } from "@shared/schema";
import {
  TEACH_BACK_BANK,
  SAD_GAME_TYPES,
  isSadGameType,
  type SadGameType,
} from "@shared/teach-back";

const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    console.error("FATAL: SESSION_SECRET environment variable is not set. Refusing to start in production without a secure JWT secret.");
    process.exit(1);
  } else {
    console.warn("WARNING: SESSION_SECRET is not set. Using an insecure default secret for development only.");
  }
}
const EFFECTIVE_JWT_SECRET = JWT_SECRET || "eduquest-secret-2024-dev-only";

interface TeachBackEntry {
  prompt: string;
  options: string[];
  correctIndex: number;
  why?: string;
}

function isTeachBackQ(value: unknown): value is TeachBackEntry {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.prompt === "string" &&
    Array.isArray(v.options) &&
    v.options.every((o) => typeof o === "string") &&
    typeof v.correctIndex === "number"
  );
}

interface AuthRequest extends Request {
  userId?: string;
  user?: any;
}

function generateToken(userId: string) {
  return jwt.sign({ userId }, EFFECTIVE_JWT_SECRET, { expiresIn: "7d" });
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }
  try {
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET) as { userId: string };
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

async function checkAndAwardBadges(userId: string): Promise<any[]> {
  try {
    const [user, allBadges, userBadgesList, completedCount] = await Promise.all([
      storage.getUser(userId),
      storage.getAllBadges(),
      storage.getUserBadges(userId),
      storage.getCompletedLevelsCount(userId),
    ]);
    if (!user) return [];

    const userBadgeIds = new Set(userBadgesList.map(ub => ub.badgeId));
    const newlyAwarded: any[] = [];

    const userProgress = await storage.getUserProgress(userId);
    const gameTypesCompleted = new Set(
      userProgress.filter(p => p.completed).map(p => p.level.gameType)
    );

    const sadMastery = (user.sadConceptMastery ?? {}) as Record<string, boolean>;
    const sadConceptCount = SAD_GAME_TYPES.filter((gt) => sadMastery[gt] === true).length;

    for (const badge of allBadges) {
      if (userBadgeIds.has(badge.id)) continue;

      let earned = false;
      switch (badge.requirementType) {
        case "xp_milestone":
          earned = user.xp >= badge.requirementValue;
          break;
        case "streak":
          earned = user.streak >= badge.requirementValue;
          break;
        case "levels_complete":
          earned = completedCount >= badge.requirementValue;
          break;
        case "game_type_memory_flip":
          earned = gameTypesCompleted.has("memory_flip");
          break;
        case "game_type_wordle":
          earned = gameTypesCompleted.has("wordle");
          break;
        case "game_type_concept_connector":
          earned = gameTypesCompleted.has("concept_connector") || gameTypesCompleted.has("matcher") || gameTypesCompleted.has("term_matcher");
          break;
        case "concept_master_sad":
          earned = sadConceptCount >= SAD_GAME_TYPES.length;
          break;
      }

      if (earned) {
        // awardBadge returns undefined if a concurrent caller already
        // inserted the row (unique index on (user_id, badge_id)). Only
        // grant XP/coin rewards when WE actually inserted the row, so a
        // race can never double-pay.
        const inserted = await storage.awardBadge(userId, badge.id);
        if (!inserted) {
          userBadgeIds.add(badge.id);
          continue;
        }
        if (badge.xpReward > 0 || badge.coinReward > 0) {
          const currentUser = await storage.getUser(userId);
          if (currentUser) {
            const newXp = currentUser.xp + badge.xpReward;
            await storage.updateUser(userId, {
              xp: newXp,
              level: calculateLevel(newXp),
              eduCoins: currentUser.eduCoins + badge.coinReward,
            });
          }
        }
        newlyAwarded.push(badge);
        userBadgeIds.add(badge.id);
      }
    }

    return newlyAwarded;
  } catch (e) {
    console.error("Badge check error:", e);
    return [];
  }
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
      const existing = await storage.getUserByUsername(username);
      if (existing) return res.status(409).json({ error: "Username already taken" });
      const hashed = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ username, password: hashed });
      const token = generateToken(user.id);
      const { password: _, ...safeUser } = user;
      res.json({ token, user: { ...safeUser, tier: getTier(safeUser.xp) } });
    } catch (e) {
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(401).json({ error: "Invalid credentials" });
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ error: "Invalid credentials" });

      const today = new Date().toISOString().split("T")[0];
      let newStreak = user.streak;
      let streakBonus = 0;

      if (user.lastLoginDate !== today) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
        if (user.lastLoginDate === yesterday) {
          newStreak = user.streak + 1;
        } else if (user.lastLoginDate !== today) {
          newStreak = 1;
        }
        streakBonus = Math.min(newStreak * 5, 50);
        const newXp = user.xp + streakBonus;
        const streakCoins = Math.floor(streakBonus / 2);
        await storage.updateUser(user.id, {
          streak: newStreak,
          lastLoginDate: today,
          xp: newXp,
          level: calculateLevel(newXp),
          eduCoins: user.eduCoins + streakCoins,
        });
      }

      const updatedUser = await storage.getUser(user.id);
      const newBadges = await checkAndAwardBadges(user.id);
      const finalUser = await storage.getUser(user.id);
      const token = generateToken(user.id);
      const { password: _, ...safeUser } = finalUser!;
      res.json({ token, user: { ...safeUser, tier: getTier(safeUser.xp) }, streakBonus, newBadges });
    } catch (e) {
      res.status(500).json({ error: "Login failed" });
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
  // For now we focus the platform on the System Analysis & Design course only.
  // Other topics remain in the DB but are filtered out of the public API.
  function isSADTopic(name: string) {
    return /system\s*analysis/i.test(name);
  }

  // Allowlist of game types that are visible inside the SAD topic. The 6 new
  // play-to-learn games + two legacy classics the user likes (memory_flip and
  // wordle). Other legacy types (bubble_pop, speed_blitz, matcher, …) stay in
  // the DB but are hidden from the SAD topic listing.
  const SAD_VISIBLE_GAMES = new Set([
    "sdlc_sorter", "req_sorter", "usecase_builder",
    "erd_doctor",  "dfd_detective", "sequence_stacker",
    "memory_flip", "wordle",
  ]);

  app.get("/api/topics", async (req, res) => {
    try {
      const allTopics = await storage.getAllTopics();
      const visible = allTopics.filter(t => isSADTopic(t.name));
      const topicsWithCount = await Promise.all(
        visible.map(async (topic) => {
          const lvls = (await storage.getLevelsByTopic(topic.id))
            .filter(l => SAD_VISIBLE_GAMES.has(l.gameType));
          const lvlsWithCount = await Promise.all(lvls.map(async (lvl) => {
            const qs = await storage.getQuestionsByLevel(lvl.id);
            return { ...lvl, questionCount: Math.max(qs.length, 1) };
          }));
          return { ...topic, levelCount: lvls.length, levels: lvlsWithCount };
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
      if (!isSADTopic(topic.name)) {
        return res.status(404).json({ error: "Topic not available" });
      }
      const topicLevels = (await storage.getLevelsByTopic(topic.id))
        .filter(l => SAD_VISIBLE_GAMES.has(l.gameType));
      const levelsWithCount = await Promise.all(topicLevels.map(async (lvl) => {
        const qs = await storage.getQuestionsByLevel(lvl.id);
        return { ...lvl, questionCount: Math.max(qs.length, 1) };
      }));
      res.json({ ...topic, levels: levelsWithCount });
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
      const level = await storage.getLevel(String(req.params.id));
      if (!level) return res.status(404).json({ error: "Level not found" });
      const qs = await storage.getQuestionsByLevel(level.id);
      res.json({ ...level, questions: qs });
    } catch {
      res.status(500).json({ error: "Failed to fetch level" });
    }
  });

  app.get("/api/levels/:id/questions", authMiddleware, adminMiddleware as any, async (req: AuthRequest, res) => {
    try {
      const qs = await storage.getQuestionsByLevel(String(req.params.id));
      res.json(qs);
    } catch {
      res.status(500).json({ error: "Failed to fetch questions" });
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

  app.put("/api/levels/:id", authMiddleware, adminMiddleware as any, async (req: AuthRequest, res) => {
    try {
      const level = await storage.updateLevel(String(req.params.id), req.body);
      res.json(level);
    } catch {
      res.status(500).json({ error: "Failed to update level" });
    }
  });

  app.delete("/api/levels/:id", authMiddleware, adminMiddleware as any, async (req: AuthRequest, res) => {
    try {
      await storage.deleteLevel(String(req.params.id));
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete level" });
    }
  });

  // ============ QUESTIONS ============
  app.post("/api/questions", authMiddleware, adminMiddleware as any, async (req: AuthRequest, res) => {
    try {
      const question = await storage.createQuestion(req.body);
      res.json(question);
    } catch {
      res.status(500).json({ error: "Failed to create question" });
    }
  });

  app.put("/api/questions/:id", authMiddleware, adminMiddleware as any, async (req: AuthRequest, res) => {
    try {
      const question = await storage.updateQuestion(String(req.params.id), req.body);
      res.json(question);
    } catch {
      res.status(500).json({ error: "Failed to update question" });
    }
  });

  app.delete("/api/questions/:id", authMiddleware, adminMiddleware as any, async (req: AuthRequest, res) => {
    try {
      await storage.deleteQuestion(String(req.params.id));
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete question" });
    }
  });

  // ============ PROGRESS ============
  app.post("/api/progress", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { levelId, stageIndex: rawStageIndex, score, completed } = req.body;
      if (!levelId) return res.status(400).json({ error: "levelId required" });

      const level = await storage.getLevel(levelId);
      if (!level) return res.status(404).json({ error: "Level not found" });

      // Determine totalStages from the seeded question count (min 1).
      const allQuestions = await storage.getQuestionsByLevel(levelId);
      const totalStages = Math.max(allQuestions.length, 1);

      // Clamp stageIndex to the level's real range so callers can't fabricate
      // out-of-range progress rows (e.g. ?stage=999) to game the level-clear bonus.
      const requested = Number.isFinite(Number(rawStageIndex)) ? Math.floor(Number(rawStageIndex)) : 0;
      const stageIndex = Math.min(Math.max(requested, 0), totalStages - 1);

      // Critical section — serialize per (user, level) so two concurrent submits for
      // the same stage can't both classify themselves as the first completion (and
      // double-award XP/coins), and so the "level clear" bonus fires at most once.
      const rewardOutcome = await storage.runWithProgressLock(req.userId!, levelId, async () => {
        const prevStage = await storage.getStageProgress(req.userId!, levelId, stageIndex);
        const prevStages = await storage.getLevelStages(req.userId!, levelId);
        const prevCompletedStages = new Set(prevStages.filter(p => p.completed).map(p => p.stageIndex));
        const wasLevelFullyCompleted = prevCompletedStages.size >= totalStages;

        const isFirstStageCompletion = !prevStage?.completed && completed;

        const saved = await storage.saveProgress(req.userId!, levelId, stageIndex, score, completed);

        // Recompute level-completion state after the save.
        if (completed) prevCompletedStages.add(stageIndex);
        const isLevelFullyCompleted = prevCompletedStages.size >= totalStages;
        const justFinishedLevel = isLevelFullyCompleted && !wasLevelFullyCompleted;

        // Reward math: split level reward across stages; full bonus on first-completion of
        // the stage (rounded up so 4 stages of a 50 XP level = 13 + 13 + 13 + 13 = 52);
        // small replay bonus otherwise; extra "level clear" bonus when the last stage seals it.
        const stageXp = Math.max(1, Math.ceil(level.xpReward / totalStages));
        const stageCoins = Math.max(1, Math.ceil(level.coinReward / totalStages));

        let xpGained = 0;
        let coinsGained = 0;

        if (isFirstStageCompletion) {
          xpGained += stageXp;
          coinsGained += stageCoins;
        } else if (completed) {
          xpGained += Math.floor(stageXp * 0.25);
          coinsGained += Math.floor(stageCoins * 0.25);
        }

        if (justFinishedLevel) {
          // Bonus for completing every stage of a level (~25% of total reward).
          xpGained += Math.max(5, Math.floor(level.xpReward * 0.25));
          coinsGained += Math.max(1, Math.floor(level.coinReward * 0.25));
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

        return { progress: saved, xpGained, coinsGained, isFirstStageCompletion, isLevelFullyCompleted, justFinishedLevel };
      });

      const { progress, xpGained, coinsGained, isFirstStageCompletion, isLevelFullyCompleted, justFinishedLevel } = rewardOutcome;

      const newBadges = completed ? await checkAndAwardBadges(req.userId!) : [];
      const updatedUser = await storage.getUser(req.userId!);
      const { password: _, ...safeUser } = updatedUser!;

      res.json({
        progress,
        xpGained,
        coinsGained,
        stageIndex,
        totalStages,
        isFirstStageCompletion,
        isLevelFullyCompleted,
        justFinishedLevel,
        user: { ...safeUser, tier: getTier(safeUser.xp) },
        newBadges,
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

  // ============ BADGES ============
  app.get("/api/badges", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const all = await storage.getAllBadges();
      const userBadgesList = await storage.getUserBadges(req.userId!);
      const earnedIds = new Set(userBadgesList.map(ub => ub.badgeId));
      const badgesWithStatus = all.map(b => ({
        ...b,
        earned: earnedIds.has(b.id),
        earnedAt: userBadgesList.find(ub => ub.badgeId === b.id)?.earnedAt || null,
      }));
      res.json(badgesWithStatus);
    } catch {
      res.status(500).json({ error: "Failed to fetch badges" });
    }
  });

  app.get("/api/badges/user/:userId", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userBadgesList = await storage.getUserBadges(String(req.params.userId));
      res.json(userBadgesList.map(ub => ub.badge));
    } catch {
      res.status(500).json({ error: "Failed to fetch user badges" });
    }
  });

  // Records that the user passed the teach-back quick check for a SAD game.
  // The client sends { gameType, prompt, pickedIndex }; the server resolves
  // the question from its OWN bank (shared/teach-back.ts plus per-level
  // overrides from questions.options.teachBack) and ONLY records mastery
  // when the picked index matches the bank's correctIndex. Without this
  // check, a malicious client could grant itself the badge by POSTing six
  // times — never trust a "passed" flag from the client.
  app.post("/api/sad/teachback", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const body = (req.body ?? {}) as {
        gameType?: unknown;
        prompt?: unknown;
        pickedIndex?: unknown;
      };
      const gameType = typeof body.gameType === "string" ? body.gameType : "";
      const prompt = typeof body.prompt === "string" ? body.prompt : "";
      const pickedIndex = typeof body.pickedIndex === "number" ? body.pickedIndex : -1;

      if (!isSadGameType(gameType)) {
        return res.status(400).json({ error: "Invalid SAD gameType" });
      }
      if (!prompt) {
        return res.status(400).json({ error: "Missing teach-back prompt" });
      }

      const overrides = await storage.getSadTeachBackOverrides(gameType);
      const pool = [
        ...TEACH_BACK_BANK[gameType as SadGameType],
        ...overrides.filter(isTeachBackQ),
      ];
      const match = pool.find((q) => q.prompt === prompt);
      if (!match) {
        return res.status(400).json({ error: "Unknown teach-back question" });
      }
      const passed = pickedIndex === match.correctIndex;

      const userBefore = await storage.getUser(req.userId!);
      const mastery = passed
        ? await storage.recordSadConceptMastery(req.userId!, gameType)
        : ((userBefore?.sadConceptMastery ?? {}) as Record<string, boolean>);
      const newBadges = passed ? await checkAndAwardBadges(req.userId!) : [];
      const masteredCount = SAD_GAME_TYPES.filter((gt) => mastery[gt] === true).length;
      res.json({ passed, mastery, masteredCount, total: SAD_GAME_TYPES.length, newBadges });
    } catch (e) {
      console.error("Teach-back record error:", e);
      res.status(500).json({ error: "Failed to record teach-back result" });
    }
  });

  app.post("/api/badges/check", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const newBadges = await checkAndAwardBadges(req.userId!);
      res.json({ newBadges });
    } catch {
      res.status(500).json({ error: "Badge check failed" });
    }
  });

  // ============ USERS (Admin) ============
  app.get("/api/admin/users", authMiddleware, adminMiddleware as any, async (req: AuthRequest, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const safe = allUsers.map(({ password: _, ...u }) => ({ ...u, tier: getTier(u.xp) }));
      res.json(safe);
    } catch {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.put("/api/admin/users/:id", authMiddleware, adminMiddleware as any, async (req: AuthRequest, res) => {
    try {
      const { xp, eduCoins, isAdmin } = req.body;
      const updateData: any = {};
      if (xp !== undefined) { updateData.xp = xp; updateData.level = calculateLevel(xp); }
      if (eduCoins !== undefined) updateData.eduCoins = eduCoins;
      if (isAdmin !== undefined) updateData.isAdmin = isAdmin;
      const updated = await storage.updateUser(String(req.params.id), updateData);
      const { password: _, ...safe } = updated;
      res.json({ ...safe, tier: getTier(safe.xp) });
    } catch {
      res.status(500).json({ error: "Failed to update user" });
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
      const cosmeticId = String(req.params.cosmeticId);
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
      const cosmeticId = String(req.params.cosmeticId);
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
      });
      const { password: _, ...safeUser } = updated;
      res.json({ user: { ...safeUser, tier: getTier(safeUser.xp) }, xpReward, coinsReward });
    } catch {
      res.status(500).json({ error: "Reward failed" });
    }
  });

  // ============ FARM HARVEST ============
  // Applies equipped-cosmetic farm multiplier (e.g. Dragon avatar +10%,
  // Tycoon avatar +20%, Aurora frame +10%, Golden frame +5%) on top of
  // the bank amount. Server validates ownership of the equipped items
  // implicitly: we read the equipped ids and look up their `icon`,
  // which maps to perks via shared/cosmetic-perks.ts.
  app.post("/api/farm/harvest", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { coins, skipMult } = req.body;
      if (!coins || coins <= 0) return res.status(400).json({ error: "Invalid coin amount" });
      const baseCoins = Math.min(Math.floor(Number(coins)), 500);
      const user = await storage.getUser(req.userId!);
      if (!user) return res.status(404).json({ error: "User not found" });

      // Look up equipped cosmetic icons → compute perk multiplier.
      // Quest reward claims pass skipMult=true so quest payouts aren't
      // perk-boosted (only the actual farm bank is boosted).
      let perks = { xpMult: 1, farmMult: 1, coinMult: 1 } as { xpMult: number; farmMult: number; coinMult: number };
      if (!skipMult) {
        const { combinePerks } = await import("@shared/cosmetic-perks");
        const all = await storage.getAllCosmetics();
        const byId = new Map(all.map(c => [c.id, c]));
        const aIcon = user.equippedAvatar ? byId.get(user.equippedAvatar)?.icon : null;
        const fIcon = user.equippedFrame  ? byId.get(user.equippedFrame)?.icon  : null;
        const tIcon = user.equippedTheme  ? byId.get(user.equippedTheme)?.icon  : null;
        perks = combinePerks(aIcon, fIcon, tIcon);
      }
      const coinsToAdd = Math.floor(baseCoins * perks.farmMult);
      const bonusCoins = coinsToAdd - baseCoins;

      const updated = await storage.updateUser(req.userId!, {
        eduCoins: user.eduCoins + coinsToAdd,
      });
      const { password: _, ...safeUser } = updated;
      res.json({
        user: { ...safeUser, tier: getTier(safeUser.xp) },
        coinsAdded: coinsToAdd,
        bonusCoins,
        farmMult: perks.farmMult,
      });
    } catch (err) {
      console.error("Farm harvest error:", err);
      res.status(500).json({ error: "Harvest failed" });
    }
  });

  // ============ SPEND COINS ============
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
